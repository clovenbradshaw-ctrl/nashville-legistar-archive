#!/usr/bin/env python3
"""Read-only query service over data/counties/county.sqlite (stdlib only).

Built for a phone on a slow link: every response is small and bounded.
  GET /api/counties                      95 rows of stats          (ETag, cacheable)
  GET /api/search?q=&county=&kind=&sort=recent|relevance&after=&limit=
  GET /api/doc?id=
Wise-query rules, enforced here rather than hoped for in the client:
  * county and kind are applied through the FTS index (cty:c<fips>, kd:k<kind>), never post-filtered
  * the FTS table is walked in rowid order (newest first) and the docs rows fetched by id after:
    no join, no sort over the match set, so a term matching 100k rows costs what one matching 10 does
  * recent order paginates by keyset (id < after) -- no OFFSET, so page 400 costs what page 1 does
  * relevance order is top-k only (<= RELEVANCE_CAP) and only inside one county; across counties
    it falls back to recency and says so (bm25 has to score every match)
  * limit capped at 50; slim columns only; no SELECT * and no count(*) over the corpus
  * the DB is opened read-only: this process cannot write the log or the index
"""
from __future__ import annotations

import argparse
import hashlib
import mimetypes
import json
import os
import re
import sqlite3
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import counties as C

DB_PATH = Path(os.environ.get("COUNTY_DB") or Path(os.environ.get("COUNTY_STORE") or C.COUNTIES_DIR) / "county.sqlite")
LIMIT_MAX, RELEVANCE_CAP = 50, 50
STORE = Path(os.environ.get("COUNTY_STORE") or C.COUNTIES_DIR)
LOG_CHUNK = 1 << 20                      # bytes of log per response: whole lines only
FILE_MAX = 60 * 1024 * 1024
PAGE = Path(__file__).resolve().parent.parent / "docs" / "counties.html"
STATIC = {"/county-store.js": ("county-store.js", "text/javascript"), "/counties-sw.js": ("counties-sw.js", "text/javascript"),
          "/scoreboard": ("scoreboard.html", "text/html"), "/scoreboard.html": ("scoreboard.html", "text/html")}
SLIM = "d.id,d.fips,d.county,d.title,d.kind,d.party,d.dept,d.number,d.expires,d.fetched_at,d.bytes,d.url"
TOK = re.compile(r"\w+", re.U)


def fts_match(q: str, fips: str | None, kind: str | None = None) -> str | None:
    """User text -> a safe FTS5 expression: every token quoted, last one a prefix."""
    toks = TOK.findall(q or "")[:8]
    parts = [f'"{t}"' for t in toks]
    if parts and len(toks[-1]) >= 2:
        parts[-1] = f'"{toks[-1]}"*'
    if fips:
        parts.insert(0, f"cty:c{fips}")
    if kind:
        parts.insert(0, f"kd:k{kind}")
    return " AND ".join(parts) if parts else None


