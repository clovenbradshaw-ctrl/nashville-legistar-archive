// dialogue.js — the loops a conversation needs that the reading already has
// for material, closed over the CONVERSATION — and closed over REFERENTS.
// Pure; the turn (holon.js) and the drivers wire them.
//
// THE RULE THIS FILE KEEPS (P11, P135, "referent model, not pointers"): a
// name in a question or an answer is a CANDIDATE SURFACE; whether it names
// anything, and what, is the referent index's to say (cast.js
// makeReferentIndex — `resolve(name)` → the set of referent ids the loaded
// material establishes). Nothing here compares strings to decide identity.
// The first cut of this file did (capitalised runs, a stop list, folded
// substring containment) and was stopped before it landed: "make sure we
// haven't forgotten the power and centrality of referents."
//
// What stays natural-language is the READER'S SPEECH ACTS — a restatement
// ("so you're saying …"), an anaphor ("he", "those passages"), an ask to
// quote, an ask whether the addresses are real. The reader speaks English
// whatever the material is; those triggers are minimal and question-side.
//
//   referentsOf(text, index)     candidate surfaces (ground-ladder.js::namesIn)
//                                → resolved ids, and the names that resolve
//                                to nothing in the loaded material.
//   bindAnaphora(question, last, index)
//                                a pronoun binds to the last answer's referent
//                                ids in mention order; "those passages" to its
//                                addresses.
//   addressedBy(answer, qRefs, index)
//                                the answer's referents cover the question's —
//                                identity, never a substring.
//   absenceLine(qRefs, index)    a name the material has no referent for is a
//                                typed absence the record states itself.
//   restatementOf / positionOn   the reader's restatement is a claim set the
//                                premise check grades; the record's verdict.
//   refKey(claim, index)         a claim keyed on REFERENT IDS where the index
//                                resolves its ends, on the folded surface only
//                                where it does not — and it says which.
//   selfContradictions(claims, transcript, index)
//   expectationFrom(passages, question, read, index) / errorOf(...)
//                                what the material states about the question's
//                                referents before the mouth; the diff after.
//   historyWindow(history, question, { dmdWindow, index })
//                                the depth of conversation handed to the mouth,
//                                measured on what the question's referents reach.
import { namesIn } from "./ground-ladder.js";
import { claimKey } from "./answer-record.js";
import { tokenize } from "./source.js";

// THE TRIGGERS' LANGUAGE IS DECLARED (READING-SPEC S39, S7): the restatement,
// trailing-check and anaphor patterns below are `lang/en`. A question in
// another declared language gets a typed gap, never an accidental non-match
// read as "no restatement".
export const TRIGGER_LANGUAGE = "en";
export const TRIGGER_LANGUAGE_META = Object.freeze({ giver: "lang/en", scope: "question-side speech acts: restatement, trailing check, pronoun and passage anaphors" });
export const triggerGap = (language) => (language && language !== TRIGGER_LANGUAGE ? { type: "no_trigger_prior_for_language", language, detail: `the question-side triggers are declared for ${TRIGGER_LANGUAGE} only` } : null);

// THE ONE FOLD, BY IMPORT (P7.1: "the same one, by import, never by local
// reimplementation" — the failure this guards against is a retrieval organ
// and a grounding check disagreeing about what a word is, so a found passage
// fails the check that should confirm it). resolutions.js, activation-
// retrieval.js and holon.js's act-key fold all import this rather than
// redefining it; a fourth copy is exactly the shape P7.1 was written for.
export const fold = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ids = (index, name) => { try { const r = index?.resolve?.(name); return r instanceof Set ? r : new Set(r ?? []); } catch { return new Set(); } };
const represent = (index, id) => { try { return index?.represent?.(id) ?? id; } catch { return id; } };

