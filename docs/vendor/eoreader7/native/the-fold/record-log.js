// record-log.js — one durable reading record: the pure half (Pass 17, P98).
//
// Every ledger this app holds — the typed-note hyperlexicon, the grid's act
// log, the metacognition ledger — is the SAME kind of thing: a kernel task
// log (eoreader7 kernel/task-log.js), an append-only sequence of sealed
// entries each carrying its `seq`. Until this file, all three lived only in
// memory ("a fresh page load is a fresh ledger" — app.js's own comment), so
// the accumulated reading the ledger block stands on ended at reload and
// "runs for months" was not yet a property the record had.
//
// This half knows nothing about disks. It turns a log into lines and lines
// back into the same log, and it says so when they are not the same:
//
//   serializeRecord(log, fromSeq)  → JSON lines for every entry at seq ≥ fromSeq
//   replayRecord(lines, taskLog)   → { log, replayed, gap } — a log rebuilt
//                                    through the kernel's own `append`, so a
//                                    replayed entry is sealed exactly as the
//                                    live one was; a hole in the sequence or
//                                    a line that will not parse is a TYPED
//                                    gap, never a silently shorter record
//   recordIdentity(log)            → sha256 over the entries, the byte identity
//                                    a reload must reproduce (II.7: two records
//                                    are the same iff they make the same
//                                    difference — here, iff every sealed entry
//                                    is the same)
//   resolveAddress(at, sources)    → the bytes at `name#start-end`, or a typed
//                                    `source_absent` gap when the source's
//                                    bytes are gone. Removing a source removes
//                                    bytes, never history (FOLD-CONSTITUTION
//                                    I.5): the note stays, its address
//                                    becomes unresolved and says so.
//
// The OPFS half is record-store.js. record-log.test.mjs pins the property the
// whole thing exists for: fold(replay(serialize(log))) is byte-identical to
// fold(log), and a record with one entry mutated is NOT — a control that can
// fail (II.23), and does.

const stable = (v) => JSON.stringify(v, (k, x) => (x instanceof Set ? [...x] : x instanceof Map ? Object.fromEntries(x) : x));
// Canonical form: keys sorted at every depth. The kernel's `append` seals an
// entry as `{...entry, seq, depends_on, evidence}`, so a replayed entry's KEY
// ORDER differs from the live one while every value is identical — an
// identity that read key order would call a faithful reload a different
// record. Identity is over values, never over the order a serializer chose.
const canonical = (v) => {
  if (v instanceof Set) return [...v].map(canonical);
  if (v instanceof Map) return canonical(Object.fromEntries(v));
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  return v;
};

/** Every entry at seq ≥ fromSeq, one JSON line each, in seq order. */
export function serializeRecord(log, fromSeq = 0) {
  if (!log || !Array.isArray(log.entries)) throw new TypeError("serializeRecord: a task log has `entries`; nothing else is one");
  return log.entries.filter((e) => e.seq >= fromSeq).map((e) => stable(e));
}

/**
 * Rebuild a log from its lines through the kernel's own append. `admits` is
 * the live empty log's own (grid logs admit a declared operator set); when
 * omitted the kernel's default order applies.
 */
export function replayRecord(lines, { createTaskLog, append, admits = null } = {}) {
  if (typeof createTaskLog !== "function" || typeof append !== "function") throw new TypeError("replayRecord: the task-log bundle is injected — createTaskLog and append");
  let log = admits ? createTaskLog({ admits }) : createTaskLog();
  let replayed = 0;
  let duplicates = 0;
  for (let i = 0; i < (lines ?? []).length; i += 1) {
    const raw = lines[i];
    if (!raw || !String(raw).trim()) continue;
    let entry;
    try { entry = JSON.parse(raw); } catch (err) {
      return { log, replayed, duplicates, gap: { type: "record_unparseable", line: i, detail: `line ${i} is not JSON: ${err.message}` } };
    }
    // A line that REPEATS an entry already replayed — same seq, same bytes
    // in canonical form — is an appender that wrote twice, not a hole: the
    // record is append-only and a repeat changes nothing, so it is counted
    // and skipped. A line at an old seq with DIFFERENT bytes is a real
    // conflict and stays a gap.
    if (entry.seq < log.nextSeq) {
      const prior = log.entries[entry.seq];
      if (prior && JSON.stringify(canonical(prior)) === JSON.stringify(canonical(entry))) { duplicates += 1; continue; }
      return { log, replayed, duplicates, gap: { type: "record_conflict", line: i, seq: entry.seq, detail: `line ${i} carries seq ${entry.seq} with different bytes from the entry already at that seq` } };
    }
    if (entry.seq !== log.nextSeq) {
      return { log, replayed, duplicates, gap: { type: "record_gap", line: i, expected: log.nextSeq, found: entry.seq, detail: `the record skips from seq ${log.nextSeq} to ${entry.seq} at line ${i}; a hole is reported, never closed` } };
    }
    const { seq, ...body } = entry;
    try { log = append(log, body); } catch (err) {
      return { log, replayed, duplicates, gap: { type: "record_refused", line: i, detail: err.message } };
    }
    replayed += 1;
  }
  return { log, replayed, duplicates, gap: null };
}

/** The byte identity of a record: sha256 over its sealed entries in seq order (WebCrypto, the same digest grid.js/builds.js already use). */
export async function recordIdentity(log) {
  if (!log || !Array.isArray(log.entries)) throw new TypeError("recordIdentity: a task log has `entries`; nothing else is one");
  const bytes = new TextEncoder().encode(log.entries.map((e) => JSON.stringify(canonical(e))).join("\n"));
  const buf = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The bytes a `name#start-end` address names, or a typed gap. */
export function resolveAddress(at, sources) {
  const m = String(at ?? "").match(/^(.+?)#(\d+)-(\d+)$/);
  if (!m) return { ok: false, gap: { type: "address_malformed", at } };
  const [, name, s, e] = m;
  const text = sources?.[name];
  if (typeof text !== "string") return { ok: false, gap: { type: "source_absent", at, source: name, detail: `the record names ${name}, whose bytes are not loaded — the note stands, its address is unresolved` } };
  const start = Number(s), end = Number(e);
  if (end > text.length) return { ok: false, gap: { type: "address_beyond_source", at, source: name, length: text.length } };
  return { ok: true, source: name, start, end, text: text.slice(start, end) };
}

/**
 * Two append-only chains from one base, merged: `current` (what the app holds
 * now) plus every entry `theirs` appended beyond `base` — re-appended through
 * the kernel's own `append`, so seqs are re-sealed and a note heard twice is
 * the door's own idempotent no-op. A background read and a chat turn both
 * start from the ledger of the moment and write back later; without this the
 * later writer silently dropped the earlier one's entries (Pass 18, P99).
 * Neither chain is ever truncated: the result carries everything both held.
 */
export function mergeAppendOnly(current, theirs, base, { append } = {}) {
  if (typeof append !== "function") throw new TypeError("mergeAppendOnly: the kernel's append is injected");
  if (!theirs) return current ?? null;
  if (!current) return theirs;
  if (current === theirs) return current;
  const from = base?.nextSeq ?? 0;
  if (current === base) return theirs;
  if (theirs === base) return current;
  let log = current;
  for (const e of theirs.entries) {
    if (e.seq < from) continue;
    const { seq, ...body } = e;
    log = append(log, body);
  }
  return log;
}

