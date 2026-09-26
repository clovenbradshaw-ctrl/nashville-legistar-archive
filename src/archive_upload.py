"""Upload a single file to archive.org as an item, via its S3-like API."""

from __future__ import annotations

import time
from urllib.parse import quote

import requests

S3_BASE = "https://s3.us.archive.org"

_RETRY_STATUSES = {429, 500, 502, 503, 504}


def upload_item(
    identifier: str,
    filename: str,
    data: bytes,
    metadata: dict[str, str],
    access_key: str,
    secret_key: str,
    *,
    collection: str = "opensource",
    mediatype: str = "texts",
    timeout: int = 300,
    max_retries: int = 4,
) -> requests.Response:
    """PUT `data` to archive.org under `identifier/filename`, creating the
    item if it doesn't exist yet. `metadata` values become x-archive-meta-*
    headers (title, description, subject, date, creator, source, ...).

    Retries transient 429/500/502/503/504 responses with linear backoff,
    mirroring legistar_client.py's Legistar._get(). NOTE: a 503 body reading
    "appears to be spam" is archive.org's anti-abuse flag on the account,
    not ordinary load-shedding -- retrying faster won't fix that; it needs a
    non-flagged credential or account remediation instead. Either way this
    still returns the (possibly still-failing) response so an existing
    caller's own resp.raise_for_status() keeps surfacing a final failure."""
    url = f"{S3_BASE}/{identifier}/{filename}"
    headers = {
        "authorization": f"LOW {access_key}:{secret_key}",
        "x-amz-auto-make-bucket": "1",
        "x-archive-meta01-collection": collection,
        "x-archive-meta-mediatype": mediatype,
    }
    for key, value in metadata.items():
        if value:
            # header values must be latin-1; percent-encode anything else
            # (archive.org's ias3 endpoint decodes %XX metadata headers)
            headers[f"x-archive-meta-{key}"] = quote(str(value), safe="")
    r = None
    for attempt in range(max_retries):
        r = requests.put(url, headers=headers, data=data, timeout=timeout)
        if r.status_code not in _RETRY_STATUSES or attempt == max_retries - 1:
            return r
        time.sleep(2 * (attempt + 1))
    return r
