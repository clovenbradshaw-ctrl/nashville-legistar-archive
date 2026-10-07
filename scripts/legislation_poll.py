"""Thin scheduler wrapper for the Legistar legislation change poll.

Usage:
    .venv/bin/python scripts/legislation_poll.py [--limit N]
"""
import json
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "src"))

from legislation import poll  # noqa: E402

if __name__ == "__main__":
    args = sys.argv[1:]
    limit = None
    if "--limit" in args:
        limit = int(args[args.index("--limit") + 1])
    print(json.dumps(poll(limit=limit), indent=2))