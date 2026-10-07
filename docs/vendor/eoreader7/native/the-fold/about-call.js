// about-call.js — the one crossing about.js's own header refuses to make: a
// small model READ of the SITUATION (never the content), asked what it
// thinks the person is asking for — never asked to answer.
//
// (user, 2026-09-08, after "what's this book about?" over War and Peace,
// cut short, came back as a fabricated summary of a different book
// entirely.) The first fix — `holon.js`'s `declaredLine`, the source's own
// title page riding every turn — closed that specimen; verified live, the
// fabrication is gone. This is the sharper instrument the user asked for
// next: "a small model call given the content and SEEING that this was
// attached (so it has a meta view) would have correctly understood what the
// user was asking… it should see the raw json that it was given, but not
// mistake its role to be to answer it"; then, on the call's own diet: "it
// should get an abbreviated, whether folded or ellipsed, section of the
// content so it doesn't get overwhelmed by the content the talker will
// use"; then, naming the mechanism plainly: "we need an 'about' model call
// that gets all the folded content needed… to tell the talker what it
// thinks the user is saying."
//
// THE GATE IS FREE, THE CALL IS NOT (P30's own law, aimed here): spending a
// model call on every grounded turn to ask "what do they mean" would be the
// exact waste that law forbids, when `about.js::asksAboutMaterial` already
// answers it mechanically for the phrasings it knows. That detector is the
// free selector; this call is the paid follow-through — it exists because a
// static template can only ever say what a SOURCE declares itself to be,
// never read the actual QUESTION against the SITUATION and say what kind of
// answer would satisfy it (the whole gist, versus one buried fact, versus
// whether anything relevant has even been read yet).
//
// THE WALL: this call may only INTERPRET, never ANSWER. Its prompt asks a
// narrow question a summary does not answer, and — because an instruction is
// never trusted alone (L5) — the reply is checked MECHANICALLY, not by
// re-reading it with judgment: `looksLikeAnAnswer` refuses a reply that uses
// a content word the SAMPLE carries and the QUESTION does not. A true
// interpretation talks about the ASK, in the ASK's own words plus ordinary
// meta-vocabulary ("the whole scope", "one specific detail"); it has no
// legitimate reason to introduce a name or term it could only have gotten
// from reading the excerpt, because reading the excerpt is not its job. A
// refused reply is discarded, never forwarded — the talker gets the plain
// situation view exactly as if this call had never run. Disclosed rather
// than claimed airtight: a reply that stays answer-shaped while genuinely
// avoiding every sample-only word (echoing only the question's own words
// back) would pass this wall; the budget on reply length is the second,
// independent check for that residue, not a proof against it.
//
// PURE except for the one injected crossing (`call`) — the cast.js pattern.
import { aboutBlock } from "./about.js";
import { CLAIM_STOPWORDS } from "../organs/grounding.js";

/** How long an interpretation may run. Declared (P9): short by construction, because a long reply is the shape of a summary, not a reading of the ask. */
export const ABOUT_CALL_MAX_CHARS = 160;
/** The token budget matching the char budget above. Declared (P9), by construction — one short sentence, never a summary's worth. */
export const ABOUT_CALL_MAX_TOKENS = 60;

const ABOUT_SYSTEM = "Someone attached material and asked a question. Below is what the material IS — its own title, its size, how much has been read, and a short sample of its words — never the whole of it. Your only job: in one short sentence, say what kind of thing they are asking for. Not the answer. Not a summary of the material. Just what they seem to want — the whole gist of it, one particular detail, whether anything relevant has even come up yet, or something else. You have not read the material and are not answering from it.";

const fold = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// The received closed class (grounding.js::CLAIM_STOPWORDS), not a list
// typed here — a bare `length > 2` floor let "the"/"and"/"his" count as
// content on both sides of the leak check, so nearly every reply shared
// SOME stopword with SOME sample sentence and the wall refused almost
// everything (caught by this file's own test before it shipped).
const words = (t) => new Set(fold(t).split(/[^\p{L}\p{N}']+/u).map((w) => w.replace(/^'+|'+$/g, "")).filter((w) => w.length > 2 && !CLAIM_STOPWORDS.has(w)));

/**
 * looksLikeAnAnswer(reply, { question, sampleText }) → true when the reply
 * is shaped like a summary of the material rather than a reading of the ask.
 * Two independent, mechanical tells: it runs past the declared budget or
 * carries more than one sentence (a real interpretation is one clause), or
 * it uses a content word the SAMPLE carries that the QUESTION does not —
 * the sample's own vocabulary leaking into a reply that was never shown the
 * sample to describe, only to avoid summarizing.
 */
export function looksLikeAnAnswer(reply, { question = "", sampleText = "" } = {}) {
  const text = String(reply ?? "").trim();
  if (!text) return true;
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (text.length > ABOUT_CALL_MAX_CHARS || sentences.length > 1) return true;
  if (!sampleText) return false;
  const askWords = words(question);
  const sampleOnly = [...words(sampleText)].filter((w) => !askWords.has(w));
  if (!sampleOnly.length) return false;
  const sampleSet = new Set(sampleOnly);
  return [...words(text)].some((w) => sampleSet.has(w));
}

/**
 * interpretAsk(question, { rows, digest, call }) → a short interpretation
 * string, or null. `rows` is `about.js::materialView`'s output, `digest` is
 * `about.js::abbreviate`'s — the caller builds the view once and can pass
 * the same one to `aboutBlock` for the plain-situation fallback. `call` is
 * the injected model call (the cast.js pattern); a call that throws, or a
 * reply that fails the wall, both degrade to null — the caller falls back
 * to the situation view alone, never to a guess.
 */
export async function interpretAsk(question, { rows = [], digest = null, call } = {}) {
  if (typeof call !== "function") throw new TypeError("interpretAsk: call is injected");
  const view = aboutBlock(rows, digest);
  if (!view) return null;
  const messages = [
    { role: "system", content: ABOUT_SYSTEM },
    { role: "user", content: `${view}\n\nThe question: ${question}` },
  ];
  let raw;
  try { raw = await call(messages, { effort: "low", maxTokens: ABOUT_CALL_MAX_TOKENS }); }
  catch { return null; }
  const text = String(raw ?? "").trim().split("\n")[0].trim();
  if (!text || looksLikeAnAnswer(text, { question, sampleText: digest?.text })) return null;
  return text;
}
