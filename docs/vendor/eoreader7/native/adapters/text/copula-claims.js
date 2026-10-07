// adapters/text/copula-claims.js — THE COPULA READER FOR THE MECHANICAL RUNG
// (2026-09-28, fast-reasoning v6's first named lever). The relation reader
// reads no claim from a copula sentence whose complement is an adjective, a
// superlative or a number — "Mina was the brightest and most cheerful of
// us", "Renfield is fifty-nine" — 22 of 34 claims in the registered runs,
// every one of them sent to a model that answered right on three. This
// organ reads exactly that shape, mechanically, and nothing else.
//
// THE READING. A claim is split at its first copula form (phasepost.js
// COPULA_FORMS, lang/en, plus "became"): a SUBJECT side and a COMPLEMENT
// side, each folded to content tokens (organs/source.js tokenize). A
// sentence of the material STATES the claim when it carries a copula and,
// on the subject side of that copula, every content token of the claim's
// subject, and, on the complement side, every content token of the claim's
// complement (P31's company, both sides, all tokens — never a bag of the
// whole sentence). It DENIES the claim when it states it with a received
// negation word (priors.js NEGATION_WORDS) between the subject and the
// complement. A sentence that carries the subject but a different
// complement says nothing about the claim — OPEN, never refused: the book
// may state it elsewhere.
//
// ADJACENCY (v7 of fast-reasoning.mjs, found by the shuffled control, not
// by the real book): "…said Van Helsing, 'and all I ask of you IS that…
// you will FIRST consider…'" carried the subject somewhere before a copula
// and a one-word complement somewhere after it, and read as `holds` for a
// false claim. Containment on each side is two bags; the claim is an
// ARRANGEMENT. So the subject's last content word must be the LAST content
// word before the copula, and the complement's first content word the
// FIRST after it — the sentence's own order, never two bags.
//
// WHAT IT NEVER DOES. It does not match a subject that is a pronoun or a
// description (the claim's subject side must carry at least one content
// token); it does not fold synonyms or numerals ("fifty-nine" is not "59" —
// a morphology or numeral prior is the caller's to inject as `sameForm`);
// it does not read across sentences. Precision first: the mechanical rung
// answers with no model, so a wrong `holds` here is a fabrication with a
// clean face.

import { tokenize } from "../../organs/source.js";
import { COPULA_FORMS } from "./phasepost.js";
import { NEGATION_WORDS } from "./priors.js";

