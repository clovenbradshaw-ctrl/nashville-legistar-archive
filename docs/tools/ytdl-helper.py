#!/usr/bin/env python3
# ytdl-helper.py — the reader's own machine, beside eoreader7.
#
# The fold's reading surface cannot read YouTube from the browser: youtube.com/watch and
# the InnerTube player send no CORS header, so neither a plain fetch nor yt-dlp running
# inside Pyodide (whose networking is the browser's fetch, under the same CORS rules) can
# reach them. The signed caption URL lives in that unreadable watch page.
#
# What CAN see YouTube is this: yt-dlp running natively on the machine you are already
# reading from. It is not a third-party relay — no one but you sees the address. This is
# the same arrangement as the eoreader7 engine at 127.0.0.1:11436: the surface reaches a
# helper on your own machine. The browser talks to it over http://127.0.0.1, which is
# treated as a secure origin and is not blocked by the page's https.
#
# Captions first (yt-dlp's own subtitle extraction, manual track preferred over auto);
# audio only when there is no caption track, for the in-browser Whisper the surface
# already ships. Nothing is transcribed here.
#
#   python3 tools/ytdl-helper.py                 # listens on 127.0.0.1:11450
#   python3 tools/ytdl-helper.py --port 11450
#   python3 tools/ytdl-helper.py --host 127.0.0.1
#
# Routes (all CORS-open to the browser, which is why the surface can call them):
#   GET /health                       -> {"ok":true,"ytdlp":"2026.08.19"}
#   GET /list?id=<id>&lang=<bcp47>    -> available tracks, manual and automatic
#   GET /captions?id=<id>&lang=<bcp47>-> {title,author,lang,kind,segments:[{start,end,text}]}
#   GET /audio?id=<id>                -> the best audio-only stream (m4a/webm), for Whisper
#   GET /clip?id=&start=&end=&name=   -> one snipped mp4 (yt-dlp --download-sections)
#   GET /stitch?id=&name=&seg=A-B&... -> segments joined into one mp4 (ffmpeg concat)
#
# /clip and /stitch write named mp4 files under clips/ (the reading surface's static root),
# so the browser plays them back at /clips/<name>.mp4. A clip is a cut of real bytes —
# "a difference against a ground" — never a render of a transcript.
#
# Requires: yt-dlp (pipx/pip/homebrew). ffmpeg is needed for /audio remuxing, /clip cuts,
# and /stitch joins; a raw audio-only stream is served without it when possible.

import argparse
import json
import mimetypes
import os
import re
import shutil
import subprocess
import tempfile
import threading

# Where snipped/stitched mp4s land. The reading surface's static server (tools/serve.mjs)
# serves the repo root, so a clip at clips/<name>.mp4 is player on the surface at
# /clips/<name>.mp4. Point FOLD_CLIPS_DIR elsewhere to keep clips out of the repo.
CLIPS_DIR = os.environ.get(
    "FOLD_CLIPS_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "clips"),
)
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

try:
    import yt_dlp
except ImportError:
    raise SystemExit("yt-dlp is not installed. Install it (pipx install yt-dlp, or brew install yt-dlp) and try again.")


def _json3_segments(text):
    """yt-dlp's json3 caption events -> [{start,end,text}], merged like the surface's own reader."""
    try:
        data = json.loads(text)
    except Exception:
        return []
    segs = []
    for ev in data.get("events", []):
        piece = " ".join((s.get("utf8") or "") for s in (ev.get("segs") or []))
        piece = re.sub(r"\s+", " ", piece).strip()
        if not piece:
            continue
        start = (ev.get("tStartMs") or 0) / 1000.0
        end = start + (ev.get("dDurationMs") or 0) / 1000.0
        if segs and start - segs[-1]["end"] < 1.2 and len(segs[-1]["text"] + " " + piece) < 520:
            segs[-1]["text"] += " " + piece
            segs[-1]["end"] = end
        else:
            segs.append({"start": round(start, 2), "end": round(end, 2), "text": piece})
    return segs


def _vtt_segments(text):
    """A minimal WEBVTT fallback for when json3 is not offered."""
    segs = []
    cur = None
    for line in text.splitlines():
        m = re.match(r"(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})", line)
        if m:
            h, mn, s, ms, h2, m2, s2, ms2 = (int(x) for x in m.groups())
            cur = {"start": round(h * 3600 + mn * 60 + s + ms / 1000, 2),
                   "end": round(h2 * 3600 + m2 * 60 + s2 + ms2 / 1000, 2), "text": ""}
            segs.append(cur)
        elif cur is not None and line.strip():
            t = re.sub(r"<[^>]+>", "", line).replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").strip()
            if t:
                cur["text"] = (cur["text"] + " " + t).strip()
    return [s for s in segs if s["text"]]


