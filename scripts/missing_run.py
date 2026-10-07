"""Run the missing-estimator over a (rotating) slice of departments.

Populates data/missing.jsonl so the roundup/audit has per-department missing
numbers. By default picks a deterministic 24-department slice per day (rotated
by day-of-year) so all 120 departments are covered over ~5 days without
hammering the portal in one pass.

Usage:
    .venv/bin/python scripts/missing_run.py --live            # rotated 24/day
    .venv/bin/python scripts/missing_run.py --live --departments "POLICE,FIRE"
"""
import argparse
import datetime
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "src"))

from missing import Missing  # noqa: E402
from epav_client import DEPARTMENTS  # noqa: E402

ROTATE_PER_DAY = 24


def rotated_slice() -> list[str]:
    doy = int(datetime.date.today().strftime("%j"))
    step = max(1, len(DEPARTMENTS) // ROTATE_PER_DAY)
    start = (doy * step) % len(DEPARTMENTS)
    out, i = [], start
    while len(out) < ROTATE_PER_DAY:
        out.append(DEPARTMENTS[i % len(DEPARTMENTS)])
        i += 1
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true")
    ap.add_argument("--departments", default=None)
    ap.add_argument("--limit", type=int, default=None)
    a = ap.parse_args()

    if a.departments:
        depts = [d.strip() for d in a.departments.split(",") if d.strip()]
    elif a.limit:
        depts = DEPARTMENTS[: a.limit]
    else:
        depts = rotated_slice()

    mg = Missing(live=a.live)
    reports = [mg.report(d) for d in depts]
    counts = {"complete": 0, "incomplete": 0, "contested": 0, "unexamined": 0}
    for r in reports:
        counts[r["standing"]] = counts.get(r["standing"], 0) + 1
    print(json.dumps({
        "n": len(reports), "live": a.live, "counts": counts,
        "missing_total": sum(r["missing"] for r in reports),
        "missing_by_department": [{"department": r["department"], "missing": r["missing"], "standing": r["standing"]}
                                  for r in reports if r["missing"]],
    }, indent=2))


if __name__ == "__main__":
    main()