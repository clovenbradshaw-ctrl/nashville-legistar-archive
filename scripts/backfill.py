"""Archive every Metro Nashville Legistar matter (legislation) and its
attachments (contracts, MOUs, amendments, exhibits) to archive.org, and
append one pointer record per matter to data/manifest.jsonl.

Usage:
  ARCHIVE_ORG_ACCESS_KEY=... ARCHIVE_ORG_SECRET_KEY=... \\
    python scripts/backfill.py [--limit N] [--client nashville]

Idempotent: matter ids already present in the manifest are skipped, so an
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
from legistar_client import Legistar
from archive_upload import upload_item
from extract_text import extract_text, extract_pdf_pages, clean_pdf_bytes
from eoreader_pass import read_document, summarize_referents
import company_index
import boilerplate
import surveillance_flag
import contract_extract
import crossref
from epav_client import EPAV
import fold_pipeline
from fold_pipeline import load_env_file, sha256_of

_epav_api = EPAV(delay=0.3)  # shared, lazy-safe: only ever hit for a best-effort crossref lookup

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "data" / "manifest.jsonl"
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
LINT_EVERY = 10  # run the reasoning lint every N successfully-read attachments
CORROBORATE_BUDGET = 30  # model-ask budget per corroboration pass -- a cost bound, not an accuracy one


def already_archived(matter_id: int) -> bool:
    if not MANIFEST.exists():
        return False
    with MANIFEST.open() as fh:
        for line in fh:
            if f'"matter_id": {matter_id}' in line or f'"matter_id":{matter_id}' in line:
                return True
    return False


def archive_matter(api: Legistar, raw: dict, access_key: str, secret_key: str, delay: float, referents_out, page_index: dict) -> dict:
    matter_id = raw["MatterId"]
    guid = raw.get("MatterGuid") or ""
    file_no = raw.get("MatterFile") or str(matter_id)
    title = raw.get("MatterTitle") or file_no
    legistar_url = api.detail_url(matter_id, guid)
    intro_date = (raw.get("MatterIntroDate") or "")[:10] or None

    matter_identifier = f"nashville-legistar-matter-{matter_id}"
    body = json.dumps(raw, indent=2).encode("utf-8")
    resp = upload_item(
        matter_identifier,
        "matter.json",
        body,
        {
            "title": f"Metro Nashville Legistar {file_no}: {title}"[:2000],
            "description": f"Legislative record for Nashville Legistar matter {file_no}, archived from {legistar_url}",
            "subject": "Metro Nashville;Legistar;municipal legislation",
            "date": intro_date,
            "creator": "Metro Nashville Government (via Legistar)",
            "source": legistar_url,
            "external-identifier": f"urn:legistar-nashville:matter:{matter_id}",
        },
        access_key,
        secret_key,
    )
    resp.raise_for_status()
    time.sleep(delay)

    record = {
        "matter_id": matter_id,
        "matter_guid": guid,
        "matter_file": file_no,
        "matter_type": raw.get("MatterTypeName"),
        "matter_title": title,
        "matter_body": raw.get("MatterBodyName"),
        "intro_date": intro_date,
        "legistar_url": legistar_url,
        "matter_archive_id": matter_identifier,
        "matter_archive_url": f"https://archive.org/details/{matter_identifier}",
        "attachments": [],
    }

    for att in api.attachments(matter_id) or []:
        data = api.attachment_bytes(att)
        if not data:
            continue
        att_id = att.get("MatterAttachmentId")
        att_name = att.get("MatterAttachmentName") or f"attachment-{att_id}"
        filename = att.get("MatterAttachmentFileName") or f"{att_id}.pdf"
        att_identifier = f"nashville-legistar-att-{att_id}"
        if filename.lower().endswith(".pdf"):
            data = clean_pdf_bytes(data)  # archive.org's own PDF checker rejects some real, valid PDFs otherwise
        resp = upload_item(
            att_identifier,
            filename,
            data,
            {
                "title": f"Metro Nashville Legistar {file_no} — {att_name}"[:2000],
                "description": f"Attachment '{att_name}' on Nashville Legistar matter {file_no} ({title})",
                "subject": "Metro Nashville;Legistar;municipal legislation;contracts",
                "date": intro_date,
                "creator": "Metro Nashville Government (via Legistar)",
                "source": att.get("MatterAttachmentHyperlink") or legistar_url,
                "external-identifier": f"urn:legistar-nashville:attachment:{att_id}",
            },
            access_key,
            secret_key,
        )
        resp.raise_for_status()
        time.sleep(delay)
        att_record = {
            "attachment_id": att_id,
            "attachment_name": att_name,
            "source_url": att.get("MatterAttachmentHyperlink"),
            "archive_id": att_identifier,
            "archive_url": f"https://archive.org/details/{att_identifier}",
            "sha256": sha256_of(data),
            "bytes": len(data),
        }
        record["attachments"].append(att_record)

        # eoreader7 pass: split into pages, skip pages already seen verbatim
        # elsewhere in the corpus (boilerplate -- a shadow pointer instead
        # of a full re-read), read only the novel pages, upload the full
        # eoreader7 output alongside the source file, and append its
        # hyperedge assertions to the corpus-wide log. Best-effort throughout.
        try:
            page_context = {
                "matter_id": matter_id, "attachment_id": att_id,
                "archive_url": att_record["archive_url"], "intro_date": intro_date,
            }
            if filename.lower().endswith(".pdf"):
                pages = extract_pdf_pages(data)
            else:
                pages = [extract_text(filename, data)]
            novel_pages, page_records = boilerplate.classify_pages(pages, page_index, page_context)
            for rec in page_records:
                boilerplate.append_sighting(PAGE_SIGHTINGS, rec["hash"], page_context)

            # The FULL extracted text (every page, including shadowed ones)
            # is archived and pointed to regardless of which pages get the
            # expensive eoreader7 (holograph) parse below -- it's never
            # lost, so a deeper read can always be run on it later.
            full_text = "\n\n".join(pages)
            full_text_url = None
            if full_text.strip():
                r3 = upload_item(att_identifier, "extracted-text.txt", full_text.encode("utf-8"), {}, access_key, secret_key)
                r3.raise_for_status()
                time.sleep(delay)
                full_text_url = f"https://archive.org/download/{att_identifier}/extracted-text.txt"

            # Deterministic, byte-addressed clause/amount/date/party rows --
            # no model in the loop, safe to run even when the eoreader7 pass
            # below fails or is skipped.
            try:
                ledger_rows = contract_extract.extract_contract_rows(full_text, att_identifier)
                if ledger_rows:
                    with CONTRACT_LEDGER.open("a") as cl:
                        for row in ledger_rows:
                            row["matter_id"] = matter_id
                            row["attachment_id"] = att_id
                            row["archive_url"] = att_record["archive_url"]
                            cl.write(json.dumps(row) + "\n")
            except Exception as e:  # noqa: BLE001 - additive, never blocks archiving
                print(f"    contract_extract on attachment {att_id} FAILED: {e}", file=sys.stderr)

            novel_text = "\n\n".join(novel_pages)
            eo_workdir = EOWORK / att_identifier
            result = read_document(novel_text, att_identifier, eo_workdir) if novel_pages else None
            referents_entry = {
                "matter_id": matter_id,
                "attachment_id": att_id,
                "archive_url": att_record["archive_url"],
                "full_text_url": full_text_url,
                "pages": page_records,
            }
            if result:
                for key, fname in (("main_path", "eoreader7.json"), ("fold_path", "eoreader7.fold.json"), ("log_path", "eoreader7.log.json")):
                    p = result[key]
                    if p.exists():
                        r2 = upload_item(att_identifier, fname, p.read_bytes(), {}, access_key, secret_key)
                        r2.raise_for_status()
                        time.sleep(delay)
                summary = summarize_referents(result)
                referents_entry.update(summary)
                giver = result["main"].get("declared", {}).get("giver") or "reader:eoreader7-cli"
                company_index.append_assertions(ASSERTIONS, summary["hyperedges"], page_context, giver)

                # Best-effort reverse pointer into the ePAV contract
                # database: re-derive this attachment's own distinct
                # organization surfaces (same test append_assertions just
                # used) and look each up, capped at 5 -- a resource bound,
                # never an accuracy one. See crossref.py.
                try:
                    orgs = set()
                    for edge in summary["hyperedges"]:
                        for key in ("end1", "end2"):
                            surface = edge.get(f"{key}_surface")
                            ref = edge.get(f"{key}_ref")
                            if surface and company_index.looks_like_org(surface, ref):
                                orgs.add(company_index.canonical_org(surface, ref))
                    epav_matches = {}
                    for org in list(orgs)[:5]:
                        m = crossref.epav_matches_for(_epav_api, org)
                        if m:
                            epav_matches[org] = m
                    if epav_matches:
                        referents_entry["epav_matches"] = epav_matches
                except Exception as e:  # noqa: BLE001 - additive, never blocks archiving
                    print(f"    epav crossref FAILED: {e}", file=sys.stderr)

                # Surveillance flag: the FULL uncapped surface set, not the
                # capped referents.jsonl summary above -- measured directly
                # that the cap silently drops the rare terms ("surveillance",
                # "video") this check exists to find. Contracts flagged here
                # are exactly the ones most at risk of disappearing from the
                # public record and most in need of being findable.
                try:
                    verdict = surveillance_flag.flag_document(result["main"], title=title, text=full_text, file=file_no)
                    verdict["matter_id"], verdict["attachment_id"], verdict["archive_url"] = matter_id, att_id, att_record["archive_url"]
                    with SURVEILLANCE_FLAGS.open("a") as sf:
                        sf.write(json.dumps(verdict) + "\n")
                    if verdict["label"] == "surveillance":
                        print(f"    SURVEILLANCE FLAG: {file_no} score={verdict['score']}", file=sys.stderr)
                except Exception as e:  # noqa: BLE001 - additive, never blocks archiving
                    print(f"    surveillance_flag FAILED: {e}", file=sys.stderr)
            referents_out.write(json.dumps(referents_entry) + "\n")
            referents_out.flush()
        except Exception as e:  # noqa: BLE001 - the eoreader7 pass is additive; never blocks archiving
            print(f"    eoreader7 pass on attachment {att_id} FAILED: {e}", file=sys.stderr)

    record["archived_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return record


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="stop after this many NEW matters")
    ap.add_argument("--client", default="nashville")
    ap.add_argument("--delay", type=float, default=0.5, help="seconds between archive.org uploads")
    args = ap.parse_args()

    load_env_file(ROOT / ".env")
    access_key = os.environ.get("ARCHIVE_ORG_ACCESS_KEY")
    secret_key = os.environ.get("ARCHIVE_ORG_SECRET_KEY")
    if not access_key or not secret_key:
        sys.exit("Set ARCHIVE_ORG_ACCESS_KEY and ARCHIVE_ORG_SECRET_KEY (env or .env)")

    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    api = Legistar(args.client)
    attachments_read = 0
    page_index = boilerplate.load_index(PAGE_SIGHTINGS)  # folded once; updated in memory as the run proceeds

    def fold_and_lint_now() -> None:
        fold_pipeline.fold_and_lint_now(
            assertions_path=ASSERTIONS, companies_path=COMPANIES, lint_log_path=LINT_LOG,
            eowork_dir=EOWORK, corroborate_mjs=CORROBORATE_MJS, corroborated_path=CORROBORATED,
            corroborate_budget=CORROBORATE_BUDGET,
        )

    done = 0
    with MANIFEST.open("a") as out, REFERENTS.open("a") as referents_out:
        for raw in api.matters():
            matter_id = raw["MatterId"]
            if already_archived(matter_id):
                continue
            try:
                before_reads = attachments_read
                record = archive_matter(api, raw, access_key, secret_key, args.delay, referents_out, page_index)
            except Exception as e:  # noqa: BLE001 - log and keep going
                print(f"  matter {matter_id} FAILED: {e}", file=sys.stderr)
                continue
            out.write(json.dumps(record) + "\n")
            out.flush()
            done += 1
            attachments_read += len(record["attachments"])
            print(f"  archived matter {matter_id} ({record['matter_file']}) — {len(record['attachments'])} attachment(s)", file=sys.stderr)
            if attachments_read // LINT_EVERY > before_reads // LINT_EVERY:
                fold_and_lint_now()
            if args.limit and done >= args.limit:
                break

    fold_and_lint_now()
    print(f"done: {done} new matter(s) archived -> {MANIFEST}", file=sys.stderr)


if __name__ == "__main__":
    main()
