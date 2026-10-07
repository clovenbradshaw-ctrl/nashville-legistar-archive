// adapters/text/fact-lenses.js — per-language lenses for the FACT-GATE's
// ask grammar (GFP doctrine: the kernel is language-blind; a LENS is one
// language's own grammar — the surfaces that mark a value-ask over a role).
//
// The fact-gate kernel (organs/fact-gate.js) types a claim from closed-class
// FUNCTION WORDS: the wh-openers, the present copula, the definite article,
// the of-preposition. Those classes are ENGLISH grammar — the English lens.
// This file declares the same three-or-four classes for the languages the
// battery exercises, each a MINIMAL ATTESTED surface set, in the same
// discipline as askshape-lens.multilingual.js: the SAME kernel returns the
// SAME verdict in every language, because the language lives in the lens.
// A native speaker refines each; nothing here is invented, and a language
// with no lens is read by no grammar at all (the safe-failure arm).
//
// The lens also carries the MOUTH's assembly templates — the sentences the
// gate splices are built from the lens's own grammar, so a Spanish answer
// never receives an English sentence. The value and the date come from the
// environment's bytes (the link's holder, the term), never from the model
// and never from the lens: the lens owns syntax, the environment owns facts.
//
// NO MODEL. Nothing here calls LaVar or any other grader: the lenses are
// received, attested surfaces; the verdicts are mechanical.
//
// \b is NOT used for CJK/Arabic/Devanagari/Thai (ASCII-anchored, breaks on
// those scripts): those lenses use plain substrings, case-folded where the
// script has case — the same rule askshape-lens.multilingual.js already
// states.

const ENG_WH = new Set(["who", "what", "which", "whom", "whose"]);
const ENG_PRESENT = new Set(["is", "are", "am", "has", "have", "does", "do"]);
const ENG_PAST = new Set(["was", "were", "had", "did", "would", "could", "should", "might", "will", "shall"]);
const ENG_ANCHOR = new Set(["of", "in", "at", "on", "for", "since", "during", "as", "by", "until", "from", "before", "after", "with", "to"]);

const set = (a) => new Set(a);
const lower = (s) => String(s ?? "").toLowerCase();

/** One lens: the closed classes the gate reads, and the mouth's templates. */
const build = (lang, { wh, present, past, anchor, articles, of, frame, value, holderValue, unsourced, ordinal = null, capsAreAnchor = true }) => ({
  lang,
  wh: set(wh), present: set(present), past: set(past), anchor: set(anchor),
  articles: set(articles), of: set(of),
  frame, value, holderValue, unsourced,
  checked: APPEND[lang].checked, nothingFound: APPEND[lang].nothingFound, mismatch: APPEND[lang].mismatch,
  ordinal, // per-language ordinal shape ("47th", "47e"); null = the digit alone
  // English capitalises named entities and reads that as an anchor; German
  // capitalises every noun — a language that does declares capsAreAnchor:false
  // (the orthography is its own, and the gate must not read it as English's).
  capsAreAnchor,
});

const ENG_FRAME = (head, jurisdiction) => {
  const base = /^the\s/i.test(head) ? head : `the ${head}`;
  if (!jurisdiction) return base;
  const jur = /^the\s/i.test(jurisdiction) ? jurisdiction : `the ${jurisdiction}`;
  return `${base} of ${jur}`;
};

