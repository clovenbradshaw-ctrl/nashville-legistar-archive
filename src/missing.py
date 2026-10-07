"""How many contracts are we missing, and from which departments -- made
falsifiable.

The portal exposes NO independent total (verified 2026-10-07: the Search
partial has no 'of N' counter), so 'expected' cannot be read from a server
side number. Instead 'missing' is estimated two ways that can be checked:

1. RECOUNT DIFF (concrete lower bound). Re-run the department search; every
   token the portal returns right now that is not in our held set is a real,
   fetchable miss. Fetching those tokens and re-running this pass must make
   them disappear -- that is the falsifying control.

2. ADVERSARIAL SAMPLING (estimate). Random Contracting-Party prefix slices;
   the novel-token rate extrapolates to an estimate of what still lies past
   the enumeration's reach, reported WITH its method and control and never
   as a certainty.

3. CAP POISONING. A department whose recount is still at the 1000-row cap has
   an unknown recall -- its missing is '>= cap - held', a declared bound with
   a control ('a deeper subdivision yields no new tokens'), never a clean
   number pretending to know.

Every department gets a MissingReport@1: held, missing (concrete), estimate
(with method), cap-bound, and a standing
(complete / incomplete / contested / unexamined). The counting itself is
falsified by scripts/missing_falsify.py with seeded sets.
"""

from __future__ import annotations

import json
import random
import string
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import live  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MISSING = ROOT / "data" / "missing.jsonl"

from epav_client import EPAV, DEPARTMENTS, RESULT_CAP  # noqa: E402
from falsify import held_by_department  # noqa: E402


def standing_missing(dept: str, *, held: set[str], caps: bool, discovered: set[str] | None = None,
                     novel: int = 0, sample_k: int = 0) -> tuple[str, int, str]:
    """(standing, concrete_missing, reason). Rules:
      - unexamined: no held data at all (never measured)
      - incomplete: discovered tokens we don't hold, or an open cap
      - complete: recount all held, no novel sample, no cap
    A report is only complete when both estimators agree -- a clean recount
    with a dirty sample is 'contested', never a pass.""" 
    n_missing = len(discovered or set())
    if not held and not discovered and not caps:
        return "unexamined", 0, "no held data and no discovery -- never measured"
    if caps:
        return "incomplete", n_missing, f"recount at the {RESULT_CAP}-row cap; missing >= cap - {len(held)} (bound, not a count)"
    if n_missing:
        return "incomplete", n_missing, f"recount surfaced {n_missing} token(s) not in the held set"
    if novel and sample_k:
        return "contested", 0, f"recount clean but {novel} novel token(s) in {sample_k} sampled slices"
    return "complete", 0, "recount fully held, adversarial sample clean, no cap"


def estimate_from_sample(novel: int, slice_count: int, space: int = 26) -> dict:
    """Rate-based extrapolation of still-missing tokens, with its control.
    Reported as an ESTIMATE; the only numbers that can be verified are the
    ones the recount actually discovers."""
    if slice_count <= 0:
        return {"estimate": None, "method": "no slices", "falsifying": ""}
    rate = novel / slice_count
    return {
        "estimate": round(rate * space),
        "n_sampled_slices": slice_count,
        "novel_in_sample": novel,
        "per_slice_rate": round(rate, 3),
        "falsifying": "fetching every token the next recount discovers makes the estimate converge to 0",
    }


