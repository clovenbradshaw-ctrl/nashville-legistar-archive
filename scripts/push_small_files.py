"""Publish the small files to GitHub: stage + commit + push the committed
data tree (data/deployed/, the manifests, the ledgers, the falsification and
learning records) to origin.

Runs as a script (``python scripts/push_small_files.py``) and is also
importable so the upload drain can call it at the end of a batch. The big
files never pass through here -- those went to archive.org separately.

Guards:
- a lock dir, so overlapping schedulers cannot double-push;
- nothing committed when there is nothing to commit;
- secrets stay out (the repo's own .gitignore already excludes .env);
- a failed push leaves everything staged/committed locally and is retried
  on the next invocation -- the working tree is never lost."""
from __future__ import annotations

import os
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
LOCK = ROOT / "data" / ".push.lock"

# Which committed paths this repo treats as "small files to publish". The
# big files (PDFs) never live under these paths.
SMALL_PATHS = [
    "data/deployed",
    # the reproduction of the fetch queue is excluded: it is regenerable
    # working state, not a durable record, and carries machine cache paths
    "data/epav-manifest.jsonl",
    "data/contract-ledger.jsonl",
    "data/assertions.jsonl",
    "data/companies.json",
    "data/lint-log.jsonl",
    "data/surveillance-flags.jsonl",
    "data/referents.jsonl",
    "data/page-sightings.jsonl",
    "data/corroborated-notes.jsonl",
    "data/manifest.jsonl",
    "data/gaps.jsonl",
    "data/verdicts.jsonl",
    "data/live/summary.json",
    "data/live/recent.jsonl",
    "data/live/roundups.jsonl",
    "data/learning",
    "data/legislation",
]


def git(*args: str, cwd: pathlib.Path = ROOT) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)


def main(argv=None) -> int:
    argv = list(argv if argv is not None else sys.argv[1:])
    if argv and argv[0] == "run":
        argv = argv[1:]

    if LOCK.exists():
        print("push_small_files: lock held by another run; skipping", file=sys.stderr)
        return 0
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    LOCK.touch()
    try:
        # git add aborts on a pathspec that does not exist, so only ever
        # stage paths present on this machine -- a path that is not there
        # yet (e.g. data/legislation before its first poll) is simply not
        # part of this round.
        present = [p for p in SMALL_PATHS if (ROOT / p).exists()]
        st = git("status", "--porcelain", *present)
        changed = [l for l in st.stdout.splitlines() if l.strip()]
        if not changed:
            print("push_small_files: nothing changed; skipping", file=sys.stderr)
            return 0

        git("add", *present)
        msg = f"pipeline: publish {len(changed)} small-file change(s) — {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}"
        c = git("commit", "-m", msg)
        if c.returncode != 0:
            combined = (c.stdout + c.stderr).strip()
            if "nothing to commit" not in combined:
                print(f"push_small_files: commit failed: {combined[-500:]}", file=sys.stderr)
                return 1

        p = git("push", "origin", "main")
        if p.returncode != 0:
            print(f"push_small_files: push failed (staged locally, retry next run): {(p.stdout + p.stderr)[-500:]}", file=sys.stderr)
            return 1
        print(f"push_small_files: pushed {len(changed)} change(s) to origin/main", file=sys.stderr)
        return 0
    finally:
        try:
            LOCK.unlink()
        except FileNotFoundError:
            pass


if __name__ == "__main__":
    sys.exit(main())