class Svc:
    def __init__(self, path: Path):
        self.path = path
        self.local: dict[int, sqlite3.Connection] = {}

    def db(self) -> sqlite3.Connection:
        t = threading.get_ident()
        if t not in self.local:
            c = sqlite3.connect(f"file:{self.path}?mode=ro", uri=True, check_same_thread=False)
            c.execute("PRAGMA query_only=ON")
            c.row_factory = sqlite3.Row
            self.local[t] = c
        return self.local[t]

    def counties(self):
        rows = self.db().execute("SELECT fips,county,n_docs,n_bytes,last_fetch,coverage FROM county_stats ORDER BY fips").fetchall()
        return {"counties": [dict(r) for r in rows]}

    def needs_human(self):
        rows = self.db().execute("SELECT fips,county,url,status,kind,noted FROM needs_human ORDER BY county,url").fetchall()
        return {"items": [dict(r) for r in rows]}

    def search(self, p):
        q = (p.get("q") or [""])[0].strip()
        fips = (p.get("county") or [""])[0]
        kind = (p.get("kind") or [""])[0]
        sort = (p.get("sort") or ["recent"])[0]
        after = int((p.get("after") or ["0"])[0] or 0)
        limit = max(1, min(int((p.get("limit") or ["25"])[0]), LIMIT_MAX))
        if fips and not re.fullmatch(r"47\d{3}", fips):
            raise ValueError("county")
        if kind and not re.fullmatch(r"[a-z]{3,12}", kind):
            raise ValueError("kind")
        db = self.db()
        match = fts_match(q, fips or None, kind or None) if (q or kind) else None
        if match is None:
            # plain browse: the (fips, id DESC) index, keyset
            args: list = []
            where = []
            if fips:
                where.append("d.fips=?"); args.append(fips)
            if after:
                where.append("d.id<?"); args.append(after)
            sql = f"SELECT {SLIM} FROM docs d {'WHERE ' + ' AND '.join(where) if where else ''} ORDER BY d.id DESC LIMIT ?"
            rows = [dict(r) for r in db.execute(sql, (*args, limit + 1)).fetchall()]
            more = len(rows) > limit
            rows = rows[:limit]
            return {"rows": rows, "next": rows[-1]["id"] if more else None, "sort": "recent"}
        # relevance (bm25 must score every match) is only bounded inside one county;
        # across counties it falls back to recency, and says so.
        ranked = sort == "relevance" and bool(fips) and bool(q)
        if ranked:
            ids = [r[0] for r in db.execute(
                "SELECT rowid FROM docs_fts WHERE docs_fts MATCH ? ORDER BY bm25(docs_fts) LIMIT ?",
                (match, min(limit, RELEVANCE_CAP))).fetchall()]
            nxt = None
        else:
            args = [match]
            cond = "docs_fts MATCH ?"
            if after:
                cond += " AND rowid < ?"; args.append(after)
            ids = [r[0] for r in db.execute(
                f"SELECT rowid FROM docs_fts WHERE {cond} ORDER BY rowid DESC LIMIT ?", (*args, limit + 1)).fetchall()]
            nxt = ids[limit - 1] if len(ids) > limit else None
            ids = ids[:limit]
        if not ids:
            return {"rows": [], "next": None, "sort": "relevance" if ranked else "recent"}
        got = {r["id"]: dict(r) for r in db.execute(
            f"SELECT {SLIM} FROM docs d WHERE d.id IN ({','.join('?' * len(ids))})", ids).fetchall()}
        return {"rows": [got[i] for i in ids if i in got], "next": nxt, "sort": "relevance" if ranked else "recent"}

    def log_tail(self, p):
        """The append-only log of one county from a cursor, so a device can fold it locally.
        File-backed counties use a byte offset; Davidson (legacy, not a CountyDoc log) is replayed
        from the index as CountyDoc rows by id. Whole lines only; the cursor is opaque to the client."""
        fips = (p.get("county") or [""])[0]
        which = (p.get("which") or ["manifest"])[0]
        start = int((p.get("from") or ["0"])[0] or 0)
        reg = next((r for r in C.load() if r["fips"] == fips), None)
        if not reg or which not in ("manifest", "ops") or start < 0:
            raise ValueError("log")
        if reg["legacy"]:
            if which == "ops":
                return b"", start, start
            rows = self.db().execute(
                "SELECT id,fips,county,url,title,kind,number,party,dept,description,status,expires,bytes,sha256,found_on,fetched_at"
                " FROM docs WHERE fips=? AND id>? ORDER BY id LIMIT 2000", (fips, start)).fetchall()
            out = b"".join((json.dumps({**dict(r), "schema": "CountyDoc@1"}, separators=(",", ":")) + "\n").encode() for r in rows)
            return out, (rows[-1]["id"] if rows else start), start
        f = STORE / reg["slug"] / f"{which}.jsonl"
        if not f.exists():
            return b"", start, start
        size = f.stat().st_size
        if start > size:                       # the log was rewritten under the client: tell it to restart
            raise ValueError("offset-past-end")
        with f.open("rb") as fh:
            fh.seek(start)
            buf = fh.read(LOG_CHUNK)
        cut = buf.rfind(b"\n") + 1
        return buf[:cut], start + cut, start

    def file_path(self, p):
        sha = (p.get("sha") or [""])[0]
        if sha:                                # a device addresses a file by (county, sha256): log rows carry no id
            if not re.fullmatch(r"[0-9a-f]{64}", sha) or not re.fullmatch(r"47\d{3}", (p.get("county") or [""])[0]):
                raise ValueError("file")
            r = self.db().execute("SELECT file FROM docs WHERE fips=? AND sha256=? AND file IS NOT NULL LIMIT 1",
                                  ((p.get("county") or [""])[0], sha)).fetchone()
        else:
            r = self.db().execute("SELECT file FROM docs WHERE id=?", (int((p.get("id") or ["0"])[0]),)).fetchone()
        if not r or not r["file"]:
            return None
        path = (STORE / r["file"]).resolve()
        if STORE.resolve() not in path.parents or not path.is_file() or path.stat().st_size > FILE_MAX:
            return None                        # never serve anything outside the store
        return path

    def doc(self, p):
        r = self.db().execute("SELECT * FROM docs WHERE id=?", (int((p.get("id") or ["0"])[0]),)).fetchone()
        return dict(r) if r else None


