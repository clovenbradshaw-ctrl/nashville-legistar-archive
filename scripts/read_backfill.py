"""Slow-lane read backfill: the expensive eoreader7 reads, runs, and
surveillance/auth flags for contracts that the FAST sweep already acquired
(downloaded + text-extracted + queued) without doing the deep read.

Marker: a contract is read when data/deployed/<identifier>/eoreader7.json
exists. The sweep lane therefore floods the queue quickly (its activity is
visible in the feed as 'fetched'), and this lane drains the reads over time
(its activity is visible as 'read'), each lane at the pace it can sustain.
Idempotent and resumable: already-read contracts are skipped.

Usage:
    .venv/bin/python scripts/read_backfill.py --workers 4 --limit 300
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import boilerplate  # noqa: E402
import company_index  # noqa: E402
import epav_pipeline  # noqa: E402
import live  # noqa: E402
import routing  # noqa: E402
import surveillance_flag  # noqa: E402
from eoreader_pass import read_document, summarize_referents  # noqa: E402
from extract_text import extract_pdf_pages  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
REFERENTS = ROOT / "data" / "referents.jsonl"


def candidates() -> list[dict]:
    if not epav_pipeline.EPAV_FETCHED.exists():
        return []
    out = []
    with open(epav_pipeline.EPAV_FETCHED) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if rec.get("destroyed_per_retention_schedule"):
                continue
            identifier = rec.get("identifier")
            # already read?
            if identifier and (ROOT / "data" / "deployed" / identifier / "eoreader7.json").exists():
                continue
            out.append(rec)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    cands = candidates()
    if args.limit:
        cands = cands[: args.limit]
    if not cands:
        print("read_backfill: nothing to read (all queued contracts already have reads)", file=sys.stderr)
        return

    lock = threading.Lock()
    done = 0

    def process(rec: dict):
        nonlocal done
        token = rec["epav_token"]
        identifier = rec["identifier"]
        txt_path = ROOT / "data" / "deployed" / identifier / "extracted-text.txt"
        text = ""
        if txt_path.is_file():
            text = txt_path.read_text(errors="replace")
        # The sweep lane extracts text-layer only (no OCR). A contract whose
        # staged text is nearly empty is almost certainly a scan: re-extract
        # from the cached pdf WITH OCR here, and re-promote the real text.
        if len(text.strip()) < 200:
            pdf = epav_pipeline.resolve_local(rec, "local_pdf")
            if pdf is not None and pdf.is_file():
                pages = extract_pdf_pages(pdf.read_bytes(), ocr=True)
                text = "\n\n".join(pages)
                text = text or ""
                txt_path.parent.mkdir(parents=True, exist_ok=True)
                txt_path.write_text(text, encoding="utf-8")
                routing.promote_small_artifacts(identifier, text=text,
                                                record={"epav_token": token,
                                                        "contract_number": rec.get("contract_number"),
                                                        "department": rec.get("department")})
        if not text.strip():
            live.event("read-failed", epav_token=token, department=rec.get("department"), reason="no text")
            return
        eo_workdir = epav_pipeline.EOWORK / identifier
        result = read_document(text, identifier, eo_workdir)
        if not result:
            live.event("read-failed", epav_token=token, department=rec.get("department"))
            return
        try:
            routing.promote_small_artifacts(identifier, reads_dir=eo_workdir,
                                            record={"epav_token": token,
                                                    "contract_number": rec.get("contract_number"),
                                                    "department": rec.get("department")})
        except Exception as e:  # noqa: BLE001 - additive
            print(f"    promote reads {token} FAILED: {e}", file=sys.stderr)

        page_context = {
            "doc_key": f"epav:{token}", "epav_token": token,
            "contract_number": rec.get("contract_number"),
            "archive_url": rec.get("archive_url"), "intro_date": None,
        }
        summary = summarize_referents(result)
        giver = result["main"].get("declared", {}).get("giver") or "reader:eoreader7-cli"
        company_index.append_assertions(epav_pipeline.ASSERTIONS, summary["hyperedges"], page_context, giver)
        entry = {
            "epav_token": token, "contract_number": rec.get("contract_number"),
            "archive_url": rec.get("archive_url"),
            "full_text_url": f"https://archive.org/download/{identifier}/extracted-text.txt",
            **summary,
        }
        with lock:
            with REFERENTS.open("a") as rf:
                rf.write(json.dumps(entry) + "\n")
            try:
                verdict = surveillance_flag.flag_document(result["main"], title=rec.get("description") or rec.get("contract_number"),
                                                          text=text, file=rec.get("contract_number"))
                verdict["epav_token"], verdict["archive_url"] = token, rec.get("archive_url")
                with epav_pipeline.SURVEILLANCE_FLAGS.open("a") as sf:
                    sf.write(json.dumps(verdict) + "\n")
            except Exception as e:  # noqa: BLE001
                pass
            done += 1
        live.event("read", epav_token=token, contract_number=rec.get("contract_number"),
                   department=rec.get("department"))
        print(f"  read {rec.get('contract_number')} ({token}) — {rec.get('department')}", file=sys.stderr)

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        for _ in pool.map(process, cands):
            pass

    print(f"read_backfill: {done}/{len(cands)} read(s) finished", file=sys.stderr)
    try:
        import push_small_files
        push_small_files.main(["run"])
    except Exception as e:  # noqa: BLE001
        print(f"  push_small_files FAILED: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()