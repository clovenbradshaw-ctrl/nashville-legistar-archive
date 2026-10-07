"""Live event emitter for the Metro contract pipeline.

Every stage appends a LiveEvent@1 line to data/live/events.jsonl as it works
(fetched, destroyed-stub, gap, uploaded, dropped-local-pdf, qc verdict,
falsify verdict, legislation change, failures). The append-only JSONL is the
durable feed record (it rides the small-file store to GitHub) and the SSE
server scripts/live_stream.py tails it for the realtime feed -- the same
shape as the eviction tracker's live scraper stream.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVENTS = ROOT / "data" / "live" / "events.jsonl"
ROUNDUPS = ROOT / "data" / "live" / "roundups.jsonl"


def event(kind: str, **data) -> dict:
    line = {
        "schema": "LiveEvent@1",
        "kind": kind,
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **data,
    }
    EVENTS.parent.mkdir(parents=True, exist_ok=True)
    with EVENTS.open("a") as f:
        f.write(json.dumps(line) + "\n")
    return line


def roundup(*, hours: int = 24, since: str | None = None) -> dict:
    """Write one Roundup@1 to the append-only roundup ledger and emit it as a
    live event so the stream turns into a status report: contracts acquired /
    uploaded in the window, split by department and vendor, bucketed by day.
    Returns the line written."""
    import summarize

    st = summarize.period_summary(f"{hours}h", hours)
    line = {
        "schema": "Roundup@1",
        "kind": "roundup",
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "range_hours": hours,
        "since": since,
        **st,
    }
    ROUNDUPS.parent.mkdir(parents=True, exist_ok=True)
    with ROUNDUPS.open("a") as f:
        f.write(json.dumps(line) + "\n")
    event("roundup", **{k: v for k, v in line.items() if k not in ("schema",)})
    return line