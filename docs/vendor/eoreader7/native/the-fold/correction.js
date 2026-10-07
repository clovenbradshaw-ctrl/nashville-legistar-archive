// correction.js — a wrong answer is corrected AT ANY LEVEL (P125), and the
// premise a question smuggles in is checked before the mouth ever sees it.
//
// User direction (2026-09-05): "wire it up so wrong answers get corrected at
// any level … we don't need a system that's always right, but we do need one
// that is actively learning to get better."
//
// Until this file, the only self-correction in the instrument was P122's, and
// it ran ONLY for a piece's section. A plain turn drafted, was marked, and
// stood — measured live in the long-stream run (S77): asked "Earlier we
// established from POLICIES.md that: `EFFECT_READS_THE_Sherman_RUN` is the
// named export that states it", gemma2:2b answered "You're right, we
// established that…" and confabulated a meaning for a token the material
// never contains. Nothing checked the QUESTION.
//
// Two acts, both mechanical, neither a prompt asking the model to be careful
// (the model is just the mouth — compute it outside, hand back the result):
//
//   1. THE PREMISE CHECK, before drafting. A question that asserts something
//      as already established carries claims. Their atoms are looked for in
//      the material the same way a drafted sentence's are (P122's company
//      rule). An atom in no passage is an unverified premise; a passage that
//      shares the premise's words and carries a DIFFERENT value is a
//      contradiction with an address. Both are handed to the model as FACTS
//      about what the sources say — never as an instruction to be skeptical.
//   2. THE ANSWER CHECK, after drafting. The same atoms-against-snips check
//      P122 runs for a section, run for any turn with passages, with the
//      same gate: a rewrite lands only when its own atoms clear the check.
//
// PURE: no model call of its own, no I/O. `correctTurn` takes the call it is
// given and spends exactly the rounds it is handed.
import { restatementOf } from "./dialogue.js";
import { snipsFor, snipBlock, checkSection, checkSentence, reviseAsk, applyRewrite, atomsOf as atomsOfText, ABSENCE_RE as KEEPS_RE } from "./snip-check.js";
import { CLAIM_STOPWORDS } from "../organs/grounding.js";
import { namesIn } from "./ground-ladder.js";

const fold = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// LENGTH FLOOR MATCHES RETRIEVAL'S OWN (source.js::tokenize: `t.length > 2`),
// not a copy of snip-check.js's `contentWords` (a DIFFERENT question — does
// the model's OWN rewrite still talk about the same thing — inherited here
// unexamined when this file was written). This one decides which of the
// QUESTION's words are worth searching the material for, and a floor one
// higher than retrieval's silently throws away exactly the words retrieval
// itself found relevant. Measured live (2026-09-08): "what time are they
// meeting at the gym?" retrieved the whole pasted passage on "time" and
// "gym" (tokenize keeps both), but turnSnipBlock's needles were only
// ["time", "meeting"] — "gym" fell below the old `> 3` floor — so the one
// sentence stating the actual meeting time ("I'll meet you at the gym at
// 3:30 then.") never became a snip, `compress` (holon.js) dropped the raw
// passages because SOME snip still matched, and the mouth was handed one
// unrelated line ("What time do you want to go?") for a whole retrieved
// passage. The whole doc reads "retrieved" in the record because it was —
// this is a needle too narrow to find its own retrieved sentence again.
const contentWords = (t) => [...new Set(fold(t).split(/[^\p{L}\p{N}_]+/u))].filter((w) => w.length > 2 && !CLAIM_STOPWORDS.has(w));

/** The phrasings by which a question hands over a claim as already settled —
 * measured off the live run and the ordinary ways people talk. The trigger is
 * found first, then the claim it introduces: the quoted span that follows it,
 * or the `that …` clause when nothing is quoted. Splitting it this way is why
 * "Earlier we established from POLICIES.md that: …" is caught — an earlier
 * draft's one-shot regexes excluded the dot in a filename and matched nothing. */
