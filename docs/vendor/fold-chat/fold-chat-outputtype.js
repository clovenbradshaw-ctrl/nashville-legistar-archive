// fold-chat-outputtype.js — what OUTPUT does this turn ask for? Pure: no DOM, no IO, no model (a model may only PICK from a closed list,
// and only through `pickType`, which checks the pick).
//
// The failure this exists for (user, 2026-10-06): after "who invented the telephone?" the person typed "write me an essay on this".
// The app searched the INSTRUCTION ("write essay invented telephone" — essay-writing tutorials came back) and, when the model failed,
// showed a tutorial paragraph as "from the sources". The turn was read as a lookup; nobody had said what kind of thing was wanted,
// about WHAT, or what would stop it.
//
//   describeOutput(turn, { prior, hasMaterial })  →  {
//     type          essay | poem | story | email | letter | speech | summary | outline | table | list | code | translation |
//                   rewrite | script | slogan | other | none      (`rewrite` is an addition to the brief's list: a proofread / "make this
//                   shorter" is a different void from a translation and from a summary)
//     form          the noun the person used ("haiku", "blog post", "tagline") — the type is the family, the form is the word
//     typed         true (a noun named it) | false (default: "write about X") | "model-pick" (see pickType)
//     topic         what it is ABOUT, resolved through the thread ("this", "it", "the above" → the telephone); null if none
//     topicVia      "literal" | "thread-request" | "thread-ask" | "material" | null
//     constraints   { length, tone, audience, language, count, format }  — only the ones the person gave
//     needsSources  does an output of this type, on this topic, ground in sources?
//     searchQuery   the TOPIC to research (never the instruction); null when nothing should be searched
//     material      null | "inline" | "attached" | "thread-answer" | "previous-step"  — the person's own text the output works on
//     voidIfMissing [{ gap, active, … }]  the typed gaps that stop the output: no-topic, no-material, unsupported-type,
//                   unsupported-format (active now, known from the text) and nothing-found (active: null — known only after the search;
//                   `voidsAfterSearch` resolves it)
//     steps, sequence   a compound ask ("summarize this then write a tweet"): each step described; `sequence` "then" (the type is the
//                   LAST step's) or "and" (the type is the first's)
//     wants         type !== "none"
//   }
//
// THE GATES (each is one rule, each has a test that fails without it — see fold-chat-outputtype.test.mjs):
//   G1 question-frame   a wh-word / auxiliary BEFORE the verb makes it a question about writing ("how do I write an essay", "who wrote the poem")
//   G2 between-words    a pronoun or "sure/that/to…" between the verb and the noun is not an object ("make sure you note that…")
//   G3 particle         "write down / off / back / to …" is not a request for a piece
//   G4 existing-work    a RETRIEVAL lead ("give me", "i need") + "the" + a noun + a Title is a lookup of a work that exists
//   G5 code-first       a programming ask is code before it is anything else (fold-chat-kinds.js codeShape — one definition of code)
//   G6 deictic-resolution  a topic that is "this/it/that/the above" is resolved through the thread or is a typed gap, never searched
//   G7 closed-pick      a model may only choose from the closed list, twice, in two orders, and the pick must fit the evidence
//
// DECLARED, NOT MEASURED (Constitution II.11): every word list below is a hand-written vocabulary (giver: the author of this file, per
// language: en, es, fr, ru, de, plus three zh patterns). What WAS measured is behaviour on eval/ants/g1/corpus.mjs (see eval/ants/G1-RESULTS.md).
// A language with no entries is simply never read as a request (a typed gap, not a guess).

import { codeShape, transformShape, materialIn } from "./fold-chat-kinds.js";
import { isMeta, isNudge, isElliptical } from "./fold-chat-thread.js";
import { isSourceAsk } from "./fold-chat-sourceask.js";

export const TYPES = Object.freeze(["essay", "poem", "story", "email", "letter", "speech", "summary", "outline", "table", "list", "code", "translation", "rewrite", "script", "slogan", "other", "none"]);
const PRODUCING = TYPES.filter((t) => t !== "none");

