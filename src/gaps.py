"""The gaps ledger -- every enumeration gap, discovered never guessed.

A gap is any place the acquisition could not exhaust a shard of the search
space: a department whose plain search returned the site's 1000-row cap, or an
exhaustive-recursion bucket that was still at the cap after every axis, or a
token we saw indexed but could not fetch. A gap line is append-only and carries
its falsifying control (the condition that would prove it was not a real gap).
The completeness audit (falsify.py) reads this ledger as its EVA input and
refuses to report a complete archive while any gap stands.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import live

ROOT = Path(__file__).resolve().parent.parent
GAPS = ROOT / "data" / "gaps.jsonl"


def record_gap(*, kind: str, subject: str, detail: str | None = None, falsifying: str, **extra) -> dict:
    """Append one gap with its falsifying control. A gap that names no
    falsifying control is REFUSED and does not land -- same wall as
    content-rules.mjs: 'a preservation that names no falsifier is refused'."""
    if not falsifying:
        raise ValueError("a gap must name a falsifying control or it is not a gap")
    line = {
        "schema": "EnumerationGap@1",
        "kind": kind,
        "subject": subject,
        "detail": detail,
        "falsifying": falsifying,
        "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **extra,
    }
    GAPS.parent.mkdir(parents=True, exist_ok=True)
    with GAPS.open("a") as f:
        f.write(json.dumps(line) + "\n")
    try:
        live.event("gap", kind=kind, subject=subject, detail=detail)
    except Exception:  # noqa: BLE001 - the gap is recorded regardless
        pass
    return line


def read_gaps() -> list[dict]:
    if not GAPS.exists():
        return []
    out = []
    with GAPS.open() as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out