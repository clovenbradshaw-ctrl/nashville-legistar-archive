"""Hourly roundup + publikation of the auditable live summary to GitHub.

1. appends a Roundup@1 (period analytics: contracts acquired/uploaded, split
   by department and vendor, day-bucketed) to data/live/roundups.jsonl and
   emits it on the SSE stream;
2. writes data/live/summary.json -- the derived "what's going on" snapshot
   (state prose + 24h/7d/30d periods + latest roundup + recent raw events)
   that the GitHub Pages-hosted live.html polls via raw.githubusercontent;
3. writes data/live/recent.jsonl (tail of events) so the audit view has a
   bounded, cheap-to-fetch window;
4. pushes the small-file store to GitHub so the Pages audit trail is current.

Runs on the mcdp-roundup systemd timer.
"""
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "src"))

import live  # noqa: E402
import summarize  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent


def recent_events(limit: int = 400) -> list[dict]:
    p = ROOT / "data" / "live" / "events.jsonl"
    if not p.exists():
        return []
    with open(p) as f:
        tail = [l for l in f.readlines()[-limit:] if l.strip()]
    out = []
    for line in tail:
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def main() -> int:
    hours = 24
    args = sys.argv[1:]
    if "--hours" in args:
        hours = int(args[args.index("--hours") + 1])

    line = live.roundup(hours=hours, since=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    state = summarize.state_summary()
    periods = {f"{h}h": summarize.period_summary(f"{h}h", h) for h in (24, 168, 720)}
    recent = recent_events(400)

    summary = {
        "schema": "LiveSummary@1",
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "state": {k: v for k, v in state.items() if k not in ("latest",)},
        "periods": periods,
        "roundup": line,
        "recent": recent,
    }
    (ROOT / "data" / "live").mkdir(parents=True, exist_ok=True)
    (ROOT / "data" / "live" / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    with open(ROOT / "data" / "live" / "recent.jsonl", "w") as f:
        for ev in recent:
            f.write(json.dumps(ev) + "\n")

    try:
        import push_small_files
        push_small_files.main(["run"])
    except Exception as e:  # noqa: BLE001 - the audit snapshot exists regardless
        print(f"  push_small_files FAILED (retry next roundup): {e}", file=sys.stderr)

    print(json.dumps({"roundup": line["at"], "periods": list(periods), "recent": len(recent)}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())