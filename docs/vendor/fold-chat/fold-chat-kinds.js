// fold-chat-kinds.js — the SHAPES of the asks that need no web search and make no
// checkable factual claim (the shape detectors behind fold-chat-discourse.js
// `classifyTurn`). Pure: no DOM, no IO, no model.
//
//   compute    arithmetic / percent / a unit conversion — the answer is COMPUTED
//              (fold-chat-compute.js), the model only phrases it (II.9).
//   transform  translate / summarise / rewrite / proofread a text the person
//              handed over: the material IS their text. No search.
//   code       a programming how-to ("how do I reverse a string in Python"). No
//              search, a code card.
//   compose    a piece of personal correspondence ("write a thank-you note to my
//              neighbour"): the facts are the person's, nothing to look up.
//   advice     open how-to / opinion ("tips to fall asleep faster", "any advice
//              for my interview?"). SEARCH IS STILL ALLOWED; only the void block
//              stands down unless the answer commits to figures nothing read says.
//
// THE RULE THAT SHAPES EVERY DETECTOR: a false "skip the search" on a factual
// question is worse than a wasted search. So compute / transform / code /
// compose each need TWO independent signals (a verb or marker AND the material
// or a code term); for a NON-English ask the signals must be structural
// (a quoted span, a colon, digits and operators, a Latin code term) plus a
// declared per-language verb — never an English regex alone; and when unsure
// every detector returns false (the turn is searched).
//
// WHAT IS DECLARED vs MEASURED (Constitution II.11): every word list below is a
// DECLARED vocabulary (written by hand, per language, as shown); the numeric
// limits in DECLARED are declared defaults. None is a measured threshold.
// What WAS measured is the classifier's behaviour on the labelled examples in
// fold-chat-kinds.test.mjs and on the 25 everyday asks (see the report).

export const DECLARED = Object.freeze({
  // A summary needs at least this many characters of the person's own text, and prose (a sentence mark or this many words).
  minSummaryChars: 25,
  minSummaryWords: 12,
  // A rewrite / proofread needs at least this many characters after the colon.
  minRewriteChars: 10,
  // A translation needs at least this many characters (a single word is enough).
  minTranslateChars: 2,
  // "translate X into Spanish" with no quotes: X may be at most this many words.
  maxBareTranslateWords: 8,
});

const QUOTED = new RegExp(String.raw`[“„‟«「『]([^"”“»」』]{2,})[”“»」』]|(?:^|[\s:(\[,])"([^"]{2,})"(?=$|[\s.,;:?!)\]])|(?:^|[\s:(\[,])['‘‚]([^'’‘]{2,}?)['’](?=$|[\s.,;:?!)\]]|\s+(?:in|into|to|en|au|al|ins|auf|на|para|por)\b)`, "u");

/** The user's own text inside the message: a quoted span, or what follows a colon / newline. */
export function materialIn(question) {
  const q = String(question ?? "");
  const m = QUOTED.exec(q);
  if (m) return { kind: "quoted", text: (m[1] ?? m[2] ?? m[3] ?? "").trim() };
  const ci = q.search(/[:：]\s*(?=\S)/);
  if (ci > 0) { const after = q.slice(ci + 1).trim(); if (after) return { kind: "after-colon", text: after }; }
  const nl = q.indexOf("\n");
  if (nl > 0) { const after = q.slice(nl + 1).trim(); if (after) return { kind: "after-newline", text: after }; }
  return null;
}

