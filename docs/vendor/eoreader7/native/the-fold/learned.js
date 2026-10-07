// learned.js — what the instrument got wrong once, kept forever (P126).
//
// User direction (2026-09-05): "we don't need a system that's always right,
// but we do need one that is actively learning to get better … see how we now
// can have permanent memory for an instance."
//
// A correction is worth nothing if it dies with the turn. P125 catches a
// wrong answer and rewrites it; this file makes the catch DURABLE and then
// SPENDS it: every correction is an entry, entries ride the same hash-linked,
// sealed chain a chat is preserved in (matrix.js's `encodeBlock` /
// `mergeChains`, merged as PR #143), and before the next draft the
// corrections in scope for the question are handed back as facts. So the
// instrument does not learn by growing its context — it learns by carrying
// forward the small, addressed record of what the material actually said.
//
//   caught → corrected → recorded → handed back → not made again
//
// WHY THE CHAIN AND NOT A NEW STORE. The room already gives an append-only,
// AES-256-GCM-sealed, hash-linked record whose entries `mergeChains` dedups
// by id and orders by (ts, seq), readable from a fresh browser forever and
// shared with every member. A correction is exactly that shape, so it needs
// no second mechanism: `kind: "correction"` beside `kind: "turn"`. An
// instance's memory is permanent because the ROOM is, and a correction
// learned on one machine reaches every other member's mouth.
//
// PURE: no crypto, no fetch, no storage. It emits the entry objects
// matrix.js seals and reads the ones it opens; matrix.js is not imported, so
// this file runs anywhere and the two meet only at their shared shape (pinned
// in learned.test.mjs).
import { CLAIM_STOPWORDS } from "../organs/grounding.js";
import { atomsOf } from "./snip-check.js";

export const ENTRY_KIND = "correction";
/** How many learned corrections a turn is handed. More is not better: they
 * are facts competing with the material for the mouth's attention. Declared. */
export const RECALL_MAX = 4;
/** A correction must share this many content words with the question to be in
 * scope for it, unless it shares an atom (a name, a number), which is stronger. */
export const SCOPE_WORDS = 2;

const fold = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const words = (t) => new Set(fold(t).split(/[^\p{L}\p{N}_]+/u).filter((w) => w.length > 3 && !CLAIM_STOPWORDS.has(w)));
const atomValues = (t) => new Set(atomsOf(String(t ?? "")).map((a) => fold(a.value)));
/** The words every English sentence has, which therefore say nothing about
 * whether two sentences are about the same thing. Deliberately small and
 * explicit: this serves frame comparison, not relevance scoring. */
