// gary.js — Gary, the archon in charge of PROMPTING: what the mouth is handed,
// in what order, and what never goes in at all.
//
// Handle: Gary Walsh, the body man. He carries the bag and hands the principal
// exactly what she needs at the moment she needs it — the name of the person
// about to shake her hand, whispered half a second before it matters. He
// carries everything and produces only the one thing. He never speaks for her,
// and he never tells her what to say. That is the job here: Gary owns what goes
// into a prompt, hands it over at the door, and never edits a word the mouth
// says back (P186 — the mouth is not censored).
//
// The register lives in solon.js — the one authoritative list; this file does
// not restate it. Here: GARY (the prompt), with KONDO under him — she measures
// what a prompt carries twice; he keeps the rules about what may be carried at
// all, and hands the bag over.
//
// THE RULES HE KNOWS, each one already law or already measured. Every one is
// checked mechanically; none is a matter of taste:
//
//   no-address        The mouth never sees an address (P55). An address in the
//                     model's view is an address it will write, and a written
//                     address is a fabrication order. STRUCK at the door, every
//                     time, by the firewall's own organ.
//   no-apparatus      Model-facing text never names this instrument's own parts
//                     (P55). Measured: a prompt that says "the passages" three
//                     times while forbidding the model to mention them gets
//                     "The prompt specifically identifies…" back.
//   no-json-ask       JSON is the DECODER's job, never the prompt's. A schema
//                     goes in `format`; asking a small model for JSON in prose
//                     teaches it that JSON is a way to talk. REFUSED.
//   information-not-prohibition
//                     A fact the model can reason from, never an instruction
//                     about what not to say — telling a small model what to
//                     avoid is how it learns to say it (the void prefixes'
//                     own posture: "the emptiness is real", never "do not
//                     invent"). FLAGGED with the clause, because the existing
//                     prompts still carry some and each is its own decision.
//   nothing-twice     A line the prompt already carries is waste (P232). Kondo
//                     counts it; Gary refuses a caller who tries to cut a NOTE
//                     because a verbatim line carries it, outside the declared
//                     arm — measured 3-4 fabrications in 10 against 0.
//   fits-the-window   Prompt + declared output must fit the window the model is
//                     actually loaded at (heimdall's `loadedWindowOf`), or the
//                     runner keeps the head and the tail and drops the middle,
//                     silently. Unknown window is a GAP, never a verdict.
//   question-last     The person's own message is the final turn, verbatim,
//                     never wrapped in a directive about itself — fed a
//                     description of the task, a small model answers with a
//                     description of the task (FLAT_EXECUTE's own history).
//   no-oracle-mode    No live claim, document, or task in view — the mouth
//                     does not free-associate (P244). REFUSED: the caller
//                     routes to the fixed reply (oracleRefusalText), never
//                     to the model.
//
// PURE: no fetch, no DOM, no storage. The firewall's organs and Kondo are
// injected; tested against the real ones.

export const SEVERITY = Object.freeze({ STRIKE: "strike", REFUSE: "refuse", FLAG: "flag" });

export const RULES = Object.freeze([
  { id: "no-address", cites: "P55", severity: SEVERITY.STRIKE, says: "the mouth never sees an address" },
  { id: "no-apparatus", cites: "P55", severity: SEVERITY.FLAG, says: "model-facing text never names this instrument's own parts" },
  { id: "no-json-ask", cites: "P80 (JSON is the decoder's job)", severity: SEVERITY.REFUSE, says: "a schema goes in format, never in the prompt" },
  { id: "information-not-prohibition", cites: "P32/P55", severity: SEVERITY.FLAG, says: "a fact to reason from, never an instruction about what not to say" },
  { id: "nothing-twice", cites: "P232", severity: SEVERITY.FLAG, says: "a line the prompt already carries is waste" },
  { id: "notes-are-not-cut-for-a-snip", cites: "P232 amendment", severity: SEVERITY.REFUSE, says: "a note is never dropped because a verbatim line carries it, outside the declared arm" },
  { id: "fits-the-window", cites: "P232", severity: SEVERITY.FLAG, says: "prompt plus declared output fits the loaded window, or the middle goes silently" },
  { id: "question-last", cites: "P199", severity: SEVERITY.FLAG, says: "the person's own message is the final turn, verbatim" },
  { id: "no-oracle-mode", cites: "P244", severity: SEVERITY.REFUSE, says: "no live claim, document, or task in view — the mouth does not free-associate" },
]);

