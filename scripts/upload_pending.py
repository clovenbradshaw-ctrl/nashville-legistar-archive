"""Phase 2: drain whatever scripts/fetch_epav_local.py has cached locally
into archive.org, a bounded batch at a time. Meant to be invoked repeatedly
-- by cron, at whatever interval keeps archive.org's real throughput happy
-- until the pending queue is empty. Idempotent: already_archived() skips
anything already in data/epav-manifest.jsonl, so overlapping or repeated
invocations never double-upload.

Usage (also see cron/upload_pending.cron for the actual schedule):
  ARCHIVE_ORG_ACCESS_KEY=... ARCHIVE_ORG_SECRET_KEY=... \\
    python scripts/upload_pending.py [--limit 50] [--delay 1.0]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import epav_pipeline
import fold_pipeline
from fold_pipeline import load_env_file

ROOT = Path(__file__).resolve().parent.parent
EPAV_MANIFEST = ROOT / "data" / "epav-manifest.jsonl"
COMPANIES = ROOT / "data" / "companies.json"
LINT_LOG = ROOT / "data" / "lint-log.jsonl"
CORROBORATED = ROOT / "data" / "corroborated-notes.jsonl"
CORROBORATE_MJS = ROOT / "src" / "corroborate.mjs"
CORROBORATE_BUDGET = 30


def already_archived(token: str) -> bool:
    if not EPAV_MANIFEST.exists():
        return False
    with EPAV_MANIFEST.open() as fh:
        for line in fh:
            if f'"epav_token": "{token}"' in line:
                return True
    return False


def read_pending() -> list[dict]:
    if not epav_pipeline.EPAV_FETCHED.exists():
        return []
    out = []
    with epav_pipeline.EPAV_FETCHED.open() as fh:
        for line in fh:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50, help="max documents to upload this invocation (cron-safe bound)")
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between archive.org requests -- higher than the fetch phase's, since this is the rate-limited side")
    args = ap.parse_args()

    import os
    load_env_file(ROOT / ".env")
    access_key = os.environ.get("ARCHIVE_ORG_ACCESS_KEY")
    secret_key = os.environ.get("ARCHIVE_ORG_SECRET_KEY")
    if not access_key or not secret_key:
        sys.exit("Set ARCHIVE_ORG_ACCESS_KEY and ARCHIVE_ORG_SECRET_KEY (env or .env)")

    pending = [f for f in read_pending() if not already_archived(f["epav_token"])]
    print(f"{len(pending)} document(s) pending upload (capped at --limit {args.limit} this run)", file=sys.stderr)

    done = 0
    with EPAV_MANIFEST.open("a") as out:
        for fetched in pending[: args.limit]:
            pdf = epav_pipeline.resolve_local(fetched, "local_pdf")
            if pdf is None or not pdf.is_file():
                # The durable-home invariant is being violated; keep the row
                # in the queue so the QC durable_home check surfaces it --
                # do not spam-retry an upload that has no bytes to send.
                print(f"  {fetched['epav_token']} local pdf missing on this machine — left in queue for QC (durable_home)", file=sys.stderr)
                continue
            try:
                record = epav_pipeline.upload_now(fetched, access_key, secret_key, args.delay)
            except Exception as e:  # noqa: BLE001 - log and keep going; stays pending for next invocation
                print(f"  {fetched['epav_token']} UPLOAD FAILED (will retry next run): {e}", file=sys.stderr)
                continue
            out.write(json.dumps(record) + "\n")
            out.flush()
            done += 1
            print(f"  uploaded {record['contract_number']} ({record['epav_token']}) — {record['department']}", file=sys.stderr)
            # Deletion invariant: the durable home (archive.org) is on the
            # manifest record ABOVE; only now drop the large local copy.
            try:
                import routing
                pdf = epav_pipeline.resolve_local(fetched, "local_pdf")
                if pdf is not None:
                    dropped = routing.delete_large_after_upload(pdf.parent)
                    if dropped:
                        print(f"  dropped local PDF for {record['epav_token']}", file=sys.stderr)
            except Exception as e:  # noqa: BLE001 - manifest already written; stays durable
                print(f"  delete_large_after_upload FAILED: {e}", file=sys.stderr)

    if done:
        fold_pipeline.fold_and_lint_now(
            assertions_path=ROOT / "data" / "assertions.jsonl", companies_path=COMPANIES, lint_log_path=LINT_LOG,
            eowork_dir=ROOT / "data" / ".eowork", corroborate_mjs=CORROBORATE_MJS, corroborated_path=CORROBORATED,
            corroborate_budget=CORROBORATE_BUDGET,
        )
        # Small files go to GitHub: promote already happened at fetch time, so
        # this only stages + commits the deltas (deployed/, manifests, ledgers).
        try:
            import push_small_files
            push_small_files.main(["run"])
        except Exception as e:  # noqa: BLE001 - never block the upload drain
            print(f"  push_small_files FAILED (retry on next schedule): {e}", file=sys.stderr)
    print(f"done: {done}/{len(pending[: args.limit])} uploaded this run, {len(pending) - done} still pending", file=sys.stderr)


if __name__ == "__main__":
    main()
