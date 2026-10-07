// native/organs/fact-gate.js — the GATE on a checkable fact that has no ground.
// Handle: Heimdall (the bridge: one decision, every surface) with Ranke (chase
// the claim to the document its account cites).
//
// THE SHAPE OF A FACT (what the gate reads, slot by slot):
//   fact = (jurisdiction, referent, relation, value) + SCOPE, resting on a GROUND.
//   scope kinds: instant | interval | open-now | timeless.  A present-tense
//   claim with no closing anchor is open-now: its only admissible ground is a
//   source dated inside the scope. The model's memory is a source with an
//   unknown date at or before its cutoff — so a bare open-now value with no
//   ground is the "gut answer". [cube: INS·Ground ●− is the declared preflight
//   that generates the ground; EVA·Figure ⊨+ is the guard that can fire.]
//
// WHAT THIS FILE IS. The PARALLEL scope work owns `factShape` (the typing of a
// claim's scope + jurisdiction). What is here is a deliberately CONSERVATIVE
// structural stub of it, so the gate is testable end to end; swap `factShape`
// and nothing else changes. Contract the gate consumes:
//
//   factShape(text) -> {
//     fact: boolean,                 // a checkable proposition (or a question for one)
//     form: "question"|"assertion",
//     scope: "open-now"|"closed"|null,   // "closed" = anchored/past/dated/modal
//     jurisdiction: { explicit: boolean, head: string|null },
//     basis: string,                 // one plain line, for the ledger only
//   }
//   isUngroundedFact(claim) -> boolean
//     claim = { text, ground?: [{ text, ref?, date? }] }
//     true iff factShape(claim.text).fact && scope === "open-now"
//          && no ground entry.
//
// The stub uses GRAMMAR only: closed-class function words (wh-words, present
// vs past auxiliaries, prepositions, the definite article) and token shape
// (digits, capitalisation). No domain vocabulary: no "president", no
// "current", no "now". A claim it cannot type is `fact:false` — the gate then
// does nothing (additive: it may miss, it never mis-fires on structure alone).
//
// P186: the gate never overwrites. It returns a sentence to APPEND.

// THE LENS (GFP doctrine, 2026-09-19): the closed classes below are ENGLISH
// grammar — the English lens. The kernel is language-blind; a language's own
// lens (adapters/text/fact-lenses.js) declares the same classes and the
// mouth's templates, and every function here accepts an optional `lens`.
// The default is this file's own English lens, so nothing downstream moves;
// a caller that can read the ask's language passes its lens.
const WH = new Set(["who", "what", "which", "whom", "whose"]);
const PRESENT = new Set(["is", "are", "am", "has", "have", "does", "do"]);
const PAST = new Set(["was", "were", "had", "did", "would", "could", "should", "might", "will", "shall"]);
const ANCHOR_PREP = new Set(["of", "in", "at", "on", "for", "since", "during", "as", "by", "until", "from", "before", "after", "with", "to"]);

const ENG_FRAME = (head, jurisdiction) => {
  const base = /^the\s/i.test(head) ? head : `the ${head}`;
  if (!jurisdiction) return base;
  const jur = /^the\s/i.test(jurisdiction) ? jurisdiction : `the ${jurisdiction}`;
  return `${base} of ${jur}`;
};
export const DEFAULT_LENS = Object.freeze({
  lang: "eng",
  wh: WH, present: PRESENT, past: PAST, anchor: ANCHOR_PREP,
  articles: new Set(["the"]), of: new Set(["of"]),
  frame: ENG_FRAME,
  value: (d, f, v) => `As of ${d}, ${f} is ${v}.`,
  holderValue: (d, h, f) => `As of ${d}, ${h} is ${f}.`,
  unsourced: (d) => `I don't have a grounded source for this as of ${d}; my training data may be stale on this point.`,
  checked: (s, d) => `Checked against ${s}, as of ${d}.`,
  nothingFound: (d) => `Nothing I found backed this up, so treat it as unchecked (as of ${d}).`,
  mismatch: (d, t) => `That does not match what I found (as of ${d}): ${t}`,
  ordinal: /(\d+)(?:st|nd|rd|th)\b/i,
});
const lensOf = (l) => l ?? DEFAULT_LENS;

