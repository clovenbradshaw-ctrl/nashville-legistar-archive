#!/usr/bin/env python3
"""Watch where each county's legislation lives online, so a change shows up as it happens.

For every county's legislation sources (the registry's `legislation` seeds, workbook and
researcher-found alike) this re-reads the listing page on a loop and records what documents it
links. It downloads no documents (that is county_pull.py's job) and stores one small snapshot:

    <STORE>/<slug>/watch.json      latest snapshot per page: links, status, when it last changed
    <STORE>/<slug>/watch.jsonl     one line per CHANGE (new or removed links), with the time

Polite by construction: robots.txt honoured, one request per host per --delay seconds, one GET per
page per cycle, identifying User-Agent. A page that answers with a bot check (202/401/403/429) is
recorded as `needs_human` and left alone; it is never worked around.

A change is also written to the county's operator log as a DEF of the page's link count, so the
fold (and the scoreboard) sees it with the same machinery as everything else.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urljoin, urldefrag

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import counties as C
import county_pull as P
import eo_log

STORE = P.STORE


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def read_snapshot(slug: str) -> dict:
    f = STORE / slug / "watch.json"
    try:
        return json.loads(f.read_text())
    except (OSError, ValueError):
        return {"pages": {}}


def fetch_links(pull: P.Pull, url: str) -> dict:
    """One GET of a listing page. Returns {status, links:[...], error?}. Never downloads documents."""
    h = P.host(url)
    if any(h.endswith(b) for b in P.POINTER_HOSTS + P.TERMS_HOSTS):
        return {"status": "pointer_only", "links": []}
    if any(h.endswith(b) for b in P.BROWSER_HOSTS):
        return {"status": "needs_browser", "links": []}
    try:
        if not pull.allowed(url):
            return {"status": "robots_disallowed", "links": []}
        r = pull.get(url)
    except Exception as e:                                  # network trouble is a status, not a crash
        return {"status": f"error:{type(e).__name__}", "links": []}
    if r.status_code in (202, 401, 403, 429):
        return {"status": f"needs_human:http_{r.status_code}", "links": []}
    if r.status_code != 200:
        return {"status": f"http_{r.status_code}", "links": []}
    if "html" not in r.headers.get("content-type", ""):
        return {"status": "not_html", "links": []}
    lp = P.Links()
    lp.feed(r.text)
    out, seen = [], set()
    for a in lp.out:
        href = urldefrag(urljoin(r.url, a["href"]))[0]
        if href.startswith("http") and P.is_doc(href) and href not in seen:
            seen.add(href)
            out.append(href)
    return {"status": "ok", "links": out}


def watch_county(reg: dict, pull: P.Pull) -> dict:
    slug = reg["slug"]
    snap = read_snapshot(slug)
    pages = snap.setdefault("pages", {})
    urls = [s["url"] for s in reg["seeds"] if s["kind"] in ("legislation", "site")]
    changes = []
    for url in urls:
        res = fetch_links(pull, url)
        prev = pages.get(url)
        cur = {"checked_at": now(), "status": res["status"], "n_links": len(res["links"]),
               "fingerprint": hashlib.sha256("\n".join(sorted(res["links"])).encode()).hexdigest()[:16],
               "first_checked_at": (prev or {}).get("first_checked_at", now()),
               "last_change_at": (prev or {}).get("last_change_at"),
               "added_total": (prev or {}).get("added_total", 0),
               "links": res["links"][:400]}
        if res["status"] == "ok":
            before = set((prev or {}).get("links", []))
            added = [l for l in res["links"] if l not in before]
            removed = [l for l in before if l not in set(res["links"])]
            if prev is None:
                # first sight is a baseline, not a change: nothing "appeared"
                cur["last_change_at"] = None
            elif added or removed:
                cur["last_change_at"] = now()
                cur["added_total"] += len(added)
                changes.append({"ts": now(), "county": reg["county"], "fips": reg["fips"], "url": url,
                                "n_links": len(res["links"]), "added": added[:25], "n_added": len(added), "n_removed": len(removed)})
                eo_log.emit(slug, "DEF", "Figure", anchor=eo_log.county_anchor(reg["fips"]),
                            path=f"legislation.links[{url}]", value=len(res["links"]), added=len(added), removed=len(removed))
        elif prev and prev.get("links"):
            cur["links"] = prev["links"]                    # keep the last good view when a check fails
            cur["n_links"] = prev.get("n_links", 0)
            cur["fingerprint"] = prev.get("fingerprint")
        pages[url] = cur
    snap["slug"], snap["fips"], snap["county"] = slug, reg["fips"], reg["county"]
    (STORE / slug).mkdir(parents=True, exist_ok=True)
    (STORE / slug / "watch.json").write_text(json.dumps(snap, separators=(",", ":")))
    if changes:
        with (STORE / slug / "watch.jsonl").open("a") as f:
            for c in changes:
                f.write(json.dumps(c, separators=(",", ":")) + "\n")
    return {"county": reg["county"], "pages": len(urls), "changes": len(changes)}


def cycle(delay: float, workers: int, only: list[str] | None, log) -> None:
    regs = [r for r in C.load() if not r["legacy"] and (not only or r["slug"] in only)]
    t0 = time.time()

    def one(reg):
        return watch_county(reg, P.Pull(delay, 0, 0, lambda m: None))
    with ThreadPoolExecutor(workers) as ex:
        res = list(ex.map(one, regs))
    ch = sum(r["changes"] for r in res)
    log(f"{now()} watched {len(res)} counties, {sum(r['pages'] for r in res)} pages, {ch} change(s), {time.time() - t0:.0f}s")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--county", action="append")
    ap.add_argument("--delay", type=float, default=3.0)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--loop", type=int, default=0, help="seconds between cycles; 0 = run once")
    a = ap.parse_args()
    log = lambda m: print(m, flush=True)
    while True:
        cycle(a.delay, a.workers, a.county, log)
        if not a.loop:
            break
        time.sleep(a.loop)


if __name__ == "__main__":
    main()
