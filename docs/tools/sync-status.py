#!/usr/bin/env python3
"""sync-status.py - one JSON object describing the Metro Nashville contract
pipeline's sync state (inventory -> fetch -> archive.org upload).

Designed to be run ON THE VM by piping it over ssh:

    ssh -o BatchMode=yes hyphae python3 - < tools/sync-status.py

Read-only: prints exactly one JSON object to stdout and writes nothing
anywhere. Standard library only. It never opens the repo's .env.

The universe count is a LOWER BOUND until all 120 departments have a
"done" line across the inventory logs; the output says so explicitly.
"""
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone

ROOT = os.environ.get("NASHVILLE_ARCHIVE_ROOT", "/mnt/watch/nashville-legistar-archive")
DATA = os.path.join(ROOT, "data")
UNIVERSE_DIR = os.path.join(DATA, "universe")
DEPARTMENTS_TOTAL = 120
WINDOW_MIN = 10

UNITS = [
    "mcdp-fetch.service",
    "mcdp-upload.service",
    "mcdp-fetch.timer",
    "mcdp-upload.timer",
    "mcdp-enumerate-universe-a.service",
    "mcdp-enumerate-universe-b.service",
    "mcdp-enumerate-universe-c.service",
    "mcdp-read.service",
    "mcdp-live.service",
]

T0 = time.time()
NOW = datetime.now(timezone.utc)
CUTOFF = (NOW - timedelta(minutes=WINDOW_MIN)).strftime("%Y-%m-%dT%H:%M:%SZ")
warnings = []


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def stream_json(path):
    """Yield parsed dict per line; skip blank, half-written or corrupt lines."""
    try:
        f = open(path, "r", encoding="utf-8", errors="replace")
    except OSError as e:
        warnings.append("cannot read %s: %s" % (os.path.basename(path), e.strerror or e))
        return
    with f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if isinstance(d, dict):
                yield d


def truthy(v):
    return v is True or (isinstance(v, str) and v.strip().lower() in ("true", "1", "yes"))


def in_window(ts):
    # Both ledgers write "YYYY-MM-DDTHH:MM:SSZ", which sorts lexicographically.
    return isinstance(ts, str) and ts >= CUTOFF


# --- universe (inventory output) -------------------------------------------
universe = set()
universe_dept = {}   # token -> the department the inventory found it under
for d in stream_json(os.path.join(UNIVERSE_DIR, "rows.jsonl")):
    t = d.get("token")
    if isinstance(t, str) and t:
        universe.add(t)
        dep = d.get("department")
        if isinstance(dep, str) and dep.strip() and t not in universe_dept:
            universe_dept[t] = dep.strip()

# --- fetched ledger ----------------------------------------------------------
fetched = set()
destroyed = set()
fetch_10m = 0
for d in stream_json(os.path.join(DATA, "epav-fetched.jsonl")):
    t = d.get("epav_token")
    if not isinstance(t, str) or not t:
        continue
    if t not in fetched:
        fetched.add(t)
        if in_window(d.get("fetched_at")):
            fetch_10m += 1
    if truthy(d.get("destroyed_per_retention_schedule")):
        destroyed.add(t)

# --- archive manifest --------------------------------------------------------
archived = set()
upload_10m = 0
for d in stream_json(os.path.join(DATA, "epav-manifest.jsonl")):
    t = d.get("epav_token")
    if not isinstance(t, str) or not t or t in archived:
        continue
    archived.add(t)
    if in_window(d.get("archived_at")):
        upload_10m += 1

n_universe = len(universe)
n_fetched = len(fetched)
n_archived = len(archived)
# Done = in the manifest. Queue = fetched but not archived.
queue = len(fetched - archived)
backlog = len(universe - fetched - archived)
# Tokens fetched/archived that the inventory has not (yet) listed. Zero in
# practice; reported so that a >100% figure could never be silent.
outside = len((fetched | archived) - universe)

# --- by department (the pivot) ----------------------------------------------
# Each token found by the inventory is counted once, under the department the inventory found it in.
# archived = in the manifest; queue = fetched, not archived; backlog = found, not fetched.
by_dept = {}
for t in universe:
    name = universe_dept.get(t, "(department not recorded)")
    r = by_dept.get(name)
    if r is None:
        r = by_dept[name] = {"department": name, "found": 0, "archived": 0, "queue": 0, "backlog": 0}
    r["found"] += 1
    if t in archived:
        r["archived"] += 1
    elif t in fetched:
        r["queue"] += 1
    else:
        r["backlog"] += 1