// The append templates — the mouth's soft notes (decideGate): "checked",
// "nothing found", and the dated-ground mismatch.
const APPEND = {
  eng: { checked: (s, d) => `Checked against ${s}, as of ${d}.`, nothingFound: (d) => `Nothing I found backed this up, so treat it as unchecked (as of ${d}).`, mismatch: (d, t) => `That does not match what I found (as of ${d}): ${t}` },
  spa: { checked: (s, d) => `Comprobado contra ${s}, al ${d}.`, nothingFound: (d) => `Nada de lo encontrado lo respalda; trátese como no verificado (al ${d}).`, mismatch: (d, t) => `Eso no coincide con lo que encontré (al ${d}): ${t}` },
  fra: { checked: (s, d) => `Vérifié contre ${s}, en date du ${d}.`, nothingFound: (d) => `Rien de trouvé ne l'étaye; à traiter comme non vérifié (au ${d}).`, mismatch: (d, t) => `Cela ne correspond pas à ce que j'ai trouvé (au ${d}): ${t}` },
  deu: { checked: (s, d) => `Geprüft gegen ${s}, Stand ${d}.`, nothingFound: (d) => `Nichts Gefundenes stützt das; als ungeprüft behandeln (Stand ${d}).`, mismatch: (d, t) => `Das passt nicht zu dem, was ich gefunden habe (Stand ${d}): ${t}` },
  ita: { checked: (s, d) => `Verificato contro ${s}, al ${d}.`, nothingFound: (d) => `Niente di trovato lo conferma; trattare come non verificato (al ${d}).`, mismatch: (d, t) => `Non corrisponde a quanto ho trovato (al ${d}): ${t}` },
  por: { checked: (s, d) => `Verificado contra ${s}, em ${d}.`, nothingFound: (d) => `Nada do que encontrei confirma isso; trate como não verificado (em ${d}).`, mismatch: (d, t) => `Isso não corresponde ao que encontrei (em ${d}): ${t}` },
  rus: { checked: (s, d) => `Проверено по ${s}, на ${d}.`, nothingFound: (d) => `Ничего из найденного это не подтверждает; считать непроверенным (на ${d}).`, mismatch: (d, t) => `Это не совпадает с тем, что я нашёл (на ${d}): ${t}` },
  arb: { checked: (s, d) => `تم التحقق منه مقابل ${s}، اعتبارًا من ${d}.`, nothingFound: (d) => `لم يدعمه شيء وجدته؛ عالجه باعتباره غير موثق (اعتبارًا من ${d}).`, mismatch: (d, t) => `لا يتطابق هذا مع ما وجدته (اعتبارًا من ${d}): ${t}` },
  jpn: { checked: (s, d) => `${s}を照会して確認済み（${d}時点）。`, nothingFound: (d) => `裏付ける情報源は見つかりませんでした（${d}時点）。未確認として扱ってください。`, mismatch: (d, t) => `見つけた情報とは一致しません（${d}時点）: ${t}` },
  hin: { checked: (s, d) => `${s} के विरुद्ध जाँचा गया, ${d} तक।`, nothingFound: (d) => `मुझे जो मिला उसने इसे समर्थित नहीं किया; इसे असत्यापित मानें (${d} तक)।`, mismatch: (d, t) => `यह मुझे जो मिला उससे मेल नहीं खाता (${d} तक): ${t}` },
  swa: { checked: (s, d) => `Imehakikiwa dhidi ya ${s}, kufikia ${d}.`, nothingFound: (d) => `Hakuna nilichokiona kinachounga hili; chukulia kama kisichothibitishwa (kufikia ${d}).`, mismatch: (d, t) => `Hii hailingani na nilichokiona (kufikia ${d}): ${t}` },
};

