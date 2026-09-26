"""Client for Nashville's ePAV "Metro Contract Document Search" portal at
documents.nashville.gov -- a genuinely separate system from Legistar, with
real historical depth back to at least the 1990s (Legistar's own floor is
2020-07-13). Confirmed against the live site 2026-09-25.

Field mapping (read off the live form's <label for="IndexN">, not guessed):
Index1 Contract Number, Index2 Contracting Party, Index3 Department or
Agency, Index4 Description, Index5 Keyword, Index6 Document Type. Index5
(Keyword) is confirmed broken server-side: a "Motorola" keyword search's own
top result (A-90-140, an EMBRAER hangar ground lease) does not contain the
word "Motorola" anywhere in its 127 pages. Index6 (Document Type) currently
has exactly one real option, EXECUTED CONTRACT -- every search here is
implicitly scoped to it. Department or Agency is the enumeration axis:
Contracting Party filters correctly too (verified: "MOTOROLA" returned 30
real, correctly-filtered rows spanning 1999-2009+) but requires already
knowing vendor names, so it's a drill-down tool, not a crawl strategy.

The site caps results at 1000 rows per search; a POLICE-only search (no
other filter) hit that cap live. iter_all() surfaces this to the caller
(logged to stderr) rather than silently returning a truncated set --
departments that hit the cap need a further split (e.g. by Contracting
Party prefix) not yet implemented here.

Some rows are not the original document at all: Metro Clerk destroys
records on schedule (Tennessee's GRS 102/RDA 287), and the "archived" file
for those is a one-page destruction notice, not the contract. Confirmed
live: contract 15387 (Police Dept, C&S Harley-Davidson, "MOTORCYCLE
MAINTENANCE") resolves, via its real row token, to a single page reading
"METRO CLERK / This record was destroyed per GRS 102/RDA 287." --
is_destruction_notice() names this so callers flag it distinctly instead of
mistaking a stub for a real archived contract.
"""

from __future__ import annotations

import html
import re
import sys
import time
from typing import Iterator, Optional

import requests

BASE = "http://documents.nashville.gov"
FORM_URL = f"{BASE}/Request/Form/Contracts"
SEARCH_URL = f"{BASE}/Request/Search"
OPEN_URL = f"{BASE}/Request/Open/{{token}}"

DOCUMENT_TYPE = "EXECUTED CONTRACT"  # the only real option Index6 offers today

RESULT_CAP = 1000  # the site's own stated per-search row cap, confirmed live