/**
 * Every capitalised run — candidates for RESOLUTION only. The index is the
 * veto ("The", "Why", "Some" resolve to nothing), so this scan carries no
 * stop list and no position rule: an answer that opens "Raskolnikov is a
 * former student" has named him, and only the index can say so.
 */
export const candidatesIn = (text) => {
  const out = new Set();
  for (const m of String(text ?? "").matchAll(/(?:^|[^\p{L}])(\p{Lu}[\p{L}\p{N}'’-]*(?:\s+\p{Lu}[\p{L}\p{N}'’-]*){0,3})/gu)) {
    // Every contiguous sub-run is a candidate too: "Later Razumihin" hid
    // Razumihin from the index otherwise (measured 2026-09-07 — a sentence
    // opening with a capitalised adverb before a name resolved to nothing).
    const toks = m[1].trim().split(/\s+/);
    for (let i = 0; i < toks.length; i++) for (let j = i + 1; j <= Math.min(toks.length, i + 3); j++) { const n = toks.slice(i, j).join(" ").replace(/['’]s$/, ""); if (n.length > 1) out.add(n); }
  }
  return [...out];
};
/**
 * Candidate names → referent ids through the index; and the names that
 * resolve to nothing. Two evidence bars on purpose: PRESENCE needs only the
 * index to resolve a run (any capitalised run is offered); ABSENCE needs a
 * name the text shows evidence of (ground-ladder.js::namesIn — L2: a
 * sentence-initial capital alone is not evidence of a name), because the
 * record will state that absence and "nothing mentions Why" is not one.
 */
export function referentsOf(text, index) {
  const t = String(text ?? "");
  // THE READING'S OWN INDEX RESOLVES WITHOUT CASE (reading-log.js::readingIndexFromLog): every token run of the text is resolved against the referents' own surfaces under the session's fold — a Hebrew question and an English one go through the same line, and no capitalised-run scan is consulted. The scan below is the CAST path (a text presence index) and stands only until the page runs the reader.
  if (typeof index?.resolveIn === "function") {
    const all = index.resolveIn(t);
    const names = [...new Set(namesIn(t).map((n) => n.replace(/['’]s$/u, "")))];
    const unresolved = names.filter((n) => !(index.resolve(n)?.size));
    return { names, ids: all, resolved: [...all].map((id) => ({ name: index.represent(id), ids: [id] })), unresolved, indexed: true, basis: "resolveIn" };
  }
  // A possessive is the name plus a marker ("Lebeziatnikov's" names Lebeziatnikov) — measured live 2026-09-07: the marker reached the index unstripped and the name read as unestablished beside its own resolved form.
  const names = [...new Set(namesIn(t).map((n) => n.replace(/['’]s$/u, "")))];
  const all = new Set(); const resolved = []; const unresolved = [];
  for (const n of new Set([...candidatesIn(t), ...names])) {
    const r = index ? ids(index, n) : new Set();
    if (r.size) { resolved.push({ name: n, ids: [...r] }); for (const id of r) all.add(id); }
  }
  for (const n of names) if (!(index ? ids(index, n).size : 0)) unresolved.push(n);
  return { names, ids: all, resolved, unresolved, indexed: Boolean(index) };
}
/** Surfaces the material established for a referent id — from the index's own events. */
export const surfacesOf = (index, id) => [...new Set((index?.events ?? []).filter((e) => e?.referent_id === id).map((e) => e.surface).filter(Boolean))];

const PRONOUN_RE = /\b(he|she|him|her|his|hers|they|them|their|it|its|that|this|those|these)\b/gi;
const PASSAGE_ANAPHOR_RE = /\b(those|these|that|the)\s+(passages?|quotes?|lines?|excerpts?|citations?|references?|addresses?)\b/i;
// A PARTITIVE QUANTIFIER OVER THE SOURCES ("did EITHER OF THEM mention X?",
// "does ANY OF THESE say Y?") is not a person/entity anaphor — "them" here
// stands for the attached sources themselves, a referent class the index
// (cast.js: people, places, things the MATERIAL's own text establishes) has
// no notion of at all. Stripped before the pronoun scan so this construction
// never falls through to "bind to the last answer's referents."
//
// Measured live (2026-09-08 battery): "did either of them mention a Disney
// movie?" answered (wrongly) by naming a real character while denying it;
// the very next, entirely self-contained question — "do either of them
// mention cats?" — reused the SAME "them" wording, `bindAnaphora` bound it to
// that incidental character (the last answer's own referent, mention-order
// first) since the new question names no referent of its own, and the
// address check then forced the draft to account for a being the cat
// question has nothing to do with — hijacking a fresh question toward the
// previous one instead of letting it retrieve on its own words. Narrow on
// purpose: a bare "them"/"he"/"it" with no quantifier still binds exactly as
// before (the "why did he do it?" case this file's own test already pins).
const QUANTIFIED_SOURCE_RE = /\b(?:either|any|both|neither|none|some|each|one)\s+of\s+(?:them|those|these|it)\b/gi;
/**
 * bindAnaphora(question, last, index) → { ids, refs, pronouns, own }. The
 * question's own referents (`own`) come first; an anaphor binds to the last
 * answer's referent ids in mention order only when the question names none.
 */
export function bindAnaphora(question, last, index) {
  const q = String(question ?? "");
  const own = referentsOf(q, index);
  const qForPronouns = q.replace(QUANTIFIED_SOURCE_RE, " ");
  const pronouns = [...new Set((qForPronouns.match(PRONOUN_RE) ?? []).map((p) => p.toLowerCase()))];
  const passageAnaphor = PASSAGE_ANAPHOR_RE.test(q);
  if (!last || (!pronouns.length && !passageAnaphor)) return { ids: [], refs: [], pronouns: [], own };
  const bound = own.ids.size ? [] : [...referentsOf(last.answer ?? "", index).ids];
  return { ids: bound, refs: passageAnaphor ? [...(last.refs ?? [])] : [], pronouns, own };
}

/** addressedBy(answer, qRefs, index) → which of the question's referents the answer names — by identity. */
export function addressedBy(answer, qRefs, index) {
  const want = [...(qRefs?.ids ?? [])];
  if (!want.length) return null;
  const have = referentsOf(answer, index).ids;
  const named = want.filter((id) => have.has(id));
  const missing = want.filter((id) => !have.has(id));
  return { named, missing, all: missing.length === 0, missingNames: missing.map((id) => represent(index, id)) };
}
/**
 * The typed absence — with TWO bars, because the record will state it.
 * A name the index cannot resolve is `unestablished` when the passages'
 * bytes still carry its surface (measured 2026-09-07: every "Razumihin" in a
 * fixture opened a sentence, the index established nothing, and the first
 * cut declared him absent from passages that name him); it is `absent` only
 * when no passage contains the surface at all. Containment here is a VETO on
 * an absence claim, never identity (P31's shape: a string can refuse a
 * claim, it cannot make one). Only `absent` earns the line.
 */
export function absenceOf(qRefs, passages = [], { vocabulary = null } = {}) {
  const names = qRefs?.unresolved ?? [];
  if (!names.length) return { absent: [], unestablished: [], line: "" };
  // The second bar is TOKENS under the session's one fold (source.js::tokenize — P7.1), over the material's own vocabulary when the caller holds one (the reading index's, built from every chunk), else over the passages handed. A name's tokens all present → unestablished; any token the material never carries → absent.
  const vocab = vocabulary instanceof Set ? vocabulary : new Set(passages.flatMap((p) => tokenize(String(p?.text ?? ""))));
  const absent = [], unestablished = [];
  for (const n of names) { const toks = tokenize(n); (toks.length && toks.every((t) => vocab.has(t)) ? unestablished : absent).push(n); }
  // Plain wording (user, 2026-09-09: this line read as jargon —
  // "referent"/"loaded sources" explain this module's own vocabulary,
  // never the reader's actual question, "is this in what I gave you").
  return { absent, unestablished, line: absent.length ? `Nothing you gave me mentions ${absent.map((n) => `"${n}"`).join(", ")}.` : "" };
}
export const absenceLine = (qRefs, passages = [], opts = {}) => absenceOf(qRefs, passages, opts).line;

// The reader's speech acts, question-side, lang/en, minimal. Widened 2026-09-07 from the wired run's own phrasings: "Did the book say that X?", "Is THIS what the book says?", "Do you agree with this interpretation?" — five reflect turns in 25 and no position, because each missed the trigger by a word.
const RESTATEMENT_RE = /\b(?:so,?\s+(?:you(?:'re| are)\s+(?:saying|telling me)|if I (?:follow|understand)(?: you)?|in other words|basically|then)|if I (?:follow|understand)(?: you)?|you(?:'re| are) saying(?: that)?|is (?:that|this) (?:really |actually )?what (?:the (?:book|text|source|novel)|it) says|did (?:the (?:book|text|source|novel)|it) (?:really |actually )?say that|am I right that|do I have that right|so it(?:'s| is))\b[:,]?\s*/i;
/** The reader's restatement, when the question is one: the clause after the trigger, before the check. */
const TRAILING_CHECK_RE = /\b(?:is (?:that|this) (?:really |actually )?(?:what|how) (?:the (?:book|text|source|novel)|it) (?:says|presents (?:it|this|that|the passage))|did (?:the (?:book|text|source|novel)|it) (?:really |actually )?say (?:that|this|so)|do you agree(?: with (?:this|that)(?: interpretation| reading| view)?)?|is (?:that|this) right|isn'?t that (?:right|so)|am I right(?: about (?:that|this))?|do I have (?:that|this) right|right|correct)\s*\??\s*$/i;
const LEADING_UPTAKE_RE = /^(?:so|well|okay|ok|right|then)[,:]?\s+|^(?:if I (?:follow|understand)(?: you)?|so you(?:'re| are) saying|in other words|basically|I (?:take it|gather|think|see|understand)(?: that)?|it (?:sounds|seems) like|sounds like)[,:]?\s*/i;
const enough = (t) => t.split(/\s+/).filter(Boolean).length >= 3; // the claim's own shape — two ends and a label — the floor the premise check can grade; structural, not tuned
/**
 * The reader's restatement, when the question is one. Two shapes: a LEADING
 * trigger ("so you're saying X — is that right?") restates after it; a
 * TRAILING check ("X. Is that really what the book says?") restates before
 * it — measured 2026-09-07: the reader's reflect turns end this way and had
 * no position until the second shape was read.
 */
export function restatementOf(question, { language = TRIGGER_LANGUAGE } = {}) {
  if (triggerGap(language)) return null; // a typed gap is the caller's to record (holon.js does); this organ never guesses a foreign restatement
  const q = String(question ?? "").replace(/\s+/g, " ").trim();
  const m = RESTATEMENT_RE.exec(q);
  if (m) {
    const rest = q.slice(m.index + m[0].length).replace(/\s*[—–-]+\s*(?:is that|isn'?t that|right|correct|am I right|do I have that right)[^?]*\??$/i, "").replace(/\s*\?\s*(?:is that|isn'?t that)[^?]*\?$/i, "").replace(/\s*(?:is that (?:really )?what (?:the (?:book|text|novel)|it) says|is that right|right|correct)\s*\??$/i, "").replace(/[?.!]+$/, "").trim();
    if (enough(rest)) return rest;
  }
  const t = TRAILING_CHECK_RE.exec(q);
  if (t) {
    const before = q.slice(0, t.index).replace(/\s*[—–,;:-]+\s*$/, "").trim();
    const clause = (before.match(/[^.!?]+[.!?]?\s*$/)?.[0] ?? before).trim().replace(LEADING_UPTAKE_RE, "").replace(LEADING_UPTAKE_RE, "").replace(/[?.!]+$/, "").trim();
    if (enough(clause)) return clause;
  }
  return null;
}
/** positionOn(check) — the record's verdict on a graded restatement; null when the check has no premise. */
export function positionOn(check) {
  const premises = check?.premises ?? [];
  if (!premises.length) return null;
  const unverified = check.unverified?.length ?? 0, contradicted = check.contradicted?.length ?? 0, n = premises.length;
  if (contradicted) return { verdict: "no", text: `No — the sources say otherwise on ${contradicted === n ? "that" : `${contradicted} of ${n} points`}.` };
  if (unverified === n) return { verdict: "not-in-sources", text: "The sources here do not say that." };
  if (unverified === 0) return { verdict: "yes", text: "Yes — that is what the sources say." };
  return { verdict: "partly", text: `Partly — ${n - unverified} of ${n} points are in the sources; ${unverified} ${unverified === 1 ? "is" : "are"} not.` };
}

/** refKey(claim, index) → { key, basis } — referent ids where the index resolves an end, the folded surface where it does not. */
export function refKey(c, index) {
  if (!c) return { key: null, basis: null };
  const end = (v) => { const s = String(v ?? "").trim(); if (!s) return { k: "", by: "empty" }; const r = index ? ids(index, s) : new Set(); return r.size ? { k: `#${[...r].sort().join("+")}`, by: "referent" } : { k: fold(s), by: "surface" }; };
  const a = end(c.end1 ?? c.subject), b = end(c.end2 ?? c.object);
  if (!a.k && !b.k) return { key: c.key ?? claimKey(c), basis: "surface" };
  return { key: `${a.k}|${fold(c.label ?? c.verb ?? "")}|${b.k}`, basis: a.by === "referent" || b.by === "referent" ? "referent" : "surface" };
}

/**
 * selfContradictions(claims, transcript, index) — the answer's graded claims
 * against what this conversation bound earlier, both sides keyed the same way
 * at comparison time. A typed row, never a verdict on who is right.
 */
export function selfContradictions(claims = [], transcript = [], index = null) {
  const earlier = new Map();
  for (const t of transcript) for (const c of t?.claims ?? []) { const { key } = refKey(c, index); if (key && !earlier.has(key)) earlier.set(key, { turn: t.turn, polarity: c.polarity ?? "+" }); }
  const out = [];
  for (const c of claims ?? []) {
    const { key, basis } = refKey(c, index);
    if (!key) continue;
    const e = earlier.get(key);
    if (!e) continue;
    const pol = c.polarity ?? "+";
    if (pol !== e.polarity) out.push({ kind: "polarity", key, basis, turn: e.turn, earlier: e.polarity, now: pol, claim: c });
    else if (c.verdict === "contradicted") out.push({ kind: "contradicted-now", key, basis, turn: e.turn, claim: c });
  }
  return out;
}
const said = (c) => [c.end1 ?? c.subject, c.label ?? c.verb, c.end2 ?? c.object].filter(Boolean).join(" ");
export const contradictionLine = (rows) => rows.length ? `On the record: ${rows.map((r) => r.kind === "polarity" ? `on turn ${r.turn} this conversation held "${said(r.claim)}" ${r.earlier === "+" ? "affirmed" : "denied"}, and this answer ${r.now === "+" ? "affirms" : "denies"} it` : `"${said(r.claim)}" was bound on turn ${r.turn} and the passages here contradict it`).join("; ")}. Both stand.` : "";

const contentWords = (t) => [...new Set(fold(t).split(/[^\p{L}\p{N}_]+/u))].filter((w) => w.length > 3);
/**
 * historyWindow(history, question, { dmdWindow, index }) — the exchanges the
 * mouth is handed: the shallowest depth at which forgetting the older ones
 * changes nothing the question REACHES — its referent ids found in the window
 * (through the index), or, when the question resolves to none, its content
 * words. dmdWindow is injected (eoreader7 kernel/activation.js).
 */
export function historyWindow(history = [], question = "", { dmdWindow, index = null, candidates = [1, 2, 3, 4, 6, 8, 12, 16, 24] } = {}) {
  const exchanges = [];
  for (let i = 0; i < history.length; i += 2) exchanges.push(history.slice(i, i + 2));
  if (!exchanges.length) return { messages: [], depth: 0, why: "no history" };
  const qids = referentsOf(question, index).ids;
  const qw = new Set(contentWords(question));
  const reach = (obs) => {
    const hit = new Set();
    for (const ex of obs) for (const m of ex) {
      if (qids.size) { for (const id of referentsOf(m.content, index).ids) if (qids.has(id)) hit.add(id); }
      else { const text = fold(m.content); for (const w of qw) if (text.includes(w)) hit.add(w); }
    }
    return [...hit].sort();
  };
  if (typeof dmdWindow !== "function") { const d = Math.min(exchanges.length, 4); return { messages: exchanges.slice(-d).flat(), depth: d, why: "dmdWindow not injected — a declared fallback of 4 exchanges", basis: qids.size ? "referent" : "surface" }; }
  const declared = candidates.filter((c) => c <= exchanges.length);
  const w = declared.length
    ? dmdWindow(exchanges, reach, { candidates: declared, restrict: (obs, depth) => obs.slice(Math.max(0, obs.length - depth)) })
    : { window: null, gap: "reach_exceeds_candidates", basis: "no declared history depth reaches the whole conversation" };
  const depth = Math.max(1, Math.min(exchanges.length, w?.window ?? exchanges.length));
  return { messages: exchanges.slice(-depth).flat(), depth, why: w?.basis ?? "measured", basis: qids.size ? "referent" : "surface", measured: w };
}

/**
 * expectationFrom(passages, question, read, index) — what the material states
 * about the question's REFERENTS before the mouth: the reader's own bound
 * claims over the retrieved passages, kept when an end resolves to a referent
 * the question resolves to. Only when the question resolves to none does a
 * content-word overlap on the ends stand in, and the result says so.
 */
export function expectationFrom(passages = [], question = "", read, index = null) {
  if (typeof read !== "function" || !passages.length) return { claims: [], basis: null, why: "no reader or no passages" };
  const qRefs = referentsOf(question, index);
  const qw = contentWords(question);
  const basis = qRefs.ids.size ? "referent" : "surface";
  const touches = (c) => {
    if (basis === "referent") { for (const end of [c.end1 ?? c.subject, c.end2 ?? c.object]) { for (const id of ids(index, String(end ?? ""))) if (qRefs.ids.has(id)) return true; } return false; }
    const ends = `${fold(c.end1 ?? c.subject)} ${fold(c.end2 ?? c.object)}`;
    return qw.some((w) => ends.includes(w));
  };
  const claims = []; const seen = new Set();
  for (const p of passages) {
    let cs = [];
    try { cs = read(String(p?.text ?? ""))?.claims ?? []; } catch { cs = []; }
    for (const c of cs) {
      if (c?.verdict !== "bound" || !touches(c)) continue;
      const { key } = refKey(c, index);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      claims.push({ key, end1: c.end1 ?? c.subject ?? null, label: c.label ?? c.verb ?? null, end2: c.end2 ?? c.object ?? null, polarity: c.polarity ?? "+", at: p.ref ?? null, refs: [...new Set([p.ref, ...(c.refs ?? [])].filter(Boolean))] });
    }
  }
  // The diff (errorOf) filters the answer's claims by the SAME touch test, so both sides are claims about the asked-about.
  return { claims, basis, ids: [...qRefs.ids], words: qw, touches, why: claims.length ? `${claims.length} claim(s) the material states about what was asked (by ${basis})` : `the retrieved passages state nothing about what was asked (by ${basis})` };
}
/** The expectation as facts for the mouth — positive, addressed, never an instruction. */
// No address reaches the mouth (the rule since 2026-08-18); the claims keep theirs on the record.
export const expectationFacts = (exp) => exp?.claims?.length ? `What the sources state about this:\n${exp.claims.slice(0, 12).map((c) => `- ${[c.end1, c.label, c.end2].filter(Boolean).join(" ")}${c.polarity === "-" ? " (denied)" : ""}`).join("\n")}` : "";
/**
 * errorOf(expectation, answerClaims, index) → matched / novel / missing /
 * contradicted, and the authorship ratio; both sides keyed the same way, and
 * both sides CLAIMS ABOUT THE ASKED-ABOUT: an answer claim whose ends
 * resolve to none of the question's referents is `offTopic`, counted apart,
 * never "novel" — measured live 2026-09-07: a verbatim answer sentence
 * yielded one garbage extraction ("her bed more from the —hurt→ …") and
 * authorship read 0 on a sentence copied from the passage.
 */
export function errorOf(expectation, answerClaims = [], index = null) {
  const expected = new Map((expectation?.claims ?? []).map((c) => [c.key ?? refKey(c, index).key, c]));
  const touches = typeof expectation?.touches === "function" ? expectation.touches : () => true;
  const keyed = (answerClaims ?? []).map((c) => ({ ...c, key: refKey(c, index).key })).filter((c) => c.key);
  const answered = keyed.filter(touches);
  const offTopic = keyed.length - answered.length;
  const matched = answered.filter((c) => expected.has(c.key) && c.verdict !== "contradicted").map((c) => c.key);
  const contradicted = answered.filter((c) => expected.has(c.key) && c.verdict === "contradicted").map((c) => c.key);
  const novel = answered.filter((c) => !expected.has(c.key)).map((c) => ({ key: c.key, verdict: c.verdict ?? "unheard" }));
  const saidKeys = new Set(answered.map((c) => c.key));
  const missing = [...expected.keys()].filter((k) => !saidKeys.has(k));
  const authored = matched.length, added = novel.length;
  // No expectation, no authorship: when the reader hears NOTHING about the asked-about in the passages, the ratio cannot separate "the reader could not hear it" from "the mouth made it up" (P41's withhold-vs-convict) — null, with the reason, never 0.
  const authorship = expected.size === 0 ? null : authored + added ? Number((authored / (authored + added)).toFixed(3)) : null;
  return { matched, novel, missing, contradicted, authorship, expected: expected.size, said: answered.length, offTopic, basis: expectation?.basis ?? null, ...(expected.size === 0 ? { why: "no expectation to author from — the reader heard nothing about the asked-about in the passages" } : {}) };
}

/**
 * ownedLine(rows, { since }) — the record OWNS a correction it learned in
 * this conversation, on the answer, in words: what an earlier answer held,
 * what the sources say. Both halves are positive facts of the record (P126
 * hands the corrected fact to the mouth; this line is the record speaking
 * for itself, never an instruction to the model and never the mouth's
 * apology). Only corrections learned since `since` — a shared store carries
 * other conversations' lessons, which are the mouth's ground, not this
 * conversation's own mistakes.
 */
export function ownedRows(rows = [], { since = null } = {}) {
  return (rows ?? []).filter((e) => e && e.claimed && e.corrected && (since == null || (Number(e.ts) || 0) >= since));
}
export const ownedLine = (rows) => rows.length ? `Earlier in this conversation ${rows.slice(0, 3).map((e) => `an answer held "${String(e.claimed).trim().replace(/[.]+$/, "")}" and the sources say "${String(e.corrected).trim().replace(/[.]+$/, "")}"`).join("; ")}${rows.length > 3 ? `; and ${rows.length - 3} more` : ""}.` : "";