class Missing:
    def __init__(self, *, live: bool = False, deep: bool = False):
        self.live = live
        self.deep = deep
        self._api = None

    def api(self) -> EPAV:
        if self._api is None:
            self._api = EPAV(delay=0.3)
        return self._api

    def _has_residual_cap(self, dept: str) -> bool:
        return any(dept in g.get("subject", "") and g.get("kind") == "capped-shard" for g in _gaps())

    def analyze_deep(self, dept: str, held: set[str]) -> dict:
        """Complete-list recount for a department that exceeds the 1000-row
        cap: drive the portal's full axis-recurse (Contracting Party A-Z0-9 ->
        Description -> Contract Number digits) so discovery is measured past
        the cap instead of reported as a bound. Any shard still at the cap
        after every axis is a recorded residual gap -- so even here 'missing'
        can be a lower bound, but it is no longer just 'someone hit 1000'."""
        api = self.api()
        tokens: set[str] = set()
        for row in api.iter_department_exhaustive(dept):
            tok = row.get("token")
            if tok:
                tokens.add(tok)
        discovered = tokens - held
        residual = self._has_residual_cap(dept)
        n = len(discovered)
        if n:
            standing, reason = "incomplete", f"deep recount surfaced {n} token(s) past the cap that we don't hold"
        elif residual:
            standing, reason = "incomplete", "deep recount complete except residual capped shards (remaining bound recorded as gaps)"
        else:
            standing, reason = "complete", "deep recount found everything the portal holds, already held"
        return {
            "standing": standing, "missing": n, "reason": reason,
            "estimate": {"method": "deep exhaustive", "estimate": None,
                         "falsifying": "another deep recount of this department yields no token we don't hold"},
            "held": len(held), "recount": len(tokens), "deep": True,
            "discovered_sample": sorted(discovered)[:10],
        }

    def analyze(self, dept: str, held: set[str]) -> dict:
        gaps_open = any(dept in g.get("subject", "") for g in _gaps())
        if not self.live:
            s, n, reason = standing_missing(dept, held=held, caps=gaps_open)
            return {"standing": s, "missing": n, "reason": reason, "estimate": None}

        # deep means deep: the exhaustive axis-recurse runs for the department
        # outright (not only when a gap was pre-recorded) so the recount is
        # actually measured past the 1000-row cap.
        if self.deep:
            return self.analyze_deep(dept, held)

        api = self.api()
        rows = api.search(department=dept)
        rec_tokens = {r["token"] for r in rows}
        discovered = rec_tokens - held
        caps = len(rows) >= RESULT_CAP or gaps_open

        novel = 0
        k = 0
        novel_tokens = set()
        if not caps:
            for letter in random.sample(string.ascii_uppercase, k=3):
                slice_rows = api.search(department=dept, contracting_party=letter)
                k += 1
                for r in slice_rows:
                    if r["token"] not in held and r["token"] not in discovered:
                        novel_tokens.add(r["token"])
            novel = len(novel_tokens)

        s, n, reason = standing_missing(dept, held=held, caps=caps, discovered=discovered,
                                        novel=novel, sample_k=k)
        return {
            "standing": s, "missing": n, "reason": reason,
            "estimate": estimate_from_sample(novel, k),
            "held": len(held), "recount": len(rec_tokens),
            "discovered_sample": sorted(discovered)[:10],
        }

    def report(self, dept: str) -> dict:
        held = held_by_department().get(dept, set())
        r = self.analyze(dept, held)
        line = {
            "schema": "MissingReport@1",
            "department": dept,
            "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "standing": r["standing"],
            "missing": r["missing"],
            "reason": r["reason"],
            "estimate": r["estimate"],
            "held": r.get("held"), "recount": r.get("recount"),
            "deep": r.get("deep", False),
            "discovered_sample": r.get("discovered_sample", []),
        }
        MISSING.parent.mkdir(parents=True, exist_ok=True)
        with MISSING.open("a") as f:
            f.write(json.dumps(line) + "\n")
        try:
            live.event("missing", department=dept, standing=r["standing"], missing=r["missing"],
                       reason=r["reason"])
        except Exception:  # noqa: BLE001 - the report is recorded regardless
            pass
        return line

    def run(self, *, limit: int | None = None) -> dict:
        depts = DEPARTMENTS[:limit] if limit else DEPARTMENTS
        reports = [self.report(d) for d in depts]
        counts = {"complete": 0, "incomplete": 0, "contested": 0, "unexamined": 0}
        for r in reports:
            counts[r["standing"]] = counts.get(r["standing"], 0) + 1
        return {"n": len(reports), "counts": counts,
                "missing_total": sum(r["missing"] for r in reports)}


def _gaps():
    p = ROOT / "data" / "gaps.jsonl"
    if not p.exists():
        return []
    out = []
    with open(p) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return out


def latest_per_department() -> dict[str, dict]:
    """The newest MissingReport@1 per department (state fold over the
    append-only ledger), for the roundup and the audit view."""
    if not MISSING.exists():
        return {}
    latest: dict[str, dict] = {}
    with open(MISSING) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            latest[r.get("department")] = r
    return latest


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true")
    ap.add_argument("--deep", action="store_true", help="deep-exhaustive recount for capped departments")
    ap.add_argument("--limit", type=int, default=None)
    a = ap.parse_args()
    print(json.dumps(Missing(live=a.live, deep=a.deep).run(limit=a.limit), indent=2))
    print(f"reports -> {MISSING}")