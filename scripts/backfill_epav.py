"""Archive every Metro Nashville ePAV ("Metro Contract Document Search")
contract record at documents.nashville.gov to archive.org, and append one
pointer record per document to data/epav-manifest.jsonl.

This is the project's PRIMARY contracts source, confirmed live 2026-09-25
against Legistar (which floors at 2020-07-13) -- ePAV's real historical
depth goes back to at least the 1990s, per the user's explicit confirmation
("Yes this is where we want contracts from"). Legistar (backfill.py) remains
in place for legislation proper (bills/resolutions/ordinances).

Enumeration walks every value of the Department or Agency field (Index3) --
see src/epav_client.py for why: Keyword search is confirmed broken
server-side, and Contracting Party requires already knowing vendor names.
A department that hits the site's 1000-row cap is logged to stderr rather
than silently truncated (see epav_client.RESULT_CAP).

Some rows resolve to a one-page records-destruction stub (Tennessee's GRS
102/RDA 287), not the real contract -- confirmed live for contract 15387.
Those are archived (the stub itself is a real public record of what
happened to the original) but skip the expensive eoreader7/company/
surveillance passes, and are marked destroyed_per_retention_schedule=true.

Usage:
  ARCHIVE_ORG_ACCESS_KEY=... ARCHIVE_ORG_SECRET_KEY=... \\
    python scripts/backfill_epav.py [--limit N] [--departments POLICE,FIRE]

Idempotent: tokens already present in the manifest are skipped, so an
interrupted run can simply be re-invoked.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from epav_client import EPAV, DEPARTMENTS, is_destruction_notice
from archive_upload import upload_item
from extract_text import extract_pdf_pages, clean_pdf_bytes
from eoreader_pass import read_document, summarize_referents
from legistar_client import Legistar
import company_index
import boilerplate
import surveillance_flag
import contract_extract
import crossref
import fold_pipeline
from fold_pipeline import load_env_file, sha256_of

_legistar_api = Legistar("nashville")  # shared, lazy-safe: only ever hit for a best-effort crossref lookup

ROOT = Path(__file__).resolve().parent.parent
EPAV_MANIFEST = ROOT / "data" / "epav-manifest.jsonl"
REFERENTS = ROOT / "data" / "referents.jsonl"
ASSERTIONS = ROOT / "data" / "assertions.jsonl"
COMPANIES = ROOT / "data" / "companies.json"
LINT_LOG = ROOT / "data" / "lint-log.jsonl"
PAGE_SIGHTINGS = ROOT / "data" / "page-sightings.jsonl"
CORROBORATED = ROOT / "data" / "corroborated-notes.jsonl"
CORROBORATE_MJS = ROOT / "src" / "corroborate.mjs"
SURVEILLANCE_FLAGS = ROOT / "data" / "surveillance-flags.jsonl"
CONTRACT_LEDGER = ROOT / "data" / "contract-ledger.jsonl"
EOWORK = ROOT / "data" / ".eowork"
LINT_EVERY = 10
CORROBORATE_BUDGET = 30


def already_archived(token: str) -> bool:
    if not EPAV_MANIFEST.exists():
        return False
    with EPAV_MANIFEST.open() as fh:
        for line in fh:
            if f'"epav_token": "{token}"' in line:
                return True
    return False


def archive_epav_document(api: EPAV, row: dict, access_key: str, secret_key: str, delay: float, referents_out, page_index: dict) -> dict:
    token = row["token"]
    contract_number = row["contract_number"]
    party = row["contracting_party"]
    dept = row["department"]
    desc = row["description"]
    detail_url = api.detail_url(token)

    data = api.fetch_document(token)
    if not data:
        raise RuntimeError(f"failed to fetch document for token {token}")
    data = clean_pdf_bytes(data)  # archive.org's own PDF checker rejects some real, valid PDFs otherwise

    identifier = f"nashville-epav-contract-{token}"
    filename = f"{token}.pdf"
    title_bits = f"{contract_number} — {party}" if party else contract_number
    resp = upload_item(
        identifier,
        filename,
        data,
        {
            "title": f"Metro Nashville Contract {title_bits}"[:2000],
            "description": f"{desc or 'Contract'} — {dept or ''} — Metro Nashville contract {contract_number}, archived from {detail_url}",
            "subject": "Metro Nashville;contracts;procurement;ePAV",
            "creator": "Metro Nashville Government (via ePAV / Metro Clerk)",
            "source": detail_url,
            "external-identifier": f"urn:nashville-epav:contract:{token}",
        },
        access_key,
        secret_key,
    )
    resp.raise_for_status()
    time.sleep(delay)

    try:
        legistar_matches = crossref.legistar_matches_for(_legistar_api, party)
    except Exception:  # noqa: BLE001 - best-effort, never blocks archiving
        legistar_matches = []

    record = {
        "epav_token": token,
        "contract_number": contract_number,
        "status": row["status"],
        "contracting_party": party,
        "department": dept,
        "description": desc,
        "expiration_date": row["expiration_date"],
        "source_department_query": row.get("source_department_query"),
        "epav_url": detail_url,
        "legistar_matches": legistar_matches,  # best-effort, name-based; usually empty -- see crossref.py
        "archive_id": identifier,
        "archive_url": f"https://archive.org/details/{identifier}",
        "sha256": sha256_of(data),
        "bytes": len(data),
    }

    try:
        page_context = {
            "doc_key": f"epav:{token}",
            "epav_token": token,
            "contract_number": contract_number,
            "archive_url": record["archive_url"],
            "intro_date": None,
        }
        pages = extract_pdf_pages(data)
        novel_pages, page_records = boilerplate.classify_pages(pages, page_index, page_context)
        for rec in page_records:
            boilerplate.append_sighting(PAGE_SIGHTINGS, rec["hash"], page_context)

        # The FULL extracted text is archived regardless of what happens
        # below -- nothing about a destroyed-stub or boilerplate check ever
        # loses it.
        full_text = "\n\n".join(pages)
        destroyed = is_destruction_notice(full_text)
        record["destroyed_per_retention_schedule"] = destroyed

        full_text_url = None
        if full_text.strip():
            r3 = upload_item(identifier, "extracted-text.txt", full_text.encode("utf-8"), {}, access_key, secret_key)
            r3.raise_for_status()
            time.sleep(delay)
            full_text_url = f"https://archive.org/download/{identifier}/extracted-text.txt"

        referents_entry = {
            "epav_token": token,
            "contract_number": contract_number,
            "archive_url": record["archive_url"],
            "full_text_url": full_text_url,
            "destroyed_per_retention_schedule": destroyed,
            "pages": page_records,
        }

        if destroyed:
            # A records-destruction stub, not a real contract -- there's no
            # real content here for the expensive passes to read.
            referents_out.write(json.dumps(referents_entry) + "\n")
            referents_out.flush()
            record["archived_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            return record

        try:
            ledger_rows = contract_extract.extract_contract_rows(full_text, identifier)
            if ledger_rows:
                with CONTRACT_LEDGER.open("a") as cl:
                    for lr in ledger_rows:
                        lr["epav_token"] = token
                        lr["contract_number"] = contract_number
                        lr["archive_url"] = record["archive_url"]
                        cl.write(json.dumps(lr) + "\n")
        except Exception as e:  # noqa: BLE001 - additive, never blocks archiving
            print(f"    contract_extract on {token} FAILED: {e}", file=sys.stderr)

        novel_text = "\n\n".join(novel_pages)
        eo_workdir = EOWORK / identifier
        result = read_document(novel_text, identifier, eo_workdir) if novel_pages else None
        if result:
            for key, fname in (("main_path", "eoreader7.json"), ("fold_path", "eoreader7.fold.json"), ("log_path", "eoreader7.log.json")):
                p = result[key]
                if p.exists():
                    r2 = upload_item(identifier, fname, p.read_bytes(), {}, access_key, secret_key)
                    r2.raise_for_status()
                    time.sleep(delay)
            summary = summarize_referents(result)
            referents_entry.update(summary)
            giver = result["main"].get("declared", {}).get("giver") or "reader:eoreader7-cli"
            company_index.append_assertions(ASSERTIONS, summary["hyperedges"], page_context, giver)

            try:
                verdict = surveillance_flag.flag_document(result["main"], title=desc or contract_number, text=full_text, file=contract_number)
                verdict["epav_token"], verdict["archive_url"] = token, record["archive_url"]
                with SURVEILLANCE_FLAGS.open("a") as sf:
                    sf.write(json.dumps(verdict) + "\n")
                if verdict["label"] == "surveillance":
                    print(f"    SURVEILLANCE FLAG: {contract_number} score={verdict['score']}", file=sys.stderr)
            except Exception as e:  # noqa: BLE001 - additive, never blocks archiving
                print(f"    surveillance_flag FAILED: {e}", file=sys.stderr)

        referents_out.write(json.dumps(referents_entry) + "\n")
        referents_out.flush()
    except Exception as e:  # noqa: BLE001 - the eoreader7 pass is additive; never blocks archiving
        print(f"    eoreader7 pass on {token} FAILED: {e}", file=sys.stderr)

    record["archived_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return record


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="stop after this many NEW documents")
    ap.add_argument("--departments", default=None, help="comma-separated subset of DEPARTMENTS (default: all)")
    ap.add_argument("--delay", type=float, default=0.5, help="seconds between archive.org uploads / ePAV requests")
    ap.add_argument(
        "--exhaustive", action="store_true",
        help="measure past the site's 1000-row-per-search cap using EPAV.iter_department_exhaustive() "
             "(nested Contracting Party / Description / Contract Number probes) instead of one plain "
             "search per department -- needed for a department whose true count exceeds 1000",
    )
    args = ap.parse_args()

    load_env_file(ROOT / ".env")
    access_key = os.environ.get("ARCHIVE_ORG_ACCESS_KEY")
    secret_key = os.environ.get("ARCHIVE_ORG_SECRET_KEY")
    if not access_key or not secret_key:
        sys.exit("Set ARCHIVE_ORG_ACCESS_KEY and ARCHIVE_ORG_SECRET_KEY (env or .env)")

    EPAV_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    api = EPAV(delay=args.delay)
    departments = [d.strip() for d in args.departments.split(",")] if args.departments else DEPARTMENTS
    documents_read = 0
    page_index = boilerplate.load_index(PAGE_SIGHTINGS)

    def fold_and_lint_now() -> None:
        fold_pipeline.fold_and_lint_now(
            assertions_path=ASSERTIONS, companies_path=COMPANIES, lint_log_path=LINT_LOG,
            eowork_dir=EOWORK, corroborate_mjs=CORROBORATE_MJS, corroborated_path=CORROBORATED,
            corroborate_budget=CORROBORATE_BUDGET,
        )

    def iter_rows():
        if args.exhaustive:
            seen: set[str] = set()
            for dept in departments:
                for row in api.iter_department_exhaustive(dept):
                    if row["token"] in seen:
                        continue
                    seen.add(row["token"])
                    row.setdefault("source_department_query", dept)
                    yield row
        else:
            yield from api.iter_all(departments=departments)

    done = 0
    with EPAV_MANIFEST.open("a") as out, REFERENTS.open("a") as referents_out:
        for row in iter_rows():
            if already_archived(row["token"]):
                continue
            try:
                before_reads = documents_read
                record = archive_epav_document(api, row, access_key, secret_key, args.delay, referents_out, page_index)
            except Exception as e:  # noqa: BLE001 - log and keep going
                print(f"  document {row['token']} FAILED: {e}", file=sys.stderr)
                continue
            out.write(json.dumps(record) + "\n")
            out.flush()
            done += 1
            documents_read += 1
            tag = "DESTROYED-STUB" if record.get("destroyed_per_retention_schedule") else "archived"
            print(f"  {tag} {record['contract_number']} ({record['epav_token']}) — {record['department']}", file=sys.stderr)
            if documents_read // LINT_EVERY > before_reads // LINT_EVERY:
                fold_and_lint_now()
            if args.limit and done >= args.limit:
                break

    fold_and_lint_now()
    print(f"done: {done} new document(s) archived -> {EPAV_MANIFEST}", file=sys.stderr)


if __name__ == "__main__":
    main()
