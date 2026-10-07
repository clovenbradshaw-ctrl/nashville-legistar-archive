// bench.mjs — THE BENCH LEDGER: claims a person writes, checks anyone can re-run.
//
// Fold invariant: THE TOOL NEVER UPGRADES A CLAIM. A claim is written by a
// named author; a status moves only when a named person (or a named checker)
// promotes it against evidence that is on the ledger; and the words the
// surface shows for a claim are built from its fields — there is no free-text
// summary path, so a summary cannot grow wider than what was checked.
//
// Three entry kinds, append-only, each sealed by a SHA-256 chained to the
// previous entry (so an edit anywhere breaks every later hash):
//   card    a claim. { id, text, author, sources? }  starts `stated`.
//   run     one execution. The CODE is stored (and hashed), the inputs are
//           byte-addressed quotes, the output is stored, and the run states
//           its own SCOPE and its own RESULT on lines of its output:
//              #scope {"kind":"range","lo":2,"hi":3073}
//              #result true
//           A run that declares no scope has scope `undeclared`; one that
//           prints no #result has result null — neither can support a status.
//   promote a status change { card, to, by, evidence }.
//
// THE LADDER: stated -> conjectured -> computed_in_range -> proved.
//   conjectured        a human says they believe it. by: human.
//   computed_in_range  needs a CHECK run with result true and a declared
//                      scope, AND a CONTROL run on the same card whose result
//                      is false — a check nobody has seen fail proves only
//                      that the check runs. Scope is exhaustive over a finite
//                      object ("instance"), a "range", or a "sample" (which
//                      is said to be a sample).
//   proved             needs by: a human or a named checker AND an evidence
//                      reference. A model may never be `by`.
// A card authored by a model is `proposed`: it can be read, never promoted
// on the model's say-so.

import { sha256 } from "../../kernel/sha256.js"; // pure, so a page can re-verify a seal (was node:crypto; byte-identical, conformance/sha256.test.mjs)

export const BENCH_SCHEMA = "EOBench@1";
export const STATUSES = Object.freeze(["stated", "conjectured", "computed_in_range", "proved"]);
const RANK = Object.fromEntries(STATUSES.map((s, i) => [s, i]));

const sha = (s) => sha256(s);
// Recursive key-sorted JSON. (A replacer ARRAY would filter nested keys by the
// top level's names, leaving `scope.lo` outside the seal — so it is not used.)
export const canon = (v) => Array.isArray(v) ? `[${v.map(canon).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`
  : JSON.stringify(v ?? null);
const isModel = (who) => /^model:/i.test(String(who ?? ""));
const isHuman = (who) => /^(human|checker):\S+/i.test(String(who ?? ""));

export function emptyBench() { return Object.freeze({ schema: BENCH_SCHEMA, entries: Object.freeze([]) }); }

export function seal(log, body) {
  const prev = log.entries.length ? log.entries[log.entries.length - 1].hash : null;
  const seq = log.entries.length;
  const entry = { ...body, seq, prev };
  entry.hash = sha(canon(entry));
  return Object.freeze({ schema: log.schema ?? BENCH_SCHEMA, entries: Object.freeze([...log.entries, Object.freeze(entry)]) });
}

/** verifyChain(log) -> { ok } | { ok:false, at, reason } — re-derives every seal. */
export function verifyChain(log) {
  let prev = null;
  for (const e of log.entries) {
    const { hash, ...rest } = e;
    if (e.prev !== prev) return { ok: false, at: e.seq, reason: "prev does not match" };
    if (sha(canon(rest)) !== hash) return { ok: false, at: e.seq, reason: "entry was altered" };
    prev = hash;
  }
  return { ok: true };
}

const cards = (log) => log.entries.filter((e) => e.kind === "card");
const cardOf = (log, id) => cards(log).find((c) => c.id === id) ?? null;

/** addCard(log, { id, text, author, sources }) -> { log } | { error } */
export function addCard(log, { id, text, author, sources = [] }) {
  if (!id || cardOf(log, id)) return { error: "card id missing or already used" };
  if (!String(text ?? "").trim()) return { error: "a card needs its claim text" };
  if (!isHuman(author) && !isModel(author)) return { error: 'author must be named: "human:<name>" or "model:<name>"' };
  return { log: seal(log, { kind: "card", id, text: String(text), author, proposed: isModel(author), sources }) };
}