// ── transform ──────────────────────────────────────────────────────────────
const LANG_WORDS = "english|spanish|french|german|portuguese|italian|dutch|russian|chinese|mandarin|cantonese|japanese|korean|arabic|hindi|turkish|polish|swedish|greek|hebrew|thai|vietnamese|latin|ukrainian|español|francés|inglés|alemán|français|anglais|espagnol|allemand|deutsch|englisch|spanisch|französisch|inglês|francês|espanhol|английский|испанский|французский|немецкий|英语|英文|中文|西班牙语|法语|德语|日语|日本語|英語|spanisch";
const ORD = "(?:please |pls |kindly )?(?:can you |could you |would you |will you )?(?:please )?";
const T_EN = {
  translate: new RegExp(String.raw`^${ORD}translate\b`, "i"),
  summarise: new RegExp(String.raw`^${ORD}(?:summari[sz]e|sum up|tl;?dr|give me (?:a |the )?(?:summary|tl;?dr) of|shorten|condense|abridge)\b`, "i"),
  rewrite: new RegExp(String.raw`^${ORD}(?:paraphrase|rephrase|reword|rewrite|proofread|copy-?edit|simplify|make (?:this|it|that)\b[\s\S]{0,12}\b(?:shorter|longer|simpler|clearer|formal|casual|polite|professional|friendlier|better)|(?:fix|correct) (?:the |my |this )?(?:grammar|spelling|typos?|punctuation))`, "i"),
};
// declared verbs, other languages (the verb alone never decides — material must be structural)
const T_OTHER = /^(?:¿)?(?:por favor,? )?(?:traduce|traducir|traduz|traduza|traduzir|resume|resumir|resuma|reescribe|parafrasea|reformula|reformule|corrige|traduis|traduire|résume|résumer|reformule|übersetze|übersetzen|fasse|fass|formuliere um|korrigiere|переведи|перевести|переведите|резюмируй|суммируй|перефразируй|кратко перескажи|翻译|翻譯|总结|總結|概括|改写|润色|請翻譯|请翻译|帮我翻译|翻訳|要約|言い換え|ترجم|لخص|अनुवाद|सारांश)/iu;

const T_CJK = /(?:翻译|翻譯|总结|總結|概括|改写|润色|翻訳|要約|言い換え|ترجم|لخص|अनुवाद)/u;

/** Is this a transform of the person's own text? Needs a transform verb AND the text itself.
 *  `hasMaterial`: the chat already carries an attachment / pasted document, so "summarise this" has something to act on.
 *  Returns { kind:'translate'|'summarise'|'rewrite'|'other', material } or null. */
export function transformShape(question, { hasMaterial = false } = {}) {
  const q = String(question ?? "").trim();
  if (!q) return null;
  const en = Object.entries(T_EN).find(([, re]) => re.test(q));
  // CJK / Arabic / Hindi verbs follow a particle ("把…翻译成英文", "请…翻译"): look for them OUTSIDE the quoted span
  const outside = q.replace(QUOTED, " ");
  const other = !en && (T_OTHER.test(q) || T_CJK.test(outside));
  if (!en && !other) return null;
  const kind = en ? (en[0] === "translate" ? "translate" : en[0] === "summarise" ? "summarise" : "rewrite") : "other";
  const mat = materialIn(q);
  const isTranslate = kind === "translate" || (kind === "other" && /^(?:¿)?(?:por favor,? )?(?:traduc|traduz|traduis|traduire|übersetz|перев)/iu.test(q) || /翻译|翻譯|翻訳|ترجم|अनुवाद/u.test(outside));
  const need = isTranslate ? DECLARED.minTranslateChars : kind === "rewrite" ? DECLARED.minRewriteChars : DECLARED.minSummaryChars;
  // a URL is not the person's text — the page behind it has to be READ (searched/fetched), not summarised from nothing
  const isUrl = mat && /^https?:\/\/\S+$/i.test(mat.text);
  // a SUMMARY needs prose to summarise: sentence punctuation, or a dozen words — "Summarize: causes of WW1" is a topic, not a text
  const prose = mat && (/[.!?。！？]/.test(mat.text) || mat.text.split(/\s+/).length >= DECLARED.minSummaryWords || /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{20,}/u.test(mat.text));
  const proseOk = isTranslate || kind === "rewrite" || prose;
  if (mat && !isUrl && mat.text.length >= need && proseOk) return { kind: isTranslate ? "translate" : kind, material: mat.text };
  // English only: "translate good morning into Spanish" — bare, short, with a named target language
  if (en && kind === "translate") {
    const bare = q.replace(T_EN.translate, "").trim().replace(/^(?:this|the (?:phrase|word|sentence|text)|these words)?\s*/i, "");
    const m = new RegExp(String.raw`^(.{1,80}?)\s+(?:in|into|to)\s+(?:${LANG_WORDS})(?:\s+and\s+(?:${LANG_WORDS}))*\??$`, "iu").exec(bare);
    const words = m ? m[1].trim().split(/\s+/) : [];
    // a capitalised word past the first (other than "I") is probably a named WORK or place, not a phrase to translate:
    // "translate the Declaration of Independence into French" needs the text fetched, so it is searched.
    const named = words.slice(1).some((w) => /^\p{Lu}/u.test(w) && w !== "I");
    const lone = words.length === 1 && /^\p{Lu}/u.test(words[0]);   // "translate Hamlet": a title, or a word? unsure → search
    if (m && words.length <= DECLARED.maxBareTranslateWords && !named && !lone) return { kind: "translate", material: m[1].trim() };
  }
  // an attachment / pasted document the chat already carries, named deictically ("summarise this", "summarise the document")
  if (en && hasMaterial && /\b(?:this|that|it|the (?:document|doc|file|attachment|text|paragraph|article|passage|pdf|above)|above)\b/i.test(q)) return { kind, material: null, attached: true };
  return null;
}