const words = (s) => String(s ?? "").match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
const low = (w) => String(w).toLowerCase();
const isCap = (w) => /^\p{Lu}/u.test(w);
const isNum = (w) => /\d/.test(w);

/** The typed shape of one sentence, from the lens's grammar alone. */
export function factShape(text, lens) {
  const L = lensOf(lens);
  const s = String(text ?? "").trim();
  const closed = (basis) => ({ fact: false, form: "assertion", scope: null, jurisdiction: { explicit: false, head: null }, basis });
  if (!s) return closed("empty");
  const toks = words(L.lang === "eng" ? s.replace(/([\p{L}])['’]s\b/gu, "$1 is") : s);
  if (toks.length < 3) return closed("too short to hold a relation");
  const form = /\?\s*$/.test(s) || L.wh.has(low(toks[0])) ? "question" : "assertion";
  const lows = toks.map(low);
  // main predicate: the first auxiliary/copula
  const pi = lows.findIndex((w) => L.present.has(w) || L.past.has(w));
  if (pi < 0) return closed("no auxiliary/copula: tense not typable from grammar");
  if (lows.some((w) => L.past.has(w))) return { fact: true, form, scope: "closed", jurisdiction: { explicit: true, head: null }, basis: "past/modal predicate" };
  if (!L.present.has(lows[pi])) return closed("not present tense");
  if (form === "question" && !L.wh.has(lows[0])) return closed("yes/no question: no value slot");
  // the part that must carry the anchor: the subject (assertion) or the whole
  // ask (question). Values after the copula in an assertion are exempt.
  const scopeToks = form === "assertion" ? toks.slice(0, pi) : toks.slice(1);
  const scopeLows = scopeToks.map(low);
  if (scopeToks.some(isNum)) return { fact: true, form, scope: "closed", jurisdiction: { explicit: true, head: null }, basis: "dated/numbered: an instant or interval" };
  // the definite noun phrase: the lens's article + up to 3 tokens. The walk
// stops at an ANCHOR, at the copula, at an English-shaped capitalized
// entity — and at any ARTICLE, because an article always begins a new noun
// phrase ("der Präsident der Vereinigten Staaten": the second "der" is the
// genitive complement's own article — falsified live by the 75-row battery).
  const di = scopeLows.findIndex((w) => L.articles.has(w));
  if (di < 0) return closed("no definite noun phrase (generic or definitional)");
  let end = di + 1;
  const capsAnchor = (tok) => L.capsAreAnchor !== false && isCap(tok);
  while (end < scopeToks.length && end - di <= 3 && !L.anchor.has(scopeLows[end]) && !L.articles.has(scopeLows[end]) && !L.present.has(scopeLows[end]) && !capsAnchor(scopeToks[end])) end++;
  if (end === di + 1) return closed("definite article with no head");
  const head = scopeToks[end - 1];
  const tail = scopeToks.slice(end);
  const anchored = tail.some((w) => L.anchor.has(low(w)) || L.articles.has(low(w)) || capsAnchor(w));
  if (anchored) return { fact: true, form, scope: "closed", jurisdiction: { explicit: true, head }, basis: "the noun phrase carries its own anchor (a complement or a named entity)" };
  return { fact: true, form, scope: "open-now", jurisdiction: { explicit: false, head }, basis: "present-tense stative over a bare definite role: no anchor, no date" };
}

/** True iff the claim is a checkable open-now fact with no ground behind it. */
export function isUngroundedFact(claim) {
  const shape = factShape(claim?.text);
  return Boolean(shape.fact && shape.scope === "open-now" && !(claim?.ground?.length));
}

const sentencesOf = (t) => String(t ?? "").split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
const dateOf = (now) => (now instanceof Date ? now : new Date(now ?? Date.now())).toISOString().slice(0, 10);

// The value the answer commits to: capitalised or numeric tokens that the ask
// did not itself supply. A claim is chased to its document by finding those
// bytes there (Ranke: the account's own citation, not the model's say-so).
export function valuesOf(answerSentence, askText, lens) {
  const L = lensOf(lens);
  const asked = new Set(words(askText).map(low));
  const toks = words(answerSentence);
  // a verbless FRAGMENT ("Joe Biden.") is all value: its first word is not a
  // sentence-initial capital, it is the filler of the question's slot.
  const fragment = !toks.some((w) => L.present.has(low(w)) || L.past.has(low(w)));
  return toks.filter((w, i) => (isNum(w) || (isCap(w) && (i > 0 || fragment))) && !asked.has(low(w))).map(low);
}

/**
 * THE PAIR IS THE CLAIM. An elliptical answer ("Joe Biden.", "In 1802.") holds
 * no claim of its own: the fact lives in question+answer. Fuse mechanically:
 * the question's frame after its wh-slot ("the president is") takes the
 * fragment as its value. Non-fragments and yes/no asks come back unfused.
 */
export function fuseAnswer(ask, answer, lens) {
  const L = lensOf(lens);
  const a = String(answer ?? "").trim().replace(/[.!]+$/, "");
  const at = words(a);
  if (!at.length || at.some((w) => L.present.has(low(w)) || L.past.has(low(w)))) return { fused: false, text: a };
  const q = words(L.lang === "eng" ? String(ask ?? "").replace(/([\p{L}])['’]s\b/gu, "$1 is") : String(ask ?? ""));
  if (!q.length || !L.wh.has(low(q[0]))) return { fused: false, text: a };
  const ai = q.findIndex((w) => L.present.has(low(w)) || L.past.has(low(w)));
  if (ai < 1) return { fused: false, text: a };
  const rest = q.slice(1).filter((_, i) => i + 1 !== ai);
  return { fused: true, text: `${rest.join(" ")} ${q[ai]} ${a}`.trim() };
}

// A PAST-TENSE POSSESSIVE OFFICE ASK ("who was Lincoln's VP?", "who was
// lincoln's vp?") names a definite role the same way "the ROLE of
// JURISDICTION" does (English's other possessive) — but the past-tense
// branch above (line 89) returns before the definite-noun-phrase walk
// ever runs, and that walk only recognises the "the X of Y" form besides:
// a possessive has no "the" to anchor on. Found live, 2026-09-23: this
// exact question, checking on, no attached material, shipped two
// DIFFERENT wrong answers from two different models with zero citation
// either time — factGate.open stayed false throughout (basis: "past/modal
// predicate"), so no search ever ran and nothing was ever checked.
// Deliberately a SEPARATE, narrow, additive path rather than widening the
// existing walk: that walk's own possessive-mangling step
// (`s.replace(/(['’])s\b/...` two functions up, built for WH-
// contractions like "who's"/"what's") would turn "Lincoln's" into
// "Lincoln is" and destroy the very possessive this looks for — so this
// reads the ORIGINAL words directly. Deliberately NOT gated on
// capitalisation either (unlike the present-tense walk's own
// `capsAnchor`): the reported specimen was typed lowercase, and this file
// already has the same "who is chairman"-class lesson recorded above (no
// domain vocabulary — this checks STRUCTURE, a possessive marker after a
// past copula, never a hand-listed set of office nouns). A false positive
// here costs one search — the identical asymmetry this file's own header
// already argues for the open-now case.
export function possessiveOfficeAsk(text, lens) {
  const L = lensOf(lens);
  const raw = words(String(text ?? "").trim());
  if (raw.length < 4 || !L.wh.has(low(raw[0]))) return null;
  const pi = raw.map(low).findIndex((w) => L.past.has(w));
  if (pi < 1) return null;
  for (let i = pi + 1; i < raw.length - 1; i++) {
    if (!/['’]s$/.test(raw[i])) continue;
    const roleToks = raw.slice(i + 1, i + 4).filter((w) => !L.anchor.has(low(w)) && !L.articles.has(low(w)));
    if (!roleToks.length) continue;
    return { possessor: raw[i].replace(/['’]s$/, ""), head: low(roleToks[roleToks.length - 1]) };
  }
  return null;
}

/**
 * THE INTENT PAIR (U, S), read off structure and written as two NOTES
 * (arrangements: end1 —label→ end2, kernel/notes.js shape) so a later
 * broadcast competition can choose among them. U = the person's act; S = the
 * operator the reply would perform. The gate is a function of the pair:
 * only (ask-value, DEF over an open-now slot) needs a Ground.
 */
export function intentPair(ask, answer = "", lens) {
  const L = lensOf(lens);
  const s = String(ask ?? "").trim();
  const toks = words(s);
  const shape = factShape(s, L);
  const hasPred = toks.some((w) => L.present.has(low(w)) || L.past.has(low(w)));
  let U;
  if (toks.length && L.wh.has(low(toks[0])) ) U = "ask-value";
  else if (/\?\s*$/.test(s) && hasPred) U = "ask-verdict";
  else if (!hasPred && toks.length < 3) U = "contact";
  else U = "tell";
  let S, cell;
  if (U === "contact") { S = "acknowledge"; cell = "SIG"; }
  else if (U === "ask-value" && shape.fact) { S = "assert-fact"; cell = "DEF"; }
  else if (U === "ask-verdict") { S = "judge"; cell = "EVA"; }
  else { S = "respond"; cell = "SYN"; }
  const needsGround = S === "assert-fact" && (shape.scope === "open-now" || Boolean(shape.scope === "closed" && possessiveOfficeAsk(s, L)));
  const note = (label, end2, extra = {}) => ({ end1: "turn:ask", label, end2, witnesses: ["fact-gate@1"], spans: [{ source: "turn:ask", start: 0, end: s.length }], ...extra });
  return {
    U, S, cell, needsGround,
    notes: [
      note("person-act", U, { basis: "interrogative slot / predicate presence, from grammar" }),
      note("system-act", `${cell}:${S}`, { needsGround, scope: shape.scope, jurisdiction: shape.jurisdiction }),
    ],
  };
}

// The jurisdiction the answer silently chose: the anchor its own subject
// phrase carries ("<head> of [the] Cap Cap…").
function anchorFromAnswer(answerText, head) {
  if (!head) return null;
  const toks = words(answerText);
  const hl = low(head);
  for (let i = 0; i < toks.length - 2; i++) {
    if (low(toks[i]) !== hl || low(toks[i + 1]) !== "of") continue;
    let j = i + 2;
    const parts = [];
    if (low(toks[j]) === "the") { parts.push(toks[j]); j++; }
    while (j < toks.length && isCap(toks[j])) { parts.push(toks[j]); j++; }
    if (parts.filter(isCap).length) return parts.join(" ");
  }
  return null;
}

/**
 * What to ask a dated record: the ROLE the person asked about (the ask's own head noun) and the JURISDICTION the
 * answer chose (read from its own "of X" complement — the model's implicit salience made explicit, so the record
 * can be asked about exactly that body). Null unless the ask is an open-now fact whose jurisdiction the answer named.
 */
export function holderQueryFor({ ask, answer } = {}) {
  const shape = factShape(ask);
  if (!(shape.fact && shape.scope === "open-now")) return null;
  const head = shape.jurisdiction?.head;
  if (!head) return null;
  const jurisdiction = anchorFromAnswer(answer, head);
  return jurisdiction ? { role: head, jurisdiction } : null;
}

/**
 * The decision. Pure: it reads the ask, the draft, the ground the turn found,
 * and the conversation; it returns the plain sentences to APPEND (or none).
 *   ask        the person's question
 *   answer     the model's draft, as shipped so far
 *   ground     [{text, ref?}] what the turn's web/material check found (may be [])
 *   context    the conversation's own words (history + discourse) — the salience
 *              that may already fix the jurisdiction
 *   searched   whether a declared preflight was actually run
 */
export function decideGate({ ask, answer, ground = [], context = "", now = new Date(), searched = false, groundSource = "a web search", lens = null } = {}) {
  const L = lensOf(lens);
  const date = dateOf(now);
  const askShape = factShape(ask, L);
  const pair = intentPair(ask, answer, L);
  const fusedClaim = fuseAnswer(ask, answer, L);
  // the candidate: the claim is fixed by the PAIR (U,S), read from the ask —
  // an open-now value ask, or a fused elliptical answer that fills such a
  // frame. An answer sentence is NOT read alone for a scope: measured, a
  // passive process sentence ("the light energy is used to ...") in a
  // definitional answer types as open-now and false-flags a timeless ask.
  const claimSentence = fusedClaim.fused && isUngroundedFact({ text: fusedClaim.text }) ? fusedClaim.text : null;
  const open = pair.needsGround || Boolean(claimSentence);
  if (!open) return { open: false, pair, grounded: null, searched, append: null, jurisdiction: null, basis: askShape.basis };

  // The possessive-office read (askShape.scope==="closed"), when it is the
  // reason `open` is true — checked once here rather than inside `pair`,
  // since `pair` only carries the boolean, not the match itself.
  const possessive = askShape.scope === "closed" ? possessiveOfficeAsk(ask, L) : null;
  const head = askShape.scope === "open-now" ? askShape.jurisdiction.head : (possessive?.head ?? factShape(claimSentence, L).jurisdiction.head);
  // Ranke: does the ground hold the bytes of the value the answer commits to?
  const groundText = ground.map((g) => String(g?.text ?? "")).join("\n").toLowerCase();
  const committed = sentencesOf(answer).flatMap((s) => valuesOf(s, ask, L));
  const grounded = ground.length > 0 && committed.length > 0 && committed.every((v) => groundText.includes(v));

  const out = [];
  // jurisdiction: declared only when the ask did not fix it AND the
  // conversation did not either (salience weak).
  let jurisdiction = null;
  const explicitInAsk = askShape.fact && askShape.jurisdiction.explicit;
  if (!explicitInAsk) {
    const anchor = anchorFromAnswer(answer, head);
    if (anchor) {
      const fixedByConversation = String(context).toLowerCase().includes(anchor.replace(/^the\s+/i, "").toLowerCase());
      jurisdiction = { assumed: anchor, fixedByConversation };
      if (!fixedByConversation) out.push(`I took this to mean ${anchor}, as of ${date}.`);
    }
  }
  const holderGround = ground.find((g) => g?.kind === "current-holder");
  if (grounded) out.push(holderGround ? `Checked against Wikidata, as of ${date}.` : L.checked(groundSource, date));
  else if (holderGround) {
    // A DATED ground that names a different holder: say so plainly, beside the model's words (P186).
    out.push(L.mismatch(date, holderGround.text));
  } else {
    out.push(L.nothingFound(date));
    // What the search DID return is information the reader is owed — verbatim
    // bytes of the ground, never a model paraphrase, appended after the model's
    // words (P186: added, never substituted).
    const found = ground.map((g) => String(g?.text ?? "")).join(" ").replace(/^From a search for "[^"]*":\s*/i, "").split(/\s*\d\.\s+/).map((x) => x.trim()).filter((x) => x.length > 20)[0];
    if (found) out.push(`What the search returned: \u201c${found.slice(0, 220)}\u201d`);
  }
  return { open: true, pair, grounded, searched, append: out.join(" "), jurisdiction, basis: askShape.scope === "open-now" ? askShape.basis : possessive ? "a past-tense possessive names a definite role" : "the question+answer pair fuses into an open-now claim" };
}

// ── THE SURGICAL GATE (2026-09-19): strike-and-replace, never append-only ──
// decideGate above APPENDS plain sentences (P186: the model's words are kept).
// For a checkable open-now fact the environment may now hold a dated ground
// (a KIND and its LINK in the hyperlexicon's routes, or a current-holder
// record) that NAMES a different value than the draft asserts. An appended
// warning beside a wrong answer is still a wrong answer shipped. So this gate
// strikes the flagged sentence and splices a mechanically assembled one — the
// value comes from the LINK's own bytes, the frame from the KIND's label (a
// role is a kind; the replacement is assembled from the kind and the link,
// never from the draft's words), and the model is never asked to rephrase
// anything. Same pattern firewall.js uses (strikeAddresses): the gate
// rewrites TEXT, never the model.

// The holder a DATED record names ("Wikidata lists Donald Trump as the
// current President of the United States...") — the same shape
// current-facts.js reads, kept local so this gate has no organ dependency.
const RECORD_HOLDER_RE = /lists\s+([A-Z][\p{L}\p{N}.'’-]+(?:\s+[A-Z][\p{L}\p{N}.'’-]+){0,5})\s+as\s+(?:the\s+)?current\b/iu;
const RECORD_SINCE_RE = /\bsince\s+(\d{4}-\d{2}-\d{2})/i;
const holderFromRecord = (text) => RECORD_HOLDER_RE.exec(String(text ?? ""))?.[1]?.replace(/[.!?]+$/, "").trim() ?? null;
const sinceFromRecord = (text) => RECORD_SINCE_RE.exec(String(text ?? ""))?.[1] ?? null;

const hasVerb = (toks, lens) => {
  const L = lensOf(lens);
  return toks.some((w) => L.present.has(low(w)) || L.past.has(low(w)));
};

/** The frame a fused ask names, when no kind carried one ("the president"). */
const frameFromAsk = (ask, lens) => {
  const L = lensOf(lens);
  const toks = words(ask);
  const pi = toks.findIndex((w) => L.present.has(low(w)) || L.past.has(low(w)));
  if (pi < 1) return null;
  const rest = toks.slice(pi + 1);
  const end = rest.findIndex((w) => L.anchor.has(low(w)));
  const frame = (end >= 0 ? rest.slice(0, end) : rest).join(" ");
  if (!frame) return null;
  // the frame already carries its own article ("the president", "le
  // président") — the lens must not re-articled it
  const hasArticle = [...L.articles].some((a) => new RegExp(`^${String(a).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(frame));
  return hasArticle ? frame : L.frame(frame, null);
};

/**
 * The surgical verdict. Reads the ask, the draft, and the dated ground the
 * environment holds (a KIND + LINK from the hyperlexicon routes, or a
 * current-holder record); strikes every sentence that commits to a value the
 * ground contradicts, and splices the mechanical replacement assembled from
 * the kind and the link THROUGH THE LENS (the ask's own language — a Spanish
 * answer never receives an English sentence). Verdicts:
 *   grounded          the draft's committed values match the link's holder
 *   contradicted      the draft commits to a value the link does not hold
 *   unsourced-current an open-now claim with no dated ground at all
 *   untouched         no flaggable claim (the caller keeps its own path)
 */
export function applyVerdictGate({ ask, answer, ground = [], kind = null, link = null, route = null, now = new Date(), lens = null } = {}) {
  const L = lensOf(lens);
  const date = dateOf(now);
  const text = String(answer ?? "");
  const sentences = sentencesOf(text);
  if (!sentences.length) return { text, gated: false, verdict: "untouched", count: 0, kind, link };

  const recordGround = ground.find((g) => g?.kind === "current-holder") ?? null;
  const groundValue = link?.holder ?? holderFromRecord(recordGround?.text);
  const groundDate = link?.since ?? link?.at ?? sinceFromRecord(recordGround?.text) ?? date;
  const holderAsk = route === "holder";
  const expected = holderAsk
    ? words(kind?.label ?? "").map(low)
    : groundValue ? words(groundValue).map(low) : null;

  const fused = fuseAnswer(ask, answer, L);
  const fragment = fused.fused;
  const askShape = factShape(ask, L);
  const openNowAsk = askShape.fact && askShape.scope === "open-now";
  const kindFrame = kind?.label ? L.frame(kind.label, kind.jurisdiction ?? null) : null;
  const roleWords = [kind?.label, ...(kind?.aliases ?? [])].filter(Boolean);

// which sentences commit to the claim? A bare FRAGMENT is only treated as
  // the claim when it is the WHOLE answer (one sentence) — in a longer
  // answer, per-sentence shape decides, because a strong past tense like
  // "took" escapes the conservative auxiliary sets and must not re-fuse the
  // answer into a fragment.
  //
  // THE COMPLEMENT-ARTICLE RULE (2026-09-19, falsified live): a role mention
  // BEFORE the copula is a holder claim only when the post-copula complement
  // is a NAME — a definite complement ("the Head of State", "le chef des
  // Armées") is a DEFINITION, never a claim, and its capitalized noun must
  // not read as a committed value. A role mention AFTER the copula ("Joe
  // Biden est le président.") is the claim itself — the subject is the value.
  const holderComplement = (toks, roles) => {
    const ci = toks.findIndex((w) => L.present.has(low(w)));
    if (ci < 0) return true; // verbless forms take the fragment path
    const before = toks.slice(0, ci);
    const after = toks.slice(ci + 1);
    const roleIn = (arr) => arr.some((w) => roles.some((r) => low(w) === low(r)));
    if (roleIn(before) && !roleIn(after)) return !after.some((w) => L.articles.has(low(w)));
    return true;
  };
  const singleSentence = sentences.length === 1;
  const flagged = [];
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const toks = words(s);
    const values = valuesOf(s, ask, L);
    const hasPresentAux = toks.some((w) => L.present.has(low(w)));
    const hasPastAux = toks.some((w) => L.past.has(low(w)));
    const verbless = !hasPresentAux && !hasPastAux;
    const shape = factShape(s, L);
    // the sentence's own role head ("The president is the Head of State." —
    // the head is "president") joins the kind's role words for the
    // complement rule, which gates BOTH flagging paths: a role mention
    // before the copula with an article-bearing complement is a definition
    // ("the Head of State", "le chef des Armées"), never a claim.
    const roles = [...roleWords, shape.jurisdiction?.head].filter(Boolean);
    const complementOk = holderComplement(toks, roles);
    // A role MENTION is only a claim when the sentence is present-tense or a
    // short verbless answer-form. A true past statement ("Joe Biden was the
    // president from 2021 to 2025") must survive: the current link does not
    // contradict history, and a strong past verb ("served", "took") escapes
    // the conservative auxiliary sets, so a longer verbless-looking sentence
    // is not trusted as an answer-form either.
    const mentionsRole = (hasPresentAux || (verbless && toks.length <= 4)) && complementOk && roleWords.some((w) => new RegExp(`\\b${String(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s));
    const isFragment = singleSentence && fragment && !hasVerb(toks, L) && (openNowAsk || mentionsRole);
    const openNow = shape.fact && shape.scope === "open-now" && complementOk;
    if (!isFragment && !openNow && !mentionsRole) continue;
    if (!values.length && !mentionsRole) continue;
    flagged.push({ i, s, values, isFragment, openNow, mentionsRole });
  }
  if (!flagged.length) return { text, gated: false, verdict: "untouched", count: 0, kind, link };

  // the verdict over the flagged block
  let verdict;
  if (expected && expected.length) {
    // the anchor is not a committed value: a sentence naming "the United
    // States" is naming the kind's jurisdiction, not filling its value slot;
    // and a bare "the" is the article, never a value.
    const jurWords = new Set(words(kind?.jurisdiction ?? "").map(low));
    const closed = (v) => [...L.articles, "a", "an"].includes(v) || L.anchor.has(v);
    const all = flagged.flatMap((f) => f.values).filter((v) => !jurWords.has(v) && !closed(v));
    if (!all.length) {
      // no value committed: the sentence names the role itself — for a
      // holder ask that IS the answer ("who is Donald Trump?" -> "The
      // president.") only when it names the KIND's own phrase ("the
      // president", not "the vice president"); a verbless fragment naming a
      // different role is itself the wrong claim.
      const art = [...L.articles][0] ?? "the";
      const phrase = kind?.label ? new RegExp(`${String(art).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+${String(kind.label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i") : null;
      const namesKind = flagged.some((f) => phrase?.test(f.s));
      if (holderAsk && namesKind) verdict = "grounded";
      else if (flagged.some((f) => f.isFragment) && !namesKind) verdict = "contradicted";
      else return { text, gated: false, verdict: "untouched", count: 0, kind, link };
    } else {
      verdict = all.every((v) => expected.includes(v)) ? "grounded" : "contradicted";
    }
  } else if (flagged.some((f) => f.openNow || f.isFragment)) {
    verdict = "unsourced-current";
  } else {
    return { text, gated: false, verdict: "untouched", count: 0, kind, link };
  }
  if (verdict === "grounded") return { text, gated: false, verdict, count: flagged.length, kind, link };

  // the mechanical replacement — assembled from the KIND and the LINK (or,
  // for a record ground with no kind, from the ask's own frame) through the
  // LENS's own templates, never from the draft's words
  let replacement;
  if (verdict === "contradicted") {
    if (holderAsk && kind && link) {
      replacement = L.holderValue(groundDate, link.holder, kindFrame ?? kind.label);
    } else {
      const frame = kindFrame ?? frameFromAsk(ask, L);
      replacement = groundValue
        ? L.value(groundDate, frame, groundValue)
        : L.unsourced(date);
    }
  } else {
    replacement = L.unsourced(date);
  }

  let out = [];
  for (let i = 0; i < sentences.length; i++) {
    if (flagged.some((f) => f.i === i)) {
      if (i === flagged[0].i) out.push(replacement);
    } else out.push(sentences[i]);
  }
  return { text: out.join("\n\n"), gated: true, verdict, count: flagged.length, replacement, kind, link, groundDate, groundValue };
}
