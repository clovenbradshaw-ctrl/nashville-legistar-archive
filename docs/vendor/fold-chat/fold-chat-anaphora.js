// fold-chat-anaphora.js — does this ask LEAN on the earlier turn? Pure: no DOM, no IO, no model, no clock.
//
// The bug (user, 2026-10-06: "the incorrect grounding carrying across messages"): after a turn about Mount McKinley the person asked "why is the sky
// blue" and the search went out as "William McKinley Blue Room why is the sky blue". Cause (eval/ants/G3-RESULTS.md): the pronoun gate in
// fold-chat-mind.js resolveQuestion read the ethos study's English `carryTriggers` prior, which contains "the" (and "one", "there"): any ask with an
// article and no capital letter "leaned on" the last answer. This module replaces the trigger test with one question asked of the ask itself:
//
//   Is the ask ANAPHORIC or ELLIPTICAL — does it point back, or leave out its own subject?
//
//   carry   a pronoun/demonstrative of the language's closed class points back ("what did she discover?", "make it vegan", "who built it?");
//           the ask has no content word of its own ("tell me more", "why?"); it opens with a connective and a fragment ("and in 1911?",
//           "what about Saturn?"); or it is a bare comparative ("something less sweet").
//   not     everything else: a complete predicate with its own subject ("why is the sky blue") NEVER inherits a referent, a query term or a passage.
//   undecided (no closed-class prior for the language) -> NOT carried, and the verdict says so (a typed gap, never a guess).
//
// CLOSED CLASSES: what is content and what is function comes from `functionWordsOf` (the khora's committed prior, fold-chat-snippets.js). The
// classes below (which function words POINT BACK; the request/question frames; the continuation words) are grammar facts of en/es/fr, DECLARED, not
// measured (Constitution II.11); giver: the author, 2026-10-07; every pronoun/connective listed is checked to be in the language's function words by
// the test. The numbers (an ask of more than 8 words names enough on its own for a WEAK pronoun) are the ones fold-chat-thread.js already declares
// from the ethos study. Nothing here reads a capital letter except to see whether the ask names an entity of its own (the same test the referent
// gate uses). A language with no declared class and no injected pronoun hints is undecided.
//
// Expletive and complementizer uses ("it takes", "it is true that", "what is it like") do not point back; a short closed list of those frames is
// declared below and its false-positive/negative side is measured on the HARD class in eval/ants/g3.

import { functionWordsOf } from "./fold-chat-snippets.js";
import { casedRuns, scriptOf } from "./fold-chat-mind.js";
import { detectLang } from "./fold-chat-lang.js";

export const ANAPHORA = Object.freeze({
  weakMaxTokens: 8,       // an ask longer than this names enough on its own for a weak pronoun (it/this/that…); same limit as THREAD.ellipticalMaxWords
  fragmentMaxTokens: 8,   // a no-content ask this short is a fragment ("tell me more"); longer is a sentence made of function words
  connectiveMaxContent: 3,// "and in 1911?", "and her husband?": a connective with at most this many content words after it
  connectiveMaxTokens: 6,
  comparativeMaxTokens: 6,// "something less sweet"
});

const set = (...xs) => new Set(xs.flatMap((x) => x.split(/\s+/)).filter(Boolean));