export const FACT_LENSES = {
  eng: build("eng", {
    wh: [...ENG_WH], present: [...ENG_PRESENT], past: [...ENG_PAST], anchor: [...ENG_ANCHOR],
    articles: ["the"], of: ["of"],
    frame: ENG_FRAME,
    value: (d, f, v) => `As of ${d}, ${f} is ${v}.`,
    holderValue: (d, h, f) => `As of ${d}, ${h} is ${f}.`,
    unsourced: (d) => `I don't have a grounded source for this as of ${d}; my training data may be stale on this point.`,
    ordinal: /(\d+)(?:st|nd|rd|th)\b/i,
  }),
  spa: build("spa", {
    wh: ["quién", "quien", "qué", "que", "cuál", "cual"], present: ["es", "son", "está", "están", "tiene", "tienen"], past: ["era", "era", "fueron", "fue", "tuvo"],
    anchor: ["de", "en", "desde", "durante", "hasta", "por", "a", "con"],
    articles: ["el", "la", "los", "las"], of: ["de"],
    frame: (h, j) => { const base = `el ${h}`; return j ? `${base} de ${j}` : base; },
    value: (d, f, v) => `Desde el ${d}, ${f} es ${v}.`,
    holderValue: (d, h, f) => `Desde el ${d}, ${h} es ${f}.`,
    unsourced: (d) => `No tengo una fuente confirmada para esto al ${d}; mis datos de entrenamiento pueden estar desactualizados en este punto.`,
  }),
  fra: build("fra", {
    wh: ["qui", "que", "quel", "quelle", "quoi"], present: ["est", "sont", "a", "ont"], past: ["était", "étaient", "fut", "eut"],
    anchor: ["de", "des", "du", "en", "à", "depuis", "pendant", "jusqu'", "par", "pour", "avec"],
    articles: ["le", "la", "les", "l'"], of: ["de", "des", "du"],
    frame: (h, j) => { const a = /^[aeiouh]/i.test(h) ? "l'" : "le"; const base = `${a}${a === "l'" ? "" : " "}${h}`; return j ? `${base} de ${j}` : base; },
    value: (d, f, v) => `En date du ${d}, ${f} est ${v}.`,
    holderValue: (d, h, f) => `En date du ${d}, ${h} est ${f}.`,
    unsourced: (d) => `Je n'ai pas de source confirmée pour cela au ${d}; mes données d'entraînement peuvent être obsolètes sur ce point.`,
    ordinal: /(\d+)(?:er|e|ème|ieme)\b/i,
  }),
  deu: build("deu", {
    wh: ["wer", "was", "welcher", "welche", "welches", "wessen"], present: ["ist", "sind", "hat", "haben", "wird"], past: ["war", "waren", "hatte", "hatten", "würde"],
    anchor: ["von", "in", "an", "seit", "während", "bis", "durch", "mit", "zu", "für", "aus"],
    articles: ["der", "die", "das", "den", "dem"], of: ["von"],
    frame: (h, j) => { const base = `der ${h}`; return j ? `${base} von ${j}` : base; },
    value: (d, f, v) => `Seit dem ${d} ist ${f} ${v}.`,
    holderValue: (d, h, f) => `Seit dem ${d} ist ${h} ${f}.`,
    unsourced: (d) => `Dafür habe ich keine belegte Quelle (Stand ${d}); meine Trainingsdaten könnten hier veraltet sein.`,
    ordinal: /(\d+)(?:\.|ter|ste)\b/i,
    capsAreAnchor: false, // German capitalises every noun — orthography, not an anchor
  }),
  ita: build("ita", {
    wh: ["chi", "che", "quale", "quali"], present: ["è", "e'", "sono", "ha", "hanno"], past: ["era", "erano", "fu", "ebbe"],
    anchor: ["di", "in", "a", "da", "dal", "dalla", "dal", "durante", "fino", "con", "per"],
    articles: ["il", "lo", "la", "i", "gli", "le", "l'"], of: ["di", "del", "della", "dello", "dei", "degli", "delle"],
    frame: (h, j) => { const a = /^[aeiou]/i.test(h) ? "l'" : "il"; const base = `${a}${a === "l'" ? "" : " "}${h}`; return j ? `${base} di ${j}` : base; },
    value: (d, f, v) => `Dal ${d}, ${f} è ${v}.`,
    holderValue: (d, h, f) => `Dal ${d}, ${h} è ${f}.`,
    unsourced: (d) => `Non ho una fonte verificata per questo al ${d}; i miei dati di addestramento potrebbero essere obsoleti su questo punto.`,
  }),
  por: build("por", {
    wh: ["quem", "que", "qual", "quais"], present: ["é", "e'", "são", "tem", "têm"], past: ["era", "eram", "foi", "teve"],
    anchor: ["de", "em", "desde", "durante", "até", "por", "a", "com", "para"],
    articles: ["o", "a", "os", "as"], of: ["de", "do", "da", "dos", "das"],
    frame: (h, j) => { const base = `o ${h}`; return j ? `${base} de ${j}` : base; },
    value: (d, f, v) => `Desde ${d}, ${f} é ${v}.`,
    holderValue: (d, h, f) => `Desde ${d}, ${h} é ${f}.`,
    unsourced: (d) => `Não tenho uma fonte confirmada para isso em ${d}; meus dados de treinamento podem estar desatualizados neste ponto.`,
  }),
  rus: build("rus", {
    wh: ["кто", "что", "какой", "какая", "какие", "чей"], present: ["является", "есть", "стал", "стала", "составляет"], past: ["являлся", "являлась", "был", "была", "стал"],
    anchor: ["в", "на", "с", "по", "до", "после", "согласно", "для"],
    articles: [], of: [],
    frame: (h) => h,
    value: (d, f, v) => `По состоянию на ${d}, ${f} — это ${v}.`,
    holderValue: (d, h, f) => `По состоянию на ${d}, ${h} — это ${f}.`,
    unsourced: (d) => `У меня нет подтверждённого источника на ${d}; мои обучающие данные могут быть устаревшими.`,
  }),
  arb: build("arb", {
    wh: ["من", "ما", "أي"], present: ["هو", "هي", "يكون", "تكون", "يعد", "تعد"], past: ["كان", "كانت"],
    anchor: ["في", "على", "من", "إلى", "خلال", "حتى", "بعد"],
    articles: ["ال"], of: [],
    frame: (h) => `ال${h}`,
    value: (d, f, v) => `اعتبارًا من ${d}، ${f} هو ${v}.`,
    holderValue: (d, h, f) => `اعتبارًا من ${d}، ${h} هو ${f}.`,
    unsourced: (d) => `ليس لدي مصدر موثوق لهذا اعتبارًا من ${d}؛ قد تكون بيانات تدريبي قديمة.`,
  }),
  jpn: build("jpn", {
    wh: ["誰", "だれ", "何", "なに", "どの"], present: ["です", "である", "が"], past: ["でした", "だった"],
    anchor: ["の", "で", "に", "から", "まで"],
    articles: [], of: ["の"],
    frame: (h, j) => (j ? `${j}の${h}` : h),
    value: (d, f, v) => `${d}時点で、${f}は${v}です。`,
    holderValue: (d, h, f) => `${d}時点で、${h}は${f}です。`,
    unsourced: (d) => `${d}時点でこれを裏付ける情報源がありません。訓練データが古い可能性があります。`,
  }),
  hin: build("hin", {
    wh: ["कौन", "क्या", "किस"], present: ["है", "हैं", "हो"], past: ["था", "थी", "थे"],
    anchor: ["में", "पर", "से", "तक", "के"],
    articles: [], of: ["के"],
    frame: (h) => h,
    value: (d, f, v) => `${d} तक, ${f} ${v} है।`,
    holderValue: (d, h, f) => `${d} तक, ${h} ${f} है।`,
    unsourced: (d) => `${d} तक इसके लिए मेरे पास कोई पुष्ट स्रोत नहीं है; मेरा प्रशिक्षण डेटा पुराना हो सकता है।`,
  }),
  swa: build("swa", {
    wh: ["nani", "nini", "yupi", "ipi"], present: ["ni", "amekuwa", "ana"], past: ["alikuwa"],
    anchor: ["wa", "katika", "kwa", "mpaka", "tangu", "baada"],
    articles: [], of: ["wa"],
    frame: (h) => h,
    value: (d, f, v) => `Kuanzia ${d}, ${f} ni ${v}.`,
    holderValue: (d, h, f) => `Kuanzia ${d}, ${h} ni ${f}.`,
    unsourced: (d) => `Sina chanzo cha kuaminika kwa hili kufikia ${d}; data yangu ya mafunzo inaweza kuwa ya zamani.`,
  }),
};