/** parseRun(output) -> { scope, result } — read off the run's OWN lines. */
export function parseRun(output) {
  let scope = { kind: "undeclared" };
  let result = null;
  for (const line of String(output ?? "").split("\n")) {
    const s = line.match(/^#scope\s+(\{.*\})\s*$/);
    if (s) { try { const o = JSON.parse(s[1]); if (validScope(o)) scope = o; } catch { /* stays undeclared */ } }
    const r = line.match(/^#result\s+(true|false)\s*$/);
    if (r) result = r[1] === "true";
  }
  return { scope, result };
}

function validScope(o) {
  if (o?.label !== undefined && typeof o.label !== "string") return false; // an optional label names WHICH range/sample this is
  if (o?.kind === "range") return Number.isFinite(o.lo) && Number.isFinite(o.hi) && o.lo <= o.hi;
  if (o?.kind === "instance") return typeof o.label === "string" && o.label.length > 0;
  if (o?.kind === "sample") return Number.isFinite(o.n) && o.n > 0 && Number.isFinite(o.seed);
  return false;
}

/** addRun(log, { id, card, role, code, output, ok, inputs, ms })
 *  `role` is "check" or "control". Scope and result are PARSED from the
 *  output, never passed in — the run says what it covered. */
export function addRun(log, { id, card, role, code, output, ok = true, inputs = [], ms = null }) {
  if (!cardOf(log, card)) return { error: "no such card" };
  if (role !== "check" && role !== "control") return { error: 'role must be "check" or "control"' };
  if (log.entries.some((e) => e.kind === "run" && e.id === id)) return { error: "run id already used" };
  const { scope, result } = parseRun(output);
  return { log: seal(log, { kind: "run", id, card, role, code: String(code), codeSha: sha(String(code)), inputs, output: String(output), ok, scope, result, ms }) };
}

const runs = (log, card) => log.entries.filter((e) => e.kind === "run" && e.card === card);

/** support(log, cardId) -> { checks, controls, scopes } — what the ledger backs. */
export function support(log, cardId) {
  const rs = runs(log, cardId).filter((r) => r.ok);
  const checks = rs.filter((r) => r.role === "check" && r.result === true && r.scope.kind !== "undeclared");
  const controls = rs.filter((r) => r.role === "control" && r.result === false);
  // Check runs that RAN and came back false are part of what the ledger backs
  // too: a claim that holds under one declared variant and not another must say so.
  const failed = rs.filter((r) => r.role === "check" && r.result === false);
  return { checks, controls, failed, scopes: checks.map((r) => r.scope) };
}

export function statusOf(log, cardId) {
  let s = "stated";
  for (const e of log.entries) if (e.kind === "promote" && e.card === cardId) s = e.to;
  return s;
}

/** promote(log, { card, to, by, evidence }) -> { log } | { error }
 *  Refusals are typed strings a settings/UI layer can show verbatim. */
export function promote(log, { card, to, by, evidence = null }) {
  const c = cardOf(log, card);
  if (!c) return { error: "no such card" };
  if (!(to in RANK)) return { error: "unknown status" };
  if (isModel(by) || !isHuman(by)) return { error: 'a promotion needs a named human or checker ("human:<name>" / "checker:<name>"), never a model' };
  const from = statusOf(log, card);
  if (RANK[to] <= RANK[from]) return { error: `already ${from}; a status only moves up, and a retraction is a new card` };
  if (to === "computed_in_range") {
    const s = support(log, card);
    if (!s.checks.length) return { error: "no passing check run with a declared scope" };
    if (!s.controls.length) return { error: "no control run that failed as it should — a check nobody has seen fail proves only that it runs" };
  }
  if (to === "proved" && !evidence) return { error: "proved needs an evidence reference" };
  return { log: seal(log, { kind: "promote", card, from, to, by, evidence }) };
}

export function scopePhrase(s) {
  const tag = s.label && s.kind !== "instance" ? ` — ${s.label}` : "";
  if (s.kind === "range") return `every case from ${s.lo} to ${s.hi}${tag}`;
  if (s.kind === "instance") return `the whole of one finite object (${s.label})`;
  if (s.kind === "sample") return `a sample of ${s.n} (seed ${s.seed}), not exhaustive${tag}`;
  return "an undeclared scope";
}

/** phrase(log, cardId) -> the ONLY sentence the surface shows for a claim.
 *  Built from fields; no free text but the human's own claim, quoted. */
export function phrase(log, cardId) {
  const c = cardOf(log, cardId);
  if (!c) return null;
  const st = statusOf(log, cardId);
  const q = `“${c.text}”`;
  const who = c.proposed ? ` (proposed by ${c.author}; not yet adopted)` : "";
  if (st === "stated") return `Stated by ${c.author}, nothing checked${who}: ${q}`;
  if (st === "conjectured") return `Conjectured, no proof${who}: ${q}`;
  if (st === "computed_in_range") {
    const sup = support(log, cardId);
    const scopes = sup.scopes.map(scopePhrase);
    const against = sup.failed.length ? ` It did NOT hold over ${sup.failed.map((r) => scopePhrase(r.scope)).join("; ")}.` : "";
    return `Checked over ${scopes.join("; ")}.${against} Nothing is claimed beyond that — this is not a proof. The claim as written: ${q}`;
  }
  const p = [...log.entries].reverse().find((e) => e.kind === "promote" && e.card === cardId && e.to === "proved");
  return `Proved — ${p.by}, evidence ${p.evidence}: ${q}`;
}
