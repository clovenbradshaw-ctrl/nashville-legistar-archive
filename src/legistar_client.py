"""Minimal Legistar WebAPI client.

Metro Nashville exposes its legislative record (bills, resolutions,
ordinances, and their attached documents — including procurement contracts,
MOUs and amendments) at https://webapi.legistar.com/v1/nashville. The public,
human-readable equivalent of each matter lives at
https://nashville.legistar.com/LegislationDetail.aspx?ID={id}&GUID={guid}.
"""

from __future__ import annotations

import time
from typing import Any, Iterator, Optional

import requests

BASE = "https://webapi.legistar.com/v1"
DEFAULT_CLIENT = "nashville"


class Legistar:
    def __init__(self, client: str = DEFAULT_CLIENT, *, delay: float = 0.25):
        self.client = client
        self.base = f"{BASE}/{client}"
        self.delay = delay
        self.s = requests.Session()
        self.s.headers.update({"Accept": "application/json", "User-Agent": "nashville-legistar-archive/1.0"})

    def _get(self, path: str, **params) -> Any:
        url = f"{self.base}/{path}"
        for attempt in range(4):
            r = self.s.get(url, params=params or None, timeout=120)
            if r.status_code == 200:
                try:
                    return r.json()
                except ValueError:
                    return r.text
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(2 * (attempt + 1))
                continue
            r.raise_for_status()
        raise RuntimeError(f"failed after retries: {url}")

    def _pages(self, path: str, **params) -> Iterator[dict]:
        skip = 0
        while True:
            page = self._get(path, **{**params, "$top": 1000, "$skip": skip})
            if not page:
                return
            yield from page
            if len(page) < 1000:
                return
            skip += 1000
            time.sleep(self.delay)

    def matters(self, **params) -> Iterator[dict]:
        yield from self._pages("matters", **params)

    def attachments(self, matter_id: int) -> list[dict]:
        return self._get(f"matters/{matter_id}/attachments")

    def detail_url(self, matter_id: int, matter_guid: str) -> str:
        return f"https://{self.client}.legistar.com/LegislationDetail.aspx?ID={matter_id}&GUID={matter_guid}"

    def attachment_bytes(self, att: dict) -> Optional[bytes]:
        """Resolve an attachment to bytes (Hyperlink URL or binary endpoint)."""
        link = att.get("MatterAttachmentHyperlink")
        if link:
            hdr = {
                "Accept": "application/pdf, application/octet-stream, */*",
                "User-Agent": self.s.headers.get("User-Agent", "Mozilla/5.0"),
            }
            r = self.s.get(link, headers=hdr, timeout=180)
            if r.status_code == 200:
                return r.content
        aid = att.get("MatterAttachmentId")
        if aid:
            try:
                r = self.s.get(f"{self.base}/attachments/{aid}", timeout=180)
                if r.status_code == 200 and r.content:
                    return r.content
            except requests.RequestException:
                pass
        return None
