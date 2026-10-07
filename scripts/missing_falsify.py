"""Falsify the missing-estimator's counting and standing rules.

Every estimate in src/missing.py reduces to standing_missing() + the recount
diff, over pure sets -- so we can seed synthetic (held, discovered, novel,
cap) states and prove the verdicts, exactly like qc_falsify proves the QC.
A count that can't be seeded is a count that can't be trusted.

Exit 0 iff all seeded scenarios return the expected standing/missing and the
estimate math is consistent.
"""
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "src"))

import missing as M  # noqa: E402

FAILURES = []


def check(name, got, expect):
    ok = got == expect
    if not ok:
        FAILURES.append((name, expect, got))
    print(f"  {'ok  ' if ok else 'FAIL'} {name}: got {got}")


# standing_missing over pure sets
s, n, _ = M.standing_missing("X", held={"a", "b", "c"}, caps=False)
check("clean -> complete", (s, n), ("complete", 0))

s, n, _ = M.standing_missing("X", held={"a", "b"}, caps=False, discovered={"x", "y", "z"})
check("discovered -> incomplete missing=3", (s, n), ("incomplete", 3))

s, n, _ = M.standing_missing("X", held={"a"}, caps=True)
check("capped -> incomplete (bound)", (s, n), ("incomplete", 0))

s, n, _ = M.standing_missing("X", held={"a"}, caps=False, discovered=set(), novel=2, sample_k=3)
check("clean recount + dirty sample -> contested", (s, n), ("contested", 0))

s, n, _ = M.standing_missing("X", held=set(), caps=False)
check("empty -> unexamined", (s, n), ("unexamined", 0))

s, n, _ = M.standing_missing("X", held=set(), caps=False, discovered={"q"})
check("only discovered -> incomplete missing=1", (s, n), ("incomplete", 1))

# estimate math: 1 novel in 26 slices -> ~1 across the space
e = M.estimate_from_sample(1, 26)
check("estimate 1/26 -> ~1", e["estimate"], 1)
check("estimate carries a falsifying control", bool(e.get("falsifying")), True)


if FAILURES:
    for name, exp, got in FAILURES:
        print(f"  FAILED {name}: expected {exp} got {got}")
    print(f"\n{len(FAILURES)} failure(s).")
    sys.exit(1)
print("\nmissing-estimator FALSIFIED-ROBUST: 7 scenarios + estimate math correct.")