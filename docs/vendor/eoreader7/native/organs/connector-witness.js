// connector-witness.js — a witness-backed alternative to a treebank-built
// POS-vocabulary gate (grammar-lens.js), for exactly the case that gate
// cannot cover: a language nobody has fetched a Universal Dependencies
// treebank and run build-pos-prior.mjs for yet (today: everything except
// English/Russian/Finnish — see live_priors POLICIES.md LP14).
//
// THE QUESTION IS OCCURRENCE-LEVEL, NOT TYPE-LEVEL — "SLOT is not CLASS"
// (the grammar-lens.js header), applied to the witness instead of a
// treebank lookup: this organ never asks "is the WORD FORM X typically a
// verb" (a type-level table lookup, which is what a POS prior answers). It
// asks "does THIS OCCURRENCE of X function as the connecting act between
// these two named spans, in this sentence" — the same instance-vs-type
// distinction roles.js::resolveSpanRole already draws for role resolution,
// pointed at the same slot classifyConnector fills.
//
// THE PROTOCOL is the house discipline (P32's generate arm, extended here
// rather than reused verbatim: witnessNote's select-path is shaped for
// "which of N sentences states this claim" — a search problem — and this
// is a binary judgement about ONE already-identified candidate, so the
// generate-and-arm shape fits, not select-by-index). Ask the real
// candidate; if it says no, trust the no directly (a refusal is never the
// risky direction — this project's own standing "unarmed-yes rule",
// P32/witnessNote's own "an unchallenged yes is not a second witness").
// If it says yes, build a decoy — a genuine OTHER token from the same
// sentence, never invented — and ask the identical question about it. A
// picker that also says yes to the decoy is indiscriminate (it would say
// yes to anything in this sentence) and the real yes is untrusted; only a
// DISCRIMINATING yes (real=yes, decoy=no) confirms the candidate.
//
// MEDIUM SCOPE, DISCLOSED RATHER THAN IMPLIED: this organ answers a
// question that only has content for TEXT — "is this word a verb" has no
// meaning for raw audio or video bytes, which is why event-arrangements.js
// (P86's floor-2-for-non-text) uses a completely different admission
// mechanism (recurrence-gated adjacency with a DECLARED label, never a
// verb-hood check) and is not superseded or touched by this file. This
// organ IS language-general (the prompt names no closed class, no
// English-specific vocabulary, and is validated against Greek as well as
// English — connector-witness.test.mjs) but it is text-only by
// construction, and the `ask` function it is handed determines which
// actual model answers — nothing here is specific to one model.
//
// THIS ORGAN OWNS NO IO — the cast.js/testimony.js discipline exactly:
// `ask` is injected, this file makes zero network calls.

/** A genuine OTHER token from the sentence — never invented, never the
 * candidate label itself, never a token shorter than 2 characters (too
 * little context for the witness to judge). Splits on Unicode letter runs
 * so this works on any script, not just space-delimited Latin text. Order
 * is the sentence's own left-to-right order; a caller wanting a specific
 * decoy passes `prefer`. Returns null when the sentence offers nothing
 * else to ask about — a real, disclosed gap, never a guess. */
