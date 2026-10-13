// fold-chat-gates.js — the HISTORY of the chat's gates (the fold's a900f6e, vendored at vendor/fold/). Pure but for the injected storage.
//
// Constitution II.10 over time: a gate is verified against what it should reject, and "pass from a gate nothing has ever failed" is refused.
// One run cannot show a gate can reject; a history can. The Pivot's gates (fold-chat-pivot.js) are exactly such gates, so each keeps a ledger:
//   rows      sentences the Pivot read on that turn (every gate is offered the same draft; DECLARED, not the count that reached each gate)
//   rejected  sentences THIS gate withheld
//   failed    1 when the realiser's own check (`verify` = verifyPivot) refused the spoken text
// The verdict is the fold's own `gateVerdict` over the CUMULATIVE totals: `fail` whatever the rejections · `unmeasured` while the gate has
// never rejected anything (shown, not measured) · `pass` only after it has rejected something, ever. `pass` means "this gate can reject" —
// not that it is right. The ledger lives in localStorage["fold-chat:gates"], is bounded (old runs fold into one summary record per gate,
// cumulative totals unchanged) and never throws: blocked storage is an empty history, and an empty history is `unmeasured`, never `pass`.

import { createGateLedger, recordGate, cumulative, gateLedgerToJSON, gateLedgerFromJSON } from "./vendor/fold/gate-ledger.mjs";
import { gateVerdict } from "./vendor/fold/reasoning-stages.mjs";

export const GATES_KEY = "fold-chat:gates";
/** The Pivot's gate names, in the order the Pivot applies them (then the realiser's own check). */
export const PIVOT_GATES = Object.freeze(["no_words", "orphan_anaphor", "label", "boilerplate", "third_person", "attribution", "number_not_given", "ungrounded", "question", "truncated", "verify"]);
/** DECLARED (II.11), giver: the author, 2026-10-06 — raw records kept per gate before older runs fold into one summary record. */
export const KEEP_PER_GATE = 200;
const key = (g) => "pivot:" + g;

const gateOfWhy = (why) => String(why || "").split(":")[0];

/** What one Pivot result says to each gate: { gate: { rows, rejected, failed } }. A turn the Pivot did not read (no grammar) says nothing. */
export function gateRows(pv, { verified = true } = {}) {
  if (!pv || pv.skipped) return {};
  const rows = pv.stats?.in ?? 0, spoken = pv.stats?.kept ?? 0;
  const out = {};
  for (const g of PIVOT_GATES) out[g] = { rows: g === "verify" ? spoken : rows, rejected: 0, failed: 0 };
  for (const d of pv.dropped || []) { const g = gateOfWhy(d.why); if (out[g]) out[g].rejected++; }
  out.verify.failed = verified ? 0 : 1;
  return out;
}

export function loadLedger(storage = (typeof localStorage !== "undefined" ? localStorage : null)) {
  try { return gateLedgerFromJSON(storage?.getItem?.(GATES_KEY) ?? "[]"); } catch { return createGateLedger(); }
}
export function saveLedger(ledger, storage = (typeof localStorage !== "undefined" ? localStorage : null)) {
  try { storage?.setItem?.(GATES_KEY, gateLedgerToJSON(compact(ledger))); return true; } catch { return false; }
}

/** Fold the oldest records of each gate into one summary record so the ledger stays bounded; every gate's cumulative totals are unchanged. */
export function compact(ledger, keep = KEEP_PER_GATE) {
  const by = new Map();
  for (const r of ledger.records) { if (!by.has(r.gate)) by.set(r.gate, []); by.get(r.gate).push(r); }
  const records = [];
  for (const [gate, rs] of by) {
    if (rs.length <= keep) { records.push(...rs); continue; }
    const old = rs.slice(0, rs.length - keep + 1);
    records.push({ gate, at: old[old.length - 1].at, rows: old.reduce((a, r) => a + r.rows, 0), rejected: old.reduce((a, r) => a + r.rejected, 0), failed: old.reduce((a, r) => a + r.failed, 0), runs: old.reduce((a, r) => a + (r.runs || 1), 0) }, ...rs.slice(old.length));
  }
  return createGateLedger({ records: records.sort((a, b) => a.at - b.at) });
}

/** The totals across every record of one gate (a summary record counts as the runs it folded). */
export function totals(ledger, gate) {
  const rs = ledger.records.filter((r) => r.gate === gate);
  const c = cumulative(ledger, { gate });
  return { ...c, runs: rs.reduce((a, r) => a + (r.runs || 1), 0) };
}

export function verdictOf(ledger, name) {
  const t = totals(ledger, key(name));
  const verdict = gateVerdict({ rows: t.rows, rejected: t.rejected, failed: t.failed });
  const reason = verdict === "fail" ? `the gate ${name} has failed ${t.failed} run(s) of ${t.runs}`
    : verdict === "unmeasured" ? (t.runs ? `the gate ${name} has never rejected anything across ${t.runs} run(s) — shown, not measured` : `the gate ${name} has no history yet — shown, not measured`)
    : `the gate ${name} has rejected before (${t.rejected} across ${t.runs} run(s))`;
  return { gate: name, verdict, reason, cumulative: t };
}

/** The verdict of every Pivot gate on the history as it stands (records nothing). */
export function report(ledger) { return PIVOT_GATES.map((g) => verdictOf(ledger, g)); }

/**
 * Record one Pivot turn into the ledger in `storage` and return the verdicts the history now gives: { gates: { name: verdict }, report }.
 * Never throws; a turn the Pivot did not read records nothing and still returns the standing verdicts.
 */
export function noteRun(pv, { verified = true, at = Date.now(), storage } = {}) {
  let ledger; try { ledger = loadLedger(storage); } catch { ledger = createGateLedger(); }
  const rows = gateRows(pv, { verified });
  for (const [g, r] of Object.entries(rows)) recordGate(ledger, { gate: key(g), rows: r.rows, rejected: r.rejected, failed: r.failed, at });
  if (Object.keys(rows).length) saveLedger(ledger, storage);
  const rep = report(ledger);
  return { gates: Object.fromEntries(rep.map((r) => [r.gate, r.verdict])), report: rep };
}

/** One plain line for the feed: how many gates have never been seen to reject anything. */
export function gatesLine(rep) {
  const list = Array.isArray(rep) ? rep : [];
  const un = list.filter((r) => r.verdict === "unmeasured").length, fails = list.filter((r) => r.verdict === "fail").length;
  if (fails) return `${fails} gate${fails === 1 ? "" : "s"} failed`;
  if (!list.length) return "";
  return un ? `${un} of ${list.length} checks have never withheld anything — shown, not measured` : `all ${list.length} checks have withheld something before`;
}