departments = sorted(by_dept.values(), key=lambda r: (-r["backlog"], r["department"]))
for r in departments:
    r["percent_archived"] = round(100.0 * r["archived"] / r["found"], 1) if r["found"] else None


def pct(n, d):
    return round(100.0 * n / d, 1) if d else None


# --- inventory progress ------------------------------------------------------
done_re = re.compile(r"^done (.+?): \d+ distinct tokens so far")
done_depts = set()
last_log = None  # (mtime, line)
residual_lines = 0
# every inventory log, whatever shards exist now: enum.log, enum-a.log, enum-b.log, enum-c.log, ...
try:
    log_paths = [os.path.join(UNIVERSE_DIR, n) for n in sorted(os.listdir(UNIVERSE_DIR))
                 if n.startswith("enum") and n.endswith(".log")]
except OSError:
    log_paths = []
for p in log_paths:
    try:
        mtime = os.stat(p).st_mtime
        f = open(p, "r", encoding="utf-8", errors="replace")
    except OSError:
        continue
    last = None
    with f:
        for line in f:
            s = line.rstrip("\n")
            if not s.strip():
                continue
            last = s.strip()
            m = done_re.match(s)
            if m:
                done_depts.add(m.group(1).strip())
            elif s.startswith("done "):
                done_depts.add(s[5:].split(":", 1)[0].strip())
            elif s.startswith("RESIDUAL"):
                residual_lines += 1
    if last is not None and (last_log is None or mtime > last_log[0]):
        last_log = (mtime, last)

# --- units -------------------------------------------------------------------
units = {}
try:
    r = subprocess.run(
        ["systemctl", "is-active"] + UNITS,
        capture_output=True, text=True, timeout=6,
    )
    out = r.stdout.split()
    for u, st in zip(UNITS, out):
        units[u] = st
    for u in UNITS:
        units.setdefault(u, "unknown")
except Exception as e:  # noqa: BLE001 - report, never crash
    warnings.append("systemctl failed: %s" % e)
    units = {u: "unknown" for u in UNITS}

running_units = [
    u for u in UNITS
    if "enumerate" in u and units.get(u) in ("active", "activating")
]
departments_done = len(done_depts)
complete = departments_done >= DEPARTMENTS_TOTAL and not running_units

# --- recent failures from the journal ---------------------------------------
fail_re = {
    "upload": re.compile(r"UPLOAD FAILED[^:]*:\s*(.*)$"),
    "fetch": re.compile(r"FETCH FAILED[^:]*:\s*(.*)$"),
}


def journal_proc(unit, use_sudo):
    cmd = ["journalctl", "-u", unit, "--since", "-%dmin" % WINDOW_MIN, "--no-pager", "-o", "cat"]
    if use_sudo:
        cmd = ["sudo", "-n"] + cmd
    return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)


def read_journal(unit):
    for use_sudo in (True, False):
        try:
            p = journal_proc(unit, use_sudo)
            out, _ = p.communicate(timeout=8)
            if p.returncode == 0:
                return out
        except Exception:  # noqa: BLE001
            try:
                p.kill()
            except Exception:  # noqa: BLE001
                pass
    return None


def normalise_reason(s):
    s = re.sub(r"\s+for url:\s*\S+", "", s)           # drop the per-item URL
    s = re.sub(r"for token\s+\S+", "for token", s)     # drop the per-item token
    s = re.sub(r"\s+", " ", s).strip()
    return s[:80] or "unspecified"


reasons = {}
fail_counts = {}
for kind, unit in (("upload", "mcdp-upload.service"), ("fetch", "mcdp-fetch.service")):
    text = read_journal(unit)
    if text is None:
        fail_counts[kind] = None
        warnings.append("journal for %s not readable; %s failure count unknown" % (unit, kind))
        continue
    n = 0
    for line in text.splitlines():
        m = fail_re[kind].search(line)
        if "%s FAILED" % kind.upper() in line and m:
            n += 1
            key = normalise_reason(m.group(1))
            if kind == "fetch":
                key = "fetch: " + key
            else:
                key = "upload: " + key
            reasons[key] = reasons.get(key, 0) + 1
    fail_counts[kind] = n

