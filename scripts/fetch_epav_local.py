"""Phase 1: fetch and process every ePAV contract locally -- no archive.org
calls at all. Bottlenecked only by documents.nashville.gov, which has been
reliable all session (unlike archive.org's ~65% sustained 503 rate under
load). Run this to completion, then let scripts/upload_pending.py (on a
schedule) drain the resulting queue into archive.org at whatever pace it
actually sustains.

Usage:
  python scripts/fetch_epav_local.py --departments "ARTS COMMISSION" --exhaustive
"""

from __future__ import annotations

import argparse
import sys
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


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="stop after this many NEWLY fetched documents")
    ap.add_argument("--departments", default=None, help="comma-separated subset of DEPARTMENTS (default: all)")
    ap.add_argument("--delay", type=float, default=0.4, help="seconds between ePAV/Legistar requests")
    ap.add_argument("--exhaustive", action="store_true", help="measure past the site's 1000-row-per-search cap (see epav_client.iter_department_exhaustive)")
    args = ap.parse_args()

    epav_pipeline.LOCAL_CACHE.mkdir(parents=True, exist_ok=True)
    api = EPAV(delay=args.delay)
    legistar_api = Legistar("nashville")
    departments = [d.strip() for d in args.departments.split(",")] if args.departments else DEPARTMENTS
    page_index = boilerplate.load_index(PAGE_SIGHTINGS)

    def iter_rows():
        if args.exhaustive:
            seen: set[str] = set()
            for dept in departments:
                for row in api.iter_department_exhaustive(dept):
                    if row["token"] in seen:
                        continue
                    seen.add(row["token"])
                    row.setdefault("source_department_query", dept)
                    yield row
        else:
            yield from api.iter_all(departments=departments)

    done = 0
    with REFERENTS.open("a") as referents_out:
        for row in iter_rows():
            if epav_pipeline.already_fetched(row["token"]):
                continue
            try:
                fetched = epav_pipeline.fetch_local(api, row, legistar_api, page_index, referents_out=referents_out)
            except Exception as e:  # noqa: BLE001 - log and keep going
                print(f"  document {row['token']} FETCH FAILED: {e}", file=sys.stderr)
                live.event("fetch-failed", epav_token=row.get("token"), department=row.get("department"), error=str(e)[:200])
                continue
            done += 1
            tag = "destroyed-stub" if fetched.get("destroyed_per_retention_schedule") else "fetched"
            live.event(tag, epav_token=fetched["epav_token"], contract_number=fetched["contract_number"],
                       department=fetched["department"])
            print(f"  {tag} {fetched['contract_number']} ({fetched['epav_token']}) — {fetched['department']}", file=sys.stderr)
            if args.limit and done >= args.limit:
                break

    print(f"done: {done} new document(s) fetched locally -> {epav_pipeline.EPAV_FETCHED}", file=sys.stderr)
    # push the small files (deployed/ + ledgers) to GitHub regardless of
    # archive.org health -- the two storages are independent legs
    try:
        import push_small_files
        push_small_files.main(["run"])
    except Exception as e:  # noqa: BLE001 - a fetch is never blocked by a push
        print(f"  push_small_files FAILED (retry on next run): {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
