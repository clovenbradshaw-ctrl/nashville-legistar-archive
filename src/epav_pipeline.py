"""Two-phase ePAV document processing: a local-only fetch phase that never
touches archive.org, and a separate upload phase that does nothing else.

Motivation, measured this session: doing fetch+process+upload together in
one pass against a fresh archive.org credential sustained a ~65% 503
'Slow Down' failure rate over two hours -- not a transient warm-up effect,
a real throughput ceiling. Nashville's own ePAV portal (documents.nashville
.gov), by contrast, was reliable all session. Splitting the two lets the
fast, reliable side run to completion immediately, and the slow, rate-
limited side drain the resulting queue at whatever pace archive.org
actually sustains -- repeatedly, safely, on a schedule (see
scripts/upload_pending.py), rather than racing the whole batch through a
single one-shot run that loses most of its attempts to throttling.

archive.org item identifiers are deterministic (nashville-epav-contract-
<token>), so archive_url/full_text_url are computed and written into
assertions.jsonl/surveillance-flags.jsonl/contract-ledger.jsonl/
epav-fetched.jsonl during the LOCAL phase, before the real upload has
happened -- those pointers are already correct, they just don't resolve
until upload_now() actually pushes the bytes.

PORTABILITY: local cache paths (local_pdf/local_text/local_eoreader7) are
stored RELATIVE to the repo root so the fetched ledger never carries
machine-specific absolute paths -- it is committed to GitHub and read on
whichever machine runs the fetch/upload phases (see resolve_local)."""

from __future__ import annotations

import hashlib
import json
import sys
import time
from pathlib import Path

from epav_client import EPAV, is_destruction_notice
from archive_upload import upload_item
from extract_text import extract_pdf_pages, clean_pdf_bytes
from eoreader_pass import read_document, summarize_referents
import company_index
import boilerplate
import surveillance_flag
import contract_extract
import crossref
import routing


def resolve_local(rec: dict, key: str) -> Path | None:
    """Resolve a stored relative (or absolute) local cache path to an actual
    path on this machine. A relative path is made against the repo root; an
    absolute path that does not exist here (e.g. a stale row from another
    machine) resolves to a non-existent path the caller must treat as
    missing, not as a silent home."""
    raw = rec.get(key) or ""
    if not raw:
        return None
    p = Path(raw)
    return p if p.is_absolute() else Path(ROOT, p)


def rel(p: Path) -> str:
    return str(p.relative_to(ROOT)) if p.is_absolute() and p.is_relative_to(ROOT) else str(p)

ROOT = Path(__file__).resolve().parent.parent
LOCAL_CACHE = ROOT / "data" / ".epav-local"
EPAV_FETCHED = ROOT / "data" / "epav-fetched.jsonl"
REFERENTS = ROOT / "data" / "referents.jsonl"
ASSERTIONS = ROOT / "data" / "assertions.jsonl"
PAGE_SIGHTINGS = ROOT / "data" / "page-sightings.jsonl"
SURVEILLANCE_FLAGS = ROOT / "data" / "surveillance-flags.jsonl"
CONTRACT_LEDGER = ROOT / "data" / "contract-ledger.jsonl"
EOWORK = ROOT / "data" / ".eowork"


def already_fetched(token: str) -> bool:
    if not EPAV_FETCHED.exists():
        return False
    with EPAV_FETCHED.open() as fh:
        for line in fh:
            if f'"epav_token": "{token}"' in line:
                return True
    return False


