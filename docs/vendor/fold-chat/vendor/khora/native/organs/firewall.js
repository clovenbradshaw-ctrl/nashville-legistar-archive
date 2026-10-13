// firewall.js — the wall between the TALKING and the THINKING, enforced.
//
// THE INCIDENT, measured live 2026-08-27 against real fetched Wikipedia and
// gemma2:2b. Five runs of "Who was Abraham Lincoln's vice president?"
// produced, among others:
//
//   "The prompt specifically identifies Hannibal Hamlin as Lincoln's vice
//    president."
//   "The prompt confirms that the vice president was Hannibal Hamlin…"
//   "The prompt does not specify which point in his presidency should be
//    addressed, but the provided material focuses on…"
//
// The model is not answering the question. It is describing its own input.
// And it learned the words to do that from us: `EXECUTE_SYSTEM_PROMPT`
// contained the literal phrase "the prompt" TWICE, `FLAT_EXECUTE_SYSTEM_
// PROMPT` said "the passages" three times (twice while instructing the
// model not to mention them), `CHAT_SYSTEM_PROMPT` reported a retrieval
// outcome to the model ("matched no document to cite"), and the fact block
// carried its own engineering commentary into a 2B model's context
// ("7 of 97 sentence(s) with an extractable relation; the passages above
// are the complete record, this list is a partial aid, not a substitute
// for them").
//
// THE RULE: apparatus vocabulary is not model-facing. Counts, coverage,
// retrieval outcomes, the names of this instrument's own parts, and every
// caveat about how a list was built belong to the THINKING — the reasoning
// trace and the disclosure panels, where a reader can see them — and never
// to the TALKING, which is the model's own answer to a person.
//
// WHY A WALL AND NOT A FIX. Every one of those strings ALSO instructed the
// model not to do the thing ("do not describe the message or the
// passages"). L5 is this repo's oldest law and says exactly why that
// cannot work: a compliance-critical fact is never left to the model's own
// instruction-following. Telling a model not to mention the passages while
// naming them three times is the instruction-shaped version of the bug.
// The mechanical fix is to not have the vocabulary in the room.
//
// This is also the SAME bug holon.js:479-492 already fixed once, one layer
// up: "Write this part: the question. research Robert Macnamera" produced
// "This prompt asks you to research Robert McNamara…", and the note there
// records the general form — "prompt format matches output format; fed a
// description of the task, a small model answers with a description of the
// task." That fix was applied to the TASK framing and never to the
// MATERIAL framing. This file closes the rest of it, and — because a fix
// applied by hand to six strings is a fix that regresses the next time a
// seventh is written — makes it an assay instead of a habit.

/**
 * The closed class of apparatus nouns: words that name a part of this
 * instrument rather than anything in the world. Declared here, not
 * derived — the same standing `priors.js`'s own received closed classes
 * carry, with the giver being this repo's own architecture.
 *
 * The test is deliberately about NOUNS THE MODEL CAN REUSE, not about
 * every internal word. "passage" is here because a model handed it will
 * write "the passage states"; "retrieval" is here for the same reason.
 * Words that name the world ("question", "answer") are NOT here: a model
 * saying "the answer is" is answering, not describing its input.
 */
export const APPARATUS_TERMS = [
  "prompt",
  "passage",
  "passages",
  "material",
  "document",
  "documents",
  "source material",
  "search result",
  "search results",
  "retrieved",
  "retrieval",
  "extractable relation",
  "chunk",
  "chunks",
  "citation",
  "citations",
  "this turn",
  "the record",
  "mechanically confirmed",
];

// Word-boundary, case-insensitive, longest-first so "search results" is
// reported as itself rather than twice as "search result".
const TERM_RES = [...APPARATUS_TERMS]
  .sort((a, b) => b.length - a.length)
  .map((t) => ({ term: t, re: new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi") }));

/**
 * apparatusMentions(text) — every apparatus noun in a model-facing string,
 * with enough context to see it. Returns [] for a clean string.
 *
 * Overlaps are suppressed by span, so "search results" does not also
 * report "search result": a caller counting findings is counting distinct
 * leaks, not regex hits.
 */
export function apparatusMentions(text) {
  const s = String(text ?? "");
  const found = [];
  const taken = [];
  for (const { term, re } of TERM_RES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s))) {
      const start = m.index;
      const end = start + m[0].length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      taken.push([start, end]);
      found.push({
        term,
        index: start,
        excerpt: s.slice(Math.max(0, start - 30), Math.min(s.length, end + 30)).replace(/\s+/g, " ").trim(),
      });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

/** Does this string hand the model a word for one of our own parts? */
export const speaksOfApparatus = (text) => apparatusMentions(text).length > 0;

/**
 * assertModelFacing(named) — the assay itself. `named` is
 * `{ [label]: string }`. Throws with every leak named, or returns the
 * labels it cleared.
 *
 * Used by firewall.test.mjs against the REAL exported prompt constants and
 * the REAL output of `buildFactBlock`, so a newly-written prompt that
 * describes the machine fails the suite rather than shipping and being
 * discovered in an answer weeks later.
 */
export function assertModelFacing(named) {
  const failures = [];
  for (const [label, text] of Object.entries(named ?? {})) {
    const hits = apparatusMentions(text);
    if (hits.length) failures.push(`${label}: ${hits.map((h) => `"${h.term}" in «${h.excerpt}»`).join("; ")}`);
  }
  if (failures.length) {
    throw new Error(
      `model-facing text names this instrument's own parts — that vocabulary belongs to the thinking, not the talking:\n  ${failures.join("\n  ")}`,
    );
  }
  return Object.keys(named ?? {});
}

/**
 * strikeAddresses(text) — THE MOUTH NEVER SEES AN ADDRESS. The rule since
 * 2026-08-18 (an address in the model's view is an address it will write,
 * and a written address is a fabrication order), restated by the user
 * 2026-09-07: "it's just liable to lie with it". Bracketed addresses
 * ([pg2554.txt#a-b], [turn:N], [h.txt#0-75, bytes 0–46]) and bare ones
 * (h.txt#0-75#0-47) are struck; the record keeps every address, and cite.js
 * attaches them after the draft, mechanically. Applied ONCE, at the mouth's
 * door (holon.js wraps `call`), so no renderer has to remember.
 */
export function strikeAddresses(text) {
  return String(text ?? "")
    .replace(/\s*\[(?:turn:[^\]]*|[^\[\]\s]+#[^\]]*)\]/g, "")
    .replace(/(?:^|(?<=[\s(]))[^\s()\[\]"“”]+\.[A-Za-z0-9]{1,5}#\d+-\d+(?:#\d+-\d+)?/g, "")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}
export const mouthFacing = (messages) => (messages ?? []).map((m) => (m && typeof m.content === "string" ? { ...m, content: strikeAddresses(m.content) } : m));
