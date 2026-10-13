#!/usr/bin/env python3
"""County pull: slowly, politely, resumably acquire what each Tennessee county
publishes (agendas, minutes, resolutions, bid notices, award lists, and any
contract that is actually posted) into a per-county, FIPS-tagged tree.

    data/counties/<slug>/manifest.jsonl   one CountyDoc@1 per acquired file
    data/counties/<slug>/pointers.jsonl   links seen but deliberately not fetched
    data/counties/<slug>/state.json       per-seed visit state (resume)
    <STORE>/<slug>/files/ab/<sha256>.ext  the bytes (STORE = $COUNTY_STORE or data/counties)

Segmentation is structural: a record can only be written through `Writer`,
which stamps county+fips from the registry, and a county's files live under its
own directory. Nothing here can write an un-tagged record.

Deliberate limits: robots.txt is honoured (a disallow is recorded, not
bypassed); one request per host per --delay seconds; no JS rendering (pages
that need it are recorded as needs_browser); share-drive links (Dropbox,
Google Drive) and video are recorded as pointers, not fetched.
"""
from __future__ import annotations

import argparse, fcntl, hashlib, json, os, re, shutil, sys, time
import urllib.robotparser
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse, urldefrag

import requests

try:                                    # optional: digest PDFs as they arrive (needs PyMuPDF)
    import county_digest as D
except Exception:                       # no PyMuPDF on this machine: originals are kept, as before
    D = None

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import counties as C

UA = "tn-county-records-archive/1.0 (public-records preservation; contact via publisher)"
STORE = Path(os.environ.get("COUNTY_STORE") or C.COUNTIES_DIR)
DOC_EXT = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".csv", ".rtf", ".txt"}
HINT = re.compile(r"agenda|minute|bid|rfp|rfq|rfi|award|contract|resolution|purchas|procure|solicit|"
                  r"budget|ordinance|commission|packet|document|archive|notice|vendor", re.I)
POINTER_HOSTS = ("dropbox.com", "drive.google.com", "docs.google.com", "youtube.com", "youtu.be",
                 "govdeals.com", "facebook.com", "vimeo.com")
# platforms whose published terms forbid automated copying: recorded as pointers, never fetched
TERMS_HOSTS = ("vendorregistry.com",)
BROWSER_HOSTS = ("planetbids.com", "bidnetdirect.com", "bonfirehub.com", "publicpurchase.com",
                 "oraclecloud.com", "civicclerk.com", "municode.com")
MAX_BYTES = 60 * 1024 * 1024
PROV_HEADERS = ("ETag", "Last-Modified", "Date", "Content-Length", "Content-Type", "Content-Disposition", "Server", "Cache-Control")
CODE_SHA = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()[:12]      # which version of this crawler wrote a row


class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.out = []; self._a = None
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._a = {"href": dict(attrs).get("href") or "", "text": ""}; self.out.append(self._a)
    def handle_data(self, data):
        if self._a is not None: self._a["text"] += data
    def handle_endtag(self, tag):
        if tag == "a": self._a = None


DOWNLOAD_Q = re.compile(r"[?&](?:ddownload|wpdmdl|download|download_id|file_id)=\d+", re.I)
DOC_PATHS = ("/DocumentCenter/View/", "ViewFile", "/Archive.aspx?ADID=", "/uploads/attachments/", "/uploads/news/")
UPLOAD_ID = re.compile(r"/a/uploads/\d+", re.I)          # CivicEngage multisite: extension-less, 302 to a short-lived S3 URL


def is_doc(href: str) -> bool:
    """A link to a document: by extension, by CMS download path, or by a numeric download handle
    (WordPress Download Manager's ?ddownload=ID has no extension at all)."""
    return os.path.splitext(urlparse(href).path)[1].lower() in DOC_EXT or any(p in href for p in DOC_PATHS) or bool(DOWNLOAD_Q.search(href)) or bool(UPLOAD_ID.search(href))