# Every real value of the Department or Agency dropdown (Index3), read
# directly off the live form 2026-09-25.
DEPARTMENTS = [
    "AFFORDABLE HOUSING", "AGRICULTURAL EXTENSION", "AIRPORT AUTHORITY", "ARENA",
    "ARTS COMMISSION", "ASSESSOR OF PROPERTY", "AUDIT COMMITTEE",
    "BEAUTIFICATION COMMISSION", "BEER BOARD", "CARING FOR CHILDREN",
    "CHANCERY COURT", "CIRCUIT COURT CLERK", "CLERK AND MASTER",
    "CODES ADMINISTRATION", "COMMUNITY ACCESS TV", "COMMUNITY CORRECTIONS",
    "COMMUNITY EDUCATION COMMISSION", "COMMUNITY OVERSIGHT BOARD",
    "CONSTELLATION ENERGY SOURCE", "CONVENTION CENTER AUTHORITY", "COUNTY CLERK",
    "CRIMINAL COURT CLERK", "CRIMINAL JUSTICE PLANNING", "DATA PROCESSING",
    "DISTRICT ATTORNEY", "DISTRICT ENERGY SYSTEM", "DOWNTOWN PARTNERSHIP",
    "DRUG COURT", "DRUG POLICY OFFICE", "EAST BANK DEVELOPMENT AUTHORITY",
    "ECONOMIC DEVELOPMENT", "ELECTION COMMISSION", "ELECTRIC POWER BOARD",
    "EMERGENCY COMMAND CENTER", "EMERGENCY COMMUNICATIONS DISTRICT",
    "EMPLOYEE ASSISTANCE", "EMPLOYEE BENEFIT BD TRUST FND",
    "EMPLOYEE BENEFIT BOARD", "ENERGY PROD FACILITY", "FAIRGROUNDS",
    "FAMILY JUSTICE CENTER/VICTIM RESOURCE CENTER", "FAMILY SAFETY OFFICE",
    "FARMERS MARKET", "FILM OFFICE", "FINANCE", "FIRE", "FRANCHISE",
    "GENERAL SERVICES", "GENERAL SESSIONS COURT", "HEALTH",
    "HEALTH AND EDUCATIONAL FACILITIES BOARD", "HISTORICAL COMMISSION",
    "HOSPITAL AUTHORITY", "HOSPITALS", "HOUSING TRUST FUND COMMISSION",
    "HUMAN RELATIONS COMMISSION", "HUMAN RESOURCES",
    "INDUSTRIAL DEVELOPMENT BOARD", "INFORMATION TECHNOLOGY SERVICES",
    "INTERNAL AUDIT", "JEAN CROWE ADVOCACY CENTER", "JIS", "JUVENILE COURT",
    "JUVENILE COURT CLERK", "JUVENILE JUSTICE CENTER", "LEGAL DEPARTMENT",
    "LOCAL WORKFORCE DEVELOPMENT AREA 9", "LOCAL WORKFORCE INVESTMENT BOARD",
    "MAYORS OFFICE", "MAYORS OFFICE CHILDREN AND YOUTH", "MAYORS YOUTH COUNCIL",
    "MDHA", "MEDICAL EXAMINER", "METRA", "METRO ACTION COMMISSION",
    "METRO CLERK", "METRO COUNCIL", "METRO NASHVILLE PUBLIC SCHOOLS",
    "METRO WIDE", "METROPOLITAN GOVERNMENT", "MUNICIPAL AUDITORIUM",
    "MUSIC CITY CENTER", "NASHVILLE CAREER ADVANCEMENT CENTER",
    "NASHVILLE CITY OF", "NASHVILLE CONVENTION CENTER",
    "NASHVILLE ELECTRIC SERVICE", "NDOT", "OFFICE OF EMERGENCY MANAGEMENT",
    "OFFICE OF HOMELESS SERVICES", "PARKS AND RECREATION", "PARTNERSHIP 2000",
    "PLANNING COMMISSION", "POLICE", "PORT AUTHORITY", "PROBATE COURT CLERK",
    "PUBLIC DEFENDER", "PUBLIC LIBRARY", "PUBLIC PROPERTY", "PUBLIC WORKS",
    "PURCHASING", "REGIONAL TRANSPORTATION AUTHORITY (RTA)",
    "REGISTER OF DEEDS", "SHERIFF", "SOCIAL SERVICES",
    "SOIL AND WATER CONSERVATION", "SPORTS AUTHORITY", "STADIUM", "STAHLMAN",
    "STATE TRIAL COURT", "TAXI/WRECKER BOARD", "TELECOMMUNICATIONS",
    "TENNESSEE STATE FAIR", "THERMAL TRANSFER CORP", "TOURISM COMMISSION",
    "TRAFFIC AND PARKING", "TRANSIT AUTHORITY",
    "TRANSPORTATION LICENSING COMMISSION", "TRUSTEE", "WASTE SERVICES",
    "WATER SERVICES",
]

_TOKEN_RE = re.compile(r'name="__RequestVerificationToken"[^>]*value="([^"]+)"')

_ROW_RE = re.compile(
    r'<tr[^>]*class="data-file"[^>]*data-href="(?P<href>[^"]+)"[^>]*>\s*'
    r'<td[^>]*>(?P<token>[^<]*)</td>\s*'
    r'<td>(?P<contract_number>.*?)</td>\s*'
    r'<td>(?P<status>.*?)</td>\s*'
    r'<td>(?P<contracting_party>.*?)</td>\s*'
    r'<td>(?P<department>.*?)</td>\s*'
    r'<td>(?P<description>.*?)</td>\s*'
    r'<td>(?P<document_type>.*?)</td>\s*'
    r'<td>(?P<expiration_date>.*?)</td>\s*'
    r"</tr>",
    re.DOTALL,
)

_DESTRUCTION_NOTICE_RE = re.compile(r"destroyed.{0,20}GRS\s*102", re.IGNORECASE | re.DOTALL)


def is_destruction_notice(text: str) -> bool:
    """True when the archived file is a records-destruction stub, not the
    real contract -- a real, confirmed case (contract 15387), not a
    hypothetical one."""
    return bool(_DESTRUCTION_NOTICE_RE.search(text or ""))


def _clean(cell: str) -> str:
    return html.unescape(cell).strip()


