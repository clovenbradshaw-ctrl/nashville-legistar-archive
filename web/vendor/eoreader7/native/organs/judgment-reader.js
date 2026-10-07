// organs/judgment-reader.js — READ A JUDGE'S PROSE FOR ITS VERDICT, MECHANICALLY
// (2026-09-28). Text face of kernel/ingestion.js's landJudgment.
//
// User direction, verbatim: "We can't stop it from writing a verdict in
// prose and shouldn't, but we can read that mechanically for the answer."
// So the judge writes whatever it writes. This reader answers two questions
// about what it wrote, and nothing else:
//
//   1. WHICH CANDIDATE DID IT COMMIT TO? A candidate word (holds / refused /
//      undetermined — the request's own list) counts as a commitment when it
//      appears as a whole word, folded, NOT inside a quotation, and NOT in
//      the shadow of a negation (a received negation word within two tokens
//      before it: "not refused", "never holds"). Exactly one committed
//      candidate is the verdict. Several → the LAST sentence decides if it
//      commits to exactly one (a conclusion after deliberation); otherwise
//      no verdict. None → no verdict. Nothing here weighs the argument.
//
//   2. IS WHAT IT POINTS AT IN THE SECTION IT WAS HANDED? The decider is a
//      quoted span in the prose (« », " ", ' '), or, absent quotes, a prose
//      sentence of four words or more; it is ANCHORED when testimony.js's own
//      `becauseContained` finds it in the section (verbatim, or every content
//      word) — the P32 pointer wall, reused, never a second threshold. A
//      judge that cannot point at the bytes did not read them; the kernel
//      lands that as CONTESTED, never as the verdict. `undetermined` needs no
//      decider: there is nothing to point at when nothing settles it.
//
// PURE. No model. The negation class is priors.js's (lang/en) plus the two
// correlatives a verdict sentence uses ("neither … nor"), declared here.

import { becauseContained } from "./testimony.js";
import { tokenize } from "./source.js";
import { NEGATION_WORDS } from "../adapters/text/priors.js";

export const JUDGMENT_NEGATORS = Object.freeze(new Set([...NEGATION_WORDS, "neither", "nor", "not"]));
export const JUDGMENT_NEGATORS_META = Object.freeze({ giver: "lang/en — priors.js NEGATION_WORDS plus the correlatives a verdict sentence uses" });
const NEGATION_WINDOW = 2; // tokens — "not refused", "is never really holds": the shadow a negator casts forward
const MIN_DECIDER_WORDS = 4;

const fold = (t) => String(t ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const QUOTE_RE = /«([^»]{3,})»|"([^"]{3,})"|“([^”]{3,})”|'([^']{6,})'/gu;
const SENTENCE_RE = /[^.!?]+[.!?]?/g;

/** The candidates the prose commits to, outside quotes and out of any negation's shadow. */
export function commitments(prose, candidates) {
  const stripped = String(prose ?? "").replace(QUOTE_RE, " ");
  const toks = fold(stripped).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const out = new Map();
  toks.forEach((t, i) => {
    if (!candidates.includes(t)) return;
    const shadow = toks.slice(Math.max(0, i - NEGATION_WINDOW), i);
    if (shadow.some((w) => JUDGMENT_NEGATORS.has(w))) return;
    out.set(t, (out.get(t) ?? 0) + 1);
  });
  return out;
}

/** The decider: a quoted span the section contains, else a prose sentence the section contains. */
export function anchoredDecider(prose, section) {
  const text = String(prose ?? ""), sec = String(section ?? "");
  if (!sec) return null;
  for (const m of text.matchAll(QUOTE_RE)) { const q = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim(); if (q && becauseContained(q, sec)) return q; }
  for (const m of text.matchAll(SENTENCE_RE)) { const s = m[0].trim(); if (s.split(/\s+/).filter((w) => /\p{L}|\p{N}/u.test(w)).length >= MIN_DECIDER_WORDS && becauseContained(s, sec)) return s; }
  return null;
}

/**
 * A POINTED decider (v1 of eval/identity/fast-reasoning.mjs, 2026-09-28: a 0.5B
 * judge answered "holds" on 34 of 34 asks and quoted nothing — a model that
 * will not quote can still point). When the caller numbered the section's
 * sentences in the ask, a number in the prose ("[3]", "sentence 3", a bare
 * 3 no larger than the count) names sentence 3 as the decider. It is in the
 * section by construction; it ANCHORS only when it carries the claim's own
 * words — the claim's first content token and at least one more (P31's
 * company rule) — so a lazy point at any sentence is still contested.
 */
export function pointedDecider(prose, sentences, claimText = "") {
  if (!Array.isArray(sentences) || !sentences.length) return null;
  const text = String(prose ?? "");
  const nums = [...text.matchAll(/\[(\d{1,3})\]|\bsentence\s+(\d{1,3})\b|(?<![\d.])(\d{1,3})(?![\d.])/gu)].map((m) => Number(m[1] ?? m[2] ?? m[3])).filter((n) => n >= 1 && n <= sentences.length);
  if (!nums.length) return null;
  const n = nums[0];
  const pointed = String(sentences[n - 1] ?? "");
  const claimToks = tokenize(claimText);
  const inPointed = new Set(tokenize(pointed));
  const company = claimToks.length ? inPointed.has(claimToks[0]) && claimToks.slice(1).some((t) => inPointed.has(t)) : false;
  return { index: n, decider: pointed, anchored: company, because: company ? `pointed at sentence ${n}, which carries the claim's own words` : `pointed at sentence ${n}, which does not carry the claim's first content word and another` };
}

/**
 * readJudgment(prose, request, { sentences, claim }) -> { verdict, anchored, decider, because, committed }
 *   request:   EOJudgmentRequest@1 (its `candidates` and `text` — the section — are read; nothing else)
 *   sentences: the section's sentences as numbered in the ask, when the caller numbered them
 *   claim:     the claim's own text, for the pointed decider's company wall
 */
export function readJudgment(prose, request, { sentences = null, claim = "" } = {}) {
  const candidates = [...(request?.candidates ?? [])];
  const committed = commitments(prose, candidates);
  let verdict = null, because;
  if (committed.size === 1) { verdict = [...committed.keys()][0]; because = `one candidate named: ${verdict}`; }
  else if (committed.size === 0) because = "no candidate named outside a negation or a quotation";
  else {
    const sentences = [...String(prose ?? "").matchAll(SENTENCE_RE)].map((m) => m[0].trim()).filter(Boolean);
    const last = commitments(sentences[sentences.length - 1] ?? "", candidates);
    if (last.size === 1) { verdict = [...last.keys()][0]; because = `several candidates named (${[...committed.keys()].join(", ")}); the last sentence commits to ${verdict}`; }
    else because = `several candidates named (${[...committed.keys()].join(", ")}) and no conclusion commits to one`;
  }
  let decider = anchoredDecider(prose, request?.text), pointed = null;
  if (!decider && sentences) { pointed = pointedDecider(prose, sentences, claim); if (pointed?.anchored) decider = pointed.decider; }
  const anchored = verdict === "undetermined" ? true : !!decider;
  const tail = anchored || !verdict ? "" : pointed ? `; ${pointed.because}` : "; nothing it points at is in the section";
  return { verdict, anchored, decider, pointed: pointed ? { index: pointed.index, anchored: pointed.anchored } : null, because: `${because}${tail}`, committed: Object.fromEntries(committed) };
}