def make_handler(svc: Svc):
    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _send(self, code, obj, cache="no-store"):
            body = json.dumps(obj, separators=(",", ":")).encode()
            etag = '"' + hashlib.sha1(body).hexdigest()[:16] + '"'
            if self.headers.get("If-None-Match") == etag:
                self.send_response(304)
                self.send_header("ETag", etag)
                self.end_headers()
                return
            self.send_response(code)
            for k, v in (("Content-Type", "application/json"), ("Content-Length", str(len(body))), ("ETag", etag),
                         ("Cache-Control", cache), ("Access-Control-Allow-Origin", "*")):
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def _stream_scoreboard(self):
            """Server-sent events: one `data:` frame when scoreboard.json changes, a comment as keep-alive."""
            import time as _t
            self.send_response(200)
            for k, v in (("Content-Type", "text/event-stream"), ("Cache-Control", "no-store"),
                         ("Access-Control-Allow-Origin", "*"), ("X-Accel-Buffering", "no")):
                self.send_header(k, v)
            self.end_headers()
            f, last, idle = STORE / "scoreboard.json", None, 0
            try:
                while True:
                    m = f.stat().st_mtime if f.exists() else None
                    if m is not None and m != last:
                        last = m
                        self.wfile.write(b"data: " + f.read_bytes() + b"\n\n")
                        self.wfile.flush()
                        idle = 0
                    elif idle >= 15:
                        self.wfile.write(b": keep-alive\n\n")
                        self.wfile.flush()
                        idle = 0
                    _t.sleep(2)
                    idle += 2
            except (BrokenPipeError, ConnectionResetError, OSError):
                return

        def do_GET(self):
            u = urlparse(self.path)
            p = parse_qs(u.query)
            if u.path in STATIC and (PAGE.parent / STATIC[u.path][0]).exists():
                body = (PAGE.parent / STATIC[u.path][0]).read_bytes()
                self.send_response(200)
                for k, v in (("Content-Type", STATIC[u.path][1] + "; charset=utf-8"), ("Content-Length", str(len(body))),
                             ("Cache-Control", "no-cache"), ("Service-Worker-Allowed", "/")):
                    self.send_header(k, v)
                self.end_headers()
                self.wfile.write(body)
                return
            if u.path in ("/", "/index.html", "/counties.html") and PAGE.exists():
                body = PAGE.read_bytes()
                self.send_response(200)
                for k, v in (("Content-Type", "text/html; charset=utf-8"), ("Content-Length", str(len(body))),
                             ("Cache-Control", "no-cache")):
                    self.send_header(k, v)
                self.end_headers()
                self.wfile.write(body)
                return
            try:
                if u.path.endswith("/counties"):
                    return self._send(200, svc.counties(), "public, max-age=300")
                if u.path.endswith("/log"):
                    body, nxt, start = svc.log_tail(p)
                    self.send_response(200)
                    for k, v in (("Content-Type", "application/x-ndjson"), ("Content-Length", str(len(body))),
                                 ("X-Next-Offset", str(nxt)), ("X-From-Offset", str(start)),
                                 ("Cache-Control", "no-store"), ("Access-Control-Allow-Origin", "*"),
                                 ("Access-Control-Expose-Headers", "X-Next-Offset, X-From-Offset")):
                        self.send_header(k, v)
                    self.end_headers()
                    self.wfile.write(body)
                    return
                if u.path.endswith("/file"):
                    fp = svc.file_path(p)
                    if not fp:
                        return self._send(404, {"error": "no file"})
                    ct = mimetypes.guess_type(fp.name)[0] or "application/octet-stream"
                    data = fp.read_bytes()
                    self.send_response(200)
                    for k, v in (("Content-Type", ct), ("Content-Length", str(len(data))),
                                 ("Cache-Control", "public, max-age=31536000, immutable"), ("Access-Control-Allow-Origin", "*")):
                        self.send_header(k, v)
                    self.end_headers()
                    self.wfile.write(data)
                    return
                if u.path.endswith("/scoreboard/stream"):
                    return self._stream_scoreboard()
                if u.path.endswith("/scoreboard"):
                    f = STORE / "scoreboard.json"
                    if not f.exists():
                        return self._send(404, {"error": "no scoreboard built yet"})
                    body = f.read_bytes()
                    self.send_response(200)
                    for k, v in (("Content-Type", "application/json"), ("Content-Length", str(len(body))),
                                 ("Cache-Control", "no-store"), ("Access-Control-Allow-Origin", "*")):
                        self.send_header(k, v)
                    self.end_headers()
                    self.wfile.write(body)
                    return
                if u.path.endswith("/needs-human"):
                    return self._send(200, svc.needs_human(), "public, max-age=60")
                if u.path.endswith("/search"):
                    return self._send(200, svc.search(p), "public, max-age=30")
                if u.path.endswith("/doc"):
                    d = svc.doc(p)
                    return self._send(200 if d else 404, d or {"error": "not found"}, "public, max-age=300")
                self._send(404, {"error": "no such route"})
            except (ValueError, KeyError):
                self._send(400, {"error": "bad parameter"})
            except sqlite3.Error:
                self._send(500, {"error": "query failed"})

    return H


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8830)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--db", type=Path, default=DB_PATH)
    a = ap.parse_args()
    print(f"county query service on {a.host}:{a.port} db={a.db}", flush=True)
    ThreadingHTTPServer((a.host, a.port), make_handler(Svc(a.db))).serve_forever()
