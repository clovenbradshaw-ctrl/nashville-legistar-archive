// reopen.js — restore what the person last had open, from the record's own
// rows. Pure: rows in, a pick out; no I/O, no model, no search.
//
// THE REFERENT (reopen.test.mjs's BECOMING): the record
// (record/explore-record.jsonl, append-only, FOLD-CONSTITUTION I.5) is the
// only ground. `lastOpened` walks its rows BACKWARDS and returns the last
// row that OPENED something — a source, a fold, or a door result — with the
// address that row itself carries. Nothing here reads a source's text, a
// transcript, or a chat history, and nothing here writes: reopen RESTORES,
// it never re-admits (the caller opens by the carried address; a door
// result is re-rendered from its recorded fields, never re-run).
//
// The walls, each pinned in reopen.test.mjs:
//   ADDRESS (P5.2) — the address is the row's own field, verbatim.
//   HEARD — a heard source (a `transcribe` row) opens exactly as a read one;
//     the organ reads event kind and address, never modality or text.
//   TRUST — no model organ is accepted anywhere in this module.
//   NO SELF CO-SIGN — a row authored self:model, or one carrying no address
//     (readsNothing), is not an open.
//   RESTORE, NEVER RE-ADMIT — rows are not mutated; the pick is frozen.
import { readsNothing, SELF_WITNESS } from "../organs/index.js";
import { correspond } from "./relative-pattern.js";

/**
 * Which record events OPEN something, and where the row's own address lives.
 * A closed table, read off the record's real event vocabulary
 * (`grep -o '"event":"[^"]*"' record/explore-record.jsonl | sort | uniq -c`).
 * `address` returns the row's own field — never derived, never searched.
 */
export const OPEN_EVENTS = Object.freeze({
  "source-open":  { kind: "source", address: (r) => r.path },
  "read-start":   { kind: "source", address: (r) => r.path },
  "read-reused":  { kind: "source", address: (r) => r.path },
  "prior-open":   { kind: "source", address: (r) => r.path ?? r.id },
  "transcribe":   { kind: "source", address: (r) => r.name },        // a HEARD source, attached under its own name
  "fold-open":    { kind: "fold",   address: (r) => r.n },
  "term-run":     { kind: "door",   address: (r) => r.at },          // a door result: the row IS the thing; its clock is its address
  "term-act":     { kind: "door",   address: (r) => r.at },
  "entity-seek":  { kind: "door",   address: (r) => r.at },
});

const authoredBySelf = (r) => [r.by, r.witness, r.who].some((v) => v === SELF_WITNESS);

/**
 * The last row that opened something, walking backwards from `before`
 * (exclusive; defaults to the end). `kinds` narrows to source/fold/door.
 * Returns `{ kind, event, address, at, row }` with `row` a frozen copy, or
 * `{ refused: "nothing_open" }` — never a guess, never a search.
 */
export function lastOpened(rows, { kinds = null, before = null } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const stop = Number.isInteger(before) ? Math.min(before, list.length) : list.length;
  for (let i = stop - 1; i >= 0; i--) {
    const r = list[i];
    const spec = r && OPEN_EVENTS[r.event];
    if (!spec) continue;
    if (kinds && !kinds.includes(spec.kind)) continue;
    if (authoredBySelf(r)) continue;                        // self:model never co-signs an open
    const address = spec.address(r);
    if (readsNothing({ read: address == null || address === "" ? [] : [address] })) continue; // a row with no address read nothing
    return Object.freeze({ kind: spec.kind, event: r.event, address, at: r.at ?? null, index: i, row: Object.freeze({ ...r }) });
  }
  return { refused: "nothing_open" };
}

/**
 * What the caller should DO with a pick — a descriptor, never the doing.
 * Restore opens by the carried address; it never re-admits bytes.
 */
export function restoreFor(pick) {
  if (!pick || pick.refused) return { action: "none", reason: pick?.refused ?? "no_pick" };
  if (pick.kind === "source") return { action: "open-source", name: pick.address };
  if (pick.kind === "fold") return { action: "open-fold", n: pick.address };
  return { action: "render-door", event: pick.event, at: pick.at, fields: pick.row };
}

/** A door result re-rendered from its RECORDED fields alone; absent fields are said absent, never re-run to fill. */
export function renderDoor(row) {
  const r = row ?? {};
  const skip = new Set(["event", "at", "via"]);
  const lines = [`${r.event ?? "door"} · recorded ${r.at ?? "(no clock)"}${r.via ? ` · via ${r.via}` : ""}`];
  for (const [k, v] of Object.entries(r)) if (!skip.has(k)) lines.push(`  ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
  if (r.event === "term-run" && !("output" in r)) lines.push("  output: not kept on the record — restored from the row, not re-run");
  return lines.join("\n");
}

// GFP PASS 34 — the pattern act at the reopen door. When a door result's
// ground address is re-opened, the shadow is asked whether the note it was
// minted for still stands in any loaded source: `correspond` (relative-
// pattern.js) runs the whole triad — drift checks the ground, reanchor recalls
// the figure, and the pattern lands agree / repaired / ground-shifted / apart.
// A repaired address is shown as re-anchored from memory, never as if it had
// always been the address; a true loss is apart, never papered over (P2).
const NOTE_FIELDS = Object.freeze(["output", "note", "answer", "text", "result", "description", "because"]);

/** The note a door row's address was minted for, or null — the figure's words. */
export function noteOf(row) {
  if (!row || typeof row !== "object") return null;
  for (const k of NOTE_FIELDS) if (typeof row[k] === "string" && row[k].trim()) return row[k].trim();
  return null;
}

/** The pattern act over a reopen pick: does the address still name its note?
 * Returns the `correspond` verdict (agree / repaired / ground-shifted / apart)
 * with the note and addresses, or a typed refusal. The field and the sources
 * are injected — this module stays pure and the page owns the memory. */
export function correspondFor(pick, field, sources, { draws = 120 } = {}) {
  if (!pick || pick.refused) return { verdict: "no_pick" };
  const at = pick.at ?? pick.address;
  if (!at || !/^.+?#\d+-\d+$/.exec(String(at))) return { verdict: "not_a_span", at: at ?? null };
  const note = noteOf(pick.row);
  if (!note) return { verdict: "no_note", at };
  if (!field || !field.size) return { verdict: "no_field", at };
  if (!sources || !Object.keys(sources).length) return { verdict: "no_sources", at };
  try {
    const c = correspond(at, note, field, sources, { draws });
    return { ...c, was: c.was ?? at, at: c.at ?? at, note };
  } catch (e) { return { verdict: "error", at, error: String(e?.message ?? e) }; }
}
