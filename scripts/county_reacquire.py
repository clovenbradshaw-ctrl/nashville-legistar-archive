#!/usr/bin/env python3
"""Verify the online original a stored record points to, without re-downloading it.

The original is the county's file at its URL, so a record whose bytes we dropped still has its
original: it is the pointer. This confirms that the pointer still resolves and still looks like
what we recorded, and writes down what the county said about it today:

    HEAD <url>  ->  status, Content-Length, Last-Modified, ETag, Content-Type, final URL, redirects

Each result is appended to the county's operator log as a DEF of path `verification` on the
document, so a history builds up and nothing earlier is overwritten. Comparison to what we hold:

    unchanged   Content-Length equals the recorded bytes (and Last-Modified predates our fetch)
    changed     the length differs, or Last-Modified is after our fetch: the county replaced the file
    gone        404/410: the pointer no longer resolves (the archive.org capture, if any, is then the original)
    unknown     the server gave no length or refused HEAD (re-run with --full to download and hash)

--full downloads the file and compares sha256 (strong evidence). It never writes the bytes back
unless --keep is given, and it never overwrites an earlier record.

Polite: robots.txt honoured, one request per host per --delay seconds, identifying User-Agent.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import counties as C
import county_pull as P
import eo_log

KEEP_HEADERS = ("ETag", "Last-Modified", "Date", "Content-Length", "Content-Type", "Content-Disposition", "Server")


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def verdict(row: dict, status: int, headers: dict) -> str:
    if status in (404, 410):
        return "gone"
    if status != 200:
        return "unknown"
    cl = headers.get("Content-Length")
    if cl is None or not str(cl).isdigit():
        return "unknown"
    if row.get("bytes") is not None and int(cl) != int(row["bytes"]):
        return "changed"
    lm, fa = headers.get("Last-Modified"), row.get("fetched_at")
    if lm and fa:
        try:
            lm_t = time.mktime(time.strptime(lm, "%a, %d %b %Y %H:%M:%S GMT"))
            fa_t = time.mktime(time.strptime(fa, "%Y-%m-%dT%H:%M:%SZ"))
            if lm_t > fa_t:
                return "changed"
        except ValueError:
            pass
    return "unchanged"


def verify_one(pull: P.Pull, reg: dict, row: dict, full: bool) -> dict | None:
    url = row["url"]
    if not pull.allowed(url):
        return {"checked_at": now(), "url": url, "result": "robots_disallowed"}
    try:
        pull.wait(P.host(url))
        r = pull.s.request("HEAD", url, timeout=45, allow_redirects=True)
        if r.status_code in (405, 501):               # HEAD refused: a ranged GET asks for one byte
            r = pull.s.get(url, headers={"Range": "bytes=0-0"}, timeout=45, stream=True, allow_redirects=True)
            r.close()
    except Exception as e:
        return {"checked_at": now(), "url": url, "result": f"error:{type(e).__name__}"}
    headers = {k: r.headers.get(k) for k in KEEP_HEADERS if r.headers.get(k)}
    if "Content-Range" in r.headers and r.status_code == 206:        # the length of the whole file
        headers["Content-Length"] = r.headers["Content-Range"].rsplit("/", 1)[-1]
        r_status = 200
    else:
        r_status = r.status_code
    rec = {"checked_at": now(), "url": url, "final_url": r.url, "status": r_status,
           "redirects": [{"status": h.status_code, "url": h.url} for h in r.history], "headers": headers,
           "recorded_bytes": row.get("bytes"), "recorded_sha256": row.get("sha256"), "method": "HEAD"}
    rec["result"] = verdict(row, r_status, headers)
    if full and r_status == 200:
        try:
            pull.wait(P.host(url))
            g = pull.s.get(url, timeout=120)
            sha = hashlib.sha256(g.content).hexdigest()
            rec.update({"method": "GET+sha256", "observed_sha256": sha, "observed_bytes": len(g.content),
                        "result": "unchanged" if sha == row.get("sha256") else "changed"})
        except Exception as e:
            rec["full_error"] = type(e).__name__
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--county", action="append")
    ap.add_argument("--delay", type=float, default=3.0)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--full", action="store_true", help="download and compare sha256 (strong evidence, large)")
    ap.add_argument("--only-dropped", action="store_true", default=True)
    a = ap.parse_args()
    pull = P.Pull(a.delay, 0, 0, lambda m: None)
    counts: dict[str, int] = {}
    n = 0
    for reg in C.load():
        if reg["legacy"] or (a.county and reg["slug"] not in a.county):
            continue
        m = P.STORE / reg["slug"] / "manifest.jsonl"
        if not m.exists():
            continue
        done = set()
        for ev in eo_log.events(reg["slug"]):
            if ev.get("op") == "DEF" and (ev.get("content") or {}).get("path") == "verification":
                done.add(ev.get("anchor"))
        dropped = {}
        for ev in eo_log.events(reg["slug"]):
            if ev.get("op") == "DEF" and (ev.get("content") or {}).get("path") == "digest" and ev["content"]["value"].get("original_dropped"):
                dropped[ev["anchor"]] = True
        for line in m.open():
            try:
                row = json.loads(line)
            except ValueError:
                continue
            anchor = eo_log.doc_anchor(reg["fips"], row["url"])
            if anchor in done or (a.only_dropped and anchor not in dropped and row.get("file")):
                continue
            rec = verify_one(pull, reg, row, a.full)
            if rec is None:
                continue
            eo_log.emit(reg["slug"], "DEF", "Figure", anchor=anchor, path="verification", value=rec)
            counts[rec["result"]] = counts.get(rec["result"], 0) + 1
            n += 1
            if a.limit and n >= a.limit:
                break
        if a.limit and n >= a.limit:
            break
    print(f"verified {n} originals against the county: {counts}")


if __name__ == "__main__":
    main()
