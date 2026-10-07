"""Write the hourly roundup for the live feed: what happened in the last 24h
(acquired/uploaded counts, by department and vendor, day-bucketed) appended to
data/live/roundups.jsonl and emitted on the stream as a ROUNDUP event. Runs on
a systemd timer (mcdp-roundup).

Usage:
    .venv/bin/python scripts/roundup.py [--hours 24]
"""
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "src"))

import live  # noqa: E402

if __name__ == "__main__":
    hours = 24
    args = sys.argv[1:]
    if "--hours" in args:
        hours = int(args[args.index("--hours") + 1])
    line = live.roundup(hours=hours, since=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    print(json.dumps(line, indent=2))
    print(f"roundup appended -> {live.ROUNDUPS}")