export function decoyTokenFor(sentence, label, { exclude = [] } = {}) {
  const skip = new Set([String(label ?? "").trim().toLowerCase(), ...exclude.map((x) => String(x ?? "").trim().toLowerCase())]);
  const tokens = String(sentence ?? "").match(/\p{L}[\p{L}\p{M}'’-]*/gu) ?? [];
  for (const t of tokens) {
    if (t.length < 2) continue;
    if (skip.has(t.toLowerCase())) continue;
    return t;
  }
  return null;
}

export const CONNECTOR_WITNESS_SCHEMA = Object.freeze({
  type: "object",
  properties: { functionsAsVerb: { type: "string", enum: ["yes", "no"] } },
  required: ["functionsAsVerb"],
});

/** The one message shape: a sentence, a specific span inside it marked
 * with «guillemets» (never bold/asterisks — those are ordinary characters
 * in some scripts' orthography and could be mistaken for emphasis the
 * writer intended; guillemets are the mark this project's own crown.js
 * already uses for "this text was inserted by the apparatus, not the
 * source" — the same disclosed-insertion posture, reused). No closed
 * class, no language named: the question is asked of the bytes alone. */
export function buildConnectorMessages(sentence, label) {
  return [
    {
      role: "system",
      content:
        "You will be shown one sentence with one word marked by «guillemets». " +
        "Decide whether the MARKED word functions as the sentence's main verb or " +
        "predicate — the action or state the sentence asserts, connecting its subject " +
        "to what is said about it. Answer no if the marked word is an article, " +
        "conjunction, preposition, pronoun, or a noun standing in another word's place. " +
        "Judge the marked occurrence only, in its own sentence — not whether the word " +
        "could ever be a verb elsewhere.",
    },
    { role: "user", content: markSpan(sentence, label) },
  ];
}

/** Wraps the FIRST occurrence of `label` in «guillemets» — literal
 * substring match, case-sensitive (the extractor's own candidate is a
 * literal span of the sentence, so this always finds it; a caller marking
 * a token synthesised rather than lifted from the sentence gets `null`,
 * a disclosed gap rather than a guess at where to point). */
function markSpan(sentence, label) {
  const s = String(sentence ?? "");
  const l = String(label ?? "");
  const i = l ? s.indexOf(l) : -1;
  if (i === -1) return s;
  return `${s.slice(0, i)}«${l}»${s.slice(i + l.length)}`;
}

/** raw -> {verdict: "yes"|"no"} | {refused: "unreadable"}. Never trusts a
 * shape it did not ask for. */
export function foldConnectorVerdict(raw) {
  let parsed = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { return { refused: "unreadable" }; }
  }
  if (!parsed || (parsed.functionsAsVerb !== "yes" && parsed.functionsAsVerb !== "no")) return { refused: "unreadable" };
  return { verdict: parsed.functionsAsVerb };
}

/**
 * witnessConnector(edge, sentence, {ask, decoyFor}) — one candidate
 * connector, judged. `edge` needs `{label}` at minimum (`end1`/`end2` are
 * read only for the decoy's exclusion list, never required). `ask(messages)
 * -> raw model output` is the one injected crossing (temperature 0 is the
 * caller's own contract to hold, per every sibling witness organ in this
 * project — not enforced here, since this file makes no network call at
 * all).
 *
 * Returns the SAME shape grammar-lens.js's `classifyConnector` returns
 * (`{settled, thraxClass, givers}`), so this is a drop-in ALTERNATIVE
 * implementation of that interface — never a wrapper around it, never a
 * fallback chain. `settled: false` on every refusal (no sentence to test
 * against, no decoy available, an indiscriminate picker, an unreadable
 * response) — an unsettled gate refuses NOTHING (the same posture
 * grammar-lens.js's own asymmetric rule holds: a settled non-verb is
 * refused, everything else stays a candidate).
 */
export async function witnessConnector(edge, sentence, { ask, decoyFor = decoyTokenFor } = {}) {
  if (typeof ask !== "function") throw new TypeError("witnessConnector: ask is injected, never defaulted");
  const label = String(edge?.label ?? edge?.verb ?? "").trim();
  const s = String(sentence ?? "");
  if (!label || !s || !s.includes(label)) {
    return { settled: false, thraxClass: null, givers: { method: "witness-connector", refused: "no-sentence-context" } };
  }
  const real = foldConnectorVerdict(await ask(buildConnectorMessages(s, label)));
  if (real.refused) return { settled: false, thraxClass: null, givers: { method: "witness-connector", refused: real.refused } };
  if (real.verdict === "no") {
    // An unarmed refusal is still a refusal — the risky direction is an
    // unchallenged YES (P32), never an unchallenged no. No decoy is spent.
    return { settled: true, thraxClass: "not-verb", givers: { method: "witness-connector", armed: false } };
  }
  const decoy = decoyFor(s, label, { exclude: [edge?.end1, edge?.end2, edge?.subject, edge?.object].filter(Boolean) });
  if (!decoy) return { settled: false, thraxClass: null, givers: { method: "witness-connector", refused: "no-decoy-available" } };
  const armVerdict = foldConnectorVerdict(await ask(buildConnectorMessages(s, decoy)));
  if (armVerdict.refused) return { settled: false, thraxClass: null, givers: { method: "witness-connector", refused: "arm-" + armVerdict.refused } };
  if (armVerdict.verdict === "yes") {
    // Indiscriminate: this picker says yes to more than one token in this
    // sentence, so its yes on the real candidate decides nothing.
    return { settled: false, thraxClass: null, givers: { method: "witness-connector", refused: "indiscriminate", decoy } };
  }
  return { settled: true, thraxClass: "verb", givers: { method: "witness-connector", armed: true, decoy } };
}
