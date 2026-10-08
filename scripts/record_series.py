"""Append one time-series point to the metrics series.

Takes the current state_summary() counts and appends a cumulative point
{pulled, staged, pending, uploaded, deployed, read_done, fully_processed} to
data/live/series.jsonl -- the over-time data the dashboard chart draws from.
Runs on the mcdp-series timer for fine-grained change ("how many in the last
60 minutes?") and is also called by roundup.py so every hourly publish lands
one.

Append-only, trimmed by scripts/trim.py.
"""
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "src"))

from summarize import state_summary  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
SERIES = ROOT / "data" / "live" / "series.jsonl"


def main() -> None:
    c = state_summary().get("counts", {})
    line = {
        "schema": "SeriesPoint@1",
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "pulled": c.get("pulled_accounted", c.get("pulled", 0)),
        "staged": c.get("staged", 0),
        "pending": c.get("pending", 0),
        "uploaded": c.get("uploaded", 0),
        "deployed": c.get("deployed", 0),
        "read_done": c.get("read_done", 0),
        "fully": c.get("fully_processed", 0),
    }
    SERIES.parent.mkdir(parents=True, exist_ok=True)
    with SERIES.open("a") as f:
        f.write(json.dumps(line) + "\n")
    print(json.dumps(line))


if __name__ == "__main__":
    main()