const TRIGGER_RE = /\b(?:(?:earlier|previously|before|already)\b[^"“]{0,60}?)?\b(?:we|you|i)\b\s+(?:had\s+)?(?:established|agreed|confirmed|said|told me|showed|determined)\b/gi;
const ACCORDING_RE = /\baccording to\b[^"“]{0,80}?/gi;
const QUOTED_RE = /["“]([^"”]{12,400})["”]/;
const THAT_RE = /^[^"“]{0,40}?\bthat\b[:,]?\s+([^"“.?!]{12,400})/i;
const WINDOW = 160;

/**
 * premisesOf(question) → [{ text, how }]
 * What the question asserts as already true. A question that asserts nothing
 * returns [] and every caller stays byte-identical to before this existed.
 */
export function premisesOf(question) {
  const q = String(question ?? "");
  const out = [];
  const seen = new Set();
  const take = (text, how) => {
    const t = String(text ?? "").trim().replace(/[.,;:]+$/, "");
    const key = fold(t);
    if (t.length < 12 || seen.has(key)) return;
    seen.add(key);
    out.push({ text: t, how });
  };
  // A reader's RESTATEMENT is a claim set (dialogue.js, 2026-09-07): "so
  // you're saying X — is that what the book says?" asserts X as heard and
  // asks the record to grade it. The same check, the same facts back.
  const restated = restatementOf(q);
  for (const re of [TRIGGER_RE, ACCORDING_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(q))) {
      const after = q.slice(m.index + m[0].length, m.index + m[0].length + WINDOW);
      const quoted = after.match(QUOTED_RE);
      if (quoted) { take(quoted[1], "asserted as established"); continue; }
      const clause = after.match(THAT_RE);
      if (clause) take(clause[1], "asserted as established");
    }
  }
  // Only when no explicit trigger named one: "you said «X» — is that right?"
  // is the stronger reading of the same sentence, and two premises from one
  // sentence would grade it twice (correction.test.mjs pins the count).
  if (restated && out.length === 0) take(restated, "restated by the reader");
  return out;
}

/**
 * checkPremises(question, passages, { terms }) → { premises: [...], unverified, contradicted }
 * Each premise's atoms looked for in the material — the same containment with
 * company P122 uses, over snips built from the passages the turn actually has.
 */
/**
 * premiseContentGap(premiseText, snips, atoms) → the premise's own content
 * words that appear NOWHERE in the material at all.
 *
 * `atomsOf` (snip-check.js) only ever extracts numbers, years and names — a
 * premise whose false content is an ACTION or STATE ("the bridge collapsed"
 * vs. "the bridge remained sound") can clear the atom check completely on a
 * coincidentally-shared date or topic word while the actual claim it makes
 * is never once attested anywhere. Measured live (task_b5850fd4): "So the
 * report says the Elm Street bridge collapsed in 1998, right?" against a
 * report that never uses the word "collapsed" at all — the year and the
 * bridge's own name both genuinely appear, `checkSentence` finds zero
 * flagged atoms, `checkPremises` reported zero unverified premises, and
 * `positionOn`'s "yes" branch then prepended "Yes — that is what the
 * sources say" to the SHIPPED ANSWER, spliced in after every grounding pass
 * had already run so it carried no citation, no ∅ mark, nothing — directly
 * contradicting the model's own drafted answer two sentences later, which
 * correctly identified the premise as false and carried a real mark for
 * saying so.
 *
 * This is not a semantic check — it is the SAME absence-of-evidence
 * `premiseFacts` already reports for a missing atom VALUE, widened to the
 * premise's other content words. A word the premise's own claim rests on
 * that appears in no snip at all is real, checkable evidence the claim is
 * not the material's own — never proof the claim is false (morphology
 * drift, "closure" for "closed", is a real, disclosed false-positive risk
 * this scoped check does not solve), only ever enough to withhold a
 * confident "yes" (folded into `unverified` below), never enough on its
 * own to convict a "no" (a real `contradiction` still requires
 * `checkSentence`'s own stronger year-mismatch evidence).
 */
// The verb FRAMING a premise ("the report SAYS…", "the article STATES…") is
// never itself the claim — a source practically never contains the literal
// word "says" about its own contents, whether the thing it is quoted as
// saying is true or false. Measured live while building this check: a
// wholly TRUE restated premise ("the report says the bridge remained sound
// in 1998, right?") flagged "says" as an absence and would have been
// wrongly downgraded from a genuine "yes" — this closed class is what a
// real control caught before it could ship. Declared locally (no received
// class covers "words that report an utterance" specifically); NEVER
// excludes a reporting NOUN ("report", "article"), only the verb.
const REPORTING_VERBS = new Set(["says", "say", "said", "states", "state", "stated", "claims", "claim", "claimed", "reports", "reported", "mentions", "mention", "mentioned", "notes", "noted", "shows", "show", "showed", "indicates", "indicate", "indicated", "tells", "tell", "told", "wrote", "writes", "write"]);
export function premiseContentGap(premiseText, snips = [], atoms = []) {
  // A compound token (an identifier joined by underscores, which this
  // file's own `contentWords` deliberately keeps whole rather than
  // splitting — line above, `[^\p{L}\p{N}_]+`) can EMBED an atom's own
  // value without being equal to it — "EFFECT_READS_THE_Sherman_RUN"
  // contains the name atom "Sherman" but folds to one longer token. A
  // substring check both ways (never reported twice for the same real
  // absence, pinned in correction.test.mjs) rather than exact equality.
  const atomFolds = atoms.map((a) => fold(a.value)).filter(Boolean);
  const material = fold(snips.map((s) => s.text).join(" "));
  return contentWords(premiseText).filter(
    (w) => !REPORTING_VERBS.has(w) && !atomFolds.some((af) => w.includes(af) || af.includes(w)) && !material.includes(w),
  );
}

export function checkPremises(question, passages = [], { terms = [], cited = null, referentIndexFor = null } = {}) {
  const premises = premisesOf(question);
  if (!premises.length) return { premises: [], unverified: [], contradicted: [], snips: 0 };
  const needles = [...new Set(premises.flatMap((p) => contentWords(p.text)))];
  // A TOKEN IS SCOPED TO THE SOURCE IT IS CLAIMED OF (P135). "Does this token
  // exist in the corpus" was never the question; "does it belong in THIS
  // source's passage" is. Measured live (2026-09-06): a probe planted
  // "Kutúzov" into a Lincoln-article sentence and every check passed it,
  // because Kutúzov is unquestionably in the corpus — he is in War and Peace.
  // Vienna, Army and Berry failed the same way. When the question names its
  // source, only that source's passages can answer for it.
  const inScope = cited ? passages.filter((p) => String(p?.ref ?? p?.source ?? "").includes(cited)) : passages;
  const snips = snipsFor(inScope.length ? inScope : passages, { obligations: needles, terms });
  const scoped = inScope.length ? inScope : passages;
  const rows = premises.map((p) => {
    const c = checkSentence(p.text, snips);
    // THE REFERENT READING (P135), where the cast can be read: a name the
    // cited passage's own cast does not establish is `beyond-reach` — the
    // claim is about someone that passage never introduces — and that is a
    // finding of a different and better kind than a missing substring.
    const ref = referentIndexFor ? premiseReferents(p.text, scoped, { referentIndexFor }) : { unresolved: [], reached: false };
    // Skipped when a real contradiction already fired: a numeric mismatch is
    // the stronger finding, and re-flagging the same premise on top of it as
    // merely "content missing" would understate what was actually found.
    const contentGap = c.contradiction ? [] : premiseContentGap(p.text, snips, c.atoms);
    return { ...p, atoms: c.atoms, flags: c.flags, contradiction: c.contradiction, supported: c.supported, beyondReach: ref.reached ? ref.unresolved : [], castReached: ref.reached, contentGap };
  });
  return {
    premises: rows,
    unverified: rows.filter((r) => (r.flags.length || r.beyondReach.length || r.contentGap.length) && !r.contradiction),
    contradicted: rows.filter((r) => r.contradiction),
    snips: snips.length,
    snipRows: snips,
  };
}

/**
 * premiseReferents(premise, passages, { referentIndexFor }) →
 *   { names, unresolved, resolved }
 *
 * THE CHECK IS ABOUT REFERENTS, NOT SPANS (P135). Whether a string occurs in
 * a byte range is the wrong question twice over: a name can occur in the
 * material and name someone else, and a referent can be established under a
 * surface the claim does not use. What the claim asserts is about a PERSON,
 * A PLACE, A THING — and the question is whether the cited passage's own cast
 * establishes that one.
 *
 * Measured live (2026-09-06): a probe planted "Kutúzov" into a sentence of
 * the Lincoln article. Every containment check passed, because Kutúzov is
 * unquestionably in the corpus — he is in War and Peace, a different work
 * entirely. Scoping the STRING to the cited file helps, but it is still the
 * wrong quantity: it would equally pass a name that happens to appear in the
 * file while naming nobody the passage establishes.
 *
 * The right reading is the one this instrument already has an organ and a
 * name for. `makeReferentIndex` builds the cast the material's own text
 * establishes; a name that resolves to no referent there is THE-NULL-STATES'
 * `beyond-reach` — "the subject resolves to no referent, nothing to mark it
 * on" (SIG·Figure) — which is a typed finding, not a missing substring.
 */
export function premiseReferents(premise, passages = [], { referentIndexFor } = {}) {
  const names = namesIn(String(premise ?? ""));
  if (!names.length || typeof referentIndexFor !== "function" || !passages.length) return { names, unresolved: [], resolved: [], reached: false };
  let index;
  try { index = referentIndexFor(passages); } catch { return { names, unresolved: [], resolved: [], reached: false }; }
  if (!index || typeof index.resolve !== "function") return { names, unresolved: [], resolved: [], reached: false };
  const unresolved = [];
  const resolved = [];
  for (const n of names) {
    let ids;
    try { ids = index.resolve(n); } catch { ids = null; }
    // A cast that could not be read reaches nothing, and an unreachable
    // search is never a finding about the world (the standing line).
    if (!ids) continue;
    (ids.size ? resolved : unresolved).push(n);
  }
  return { names, unresolved, resolved, reached: true };
}

/**
 * premiseFacts(check) → what the sources DO say, and nothing else.
 *
 * NEVER THE FALSE CLAIM ITSELF (P126's rule, applied here too — it was missed
 * in this file for a day and the miss was measured). An earlier draft wrote
 * `Nothing in the passages contains "Durham", so "<the whole false claim>" is
 * not something the sources establish`, quoting the falsehood back at the
 * mouth. Live (S77 run 5, turn 15) the mouth then explained it at length and
 * invented a "Durham investigation" to explain. Repeating a falsehood in
 * order to deny it hands a small model the falsehood.
 *
 * So this block carries only positives: the source's own sentence where it
 * speaks of the same thing, or — when there is nothing to put in its place —
 * one short line naming ONLY the value the sources do not use. The claim is
 * never restated, and the enforcement is not here at all: `premiseGuard`
 * below keeps the absent values and the draft is checked against them.
 */
export function premiseFacts(check) {
  if (!check?.premises?.length) return "";
  const lines = [];
  const seen = new Set();
  for (const r of check.premises) {
    if (r.contradiction) {
      const t = r.contradiction.text.replace(/\s+/g, " ").trim();
      const key = fold(t);
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`- ${t} [${r.contradiction.ref}#${r.contradiction.start}-${r.contradiction.end}]`);
    }
  }
  const absent = [...new Set(check.premises.flatMap((r) => (r.contradiction ? [] : [...r.flags.map((f) => f.value), ...(r.contentGap ?? [])])))];
  const strangers = [...new Set(check.premises.flatMap((r) => r.beyondReach ?? []))];
  const parts = [];
  if (lines.length) parts.push(`What these sources say about it:\n${lines.join("\n")}`);
  if (strangers.length) parts.push(`${strangers.map((v) => `"${v}"`).join(", ")} ${strangers.length === 1 ? "is not someone or something" : "are not people or things"} this passage introduces at all.`);
  // A name already reported as someone this passage does not introduce is not
  // reported a second time as a missing string — the referent reading is the
  // better one and it supersedes.
  const onlyAbsent = absent.filter((v) => !strangers.includes(v));
  if (onlyAbsent.length) parts.push(`These sources do not use ${onlyAbsent.map((v) => `"${v}"`).join(", ")} anywhere. There is nothing here to describe under that name.`);
  return parts.join("\n\n");
}

