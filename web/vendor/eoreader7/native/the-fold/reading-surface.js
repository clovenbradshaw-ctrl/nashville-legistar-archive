// reading-surface.js — the per-sentence reading surface, computed by the
// ENGINE and returned in the proxy turn's `reading`. This is the
// ONE-ENGINE-PLAN's highest-value port: the fold's reader actually looks at
// per-sentence verdicts and addresses (ground-ladder.js's rungs, the
// sentence witness, the answer record), and the engine previously returned
// only claim/relation COUNTS. Everything here is computed from the turn's
// OWN data — the surfaced passages, the ledger notes, the referent index,
// the answer's own relation tier — so a client (the-fold's browser chat,
// the TUI, any OpenAI-shaped caller) receives the same marks the fold's
// renderer draws, without running its own engine.
//
// THE FORM-TIER (2026-09-16, the critique — schema/image/fold): a bound
// sentence now also reports `supplied` — the claim-FORMS the reading
// supplied over the certified bytes (ground-ladder.js::suppliedForms). The
// addresses certify the image; the `supplied` rows name the form the
// reading supplied there (the hypothetical's ground/consequence, the
// sequence) with the material's own image that invoked it. When no form
// overlaps the bound span, `supplied` is absent — the reading supplied no
// rule beyond the ends themselves. Schema bumped to EOReadingSurface@2.
//
// Mechanical, model-free where possible: the ground ladder's `bound`/
// `recorded`/`derived`/`named`/`self` rungs cost no model call (they read
// the relation tier, the ledger, and the referent index — all already
// computed). Only the WITNESS rung (`witnessed`) spends model asks, and
// only when the caller declares a budget (P9 — the fold's own contract:
// "the budget is the caller's own declared number, never a default").
// Absent a declared budget the witness rows are typed `skipped`, and the
// ladder says so on each sentence (`reached.witness: false`), exactly as
// the fold's surface already does when a witness was never asked.
//
// The organs arrive INJECTED (the cast.js discipline) so this module loads
// by relative path in tests and stays decoupled from the runner's imports.

import { groundOf, groundLine, tierWord } from "./ground-ladder.js";

export const SURFACE_SCHEMA = "EOReadingSurface@2";

/** Map surfaced segments → the {ref, text} passages the ladder and reader expect. */
export function passagesFromSegments(segments = []) {
  const out = [];
  for (const s of segments) {
    const text = String(s?.text ?? "");
    if (!text.trim()) continue;
    const ref = s?._ledger?.source ?? s?.source ?? s?.ref ?? "surf";
    out.push({ ref: String(ref), text });
  }
  return out;
}

/**
 * Split an answer into its sentences, using the caller's sentence splitter
 * (the same one the relation tier and the witness both use). Returns the
 * sentences that carry content (a sentence with only an address bracket or
 * whitespace is not a claim surface).
 */
export function sentencesOf(answer, splitSentences) {
  if (typeof splitSentences !== "function") return [];
  let list = [];
  try { list = splitSentences(String(answer ?? "")); } catch { return []; }
  return (list ?? [])
    .map((s) => (typeof s === "string" ? s : s?.text ?? ""))
    .map((s) => String(s).replace(/\[\s*[^\]]*\](?:~[^\]]*)?\s*$/g, "").trim())
    .filter((s) => /[a-zA-Z0-9\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u4E00-\u9FFF]/.test(s));
}

/**
 * Build the ground-ladder context for one sentence, from the turn's own
 * data: its relation claims (verdicts), the witness row, the ledger notes,
 * derived facts, live disputes, the surfaced passages, the referent index's
 * resolve, and the model. A caller that has no derived/disputes passes
 * empty arrays — the ladder's rungs simply do not fire, and the absence is
 * typed in `reached`.
 */
export function ladderCtxFor({ claims = [], witness = null, notes = [], derived = [], disputes = null, passages = [], resolveName = null, model = null, forms = [] } = {}) {
  return { claims, witness, notes, derived, disputes, passages, resolveName, model, forms };
}

/**
 * The per-sentence reading surface for one answer: every sentence, its
 * ground-ladder verdict (tier/cell/addresses/phrase/detail), the claim-forms
 * the reading supplied over the certified bytes (`supplied`), and the
 * relation claims that bound to it. `claims` are the relation tier's own
 * per-sentence verdicts (bound/contradicted/unbound/unheard/…). The witness
 * rows may be absent — the ladder then reports `reached.witness: false`.
 * `forms` are output-claims.js's derived forms + sequence rows, earned from
 * the surfaced passages, each with its byte span — the form-tier's input.
 */
export function sentenceSurface(answer, { claims = [], witnessRows = [], notes = [], derived = [], disputes = null, passages = [], resolveName = null, model = null, splitSentences = null, forms = [] } = {}) {
  const sentences = splitSentences ? sentencesOf(answer, splitSentences) : splitFallback(answer);
  const rows = [];
  const byText = new Map();
  for (const c of claims ?? []) {
    const k = String(c?.sentence ?? "");
    if (!byText.has(k)) byText.set(k, []);
    byText.get(k).push(c);
  }
  const witnessByText = new Map();
  for (const w of witnessRows ?? []) {
    const k = String(w?.sentence ?? "");
    if (!witnessByText.has(k)) witnessByText.set(k, w);
  }
  // Sentences the ladder should consider: the relation claims carry their
  // own sentence text, which may not be an exact line of the answer (the
  // reader re-splits). Use the union of answer sentences and claimed
  // sentences, in answer order, then the claims' own.
  const seen = new Set();
  const order = [];
  for (const s of sentences) { if (!seen.has(s)) { seen.add(s); order.push(s); } }
  for (const c of claims ?? []) { const k = String(c?.sentence ?? ""); if (k && !seen.has(k)) { seen.add(k); order.push(k); } }
  for (const s of order) {
    const g = groundOf(s, ladderCtxFor({ claims, witness: witnessByText.get(s) ?? null, notes, derived, disputes, passages, resolveName, model, forms }));
    rows.push({
      sentence: s,
      tier: g.tier,
      cell: g.cell,
      addresses: g.addresses ?? [],
      phrase: g.phrase ?? null,
      detail: g.detail ?? null,
      line: groundLine(g),
      tierWord: tierWord(g.tier),
      reached: g.reached ?? null,
      supplied: g.supplied ?? [],
      fedSources: g.fedSources ?? [],
      fedRefs: g.fedRefs ?? [],
      boundClaims: (byText.get(s) ?? []).map((c) => ({ end1: c.end1 ?? null, label: c.label ?? null, end2: c.end2 ?? null, verdict: c.verdict ?? null, refs: c.refs ?? [], reason: c.reason ?? null })),
    });
  }
  return { schema: SURFACE_SCHEMA, rows, tally: tallyOf(rows) };
}

function tallyOf(rows) {
  const tally = {};
  for (const r of rows) tally[r.tier] = (tally[r.tier] ?? 0) + 1;
  return tally;
}

// A mechanical sentence split when no engine splitter is supplied — the
// same `.`/`!`/`?` boundary the fold's renderer already assumes. Never a
// parser; used only so the ladder can place a claim-less answer's
// sentences at their honest rung (named/self) instead of returning zero
// rows for a one-line answer.
function splitFallback(text) {
  return String(text ?? "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}