class EPAV:
    def __init__(self, *, delay: float = 0.5):
        self.delay = delay
        self.s = requests.Session()
        self.s.headers.update(
            {"User-Agent": "nashville-legistar-archive/1.0 (public-records archiving)"}
        )

    def _token(self) -> str:
        r = self.s.get(FORM_URL, timeout=60)
        r.raise_for_status()
        m = _TOKEN_RE.search(r.text)
        if not m:
            raise RuntimeError("could not find __RequestVerificationToken on form page")
        return m.group(1)

    def search(
        self,
        *,
        department: Optional[str] = None,
        contracting_party: Optional[str] = None,
        contract_number: Optional[str] = None,
        description: Optional[str] = None,
    ) -> list[dict]:
        """One page of results (server caps at RESULT_CAP rows). Check
        len(result) == RESULT_CAP to detect a truncated result. Index5
        (Keyword) is deliberately never sent -- confirmed broken server-side."""
        token = self._token()
        data = {
            "__RequestVerificationToken": token,
            "Index1": contract_number or "",
            "Index2": contracting_party or "",
            "Index3": department or "",
            "Index4": description or "",
            "Index5": "",
            "Index6": DOCUMENT_TYPE,
        }
        r = None
        for attempt in range(4):
            r = self.s.post(SEARCH_URL, data=data, timeout=120)
            if r.status_code == 200:
                break
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(2 * (attempt + 1))
                continue
            r.raise_for_status()
        else:
            raise RuntimeError(f"search failed after retries: {data}")
        rows = []
        for m in _ROW_RE.finditer(r.text):
            g = m.groupdict()
            rows.append(
                {
                    "token": g["token"].strip(),
                    "contract_number": _clean(g["contract_number"]),
                    "status": _clean(g["status"]),
                    "contracting_party": _clean(g["contracting_party"]),
                    "department": _clean(g["department"]),
                    "description": _clean(g["description"]),
                    "document_type": _clean(g["document_type"]),
                    "expiration_date": _clean(g["expiration_date"]),
                }
            )
        time.sleep(self.delay)
        return rows

    def fetch_document(self, token: str) -> Optional[bytes]:
        url = OPEN_URL.format(token=token) + "?source=Contracts&sourceAppId=14&isArchived=True"
        for attempt in range(4):
            r = self.s.get(url, timeout=180)
            if r.status_code == 200 and r.content:
                time.sleep(self.delay)
                return r.content
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(2 * (attempt + 1))
                continue
            return None
        return None

    def detail_url(self, token: str) -> str:
        return f"{BASE}/Request/Document/{token}?sourceAppId=14&source=Contracts&isArchived=True"

    def iter_department_exhaustive(self, department: str) -> Iterator[dict]:
        """Measures past the site's real RESULT_CAP rather than silently
        truncating a large department, by recursing into further search
        axes only for the specific slice that's still capped. Axis order:
        Contracting Party (36-char contains-substring, A-Z0-9 -- virtually
        every real vendor name matches at least one), then Description
        (confirmed live 2026-09-26 to be independently ANDed with
        Contracting Party -- combining them surfaces real records outside
        the first capped 1000, not just a re-slice), then Contract Number
        (10 digits -- added because two axes alone still left 48 residual
        capped buckets live on ARTS COMMISSION: short, generic descriptions
        share common letters with common party-name letters and don't
        narrow enough against each other; a third, more independent axis
        was needed). Deduped by token throughout. A bucket still at
        RESULT_CAP after all three axes is logged to stderr as a disclosed,
        unresolved gap -- never silently dropped or claimed complete."""
        letters = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
        digits = list("0123456789")
        axes = [("contracting_party", letters), ("description", letters), ("contract_number", digits)]
        seen: set[str] = set()

        def emit(rows: list[dict]) -> Iterator[dict]:
            for row in rows:
                if row["token"] in seen:
                    continue
                seen.add(row["token"])
                yield row

        def recurse(filters: dict, axis_idx: int) -> Iterator[dict]:
            rows = self.search(department=department, **filters)
            if len(rows) < RESULT_CAP or axis_idx >= len(axes):
                yield from emit(rows)
                if len(rows) >= RESULT_CAP:
                    print(
                        f"WARNING: department {department!r} filters={filters!r} STILL returned "
                        f"{len(rows)} rows (cap) with no further axis to try -- residual gap, "
                        f"not further resolved",
                        file=sys.stderr,
                    )
                return
            yield from emit(rows)
            axis_name, alphabet = axes[axis_idx]
            for value in alphabet:
                yield from recurse({**filters, axis_name: value}, axis_idx + 1)

        yield from recurse({}, 0)

    def iter_all(self, *, departments: Optional[list[str]] = None) -> Iterator[dict]:
        """Walks every department, yielding every row (deduped by token)
        plus which department query found it. A department that returns
        RESULT_CAP rows is logged to stderr as truncated -- disclosed, not
        hidden, and not yet auto-partitioned further."""
        seen_tokens: set[str] = set()
        for dept in departments or DEPARTMENTS:
            rows = self.search(department=dept)
            if len(rows) >= RESULT_CAP:
                print(
                    f"WARNING: department {dept!r} returned {len(rows)} rows "
                    f"(server cap) -- likely truncated, needs further "
                    f"partitioning (not yet implemented)",
                    file=sys.stderr,
                )
            for row in rows:
                if row["token"] in seen_tokens:
                    continue
                seen_tokens.add(row["token"])
                row["source_department_query"] = dept
                yield row