export const COPULA_CLAIM_FORMS = Object.freeze(new Set([...COPULA_FORMS, "became", "become", "becomes"]));
const WORD = /[\p{L}\p{N}][\p{L}\p{N}’'.-]*/gu;
const fold = (w) => String(w ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Every split of a text at a copula form, in order: [{ subject, copula, complement, at }]. A sentence may carry several ("We tried to BE cheerful..., and Mina WAS the brightest"); the reader tries each. */
export function splitsAtCopula(text, { forms = COPULA_CLAIM_FORMS } = {}) {
  const t = String(text ?? ""); const out = [];
  for (const m of t.matchAll(WORD)) {
    const w = fold(m[0]).replace(/[.’']+$/u, "");
    if (forms.has(w)) out.push({ subject: t.slice(0, m.index), copula: m[0], complement: t.slice(m.index + m[0].length), at: m.index });
  }
  return out;
}
/** The first split, for a CLAIM (one copula, by the claim's own shape). */
export const splitAtCopula = (text, opts) => splitsAtCopula(text, opts)[0] ?? null;

/**
 * readCopulaClaim(claim, passages, { splitSentences, sameForm }) -> { verdict, decider, ref, because }
 *   verdict: "holds" | "refused" | "open" | "not_copula"
 *   passages: [{ ref, text }]
 *   splitSentences: the caller's sentence splitter (adapters/text/spans.js), returning strings or { text }
 *   sameForm: optional (a, b) -> boolean over folded tokens (a morphology prior's sameAct); exact match otherwise
 */
export function readCopulaClaim(claim, passages, { splitSentences, sameForm = null } = {}) {
  if (typeof splitSentences !== "function") throw new TypeError("readCopulaClaim: splitSentences is the caller's");
  const parts = splitAtCopula(claim);
  if (!parts) return { verdict: "not_copula", decider: null, ref: null, because: "the claim carries no copula form" };
  const subj = tokenize(parts.subject), comp = tokenize(parts.complement);
  if (!subj.length || !comp.length) return { verdict: "not_copula", decider: null, ref: null, because: "a copula claim needs a content word on each side" };
  const same = (a, b) => a === b || (typeof sameForm === "function" && (sameForm(a, b) || sameForm(b, a))); // symmetric: a prior's sameAct is, a caller's stub may not be
  const carries = (toks, need) => need.every((n) => toks.some((t) => same(t, n)));
  let open = null;
  for (const p of passages ?? []) {
    for (const s0 of splitSentences(String(p.text ?? ""))) {
      const s = typeof s0 === "string" ? s0 : s0.text;
      for (const sp of splitsAtCopula(s)) {
        const left = tokenize(sp.subject);
        if (!carries(left, subj)) continue;
        // adjacency, subject side: the claim subject's last word is the last content word before the copula — a negation word between them is the polarity, not a word of the subject ("Mina never was")
        const leftAdj = left.filter((w) => !NEGATION_WORDS.has(w));
        if (!leftAdj.length || !same(leftAdj[leftAdj.length - 1], subj[subj.length - 1])) continue;
        const right = tokenize(sp.complement);
        // adjacency, complement side: the claim complement's first word is the first content word after the copula ("was not the only" — the negation is the polarity)
        const rightAdj = right.filter((w) => !NEGATION_WORDS.has(w));
        if (!rightAdj.length || !same(rightAdj[0], comp[0])) { open = open ?? { decider: s.trim(), ref: p.ref }; continue; }
        if (!carries(right, comp)) { open = open ?? { decider: s.trim(), ref: p.ref }; continue; }
        // the complement is stated; a negation BETWEEN the subject's last word and the complement's own words denies it
        // (a negation in an earlier clause — "Though he never slept, Renfield was the calmest" — is not this copula's)
        const afterSubject = sp.subject.slice(indexAfterLast(sp.subject, subj, same));
        const between = String(sp.complement).slice(0, Math.max(0, indexOfLast(sp.complement, comp, same)));
        const negated = tokenizeRaw(afterSubject + " " + sp.copula + " " + between).some((w) => NEGATION_WORDS.has(w));
        return { verdict: negated ? "refused" : "holds", decider: s.trim(), ref: p.ref, because: negated ? "the sentence states the complement under a negation" : "the sentence carries the subject before its copula and every complement word after it" };
      }
    }
  }
  return { verdict: "open", decider: open?.decider ?? null, ref: open?.ref ?? null, because: open ? "a sentence carries the subject with a different complement — the book may state it elsewhere" : "no sentence carries the subject before a copula" };
}

/** The character offset just past the LAST claim subject token in the subject side. */
function indexAfterLast(subject, need, same) {
  let last = 0;
  for (const m of String(subject).matchAll(WORD)) { const w = fold(m[0]); if (need.some((n) => same(w, n))) last = m.index + m[0].length; }
  return last;
}
const tokenizeRaw = (t) => [...String(t ?? "").matchAll(WORD)].map((m) => fold(m[0]).replace(/[.’']+$/u, ""));
/** The character offset, within the complement, just past the LAST claim complement token found — so a negation is read only between the copula and the complement's own words. */
function indexOfLast(complement, need, same) {
  let last = 0;
  for (const m of String(complement).matchAll(WORD)) { const w = fold(m[0]); if (need.some((n) => same(w, n))) last = Math.max(last, m.index); }
  return last;
}
