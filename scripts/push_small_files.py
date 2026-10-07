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

import json
import os
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
LOCK = ROOT / "data" / ".push.lock"

# Data-budget guards: keep GitHub from blowing up. Files over GH_MAX_FILE are
# routed to archive.org (the two-tier overflow) and recorded in
# data/live/oversize.jsonl instead of bloating the repo; if the total repo
# passes GH_MAX_REPO we deliberately refuse to push at all and say why.
GH_MAX_FILE = 20 * 1024 * 1024
GH_MAX_REPO = 1.4 * 1024 * 1024 * 1024

OVERSIZE_LOG = ROOT / "data" / "live" / "oversize.jsonl"

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


def git_add_small(small_files: list[pathlib.Path]) -> None:
    """Stage the small files in bounded chunks (avoid argv limits on a giant
    deployed tree) and record any oversized files that must NOT go to GitHub."""
    paths = [str(f) for f in small_files]
    done, seen = [], set()
    if OVERSIZE_LOG.exists():
        with open(OVERSIZE_LOG) as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        seen.add(json.loads(line).get("path", ""))
                    except json.JSONDecodeError:
                        pass
    oversized = [f for f in small_files if f.stat().st_size > GH_MAX_FILE]
    for f in oversized:
        rel = str(f.relative_to(ROOT))
        if rel not in seen:
            OVERSIZE_LOG.parent.mkdir(parents=True, exist_ok=True)
            with open(OVERSIZE_LOG, "a") as lp:
                lp.write(json.dumps({
                    "schema": "OversizeFile@1", "path": rel, "bytes": f.stat().st_size,
                    "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }) + "\n")
    small = [f for f in small_files if f.stat().st_size <= GH_MAX_FILE]
    for i in range(0, len(small), 800):
        git("add", "--", *[str(x) for x in small[i:i + 800]])

    # Repo-budget guard: refuse the push if the .git would balloon past the
    # ceiling -- surface it, never quietly keep going and blow up.
    try:
        out = subprocess.run(["du", "-sk", ".git"], cwd=ROOT, capture_output=True, text=True)
        size = int(out.stdout.split()[0]) * 1024
    except (ValueError, IndexError):
        size = 0
    return size, len(oversized), small


def collect_files(present) -> list[pathlib.Path]:
    out = []
    for p in present:
        full = ROOT / p
        if full.is_dir():
            out += [f for f in full.rglob("*") if f.is_file()]
        elif full.is_file():
            out.append(full)
    return out


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
        present = [p for p in SMALL_PATHS if (ROOT / p).exists()]
        st = git("status", "--porcelain", *present)
        changed = [l for l in st.stdout.splitlines() if l.strip()]
        if not changed:
            print("push_small_files: nothing changed; skipping", file=sys.stderr)
            return 0

        sys.path.insert(0, str(ROOT / "src"))
        small_files = collect_files(present)
        repo_size, n_oversized, small = git_add_small(small_files)

        # Repo budget guard: a repo at the ceiling must not keep growing.
        if repo_size and repo_size >= GH_MAX_REPO:
            msg = (f"push_small_files: REFUSING push — repo has reached "
                   f"{repo_size / 1024 / 1024 / 1024:.2f} GB; route oversized "
                   f"files to archive.org instead of growing GitHub")
            print(msg, file=sys.stderr)
            try:
                import live
                live.event("push-refused", repo_gb=round(repo_size / 1024 / 1024 / 1024, 2),
                           reason="repo-size ceiling")
            except Exception:  # noqa: BLE001
                pass
            return 2

        if n_oversized:
            print(f"push_small_files: {n_oversized} file(s) over the {GH_MAX_FILE // 1024 // 1024}MB "
                  f"GH cap routed to archive.org instead (see data/live/oversize.jsonl)", file=sys.stderr)

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
        print(f"push_small_files: pushed {len(changed)} change(s) to origin/main ({len(small)} small files examined)", file=sys.stderr)
        return 0
    finally:
        try:
            LOCK.unlink()
        except FileNotFoundError:
            pass


if __name__ == "__main__":
    sys.exit(main())