def host(u): return (urlparse(u).hostname or "").lower().removeprefix("www.")
def ext(u): return os.path.splitext(urlparse(u).path)[1].lower()
def now(): return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class Writer:
    """The only way a record reaches disk: county + fips come from the registry row."""
    def __init__(self, reg: dict):
        self.reg = reg
        self.dir = STORE / reg["slug"]
        self.dir.mkdir(parents=True, exist_ok=True)
        # one writer per county: two processes would each append the same new documents
        self._lock = open(self.dir / ".lock", "w")
        try:
            fcntl.flock(self._lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.locked = True
        except OSError:
            self.locked = False
        self.manifest = self.dir / "manifest.jsonl"
        self.pointers = self.dir / "pointers.jsonl"
        self.state_path = self.dir / "state.json"
        self.seen = set()
        if self.manifest.exists():
            for l in self.manifest.open():
                try: self.seen.add(json.loads(l)["url"])
                except Exception: pass
        self.state = json.loads(self.state_path.read_text()) if self.state_path.exists() else {"seeds": {}}

    def _stamp(self, rec): return {"county": self.reg["county"], "fips": self.reg["fips"], **rec}
    def doc(self, rec):
        self.seen.add(rec["url"])
        with self.manifest.open("a") as f: f.write(json.dumps(self._stamp({"schema": "CountyDoc@1", **rec})) + "\n")
    def pointer(self, rec):
        with self.pointers.open("a") as f: f.write(json.dumps(self._stamp(rec)) + "\n")
    def save_state(self):
        self.state_path.write_text(json.dumps(self.state, indent=1))


class Pull:
    def __init__(self, delay, max_pages, max_docs, log, drop_originals=False):
        self.drop_originals = bool(drop_originals and D is not None and D.available())
        self.s = requests.Session(); self.s.headers["User-Agent"] = UA
        self.delay, self.max_pages, self.max_docs, self.log = delay, max_pages, max_docs, log
        self.last = {}; self.robots = {}

    def allowed(self, url):
        h = host(url)
        if h not in self.robots:
            rp = urllib.robotparser.RobotFileParser()
            try:
                self.wait(h)
                r = self.s.get(f"{urlparse(url).scheme}://{urlparse(url).netloc}/robots.txt", timeout=20)
                rp.parse(r.text.splitlines() if r.status_code == 200 else [])
            except Exception:
                rp.parse([])
            self.robots[h] = rp
        return self.robots[h].can_fetch(UA, url)

    def wait(self, h):
        gap = self.delay - (time.time() - self.last.get(h, 0))
        if gap > 0: time.sleep(gap)
        self.last[h] = time.time()

    def get(self, url, stream=False):
        self.wait(host(url))
        return self.s.get(url, timeout=45, stream=stream, allow_redirects=True)

    def county(self, reg, w: Writer, kinds):
        docs = pages = 0
        for seed in reg["seeds"]:
            if kinds and seed["kind"] not in kinds: continue
            su = seed["url"]
            h = host(su)
            if any(h.endswith(b) for b in TERMS_HOSTS):
                w.state["seeds"][su] = {"status": "terms_prohibit_automation", "at": now()}
                w.pointer({"url": su, "reason": "terms_prohibit_automation", "kind": seed["kind"], "seen_at": now()}); continue
            if any(h.endswith(b) for b in BROWSER_HOSTS):
                w.state["seeds"][su] = {"status": "needs_browser", "at": now()}
                w.pointer({"url": su, "reason": "needs_browser", "kind": seed["kind"], "seen_at": now()}); continue
            if any(h.endswith(b) for b in POINTER_HOSTS):
                w.state["seeds"][su] = {"status": "pointer_only", "at": now()}
                w.pointer({"url": su, "reason": "share_or_video_host", "kind": seed["kind"], "seen_at": now()}); continue
            if not self.allowed(su):
                w.state["seeds"][su] = {"status": "robots_blocked", "at": now()}
                self.log(f"  {reg['slug']}: robots disallows {su}"); continue
            frontier, visited = [(su, 0)], set()
            while frontier and pages < self.max_pages and docs < self.max_docs:
                url, depth = frontier.pop(0)
                if url in visited: continue
                visited.add(url)
                try:
                    r = self.get(url)
                except Exception as e:
                    w.state["seeds"][su] = {"status": f"error:{type(e).__name__}", "at": now()}; continue
                pages += 1
                ct = r.headers.get("content-type", "")
                if r.status_code in (202, 401, 403, 429):
                    # a bot check / access wall. We do not work around it: it is queued for a person.
                    w.state["seeds"][su] = {"status": f"needs_human:http_{r.status_code}", "at": now()}
                    w.pointer({"url": url, "reason": "needs_human", "status": r.status_code, "kind": seed["kind"], "seen_at": now()})
                    continue
                if r.status_code != 200:
                    w.state["seeds"][su] = {"status": f"http_{r.status_code}", "at": now()}; continue
                if "html" not in ct: continue
                lp = Links(); lp.feed(r.text)
                for a in lp.out:
                    href = urldefrag(urljoin(r.url, a["href"]))[0]
                    if not href.startswith("http"): continue
                    ah = host(href)
                    if any(ah.endswith(p) for p in POINTER_HOSTS):
                        if href not in w.seen:
                            w.seen.add(href)
                            w.pointer({"url": href, "reason": "share_or_video_host", "found_on": r.url, "text": a["text"].strip()[:160], "seen_at": now()})
                        continue
                    if is_doc(href):
                        if href in w.seen or docs >= self.max_docs: continue
                        if self.fetch_doc(href, a["text"].strip(), r.url, seed["kind"], w): docs += 1
                    elif depth < 2 and ah == h and HINT.search(href + " " + a["text"]):
                        frontier.append((href, depth + 1))
                w.state["seeds"][su] = {"status": "ok", "at": now(), "pages": pages, "docs": docs}
        w.state["last_visit"] = now(); w.save_state()
        return pages, docs

    def fetch_doc(self, url, text, found_on, kind, w: Writer):
        if not self.allowed(url): return False
        t_req = time.time()
        try:
            r = self.get(url, stream=True)
            if r.status_code != 200: w.seen.add(url); return False
            buf = bytearray()
            for chunk in r.iter_content(1 << 16):
                buf += chunk
                if len(buf) > MAX_BYTES: w.seen.add(url); return False
        except Exception:
            return False
        sha = hashlib.sha256(buf).hexdigest()
        # provenance: what was asked, what answered, how it got here. Written with every row, so a
        # record can be traced back to the county's own response without keeping the bytes.
        prov = {"request_url": url, "final_url": r.url, "status": r.status_code,
                "redirects": [{"status": h.status_code, "url": h.url} for h in r.history],
                "headers": {k: r.headers.get(k) for k in PROV_HEADERS if r.headers.get(k)},
                "user_agent": UA, "robots": "allowed", "fetched_by": f"tn-county-pull/{CODE_SHA}",
                "duration_ms": int((time.time() - t_req) * 1000)}
        e = ext(r.url) or ext(url) or ".bin"
        p = STORE / w.reg["slug"] / "files" / sha[:2] / f"{sha}{e}"
        extra = {}
        keep = True
        if D is not None and e == ".pdf":
            d = D.digest_pdf(bytes(buf))
            if d is not None:
                tp = D.write_text(w.reg["slug"], sha, d["text"])
                ok = D.verified(tp, d["chars"])
                extra = {"pages": d["pages"], "text_pages": d["text_pages"], "scan_pages": d["scan_pages"], "chars": d["chars"],
                         "state": D.state_of(d), "text_file": str(tp.relative_to(STORE)), "text_verified": ok}
                if self.drop_originals and ok:
                    keep = False                      # text, hash and origin URL are the record; the bytes live at the county
                    extra["original_dropped"] = True
        if keep:
            p.parent.mkdir(parents=True, exist_ok=True)
            if not p.exists(): p.write_bytes(buf)
        w.doc({"url": url, "final_url": r.url, "found_on": found_on, "seed_kind": kind, "title": text[:200],
               "sha256": sha, "bytes": len(buf), "content_type": r.headers.get("content-type", ""),
               "file": str(p.relative_to(STORE)) if keep else None, "fetched_at": now(), "provenance": prov, **extra})
        return True


def disk_ok(path: Path, min_free=0.12):
    u = shutil.disk_usage(path)
    return u.free / u.total >= min_free


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--county", action="append", help="slug (repeatable); default all non-legacy")
    ap.add_argument("--kind", action="append", choices=["legislation", "contracts", "site"])
    ap.add_argument("--delay", type=float, default=3.0, help="seconds between requests to one host")
    ap.add_argument("--max-pages", type=int, default=120, help="HTML pages per county per visit")
    ap.add_argument("--max-docs", type=int, default=400, help="documents per county per visit")
    ap.add_argument("--revisit-hours", type=float, default=168, help="skip a county visited more recently")
    ap.add_argument("--loop", action="store_true", help="keep cycling (VM mode)")
    ap.add_argument("--drop-originals", action="store_true",
                    help="store only the text layer, hash and origin URL for PDFs (needs PyMuPDF); scans are queued for OCR")
    a = ap.parse_args()
    STORE.mkdir(parents=True, exist_ok=True)
    log = lambda m: print(f"{now()} {m}", flush=True)
    while True:
        regs = [r for r in C.load() if not r["legacy"] and (not a.county or r["slug"] in a.county)]
        pull = Pull(a.delay, a.max_pages, a.max_docs, log, a.drop_originals)
        did = 0
        for reg in regs:
            if not disk_ok(STORE):
                log("disk below 12% free: standing down"); time.sleep(600); break
            if (C.COUNTIES_DIR.parent / ".pause-fetch").exists() and a.loop:
                log("data/.pause-fetch present: standing down"); time.sleep(600); break
            w = Writer(reg)
            if not w.locked:
                log(f"{reg['slug']}: another run holds this county, skipping")
                continue
            lv = w.state.get("last_visit")
            if lv and a.revisit_hours and (time.time() - time.mktime(time.strptime(lv, "%Y-%m-%dT%H:%M:%SZ")) - time.timezone * -1) < a.revisit_hours * 3600:
                continue
            p, d = pull.county(reg, w, set(a.kind) if a.kind else None)
            did += 1
            log(f"{reg['fips']} {reg['county']}: {p} pages, {d} new docs (total {len(w.seen)})")
        if not a.loop: break
        time.sleep(3600 if did == 0 else 60)


if __name__ == "__main__":
    main()
