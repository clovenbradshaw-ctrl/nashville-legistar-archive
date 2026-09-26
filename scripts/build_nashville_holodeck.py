"""Builds a real Holodeck-shaped corpus for the archived Metro Nashville
contracts, written into eoreader7's own plans/nashville-contracts/
directory -- the exact file layout plans/ohs/ already uses (ground/<id>.txt
+ sidecars, ledger/*.jsonl, ohs.surfacedef.json) -- so the existing,
unmodified rendering pipeline (block-ground/cast/derive/gate/surface.mjs)
can render it without changes, only a retargeted driver script.

Ground text is RE-DOWNLOADED from each document's own archive.org
extracted-text.txt, not read from the local eoreader7 workdir cache --
that cache may hold only novel, boilerplate-filtered pages, while
contract_extract.py's byte spans are addressed against the FULL text.
Re-downloading the canonical copy guarantees byte-for-byte alignment,
which the gate's own verbatim check then confirms for real.

Ledger rows come ONLY from contract-ledger.jsonl (ContractLedgerObservation
@1: deterministic regex extraction, no model in the loop, no giver field).
The eoreader7-derived organization assertions in assertions.jsonl are
deliberately excluded here: they carry a `giver`, and block-gate.mjs
correctly refuses any surfaced link that's an unflagged model proposal --
promotion to a reviewed surface is a separate step this script doesn't do."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
EOREADER7_PLANS = Path("/Users/mlacy/Documents/3.0/eoreader7/plans")
OUT = EOREADER7_PLANS / "nashville-contracts"
GROUND = OUT / "ground"
LEDGER = OUT / "ledger"

CONTRACT_LEDGER = ROOT / "data" / "contract-ledger.jsonl"
EPAV_MANIFEST = ROOT / "data" / "epav-manifest.jsonl"
EPAV_FETCHED = ROOT / "data" / "epav-fetched.jsonl"
LOCAL_CACHE = ROOT / "data" / ".epav-local"


def load_manifest() -> dict:
    """Merges epav-manifest.jsonl (confirmed uploaded) with epav-fetched.jsonl
    as a metadata fallback for documents the two-phase pipeline has already
    fetched and ledgered but not yet uploaded -- those have real
    contract_number/contracting_party/department/epav_url already, just no
    archive_id/sha256/archived_at yet. Manifest entries win when both exist."""
    by_token = {}
    if EPAV_FETCHED.exists():
        for line in EPAV_FETCHED.open():
            r = json.loads(line)
            by_token[r["epav_token"]] = r
    if EPAV_MANIFEST.exists():
        for line in EPAV_MANIFEST.open():
            r = json.loads(line)
            by_token[r["epav_token"]] = {**by_token.get(r["epav_token"], {}), **r}
    return by_token


def fetch_ground_text(token: str, manifest: dict) -> str | None:
    local = LOCAL_CACHE / token / "extracted-text.txt"
    if local.exists():
        return local.read_text()
    rec = manifest.get(token)
    if not rec:
        return None
    url = f"https://archive.org/download/{rec['archive_id']}/extracted-text.txt"
    for attempt in range(3):
        r = requests.get(url, timeout=60, allow_redirects=True)
        if r.status_code == 200:
            return r.text
        time.sleep(2 * (attempt + 1))
    return None


def main() -> None:
    GROUND.mkdir(parents=True, exist_ok=True)
    LEDGER.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()

    rows_by_doc: dict[str, list[dict]] = {}
    row_meta_by_doc: dict[str, dict] = {}
    for line in CONTRACT_LEDGER.open():
        r = json.loads(line)
        token = r.get("epav_token")
        if not token:
            continue
        rows_by_doc.setdefault(token, []).append(r)
        row_meta_by_doc[token] = r

    ledger_out = []
    docs_written = 0
    for token, rows in rows_by_doc.items():
        text = fetch_ground_text(token, manifest)
        if not text:
            print(f"  SKIP {token}: no ground text available", file=sys.stderr)
            continue

        meta = row_meta_by_doc[token]
        rec = manifest.get(token, {})
        txt_path = GROUND / f"{token}.txt"
        txt_path.write_text(text)

        prov = {
            "id": token,
            "title": f"{rec.get('contract_number', token)} — {rec.get('contracting_party', '')}",
            "source_url": rec.get("epav_url", ""),
            "retrieved_at": rec.get("archived_at", ""),
            "capture": [{"sha256": rec.get("sha256", "n/a")}],
            "txt": {"sha256": "n/a", "chars": len(text)},
            "extraction": "pdf-text-layer + tesseract-ocr-fallback (nashville-legistar-archive/src/extract_text.py)",
            "tier": "epav-contract",
            "doctype": rec.get("department", "contract"),
            "license": "public record (Metro Nashville ePAV)",
        }
        (GROUND / f"{token}.txt.provenance.json").write_text(json.dumps(prov, indent=1))
        (GROUND / f"{token}.txt.pagemap.json").write_text(json.dumps([{"page": 1, "byteStart": 0, "byteEnd": len(text)}]))
        docs_written += 1

        for row in rows:
            start, end = row["at"]
            verbatim = text[start:end]
            if verbatim != row["verbatim"]:
                print(f"  SKIP row {row['id']}: span no longer matches downloaded ground text", file=sys.stderr)
                continue
            ledger_out.append({
                "id": row["id"],
                "doc": f"nashville-contracts/ground/{token}.txt",
                "at": [start, end],
                "verbatim": verbatim,
                "kind": row["kind"],
                "page": 1,
                "fields": {**row.get("fields", {}), "contract_number": row.get("contract_number", "")},
                "basis": "deterministic regex extraction over the retained ePAV text (contract_extract.py) -- no model in the loop",
            })

    with (LEDGER / "nashville-contracts-ohs.jsonl").open("w") as f:
        for row in ledger_out:
            f.write(json.dumps(row) + "\n")

    surfacedef = {
        "city": "nashville-contracts",
        "name": "Metro Nashville contracts — traversable holograph",
        "case": "nashville-contracts",
        "case_label": "Metro Nashville procurement contracts (ePAV)",
        "lenses": [
            {"id": "money", "label": "Amounts & compensation", "queries": ["$", "not to exceed", "nte", "compensation", "payment"]},
            {"id": "term", "label": "Term & termination", "queries": ["term", "termination", "renewal", "expiration"]},
            {"id": "parties", "label": "Parties & agreements", "queries": ["by and between", "vendor", "contractor", "supplier", "parties"]},
            {"id": "dates", "label": "Dates", "queries": ["effective date", "commencing", "2020", "2021", "2022", "2023", "2024"]},
        ],
        "metrics": {"registries": ["clause-kind", "department"]},
    }
    (OUT / "ohs.surfacedef.json").write_text(json.dumps(surfacedef, indent=1))

    print(f"done: {docs_written} ground doc(s), {len(ledger_out)} ledger row(s) -> {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
