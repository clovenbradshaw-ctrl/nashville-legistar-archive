#!/usr/bin/env python3
"""Digest county PDFs: keep the text and the proof, not the bytes.

An agenda packet is mostly page images. What we want from it is its text, a fingerprint, and a way
back to the original. So for each PDF this records:

    pages, text_pages, scan_pages   how many pages carry a text layer and how many are scans
    text                            the text layer, gzip-compressed at <STORE>/<slug>/text/<sha[:2]>/<sha>.txt.gz
    sha256, bytes, origin url       already in the county's manifest: the means to verify or re-fetch

Scans have no text layer; they are marked `needs_ocr` and read later by re-fetching the original
(the OCR worker checks the sha256 on the way, which also catches a file overwritten at the same URL).

The original is removed only with --drop-originals, and only after the text file has been read back
and its character count matches what was extracted. Nothing is deleted on a failed read, an
unreadable PDF, or a PDF with zero pages. Results are written as operator events (DEF on the
document), so the log shows what was digested and when.

    python3 county_digest.py --county anderson [--drop-originals] [--limit N]
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import counties as C
import eo_log

STORE = Path(os.environ.get("COUNTY_STORE") or C.COUNTIES_DIR)
TEXT_PAGE_MIN_CHARS = 20          # fewer characters than this on a page means it is an image, not text


def _pymupdf():
    for name in ("pymupdf", "fitz"):
        try:
            mod = __import__(name)
            try:
                mod.TOOLS.mupdf_display_errors(False)
            except Exception:
                pass
            return mod
        except ImportError:
            continue
    return None


def available() -> bool:
    return _pymupdf() is not None


def digest_pdf(data: bytes) -> dict | None:
    """Return {pages, text_pages, scan_pages, chars, text} or None if this is not a readable PDF."""
    mu = _pymupdf()
    if mu is None or not data.startswith(b"%PDF"):
        return None
    try:
        doc = mu.open(stream=data, filetype="pdf")
        texts = [p.get_text() for p in doc]
    except Exception:
        return None
    n = len(texts)
    if n == 0:
        return None
    tp = sum(1 for t in texts if len(t.strip()) >= TEXT_PAGE_MIN_CHARS)
    text = "\n\f\n".join(texts)
    return {"pages": n, "text_pages": tp, "scan_pages": n - tp, "chars": len(text), "text": text}


def text_path(slug: str, sha: str) -> Path:
    return STORE / slug / "text" / sha[:2] / f"{sha}.txt.gz"


def write_text(slug: str, sha: str, text: str) -> Path:
    p = text_path(slug, sha)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    with gzip.open(tmp, "wt", encoding="utf-8", compresslevel=6) as f:
        f.write(text)
    tmp.replace(p)
    return p


def verified(path: Path, chars: int) -> bool:
    """Read the file back and confirm it holds exactly what we extracted."""
    try:
        with gzip.open(path, "rt", encoding="utf-8") as f:
            return len(f.read()) == chars
    except Exception:
        return False


def state_of(d: dict) -> str:
    if d["scan_pages"] == 0:
        return "text"
    return "needs_ocr" if d["text_pages"] == 0 else "mixed"


def digest_row(reg: dict, row: dict, drop: bool) -> dict | None:
    """Digest one manifest row's original in place. Returns the recorded digest or None if skipped."""
    f = row.get("file")
    if not f or not f.lower().endswith(".pdf"):
        return None
    p = STORE / f
    if not p.is_file():
        return None
    sha = row.get("sha256") or hashlib.sha256(p.read_bytes()).hexdigest()
    d = digest_pdf(p.read_bytes())
    if d is None:
        return None
    tp = write_text(reg["slug"], sha, d["text"])
    ok = verified(tp, d["chars"])
    dropped = False
    # an original is a pointer to the online version, so it may go only once the record that makes
    # the pointer trustworthy exists: the response headers and chain it was fetched through
    if drop and ok and row.get("provenance"):
        p.unlink()
        dropped = True
    rec = {"sha256": sha, "pages": d["pages"], "text_pages": d["text_pages"], "scan_pages": d["scan_pages"],
           "chars": d["chars"], "state": state_of(d), "text_file": str(tp.relative_to(STORE)),
           "text_bytes": tp.stat().st_size, "original_bytes": row.get("bytes"), "original_dropped": dropped,
           "text_verified": ok}
    eo_log.emit(reg["slug"], "DEF", "Figure", anchor=eo_log.doc_anchor(reg["fips"], row["url"]), path="digest", value=rec)
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--county", action="append", help="slug (repeatable); default all")
    ap.add_argument("--drop-originals", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="stop after this many documents (0 = all)")
    a = ap.parse_args()
    if not available():
        sys.exit("PyMuPDF is not importable: install it (pip install --target <dir> pymupdf) and set PYTHONPATH")
    regs = [r for r in C.load() if not r["legacy"] and (not a.county or r["slug"] in a.county)]
    done = tot_o = tot_t = scans = pages = 0
    t0 = time.time()
    for reg in regs:
        m = STORE / reg["slug"] / "manifest.jsonl"
        if not m.exists():
            continue
        already = set()
        for ev in eo_log.events(reg["slug"]):
            if ev.get("op") == "DEF" and (ev.get("content") or {}).get("path") == "digest":
                already.add(ev.get("anchor"))
        for line in m.open():
            try:
                row = json.loads(line)
            except ValueError:
                continue
            if eo_log.doc_anchor(reg["fips"], row["url"]) in already:
                # digested before: nothing to do, unless we are now dropping and the original is still here
                if not (a.drop_originals and row.get("file") and (STORE / row["file"]).is_file()):
                    continue
            rec = digest_row(reg, row, a.drop_originals)
            if rec is None:
                continue
            done += 1
            tot_o += rec["original_bytes"] or 0
            tot_t += rec["text_bytes"]
            pages += rec["pages"]
            scans += rec["scan_pages"]
            if a.limit and done >= a.limit:
                break
        if a.limit and done >= a.limit:
            break
    print(f"digested {done} documents, {pages} pages ({scans} scan pages need OCR): "
          f"{tot_o / 1e6:.0f} MB original -> {tot_t / 1e6:.1f} MB text "
          f"({100 * tot_t / max(1, tot_o):.2f}%), originals {'dropped' if a.drop_originals else 'kept'}, {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
