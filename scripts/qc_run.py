"""Run the QC audit over the pipeline's current on-disk state.

Offline (no network): reads data/ and appends one QCReport@1 line per check
to data/qc/reports.jsonl. Exits non-zero if any defect stands, so a scheduler
can alert on it. The falsification harness scripts/qc_falsify.py proves these
checks catch their seeded problems -- a report here is only meaningful because
the checker is itself tested against its controls.

Usage:
    python scripts/qc_run.py [--no-write]
"""
from __future__ import annotations

import argparse
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "src"))

import qc as qcmod  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-write", action="store_true", help="print reports without writing the ledger")
    args = ap.parse_args()

    run_id = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    ledger = None if args.no_write else ROOT / "data" / "qc" / "reports.jsonl"
    reports = qcmod.default_run(ROOT, run_id, ledger_path=ledger)

    # Learning engagement: every defect/suspicious is a recurrence under
    # (qc, check) in the derived-rules ledger, so a check that keeps firing
    # mints a rule with a control and a half-life -- and the proteasome
    # concedes it once it stops being evidenced.
    try:
        import learning
        import live
        for rep in reports:
            live.event("qc", run_id=run_id, check=rep.check, subject=rep.subject, grade=rep.grade, n=len(rep.findings))
            if rep.grade in ("defect", "suspicious"):
                learning.observe("qc", rep.check)
    except Exception as e:  # noqa: BLE001 - audit runs even if learning is wounded
        print(f"  learning.observe failed: {e}", file=sys.stderr)

    n_defect = n_susp = 0
    for rep in reports:
        tag = rep.grade.upper()
        if rep.grade == "defect":
            n_defect += 1
        elif rep.grade == "suspicious":
            n_susp += 1
        print(f"[{tag}] {rep.check} — {rep.subject}")
        for f in rep.findings[:5]:
            print(f"        {f}")
    print(f"\nQC run {run_id}: {len(reports)} checks, "
          f"{n_defect} defect(s), {n_susp} suspicious, "
          f"ledger={'data/qc/reports.jsonl' if ledger else 'stdout-only'}")
    try:
        import live
        live.event("qc-run", run_id=run_id, checks=len(reports), defects=n_defect, suspicious=n_susp)
    except Exception:  # noqa: BLE001 - reporting never breaks the audit
        pass
    # Completing the audit is not a crash: defects/suspicious are the VERDICT,
    # delivered in the report + the live feed, not a reason to exit nonzero
    # (which systemd then mislabels as a failed unit).
    return 0


if __name__ == "__main__":
    sys.exit(main())