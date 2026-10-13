// fold-chat-lang.js — which language a person wrote in, and whether the reply
// is in it. Pure: no DOM, no IO, no model, no network, deterministic.
//
// The app answers in the asker's language (docs/NEXT-ARCHITECTURE.md: "Answer in
// the asker's language"). Retrieval may cross languages; the MOUTH voices in the
// asker's. A small local model handed English sources answers in English no
// matter what the question was written in (measured 2026-10-05: es, fr, de asks
// answered or refused in English), so the app does three things:
//   1. names the language in the system prompt (`languageInstruction`),
//   2. measures the reply's language with the SAME detector as the question's
//      (`sameLanguage`), and
//   3. when they differ, asks the model to restate its own reply in the asker's
//      language (`restateMessages`) and checks again; if it still differs the
//      fold says so (a typed note), it does not pretend.
//
// HOW IT DETECTS (no model, no network): fold-chat-langid.js — script first (a script one language owns IS the
// language; Han + Kana is ja), then, inside a shared script (Latin, Cyrillic, Arabic, Devanagari), naive Bayes over
// the word and character distributions of each candidate language's PRIOR (fold-chat-lang-priors.js, built from the
// khora's Universal Dependencies POS priors by scripts/build-lang-priors.mjs). The previous detector counted hand-typed
// stopwords and read "show me a cookie recipe" as Portuguese ("a" and "me" are Portuguese function words too); it is
// kept, measured, in eval/langid/baseline/ and docs/LANGID-PREREG.md. A text that does not clearly name a language
// is `unknown`: NOTHING is restated and the model is not told a language (never rewrite an answer on a coin-flip).
//
// THE THREAD (follow-ups): "and him?" / "chewier" carry no language of their own. `detectLang(text, { prior })` takes
// the language the conversation has been in (`threadLanguage(messages)`: the last confident language of the person's
// own earlier turns); text with evidence of its own — even a little — can still flip it, text without any inherits it.
//
// WHAT IS MEASURED vs DECLARED (Constitution II.11): the priors have a giver (the treebanks); margin, weights, the
// function-word depth and the thread bonus are DECLARED defaults chosen on the dev third of eval/langid and checked on
// the val third (docs/LANGID-PREREG.md), not derived from data.

import { identify, DECLARED as ID } from "./fold-chat-langid.js";

export const DECLARED = Object.freeze({
  ...ID,
  // A reply shorter than this many letters is never judged (a one-word answer
  // has no language signature).
  minReplyLetters: 24,
  // how many of the person's own earlier turns are read to find the thread's language
  threadTurns: 6,
});

export const LANG_NAMES = Object.freeze({
  en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese", it: "Italian", nl: "Dutch", ca: "Catalan", af: "Afrikaans",
  sv: "Swedish", da: "Danish", no: "Norwegian", ro: "Romanian", pl: "Polish", cs: "Czech", sk: "Slovak", sl: "Slovenian", hr: "Croatian",
  sr: "Serbian", bs: "Bosnian", tr: "Turkish", id: "Indonesian", ms: "Malay", fi: "Finnish", et: "Estonian", hu: "Hungarian", vi: "Vietnamese",
  lt: "Lithuanian", lv: "Latvian", cy: "Welsh", ga: "Irish", mt: "Maltese", eu: "Basque",
  ru: "Russian", uk: "Ukrainian", bg: "Bulgarian", zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic", fa: "Persian", ur: "Urdu", he: "Hebrew",
  hi: "Hindi", mr: "Marathi", bn: "Bengali", pa: "Punjabi", gu: "Gujarati", or: "Odia", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam",
  si: "Sinhala", th: "Thai", lo: "Lao", km: "Khmer", my: "Burmese", bo: "Tibetan", ka: "Georgian", hy: "Armenian", am: "Amharic", el: "Greek",
});

// Languages the detector cannot reliably tell apart on a short ask, and a reply in one is as good as in the other for
// the purpose of "did the model answer in the person's language": sameLanguage treats a family as one language. The
// Romance languages are NOT here (es/pt/it/ca/fr are distinct, and confusing them is the failure this module exists to stop).
export const FAMILIES = Object.freeze([["no", "da"], ["hr", "sr", "bs"], ["id", "ms"], ["cs", "sk"], ["nl", "af"], ["hi", "ur"]]);
export const sameFamily = (a, b) => a === b || FAMILIES.some((f) => f.includes(a) && f.includes(b));

const SPLIT_BRACKET = /\[[WS]\d+\]/g;