/**
 * premiseGuard(check) → the values the question asserted that the material
 * does not carry. The instrument keeps these and checks the DRAFT against
 * them; they are the enforcement the prompt is not asked to provide.
 */
export function premiseGuard(check) {
  if (!check?.premises?.length) return [];
  return [...new Set(check.premises.flatMap((r) => (r.contradiction ? [] : [...r.flags.map((f) => f.value), ...(r.beyondReach ?? []), ...(r.contentGap ?? [])])))]
    .filter(Boolean)
    .map((value) => ({ value, fold: fold(value) }));
}

/**
 * repeatsAbsentPremise(sentence, guards) → the guard a sentence repeats, or
 * null. A sentence that asserts the very token the sources lack is the
 * capitulation this whole check exists to stop, so it does not ship.
 */
export function repeatsAbsentPremise(sentence, guards = []) {
  const f = fold(sentence);
  return guards.find((g) => g.fold && f.includes(g.fold)) ?? null;
}

/**
 * correctTurn({ text, passages, question, call, messages, splitSentences, rounds, maxTokens, streaming })
 *   → { text, check, outcomes, asked, before, after }
 * P122's check and rewrite, for ANY turn. Byte-identical to no-op when there
 * are no passages, no snips, or no flags.
 */
export async function correctTurn({ text, passages = [], question = "", terms = [], call = null, messages = [], splitSentences, rounds = 1, maxTokens = 512, streaming = {}, onRewrite = null }) {
  const body = String(text ?? "");
  if (!body.trim() || !passages.length || typeof splitSentences !== "function") return { text: body, check: null, outcomes: [], asked: 0 };
  const snips = snipsFor(passages, { obligations: contentWords(question), terms });
  if (!snips.length) return { text: body, check: null, outcomes: [], asked: 0 };
  const before = checkSection(splitSentences(body), snips);
  let out = body;
  const outcomes = [];
  let asked = 0;
  let standing = before.flagged;
  let lastReply = null;
  while (asked < rounds && standing.length && typeof call === "function") {
    asked += 1;
    let reply;
    try { reply = await call([...messages, { role: "assistant", content: out }, { role: "user", content: reviseAsk(standing, snips) }], { effort: "low", maxTokens, ...streaming }); }
    catch (e) { outcomes.push({ outcome: "refused", because: `the rewrite ask failed: ${String(e?.message ?? e).slice(0, 120)}`, round: asked }); break; }
    const applied = applyRewrite(out, standing, reply, snips);
    outcomes.push(...applied.outcomes.map((o) => ({ ...o, round: asked })));
    const moved = applied.outcomes.some((o) => o.outcome === "rewritten" || o.outcome === "dropped");
    if (moved && applied.text && applied.text !== out) { out = applied.text; onRewrite?.(applied.outcomes.filter((o) => o.outcome === "rewritten" || o.outcome === "dropped")); }
    standing = checkSection(splitSentences(out), snips).flagged;
    if (String(reply ?? "") === lastReply) break;
    lastReply = String(reply ?? "");
  }
  const after = checkSection(splitSentences(out), snips);
  return {
    text: out, asked, outcomes,
    check: { snips: snips.length, atoms: before.atoms, supported: before.supported, flagged: before.flagged.length, after: { flagged: after.flagged.length, supported: after.supported, atoms: after.atoms }, flags: after.flagged.map((r) => ({ sentence: r.sentence, flags: r.flags.map((f) => ({ kind: f.kind, value: f.value, reason: f.reason })), contradiction: r.contradiction ? { ref: r.contradiction.ref, start: r.contradiction.start, end: r.contradiction.end, snipYears: r.contradiction.snipYears } : null })) },
    before, after,
  };
}