def _pick_lang(available, wanted):
    """Prefer the exact requested tag, then anything with that base, then 'en', then anything."""
    if not available:
        return None
    keys = list(available.keys())
    want = (wanted or "en").lower()
    base = want.split("-")[0]
    for k in keys:
        if k.lower() == want:
            return k
    for k in keys:
        if k.lower().split("-")[0] == base:
            return k
    for k in keys:
        if k.lower().split("-")[0] == "en":
            return k
    return keys[0]


def _track_info(info):
    """(title, author, manual dict, auto dict), each language -> [formats]."""
    return (info.get("title") or "", info.get("uploader") or info.get("channel") or "",
            info.get("subtitles") or {}, info.get("automatic_captions") or {})


def _probe(url):
    with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True}) as ydl:
        return ydl.extract_info(url, download=False)


def fetch_captions(video_id, wanted_lang):
    url = "https://www.youtube.com/watch?v=" + video_id
    # Ask once what track exists, choose exactly one, then fetch only that one. Requesting a
    # glob against the watch page downloads every language variant and earns a 429.
    info = _probe(url)
    title, author, manual, auto = _track_info(info)
    if manual:
        lang, kind, manual_flag = _pick_lang(manual, wanted_lang), "manual", True
    elif auto:
        lang, kind, manual_flag = _pick_lang(auto, wanted_lang), "asr", False
    else:
        return None
    with tempfile.TemporaryDirectory(prefix="ytcap-") as tmp:
        opts = {
            "skip_download": True,
            "writesubtitles": manual_flag,
            "writeautomaticsub": not manual_flag,
            "subtitleslangs": [lang],
            "subtitlesformat": "json3/vtt/best",
            "outtmpl": os.path.join(tmp, "%(id)s.%(ext)s"),
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.extract_info(url, download=True)
        files = [f for f in os.listdir(tmp) if f.endswith((".json3", ".vtt"))]
        chosen = None
        for f in files:
            if f.endswith("." + lang + ".json3"):
                chosen = f
                break
        if not chosen:
            for f in files:
                if f.endswith("." + lang + ".vtt"):
                    chosen = f
                    break
        if not chosen and files:
            chosen = sorted(files, key=lambda f: (not f.endswith(".json3"), len(f)))[0]
        if not chosen:
            return None
        raw = open(os.path.join(tmp, chosen), encoding="utf-8", errors="replace").read()
        segs = _json3_segments(raw) if chosen.endswith(".json3") else _vtt_segments(raw)
        if not segs:
            return None
        return {"title": title, "author": author, "lang": lang, "kind": kind, "segments": segs}


def list_tracks(video_id, wanted_lang):
    info = _probe("https://www.youtube.com/watch?v=" + video_id)
    title, author, manual, auto = _track_info(info)
    rows = []
    for code in sorted(manual.keys()):
        rows.append({"lang": code, "kind": "manual", "name": (manual[code][0].get("name") if manual[code] else "") or code})
    for code in sorted(auto.keys()):
        rows.append({"lang": code, "kind": "asr", "name": (auto[code][0].get("name") if auto[code] else "") or code})
    # surface the requested language first
    rows.sort(key=lambda r: (r["kind"] != "manual", r["lang"].lower() != (wanted_lang or "en").lower(), r["lang"]))
    return {"title": title, "author": author, "tracks": rows}


def fetch_audio(video_id):
    tmp = tempfile.mkdtemp(prefix="ytaudio-")
    opts = {
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "outtmpl": os.path.join(tmp, "%(id)s.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.extract_info("https://www.youtube.com/watch?v=" + video_id, download=True)
    files = [os.path.join(tmp, f) for f in os.listdir(tmp)]
    if not files:
        shutil.rmtree(tmp, ignore_errors=True)
        return None, None, None
    path = max(files, key=os.path.getsize)
    ext = os.path.splitext(path)[1].lower()
    mime = {"m4a": "audio/mp4", "mp4": "audio/mp4", "webm": "audio/webm", "opus": "audio/ogg", "ogg": "audio/ogg"}.get(ext.lstrip(".")) \
        or mimetypes.guess_type(path)[0] or "application/octet-stream"
    return path, mime, tmp


# --- snip / stitch -----------------------------------------------------------
# The cut is real bytes: yt-dlp's --download-sections on the reader's own machine, then
# ffmpeg only where a join needs one encoding. The model never invents a cut.

def _to_seconds(t):
    """'HH:MM:SS', 'MM:SS', or a bare second count -> float seconds; else None."""
    t = str(t or "").strip()
    if not t:
        return None
    if re.fullmatch(r"\d+(?:\.\d+)?", t):
        n = float(t)
        return round(n, 2) if n >= 0 else None
    m = re.fullmatch(r"(\d{1,3}):([0-5]?\d)(?::([0-5]?\d))?", t)
    if not m:
        return None
    h, mn, s = m.group(1), m.group(2), m.group(3)
    secs = (int(h) * 3600 + int(mn) * 60 + int(s or 0)) if s is not None else (int(h) * 60 + int(mn))
    return round(float(secs), 2)


def _clock(sec):
    h, rem = divmod(int(round(sec)), 3600)
    m, s = divmod(rem, 60)
    return "%02d:%02d:%02d" % (h, m, s)


def _slug(name):
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", str(name or "").strip().lower()).strip("-._")
    return slug[:80] or "clip"


def _probe_duration(video_id):
    """(duration, title) or (None, '') — the bound is best-effort: a blocked probe must
    never withhold a cut, only its range check."""
    try:
        info = _probe("https://www.youtube.com/watch?v=" + video_id)
        return info.get("duration"), info.get("title") or ""
    except Exception:
        return None, ""


def _download_section(video_id, start, end, outpath):
    """One absolute range of one video, cut to keyframes, merged to an mp4. argv-bounded."""
    cmd = [
        "yt-dlp", "--no-warnings", "--force-overwrites", "--no-progress", "--quiet",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best",
        "--download-sections", "*%s-%s" % (start, end),
        "--force-keyframes-at-cuts",
        "--merge-output-format", "mp4",
    ]
    # Optional: passing a browser name lets yt-dlp lift cookies for the bot wall the
    # datacenter IP sometimes meets ("Sign in to confirm you're not a bot"). Off by default.
    cookies = os.environ.get("FOLD_YTDL_COOKIES", "").strip()
    if cookies:
        cmd += ["--cookies-from-browser", cookies]
    cmd += ["-o", outpath, "https://www.youtube.com/watch?v=" + video_id]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=900)
    except subprocess.CalledProcessError as e:
        stderr = (e.stderr or "").strip() or str(e)
        raise yt_dlp.utils.DownloadError(stderr.splitlines()[-1] if stderr.splitlines() else stderr)


def _concat_parts(parts, final):
    """Join pre-cut mp4s in order: every part narrowed to one frame size, frame rate and
    channel layout, then concat — so a stitch is playable however the parts differ."""
    inputs = []
    for p in parts:
        inputs += ["-i", p]
    graph, joins = [], ""
    for i in range(len(parts)):
        graph.append(
            "[%d:v]scale=1280:720:force_original_aspect_ratio=decrease,"
            "pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1[v%d];"
            "[%d:a]aresample=44100,aformat=channel_layouts=stereo[a%d]" % (i, i, i, i)
        )
        joins += "[v%d][a%d]" % (i, i)
    graph.append("%sconcat=n=%d:v=1:a=1[v][a]" % (joins, len(parts)))
    cmd = ["ffmpeg", "-y", "-loglevel", "error"] + inputs + [
        "-filter_complex", ";".join(graph),
        "-map", "[v]", "-map", "[a]",
        "-movflags", "+faststart",
        final,
    ]
    subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=900)


def fetch_clip(video_id, start, end, name, outdir):
    os.makedirs(outdir, exist_ok=True)
    slug = _slug(name) or ("clip-%s-%s-%s" % (video_id, start.replace(":", "-"), end.replace(":", "-")))
    final = os.path.join(outdir, slug + ".mp4")
    part = os.path.join(outdir, "." + slug + ".tmp.mp4")
    _download_section(video_id, _clock(start), _clock(end), part)
    os.replace(part, final)
    return final


def fetch_stitch(video_id, spans, name, outdir):
    """Several ranges of one video joined in order into one mp4."""
    os.makedirs(outdir, exist_ok=True)
    slug = _slug(name) or ("stitch-%s-%d" % (video_id, len(spans)))
    final = os.path.join(outdir, slug + ".mp4")
    tmp = tempfile.mkdtemp(prefix="ytstitch-")
    try:
        parts = []
        for i, (a, b) in enumerate(spans):
            p = os.path.join(tmp, "part%d.mp4" % i)
            _download_section(video_id, _clock(a), _clock(b), p)
            parts.append(p)
        _concat_parts(parts, final)
        return final
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _clip_manifest(kind, video_id, title, name, segments_sec, path):
    rel = "/clips/" + os.path.basename(path)
    return {
        "ok": True,
        "kind": kind,
        "id": video_id,
        "title": title,
        "name": _slug(name),
        "url": rel,
        "path": path,
        "size": os.path.getsize(path) if os.path.exists(path) else 0,
        "segments": [{"start": a, "end": b} for a, b in segments_sec],
        "duration": round(sum(b - a for a, b in segments_sec), 2),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "fold-ytdl-helper/1"

    def log_message(self, *a):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def _send(self, code, body, ctype="application/json"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        vid = (q.get("id") or [""])[0].strip()
        lang = (q.get("lang") or ["en"])[0].strip() or "en"
        if u.path == "/health":
            return self._send(200, {"ok": True, "ytdlp": getattr(yt_dlp.version, "__version__", "unknown")})
        if not re.fullmatch(r"[\w-]{11}", vid):
            return self._send(400, {"error": "a YouTube video id (11 chars) is required as ?id="})
        try:
            if u.path == "/list":
                return self._send(200, list_tracks(vid, lang))
            if u.path == "/captions":
                got = fetch_captions(vid, lang)
                if not got:
                    return self._send(404, {"error": "no caption track for this video"})
                got["id"] = vid
                return self._send(200, got)
            if u.path == "/audio":
                path, mime, tmp = fetch_audio(vid)
                if not path:
                    return self._send(404, {"error": "no audio stream"})
                size = os.path.getsize(path)
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(size))
                self.end_headers()
                try:
                    with open(path, "rb") as f:
                        shutil.copyfileobj(f, self.wfile)
                finally:
                    shutil.rmtree(tmp, ignore_errors=True)
                return
            if u.path == "/clip":
                name = (q.get("name") or [""])[0].strip() or "clip"
                a, b = _to_seconds((q.get("start") or [""])[0]), _to_seconds((q.get("end") or [""])[0])
                if a is None or b is None or a >= b:
                    return self._send(400, {"error": "start and end are required (hh:mm:ss or seconds) and start must precede end"})
                dur, title = _probe_duration(vid)
                if dur and b > dur:
                    return self._send(400, {"error": "end is past the end of the video (%.0f s)" % dur})
                path = fetch_clip(vid, a, b, name, CLIPS_DIR)
                return self._send(200, _clip_manifest("clip", vid, title, name, [(a, b)], path))
            if u.path == "/stitch":
                name = (q.get("name") or [""])[0].strip() or "stitch"
                spans = []
                for seg in (q.get("seg") or []):
                    lo, _, hi = str(seg).partition("-")
                    a, b = _to_seconds(lo), _to_seconds(hi)
                    if a is None or b is None or a >= b:
                        return self._send(400, {"error": "each seg= must be a range start-end (hh:mm:ss or seconds)"})
                    spans.append((a, b))
                if not spans:
                    return self._send(400, {"error": "a stitch needs at least one seg=start-end; repeat seg= for more parts"})
                if len(spans) > 12:
                    return self._send(400, {"error": "a stitch is capped at 12 parts"})
                dur, title = _probe_duration(vid)
                if dur and any(b > dur for _, b in spans):
                    return self._send(400, {"error": "a stitch range runs past the end of the video (%.0f s)" % dur})
                path = fetch_stitch(vid, spans, name, CLIPS_DIR)
                return self._send(200, _clip_manifest("stitch", vid, title, name, spans, path))
            return self._send(404, {"error": "no such route"})
        except yt_dlp.utils.DownloadError as e:
            return self._send(502, {"error": "yt-dlp: " + str(e)})
        except Exception as e:  # noqa: BLE001 — this is a local helper; report, never crash
            return self._send(500, {"error": type(e).__name__ + ": " + str(e)})


def main():
    global CLIPS_DIR
    ap = argparse.ArgumentParser(description="yt-dlp helper for the fold: captions, audio, and snip/stitch clips for a YouTube video, on your own machine.")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=11450)
    ap.add_argument("--clips-dir", default=None)
    args = ap.parse_args()
    if args.clips_dir:
        CLIPS_DIR = args.clips_dir
    os.makedirs(CLIPS_DIR, exist_ok=True)
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    srv.daemon_threads = True
    print("fold yt-dlp helper listening on http://%s:%d  (set localStorage hd:ytdl to change)" % (args.host, args.port))
    print("captions: /captions?id=<video-id>   audio: /audio?id=<video-id>   health: /health")
    print("snip: /clip?id=<id>&start=<t>&end=<t>&name=<slug>   stitch: /stitch?id=<id>&name=<slug>&seg=<t>-<t>[&seg=...]")
    print("clips are written to %s and served by the surface at /clips/<name>.mp4" % CLIPS_DIR)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
