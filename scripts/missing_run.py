"""Run the missing-estimator over a (rotating) slice of departments.

Populates data/missing.jsonl so the roundup/audit has per-department missing
numbers. By default picks a deterministic 24-department slice per day (rotated
by day-of-year) so all 120 departments are covered over ~5 days without
hammering the portal in one pass.

Usage:
    .venv/bin/python scripts/missing_run.py --live            # rotated 24/day (light)
    .venv/bin/python scripts/missing_run.py --live --deep --deep-capped   # deep-exhaustive for capped depts
    .venv/bin/python scripts/missing_run.py --live --deep --departments "POLICE,FIRE"
"""
import argparse
import datetime
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "src"))

from missing import Missing, latest_per_department  # noqa: E402
from epav_client import DEPARTMENTS  # noqa: E402

ROTATE_PER_DAY = 24
DEEP_CAPPED_PER_DAY = 2


def rotated_slice() -> list[str]:
    doy = int(datetime.date.today().strftime("%j"))
    step = max(1, len(DEPARTMENTS) // ROTATE_PER_DAY)
    start = (doy * step) % len(DEPARTMENTS)
    out, i = [], start
    while len(out) < ROTATE_PER_DAY:
        out.append(DEPARTMENTS[i % len(DEPARTMENTS)])
        i += 1
    return out


def capped_from_ledger(n: int = DEEP_CAPPED_PER_DAY) -> list[str]:
    """Departments whose newest missing report is still a cap-bound (a 1000
    or a capped-shard reason) -- the ones that need the deep recount."""
    latest = latest_per_department()
    capped = [r["department"] for r in latest.values()
              if r.get("standing") == "incomplete"
              and (r.get("missing", 0) >= 1000 or "cap" in (r.get("reason") or "").lower())]
    doy = int(datetime.date.today().strftime("%j"))
    if not capped:
        return []
    start = doy % len(capped)
    return [capped[(start + i) % len(capped)] for i in range(min(n, len(capped)))]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true")
    ap.add_argument("--deep", action="store_true")
    ap.add_argument("--deep-capped", action="store_true", help="deep-recount the n most-capped departments")
    ap.add_argument("--departments", default=None)
    ap.add_argument("--limit", type=int, default=None)
    a = ap.parse_args()

    if a.deep_capped:
        depts = capped_from_ledger()
        a.deep = True
    elif a.departments:
        depts = [d.strip() for d in a.departments.split(",") if d.strip()]
    elif a.limit:
        depts = DEPARTMENTS[: a.limit]
    else:
        depts = rotated_slice()

    if not depts:
        print(json.dumps({"n": 0, "note": "no capped departments to deep-recount today"}))
        return

    mg = Missing(live=a.live, deep=a.deep)
    reports = [mg.report(d) for d in depts]
    counts = {"complete": 0, "incomplete": 0, "contested": 0, "unexamined": 0}
    for r in reports:
        counts[r["standing"]] = counts.get(r["standing"], 0) + 1
    print(json.dumps({
        "n": len(reports), "live": a.live, "deep": a.deep, "counts": counts,
        "missing_total": sum(r["missing"] for r in reports),
        "missing_by_department": [{"department": r["department"], "missing": r["missing"], "standing": r["standing"], "deep": r.get("deep", False)}
                                  for r in reports if r["missing"]],
    }, indent=2))


if __name__ == "__main__":
    main()