// ── text helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Lowercase, accents struck (NFD, marks removed): "révolution" → "revolution". Cyrillic й → и is applied the same on both sides. */
export const fold = (s) => String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’‘`]/g, "'");
const WORD = /[\p{L}\p{N}]+(?:['\-][\p{L}\p{N}]+)*/gu;
const wordsOf = (s) => [...String(s).matchAll(WORD)].map((m) => ({ w: m[0], f: fold(m[0]), at: m.index, end: m.index + m[0].length }));
const one = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// ── vocabulary (declared) ──────────────────────────────────────────────────────────────────────────────────────────────
// noun → [type, form]. Multi-word forms are listed with spaces and matched longest first.
const N = (type, words) => words.split("|").map((w) => [w.trim(), type]);
const NOUNS = new Map([
  ...N("essay", "biography|profile|obituary|product description|description|bio|brief|essay|essays|article|articles|report|reports|paragraph|paragraphs|composition|paper|research paper|term paper|write-up|writeup|analysis|review|memo|op-ed|column|thesis|study guide|guide|comparison|piece|blog|blog post|blogpost|post|ensayo|articulo|informe|parrafo|redaccion|essai|rapport|paragraphe|эссе|сочинение|статью|статья|реферат|доклад|отчет|отчёт|абзац|aufsatz|artikel|bericht|absatz|essays"),
  ...N("poem", "villanelle|lullaby|nursery rhyme|epic|free verse|poem|poems|poetry|haiku|haikus|limerick|limericks|sonnet|sonnets|ode|ballad|verse|verses|rhyme|rap|lyrics|song lyrics|song|songs|poema|poesia|cancion|letra|poeme|chanson|paroles|стихотворение|стих|стихи|поэму|поэма|песню|песня|gedicht|lied|haikus"),
  ...N("story", "story|stories|tale|fable|fairytale|fairy tale|short story|narrative|anecdote|cuento|relato|conte|recit|рассказ|сказку|сказка|geschichte|bedtime story"),
  ...N("email", "email|emails|e-mail|mail|message|text message|correo|mensaje|courriel|сообщение|электронное письмо|nachricht"),
  ...N("letter", "reminder|заявление|letter|cover letter|note|thank you note|thank-you note|card|birthday card|resignation letter|love letter|carta|lettre|lettre de motivation|письмо|письма|lettres"),
  ...N("speech", "thank you speech|speech|toast|eulogy|address|best man speech|vows|discurso|brindis|discours|речь|тост|rede"),
  ...N("summary", "краткое содержание|main points|key points|main ideas|takeaways|gist|highlights|summary|recap|tl;dr|tldr|resumen|resume|zusammenfassung|краткое содержание|пересказ|synopsis"),
  ...N("outline", "outline|agenda|table of contents|talking points|esquema|plan de|plan|schema|план"),
  ...N("table", "table|tabla|tableau|таблицу|таблица|tabelle"),
  ...N("list", "reasons|ideas|names|suggestions|examples|ways|tips|questions|quotes|facts|options|titles|points|list|lists|checklist|to-do list|todo list|packing list|grocery list|shopping list|lista|liste|список"),
  ...N("code", "function|script|program|query|sql query|regex|snippet|code|macro|algorithm|class|landing page|web page|webpage|website|html page|app|bash script|one-liner|formula|sql"),
  ...N("script", "dialogue|dialog|screenplay|scene|sketch|skit|monologue|movie script|play|dialogo|guion|dialogue|диалог|сценарий|szene"),
  ...N("slogan", "slogan|slogans|tagline|taglines|tweet|tweets|caption|captions|headline|headlines|motto|jingle|catchphrase|ad copy|eslogan|lema|слоган|подпись"),
  ...N("other", "recipe|recipes|joke|jokes|riddle|riddles|pun|puns|knock-knock joke|chiste|adivinanza|blague|devinette|шутку|анекдот|загадку|witz|something|anything|thing|picture|image|drawing|logo|photo|painting|illustration|video|animation|audio|podcast|pdf|powerpoint|slideshow|spreadsheet|map|poster|flyer|infographic"),
]);
const MULTI = [...NOUNS.keys()].filter((k) => k.includes(" ")).sort((a, b) => b.length - a.length);
const NOUN_WORDS = [...NOUNS.keys()].filter((k) => !k.includes(" "));
// what the fold cannot produce (declared). A noun in this set → unsupported-type; a format word on a supported type → unsupported-format.
const UNSUPPORTED_FORMS = new Set(["picture", "image", "drawing", "logo", "photo", "painting", "illustration", "video", "animation", "audio", "podcast", "pdf", "powerpoint", "slideshow", "spreadsheet", "map", "poster", "flyer", "infographic"]);
const COUNT_NOUNS = new Set(["reasons", "ideas", "names", "suggestions", "examples", "ways", "tips", "questions", "quotes", "facts", "options", "titles", "points"]);   // a list only when counted: "five reasons", never bare "ways"
const VISUAL_LEADS = new Set(["draw", "paint", "illustrate", "animate", "film", "dibuja", "pinta", "dessine", "нарисуй"]);
const UNSUPPORTED_FORMATS = /\b(?:pdf|docx|word (?:document|file)|powerpoint|pptx|xlsx|excel (?:file|sheet)|mp3)\b/i;

// leads. class "make": the verb names the act of producing; "want": a retrieval-shaped lead (needs a noun right beside it).
const MAKE_LEADS = ["draw", "paint", "illustrate", "animate", "film", "dibuja", "pinta", "dessine", "нарисуй", "write", "compose", "draft", "create", "generate", "produce", "craft", "prepare", "pen", "make", "build", "come up with", "put together", "whip up", "give me", "gimme", "get me", "tell me", "do me", "knock out", "turn", "convert",
  "escribe", "escribeme", "escribir", "redacta", "redactame", "compon", "componme", "haz", "hazme", "crea", "creame", "genera", "generame", "elabora", "prepara", "preparame", "cuentame",
  "ecris", "ecris-moi", "ecrire", "ecrivez", "redige", "redigez", "compose", "cree", "fais", "fais-moi", "genere", "raconte-moi", "donne-moi",
  "напиши", "напишите", "написать", "составь", "сочини", "придумай", "создай", "сделай", "сгенерируй", "подготовь", "расскажи",
  "schreibe", "schreib", "verfasse", "erstelle", "mach", "mache", "gib mir", "escribirme", "escribenos", "escribeme", "schreiben", "verfassen", "erstellen", "escribas", "escriba", "redactes", "redacte", "compongas", "crees", "hagas"];
const VERB_FINAL = new Set(["schreiben", "verfassen", "erstellen"]);   // German: the infinitive closes the clause ("ein Gedicht über den Herbst schreiben")
const STRONG_MAKE = new Set(["schreiben", "verfassen", "erstellen", "escribirme", "escribenos","write", "compose", "draft", "create", "generate", "produce", "craft", "escribe", "escribeme", "escribir", "redacta", "redactame", "ecris", "ecris-moi", "ecrire", "ecrivez", "redige", "redigez", "напиши", "напишите", "написать", "schreibe", "schreib", "verfasse", "erstelle"]);
const GIVE_LEADS = new Set(["give me", "gimme", "get me", "tell me", "do me", "dame", "donne-moi", "gib mir", "дай", "cuentame", "raconte-moi", "расскажи"]);   // retrieval-shaped ("give me the poem Howl")
const WANT_LEADS = ["j'aimerais", "je souhaite", "quisiera", "me encantaria", "gostaria", "i need", "i want", "i'd like", "i would like", "can i get", "could i get", "could i have", "i'm after", "i am looking for", "i'm looking for", "necesito", "quiero", "me gustaria", "dame", "j'ai besoin", "je voudrais", "je veux", "мне нужен", "мне нужна", "мне нужно", "хочу", "дай", "ich brauche", "ich mochte"];
const TRANSFORM_LEADS = new Map(Object.entries({
  summarize: "summary", summarise: "summary", "tl;dr": "summary", tldr: "summary", resumelo: "summary", traducelo: "translation", traducela: "translation", traducelos: "translation", ubersetz: "translation", "sum up": "summary", condense: "summary", abridge: "summary", resume: "summary", resumir: "summary", resuma: "summary", resumer: "summary", "resumez": "summary", "резюмируй": "summary", суммируй: "summary", "fasse zusammen": "summary",
  translate: "translation", traduce: "translation", traducir: "translation", traduis: "translation", traduire: "translation", переведи: "translation", перевести: "translation", ubersetze: "translation", ubersetzen: "translation",
  rewrite: "rewrite", rephrase: "rewrite", paraphrase: "rewrite", reword: "rewrite", proofread: "rewrite", polish: "rewrite", edit: "rewrite", simplify: "rewrite", shorten: "rewrite", expand: "rewrite", improve: "rewrite", reescribe: "rewrite", parafrasea: "rewrite", corrige: "rewrite", reformule: "rewrite", перефразируй: "rewrite", сократи: "rewrite", korrigiere: "rewrite",
  outline: "outline", list: "list", tabulate: "table",
}));
const LEAD_SPECS = [
  ...MAKE_LEADS.map((v) => ({ v, cls: GIVE_LEADS.has(v) ? "give" : "make" })),
  ...WANT_LEADS.map((v) => ({ v, cls: "want" })),
  ...[...TRANSFORM_LEADS.keys()].map((v) => ({ v, cls: "transform" })),
].sort((a, b) => b.v.length - a.v.length);
const LEAD_RE = new RegExp(String.raw`(?<![\p{L}\p{N}])(${LEAD_SPECS.map((s) => s.v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\p{L}\p{N}])`, "gu");
const LEAD_CLS = new Map(LEAD_SPECS.map((s) => [s.v, s.cls]));
// G1: words that, standing BEFORE the verb, make the sentence a question about the act
const QUESTION_FRAME = new Set(["what", "whats", "what's", "who", "whos", "who's", "whom", "whose", "when", "where", "why", "how", "which", "is", "are", "was", "were", "did", "do", "does", "has", "have", "had", "if", "whether",
  "quien", "cuando", "donde", "cual", "qui", "quoi", "quand", "ou", "comment", "pourquoi", "est-ce", "кто", "что", "когда", "где", "почему", "как", "wer", "was", "wann", "wo", "warum", "wie", "ist", "should", "shall", "must", "ought", "might", "may", "cannot", "can't", "cant", "don't", "dont", "won't", "didn't", "couldn't", "wouldn't", "never", "not", "no", "doesn't", "isn't"].map(fold));
// G2: words that cannot sit between a verb and its object noun
// G1b: a REPORTED request ("she asked me to write her a letter") is somebody else's ask
const REPORTING = new Set(["told", "asked", "tells", "asks", "said", "says", "ordered", "requires", "required", "expects", "expected", "suggested", "advised", "mentioned"]);
const DECLARATIVE = /(?<![\p{L}])(?:i|we|he|she|they)(?:'ll|'d| will| would| shall| am going to| was going to| can| could| did| might)(?![\p{L}])/u;
const WANTING = /(?:would|'d) (?:like|love|appreciate|prefer)|(?<![\p{L}])(?:want|wants|need|needs|please|pls|help|ask|asking)(?![\p{L}])/u;
const NOT_BETWEEN = new Set(["you", "i", "we", "they", "he", "she", "sure", "which", "who", "to", "not", "if", "whether", "because", "so", "but", "when", "while", "tu", "yo", "ты", "я", "du", "ich"].map(fold));
// G3: "write down", "write off" …
const PARTICLES = new Set(["down", "off", "back", "in", "out", "with", "at", "of", "into"]);
const TOPIC_PREP = new Set(["on", "about", "regarding", "concerning", "covering", "exploring", "discussing", "describing", "explaining", "sobre", "acerca", "sur", "propos", "sujet", "о", "об", "обо", "про", "тему", "uber", "thema"].map(fold));
const OF_PREP = new Set(["of", "de", "du", "des", "d'", "von", "del"]);   // only after summary / outline / table / list nouns
const OF_TYPES = new Set(["summary", "outline", "table", "list"]);
const DET = new Set(["a", "an", "the", "some", "another", "one", "me", "us", "my", "your", "un", "una", "unos", "unas", "une", "des", "el", "la", "le", "les", "los", "las", "eine", "einen", "ein", "der", "die", "das", "short", "long", "brief", "quick", "funny", "good", "great", "nice", "formal", "new", "little", "small", "big", "detailed", "simple", "persuasive", "professional", "краткое", "краткий", "короткое", "короткий", "небольшое", "небольшую", "коротку"].map(fold));
const DEICTIC = /^(?:this|that|it|these|those|them|the above|above|the same(?: thing| topic)?|same|this one|that one|the previous(?: one| answer| topic)?|previous|the last(?: one| answer| topic)?|what (?:we|you)(?: just)? (?:said|discussed|wrote|talked about)|what was just said|esto|eso|ello|lo anterior|lo de arriba|ca|cela|ce qui precede|ci-dessus|le meme|это|этого|этом|об этом|то же|выше|вышесказанное|dies|das|diesem|obiges|oben|(?:this|that) (?:topic|subject|question|thing|answer|stuff)|(?:este|ese|ce|cet) (?:tema|asunto|sujet)|(?:the|this|that|my|these|those) (?:article|document|doc|text|paper|file|attachment|pdf|passage|email|chapter|page|report|essay|paragraph|post)s?)$/iu;
const RECIPIENT_PERSONAL = /(?<![\p{L}])(?:(?:to|for|an|a|à)\s+(?:(?:my|our|mi|mon|ma|meinen|meinem|meiner|the|his|her|their)\s+)?(?:boss|manager|team|coworkers?|co-workers?|colleagues?|landlord|landlady|neighbou?r|teacher|professor|mom|mum|dad|mother|father|wife|husband|partner|friend|girlfriend|boyfriend|sister|brother|client|customers?|staff|roommate|doctor|class|vermieter|chef|jefe|patron)|начальнику|шефу|боссу|учителю|маме|папе|другу|соседу|хозяину|коллеге|директору|врачу)(?![\p{L}])/iu;
const PERSONAL = /(?:^|[^\p{L}])(?:my|our|me|myself|mi|mis|mon|ma|mes|мой|моя|моё|мои|мою|моей|mein|meine|meinen|meinem|meiner)(?![\p{L}])/iu;
// who a letter is addressed to decides whether its facts are the person's own (a landlord, a boss) or public (an advocacy letter to an official)
const PERSONAL_RECIPIENT = RECIPIENT_PERSONAL;
const REQUESTY = /\b(?:asking|requesting|pidiendo|solicitando|demandant|bitte|wegen)\b|просьбой|заявлен/iu;   // a request is the person's own business
const PUBLIC_RECIPIENT = /\b(?:congress(?:man|woman|person)?|senator|representative|mayor|editor|governor|president|council(?:lor)?|school board|mp|minister|newspaper|legislator|assembly(?:man|woman))\b/i;
// forms that are the person's own by their nature (a cover letter is about THEM) — unless the ask itself wants facts
const GIVEN_FORMS = new Set(["product description", "bio"]);   // the text describes a thing the person already has: nothing to look up
const PERSONAL_FORMS = new Set(["cover letter", "resignation letter", "love letter", "thank you note", "thank-you note", "card", "birthday card", "note", "vows", "lettre de motivation", "заявление"]);
const WANTS_FACTS = /\b(?:history of|facts? about|statistics|study|studies|research|cite|sources?|according to)\b/i;
const CREATIVE_LIST = /\b(?:ideas?|names?|suggestions?|ways|reasons?|tips?|pros|cons|gift|gifts|jokes?|puns?|to-?do|packing|grocery|shopping|baby|titles?|questions?)\b/i;   // a list that is invented, not looked up

// ── constraints (declared patterns) ────────────────────────────────────────────────────────────────────────────────────
const NUMW = { one: 1, a: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, uno: 1, dos: 2, tres: 3, cinco: 5, un: 1, deux: 2, trois: 3, cinq: 5, один: 1, два: 2, три: 3, пять: 5 };
const NUM = String.raw`(\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a dozen)`;
const numOf = (s) => { const t = fold(s).replace(/,/g, ""); return /^\d+$/.test(t) ? Number(t) : NUMW[t.replace(/^a /, "")] ?? null; };
const UNITS = { words: "words", word: "words", palabras: "words", mots: "words", sentences: "sentences", sentence: "sentences", frases: "sentences", phrases: "sentences", paragraphs: "paragraphs", paragraph: "paragraphs", parrafos: "paragraphs", paragraphes: "paragraphs", pages: "pages", page: "pages", lines: "lines", line: "lines", characters: "characters", character: "characters", minutes: "minutes", minute: "minutes" };
const LENGTH_RE = new RegExp(String.raw`(?<![\p{L}\p{N}])${NUM}[\s-]*(words?|sentences?|paragraphs?|pages?|lines?|characters?|minutes?|palabras|frases|parrafos|párrafos|mots|phrases|paragraphes)(?![\p{L}])`, "iu");
const LENGTH_LABEL_RE = /\b(short|brief|long|detailed|concise|quick|lengthy|in[- ]depth|one-liner|tweet-length)\b/i;
const TONES = "formal|informal|casual|funny|humorous|humourous|serious|persuasive|friendly|professional|sarcastic|dramatic|poetic|romantic|sad|angry|polite|playful|inspiring|inspirational|academic|witty|cheerful|gloomy|dark|whimsical|upbeat|divertido|serio|persuasivo|amistoso|formel|drole|serieux|amical|смешной|серьезный|формальный|дружеский";
const TONE_RE = new RegExp(String.raw`(?<![\p{L}])(${TONES})(?![\p{L}])`, "iu");
const AUDIENCE_RE = /\bfor (?:a |an |my |our |the |some )?((?:\d+(?:st|nd|rd|th)[ -]graders?|kids|children|child|beginners|experts|students|teachers?|class|(?:[a-z]+ )?(?:assembly|audience|class|classroom)|adults|teens|teenagers|toddlers|seniors|professionals|managers?|executives|investors|customers|readers|everyone|laypeople|non-experts|\d+[- ]year[- ]olds?))\b/i;
const LANGS = { english: "english", spanish: "spanish", french: "french", german: "german", italian: "italian", portuguese: "portuguese", russian: "russian", chinese: "chinese", japanese: "japanese", espanol: "spanish", francais: "french", ingles: "english", deutsch: "german", frances: "french", aleman: "german", английский: "english", французский: "french", испанский: "spanish", немецкий: "german", русский: "russian", francese: "french" };
const LANG_RE = new RegExp(String.raw`(?<![\p{L}])(?:in|into|to|auf|en|au|al|ins|на|по-|po-)\s*(${Object.keys(LANGS).join("|")})(?![\p{L}])`, "iu");
const COUNT_RE = new RegExp(String.raw`(?<![\p{L}\p{N}])${NUM}\s+(?:(?:[\p{L}-]+)\s+){0,2}?(poems?|haikus?|slogans?|taglines?|names?|ideas?|jokes?|riddles?|tweets?|captions?|stories|options?|versions?|examples?|reasons?|causes?|ways?|tips?|questions?|variations?|limericks?|sonnets?|emails?|titles?|headlines?|items?|bullet points?|points?)(?![\p{L}])`, "iu");

/** The constraints the person gave, and the spans of the text they occupy (so the topic can be cut clean of them). */
export function constraintsOf(text) {
  const t = String(text ?? ""), f = fold(t), c = {}, spans = [];
  const mark = (m) => spans.push([m.index, m.index + m[0].length]);
  let m;
  if ((m = LENGTH_RE.exec(t))) { const n = numOf(m[1]); const u = UNITS[fold(m[2])] || UNITS[m[2].toLowerCase()]; if (n != null && u) { c.length = { n, unit: u }; mark(m); } }
  if (!c.length && (m = /\b(?:in|within)\s+(?:one|a)\s+(sentence|paragraph)\b/i.exec(t))) { c.length = { n: 1, unit: m[1].toLowerCase() + "s" }; mark(m); }
  if (!c.length && (m = LENGTH_LABEL_RE.exec(t))) { c.length = { label: m[1].toLowerCase() }; }
  if ((m = TONE_RE.exec(t))) { c.tone = fold(m[1]).replace("humourous", "humorous"); }
  if ((m = AUDIENCE_RE.exec(t))) { c.audience = m[1].toLowerCase(); mark(m); }
  if ((m = LANG_RE.exec(f))) { c.language = LANGS[m[1]] || m[1]; }
  if ((m = COUNT_RE.exec(t))) { const n = numOf(m[1]); if (n != null && !(c.length && c.length.n === n && c.length.unit)) c.count = n; }
  if ((m = /\b(pdf|docx|word (?:document|file)|powerpoint|pptx|xlsx|excel(?: file| sheet)?|csv|markdown|bullet points?|bulleted|numbered|html|json)\b/i.exec(t))) c.format = m[1].toLowerCase();
  return { c, spans };
}

// ── typo tolerance (one edit, never the first letter, never a suffix, never a real near-word) ─────────────────────────
const NEAR_REAL = new Set(["wrote", "white", "writs", "drift", "graft", "crate", "wrist", "better", "poet", "post", "paper", "pager", "repost", "summery", "tablet", "listed", "mail", "male", "mall", "pen", "pun", "rap", "rep", "tale", "tile", "tall", "code", "mode", "coda", "cove", "app", "apt", "ape", "act", "thing", "think", "thong", "plan", "plant", "plane", "plans", "pans", "play", "clay", "prey", "card", "cart", "care", "cord", "yard", "verse", "versa", "terse", "ode", "one", "ore"]);
function edit1(a, b) {   // is a within one Damerau edit of b, with the edit not touching the first or last character of b?
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || a[0] !== b[0]) return false;
  if (a.length === b.length) {
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    if (i === a.length) return true;
    if (i >= b.length - 1) return false;                                         // the last character is never edited (suffix-safe)
    if (a[i + 1] === b[i] && a[i] === b[i + 1] && a.slice(i + 2) === b.slice(i + 2)) return true;   // transposition
    return a.slice(i + 1) === b.slice(i + 1);                                    // substitution
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  let i = 0; while (i < s.length && s[i] === l[i]) i++;
  if (i >= l.length - 1) return false;                                           // an added / dropped suffix letter is a different word (writes, composed)
  return s.slice(i) === l.slice(i + 1);
}
const nearIn = (word, list) => {
  if (word.length < 4 || NEAR_REAL.has(word) || list.includes(word)) return null;
  return list.find((x) => x.length >= 5 && !x.includes(" ") && edit1(word, x)) || null;
};
const NOUN_ALIAS = { pome: "poem", poam: "poem", poen: "poem", pomem: "poem", esay: "essay", esssay: "essay", emial: "email", storey: "story", haiku: "haiku", hiku: "haiku" };
const LEAD_TYPO = { wrtie: "write", wirte: "write", writ: "write", wite: "write", wriet: "write", rite: "write", writte: "write", wrte: "write", drfat: "draft", compse: "compose" };
const WRITE_LIKE = [...LEAD_SPECS.filter((s) => s.cls === "make" && !s.v.includes(" ") && s.v.length >= 5).map((s) => s.v)];

const nounAt = (ws, i) => {   // the output noun starting at token i: [type, form, tokensUsed] | null
  for (const m of MULTI) { const n = m.split(" ").length; if (i + n <= ws.length && ws.slice(i, i + n).map((x) => x.f).join(" ") === m) return [NOUNS.get(m), m, n]; }
  const w = ws[i]?.f; if (!w) return null;
  if (NOUNS.has(w)) return [NOUNS.get(w), w, 1];
  const al = NOUN_ALIAS[w]; if (al) return [NOUNS.get(al), al, 1];
  const near = nearIn(w, NOUN_WORDS); if (near) return [NOUNS.get(near), near, 1];
  return null;
};
// "script" is code when it does something ("script to rename files") and a script when it is for something ("script for a video")
const scriptIsCode = (ws, i) => /^(to|that|which|so)$/.test(ws[i + 1]?.f || "");

// ── segmenting a compound ask ──────────────────────────────────────────────────────────────────────────────────────────
const CONNECT = /\s*(?:,\s*)?(?:\band then\b|\bthen\b|\band after that\b|\bafter that\b|\bafterwards\b|\by luego\b|\by despues\b|\bpuis\b|\bet puis\b|\bet ensuite\b|\bзатем\b|\bпотом\b|\bund dann\b|\bdanach\b|\band also\b|\band\b|\balso\b|\by\b|\bet\b|\bи\b|\bund\b)\s+/giu;
function segmentsOf(q) {
  const parts = []; let last = 0; const cuts = [];
  for (const m of q.matchAll(CONNECT)) cuts.push([m.index, m.index + m[0].length, fold(m[0]).trim().replace(/^,\s*/, "")]);
  for (const [a, b, kind] of cuts) {
    const rest = q.slice(b);
    if (!startsAsk(rest) || a === 0) continue;
    parts.push({ text: q.slice(last, a), join: kind }); last = b;
  }
  parts.push({ text: q.slice(last), join: null });
  // each segment carries the connector that BEGAN it
  return parts.map((p, i) => ({ text: p.text.trim(), began: i === 0 ? null : parts[i - 1].join }));
}
const SEQ_JOIN = /^(?:and then|then|and after that|after that|afterwards|y luego|y despues|puis|et puis|et ensuite|затем|потом|und dann|danach)$/;
/** Does this text START like an ask (a lead or transform verb, or an article + an output noun)? Used only to decide where a compound splits. */
function startsAsk(rest) {
  const f = fold(rest).trim(); if (!f) return false;
  LEAD_RE.lastIndex = 0; const lm = LEAD_RE.exec(f);
  if (lm && lm.index === 0) return true;
  const ws = wordsOf(f); let i = 0;
  while (i < ws.length && i < 3 && (DET.has(ws[i].f) || /^\d+$/.test(ws[i].f))) i++;
  const n = nounAt(ws, i);
  return !!n && n[2] > 0 && n[0] !== "other" && TOPIC_PREP.has(ws[i + n[2]]?.f);
}

// ── topic ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const TAIL_CUT = [
  /\s+(?:in|within|of|with|at least|at most|around|about)\s+(?:\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten|a few|a couple of)\s+(?:words?|sentences?|paragraphs?|pages?|lines?|characters?|minutes?)\b.*$/i,
  /\s+(?:in|into|en|auf|au|на)\s+(?:english|spanish|french|german|italian|portuguese|russian|chinese|japanese|espanol|español|francais|français|deutsch|francés|inglés)\b.*$/iu,
  /\s+(?:in|with|using)\s+(?:a|an)\s+[\p{L}-]+\s+(?:tone|style|voice|way|manner)\b.*$/iu,
  /\s+(?:for|to)\s+(?:a |an |my |our |the |some )?(?:\d+(?:st|nd|rd|th)[ -]graders?|kids|children|beginners|experts|students|class|(?:[a-z]+ )?(?:assembly|audience|classroom)|adults|teens|readers|everyone|professionals|managers?|investors|customers)\b.*$/iu,
  /\s+(?:that|which)\s+(?:is|are|should|must|sounds?|has to|needs to|rhymes?)\b.*$/i,
  /\s+(?:and|but)\s+(?:make|keep|use|add|include|please|then)\b.*$/i,
  /\s+(?:make it|keep it|use a|add a|include a)\b.*$/i,
  /\s+(?:as a|as an|in a)\s+(?:pdf|docx|powerpoint|spreadsheet|word|table|list)\b.*$/i,
  /\s+(?:for|to)\s+(?:me|us)\b.*$/i,
  /\s+for\s+(?:a |an )?\d+[- ]year[- ]olds?\b.*$/i,
  /\s+(?:please|pls|thanks|thank you|por favor|s'il vous plait|пожалуйста)\s*$/iu,
  /[,;]\s+(?:make|keep|use|add|include|and|but|please|then|thanks)\b.*$/i,
];
const CONTAINER = /^(?:an? |the |my |our |some )?(?:talk|presentation|speech|lecture|meeting|class|essay|paper|project|report|article|book|story|blog|video|podcast|course|assignment|homework|school|work|event)$/i;
const CORRESPONDENCE = new Set(["email", "letter", "speech"]);
function cleanTopic(raw, type) {
  let t = one(raw).replace(/^[\s,:;–—-]+/, "");
  t = t.replace(/^(?:the )?(?:topic|subject|theme)(?: of)?\s+/i, "");
  if (CORRESPONDENCE.has(type)) t = t.replace(/\s+to\s+(?:my|our|his|her|their|your|the|a|an)\b.*$/i, "");
  for (let k = 0; k < 3; k++) for (const re of TAIL_CUT) t = t.replace(re, "");
  t = t.replace(/[\s.!?,;:…。！？]+$/u, "").replace(/^(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?=\p{L})/iu, "");
  return one(t);
}
/** The subject of an earlier ASK, without its question frame: "who invented the telephone?" → "the telephone". */
export function subjectOfAsk(ask) {
  const a = one(ask).replace(/[?!.]+$/, "");
  let m;
  if ((m = /^(?:who|what|which)\s+(?:was |were |is |are )?(?:the )?(?:first )?(?:invented|discovered|created|founded|wrote|painted|built|designed|developed|composed|directed|started|won|came up with)\s+(.+)$/i.exec(a))) return m[1];
  if ((m = /^(?:what|who)(?:'s|s)?\s+(?:is |are |was |were )?(.+)$/i.exec(a))) return m[1];
  if ((m = /^(?:when|where|why|how)\s+(?:did|does|do|is|are|was|were|can|could|would|should)\s+(.+)$/i.exec(a))) return m[1];
  if ((m = /^how (?:many|much)\s+(.+)$/i.exec(a))) return m[1];
  if ((m = /^(?:tell me about|explain|describe|talk about|teach me about)\s+(.+)$/i.exec(a))) return m[1];
  return a;
}

// ── one segment ────────────────────────────────────────────────────────────────────────────────────────────────────────
const AMBIGUOUS_LEAD = new Set(["list", "outline", "edit", "polish", "expand", "improve", "film", "paint", "draw", "resume"]);   // also nouns: "a list of", "the outline", "a film"
const isMod = (t) => DET.has(t.f) || isNumeric(t.f) || /^\d[\d,]*-/.test(t.f);   // a determiner, a number, or "5-paragraph"
const isNumeric = (w) => /^\d[\d,]*$/.test(w) || NUMW[w] != null;
function leadIn(seg) {
  const f = fold(seg); const ws = wordsOf(f);
  const found = [];
  LEAD_RE.lastIndex = 0;
  for (const m of f.matchAll(LEAD_RE)) found.push({ v: m[1], at: m.index, end: m.index + m[1].length, cls: LEAD_CLS.get(m[1]) });
  // typo'd verbs: a token one edit from a producing verb, or on the declared typo list
  for (const t of ws) {
    if (found.some((x) => t.at >= x.at && t.at < x.end)) continue;
    const v = LEAD_TYPO[t.f] || nearIn(t.f, WRITE_LIKE);
    if (v) found.push({ v, at: t.at, end: t.end, cls: "make", typo: true });
  }
  // "i need help writing an essay": a gerund after "help / assist" is the producing verb
  for (let i = 0; i < ws.length; i++) {
    if (!/^(?:writing|drafting|composing|creating|generating)$/.test(ws[i].f) || found.some((x) => ws[i].at >= x.at && ws[i].at < x.end)) continue;
    if (ws.slice(Math.max(0, i - 4), i).some((t) => /^(?:help|assist|helping|helps|assistance)$/.test(t.f))) found.push({ v: ws[i].f, at: ws[i].at, end: ws[i].end, cls: "make", gerund: true });
  }
  found.sort((a, b) => a.at - b.at);
  // an ambiguous verb that follows a determiner, a number or a hyphenated modifier is the NOUN ("a list of…", "a to-do list")
  const kept = found.filter((x) => {
    if (!AMBIGUOUS_LEAD.has(x.v)) return true;
    const i = ws.findIndex((t) => t.at >= x.at);
    const prev = i > 0 ? ws[i - 1].f : "", nxt = ws[i + 1]?.f || "";
    return !((prev && (DET.has(prev) || isNumeric(prev) || prev.includes("-"))) || OF_PREP.has(nxt));
  });
  return { f, ws, found: kept };
}

// the words that introduce the SUBJECT, beyond "on / about": what an "of / for / between / where" means depends on the noun (declared per type)
const SUBJECT_EXTRA = {
  essay: ["comparing", "contrasting", "arguing", "analyzing", "analysing", "examining", "evaluating", "defending", "debating"],
  story: ["between", "where", "featuring", "starring", "set", "involving"], poem: ["between", "where", "featuring", "starring", "set"], script: ["between", "where", "featuring", "starring", "set"],
  slogan: ["for", "celebrating", "announcing", "promoting", "introducing", "pour", "para", "для"],
  email: ["for", "pour", "para", "fur", "wegen", "celebrating", "announcing", "promoting", "introducing", "thanking", "inviting", "asking", "saying"],
  letter: ["for", "pour", "para", "fur", "wegen", "celebrating", "announcing", "promoting", "introducing", "thanking", "inviting", "asking", "saying"],
  speech: ["for", "celebrating", "announcing", "introducing", "thanking"],
  list: ["for", "pour", "para"], outline: ["for", "pour", "para"], table: ["for", "pour", "para", "comparing", "contrasting", "showing", "listing"],
};
const SOCIAL = new Set(["linkedin", "facebook", "instagram", "twitter", "social", "reddit", "tiktok", "insta", "fb", "x", "forum"]);
const HEAD_TYPES = new Set(["essay", "summary", "outline", "table", "list", "code", "slogan", "script", "poem", "story", "speech", "email", "letter"]);
const FORM_EXTRA = { recipe: ["for", "of"], recipes: ["for", "of"], description: ["for", "of"], "product description": ["for", "of"], bio: ["for"], profile: ["of", "for"], biography: ["of"], obituary: ["for", "of"], reminder: ["to"] };   // by the noun itself: "a description OF/FOR X"
const FOR_LIKE = new Set(["for", "pour", "para", "fur", "для"]);   // "for X" names an occasion or an audience as often as a subject: a later "on / about" outranks it
const subjectPrepAt = (after, type, form, counted) => {
  const extra = new Set([...(SUBJECT_EXTRA[type] || []), ...(FORM_EXTRA[form] || [])].map(fold));
  if (counted && (type === "list")) extra.add("to");
  const unsupported = UNSUPPORTED_FORMS.has(String(form));
  if (unsupported) extra.add("for");
  const hit = (t) => TOPIC_PREP.has(t.f) || extra.has(t.f) || ((OF_TYPES.has(type) || unsupported) && OF_PREP.has(t.f));
  const first = after.findIndex(hit);
  if (first >= 0 && FOR_LIKE.has(after[first].f)) { const base = after.findIndex((t, k) => k > first && TOPIC_PREP.has(t.f)); if (base >= 0 && base <= 8) return base; }
  return first;
};
const PEEL_OUTLINE = /^(?:an?|the|my|our)?\s*(?:essay|speech|talk|presentation|article|story|report|paper|lecture|book|novel|chapter|thesis)\s+(?:on|about|for|regarding|concerning)\s+(.+)$/i;

/** Read one segment: { type, form, typed, topicRaw, deictic, material, … } or null when it asks for no output. */
function readSegment(seg, ctx) {
  const text = one(seg); if (!text) return null;
  const { f, ws, found } = leadIn(text);
  // Han: three declared patterns (no spaces, so no tokens)
  if (/\p{Script=Han}/u.test(text)) {
    const m = /(?:写|寫)(?:一|两|三)?(?:篇|首|个|個|封|段)?(?:关于|關於|有关)?(.*?)的?(文章|作文|论文|诗歌|诗|詩|故事|邮件|信|演讲稿|演讲|总结)/u.exec(text);
    if (!m) return null;
    const map = { 文章: "essay", 作文: "essay", 论文: "essay", 诗歌: "poem", 诗: "poem", 詩: "poem", 故事: "story", 邮件: "email", 信: "letter", 演讲稿: "speech", 演讲: "speech", 总结: "summary" };
    return { type: map[m[2]], form: m[2], typed: true, topicRaw: m[1], deictic: false, material: null, lead: "write", segText: text };
  }
  // the lead: a producing verb beats a retrieval-shaped one ("i need to write an essay": the verb is write)
  const strong = found.filter((x) => x.cls === "make" || x.cls === "transform");
  const lead = strong.length ? strong[0] : found[0] || null;
  if (!lead) {
    // "Fix the grammar in this: …" — the shape detector of fold-chat-kinds.js is the one definition of a transform of the person's own text
    const ts = transformShape(text, { hasMaterial: ctx.hasMaterial });
    if (ts && ts.kind !== "other") return { type: ts.kind === "summarise" ? "summary" : ts.kind === "translate" ? "translation" : "rewrite", form: ts.kind, typed: true, topicRaw: "", deictic: !!ts.attached, material: ts.attached ? "attached" : ts.material ? "inline" : null, ...(ts.material ? { materialText: ts.material } : {}), lead: ts.kind, segText: text };
  }
  // the words before the verb that can make it a question / a report are the ones in ITS sentence ("My sister is getting married. Can you write a toast?")
  const sentStart = lead ? Math.max(0, ...[...text.slice(0, lead.at).matchAll(/[.!?;]\s+/g)].map((m) => m.index + m[0].length)) : 0;
  const before = lead ? ws.filter((t) => t.end <= lead.at && t.at >= sentStart) : [];
  // G1 question-frame (also a modal or a negation before the verb: "should I draft…", "I can't write today")
  if (lead && before.some((t) => QUESTION_FRAME.has(t.f) || REPORTING.has(t.f))) return null;
  // G1c a first-person DECLARATION ("I will draft the report tomorrow", "I could write one") is not a request — unless it wants / needs / asks
  if (lead) { const bt = fold(text.slice(sentStart, lead.at)); if (DECLARATIVE.test(bt) && !WANTING.test(bt)) return null; }
  const after = lead ? ws.filter((t) => t.at >= lead.end) : [];
  const restOf = () => one(text.slice(lead.end)).replace(/^[\s:,]+/, "");
  // visual verbs: draw / paint — the fold writes, it does not make pictures (a typed void, not a poem about a picture)
  if (lead && VISUAL_LEADS.has(lead.v)) {
    const topicRaw = restOf().replace(/^(?:me|us|nos)\s+/i, "").replace(/^(?:an?|the|some)\s+/i, "").replace(/^(?:picture|image|drawing|painting|map|illustration|poster|logo|photo)\s+(?:of|de|du)\s+/i, "");
    const noun = after.map((t) => t.f).find((w) => UNSUPPORTED_FORMS.has(w));
    return { type: "other", form: noun || "picture", typed: true, topicRaw, deictic: false, material: null, lead: lead.v, segText: text };
  }
  // transform verbs: summarize / translate / rewrite / outline / list
  if (lead && lead.cls === "transform") {
    const kind = TRANSFORM_LEADS.get(lead.v);
    const rest = restOf();
    if (kind === "outline" || kind === "list" || kind === "table") {
      const peel = PEEL_OUTLINE.exec(rest);
      return { type: kind, form: lead.v, typed: true, topicRaw: peel ? peel[1] : rest, deictic: DEICTIC.test(fold(peel ? peel[1] : rest)), material: null, lead: lead.v, segText: text };
    }
    const mat = materialIn(text);
    const ts = transformShape(text, { hasMaterial: ctx.hasMaterial });
    const restF = fold(rest);
    const restNoCons = one(restF.replace(/(?<![\p{L}\p{N}])(?:into|to|in|a|al|en|au|на)\s+(?:english|spanish|french|german|italian|portuguese|russian|chinese|japanese|espanol|francais|ingles|frances|deutsch|английский|французский|испанский|немецкий)(?![\p{L}])/gu, "").replace(/(?<![\p{L}])(?:to sound|so it sounds|so that)(?![\p{L}]).*$/u, "").replace(/\s+for\s+(?:a |an |my |the |me |us )?(?:\d+[- ]year[- ]olds?|kids|children|beginners|experts|students|class|adults|teens|me|us)\b.*$/u, "")).replace(/[:,.?!;\s]+$/u, "");
    if (ts && ts.material && !DEICTIC.test(fold(ts.material))) return { type: kind, form: lead.v, typed: true, topicRaw: "", deictic: false, material: "inline", materialText: ts.material, lead: lead.v, segText: text };
    if (ts && ts.attached) return { type: kind, form: lead.v, typed: true, topicRaw: "", deictic: true, material: "attached", lead: lead.v, segText: text };
    const deic = !restNoCons || DEICTIC.test(restNoCons) || /^(?:my|the|this|that|these|those|mi|mis|mon|ma|мой|мою|этот)\s+(?:paragraph|text|essay|draft|email|message|letter|document|doc|file|párrafo|texto|parrafo|abstract|post)(?![\p{L}])/iu.test(restNoCons) || /^(?:the )?(?:following|above|text below)(?![\p{L}])/i.test(restNoCons);
    if (deic) return { type: kind, form: lead.v, typed: true, topicRaw: "", deictic: true, material: null, lead: lead.v, segText: text };
    // summarize / translate / rewrite a NAMED thing ("summarize the French Revolution"): the thing is the topic and has to be read
    return { type: kind, form: lead.v, typed: true, topicRaw: rest, deictic: false, material: null, lead: lead.v, segText: text, namedTarget: true };
  }
  // the person's own words after "make this …": "make this shorter" / "make it more formal"
  if (lead && /^(?:make|mach|mache|haz|fais|сделай)$/.test(lead.v) && after.length && /^(?:this|it|that|esto|ca|это)$/.test(after[0].f) && after[1] && /^(?:shorter|longer|simpler|clearer|formal|casual|polite|professional|friendlier|better|more|less|mas|plus)$/.test(after[1].f)) {
    const ts = transformShape(text, { hasMaterial: ctx.hasMaterial });
    return { type: "rewrite", form: "make-it", typed: true, topicRaw: "", deictic: true, material: ts?.attached ? "attached" : null, lead: lead.v, segText: text };
  }
  // G3 particle
  if (lead && lead.cls === "make") {
    const nxt = after[0];
    if (nxt && PARTICLES.has(nxt.f) && !TOPIC_PREP.has(nxt.f)) return null;
  }
  // scan for the output noun
  let i0;
  if (lead && VERB_FINAL.has(lead.v)) i0 = 0;
  else if (lead) i0 = ws.findIndex((t) => t.at >= lead.end); else {
    i0 = 0; while (i0 < ws.length && ["now", "ok", "okay", "and", "also", "then", "next", "please", "pls", "ahora", "maintenant", "теперь"].includes(ws[i0].f)) i0++;   // nominal ask: "now a poem about it"
  }
  if (i0 < 0) i0 = ws.length;
  const win = lead && VERB_FINAL.has(lead.v) ? 12 : lead ? (lead.cls === "want" ? 4 : lead.cls === "give" ? 5 : 8) : 3;
  const between = [];
  let hit = null, at = -1, counted = false, bareOk = false;
  for (let i = i0; i < ws.length && i < i0 + win + 2; i++) {
    const w = ws[i].f;
    if (TOPIC_PREP.has(w)) break;
    if (NOT_BETWEEN.has(w) && !(lead && VERB_FINAL.has(lead.v))) break;                       // G2
    let n = nounAt(ws, i);
    if (n && COUNT_NOUNS.has(n[1])) { const pv = [ws[i - 1]?.f, ws[i - 2]?.f].filter(Boolean); if (pv.some((w) => isNumeric(w) || ["some", "few", "several", "many"].includes(w))) counted = true; else n = null; }   // "five reasons to…" is a list; bare "give me tips" is ADVICE (fold-chat-kinds.js adviceShape), not a piece to produce
    if (n) { hit = n; at = i; break; }
    between.push(ws[i]);
    if (between.length >= win) break;
  }
  // compound nouns are head-final: "comparison table" is a table, "essay outline" an outline
  while (hit && hit[2] === 1) {
    const nx = nounAt(ws, at + hit[2]);
    if (nx && nx[2] === 1 && HEAD_TYPES.has(nx[0]) && HEAD_TYPES.has(hit[0]) && !COUNT_NOUNS.has(nx[1])) { hit = nx; at += 1; between.push(ws[at - 1]); } else break;
  }
  if (!lead) {
    if (!hit || !["essay", "poem", "story", "speech", "slogan", "other", "letter", "email"].includes(hit[0]) || hit[0] === "other" && !/^(?:joke|jokes|riddle|riddles|pun|puns)$/.test(hit[1])) return null;
    const nx = ws[at + hit[2]];
    const bareAsk = !nx || /^(?:please|pls|thanks)$/.test(nx.f);   // "A haiku please", "a joke"
    const creativeShort = ws.length <= 4 && (["poem", "story", "slogan"].includes(hit[0]) || (hit[0] === "other" && /^(?:joke|riddle|pun)/.test(hit[1])));
    if (bareAsk && creativeShort) bareOk = true;
    else if (!nx || !TOPIC_PREP.has(nx.f)) return null;
    if (between.some((t) => !isMod(t))) return null;
  }
  // G4 existing-work: a retrieval lead + "the" + noun + a Title is a lookup of a thing that exists
  if (hit && lead && (lead.cls === "give" || lead.cls === "want")) {
    const prev = ws[at - 1]?.f, nextW = ws[at + hit[2]];
    if (/^(?:the|la|le|el)$/.test(prev || "") && nextW && /^\p{Lu}/u.test(text.slice(nextW.at, nextW.at + 1)) && !TOPIC_PREP.has(nextW.f)) return null;
  }
  let type, form, typed = true, topicRaw = "", deictic = false, undecided = false;
  if (hit) {
    [type, form] = [hit[0], hit[1]];
    if (form === "script" && scriptIsCode(ws, at)) type = "code";
    if (form === "script" && !scriptIsCode(ws, at)) type = "script";
    const pw = ws[at - 1]?.f || "";
    if (form === "play" && !DET.has(pw)) return null;
    if (form === "post") {
      if (SOCIAL.has(pw)) type = "slogan";
      else if (pw !== "blog" && !DET.has(pw)) return null;
    }
    if ((form === "address" || form === "plan") && !/^(?:a|an|the|my)$/.test(pw)) return null;
    if (form === "class" && !lead) return null;
    if (form === "brief") type = lead && /^(?:schreibe|schreib|verfasse|erstelle)$/.test(lead.v) ? "letter" : "essay";   // German "Brief" is a letter; English "a brief on X" is an essay
    if (form === "guide" && !/^(?:study|a|the)$/.test(pw)) return null;
    if (/^(?:something|anything|thing)$/.test(form)) { typed = false; undecided = true; }   // a placeholder noun: the type is not named
    const aft = ws.slice(at + hit[2]);
    const pi = subjectPrepAt(aft, type, form, counted);
    if (pi < 0 && /^(?:краткое содержание|пересказ)$/.test(form) && aft.length) topicRaw = text.slice(aft[0].at);   // Russian: the subject follows in the genitive, no preposition
    if (pi >= 0 && pi <= 6) {
      const pwd = aft[pi]; let skip = pwd.end;
      const nx = aft[pi + 1]; if (nx && /^(?:de|du|d'|des|del)$/.test(nx.f) && ["acerca", "propos", "sujet"].includes(pwd.f)) skip = nx.end;   // "acerca de", "a propos de", "au sujet de"
      topicRaw = text.slice(skip);
      if (lead && VERB_FINAL.has(lead.v) && lead.at >= skip) topicRaw = text.slice(skip, lead.at);
    } else if (pi < 0 && !lead && !bareOk) return null;
    // G8 capability question: "can you write essays?" — a bare plural, no subject, no article: asking what the fold CAN do, not asking for a piece
    if (lead && !topicRaw && !between.some(isMod) && /s$/.test(ws[at].f) && !COUNT_NOUNS.has(form) && /^(?:essays|poems|stories|emails|letters|speeches|jokes|songs|reports|articles|haikus|limericks|tweets|captions|slogans|summaries)$/.test(ws[at].f) && before.some((t) => /^(?:can|could|do|does|will|would|are)$/.test(t.f))) return null;
    // a deictic object between the verb and the noun: "make it an essay", "turn this into a poem", "convert that into a table"
    if (!topicRaw && /^(?:out of|from|using|based on)\s+(?:this|that|it|the above|above)\b/i.test(text.slice(ws[at + hit[2] - 1].end).trim())) deictic = true;   // "make a poem out of this"
    if (!topicRaw) deictic = deictic || between.some((t) => DEICTIC.test(t.f) || /^(?:this|it|that|esto|ca|это)$/.test(t.f));
  } else if (lead && lead.cls === "make" && STRONG_MAKE.has(lead.v) && after.length >= 3 && isNumeric(after[0].f) && /^(?:words|sentences|paragraphs|pages|lines|palabras|mots)$/.test(after[1].f) && TOPIC_PREP.has(after[2].f)) {
    // "write 500 words on X": a length is not a type, but a piece of that length on X is prose
    type = /^(?:lines)$/.test(after[1].f) ? "poem" : "essay"; form = after[1].f; typed = false; topicRaw = text.slice(after[2].end);
  } else if (lead && lead.cls === "make" && STRONG_MAKE.has(lead.v)) {
    // "write about X" — a producing verb straight into a topic: prose, type not named
    const first = after[0], second = after[1];
    const prepAt = first && (TOPIC_PREP.has(first.f) ? first : (second && /^(?:me|us|nos)$/.test(first.f) && TOPIC_PREP.has(second.f) ? second : null));
    if (prepAt) { type = "other"; form = "text"; typed = false; topicRaw = text.slice(prepAt.end).replace(/^\s*(?:de|du)\s+(?=\p{L})/iu, ""); }
    else return null;
  } else return null;
  if (!type) return null;
  return { type, form, typed, topicRaw, deictic, material: null, lead: lead ? lead.v : null, segText: text, undecided };
}

// ── what each type needs ───────────────────────────────────────────────────────────────────────────────────────────────
function finalize(seg, ctx) {
  const { c: constraints, spans } = constraintsOf(seg.segText);
  let type = seg.type;
  const form = seg.form;
  // G5 code-first, for a segment whose noun said nothing about code but whose words do
  let topic = null, topicVia = null, material = seg.material || null, deictic = !!seg.deictic;
  let raw = seg.topicRaw ? cleanTopic(seg.topicRaw, type) : "";
  if (CONTAINER.test(raw) && !DEICTIC.test(fold(raw))) raw = "";   // "an outline for a talk": the talk is the occasion, not the subject
  if (raw) { if (DEICTIC.test(fold(raw))) deictic = true; else { topic = raw; topicVia = "literal"; } }
  // G6 deictic-resolution: "this / it / the above" is the thread's, or a typed gap
  let threadRes = null;
  if (deictic && !topic) {
    const transformsText = type === "summary" || type === "rewrite" || type === "translation";
    if (transformsText) {
      if (material === "attached" || material === "inline") { /* given */ }
      else if (ctx.hasMaterial) material = "attached";
      else if (ctx.threadAnswer) { material = "thread-answer"; }
      else if (ctx.previousStep) material = "previous-step";
    } else {
      threadRes = ctx.resolve ? ctx.resolve() : null;
      if (threadRes) { topic = threadRes.topic; topicVia = threadRes.via; }
      else if (ctx.hasMaterial) { material = "attached"; topicVia = "material"; }
      else if (ctx.previousStep && ctx.previousStep.topic) { topic = ctx.previousStep.topic; topicVia = "previous-step"; }
    }
  }
  const unsupportedForm = UNSUPPORTED_FORMS.has(String(form));
  const unsupportedFormat = !unsupportedForm && constraints.format && UNSUPPORTED_FORMATS.test(constraints.format);
  const personal = !!topic && PERSONAL.test(topic);
  // does an output of this type, on this topic, ground in sources?
  // (type-level: an essay GROUNDS in sources whether or not a subject was found — a missing subject is a void, not a reason to stop needing sources)
  let needsSources = false;
  if (!unsupportedForm && !personal && !material) {
    if (type === "essay") needsSources = !GIVEN_FORMS.has(String(form)) || WANTS_FACTS.test(seg.segText);
    else if (type === "outline" || type === "table") needsSources = true;
    else if (type === "other") needsSources = seg.typed === false && !!topic && (!seg.undecided || topicVia === "thread-ask");
    else if (type === "summary") needsSources = !!topic;
    else if (type === "translation" || type === "rewrite") needsSources = !!seg.namedTarget;
    else if (type === "list") needsSources = !!topic && !CREATIVE_LIST.test(topic) && !CREATIVE_LIST.test(seg.segText);
    else if (type === "email" || type === "letter") needsSources = !!topic && (PUBLIC_RECIPIENT.test(seg.segText) || !REQUESTY.test(seg.segText)) && (!PERSONAL_FORMS.has(String(form)) || WANTS_FACTS.test(seg.segText)) && (!(PERSONAL_RECIPIENT.test(seg.segText) || PERSONAL.test(seg.segText)) || PUBLIC_RECIPIENT.test(seg.segText));
    else if (type === "speech") needsSources = !!topic && !/\b(?:wedding|retirement|birthday|anniversary|graduation|funeral|farewell|eulogy|toast|party|award|thank you)\b|'s\b/i.test(seg.segText) && !/\b(?:toast|eulogy|vows|brindis)\b/i.test(String(form));
  }
  const searchQuery = needsSources ? (threadRes && threadRes.query ? threadRes.query : topic) : null;
  const gaps = [];
  const needsTopic = type === "essay" || type === "outline" || type === "table";
  if (!unsupportedForm && !topic && material == null && (needsTopic || (deictic && !(type === "summary" || type === "rewrite" || type === "translation")))) gaps.push({ gap: "no-topic", active: true, why: deictic ? "the ask points at \"this\" and nothing earlier in the chat says what it is" : "no subject was given" });
  if ((type === "summary" || type === "rewrite" || type === "translation") && !topic && !material) gaps.push({ gap: "no-material", active: true, why: "there is no text of yours attached, quoted or earlier in the chat to work on" });
  if (unsupportedForm) gaps.push({ gap: "unsupported-type", active: true, form, why: `the fold does not produce ${form}s` });
  if (unsupportedFormat) gaps.push({ gap: "unsupported-format", active: true, form: constraints.format, why: `the fold does not produce a ${constraints.format} file` });
  if (needsSources) gaps.push({ gap: "nothing-found", active: null, why: "known only after the search: the sources found must bear on the topic" });
  for (const g of gaps) Object.defineProperty(g, "toString", { value() { return this.gap; }, enumerable: false });   // fold-chat-genvoid.js reads voidIfMissing as names: String(gap) is its name
  return {
    type, form: form ?? null, typed: seg.typed, topic: topic || null, topicVia, constraints, needsSources, searchQuery: searchQuery || null,
    material, ...(seg.materialText ? { materialText: seg.materialText } : {}), voidIfMissing: gaps, undecided: !!seg.undecided, wants: true,
  };
}

const NONE = Object.freeze({ type: "none", form: null, typed: true, topic: null, topicVia: null, constraints: {}, needsSources: false, searchQuery: null, material: null, voidIfMissing: [], undecided: false, wants: false });

// ── the thread ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const textOf = (m) => one(m?.content);
function threadFacts(prior) {
  const msgs = Array.isArray(prior) ? prior : [];
  let answer = "";
  for (let i = msgs.length - 1; i >= 0; i--) { const m = msgs[i]; if (m?.role === "assistant" && textOf(m) && m.mode !== "agent") { answer = textOf(m); break; } }
  return { answer, msgs };
}
/** Walk the earlier asks, newest first: the first that names a subject of its own is what "this" means. */
function resolveThroughThread(prior, ctx, depth = 0) {
  const { msgs } = threadFacts(prior);
  let seen = 0;
  for (let i = msgs.length - 1; i >= 0 && seen < 8; i--) {
    const m = msgs[i]; if (m?.role !== "user") continue;
    const a = textOf(m); if (!a) continue; seen++;
    if (isNudge(a) || isMeta(a) || isSourceAsk(a) || /^continue\.?$/i.test(a) || wordsOf(a).length <= 2) continue;   // "when?" is a fragment of the exchange, not its subject
    // an earlier request for output: its own topic IS the subject
    const d = depth < 3 ? describeOutput(a, { prior: msgs.slice(0, i), hasMaterial: false, _depth: depth + 1 }) : NONE;
    if (d.wants) { if (d.topic && d.topicVia !== "material") return { topic: d.topic, via: "thread-request", query: d.searchQuery || d.topic }; continue; }
    if (isElliptical(a) && !/\?/.test(a)) continue;
    const subj = subjectOfAsk(a);
    if (subj && subj.length > 1) return { topic: subj, via: "thread-ask", query: one(a).replace(/[?!.]+$/, "") };
  }
  return null;
}

// ── the public reading ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Describe the output a turn asks for. Never throws; `none` means the turn asks for no produced output (a lookup, a chat, a greeting). */
export function describeOutput(turn, opts = {}) {
  const q = one(turn);
  if (!q) return { ...NONE, voidIfMissing: [] };
  const hasMaterial = !!opts.hasMaterial, prior = opts.prior || [];
  const depth = opts._depth || 0;
  const facts = threadFacts(prior);
  // G5 code-first: one definition of "a programming ask" (fold-chat-kinds.js)
  let codeAsk = false; try { codeAsk = codeShape(q); } catch { codeAsk = false; }
  if (codeAsk) return { ...NONE, type: "code", form: null, typed: true, wants: true, constraints: constraintsOf(q).c, voidIfMissing: [] };
  const segs = segmentsOf(q);
  const steps = [];
  for (const s of segs) {
    const prev = steps[steps.length - 1] || null;
    const ctx = { hasMaterial, threadAnswer: !!facts.answer, previousStep: prev, resolve: () => resolveThroughThread(prior, { hasMaterial }, depth) };
    const r = readSegment(s.text, ctx);
    if (!r) continue;
    const d = finalize(r, ctx);
    steps.push({ ...d, began: s.began, _seg: s.text });
  }
  if (!steps.length) return { ...NONE, voidIfMissing: [] };
  // a step with no subject of its own shares the subject of the nearest other step that has one ("an outline and then an essay on the Cold War")
  if (steps.length > 1) {
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      if (st.topic || st.material || !(st.voidIfMissing.some((g) => g.gap === "no-topic"))) continue;
      const donor = steps.find((o, j) => j !== i && o.topic && o.topicVia);
      if (donor) { st.topic = donor.topic; st.topicVia = donor.topicVia; st.voidIfMissing = st.voidIfMissing.filter((g) => g.gap !== "no-topic"); if (["essay", "outline", "table"].includes(st.type) && !PERSONAL.test(st.topic)) { st.needsSources = true; st.searchQuery = donor.searchQuery || donor.topic; st.voidIfMissing.push({ gap: "nothing-found", active: null, why: "known only after the search: the sources found must bear on the topic" }); } }
    }
  }
  const seq = steps.slice(1).some((s) => SEQ_JOIN.test(s.began || "")) ? "then" : steps.length > 1 ? "and" : null;
  const head = seq === "then" ? steps[steps.length - 1] : steps[0];
  const strip = ({ began, _seg, ...rest }) => rest;
  const out = { ...strip(head) };
  if (steps.length > 1) { out.steps = steps.map(strip); out.sequence = seq; }
  return out;
}

// G9 a page that teaches HOW TO WRITE the piece is not a source ON its topic. The instruction was searched once and brought back
// "Essay on Telephone in 100, 200, 300, and 500 Words … first start with an introduction"; the cure is to search the topic (searchQuery), and this is
// the belt over the braces: when pages like that still arrive they are set aside, and if nothing else is left the gap is `nothing-found`.
const WRITING_GUIDE_CUES = [/\bessay (?:on|writing|format|structure|examples?|topics?)\b/i, /\b(?:100|150|200|250|300|500|1000)(?:,| and)?\s+(?:and\s+)?(?:\d+\s+)?words?\b/i, /\b(?:thesis statement|body paragraphs?|topic sentences?)\b/i,
  /\bfirst,? start with an? introduction\b/i, /\bhow to write (?:an?|the)\b/i, /\b(?:introduction|conclusion)\b[^.]{0,60}\b(?:introduction|conclusion)\b/i, /\b(?:sample|example) (?:essay|paragraph|poem|story|speech)\b/i];
/** Is this passage a guide to writing the piece (rather than something to write the piece FROM)? Needs two independent cues. */
export function isWritingGuide(passage) {
  const t = `${passage?.title || ""} ${passage?.text || passage?.snippet || ""}`;
  return WRITING_GUIDE_CUES.filter((re) => re.test(t)).length >= 2;
}

/** The typed gaps that hold once the search has run: `nothing-found` when a type that needs sources found no passage that bears on the topic
 *  (writing guides are not passages that bear on it). `usable` is what is left to write from. */
export function voidsAfterSearch(desc, passages = [], { bears = null } = {}) {
  const gaps = (desc?.voidIfMissing || []).filter((g) => g.active === true);
  let usable = Array.isArray(passages) ? passages : [];
  if (desc?.needsSources) {
    const guides = usable.filter(isWritingGuide);
    usable = usable.filter((p) => !isWritingGuide(p));
    const topicWords = String(desc.topic || "").toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [];
    const fits = (p) => { const t = fold(`${p?.title || ""} ${p?.text || p?.snippet || ""}`); return topicWords.length ? topicWords.some((w) => t.includes(fold(w).slice(0, Math.max(4, fold(w).length - 2)))) : true; };
    usable = typeof bears === "function" ? usable.filter(bears) : usable.filter(fits);
    if (!usable.length) gaps.push({ gap: "nothing-found", active: true, why: guides.length ? "the pages found are guides to writing, not sources on the topic" : (passages || []).length ? "the pages found do not bear on the topic" : "nothing was found for the topic" });
  }
  Object.defineProperty(gaps, "usable", { value: usable, enumerable: false });
  return gaps;
}

/** The shape fold-chat-genvoid.js (`genVoid({ outputType })`) wants: its type table is keyed by the FORM word (blog post, haiku, tagline), so when
 *  the form is one it knows the form is the type; otherwise the family. `known` is its exported TYPES table (or any object keyed by form). */
export function genVoidShape(desc, known = null) {
  const d = desc || NONE;
  const type = known && d.form && Object.prototype.hasOwnProperty.call(known, d.form) ? d.form : d.type;
  return { type, topic: d.topic || "", constraints: d.constraints || {}, needsSources: !!d.needsSources, voidIfMissing: (d.voidIfMissing || []).map((g) => String(g)) };
}

/** The discourse kind this description implies (fold-chat-discourse.js `classifyTurn`), or null when it has no opinion.
 *  A summary / outline / table / list that must be READ is research (searched, checked) — only invented or transformed output is not. */
export function kindOfOutput(d) {
  if (!d || !d.wants) return null;
  if (d.type === "code") return /^(?:landing page|web page|webpage|website|html page|app)$/.test(String(d.form)) ? "generate" : "code";   // a page / app is built by the fold's own HTML build (the generate lane), not a code card
  if (d.type === "translation" || d.type === "rewrite" || d.type === "summary") return d.needsSources ? "research" : "transform";   // a NAMED text ("translate Hamlet", "summarize WW1") has to be read: searched
  if ((d.type === "email" || d.type === "letter") && !d.needsSources) return "compose";
  if (d.type === "list" && /^(?:tips|ways|suggestions)$/.test(String(d.form))) return null;   // "5 tips to sleep better": counted advice stays ADVICE (searched, no void unless it commits to figures)
  if ((d.type === "summary" || d.type === "outline" || d.type === "table" || d.type === "list") && d.needsSources && d.topic) return "research";
  return "generate";
}
export function outputKind(turn, opts) { const d = describeOutput(turn, opts); return kindOfOutput(d); }

// ── G7: a model may only PICK, from the closed list, twice, in two orders, and the pick must fit the evidence ────────────
const evidenceFor = (type, q) => {
  const f = fold(q);
  if (type === "code") { try { return codeShape(q); } catch { return false; } }
  if (type === "translation") return /\b(?:translate|traduc|traduis|translat)/.test(f) || !!constraintsOf(q).c.language;
  if (type === "summary" || type === "rewrite") return /\b(?:this|it|that|text|paragraph|document|above)\b/.test(f);
  return true;
};
/** Ask `pick(prompt, options)` (a function that calls a model) to choose the type of an UNDECIDED description. Returns the description with the
 *  type set and `typed: "model-pick"` only when both orderings return the same item of the closed list and the evidence allows it;
 *  otherwise the description comes back unchanged. `pick` may be sync or async; whatever it throws, the code's own reading stands. */
export async function pickType(desc, turn, pick) {
  if (!desc || !desc.undecided || typeof pick !== "function") return desc;
  const opts = PRODUCING.filter((t) => t !== "other");
  const ask = (list) => `The person wrote: "${one(turn).slice(0, 300)}"\nWhat kind of thing do they want written? Answer with exactly one word from this list and nothing else: ${list.join(", ")}.`;
  const norm = (a) => fold(String(a ?? "")).replace(/[^a-z]/g, "");
  let a, b;
  try { a = norm(await pick(ask(opts), opts)); b = norm(await pick(ask([...opts].reverse()), [...opts].reverse())); } catch { return desc; }
  if (!a || a !== b || !opts.includes(a)) return desc;
  if (!evidenceFor(a, turn)) return desc;
  const f = finalize({ type: a, form: null, typed: "model-pick", topicRaw: desc.topic || "", deictic: false, material: null, segText: one(turn), lead: null }, { hasMaterial: false });
  return { ...desc, ...f, undecided: false, typed: "model-pick", pickedFrom: opts };
}
