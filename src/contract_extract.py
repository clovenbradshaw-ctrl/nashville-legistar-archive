"""A deterministic, byte-addressed clause/amount/date/party extractor for
procurement contracts -- no model in the loop. Ported from eoreader7's own
proven design (native/organs/plans/extract.mjs, already deployed on real
Nashville planning documents): line-segment the byte-addressable text, keep
only lines a declared pattern hits, emit every row with its real [start,end]
span. Nothing here guesses; every row is a verbatim quote at a real address.

The clause-heading vocabulary is the standard set the legal-NLP field
already names -- the CUAD (Contract Understanding Atticus Dataset) clause
categories and ordinary commercial contract practice -- never invented
ad hoc."""

from __future__ import annotations

import re

CONTRACT_LEDGER_SCHEMA = "ContractLedgerObservation@1"

CLAUSE_HEADINGS = re.compile(
    r"^\s*(?:ARTICLE\s+[IVXLC\d]+[.:]?\s*|SECTION\s+\d+[.:]?\s*|\d+(?:\.\d+)*[.)]\s*)?"
    r"(TERM(?:\s+AND\s+TERMINATION)?|EFFECTIVE DATE|COMPENSATION|PAYMENT(?:\s+TERMS)?|"
    r"SCOPE OF (?:SERVICES|WORK)|TERMINATION(?:\s+FOR\s+(?:CAUSE|CONVENIENCE))?|"
    r"GOVERNING LAW|INDEMNIFICATION|INSURANCE|CONFIDENTIALITY|ASSIGNMENT|NOTICES?|"
    r"ENTIRE AGREEMENT|WARRANT(?:Y|IES)|LIMITATION OF LIABILITY|FORCE MAJEURE|"
    r"DISPUTE RESOLUTION|ARBITRATION|RENEWAL(?:\s+TERM)?|AMENDMENTS?|DEFINITIONS|"
    r"AUTHORITY|COMPLIANCE WITH LAWS|NON-?APPROPRIATION)\b",
    re.IGNORECASE,
)

AMOUNT = re.compile(r"\$[\d,]+(?:\.\d{2})?|\bnot to exceed\b|\bNTE\b", re.IGNORECASE)

DATE = re.compile(
    r"\b\d{1,2}/\d{1,2}/\d{2,4}\b"
    r"|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b"
    r"|\b\d{4}-\d{2}-\d{2}\b"
)

TERM_LENGTH = re.compile(r"\b\d+\s*(?:year|month|day)s?\b", re.IGNORECASE)

PARTY = re.compile(
    r"\bby and between\b|\bVendor:|\bContractor:|\bSupplier:|\bParticipating (?:Public )?Agency\b"
    r"|\bParties\b.{0,40}\bagree\b",
    re.IGNORECASE,
)

HEADING_LINE = re.compile(r"^\s*(?:[0-9]{1,2}(?:\.[0-9]+)*[.)]?\s+)?[A-Z][A-Za-z&',-]*(?:\s+[A-Z][A-Za-z&',-]*){0,6}:?\s*$")


def _collapse(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def extract_contract_rows(text: str, doc: str) -> list[dict]:
    """text is the byte-addressable extracted layer, doc a document id.
    Deterministic: same text in, same rows out. Every row keeps its own
    [start, end] byte span into `text` -- never a bare claim."""
    lines = []
    i, n = 0, len(text)
    while i < n:
        nl = text.find("\n", i)
        seg_end = n if nl == -1 else nl
        seg = text[i:seg_end]
        start = i
        lead = len(seg) - len(seg.lstrip("\x0c"))  # page-break marker, not content
        start += lead
        seg = seg[lead:]
        trailing = len(seg) - len(seg.rstrip())
        end = seg_end - trailing
        body = seg[: len(seg) - trailing].strip()
        if body:
            lines.append((start, end, body))
        i = seg_end + 1

    rows = []
    section = None
    seq = 0
    for start, end, raw in lines:
        c = _collapse(raw)
        is_heading = len(c) <= 80 and c[:1].isupper() and not c.endswith(".") and HEADING_LINE.match(c)
        clause = CLAUSE_HEADINGS.match(c)
        if is_heading and not clause:
            section = c.rstrip(":")[:80]
            continue
        has_clause = bool(clause)
        has_amount = bool(AMOUNT.search(c))
        has_date = bool(DATE.search(c))
        has_party = bool(PARTY.search(c))
        has_term = bool(TERM_LENGTH.search(c))
        if not (has_clause or has_amount or has_date or has_party or has_term):
            continue
        if len(c) < 15:
            continue
        fields = {}
        if section:
            fields["section"] = section
        if clause:
            fields["clause"] = clause.group(1).upper()
        am = AMOUNT.search(c)
        if am:
            fields["amount"] = am.group(0)
        dt = DATE.search(c)
        if dt:
            fields["date"] = dt.group(0)
        tl = TERM_LENGTH.search(c)
        if tl:
            fields["term_length"] = tl.group(0)
        kind = "clause" if has_clause else "amount" if has_amount else "date" if has_date else "party" if has_party else "term"
        seq += 1
        rows.append({
            "schema": CONTRACT_LEDGER_SCHEMA,
            "id": f"contract:{doc}:row:{seq:04d}",
            "doc": doc,
            "at": [start, end],
            "verbatim": c,
            "kind": kind,
            "fields": fields,
        })
    return rows
