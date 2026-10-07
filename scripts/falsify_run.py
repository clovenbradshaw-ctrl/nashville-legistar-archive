"""Thin scheduler wrapper for the DEF/EVA/REC completeness round.

Usage:
    .venv/bin/python scripts/falsify_run.py [--live] [--limit N]
"""
import sys
import pathlib
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "src"))

from falsify import Falsify  # noqa: E402

if __name__ == "__main__":
    args = sys.argv[1:]
    live = "--live" in args
    limit = None
    if "--limit" in args:
        limit = int(args[args.index("--limit") + 1])
    run_id = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    summary = Falsify(live=live).pass_round(limit=limit, run_id=run_id)
    print(summary)