"""Builds a bulk-import payload for the Fold Explorer / Holodeck app
(/Users/mlacy/Documents/3.0/fold-explorer/), matching the exact doc-object
shape its own addDocs()/saveAdded() persist to localStorage under the key
'fold-explorer-added' -- confirmed live by reading the app's real source
(Fold Explorer v7.dc.html around its addDocs() method), not guessed:
{id, title, year, type, format, url, pages, text, status}.

Ground text comes from the local .epav-local cache first (the two-phase
pipeline's own fetch), falling back to each document's own archive.org
extracted-text.txt for the older-pipeline documents that were never cached
locally -- the same fallback order build_nashville_holodeck.py uses."""

from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

PDF_WORKERS = 6  # each document's fetch+OCR is independent I/O/subprocess-bound work

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from extract_text import make_searchable_pdf

ROOT = Path(__file__).resolve().parent.parent
EPAV_MANIFEST = ROOT / "data" / "epav-manifest.jsonl"
EPAV_FETCHED = ROOT / "data" / "epav-fetched.jsonl"
LOCAL_CACHE = ROOT / "data" / ".epav-local"
FOLD_EXPLORER = Path("/Users/mlacy/Documents/3.0/fold-explorer")
OUT = FOLD_EXPLORER / "nashville-payload.json"
PDF_DIR = FOLD_EXPLORER / "pdfs"


def fetch_pdf_bytes(token: str, rec: dict) -> bytes | None:
    """Same-origin copy is required: archive.org's download endpoint sends
    no access-control-allow-origin header (confirmed via curl), so a direct
    cross-origin fetch(pdfSrc) from the app's own localhost origin would be
    blocked by CORS. Copying the bytes into fold-explorer/pdfs/ avoids that."""
    local = LOCAL_CACHE / token / "source.pdf"
    if local.exists():
        return local.read_bytes()
    identifier = rec.get("archive_id")
    if not identifier:
        return None
    url = f"https://archive.org/download/{identifier}/{token}.pdf"
    for attempt in range(3):
        try:
            r = requests.get(url, timeout=60, allow_redirects=True)
        except requests.RequestException:
            time.sleep(2 * (attempt + 1))
            continue
        if r.status_code == 200:
            return r.content
        time.sleep(2 * (attempt + 1))
    return None


def load_records() -> dict:
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


def fetch_text(token: str, rec: dict) -> str | None:
    local = LOCAL_CACHE / token / "extracted-text.txt"
    if local.exists():
        return local.read_text(errors="replace")
    identifier = rec.get("archive_id")
    if not identifier:
        return None
    url = f"https://archive.org/download/{identifier}/extracted-text.txt"
    for attempt in range(3):
        try:
            r = requests.get(url, timeout=60, allow_redirects=True)
        except requests.RequestException:
            time.sleep(2 * (attempt + 1))
            continue
        if r.status_code == 200:
            return r.text
        time.sleep(2 * (attempt + 1))
    return None


def build_pdf(token: str, rec: dict) -> tuple[str, bool]:
    """Runs in a worker thread. Returns (token, has_pdf)."""
    pdf_path = PDF_DIR / f"{token}.pdf"
    if pdf_path.exists():
        return token, True  # already built (and made searchable) by a prior run
    pdf_bytes = fetch_pdf_bytes(token, rec)
    if not pdf_bytes:
        return token, False
    try:
        pdf_bytes = make_searchable_pdf(pdf_bytes)
    except Exception as e:  # noqa: BLE001 - never blocks; falls back to the original scan
        print(f"    make_searchable_pdf FAILED for {token}: {e}", file=sys.stderr)
    pdf_path.write_bytes(pdf_bytes)
    return token, True


def main() -> None:
    records = load_records()
    docs_by_token = {}
    skipped_destroyed = 0
    skipped_no_text = 0
    PDF_DIR.mkdir(parents=True, exist_ok=True)

    for token, rec in records.items():
        if rec.get("destroyed_per_retention_schedule"):
            skipped_destroyed += 1
            continue
        text = fetch_text(token, rec)
        if not text or not text.strip():
            skipped_no_text += 1
            continue
        party = rec.get("contracting_party") or ""
        contract_number = rec.get("contract_number") or token
        title = f"{contract_number} — {party}" if party else contract_number
        year = None
        exp = rec.get("expiration_date") or ""
        if len(exp) >= 4 and exp[-4:].isdigit():
            year = int(exp[-4:])
        docs_by_token[token] = {
            "id": "nash-" + token,
            "title": title,
            "year": year,
            "type": "Contract",
            "format": "text",
            "url": rec.get("epav_url"),
            "pages": None,
            "text": text,
            "note": f"Metro Nashville contract {contract_number}, {rec.get('department', '')} — via nashville-legistar-archive · {rec.get('archive_url', '')}",
        }

    no_pdf = 0
    done = 0
    total = len(docs_by_token)
    with ThreadPoolExecutor(max_workers=PDF_WORKERS) as pool:
        futures = {pool.submit(build_pdf, token, records[token]): token for token in docs_by_token}
        for fut in as_completed(futures):
            token, has_pdf = fut.result()
            done += 1
            if has_pdf:
                docs_by_token[token]["pdfSrc"] = f"pdfs/{token}.pdf"
            else:
                no_pdf += 1
            if done % 20 == 0 or done == total:
                print(f"  {done}/{total} PDFs processed", file=sys.stderr)

    docs = list(docs_by_token.values())
    OUT.write_text(json.dumps(docs))
    total_chars = sum(len(d["text"]) for d in docs)
    print(f"wrote {len(docs)} docs ({total_chars:,} chars, {OUT.stat().st_size:,} bytes) -> {OUT}", file=sys.stderr)
    print(f"skipped: {skipped_destroyed} destroyed-stub, {skipped_no_text} no text available, {no_pdf} no PDF bytes available", file=sys.stderr)


if __name__ == "__main__":
    main()
