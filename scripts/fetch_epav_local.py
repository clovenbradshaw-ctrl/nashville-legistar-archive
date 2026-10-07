"""Phase 1: fetch and process every ePAV contract locally -- no archive.org
calls at all. Bottlenecked only by documents.nashville.gov, which has been
reliable all session (unlike archive.org's ~65% sustained 503 rate under
load). Run this to completion, then let scripts/upload_pending.py (on a
schedule) drain the resulting queue into archive.org at whatever pace it
actually sustains.

Parallelism: --workers N fetches/normalizes/reads N documents concurrently
(the per-document eoreader7 read dominates runtime, so a single serial loop
was crawling at ~1 contract/minute). Dedup is an in-memory token set loaded
once -- the old per-row file scan was O(queue) on every row. A heartbeat
line keeps the live feed moving even during a long capped-department enum.

Usage:
  python scripts/fetch_epav_local.py --workers 4 --departments "ART" --exhaustive
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from epav_client import EPAV, DEPARTMENTS
from legistar_client import Legistar
import boilerplate
import epav_pipeline
import live

ROOT = Path(__file__).resolve().parent.parent
PAGE_SIGHTINGS = ROOT / "data" / "page-sightings.jsonl"
REFERENTS = ROOT / "data" / "referents.jsonl"


def existing_tokens() -> set[str]:
    p = epav_pipeline.EPAV_FETCHED
    if not p.exists():
        return set()
    out: set[str] = set()
    with open(p) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    out.add(json.loads(line).get("epav_token") or "")
                except json.JSONDecodeError:
                    pass
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="stop after this many NEWLY fetched documents")
    ap.add_argument("--departments", default=None, help="comma-separated subset of DEPARTMENTS (default: all)")
    ap.add_argument("--delay", type=float, default=0.4, help="seconds between ePAV/Legistar requests per worker")
    ap.add_argument("--exhaustive", action="store_true", help="measure past the site's 1000-row-per-search cap")
    ap.add_argument("--workers", type=int, default=4, help="concurrent document workers (default 4)")
    ap.add_argument("--fast", action="store_true",
                    help="skip the slow eoreader7 read during acquire (scripts/read_backfill.py drains reads later)")
    args = ap.parse_args()

    epav_pipeline.LOCAL_CACHE.mkdir(parents=True, exist_ok=True)
    api = EPAV(delay=args.delay)
    legistar_api = Legistar("nashville")
    departments = [d.strip() for d in args.departments.split(",")] if args.departments else DEPARTMENTS
    page_index = boilerplate.load_index(PAGE_SIGHTINGS)
    seen = existing_tokens()
    lock = threading.Lock()

    def iter_rows():
        if args.exhaustive:
            local_seen: set[str] = set()
            for dept in departments:
                for row in api.iter_department_exhaustive(dept):
                    if row["token"] in local_seen:
                        continue
                    local_seen.add(row["token"])
                    row.setdefault("source_department_query", dept)
                    yield row
        else:
            yield from api.iter_all(departments=departments)

    def process(row: dict):
        tok = row.get("token")
        if not tok:
            return None
        with lock:
            if tok in seen:
                return None
            seen.add(tok)  # claim it so sibling workers don't double-fetch
        try:
            fetched = epav_pipeline.fetch_local(api, row, legistar_api, page_index, referents_out=referents_out,
                                                deep_reads=not args.fast)
        except Exception as e:  # noqa: BLE001 - log and keep going
            with lock:
                seen.discard(tok)  # leave it claim-free so the next run retries
            live.event("fetch-failed", epav_token=tok, department=row.get("department"), error=str(e)[:200])
            print(f"  document {tok} FETCH FAILED: {e}", file=sys.stderr)
            return None
        tag = "destroyed-stub" if fetched.get("destroyed_per_retention_schedule") else "fetched"
        live.event(tag, epav_token=fetched["epav_token"], contract_number=fetched["contract_number"],
                   department=fetched["department"])
        print(f"  {tag} {fetched['contract_number']} ({fetched['epav_token']}) — {fetched['department']}", file=sys.stderr)
        return fetched

    done = submitted = 0
    last_beat = time.time()
    with REFERENTS.open("a") as referents_out, ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        it = iter_rows()
        while True:
            if args.limit and submitted >= args.limit:
                break
            try:
                row = next(it)
            except StopIteration:
                break
            submitted += 1
            futures = [pool.submit(process, row)]
            while len(futures) < max(1, args.workers) * 2:
                try:
                    futures.append(pool.submit(process, next(it)))
                except StopIteration:
                    break
            for fu in futures:
                if fu.result() is not None:
                    done += 1
            if time.time() - last_beat >= 60:
                last_beat = time.time()
                live.event("heartbeat", scanned=submitted, newly_fetched=done,
                           staged=len(seen), note="fetch workers active")

    print(f"done: {done} new document(s) fetched locally (of {submitted} scanned) -> {epav_pipeline.EPAV_FETCHED}", file=sys.stderr)
    # push the small files (deployed/ + ledgers) to GitHub regardless of
    # archive.org health -- the two storages are independent legs
    try:
        import push_small_files
        push_small_files.main(["run"])
    except Exception as e:  # noqa: BLE001 - a fetch is never blocked by a push
        print(f"  push_small_files FAILED (retry on next run): {e}", file=sys.stderr)


if __name__ == "__main__":
    main()