export const DEFAULT_LENS = FACT_LENSES.eng;

/** The lens for a language code, or null — a language with no lens is read by no grammar. */
export const lensFor = (lang) => FACT_LENSES[lower(lang)] ?? null;

/**
 * The lens for an ask, detected from the ask's own grammar: the language is
 * the one whose WH-opener the ask's FIRST WORD is — exactly, or not at all.
 * "Québec est…" must not type as French because it starts with "que"; but a
 * no-space script has no first word, so a long first token probes the first
 * CHARACTER ("誰が大統領ですか？" opens with its wh-word). A question is a
 * question in the language it opens in; an opener no lens holds reads null.
 */
export function lensForAsk(ask) {
  const t = String(ask ?? "").trim();
  if (!t) return null;
  const strip = (w) => w.toLowerCase().replace(/^[¿¡«»'"“”‘’]+/u, "").replace(/[¿¡«»'"“”‘’,.?!:;]+$/u, "");
  const first = strip(t.split(/\s+/)[0]);
  for (const lens of Object.values(FACT_LENSES)) {
    if (lens.wh.has(first)) return lens;
  }
  if (first.length > 4) {
    const firstChar = strip([...t][0] ?? "");
    for (const lens of Object.values(FACT_LENSES)) {
      if (lens.wh.has(firstChar)) return lens;
    }
  }
  return null;
}