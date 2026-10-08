"""Bound the pipeline's live/operational logs so nothing grows without limit
on the VM.

- data/live/events.jsonl  -> last 4000 lines (the transient live feed window)
- data/live/roundups.jsonl -> last 1000 lines (each 24h period = one line)
- docs/holodeck.http.log  -> last 2000 lines (the static-preview access log)

The durable records never shrink: summary.json and recent.jsonl are written
wholesale by roundup.py (bounded by construction), the manifests/ledgers/deployed
tree are append-only by design, and page-sightings/assertions are the corpus
record, not the operational log.

Truncation is atomic (write tail to a temp file, os.replace) so a writer never
sees a half-file, and the SSE server (scripts/live_stream.py) detects the new
inode and reopens instead of streaming into a dead one.
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

JOBS = [
    ("data/live/events.jsonl", 4000),
    ("data/live/roundups.jsonl", 1000),
    ("data/live/series.jsonl", 3000),
    ("data/live/oversize.jsonl", 2000),
    ("data/missing.jsonl", 20000),
    ("data/oversight/actions.jsonl", 5000),
    ("docs/holodeck.http.log", 2000),
]


def tail_lines(p: Path, n: int) -> list[bytes]:
    with open(p, "rb") as f:
        lines = f.read().splitlines()
    return lines[-n:]


def cap(p: Path, n: int) -> bool:
    if not p.exists():
        return False
    cur = sum(1 for _ in open(p, "rb"))
    if cur <= n:
        return False
    lines = tail_lines(p, n)
    tmp = p.with_name(p.name + ".trim")
    tmp.write_bytes(b"\n".join(lines) + (b"\n" if lines else b""))
    os.replace(tmp, p)
    return True


def main() -> None:
    trimmed = []
    for rel, n in JOBS:
        if cap(ROOT / rel, n):
            trimmed.append(rel)
    print(f"trim: {' '.join(trimmed) if trimmed else 'nothing over cap'}")


if __name__ == "__main__":
    main()