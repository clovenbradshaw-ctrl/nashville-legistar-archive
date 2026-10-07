"""Chase the legislation associated with Nashville's contracts, and follow
legislation through its own changes.

Legistar is the legislation side of the corridor: matters (bills, resolutions,
ordinances) carry the attachments that ARE many procurement contracts, and a
contract's contracting party cross-refers back to the legislation that
authorized it (src/crossref.py). This module keeps a byte-hash state per
matter, so ANY change -- an amendment, a substituted document, a new
attachment -- diffs and lands on the append-only changes ledger, re-driving
the same two-tier route for the deltas (reads, flags, ledger rows).

State discipline: data/legislation/observations.jsonl and changes.jsonl are
append-only; data/legislation/state.json is a DERIVED fold, rebuilt each run
(everything here follows the archive repo's 'a fold of the append-only log,
not a record itself' rule).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from legistar_client import Legistar  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
L_DIR = ROOT / "data" / "legislation"
OBSERVATIONS = L_DIR / "observations.jsonl"
CHANGES = L_DIR / "changes.jsonl"
STATE = L_DIR / "state.json"


def _sha(data_list) -> str:
    return hashlib.sha256(json.dumps(data_list, sort_keys=True).encode("utf-8")).hexdigest()


def load_state() -> dict:
    if not STATE.exists():
        return {}
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def save_state(state: dict) -> None:
    L_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    tmp.replace(STATE)


def append(path: Path, line: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(line) + "\n")


def attachment_sig(api, matter_id: int) -> tuple[str, int]:
    try:
        atts = api.attachments(matter_id) or []
    except Exception:  # noqa: BLE001 - best-effort; the matter record still stands
        return "", 0
    sig = _sha([(a.get("MatterAttachmentId"), a.get("MatterAttachmentName")) for a in atts])
    return sig, len(atts)


def poll(*, limit: int | None = None, client: str = "nashville") -> dict:
    api = Legistar(client)
    state = load_state()
    n_new = n_changed = n_same = 0
    scanned = 0
    watermark: str | None = None
    for raw in api.matters():
        scanned += 1
        if limit and scanned > limit:
            break
        mid = str(raw["MatterId"])
        file_no = raw.get("MatterFile") or mid
        title = (raw.get("MatterTitle") or file_no)[:200]
        sig = _sha([raw])
        prev = state.get(mid)
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        if prev is None:
            change = "new"
        elif prev.get("sha") != sig:
            change = "changed"
        else:
            n_same += 1
            watermark = now
            continue

        att_sig, n_att = attachment_sig(api, raw["MatterId"])
        diff = None
        if prev is not None:
            diff = {"sha": {"before": prev.get("sha"), "after": sig},
                    "attachments": {"before": prev.get("attachment_sha"), "after": att_sig}}
        line = {
            "schema": "LegislationChange@1",
            "matter_id": raw["MatterId"],
            "matter_file": file_no,
            "matter_title": title,
            "change": change,
            "sha": sig,
            "attachments": n_att,
            "attachment_sha": att_sig,
            "diff": diff,
            "at": now,
        }
        append(OBSERVATIONS, line)
        append(CHANGES, line)
        state[mid] = {"file": file_no, "title": title, "sha": sig,
                      "attachment_sha": att_sig, "n_attachments": n_att, "observed_at": now}
        if change == "new":
            n_new += 1
        else:
            n_changed += 1
        watermark = now

    save_state(state)
    return {"n_scanned": scanned, "n_same": n_same, "n_new": n_new, "n_changed": n_changed,
            "watermark": watermark, "state_entries": len(state)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="poll Legistar matters and record change/observation")
    ap.add_argument("--limit", type=int, default=None, help="stop after scanning this many matters")
    ap.add_argument("--client", default="nashville")
    args = ap.parse_args()
    print(json.dumps(poll(limit=args.limit, client=args.client), indent=2))
    print(f"changes -> {CHANGES}")