// Per language: `strong` points back whenever it appears (a personal pronoun names a being the ask does not name); `weak` points back only in a
// short ask with no entity of its own and not in an expletive/determiner/complementizer use; `connectives` open an elliptical ask; `wh` are the
// question words (a connective followed by one is a full clause); `frame` are request/question frames that carry no topic; `cont` are
// continuation words that carry no topic ("more", "else", "again"); `comparative` finds a bare comparative.
const CLASSES = Object.freeze({
  en: {
    strong: set("he she him his her hers himself herself"),
    weak: set("it its they them their theirs this that these those one ones itself themselves"),
    connectives: set("and but also so then plus"), connective2: new Set(["what about", "how about", "and what about", "and how about", "and then", "what of"]),
    wh: set("who whom whose which what when where why how"),
    frame: set("who whom whose which what when where why how tell show give explain describe say know find ask please pls thanks thank ok okay let lets go on wait hold hmm hm well really seriously honestly huh sure"),
    cont: set("more else further again another details detail elaborate continue same instead rest next"),
    comparative: /\b\p{L}{3,}ier\b|\b(?:bett|wors|cheap|easi|hard|fast|slow|bigg|small|larg|long|short|thick|thin|soft|crisp|sweet|spic|healthi|light|strong|smooth|rich|tough|tender|simpl|clear|brief)er\b|\b(?:more|less|a bit|a little|much|way|super|very)\s+\p{L}{3,}\b/iu,
    than: set("than or versus vs"),
    complementizerPrev: set("true think thought know knew say said sure believe mean means so claim claims fact proven show shows suppose hear heard sure"),
    expletive: [
      /\bit(?:'s| is| was| would be) (?:true|possible|safe|ok|okay|legal|illegal|normal|worth|necessary|important|good|bad|hard|easy|common|rude|polite|likely)\b/iu,
      /\bis it (?:true|possible|safe|ok|okay|legal|illegal|normal|worth|necessary|important|good|bad|hard|easy|common|rude|polite|likely)\b/iu,
      /\bit takes?\b|\bdoes it (?:take|cost|rain|snow|hurt)\b|\bit (?:rains?|snows?|hails?)\b|\bis it like\b|\bit(?:'s| is) like\b|\bwhat(?:'s| is) it like\b/iu,
    ],
  },
  es: {
    strong: set("él ella ellos ellas le les"),
    weak: set("esto eso aquello su sus suyo suya suyos suyas"),
    connectives: set("y pero también entonces además"), connective2: new Set(["qué tal", "y si", "y qué", "y entonces"]),
    wh: set("quién quiénes cuál cuáles cómo cuándo cuánto cuánta cuántos cuántas dónde por qué"),
    frame: set("quién quiénes cuál cuáles cómo cuándo cuánto cuánta cuántos cuántas dónde por qué dime cuéntame cuenta háblame habla explica explícame muéstrame dame sabes puedes"),
    cont: set("más otra otro otras otros detalles detalle continúa sigue adelante igual mismo"),
    comparative: /\b(?:más|menos)\s+\p{L}{3,}\b/iu,
    than: set("que o"),
    complementizerPrev: set(),
    expletive: [],
  },
  fr: {
    strong: set("il elle ils elles lui"),
    weak: set("son sa ses leur leurs cela ça ceci celui celle ceux celles"),
    connectives: set("et mais aussi alors donc"), connective2: new Set(["et si", "et puis", "et alors", "et que"]),
    wh: set("qui que quoi quel quelle quels quelles comment quand où combien pourquoi"),
    frame: set("qui que quoi quel quelle quels quelles comment quand où combien pourquoi dis dites parle raconte explique montre donne sais peux"),
    cont: set("plus encore autre autres détails détail suite davantage même"),
    comparative: /\b(?:plus|moins)\s+\p{L}{3,}\b/iu,
    than: set("que ou"),
    complementizerPrev: set(),
    expletive: [/\by a-t-il\b/iu, /\bil (?:y a|faut|est (?:vrai|possible|interdit|normal))\b/iu],
  },
});

/** The languages that have a declared class (a test checks every listed pronoun/connective is in functionWordsOf for it). */
export const LANGS = Object.freeze(Object.keys(CLASSES));
export const classesOf = (lang) => CLASSES[String(lang || "").toLowerCase().split("-")[0]] || null;

// word tokens, apostrophe- and hyphen-split ("qu'a-t-elle" -> qu a t elle); `inv` marks a token that follows a hyphen (a French inverted subject clitic), `el` an elided
// clitic before an apostrophe (qu', l', d', m': a function stub, never content)
function tokensOf(text) {
  const s = String(text ?? "").normalize("NFC").toLowerCase().replace(/[’‘]/g, "'");
  const out = [];
  const re = /[\p{L}\p{N}]+/gu; let m;
  while ((m = re.exec(s)) !== null) out.push({ t: m[0], inv: m.index > 0 && s[m.index - 1] === "-", el: s[m.index + m[0].length] === "'" });
  return out;
}

const verdict = (carry, kind, why, lang, decided = true) => ({ carry, kind, why, lang, decided });

/**
 * anaphoraOf(question, { lang, hints }) -> { carry, kind, why, lang, decided }
 *   kind  "pronoun" | "fragment" | "connective" | "comparative" | null
 *   why   one plain line for the process panel / the tests
 * `demonstrativeAsPronoun`: read "this/that/these/those" as a pronoun even before a content word. fold-chat-flow.js sets it for an ask that Terry's speech-act
 * reading already calls a MOVE about the conversation ("how do these fit together"): there the act is the evidence, and a noun after the demonstrative is
 * not what makes it a determiner. Default false: without that evidence "that book was long" is a determiner.
 * `lang`: the language code of the ask (fold-chat.js's lang0); absent or "unknown" it is read from the ask, and read-as-unknown is English (the same
 * default fold-chat.js uses for the hints). `hints`: the language priors (fold-chat-hints.js) — used ONLY for a language with no declared class
 * (Russian), where its listed forms are all pronouns.
 */
export function anaphoraOf(question, { lang = null, hints = null, demonstrativeAsPronoun = false } = {}) {
  const q = String(question ?? "").trim();
  if (!q) return verdict(false, null, "empty ask", lang || "en");
  let L = lang && lang !== "unknown" ? String(lang).toLowerCase().split("-")[0] : null;
  if (!L) { const d = detectLang(q); L = d.lang && d.lang !== "unknown" ? d.lang : "en"; }
  const cls = CLASSES[L] || null;
  const fw = functionWordsOf(L);
  const toks = tokensOf(q);
  if (!toks.length) return verdict(false, null, "no words", L);
  if (!cls) {
    // a language with no declared class: only its injected pronoun forms (hints), never an article; no prior at all = undecided
    const trig = new Set((hints?.carryTriggers || []).map((x) => String(x).toLowerCase()));
    if (!trig.size) return verdict(false, null, `undecided: no closed-class prior for ${L} — not carried`, L, false);
    const hit = toks.find((x) => trig.has(x.t));
    return hit ? verdict(true, "pronoun", `"${hit.t}" points back`, L) : verdict(false, null, "no pronoun of its own language's prior", L);
  }
  if (!fw) return verdict(false, null, `undecided: no function-word prior for ${L} — not carried`, L, false);
  const lower = q.toLowerCase().replace(/[’‘]/g, "'");
  const n = toks.length;
  // content = a number, or a word that is none of: function word, question/request frame, continuation word, connective, pronoun ("and in 1911" has one)
  const isContent = (x) => /^\d+$/.test(x.t) || (x.t.length > 1 && !x.el && !fw.has(x.t) && !cls.frame.has(x.t) && !cls.cont.has(x.t) && !cls.connectives.has(x.t) && !cls.strong.has(x.t) && !cls.weak.has(x.t));
  const content = toks.filter(isContent);
  const own = casedRuns(q, scriptOf(q)).length > 0;
  const expletive = cls.expletive.some((re) => re.test(lower));

  // (1) a STRONG pronoun points back. A French inverted subject clitic ("le ciel est-il bleu") repeats a subject the ask names: it points back only
  // when no content word comes before it.
  for (let i = 0; i < toks.length; i++) {
    const x = toks[i];
    if (!cls.strong.has(x.t)) continue;
    if (x.inv && toks.slice(0, i).some(isContent)) continue;
    if (expletive && x.inv) continue;
    return verdict(true, "pronoun", `"${x.t}" points back to a being the ask does not name`, L);
  }
  // (2) a WEAK pronoun/demonstrative points back in a short ask that names nothing of its own, outside an expletive / determiner / complementizer use
  if (n <= ANAPHORA.weakMaxTokens && !own) {
    for (let i = 0; i < toks.length; i++) {
      const x = toks[i];
      if (!cls.weak.has(x.t)) continue;
      if ((x.t === "it" || x.t === "its") && expletive) continue;
      const prev = toks[i - 1]?.t, next = toks[i + 1];
      if (["that", "this", "these", "those"].includes(x.t)) {
        if (prev && cls.complementizerPrev.has(prev)) continue;                       // "is it true that ..." — a complementizer
        if (!demonstrativeAsPronoun && next && isContent(next) && !(cls.comparative && cls.comparative.test(next.t))) continue;   // "that book", "this year" — a determiner, not a pronoun
      }
      if (x.t === "one" || x.t === "ones") { if (next && !["instead", "please", "too"].includes(next.t)) continue; }   // "a chewier one" yes; "one of the largest" no
      return verdict(true, "pronoun", `"${x.t}" points back (a short ask with no entity of its own)`, L);
    }
  }
  // (3) no content word of its own: "tell me more", "why?", "and then?", "really?"
  if (content.length === 0 && n <= ANAPHORA.fragmentMaxTokens) return verdict(true, "fragment", "no subject of its own: only function, frame and continuation words", L);
  // (4) a connective + a fragment: "and in 1911?", "what about Saturn?"; not when a question word opens a clause of its own ("and who painted the Mona Lisa")
  const first = toks[0]?.t, two = toks.length > 1 ? `${toks[0].t} ${toks[1].t}` : "";
  const twoThree = toks.length > 2 ? `${toks[0].t} ${toks[1].t} ${toks[2].t}` : "";
  const lead = cls.connective2.has(twoThree) ? 3 : cls.connective2.has(two) ? 2 : cls.connectives.has(first) ? 1 : 0;
  if (lead) {
    const rest = toks.slice(lead);
    const clause = rest.some((x) => cls.wh.has(x.t));
    if (!clause && content.length <= ANAPHORA.connectiveMaxContent && n <= ANAPHORA.connectiveMaxTokens) return verdict(true, "connective", `opens with "${toks.slice(0, lead).map((x) => x.t).join(" ")}" and a fragment`, L);
  }
  // (5) a bare comparative with nothing of its own: "something less sweet" (never a question word first, never a comparison "than/or" between two things)
  if (cls.comparative.test(lower) && n <= ANAPHORA.comparativeMaxTokens && !own && !cls.wh.has(first) && !toks.some((x) => cls.than.has(x.t))) return verdict(true, "comparative", "a bare comparative with no subject of its own", L);
  const own3 = content.slice(0, 3).map((x) => x.t).join(" ");
  return verdict(false, null, `self-contained: has its own subject (${own3 || "its own words"}) — nothing is carried`, L);
}

/** Does the ask continue the thread? A turn plan that already read it as a follow-up does; otherwise only the anaphora verdict says so (NOT a shared word:
 *  "blue" in "why is the sky blue" and "the Blue Room" is not a thread). */
export const continuesByAnaphora = (follow) => !!(follow && ((follow.kind && follow.kind !== "standalone") || follow.gate?.carry === true));
