"""PDF text extraction (embedded layer + tesseract OCR fallback) and PDF
normalization for archive.org's server-side upload validator."""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import fitz  # PyMuPDF

MIN_PAGE_TEXT_CHARS = 60
OCR_DPI = 200
OCR_TIMEOUT = 120


def _ocr_page(page) -> str:
    pix = page.get_pixmap(matrix=fitz.Matrix(OCR_DPI / 72.0, OCR_DPI / 72.0), alpha=False)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as fh:
        fh.write(pix.tobytes("png"))
        tmp = Path(fh.name)
    try:
        out = subprocess.run(
            ["tesseract", str(tmp), "stdout", "--psm", "6"],
            capture_output=True, text=True, timeout=OCR_TIMEOUT,
        )
        return out.stdout if out.returncode == 0 else ""
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return ""
    finally:
        tmp.unlink(missing_ok=True)


def extract_pdf_pages(data: bytes, *, ocr: bool = True) -> list[str]:
    """Text layer first; any page under MIN_PAGE_TEXT_CHARS (a scanned page)
    gets OCR'd instead. Returned per-page (not joined) so callers can hash
    and route each page individually -- e.g. boilerplate.py's page cache."""
    doc = fitz.open(stream=data, filetype="pdf")
    pages = []
    for page in doc:
        txt = page.get_text("text") or ""
        if ocr and len(txt.strip()) < MIN_PAGE_TEXT_CHARS:
            txt = _ocr_page(page)
        pages.append(txt)
    doc.close()
    return pages


def extract_pdf_text(data: bytes, *, ocr: bool = True) -> str:
    return "\n\n".join(extract_pdf_pages(data, ocr=ocr))


def extract_text(filename: str, data: bytes, *, ocr: bool = True) -> str:
    if filename.lower().endswith(".pdf"):
        return extract_pdf_text(data, ocr=ocr)
    for enc in ("utf-8", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _ocr_page_pdf_bytes(page) -> bytes | None:
    """Tesseract's own 'pdf' output config: a single-page PDF holding the
    scanned image plus a real, position-accurate invisible text layer --
    confirmed live to match the plain-text OCR output near-verbatim (same
    OCR artifacts), unlike the original scan's own embedded layer (often
    just an 'ARCHIVE' stamp, no real content)."""
    pix = page.get_pixmap(matrix=fitz.Matrix(OCR_DPI / 72.0, OCR_DPI / 72.0), alpha=False)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as fh:
        fh.write(pix.tobytes("png"))
        tmp = Path(fh.name)
    out_base = tmp.with_suffix("")
    try:
        out = subprocess.run(
            ["tesseract", str(tmp), str(out_base), "--psm", "6", "pdf"],
            capture_output=True, text=True, timeout=OCR_TIMEOUT,
        )
        pdf_path = out_base.with_suffix(".pdf")
        if out.returncode == 0 and pdf_path.exists():
            return pdf_path.read_bytes()
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None
    finally:
        tmp.unlink(missing_ok=True)
        out_base.with_suffix(".pdf").unlink(missing_ok=True)


def make_searchable_pdf(data: bytes) -> bytes:
    """Rebuilds a PDF page by page: pages with a real embedded text layer
    (>= MIN_PAGE_TEXT_CHARS) are copied through unchanged; scanned pages are
    replaced with tesseract's own searchable-PDF output, so a PDF viewer's
    own text extraction (PDF.js included) finds real text to work with
    instead of an image with no text layer. Falls back to the original
    page, unchanged, if OCR fails for any reason -- never drops a page."""
    src = fitz.open(stream=data, filetype="pdf")
    out = fitz.open()
    for page in src:
        txt = page.get_text("text") or ""
        if len(txt.strip()) >= MIN_PAGE_TEXT_CHARS:
            out.insert_pdf(src, from_page=page.number, to_page=page.number)
            continue
        ocr_bytes = _ocr_page_pdf_bytes(page)
        if ocr_bytes:
            try:
                ocr_doc = fitz.open(stream=ocr_bytes, filetype="pdf")
                out.insert_pdf(ocr_doc, from_page=0, to_page=0)
                ocr_doc.close()
                continue
            except Exception:
                pass
        out.insert_pdf(src, from_page=page.number, to_page=page.number)
    result = out.tobytes(garbage=4, deflate=True)
    out.close()
    src.close()
    return result


def clean_pdf_bytes(data: bytes) -> bytes:
    """Re-save a PDF through PyMuPDF (garbage-collect unused objects,
    rebuild xref, recompress streams). archive.org's own server-side
    upload check rejected a real, valid, 111-page Nashville contract PDF
    ("error checking pdf file") until it was re-saved this way; on
    failure, returns the original bytes unchanged."""
    try:
        doc = fitz.open(stream=data, filetype="pdf")
        cleaned = doc.tobytes(garbage=4, deflate=True, clean=True)
        doc.close()
        return cleaned
    except Exception:
        return data
