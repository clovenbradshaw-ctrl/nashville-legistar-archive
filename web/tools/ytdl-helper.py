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
#
# Requires: yt-dlp (pipx/pip/homebrew). ffmpeg is only needed for /audio remuxing; a raw
# audio-only stream is served without it when possible.

import argparse
import json
import mimetypes
import os
import re
import shutil
import tempfile
import threading
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
            return self._send(404, {"error": "no such route"})
        except yt_dlp.utils.DownloadError as e:
            return self._send(502, {"error": "yt-dlp: " + str(e)})
        except Exception as e:  # noqa: BLE001 — this is a local helper; report, never crash
            return self._send(500, {"error": type(e).__name__ + ": " + str(e)})


def main():
    ap = argparse.ArgumentParser(description="yt-dlp helper for the fold: captions and audio for a YouTube video, on your own machine.")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=11450)
    args = ap.parse_args()
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    srv.daemon_threads = True
    print("fold yt-dlp helper listening on http://%s:%d  (set localStorage hd:ytdl to change)" % (args.host, args.port))
    print("captions: /captions?id=<video-id>   audio: /audio?id=<video-id>   health: /health")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
