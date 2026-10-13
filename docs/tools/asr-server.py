#!/usr/bin/env python3
"""asr-server.py — the fold's local transcription service.

A tiny loopback HTTP service wrapping MLX Whisper (Apple-silicon Metal) so the
surface can transcribe audio/video without a browser recognizer and without any
relay: the bytes go to 127.0.0.1 and the transcript comes back. This is the
"local audio transcription" rung the surface prefers; in-browser Whisper stays
as the fallback when this service is down.

Endpoints
  GET  /health                     -> { ok, engine, model, device }
  POST /transcribe?language=en&prompt=...&task=transcribe
       body = raw audio/video bytes (Content-Type audio/* or video/* or octet-stream)
       -> { source, model, segments:[{start,end,text}], text, language, duration, priors }

Usage (run with the whisper venv's python, which has mlx_whisper):
  .whisper-venv/bin/python tools/asr-server.py --port 11460
  # or, from the holodeck dir:  npm run asr

Options
  --port N            port to bind (default 11460)
  --host H            host to bind (default 127.0.0.1)
  --model PATH|REPO   mlx_whisper model (default: local whisper-small-mlx, else mlx-community/whisper-small-mlx)
  --no-prewarm        don't load the model until the first request
"""
import argparse
import json
import os
import sys
import tempfile
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
LOCAL_MODEL = os.path.join(os.path.dirname(REPO), "whisper-models", "whisper-small-mlx")
DEFAULT_MODEL = LOCAL_MODEL if os.path.isdir(LOCAL_MODEL) else "mlx-community/whisper-small-mlx"

_LOCK = threading.Lock()


def log(*a):
    print("[asr]", *a, file=sys.stderr, flush=True)


class ASR:
    def __init__(self, model):
        self.model = model
        self.engine = "mlx-whisper"
        self._w = None

    def load(self):
        if self._w is None:
            with _LOCK:
                if self._w is None:
                    log("loading", self.model, "…")
                    import mlx_whisper  # noqa: F401
                    self._w = mlx_whisper
                    log("ready")
        return self._w

    def transcribe(self, path, language=None, prompt=None, task="transcribe"):
        w = self.load()
        kwargs = {"path_or_hf_repo": self.model, "verbose": False}
        if task in ("transcribe", "translate"):
            kwargs["task"] = task
        if language and language != "auto":
            kwargs["language"] = language
        if prompt:
            kwargs["initial_prompt"] = prompt
        out = w.transcribe(path, **kwargs)
        segs = []
        for s in out.get("segments", []) or []:
            text = (s.get("text") or "").strip()
            if not text:
                continue
            segs.append({
                "start": round(float(s.get("start") or 0.0), 2),
                "end": round(float(s.get("end") or s.get("start") or 0.0), 2),
                "text": text,
            })
        dur = segs[-1]["end"] if segs else 0.0
        return {
            "source": "local-mlx-whisper",
            "model": self.model,
            "segments": segs,
            "text": (out.get("text") or "").strip(),
            "language": out.get("language") or (language or "auto"),
            "duration": dur,
            "priors": {"prompt": prompt or None, "language": language or "auto"},
        }


class Handler(BaseHTTPRequestHandler):
    server_version = "fold-asr/1"
    asr = None  # set in main

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Max-Age", "86400")

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if urlparse(self.path).path == "/health":
            return self._json(200, {
                "ok": True,
                "engine": self.asr.engine,
                "model": self.asr.model,
                "device": "metal (Apple silicon)",
                "loaded": self.asr._w is not None,
            })
        self._json(404, {"error": "not found"})

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != "/transcribe":
            return self._json(404, {"error": "not found"})
        q = parse_qs(u.query)
        language = (q.get("language", [None])[0]) or None
        prompt = (q.get("prompt", [None])[0]) or None
        task = (q.get("task", ["transcribe"])[0]) or "transcribe"
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            return self._json(400, {"error": "empty body"})
        raw = self.rfile.read(length)
        ctype = (self.headers.get("Content-Type") or "audio/wav").split(";")[0].strip()
        ext = {
            "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/mpeg": ".mp3",
            "audio/mp4": ".m4a", "audio/x-m4a": ".m4a", "audio/m4a": ".m4a",
            "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm",
            "audio/webm": ".webm", "audio/ogg": ".ogg", "audio/flac": ".flac",
        }.get(ctype, ".wav")
        fd, path = tempfile.mkstemp(suffix=ext)
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(raw)
            log("transcribe", len(raw), "bytes", ext, "lang=", language, "task=", task)
            out = self.asr.transcribe(path, language=language, prompt=prompt, task=task)
            log("->", len(out["segments"]), "segments")
            return self._json(200, out)
        except Exception as e:  # noqa: BLE001
            log("ERROR", e)
            traceback.print_exc()
            return self._json(500, {"error": str(e)})
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass

    def log_message(self, fmt, *args):  # quieter default logging
        log(self.address_string(), fmt % args)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=int(os.environ.get("FOLD_ASR_PORT", "11460")))
    ap.add_argument("--host", default=os.environ.get("FOLD_ASR_HOST", "127.0.0.1"))
    ap.add_argument("--model", default=os.environ.get("FOLD_ASR_MODEL", DEFAULT_MODEL))
    ap.add_argument("--no-prewarm", action="store_true")
    args = ap.parse_args()

    Handler.asr = ASR(args.model)
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    log(f"listening on http://{args.host}:{args.port}  model={args.model}")
    if not args.no_prewarm:
        try:
            Handler.asr.load()
        except Exception as e:  # noqa: BLE001
            log("prewarm failed (will retry on first request):", e)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        log("stopping")
        srv.shutdown()


if __name__ == "__main__":
    main()
