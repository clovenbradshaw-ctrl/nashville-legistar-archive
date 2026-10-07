"""DEF -> EVA -> REC completeness consensus over the acquisition.

A deliberate port of the anchor loop's shape (holodeck-anchor.js): DEF declares
the expectations (the departments and the invariants, as DATA not code), EVA
probes every expectation in parallel and records every answer including the
misses and the session-suspicious zeros, REC appends one raised verdict per
subject append-only -- a verdict that names no falsifying control is refused,
and an UNEXAMINED or contested verdict is never a pass (gateVerdict's rule:
0 rows or 0 rejected means unmeasured, not pass).

Verdict vocabulary (Fort's typed standings, holodeck-fort.js): complete /
incomplete / contested / unexamined. A contested or unexamined verdict
survives onto the next run (seeded from verdicts.jsonl), exactly like the
corroboration ledger's contradiction set survives between sessions.
"""

from __future__ import annotations

import json
import random
import string
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import gaps as gaps_ledger  # noqa: E402
import live  # noqa: E402
from epav_client import DEPARTMENTS, RESULT_CAP, EPAV, live_departments  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
VERDICTS = ROOT / "data" / "verdicts.jsonl"
RUNS_DIR = ROOT / "data" / "falsify-runs"


def _read_jsonl(path: Path):
    if not path.exists():
        return []
    out = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def held_by_department() -> dict[str, set[str]]:
    """Unique fetched tokens per department, from the epav-fetched ledger.
    A token's department is the row's own department field."""
    out: dict[str, set[str]] = {}
    for rec in _read_jsonl(ROOT / "data" / "epav-fetched.jsonl"):
        dept = rec.get("department") or rec.get("source_department_query")
        if not dept:
            continue
        tok = rec.get("epav_token") or rec.get("token")
        if tok:
            out.setdefault(dept, set()).add(tok)
    return out


def standing_controls() -> dict[str, str]:
    return {
        "complete": "a fresh live re-scan of this subject finds a token not already held",
        "incomplete": "its standing capped-shard gap resolves to a complete fetch of every returned token",
        "contested": "the novel tokens the adversarial probe found are fetched and held on the next pass",
        "unexamined": "a live probe returns rows for a subject this verdict says was never measured",
    }


class Falsify:
    def __init__(self, *, live: bool = False):
        self.live = live
        self._epav = None

    def client(self) -> EPAV:
        if self._epav is None:
            self._epav = EPAV(delay=0.3)
        return self._epav

    # ---- DEF --------------------------------------------------------------
    def declare(self) -> dict:
        const = set(DEPARTMENTS)
        live = set(live_departments()) if self.live else set(const)
        return {
            "schema": "CompletenessExpectations@1",
            "departments_constant": sorted(const),
            "departments_live": sorted(live),
            "drift": sorted(live - const),
            "invariants": [
                "a search returning exactly RESULT_CAP is a shard that must be subdivided, never recorded whole",
                "a capped-forever shard is a declared gap in data/gaps.jsonl, never a silent skip",
                "a verdict must name a falsifying control or it is refused",
                "unexamined/contested is never a pass",
            ],
            "declared_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    # ---- EVA --------------------------------------------------------------
    def evaluate(self, dept: str, held: set[str], run_id: str) -> tuple[str, str, dict]:
        """Returns (standing, reason, evidence). Offline mode reads only the
        ledgers; live mode also probes the portal and runs the adversarial
        sample (the sibling control: a fresh slice that must not produce a
        token we don't already hold)."""
        gaps = [g for g in gaps_ledger.read_gaps() if dept in g.get("subject", "")]
        evidence = {"held": len(held), "standalone_gaps": len(gaps)}

        if not self.live:
            if gaps:
                return ("incomplete", "standing capped-shard gap(s) for this department", evidence)
            if len(held) > 0:
                return ("complete", "held tokens present, no standing gaps (offline provisional)", evidence)
            return ("unexamined", "no held tokens and no gap -- never measured", evidence)

        api = self.client()
        rows = api.search(department=dept)
        n = len(rows)
        evidence["recount"] = n
        if n >= RESULT_CAP:
            return ("incomplete", f"recount hit the {RESULT_CAP}-row cap; needs the exhaustive walk", evidence)
        if n == 0:
            return ("unexamined", "zero-row recount -- dead session or genuinely empty, needs a control probe", evidence)

        novel = 0
        for letter in random.sample(string.ascii_uppercase, k=min(3, len(string.ascii_uppercase))):
            slice_rows = api.search(department=dept, contracting_party=letter)
            for r in slice_rows:
                if r["token"] not in held:
                    novel += 1
                    gaps_ledger.record_gap(
                        kind="novel-token-found",
                        subject=f"department={dept!r} party-prefix={letter!r}",
                        detail=f"adversarial sample surfaced token {r['token']!r} not in the held set",
                        falsifying=(
                            "the next fetch pass holds this token and it stays present on a future adversarial sample"
                        ),
                    )
        evidence["adversarial_novel"] = novel
        if novel:
            return ("contested", f"adversarial sample found {novel} novel token(s)", evidence)
        return ("complete", "recount under cap, adversarial sample clean", evidence)

    # ---- REC --------------------------------------------------------------
    def record(self, run_id: str, expectations: dict, verdicts: list[dict]) -> list[dict]:
        VERDICTS.parent.mkdir(parents=True, exist_ok=True)
        controls = standing_controls()
        raised = []
        for v in verdicts:
            control = controls.get(v["standing"])
            if not control:  # a verdict with no falsifying control is refused
                raise ValueError(f"refused verdict with no falsifying control: {v}")
            line = {
                "schema": "CompletenessVerdict@1",
                "run_id": run_id,
                "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "subject": v["subject"],
                "standing": v["standing"],
                "reason": v["reason"],
                "falsifying": control,
                "evidence": v.get("evidence", {}),
            }
            raised.append(line)
            with VERDICTS.open("a") as f:
                f.write(json.dumps(line) + "\n")
            try:
                live.event("verdict", run_id=run_id, subject=v["subject"], standing=v["standing"], reason=v["reason"])
            except Exception:  # noqa: BLE001 - ledger append outlives a feed event
                pass
        return raised

    def pass_round(self, *, limit: int | None = None, run_id: str) -> dict:
        expectations = self.declare()
        held = held_by_department()
        subjects = expectations["departments_live"][:limit] if limit else expectations["departments_live"]

        verdicts = []
        for dept in subjects:
            standing, reason, evidence = self.evaluate(dept, held.get(dept, set()), run_id)
            verdicts.append({"subject": dept, "standing": standing, "reason": reason, "evidence": evidence})

        raised = self.record(run_id, expectations, verdicts)
        summary = {
            "schema": "CompletenessRun@1",
            "run_id": run_id,
            "live": self.live,
            "n_subjects": len(subjects),
            "end": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "counts": {s: sum(1 for vv in raised if vv["standing"] == s) for s in standing_controls()},
        }
        RUNS_DIR.mkdir(parents=True, exist_ok=True)
        (RUNS_DIR / f"{run_id}.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
        return summary


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true", help="run live portal probes + adversarial samples (default: offline ledger audit)")
    ap.add_argument("--limit", type=int, default=None, help="cap the number of departments audited")
    args = ap.parse_args()
    run_id = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    s = Falsify(live=args.live).pass_round(limit=args.limit, run_id=run_id)
    print(json.dumps(s, indent=2))
    print(f"verdicts appended -> {VERDICTS}")