const FUNCTION_WORDS = new Set("a an the this that these those it its is are was were be been being of in on at to for with as by from and or but not no nor if then than so such there here have has had do does did will would can could should may might must he she they them their his her our your my me we you i one also more most some any each".split(/\s+/));
// A claim ABOUT THE MATERIAL never speaks in the first or second person.
// "Please provide me with the text from pg2600.txt", "Let me know if you'd
// like to explore other aspects", "I'll be happy to help you find the
// passage" — all were stored as corrections by earlier builds, and no list of
// openers caught them all. Quoted spans are removed first, because the
// material's own dialogue is full of "I" and reporting that is a claim.
const UNQUOTED = (t) => String(t ?? "").replace(/["“][^"”]*["”]/g, " ").replace(/[‘'][^’']{4,}[’']/g, " ");
const PERSON_RE = /\b(?:i|i(?:'|’)(?:m|ll|ve|d)|me|my|mine|we|we(?:'|’)(?:re|ll|ve)|us|our|you|you(?:'|’)(?:re|ll|ve|d)|your|yours|let(?:'|’)?s|lets)\b/i;
const IMPERATIVE_RE = /^\s*(?:please\b|let me\b|let(?:'|’)?s\b|feel free\b|note that\b|remember\b|consider\b|see\b|here(?:'|’)?s\b|once you\b|if you\b|to answer\b|in (?:short|summary|conclusion)\b|based on\b)/i;
/** A sentence's frame: its content tokens, atoms and function words removed. */
const framewords = (t) => { const out = new Set(); for (const w of fold(t).split(/[^\p{L}\p{N}_]+/u)) { if (!w || /^\d+$/.test(w) || FUNCTION_WORDS.has(w)) continue; out.add(w); } return out; };

/**
 * correctionEntry({ claimed, corrected, ref, start, end, question, caught, seq, ts })
 *   → an entry in the chain's own shape: { id, kind, ts, seq, ... }
 * `id` is content identity, so the same correction learned twice on two
 * machines dedups in `mergeChains` without either knowing about the other.
 */
export function correctionEntry({ claimed, corrected = null, ref = null, start = null, end = null, question = "", caught = "answer", seq = 0, ts = Date.now() }) {
  const c = String(claimed ?? "").trim();
  if (!c) return null;
  return {
    id: `c:${hash(`${fold(c)}|${fold(corrected ?? "")}|${ref ?? ""}`)}`,
    kind: ENTRY_KIND, ts, seq,
    claimed: c,
    corrected: corrected ? String(corrected).trim() : null,
    ref, start, end,
    question: String(question ?? "").slice(0, 300),
    caught,
  };
}
/** A short, stable content hash — no crypto needed for an id that only has to
 * collide never in practice and be identical on two machines (FNV-1a, 64-bit). */
function hash(s) {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) { h ^= BigInt(s.charCodeAt(i)); h = BigInt.asUintN(64, h * 0x100000001b3n); }
  return h.toString(36);
}

/** Append, deduped by content identity; newest last. Never mutates the input. */
export function learn(store = [], entry) {
  if (!entry?.id) return store;
  if (store.some((e) => e.id === entry.id)) return store;
  return [...store, { ...entry, seq: entry.seq || store.length }];
}

/**
 * recallFor(question, store, { max, terms }) → the corrections in scope now.
 * In scope = shares an atom with the question (a name or number it mentions),
 * or shares SCOPE_WORDS content words with it. Newest first, capped.
 */
export function recallFor(question, store = [], { max = RECALL_MAX, terms = [] } = {}) {
  const q = `${question} ${terms.join(" ")}`;
  const qa = atomValues(q);
  const qw = words(q);
  const scored = [];
  for (const e of store) {
    if (e.kind !== ENTRY_KIND) continue;
    const hay = `${e.claimed} ${e.corrected ?? ""}`;
    const sharedAtoms = [...atomValues(hay)].filter((a) => qa.has(a));
    const sharedWords = [...words(hay)].filter((w) => qw.has(w));
    if (!sharedAtoms.length && sharedWords.length < SCOPE_WORDS) continue;
    scored.push({ entry: e, atoms: sharedAtoms.length, wordsShared: sharedWords.length });
  }
  return scored
    .sort((a, b) => b.atoms - a.atoms || b.wordsShared - a.wordsShared || (b.entry.ts ?? 0) - (a.entry.ts ?? 0))
    .slice(0, max)
    .map((s) => s.entry);
}

/**
 * learnedFacts(rows) → the block handed to the model before it drafts.
 *
 * ONLY WHAT THE SOURCES DO SAY. Measured live (S77, the same injection
 * question run twice): an earlier draft of this block named the false claim
 * in order to forbid it — "…was said here before and nothing read supports
 * it" — and the result was the opposite of the one intended. Without the
 * block the mouth answered "That passage doesn't exist. It's not in the
 * sources I have access to." WITH it, the mouth capitulated and explained the
 * thing. Repeating a falsehood in order to negate it hands the small model
 * the falsehood; the negation is the part it drops.
 *
 * So a correction reaches the prompt ONLY as the positive sentence the
 * sources actually carry, and never as the error it replaces. A correction
 * with nothing positive to say (we know the claim is unplaced, not what the
 * truth is) does not go to the model at all — it is spent by `learnedGuard`
 * on the draft afterwards, where it belongs. The instrument holds the
 * negative knowledge; the mouth is handed only what can be asserted.
 */
export function learnedFacts(rows = []) {
  const positive = rows.filter((e) => e.corrected && !PERSON_RE.test(UNQUOTED(e.corrected)));
  if (!positive.length) return "";
  const seen = new Set();
  const lines = [];
  for (const e of positive) {
    const t = e.corrected.trim();
    const key = fold(t);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`- ${t}${e.ref ? ` [${e.ref}${e.start != null ? `#${e.start}-${e.end}` : ""}]` : ""}`);
  }
  return `Established here already, from these sources:\n${lines.join("\n")}`;
}

