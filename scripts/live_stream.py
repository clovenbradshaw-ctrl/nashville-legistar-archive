"""Realtime feed for the Metro contract pipeline -- the eviction-tracker
live-scraper pattern, on the contract VM.

Tails data/live/events.jsonl (written by src/live.py from every stage) and
serves it as Server-Sent Events:

    GET /stream     SSE (backlog of the last 50 lines on connect, then live)
    GET /health     {"ok": true, "bytes": N}
    GET /tail?n=100 last n events as JSON

Listens on 127.0.0.1:8500 by default; nginx proxies a vhost's /live/ to it
with buffering off for a public feed from anywhere. CORS is open so the page
can be previewed cross-origin through an SSH tunnel too.
"""
from __future__ import annotations

import json
import pathlib
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = pathlib.Path(__file__).resolve().parent.parent
EVENTS = ROOT / "data" / "live" / "events.jsonl"
ROUNDUPS = ROOT / "data" / "live" / "roundups.jsonl"
BACKLOG = 50


def last_lines(path: pathlib.Path, n: int) -> list[str]:
    if not path.exists():
        return []
    with open(path) as f:
        tail = f.readlines()
    return [l for l in tail[-n:] if l.strip()]


class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-methods", "GET")
        self.send_header("cache-control", "no-cache")
        self.send_header("connection", "keep-alive")

    def _send_json(self, obj, code: int = 200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/health":
            size = EVENTS.stat().st_size if EVENTS.exists() else 0
            self._send_json({"ok": True, "bytes": size})
            return
        if u.path == "/tail":
            n = int(parse_qs(u.query).get("n", ["100"])[0])
            self._send_json({"events": [json.loads(l) for l in last_lines(EVENTS, n)]})
            return
        if u.path == "/roundup":
            q = parse_qs(u.query)
            import summarize
            hours = [int(v) for v in q.get("hours", ["24,168,720"])[0].split(",") if v.strip()]
            periods = {f"{h}h": summarize.period_summary(f"{h}h", h) for h in hours}
            rounds = [json.loads(l) for l in last_lines(ROUNDUPS, 5)]
            self._send_json({"periods": periods, "roundups": rounds})
            return
        if u.path != "/stream":
            self._send_json({"ok": False, "error": "use /stream, /tail, /roundup, /health"}, 404)
            return

        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self._cors()
        self.end_headers()
        try:
            backlog = last_lines(EVENTS, BACKLOG)
            for line in backlog:
                self.wfile.write(f"data: {line}\n\n".encode())
            self.wfile.write(b"event: ready\ndata: {}\n\n")
            self.wfile.flush()

            if not EVENTS.exists():
                EVENTS.parent.mkdir(parents=True, exist_ok=True)
                EVENTS.touch()
            import os
            import summarize
            ticks = 0
            fstat = os.stat(EVENTS)
            fh = open(EVENTS)
            fh.seek(0, 2)
            ino, pos = fstat.st_ino, fh.tell()
            while True:
                # Rotation-safe: scripts/trim.py truncates events.jsonl via
                # atomic replace (new inode); a changed inode or a file that
                # shrank under us means the log was rotated -- reopen rather
                # than keep streaming into a dead inode.
                try:
                    cur = os.stat(EVENTS)
                    if cur.st_ino != ino or cur.st_size < pos:
                        fh.close()
                        fh = open(EVENTS)
                        fh.seek(0, 2)
                        ino, pos = os.stat(EVENTS).st_ino, fh.tell()
                        self.wfile.write(b'data: {"kind":"system","note":"live log rotated/trimmed"}\n\n')
                        self.wfile.flush()
                        continue
                except FileNotFoundError:
                    pass
                line = fh.readline()
                if line:
                    self.wfile.write(f"data: {line}\n\n".encode())
                    self.wfile.flush()
                    ticks = 0
                    pos = fh.tell()
                    continue
                # EOF: lightweight keep-alive, plus a state snapshot every
                # 30s so the page's "what's going on" panel stays honest
                self.wfile.write(b": ping\n\n")
                ticks += 1
                if ticks % 2 == 0:
                    try:
                        snap = summarize.state_summary()
                        self.wfile.write(f"event: snapshot\ndata: {json.dumps(snap)}\n\n".encode())
                    except Exception:  # noqa: BLE001 - a snapshot is adornment
                        pass
                self.wfile.flush()
                time.sleep(15)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, *a):
        return


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8500
    print(f"mcdp-live SSE on 127.0.0.1:{port}")
    HTTPServer(("127.0.0.1", port), H).serve_forever()