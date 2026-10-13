#!/usr/bin/env python3
"""Where is each original on archive.org? A read-only lookup. Nothing is submitted.

For every document we hold a record for, this asks the Wayback Machine's CDX index for captures of
its exact URL and records what it found, so the pointer to the archived version sits beside the
pointer to the county's own copy:

    match        a capture whose payload digest equals the sha1 of OUR bytes (strong: same file)
    captured_unverified   a capture exists but our bytes are not held, so its digest cannot be compared
    other        captures exist but none match: the county's file differs from every archived one
    none         no capture of this URL
    error        the index did not answer

The Wayback digest is the base32 SHA-1 of the payload, so a `match` needs the bytes. For documents whose
bytes were dropped the best honest answer is `captured_unverified`: a pointer to an archived version,
not proof it is the same file (the index's length is the compressed record size and proves nothing).
Recorded as a DEF of path `archive` on the document, appended to the county's operator log.

Submission to archive.org (Save Page Now, or uploading items) is deliberately NOT here: it
publishes to a third party and is a separate decision.

Polite: one request per --delay seconds, identifying User-Agent, honours HTTP 429 with a pause.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sys
import time
from pathlib import Path
from urllib.parse import quote

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import counties as C
import county_pull as P
import eo_log

CDX = "https://web.archive.org/cdx/search/cdx"


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def sha1_b32(data: bytes) -> str:
    return base64.b32encode(hashlib.sha1(data).digest()).decode()


def cdx(session: requests.Session, url: str, limit: int = 50) -> list | None:
    """Captures of one exact URL, newest 50, as a list of dicts; None when the index could not answer.
    An empty list means the index answered 200 with nothing: only then may a caller say "not archived".
    The index is slow and sometimes 503s, so a failure is retried with a pause before it is reported."""
    params = {"url": url, "output": "json", "fl": "timestamp,statuscode,digest,length,mimetype",
              "filter": "statuscode:200", "limit": str(-limit)}
    for pause in (0, 10, 30):
        time.sleep(pause)
        try:
            r = session.get(CDX, params=params, timeout=90)
            if r.status_code == 200:
                rows = r.json() if r.text.strip() else []
                return [dict(zip(rows[0], x)) for x in rows[1:]] if rows else []
        except Exception:
            continue
    return None


def control(session: requests.Session) -> bool:
    """Positive control: a URL that is certainly archived must come back with captures. If the index
    cannot show that, an empty answer for a county file means nothing, so no lookup is recorded."""
    caps = cdx(session, "https://example.com/", limit=1)
    return bool(caps)


def lookup(session: requests.Session, url: str, data: bytes | None, recorded_bytes: int | None) -> dict:
    caps = cdx(session, url)
    if caps is None:
        return {"status": "error", "why": "index_unavailable", "checked_at": now()}
    if not caps:
        return {"status": "none", "checked_at": now(), "note": "index answered 200 with no captures; control passed this run"}
    want = sha1_b32(data) if data is not None else None
    for c in sorted(caps, key=lambda c: c["timestamp"], reverse=True):
        if want and c["digest"] == want:
            return {"status": "match", "evidence": "sha1", "timestamp": c["timestamp"], "digest": c["digest"],
                    "wayback_url": f"https://web.archive.org/web/{c['timestamp']}id_/{url}", "captures": len(caps), "checked_at": now()}
    if data is None:
        # We no longer hold the bytes, so the digest cannot be compared. A capture exists and is a pointer to
        # an archived version, but it is NOT verified to be the same file: labelled as exactly that.
        c = max(caps, key=lambda c: c["timestamp"])
        return {"status": "captured_unverified", "evidence": "none: bytes not held, digest not comparable",
                "timestamp": c["timestamp"], "digest": c["digest"],
                "wayback_url": f"https://web.archive.org/web/{c['timestamp']}id_/{url}", "captures": len(caps), "checked_at": now()}
    newest = max(caps, key=lambda c: c["timestamp"])
    return {"status": "other", "timestamp": newest["timestamp"], "digest": newest["digest"],
            "wayback_url": f"https://web.archive.org/web/{newest['timestamp']}/{quote(url, safe=':/?=&%')}",
            "captures": len(caps), "checked_at": now()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--county", action="append")
    ap.add_argument("--delay", type=float, default=2.0)
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    s = requests.Session()
    s.headers["User-Agent"] = P.UA
    if not control(s):
        sys.exit("archive.org's index could not show captures of a URL that is certainly archived; "
                 "recording 'none' now would be a guess. Try again later.")
    counts: dict[str, int] = {}
    n = 0
    for reg in C.load():
        if reg["legacy"] or (a.county and reg["slug"] not in a.county):
            continue
        m = P.STORE / reg["slug"] / "manifest.jsonl"
        if not m.exists():
            continue
        done = {ev.get("anchor") for ev in eo_log.events(reg["slug"])
                if ev.get("op") == "DEF" and (ev.get("content") or {}).get("path") == "archive"
                and ev["content"]["value"].get("status") != "error"}
        for line in m.open():
            try:
                row = json.loads(line)
            except ValueError:
                continue
            anchor = eo_log.doc_anchor(reg["fips"], row["url"])
            if anchor in done:
                continue
            data = None
            f = row.get("file")
            if f and (P.STORE / f).is_file():
                data = (P.STORE / f).read_bytes()
            res = lookup(s, row["url"], data, row.get("bytes"))
            eo_log.emit(reg["slug"], "DEF", "Figure", anchor=anchor, path="archive", value=res)
            counts[res["status"]] = counts.get(res["status"], 0) + 1
            n += 1
            time.sleep(max(a.delay, 3.0))
            if a.limit and n >= a.limit:
                break
        if a.limit and n >= a.limit:
            break
    print(f"looked up {n} documents on the Wayback index: {counts}")


if __name__ == "__main__":
    main()