// ── THE MOUTH NARRATING ITS OWN PROCESS (P127) ──────────────────────────────
// Measured all through the long-stream run: answers that open "## Identify
// the passage", "This analysis focuses on a passage from the `holon.js`
// file", "Let's break down the code and understand its purpose" — the model
// describing the act of answering instead of answering. `cutMetaTalk` cannot
// see this: it matches the PIECE's own instruction vocabulary, and none of
// these words are in it.
//
// The cut is deliberately narrow, because the two things it must not touch
// are the two that matter most:
//   * A STATED ABSENCE stays. "The sources do not contain a passage about
//     Scheria" is a finding (THE-NULL-STATES, law 3), not scaffolding.
//   * ANYTHING CARRYING CONTENT stays. A sentence with a name, a number, or
//     a word the material itself uses is answering, whatever it sounds like.
// So a sentence goes only when it is process narration AND says nothing about
// the material at all.
const HEADING_RE = /^\s*(?:#{1,6}\s|\*\*[^*]+\*\*\s*:?\s*$|\d+\.\s*\*\*)/;
// FOUND LIVE 2026-09-09 (a chip-UX pass surfaced it, not a dedicated hunt):
// "Also looked at: en.wikipedia.org was read and speaks of the same things
// without answering this." shipped in a checked answer's own prose, and the
// grounding ladder — correctly, since nothing upstream told it otherwise —
// ran the full witness/self-tier apparatus against it as though it were a
// factual claim, reading as a category error once the reader could actually
// see the item's full detail (the chip-UX pass, same day, is what made it
// legible enough to notice). The sentence IS process narration (the model
// describing its own research act, not the world) — `i \w+\b` already
// catches "I also looked at..." but this specimen opens with the adverb, no
// first-person pronoun in sight. Added as its own alternative rather than
// widening `i \w+\b` to match mid-sentence, which would risk matching real
// content ("Also, Napoleon invaded Russia in 1812.").
// FOUND LIVE 2026-09-10 (a real correction turn, driven live: told "that
// doesn't make sense, that's when hamlin was VP", gemma2:2b answered "You
// are absolutely right! My apologies. I seem to have gotten confused..." —
// two sentences of pure apology and zero corrected content). Neither
// opener is first-person the way the rest of this list is: the model is
// addressing the READER ("You are...") or naming its own error as a
// possessive ("My apologies/mistake") rather than narrating an action with
// "I" — this file's own header names the identical shape ("You're right,
// we established that…") as the specimen this whole module was built to
// stop, so it belongs in the cut list too, not just the premise check.
const PROCESS_RE = /^\s*(?:let(?:'|’)?s\b|let me\b|i(?:'|’)?(?:ll|m|d|ve)\b|i \w+\b|we(?:'|’)?(?:ll|re|ve)\b|here(?:'|’)?s\b|this (?:analysis|passage|section|code|snippet|document|text|response|answer|breakdown)\b|the (?:following|passage|snippet|code) (?:is|describes|shows|focuses)\b|to (?:answer|summarize|understand|break)\b|in (?:short|summary|conclusion)\b|also (?:looked at|checked|consulted|searched|read)\b|first,|next,|finally,|okay|sure|certainly|you(?:'|’)?re (?:right|correct)\b|you are (?:absolutely |quite |completely )?(?:right|correct)\b|my (?:apologies|mistake|bad)\b)/i;
// KEEPS_RE is snip-check.js's own ABSENCE_RE, imported above — the one
// implementation, shared: moved there 2026-09-08 so that module's atom/
// company check could exempt an absence sentence the same way this file's
// `cutProcessTalk` already does, rather than growing a second, driftable
// copy of "what a stated absence looks like."

/**
 * cutProcessTalk(text, { materialText, splitSentences }) → { text, cut }
 * Sentences that narrate the answering and say nothing about the material.
 */
export function cutProcessTalk(text, { materialText = "", splitSentences }) {
  if (typeof splitSentences !== "function") return { text: String(text ?? ""), cut: [] };
  const material = new Set(contentWords(materialText));
  const cut = [];
  const kept = [];
  for (const raw of splitSentences(String(text ?? ""))) {
    const sent = String(raw?.text ?? raw ?? "");
    if (!sent.trim()) continue;
    const shape = HEADING_RE.test(sent) || PROCESS_RE.test(sent);
    if (!shape) { kept.push(sent); continue; }
    if (KEEPS_RE.test(sent)) { kept.push(sent); continue; }              // a stated absence is a finding
    if (atomsOfText(sent).length) { kept.push(sent); continue; }          // carries a name, number or date
    // "Speaks the material's own words" was one shared word away from never
    // cutting a real specimen (found live, 2026-09-09): "Also looked at:
    // sovietspaceprogram.com, en.wikipedia.org were read and speak of the
    // same things without answering this" survived because a real fetched
    // page, hundreds of words long, happened to contain "read" or "same"
    // somewhere — a coincidence this guard read as "carries the material's
    // content." A single common word overlapping a long passage is nearly
    // guaranteed by chance; this project's own company rule (P31: numbers
    // need company, not bare occurrence) is the same lesson one register
    // over. Two distinct shared words is a much rarer coincidence and is
    // still cleared easily by genuine paraphrase (the "tide" specimen
    // below shares four).
    if (contentWords(sent).filter((w) => material.has(w)).length >= 2) { kept.push(sent); continue; } // speaks the material's own words
    cut.push(sent);
  }
  if (!cut.length || !kept.length) return { text: String(text ?? ""), cut: kept.length ? cut : [] };
  return { text: kept.join(" ").replace(/\s{2,}/g, " ").trim(), cut };
}

/**
 * stripLeadingFraming — remove the SCaffold a small model puts in front of
 * its answer ("The text says that…", "According to the text…", "Based on
 * the sources…") so the reply starts with the claim, not with a description
 * of where the claim came from. This is the ONE P186 exception that may
 * touch the shipped text, and it is deliberately narrower than a sentence
 * edit: it strips a LEADING PREFIX ONLY, never anything in the middle, and
 * refuses when the remainder is not a real sentence (shorter than a clause,
 * or no sentence-ending mark). The claim's own first word is re-capitalised
 * ("moscow burned…" → "Moscow burned…"). Returns { text, stripped }.
 */
const FRAMING_RE = /^(?:the (?:text|sources?|passage|material|article|document) (?:says?|states?|mentions?|tells us|doesn'?t say|does not say)(?: that)?|according to (?:the|these|those|our|their)?\s*(?:text|sources?|passage|material|article|document)|based on (?:the|these|those)?\s*(?:text|sources?|passage|material|article|document)|in (?:the|these|those)?\s*(?:text|sources?|passage|material|article|document)|from (?:the|these|those)?\s*(?:text|sources?|passage|material))\s*/i;
export function stripLeadingFraming(text) {
  const t = String(text ?? "").trim();
  const m = t.match(FRAMING_RE);
  if (!m) return { text: t, stripped: false };
  const rest = t.slice(m[0].length).replace(/^[\s,;:—–-]+/, "").trim();
  if (rest.length < 15 || !/[.!?]/.test(rest)) return { text: t, stripped: false };
  return { text: rest[0].toUpperCase() + rest.slice(1), stripped: true };
}

/**
 * stripTrailingFraming — the same scaffold FRAMING_RE names, found live at
 * the OTHER end of the sentence: "...the current President of the United
 * States, according to the sources provided." stripLeadingFraming refuses
 * this by design (its own docstring: "a LEADING PREFIX ONLY, never anything
 * in the middle" — and a trailing clause is neither). The mechanical
 * citation apparatus already names the REAL source (crown.js's own address,
 * shown separately in the ground-detail chip) — a trailing "according to
 * the sources" in the model's own prose is a vaguer, redundant hedge on top
 * of a citation that already exists; cutting it is not cutting attribution,
 * it's cutting the ONE piece of attribution the model was never trusted to
 * write honestly in the first place (L5: a compliance-critical fact — here,
 * which source — is never left to the model's own words).
 */
const TRAILING_FRAMING_RE = /,?\s*(?:according to|based on|per)\s*(?:the|these|those|our|their)?\s*(?:text|sources?|passage|material|article|document)s?(?:\s+(?:provided|given|attached|above|cited))?\s*[.!?]?\s*$/i;
export function stripTrailingFraming(text) {
  const t = String(text ?? "").trim();
  const m = t.match(TRAILING_FRAMING_RE);
  if (!m) return { text: t, stripped: false };
  let rest = t.slice(0, m.index).trim();
  if (rest.length < 15) return { text: t, stripped: false };
  if (!/[.!?]$/.test(rest)) rest += "."; // the clause we cut carried the sentence's own terminal punctuation
  return { text: rest, stripped: true };
}

/** The snips a turn stands on, as the block handed above its material (P122's, for any turn). */
export function turnSnipBlock(passages, question, terms = []) {
  const snips = snipsFor(passages, { obligations: contentWords(question), terms });
  return snips.length ? snipBlock(snips) : "";
}