# --- rates + ETA -------------------------------------------------------------
w = float(WINDOW_MIN)
rates = {
    "fetch_10m": round(fetch_10m / w, 2),
    "upload_10m": round(upload_10m / w, 2),
    "upload_fail_10m": None if fail_counts.get("upload") is None else round(fail_counts["upload"] / w, 2),
    "fetch_fail_10m": None if fail_counts.get("fetch") is None else round(fail_counts["fetch"] / w, 2),
}


def eta_hours(remaining, per_min):
    if not per_min or per_min <= 0:
        return None
    return round(remaining / per_min / 60.0, 1)


note = (
    "ETA = remaining items / the rate over the last %d minutes. " % WINDOW_MIN
    + "Fetch ETA covers the backlog (found, not yet fetched); upload ETA covers everything found "
    + "and not yet archived (queue + backlog)."
)
if not complete:
    note += (
        " The inventory is incomplete (%d of %d departments), so the universe is a lower bound "
        "and these ETAs are lower bounds too: more contracts will be found."
        % (departments_done, DEPARTMENTS_TOTAL)
    )
eta = {
    "fetch": eta_hours(backlog, rates["fetch_10m"]),
    "upload": eta_hours(queue + backlog, rates["upload_10m"]),
    "upload_queue_only": eta_hours(queue, rates["upload_10m"]),
    "note": note,
}


# --- disk --------------------------------------------------------------------
def disk(path):
    try:
        s = os.statvfs(path)
    except OSError as e:
        warnings.append("statvfs %s failed: %s" % (path, e.strerror or e))
        return None, None
    used = (s.f_blocks - s.f_bfree) * s.f_frsize
    avail = s.f_bavail * s.f_frsize
    total = used + avail
    return (round(100.0 * used / total, 1) if total else None), avail


root_pct, root_avail = disk("/")
mnt_pct, mnt_avail = disk("/mnt")
disk_out = {
    "root_used_pct": root_pct,
    "root_free_gb": None if root_avail is None else round(root_avail / 1024 ** 3, 1),
    "mnt_used_pct": mnt_pct,
    "mnt_free_tb": None if mnt_avail is None else round(mnt_avail / 1024 ** 4, 2),
}

# --- last live event ---------------------------------------------------------
last_event_at = None
try:
    p = os.path.join(DATA, "live", "events.jsonl")
    with open(p, "rb") as f:
        f.seek(0, os.SEEK_END)
        size = f.tell()
        f.seek(max(0, size - 65536))
        tail = f.read().decode("utf-8", errors="replace").splitlines()
    for line in reversed(tail):
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if isinstance(d, dict) and isinstance(d.get("at"), str):
            last_event_at = d["at"]
            break
except OSError:
    pass

out = {
    "generated_at": iso(NOW),
    "counts": {
        "universe": n_universe,
        "fetched": n_fetched,
        "archived": n_archived,
        "queue_fetched_not_archived": queue,
        "backlog_not_fetched": backlog,
        "destroyed_flagged": len(destroyed),
        "outside_universe": outside,
    },
    "universe_is_lower_bound": not complete,
    "departments": departments,
    "percent": {
        "fetched": pct(n_fetched, n_universe),
        "archived": pct(n_archived, n_universe),
    },
    "inventory": {
        "departments_total": DEPARTMENTS_TOTAL,
        "departments_done": departments_done,
        "complete": complete,
        "running_units": running_units,
        "residual_lines": residual_lines,
        "last_log_line": last_log[1][:300] if last_log else None,
    },
    "rates_per_min": rates,
    "failure_reasons_10m": reasons,
    "eta_hours": eta,
    "units": units,
    "disk": disk_out,
    "github_push": {"disabled": os.path.exists(os.path.join(DATA, ".github-push-disabled"))},
    "last_event_at": last_event_at,
    "warnings": warnings,
    "took_s": round(time.time() - T0, 2),
}
sys.stdout.write(json.dumps(out, sort_keys=False) + "\n")
