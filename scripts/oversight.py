"""Self-healing oversight for the Metro contract pipeline.

A small supervisor that runs on a schedule and does four bounded things:

1. Liveness: every expected unit (timers enabled, daemons active) is checked;
   a dead daemon is restarted, a disabled timer re-armed. Each corrective
   action is recorded append-only in data/oversight/actions.jsonl and emitted
   on the live feed.

2. Disk pressure: reads /mnt usage. Above the WARN watermark it emits an
   event; at/above the HARD watermark it writes data/.pause-fetch so the
   fetch sweep stands down until the archive.org drain frees space. Removing
   the pause is also recorded.

3. Stagnation: if the pending-upload queue grows while uploads are flat, the
   archive.org leg is stuck -- recorded (and the recurrence fed to the
   learning derived-rules ledger) rather than silently ignored.

4. GitHub budget: pushed via the same guard as push_small_files -- see the
   repo-size + per-file caps there. Oversight surfaces the count here so the
   dashboard's feed shows it instead of it hiding in logs.

Self-audit: oversight never guesses. Every action carries a falsifying
control (recorded with it); a corrective step that outlives its reason is
not repeated for it.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import live  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ACTIONS = ROOT / "data" / "oversight" / "actions.jsonl"
PAUSE = ROOT / "data" / ".pause-fetch"
STATE = ROOT / "data" / "oversight" / "state.json"

WARN_DISK = 0.80
HARD_DISK = 0.88

TIMER_UNITS = ["mcdp-fetch", "mcdp-upload", "mcdp-qc", "mcdp-falsify",
               "mcdp-roundup", "mcdp-trim", "mcdp-missing", "mcdp-read",
               "mcdp-legislation", "mcdp-falsify-live"]
DAEMON_UNITS = ["mcdp-live", "mcdp-holodeck"]


def sh(*cmd: str) -> str:
    r = subprocess.run(list(cmd), capture_output=True, text=True, timeout=20)
    return (r.stdout or r.stderr).strip()


def record(action: dict) -> None:
    ACTIONS.parent.mkdir(parents=True, exist_ok=True)
    line = {
        "schema": "OversightAction@1",
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **action,
    }
    with ACTIONS.open("a") as f:
        f.write(json.dumps(line) + "\n")
    try:
        live.event("oversight", **{k: v for k, v in line.items() if k not in ("schema",)})
    except Exception:  # noqa: BLE001
        pass


def disk_used() -> float:
    usage = shutil.disk_usage("/mnt")
    return usage.used / usage.total


def pending_upload() -> int:
    """Queue rows not yet in the archive.org manifest -- the true backlog."""
    man = set()
    mp = ROOT / "data" / "epav-manifest.jsonl"
    if mp.exists():
        with open(mp) as f:
            for l in f:
                l = l.strip()
                if l:
                    try:
                        man.add(json.loads(l).get("epav_token"))
                    except json.JSONDecodeError:
                        pass
    qp = ROOT / "data" / "epav-fetched.jsonl"
    if not qp.exists():
        return 0
    pend = 0
    with open(qp) as f:
        for l in f:
            l = l.strip()
            if l:
                try:
                    if json.loads(l).get("epav_token") not in man:
                        pend += 1
                except json.JSONDecodeError:
                    pass
    return pend


def main() -> None:
    actions: list[str] = []

    for t in TIMER_UNITS:
        if sh("systemctl", "is-enabled", t + ".timer") != "enabled":
            sh("systemctl", "enable", "--now", t + ".timer")
            record({"kind": "rearm-timer", "unit": t + ".timer",
                    "falsifying": "the timer shows enabled on the next oversight pass"})
            actions.append(t + ".timer")
    for u in DAEMON_UNITS:
        if sh("systemctl", "is-active", u) != "active":
            sh("systemctl", "start", u)
            record({"kind": "restart-daemon", "unit": u,
                    "falsifying": "the daemon is active on the next oversight pass"})
            actions.append(u)

    used = disk_used()
    if used >= HARD_DISK and not PAUSE.exists():
        PAUSE.touch()
        record({"kind": "pause-fetch", "disk_used": round(used, 3),
                "falsifying": "disk usage falls below the resume watermark and the pause is removed"})
        actions.append("pause-fetch")
    elif used < WARN_DISK and PAUSE.exists():
        PAUSE.unlink(missing_ok=True)
        record({"kind": "resume-fetch", "disk_used": round(used, 3),
                "falsifying": "the pause file is gone"})
        actions.append("resume-fetch")

    prev = {}
    if STATE.exists():
        try:
            prev = json.loads(STATE.read_text())
        except json.JSONDecodeError:
            prev = {}
    pend = pending_upload()
    prev_pend = prev.get("pending", pend)
    prev_up = prev.get("uploaded", 0)
    uploaded = 0
    mp = ROOT / "data" / "epav-manifest.jsonl"
    if mp.exists():
        uploaded = sum(1 for _ in open(mp))
    if pend > prev_pend and uploaded == prev_up:
        record({"kind": "stagnation", "pending": pend, "uploaded": uploaded,
                "falsifying": "the pending queue shrinks or uploads advance on a later pass"})
        actions.append("stagnation")
        try:
            import learning
            learning.observe("upload", "stagnation")
        except Exception:  # noqa: BLE001
            pass
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps({"pending": pend, "uploaded": uploaded, "at": time.strftime("%H:%M:%SZ", time.gmtime())}, indent=2))

    oversize = 0
    ol = ROOT / "data" / "live" / "oversize.jsonl"
    if ol.exists():
        oversize = sum(1 for _ in open(ol))
    print(json.dumps({"disk_used": round(used, 3), "pending": pend, "uploaded": uploaded,
                      "oversized_files": oversize, "actions": actions}, indent=2))


if __name__ == "__main__":
    main()