/**
 * learnedGuard(rows) → the claims this instance knows are NOT supported, for
 * the instrument to check the draft against — never for the prompt. Each
 * carries the atoms that identify it, so a draft repeating the claim is
 * caught by the same containment the rest of the checking uses.
 */
export function learnedGuard(rows = []) {
  return rows
    .filter((e) => !e.corrected)
    .map((e) => ({ id: e.id, claimed: e.claimed, atoms: [...atomValues(e.claimed)], frame: [...framewords(e.claimed)] }))
    .filter((g) => g.atoms.length || g.frame.length);
}

/**
 * repeatsKnownFalse(sentence, guards) → the guard a sentence repeats, or null.
 * A repeat shares an atom AND a frame word with the known-false claim: the
 * same distinctive token used the same way, not merely a word in common.
 */
export function repeatsKnownFalse(sentence, guards = []) {
  const sa = atomValues(sentence);
  const sf = framewords(sentence);
  for (const g of guards) {
    const atomHit = g.atoms.some((a) => sa.has(a) || fold(sentence).includes(a));
    if (!atomHit) continue;
    if (!g.frame.length || g.frame.some((w) => sf.has(w))) return g;
  }
  return null;
}

// ── THE LEARNABILITY WALL ───────────────────────────────────────────────────
// What may never be learned (measured live, S77, within nine turns). The
// first learning run stored 72 "corrections", of which 63 were poison, and
// one kind of it was actively dangerous:
//
//   1. AN HONEST REFUSAL. "The provided text snippets don't contain a passage
//      about Scheria" was recorded as a wrong answer. Learning that teaches
//      the mouth not to say the material is silent — it teaches FABRICATION.
//      The null never convicts (THE-NULL-STATES, law 4): a stated absence is
//      a finding, not an error, and is never learnable.
//   2. SCAFFOLDING AND APPARATUS. "* **What is the trigger's claim?**" is
//      markdown furniture; "The material confirms exactly: …" is the
//      instrument's own correction prompt echoed back.
//   3. TALK TO THE READER. "Please provide me with the text from pg2600.txt",
//      "Let me know if you'd like to explore other aspects" — about the
//      conversation, not the material.
//   4. A SENTENCE WITH NO ATOM, or one whose replacement is about something
//      else entirely (that would teach a non sequitur).
const NEG = String.raw`(?:do(?:es)?n['’]t|do(?:es)? not|did not|didn['’]t|cannot|can['’]t|could not|no|none|nothing|never|not|lacks?|without)`;
// The verbs a refusal is built on, with their ordinary inflections — an
// earlier draft matched "mention" and missed "mentions", which is how
// "Nothing in the passages mentions Sherman" was learned as an error.
const SAY = String.raw`(?:contain|mention|say|said|state|include|provide|appear|find|specify|indicate|reference|discuss|describe|cover|address|give|list|record|report|note|detail|elaborate|go into)(?:s|es|ed|ing|n)?`;
const REFUSAL_RE = new RegExp([
  String.raw`\b${NEG}\b[^.]{0,60}?\b${SAY}\b`,
  String.raw`\b(?:is|are|was|were)\s+(?:not\s+)?(?:absent|silent|unavailable|unclear|unspecified|missing)\b`,
  String.raw`\bno\s+(?:passage|mention|reference|information|detail|record|evidence|date|data|text|source)\b`,
  String.raw`\bnot\s+(?:stated|mentioned|specified|provided|found|given|available|present|included|discussed)\b`,
  String.raw`\b(?:unable to|fails? to|falls? short of)\s+\w+`,
].join("|"), "i");
const SCAFFOLD_RE = /^\s*(?:[*#>\-]|\d+\.)|\*\*|^#{1,6}\s|^\s*$|^[A-Z][a-z]+:\s*$/;
const APPARATUS_RE = /\b(?:the material confirms exactly|these sentences say things the sources|never together with what this says about it|what the sources say, verbatim|already found to be wrong|about what the question takes|rewrite only those sentences|reply with the rewritten|established here already|this section should say something about|write about \d+ words)\b/i;

/** A correction whose replacement is about something else teaches a non
 * sequitur. Compared on FRAMES — the sentences with their atoms and function
 * words removed — so "X ran until 2001" → "X ran until 1999" is the same
 * subject while "Prince Andrew met the Emperor" → "Our order should provide
 * means to that end" is not. */
function sameSubject(claimed, corrected) {
  if (!corrected) return true;
  const a = framewords(claimed), b = framewords(corrected);
  if (!a.size || !b.size) return true;
  for (const w of a) if (b.has(w)) return true;
  return false;
}

/**
 * learnable(sentence, corrected) → why it may not be learned, or null when it
 * may. Exported so the wall is readable by a test, and by any caller that
 * wants to know what this instrument refuses to carry forward. It runs on the
 * way IN and on the way OUT: a store written by an older build can hold
 * shapes the wall has since learned to refuse.
 */
export function learnable(sentence, corrected = null) {
  const t = String(sentence ?? "").trim();
  // Shape before length, so a short heading reports the reason it is refused
  // for rather than merely being short.
  if (SCAFFOLD_RE.test(t)) return "scaffolding, not a claim";
  if (t.length < 12) return "too short to be a claim";
  if (APPARATUS_RE.test(t)) return "the instrument's own words, echoed back";
  if (REFUSAL_RE.test(t)) return "a stated absence — a finding, never an error (the null never convicts)";
  const bare = UNQUOTED(t);
  if (PERSON_RE.test(bare) || IMPERATIVE_RE.test(bare)) return "spoken to or about the reader, not a claim about the material";
  if (!atomsOf(t).length) return "no name, number or date in it to have been wrong about";
  if (!sameSubject(t, corrected)) return "its replacement is about something else — that would teach a non sequitur";
  return null;
}

/**
 * fromOutcomes({ outcomes, flags, question, ts }) → entries for what a turn's
 * correction actually caught: a rewritten sentence (claimed → corrected) and a
 * flag that stood after the rewrite (claimed, nothing found). A refused
 * rewrite is NOT learned as a correction — the instrument does not know what
 * the right answer is, only that this one is unplaced.
 */
export function fromOutcomes({ outcomes = [], flags = [], question = "", ts = Date.now() } = {}) {
  const out = [];
  for (const o of outcomes) {
    if (learnable(o.sentence, o.outcome === "rewritten" ? o.candidate : null)) continue;
    if (o.outcome === "rewritten" && o.candidate) out.push(correctionEntry({ claimed: o.sentence, corrected: o.candidate, question, caught: "answer", ts }));
    else if (o.outcome === "dropped") out.push(correctionEntry({ claimed: o.sentence, corrected: null, question, caught: "answer", ts }));
  }
  for (const f of flags) {
    if (learnable(f.sentence)) continue;
    const c = f.contradiction;
    out.push(correctionEntry({ claimed: f.sentence, corrected: null, ref: c?.ref ?? null, start: c?.start ?? null, end: c?.end ?? null, question, caught: "answer", ts }));
  }
  return out.filter(Boolean);
}

/** Entries for what the PREMISE check caught: the question's own false claim. */
export function fromPremises(check, { question = "", ts = Date.now() } = {}) {
  const out = [];
  for (const r of (check?.contradicted ?? []).filter((r) => !learnable(r.text, r.contradiction?.text ?? null))) out.push(correctionEntry({ claimed: r.text, corrected: r.contradiction?.text ?? null, ref: r.contradiction?.ref ?? null, start: r.contradiction?.start ?? null, end: r.contradiction?.end ?? null, question, caught: "premise", ts }));
  for (const r of (check?.unverified ?? []).filter((r) => !learnable(r.text))) out.push(correctionEntry({ claimed: r.text, corrected: null, question, caught: "premise", ts }));
  return out.filter(Boolean);
}

/** The corrections in a chain's merged entries — what an instance has learned, ever. */
export const correctionsIn = (entries = []) => entries.filter((e) => e?.kind === ENTRY_KIND);