/** Letters only, code and URLs removed (a code block says nothing about the prose's language). */
export function proseOf(text) {
  return String(text ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(SPLIT_BRACKET, " ")
    .replace(/[*_#>|~]/g, " ");
}

/** The language the conversation has been in: the last confident language of the person's OWN earlier turns
 *  (`messages`: [{ role, content }], oldest first; or an array of strings). null when none was confident. A turn with
 *  no evidence of its own never sets it, so "chewier" cannot become the thread's language. */
export function threadLanguage(messages, { turns = DECLARED.threadTurns } = {}) {
  const texts = (messages || []).filter((m) => typeof m === "string" || (m && m.role === "user")).map((m) => (typeof m === "string" ? m : String(m.content || "")));
  for (let i = texts.length - 1, n = 0; i >= 0 && n < turns; i--, n++) {
    const d = identify(proseOf(texts[i]));
    if (d.confident) return d.lang;
  }
  return null;
}

/** The language of a text: { lang, script, hits, name, confident, inherited, margin }. lang is a language code
 *  ('es'), or 'unknown'. `prior` (a code, or { lang }) is the thread's language: a head start when the text has some
 *  evidence of its own, and the answer when it has none (`inherited: true`). Never throws. */
export function detectLang(text, { prior = null } = {}) {
  const priorLang = prior ? (typeof prior === "string" ? prior : prior.lang) : null;
  const d = identify(proseOf(text), { prior: priorLang && priorLang !== "unknown" ? { lang: priorLang } : null });
  if (d.confident) {
    // `hits`: units of evidence — function words of the winner, or the lead over the runner-up in margins (the old
    // detector's contract, which fold-chat-web.js reads as "at least 3 for a Latin-script edition choice")
    const hits = Number.isFinite(d.margin) ? Math.max(d.hits, Math.floor(d.margin / DECLARED.margin)) : Math.max(1, d.hits);
    return { lang: d.lang, script: d.script, hits, name: LANG_NAMES[d.lang] || null, confident: true, inherited: false, margin: d.margin };
  }
  if (priorLang && priorLang !== "unknown") return { lang: priorLang, script: d.script, hits: 0, name: LANG_NAMES[priorLang] || null, confident: true, inherited: true, margin: d.margin };
  return { lang: "unknown", script: d.script, hits: d.hits, name: null, confident: false, inherited: false, margin: d.margin };
}

/** Is `reply` in the same language as `question`? Only a CONFIDENT difference
 *  counts as a mismatch: unknown on either side, or a reply too short to judge,
 *  is treated as the same (nothing is restated on a coin-flip). Languages the
 *  detector cannot tell apart (FAMILIES) are one language. */
export function sameLanguage(question, reply, { prior = null } = {}) {
  const q = detectLang(question, { prior });
  if (!q.confident) return { same: true, question: q, reply: null, why: "the question's language is not confidently known" };
  const letters = (String(proseOf(reply)).match(/\p{L}/gu) || []).length;
  if (letters < DECLARED.minReplyLetters) return { same: true, question: q, reply: null, why: "the reply is too short to judge" };
  const r = detectLang(reply);
  if (!r.confident) {
    // A Latin-script reply that matched no language signature while the question
    // is NOT Latin script is still a mismatch (a script is evidence enough).
    if (r.script === "Latin" && q.script !== "Latin") return { same: false, question: q, reply: r, why: "the reply is in Latin script, the question is " + q.script };
    return { same: true, question: q, reply: r, why: "the reply's language is not confidently known" };
  }
  if (q.script !== r.script) return { same: false, question: q, reply: r, why: `question ${q.name}, reply ${r.name}` };
  const same = sameFamily(q.lang, r.lang);
  return { same, question: q, reply: r, why: same ? "" : `question ${q.name}, reply ${r.name}` };
}

/** The sentence that goes in the system prompt. Always asks for the asker's
 *  language; names it when the detector is confident (a named language moves a
 *  small model far more than the general rule does). */
export function languageInstruction(question, { prior = null } = {}) {
  const q = detectLang(question, { prior });
  const general = "Reply in the same language the person wrote in.";
  if (q.confident && q.lang !== "en") return `${general} The person wrote in ${q.name}: write your whole reply in ${q.name}, even when the sources you were given are in another language.`;
  return general;
}

/** The two messages that ask the model to restate ITS OWN draft in the asker's
 *  language. It is told to keep every figure and name and to add nothing. */
export function restateMessages(draft, langName) {
  return [
    { role: "system", content: `You translate text into ${langName}. Output ONLY the translation, in ${langName}. Keep every number, name, URL and line of code exactly as written. Do not add, remove, explain or comment.` },
    { role: "user", content: String(draft ?? "") },
  ];
}

/** The typed note for a reply that is still in the wrong language after a restate attempt. */
export function languageNotice(q, r, { restated = false } = {}) {
  return {
    kind: "language",
    text: `You wrote in ${q.name}, but the reply came back in ${r?.name || "another language"}${restated ? " even after the model was asked to restate it" : ""}. The words below are the model's; the fold did not translate them.`,
  };
}