def fetch_local(api: EPAV, row: dict, legistar_api, page_index: dict, *, referents_out=None, deep_reads: bool = True) -> dict:
    """Everything except the actual archive.org upload. Returns the fetched
    record (also appended to EPAV_FETCHED)."""
    token = row["token"]
    contract_number = row["contract_number"]
    party = row["contracting_party"]
    dept = row["department"]
    desc = row["description"]
    detail_url = api.detail_url(token)

    data = api.fetch_document(token)
    if not data:
        raise RuntimeError(f"failed to fetch document for token {token}")
    data = clean_pdf_bytes(data)

    identifier = f"nashville-epav-contract-{token}"
    archive_url = f"https://archive.org/details/{identifier}"

    cache_dir = LOCAL_CACHE / token
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / "source.pdf").write_bytes(data)

    page_context = {
        "doc_key": f"epav:{token}",
        "epav_token": token,
        "contract_number": contract_number,
        "archive_url": archive_url,
        "intro_date": None,
    }
    pages = extract_pdf_pages(data)
    novel_pages, page_records = boilerplate.classify_pages(pages, page_index, page_context)
    for rec in page_records:
        boilerplate.append_sighting(PAGE_SIGHTINGS, rec["hash"], page_context)

    full_text = "\n\n".join(pages)
    destroyed = is_destruction_notice(full_text)
    (cache_dir / "extracted-text.txt").write_text(full_text)
    full_text_url = f"https://archive.org/download/{identifier}/extracted-text.txt" if full_text.strip() else None

    referents_entry = {
        "epav_token": token,
        "contract_number": contract_number,
        "archive_url": archive_url,
        "full_text_url": full_text_url,
        "destroyed_per_retention_schedule": destroyed,
        "pages": page_records,
    }

    fetched = {
        "epav_token": token,
        "contract_number": contract_number,
        "status": row["status"],
        "contracting_party": party,
        "department": dept,
        "description": desc,
        "expiration_date": row["expiration_date"],
        "source_department_query": row.get("source_department_query"),
        "epav_url": detail_url,
        "identifier": identifier,
        "archive_url": archive_url,
        "destroyed_per_retention_schedule": destroyed,
"local_pdf": rel(cache_dir / "source.pdf"),
        "local_text": rel(cache_dir / "extracted-text.txt"),
        "local_eoreader7": None,
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    if destroyed:
        try:
            routing.promote_small_artifacts(
                identifier,
                text=full_text,
                pdf_bytes=len(data),
                record={
                    "epav_token": token, "contract_number": contract_number,
                    "department": dept, "status": row.get("status"),
                    "expiration_date": row.get("expiration_date"),
                    "description": desc,
                    "source_department_query": row.get("source_department_query"),
                },
            )
        except Exception as e:  # noqa: BLE001 - additive, never blocks the fetch
            print(f"    promote_small_artifacts (stub) on {token} FAILED: {e}", file=sys.stderr)
        if referents_out is not None:
            referents_out.write(json.dumps(referents_entry) + "\n")
            referents_out.flush()
        EPAV_FETCHED.parent.mkdir(parents=True, exist_ok=True)
        with EPAV_FETCHED.open("a") as f:
            f.write(json.dumps(fetched) + "\n")
        return fetched

    try:
        ledger_rows = contract_extract.extract_contract_rows(full_text, identifier)
        if ledger_rows:
            with CONTRACT_LEDGER.open("a") as cl:
                for lr in ledger_rows:
                    lr["epav_token"] = token
                    lr["contract_number"] = contract_number
                    lr["archive_url"] = archive_url
                    cl.write(json.dumps(lr) + "\n")
    except Exception as e:  # noqa: BLE001 - additive, never blocks the fetch
        print(f"    contract_extract on {token} FAILED: {e}", file=sys.stderr)

    # Small artifacts take the GitHub branch (two-tier routing, see
    # routing.py): extracted text + eoreader7 reads are promoted into the
    # committed data/deployed/ tree now; only the PDF later goes to
    # archive.org. This is the durable small-file home the upload phase no
    # longer uploads to archive.org.
    try:
        reads_dir = cache_dir if (deep_reads and fetched.get("local_eoreader7")) else None
        routing.promote_small_artifacts(
            identifier,
            text=full_text,
            reads_dir=reads_dir,
            pdf_bytes=len(data),
            record={
                "epav_token": token,
                "contract_number": contract_number,
                "department": dept,
                "status": row.get("status"),
                "expiration_date": row.get("expiration_date"),
                "description": desc,
                "source_department_query": row.get("source_department_query"),
            },
        )
    except Exception as e:  # noqa: BLE001 - additive, never blocks the fetch
        print(f"    promote_small_artifacts on {token} FAILED: {e}", file=sys.stderr)

    if deep_reads:
        novel_text = "\n\n".join(novel_pages)
        eo_workdir = EOWORK / identifier
        result = read_document(novel_text, identifier, eo_workdir) if novel_pages else None
        if result:
            for key, ext in (("main_path", "eoreader7.json"), ("fold_path", "eoreader7.fold.json"), ("log_path", "eoreader7.log.json")):
                p = result[key]
                if p.exists():
                    (cache_dir / ext).write_bytes(p.read_bytes())
            fetched["local_eoreader7"] = rel(cache_dir)
            summary = summarize_referents(result)
            referents_entry.update(summary)
            giver = result["main"].get("declared", {}).get("giver") or "reader:eoreader7-cli"
            company_index.append_assertions(ASSERTIONS, summary["hyperedges"], page_context, giver)

            try:
                legistar_matches = crossref.legistar_matches_for(legistar_api, party) if legistar_api else []
            except Exception:  # noqa: BLE001 - best-effort
                legistar_matches = []
            fetched["legistar_matches"] = legistar_matches

            try:
                verdict = surveillance_flag.flag_document(result["main"], title=desc or contract_number, text=full_text, file=contract_number)
                verdict["epav_token"], verdict["archive_url"] = token, archive_url
                with SURVEILLANCE_FLAGS.open("a") as sf:
                    sf.write(json.dumps(verdict) + "\n")
                if verdict["label"] == "surveillance":
                    print(f"    SURVEILLANCE FLAG: {contract_number} score={verdict['score']}", file=sys.stderr)
            except Exception as e:  # noqa: BLE001
                print(f"    surveillance_flag FAILED: {e}", file=sys.stderr)

    if referents_out is not None:
        referents_out.write(json.dumps(referents_entry) + "\n")
        referents_out.flush()

    EPAV_FETCHED.parent.mkdir(parents=True, exist_ok=True)
    with EPAV_FETCHED.open("a") as f:
        f.write(json.dumps(fetched) + "\n")
    return fetched


def upload_now(fetched: dict, access_key: str, secret_key: str, delay: float) -> dict:
    """Reads the locally-cached files for one fetch_local() record and
    performs the real archive.org uploads. Returns the final manifest
    record on success; raises on failure (retried internally by
    upload_item(), then surfaced to the caller)."""
    identifier = fetched["identifier"]
    token = fetched["epav_token"]
    contract_number = fetched["contract_number"]
    party = fetched["contracting_party"]
    detail_url = fetched["epav_url"]
    pdf_path = resolve_local(fetched, "local_pdf")
    if pdf_path is None or not pdf_path.is_file():
        raise RuntimeError(f"local pdf for {token} is not present on this machine ({pdf_path})")

    pdf_bytes = pdf_path.read_bytes()
    title_bits = f"{contract_number} — {party}" if party else contract_number
    resp = upload_item(
        identifier,
        f"{token}.pdf",
        pdf_bytes,
        {
            "title": f"Metro Nashville Contract {title_bits}"[:2000],
            "description": f"{fetched.get('description') or 'Contract'} — {fetched.get('department') or ''} — Metro Nashville contract {contract_number}, archived from {detail_url}",
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

    # Two-tier routing: the PDF is the only thing archive.org holds. The
    # extracted text + eoreader7 reads were promoted to data/deployed/ at
    # fetch time (routing.promote_small_artifacts) and go to GitHub.
    # NOTE: the caller must append this record to the manifest BEFORE calling
    # routing.delete_large_after_upload -- the deletion invariant is "local
    # copy dropped only after the durable home is on the record".

    record = {
        "epav_token": token,
        "contract_number": contract_number,
        "status": fetched["status"],
        "contracting_party": party,
        "department": fetched["department"],
        "description": fetched.get("description"),
        "expiration_date": fetched.get("expiration_date"),
        "source_department_query": fetched.get("source_department_query"),
        "epav_url": detail_url,
        "legistar_matches": fetched.get("legistar_matches", []),
        "archive_id": identifier,
        "archive_url": fetched["archive_url"],
        "sha256": hashlib.sha256(pdf_bytes).hexdigest(),
        "bytes": len(pdf_bytes),
        "destroyed_per_retention_schedule": fetched.get("destroyed_per_retention_schedule", False),
        "archived_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    return record
