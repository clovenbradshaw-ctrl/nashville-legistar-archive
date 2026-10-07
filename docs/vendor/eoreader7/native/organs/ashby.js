// ashby.js — Ashby, the primus. Watches the watcher.
//
// Handle: W. Ross Ashby — the homeostat. A machine that keeps itself
// stable by REORGANIZING its own regulation when the world shifts
// (ultrastability), under the law of requisite variety: only variety can
// absorb variety. Ashby is the empty hub of the archon register — the one
// who never becomes an object of his own knowledge.
//
// His one job here: verify the watcher (Solon) from the FILE, never from
// the watcher's own memory. The primus reads the append-only log and the
// test suite and says whether the watcher is alive (a dead watcher stops
// writing beats), its log replays byte-for-byte, its verdicts carry
// evidence, and its controls can fail. This is what makes Solon's
// heartbeat legitimate: it exists to be read by an independent reader.
// Without Ashby a heartbeat is decoration; with him its absence is the
// signal — a stale beat means the instrument is running unguarded, the
// one failure a watcher cannot report about itself.
//
// Shared-common-cause limit, stated rather than glossed (Pearl's
// question): the log is Solon's own account, so Ashby catches a DEAD or a
// CORRUPTING Solon, not a Solon that writes a consistent falsehood to its
// own record. Independence is from Solon's process state, never from
// Solon's authorship — the backstop for the lying-but-consistent case is
// exactly what `controlsPresent` verifies: the planted controls live in
// the test suite, where the chorus and CI read them, not in Ashby's
// reading of the record Solon writes.
//
// Pure: no fs, no http, no clock reading. Inputs arrive as plain lines
// and objects so every verdict is testable and no hidden IO can drift.

/** Replay a JSONL log line by line; a corrupt row is a typed failure (the
 *  resumption property — a re-append from the serialized lines alone must
 *  reproduce the log). `seqField` gates the monotonic check: an entry
 *  without that field skips it, so ordinary timestamped records that carry
 *  no seq still get the parse check. */
export function checkAppendOnly(lines, { seqField = "seq" } = {}) {
  let firstBad = null;
  let lastSeq = null;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln.trim()) continue;
    let o;
    try {
      o = JSON.parse(ln);
    } catch {
      firstBad = { line: i + 1, why: `unparseable: ${ln.slice(0, 80)}` };
      break;
    }
    if (seqField && o[seqField] != null) {
      const s = Number(o[seqField]);
      if (lastSeq !== null && s <= lastSeq) {
        firstBad = { line: i + 1, why: `seq ${s} not monotonic after ${lastSeq}` };
        break;
      }
      lastSeq = s;
    }
  }
  return { verdict: firstBad ? "replay_failed" : "append_only_holds", firstBad, lines: lines.length };
}

/** A beat is alive until tolerance × the declared interval has elapsed.
 *  No beat at all is stale with the reason named — never a silent pass. */
export function heartbeatVerdict(lastAtMs, nowMs, intervalMs, tolerance = 3) {
  if (lastAtMs == null) {
    return { alive: false, ageMs: null, stale: true, why: "no heartbeat ever", staleAfterMs: intervalMs * tolerance };
  }
  const ageMs = nowMs - lastAtMs;
  return {
    alive: ageMs <= intervalMs * tolerance,
    ageMs,
    stale: ageMs > intervalMs * tolerance,
    staleAfterMs: intervalMs * tolerance,
  };
}

/** The primus's whole verdict, computed from the log's own lines and the
 *  suite's own test bodies — nothing from the watcher's process state. */
export function verifyWatcher({ lines, heartbeatIntervalMs, nowMs, testBodies, requiredMarkers }) {
  const events = [];
  for (const ln of lines) {
    if (!ln.trim()) continue;
    try {
      events.push(JSON.parse(ln));
    } catch {
      // the append-only check below reports it; do not die here
    }
  }
  const beats = events.filter((e) => e.event === "heartbeat");
  const lastBeat = beats.length ? beats[beats.length - 1].at : null;
  const hb = heartbeatVerdict(lastBeat, nowMs, heartbeatIntervalMs);
  const ap = checkAppendOnly(lines);
  const sweeps = events.filter((e) => e.event === "sweep");
  const evidenceMissing = sweeps.filter(
    (s) => !s.verdicts || typeof s.verdicts !== "object" || Object.keys(s.verdicts).length === 0,
  ).length;
  const controlsMissing = (requiredMarkers || []).filter((m) => !testBodies.some((t) => t.body.includes(m)));
  return {
    watcher: hb.alive ? "watcher_alive" : "watcher_stale",
    heartbeat: hb,
    log: ap,
    evidencePresent: evidenceMissing === 0,
    evidenceMissing,
    controlsPresent: controlsMissing.length === 0,
    controlsMissing,
    beats: beats.length,
    sweeps: sweeps.length,
  };
}