// ── code ───────────────────────────────────────────────────────────────────
// language / tooling names that are unambiguous tokens
const CODE_TERMS = /(?<![\p{Script=Latin}\p{N}_])(?:python|javascript|typescript|node\.?js|java|c\+\+|c#|golang|rust|ruby|php|swift|kotlin|sql|mysql|postgres(?:ql)?|sqlite|html|css|bash|zsh|powershell|regex|regexp|json|yaml|git|docker|kubernetes|react|vue|angular|django|flask|numpy|pandas|excel formula|vba|matlab|haskell|scala|perl|lua|dart|assembly|linux command|terminal command|shell script|npm|pip|api|css grid|flexbox|jquery|bootstrap|tailwind)(?![\p{Script=Latin}\p{N}_])/iu;
// words that are also ordinary English / names — count only with a code cue beside them
const AMBIG_TERMS = /(?<![\p{Script=Latin}\p{N}_])(?:go|swift|ruby|rust|java|dart|r|c|julia|scratch|processing)(?![\p{Script=Latin}\p{N}_])/iu;
const CODE_CUE = /\b(?:code|coding|program(?:ming)?|script|function|snippet|algorithm|compile[rd]?|syntax|variable|array|loop|class|method|library|framework|module|stack ?trace|exception|bug|debug|runtime|command line|cli|query|regex)\b/i;
const HOW_EN = /\b(?:how (?:do|can|could|would|should|to)\b|how'?s? (?:it )?possible|write (?:me )?(?:a|an|the|some)?\s*(?:[\w-]+\s+){0,3}(?:function|script|program|snippet|class|query|regex|macro|loop|algorithm|code|command|one-?liner|formula)|(?:example|snippet|sample|code) (?:of|for|to|that)|(?:fix|debug|why (?:does|is|won'?t|doesn'?t))\b[\s\S]{0,60}\b(?:error|bug|exception|crash|fail|not working|undefined|null)|convert (?:this )?(?:code|function))/i;
// declared "how do I / write a … / error" markers, other languages
const HOW_OTHER = /(?:^|[\s¿¡])(?:cómo|como|comment|wie|как|如何|怎么|怎樣|怎样|怎麼|写一个|寫一個|写个|どうやって|どのように|方法|escribe|écris|schreibe|напиши|代码|程序|código|codigo|funktion|fonction|функци[юя])(?=[\s,?？]|$|[\p{Script=Han}])/iu;
// factual / explanatory shapes about a language or tool — those are SEARCHED
const CODE_FACTUAL = /\b(?:who (?:created|invented|made|wrote|founded|owns)|when (?:was|did|were)|history of|released|latest version|current version|how popular|market share|salary|salaries|jobs?|ranking|best (?:language|framework|ide|editor)|vs\.?|versus|difference between|compare|comparison|worth learning|should i learn|which (?:is|one)|what is the (?:latest|newest|current))\b|(?:cuándo|quién (?:creó|inventó)|wer hat|qui a (?:créé|inventé)|кто (?:создал|изобрёл)|谁(?:发明|创建|创造))/iu;

/** Is this a programming how-to? (A code fence in the message is enough on its own.) */
export function codeShape(question) {
  const q = String(question ?? "");
  if (!q.trim()) return false;
  if (/```[\s\S]*```/.test(q) && q.replace(/```[\s\S]*?```/g, "").trim().length < 400) return true;
  if (CODE_FACTUAL.test(q)) return false;
  const term = CODE_TERMS.test(q) || (AMBIG_TERMS.test(q) && CODE_CUE.test(q));
  const cue = CODE_CUE.test(q);
  if (!term && !(cue && /\b(?:in|using|with)\s+(?:a|an|the)?\s*(?:code|script|program|function)\b/i.test(q))) return false;
  if (HOW_EN.test(q)) return true;
  // non-English: a Latin code term beside a declared how-marker
  if (HOW_OTHER.test(q) && term) return true;
  return false;
}

// ── compose ────────────────────────────────────────────────────────────────
const COMPOSE_VERB = /^(?:please |pls )?(?:can you |could you |would you |help me )?(?:please )?(?:write|compose|draft|create|make|give me|i need|i want|i'?d like)\b/i;
const COMPOSE_NOUN = /\b(?:note|message|card|e-?mail|text(?: message)?|letter|toast|speech|wish(?:es)?|caption|invitation|invite|reply|response|apology|thank[- ]?you|thanks|greeting|reminder|bio|introduction|intro|resignation|testimonial|recommendation letter|eulogy|vows)\b/i;
const PERSONAL = /\b(?:my|our|me|myself|mom|mum|dad|mother|father|wife|husband|partner|girlfriend|boyfriend|friend|neighbou?r|boss|manager|coworker|co-worker|colleague|teacher|professor|landlord|landlady|customer|client|team|sister|brother|grandma|grandpa|grandmother|grandfather|aunt|uncle|cousin|son|daughter|roommate|classmate|mentor|doctor|nurse|babysitter|host|hostess)\b/i;
// A research cue inside a compose-shaped ask means it needs facts ("a note about the history of …").
const COMPOSE_FACTS = /\b(?:history of|facts? about|statistics|study|studies|research|cite|sources?|according to)\b/i;

/** Personal correspondence: the person's own facts, nothing to look up. */
export function composeShape(question) {
  const q = String(question ?? "").trim();
  if (!q || q.length > 400) return false;
  return COMPOSE_VERB.test(q) && COMPOSE_NOUN.test(q) && PERSONAL.test(q) && !COMPOSE_FACTS.test(q);
}

// ── advice ─────────────────────────────────────────────────────────────────
const ADVICE_EN = /\b(?:tips?|advice|suggestions?|recommendations?|ideas|strategies|itinerary|checklist|ways to|steps to|best way to|how (?:can|do|should|could|would) (?:i|we)\b|how to\b|should i\b|what should i\b|any (?:advice|tips|suggestions|ideas)|help me (?:to |with |decide|plan|choose|prepare|figure)|what do you (?:think|recommend)|would you recommend|i'?m (?:nervous|worried|anxious|stuck|struggling|confused)|(?:\d+|a|one|two|three|four|five|seven)[- ]day (?:itinerary|plan|trip))/i;
const ADVICE_OTHER = /(?:consejos|recomendaciones|sugerencias|cómo puedo|cómo debo|qué debo|qué debería|conseils|comment puis-je|comment faire pour|que dois-je|que faire|tipps|ratschläge|empfehlungen|wie kann ich|was soll ich|wie soll ich|dicas|conselhos|como posso|devo|советы|совет|посоветуй|как мне|что мне делать|建议|建議|怎么办|怎麼辦|如何才能|怎样才能|有什么办法|アドバイス|コツ|どうすれば|نصائح|सलाह)/iu;

/** Open how-to / opinion. Cheap to get wrong: advice is still searched, only its void stands down. */
export function adviceShape(question) {
  const q = String(question ?? "");
  return ADVICE_EN.test(q) || ADVICE_OTHER.test(q);
}

// ── what each kind does ────────────────────────────────────────────────────
/** Kinds that run NO web search. */
export function skipsSearch(kind) {
  return kind === "smalltalk" || kind === "self" || kind === "compute" || kind === "transform" || kind === "code" || kind === "compose";
}

/** The label a no-claims turn wears where a gap would be ("nothing to check here"). */
export function noClaimsLabel(kind) {
  return ({
    generate: "creative — no claims checked",
    compose: "your own words and facts — nothing to look up, no claims checked",
    compute: "computed by the fold's evaluator — the model only worded it",
    transform: "a transformation of your own text — no outside claims checked",
    code: "a programming answer — no web claims checked",
  })[kind] || null;
}

/** The one-line instruction each of these kinds adds to the system prompt. */
export const KIND_PROMPT = Object.freeze({
  transform: "The person handed you their own text and asked you to transform it (translate, summarise, rewrite). Do exactly that to THEIR text. Use only their text; add no facts, names or figures that are not in it.",
  code: "The person asked a programming question. Answer with one or two sentences and a fenced code block in the right language. Do not invent a library, function or flag; if you are unsure an API exists, say so.",
  compose: "The person asked you to write something personal. Write it now, in full, using only the details they gave. Where a detail you would need is missing (a name, a date), leave a clear [placeholder] — never invent one. Do not ask questions and do not offer to help later.",
  advice: "The person asked for practical guidance. Give clear, balanced, concrete advice. State a specific figure, date, price or named study ONLY if the sources you were given say it; otherwise keep to general guidance and say it is general.",
});