/** Asking for JSON in prose — the shapes measured to teach a small model that
 *  JSON is a way to talk. A prompt that merely MENTIONS json (a schema's own
 *  field name in an example) is not an ask; the ask is an imperative. */
const JSON_ASK = /\b(reply|respond|answer|return|output|format your (?:answer|reply))\b[^.]{0,40}\b(?:with|in|as)\b[^.]{0,20}\bjson\b|\bjson\s+(?:object|only|format)\b/i;
/** A prohibition aimed at the mouth. "Never" and "do not" addressed to the
 *  model — not the same as a STATEMENT that something is absent. */
const PROHIBITION = /\b(?:do not|don't|never|avoid|refrain from|must not|should not)\s+([a-z][^.,;:]{0,60})/gi;

const wordsOf = (t) => String(t ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const clip = (s, n = 90) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

// ── no-oracle-mode — the pure helpers, so callers without a Gary instance
// (app.js's pre-model door, holon.js's task-level door) read the SAME rule
// Gary's own check reads below: one implementation, never two that drift
// (P22's own postmortem class). ────────────────────────────────────────────
//
// The floor is structural, never fitted: 2 distinct content words, reused
// from admission.js's own ADMISSION_FLOOR (a whole source is not offered on
// less), never a fresh number. The stopword set mirrors eoreader7
// native/organs/source.js's own STOPWORDS (copied, not imported — this file
// holds no imports by design, and the page graph pins that); the length
// floor mirrors that tokenizer's own (length > 2, numerals exempt).
export const ORACLE_MIN_CONTENT_WORDS = 2;

const ORACLE_STOPWORDS = new Set(
  ("a an and are as at be but by for from had has have he her his i in into is it its of on or " +
    "our she that the their them there these they this to was were what when where which who why " +
    "will with would you your do does did can could should about would're not no if then than so " +
    "how me my we us been being over under after before also just like more most some such only").split(" "),
);

const isNumeral = (t) => /^\d+$/.test(t);

/** The turn's own checkable shape, mechanically: distinct content words. */
export function oracleContentWords(text) {
  return [...new Set(wordsOf(text).filter((t) => (t.length > 2 || isNumeral(t)) && !ORACLE_STOPWORDS.has(t)))];
}

// A WH-interrogative naming a DEFINITE role or value ("who is the
// president", "what is the capital", "when is the deadline") presupposes a
// single, real, currently-true answer exists — a definite description,
// checkable on its own grammar regardless of how many content words
// survive stopword stripping. Found live, 2026-09-22: "who is the
// president" strips to ONE content word ("president"; "who"/"is"/"the" are
// all in ORACLE_STOPWORDS) — below ORACLE_MIN_CONTENT_WORDS — so
// hasCheckableClaim said false, the fast-pass-only gate stood unchecked,
// and S1 answered confidently and WRONG with nothing to catch it: the
// exact failure this whole grounding ladder exists to prevent, on the
// canonical shape it was built for. The floor is the right test for an
// ordinary sentence; it was never the right test for a bare definite
// description, so this is a second, independent door, never a lowered
// number — errs toward checking on purpose (the same asymmetry
// triviallyChatty's own header already argues: a false positive here costs
// one grounded pass, a false negative is a time-sensitive fact answered
// from a small model's stale memory with nothing behind it).
//
// AMENDED, same day: the fix above still missed the contracted form of the
// identical shape. wordsOf splits on the apostrophe ("what's" -> "what",
// "s"), so "what's the score" strips to ONE content word exactly the same
// way "who is the president" did, and the regex above requires literal
// whitespace between the WH-word and the copula — "what" immediately
// followed by "'s" never matches it. Confirmed live: hasCheckableClaim
// ("what's the score") === false, before this amendment. This is not a
// new case to patch one at a time (a third contraction would fail
// tomorrow) — 's/'re are English's own contracted spellings of is/are, so
// the fix is admitting the contraction into the SAME grammar, never a
// second regex or a lowered word count. was/were have no standard WH
// contraction ("what'd the score" reads as "what did", a different
// question) and are deliberately not matched here.
//
// AMENDED again, same day, adversarially verified live against the two
// amendments above rather than assumed fixed by either: both still
// require the LITERAL word "the" immediately after the copula, and
// English just as idiomatically drops the article entirely for a
// unique-office title — "who is chairman", "who is president", "who is
// CEO" are as ordinary as their article-bearing twins, never a rarer or
// less grammatical phrasing. Confirmed live against the running
// functions: oracleContentWords("who is chairman") = ["chairman"], one
// word, below ORACLE_MIN_CONTENT_WORDS, and hasCheckableClaim("who is
// chairman") === false — the identical bug both amendments above set out
// to fix, reproduced under a third, equally common phrasing they did not
// cover. "the" is now OPTIONAL rather than required: the bare WH+copula
// shape already presupposes a single, currently-true answer (Strawson's
// definite description) whether or not the speaker bothers to mark it
// with an article, so dropping "the" never turns a definite description
// into an open-ended one — it only ever narrows which office/role/value
// is being asked after. Same asymmetry as every amendment above: a false
// positive here still costs one grounded pass, never a wrong answer
// shipped unchecked.
const WH_DEFINITE_RE = /\b(?:who|what|when|where)(?:'s|'re|\s+(?:is|are|was|were))\s+(?:the\s+)?\S/i;

// AMENDED again, 2026-09-22: every amendment above still requires the WH-
// word to be followed DIRECTLY by a copula (is/are/was/were, or its
// contraction) — a WH-question built on any OTHER main verb ("who leads
// the EU", "who runs the committee", "when did the treaty end") never
// matched at all, because the regex was anchored to a fixed, closed verb
// list rather than to the grammatical shape that actually makes a
// WH-question checkable: a WH-word introducing a clause that names a
// definite ("the X") referent. Confirmed live: hasCheckableClaim("who
// leads the EU") === false — oracleContentWords reduces it to one word
// ("leads"; "EU" lowercases to two characters and fails the length floor
// with no acronym exemption, same as ORACLE_STOPWORDS already drops
// who/the). This is the SAME class of gap the copula amendments above
// closed, on a different piece of the same grammar — enumerating verbs
// (leads, runs, chairs, heads, governs, presides over, commands...) would
// just reopen this one verb at a time forever, so the test moves to the
// SHAPE instead: any WH-word, followed ANYWHERE in the clause (any verb,
// any number of words between) by a definite article introducing a noun
// phrase, is a definite description regardless of which verb sits between
// them. A second, independent door beside WH_DEFINITE_RE, never a
// replacement for it (the copula form still needs no "the" at all —
// "who is chairman" — which this shape does not cover). Same asymmetry as
// every amendment above: a false positive here costs one grounded pass
// ("who told you to clean the room" now also escalates, harmlessly); a
// false negative ships a live institutional fact from a small model's
// stale memory with nothing behind it.
const WH_DEFINITE_ANY_VERB_RE = /\b(?:who|what|when|where|which)\b[^.?!]*\bthe\s+\S/i;

/** Whether the person's own words carry anything an elenchus could hold against. */
export function hasCheckableClaim(text) {
  const t = String(text ?? "");
  if (WH_DEFINITE_RE.test(t) || WH_DEFINITE_ANY_VERB_RE.test(t)) return true;
  return oracleContentWords(t).length >= ORACLE_MIN_CONTENT_WORDS;
}

/**
 * checkOracleMode({ materialEmpty, text, questionCycle } = {}) — the rule as
 * a pure function. `materialEmpty`: true (nothing in view) / false / null
 * or undefined (unknown — a gap, never a conviction: an absence the caller
 * never measured must not refuse). `questionCycle`: undefined = not checked
 * (fall back to the content-words heuristic); null = checked, no claim;
 * object = a claim is in view, never refused. Returns the REFUSE finding or
 * null — never throws, never a bare boolean (P4: a gap is a result).
 */
export function checkOracleMode({ materialEmpty = null, text = "", questionCycle = undefined } = {}) {
  if (materialEmpty !== true) return null;
  if (questionCycle !== undefined && questionCycle !== null) return null;
  if (questionCycle === null) {
    return { rule: "no-oracle-mode", severity: SEVERITY.REFUSE, cites: "P244", detail: "no live claim, document, or task in view — the mouth does not free-associate" };
  }
  if (hasCheckableClaim(text)) return null;
  return { rule: "no-oracle-mode", severity: SEVERITY.REFUSE, cites: "P244", detail: `no live claim, document, or task in view (“${clip(text, 60)}”) — the mouth does not free-associate` };
}

/**
 * oracleRefusalText({ lastRef } = {}) — the fixed, small reply an oracle-
 * mode refusal routes to (P244): point back at the last live document or
 * task, or ask what to read. Closed set of two shapes — no model call, no
 * free association wearing a refusal's clothes.
 */
export function oracleRefusalText({ lastRef = null } = {}) {
  if (lastRef) return `Nothing in view to stand on — no document, claim, or task in this turn. The last thing open was ${lastRef}; say the word and I'll read it. Otherwise: what should I read?`;
  return "Nothing in view to stand on — no document, claim, or task in this turn. What should I read?";
}

export function makeGary({ strikeAddresses = null, apparatusMentions = null, kondo = null, windowOf = null, tokensOf = null } = {}) {
  const count = (text) => (typeof tokensOf === "function" ? { n: tokensOf(text), estimated: false } : { n: Math.ceil(String(text ?? "").length / 4), estimated: true });

  /** Every rule read over one call's messages. Returns findings, never throws. */
  function check(messages, { model = null, options = {}, arm = "claims", material = undefined, questionCycle = undefined } = {}) {
    const list = Array.isArray(messages) ? messages : [];
    const text = list.map((m) => String(m?.content ?? "")).join("\n");
    const findings = [];
    const gaps = [];
    const add = (id, detail, extra = {}) => {
      const rule = RULES.find((r) => r.id === id);
      findings.push({ rule: id, severity: rule?.severity ?? SEVERITY.FLAG, cites: rule?.cites ?? null, detail, ...extra });
    };

    if (typeof apparatusMentions === "function") {
      let named = [];
      try { named = apparatusMentions(text) ?? []; } catch { named = []; }
      // apparatusMentions returns [{term, index, excerpt}], not strings — a
      // caller that joins the rows themselves gets "[object Object]" on every
      // hit. Found live 2026-09-16, checking the witness's own prompts: every
      // no-apparatus finding this file had ever produced read as garbage.
      if (named.length) add("no-apparatus", `names this instrument's own parts: ${[...new Set(named.map((m) => m.term ?? m))].slice(0, 6).join(", ")}`);
    } else gaps.push({ type: "no_apparatus_organ", detail: "no apparatusMentions injected — the naming rule was not checked" });

    if (JSON_ASK.test(text)) add("no-json-ask", `the prompt asks for JSON: "${clip(text.match(JSON_ASK)?.[0])}"`);

    const prohibitions = [...text.matchAll(PROHIBITION)].map((m) => clip(m[0], 60));
    if (prohibitions.length) add("information-not-prohibition", `${prohibitions.length} prohibition(s) aimed at the mouth`, { clauses: [...new Set(prohibitions)].slice(0, 5) });

    const last = list.at(-1);
    if (last && last.role !== "user") add("question-last", `the last turn is ${last.role}, not the person's own message`);

    // no-oracle-mode reads the PERSON's own words (the last user turn, not
    // merely the last turn — question-last above already owns the shape) and
    // the caller's own material count. `material` undefined = the caller
    // never said what is in view: a gap, never a refusal. An array counts by
    // length; a number is the count; anything else is unknown too.
    const lastUser = [...list].reverse().find((m) => m?.role === "user");
    const materialEmpty = Array.isArray(material) ? material.length === 0 : typeof material === "number" ? material === 0 : null;
    if (material === undefined) {
      gaps.push({ type: "no_material_view", detail: "no material count handed over — oracle mode not checked" });
    } else {
      const hit = checkOracleMode({ materialEmpty, text: lastUser ? String(lastUser.content ?? "") : "", questionCycle });
      if (hit) add(hit.rule, hit.detail);
    }

    const tokens = count(text);
    const out = Number(options?.num_predict ?? 0) || 0;
    let window = null;
    if (typeof windowOf === "function" && model) { try { const w = windowOf(model); if (Number.isFinite(w)) window = w; } catch { /* unknown */ } }
    if (window == null && Number.isFinite(options?.num_ctx)) window = options.num_ctx;
    if (window == null) gaps.push({ type: "no_window", detail: "no loaded window and no declared num_ctx — fit not checked" });
    else if (tokens.n + out > window) add("fits-the-window", `${tokens.n} tokens + ${out} declared output over a ${window} window`, { tokens: tokens.n, out, window, estimated: tokens.estimated });

    if (kondo?.reviewCall) {
      let review = null;
      try { review = kondo.reviewCall({ messages: list, model, options }); } catch { review = null; }
      const twice = (review?.findings ?? []).filter((f) => f.kind === "restated" || f.kind === "contained");
      if (twice.length) add("nothing-twice", `${twice.length} line(s) carried twice`, { owners: [...new Set(twice.map((f) => f.owner))], tokens: Math.ceil(twice.reduce((n, f) => n + (f.chars ?? 0), 0) / 4) });
    }

    return { findings, gaps, arm, tokens: tokens.n, estimated: tokens.estimated, window };
  }

  /**
   * THE BAG, HANDED OVER. Strikes what must never reach the mouth, reads every
   * rule over what remains, and returns the messages to send beside what he
   * found. A REFUSE-severity finding is returned as `refused` — the caller
   * decides whether to ship it, and the record says he objected. Gary changes
   * only the INPUT, and never a word of what comes back (P186).
   */
  function hand(messages, { model = null, options = {}, arm = "claims", material = undefined, questionCycle = undefined } = {}) {
    const list = Array.isArray(messages) ? messages : [];
    const handed = typeof strikeAddresses === "function"
      ? list.map((m) => (m && typeof m.content === "string" ? { ...m, content: strikeAddresses(m.content) } : m))
      : list;
    const struck = typeof strikeAddresses === "function"
      ? list.reduce((n, m, i) => n + (String(m?.content ?? "").length - String(handed[i]?.content ?? "").length), 0)
      : 0;
    const read = check(handed, { model, options, arm, material, questionCycle });
    return { messages: handed, struck, ...read, refused: read.findings.filter((f) => f.severity === SEVERITY.REFUSE) };
  }

  /**
   * The cut a builder proposes, checked before it is made: a note is never
   * dropped because a verbatim line carries it unless the caller declares the
   * arm it was measured under. Returns the pairs he permits.
   */
  function permitCut(pairs, { arm = "claims", notesPair = null } = {}) {
    const asked = Array.isArray(pairs) ? pairs : [];
    const cutsNotes = (p) => notesPair && String(p?.from) === String(notesPair.from);
    if (arm === "full") return { pairs: asked, refused: null };
    const kept = asked.filter((p) => !cutsNotes(p));
    if (kept.length === asked.length) return { pairs: kept, refused: null };
    return {
      pairs: kept,
      refused: { rule: "notes-are-not-cut-for-a-snip", severity: SEVERITY.REFUSE, cites: "P232 amendment", detail: "a note is not dropped because a snip carries it — measured 3-4 fabrications in 10 against 0; declare arm \"full\" to spend that" },
    };
  }

  return { hand, check, permitCut, RULES, SEVERITY };
}

/**
 * The build-time gate, the shape firewall.js's own assertModelFacing already
 * holds: every named prompt constant read against the REFUSE rules, so a
 * prompt that asks for JSON or names the apparatus fails a test run rather
 * than shipping. Throws with every offender named.
 */
export function assertPromptsBuildable(named, gary) {
  const bad = [];
  for (const [name, text] of Object.entries(named ?? {})) {
    const { findings } = gary.check([{ role: "system", content: String(text ?? "") }]);
    for (const f of findings.filter((x) => x.severity === SEVERITY.REFUSE)) bad.push(`${name}: ${f.rule} — ${f.detail}`);
  }
  if (bad.length) throw new Error(`a prompt breaks a rule Gary keeps:\n  ${bad.join("\n  ")}`);
  return Object.keys(named ?? {});
}

/** The record line: rules, severities, counts — never the prompt's own text. */
export function garyDecision({ act = "hand", turn = null, model = null, read = null } = {}) {
  const entry = { act: `gary-${act}` };
  if (turn != null) entry.turn = turn;
  if (model) entry.model = model;
  if (!read) return entry;
  entry.tokens = read.tokens;
  entry.estimated = read.estimated;
  if (read.window != null) entry.window = read.window;
  if (read.struck) entry.struckChars = read.struck;
  entry.findings = (read.findings ?? []).map((f) => ({ rule: f.rule, severity: f.severity }));
  const gaps = [...new Set((read.gaps ?? []).map((g) => g.type))];
  if (gaps.length) entry.gaps = gaps;
  return entry;
}
