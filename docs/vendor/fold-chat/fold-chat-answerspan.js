// fold-chat-answerspan.js — the SMALLEST span that answers. Pure: no DOM, no IO, no model.
//
// The complaint (user, 2026-10-07): "the snipped answer to the question is more info than needed". Asked "what is the boiling point of
// ethanol", the Sources-only strand showed a generic FAQ block, not the one sentence that states it. The strand's unit is a GROUP of sentences
// scored by overlap with the question; this module's unit is the clause that carries the answer, with the subject it needs.
// The frame is the pevearVolokhonskyMethod: a MECHANICAL answer first (this file), a model only if that is not enough, then a MECHANICAL
// final pass (the named rewrite rules below). The model never appears here.
//
//   1. CLASSIFY the ask from the closed classes of the asker's language (wh-words, auxiliaries, measure words — DECLARED tables below, one per
//      language; a language with no table gets a typed gap, never a guess). What is wanted: figure, date, name, place, definition, list, reason, yes/no.
//   2. PICK the candidate sentence: the ask's content terms (the words left after the language's function words, from fold-chat-snippets.js
//      `functionWordsOf`, and the closed classes) matched by stem, weighted by how rare each is on the page, AND the expected answer type (a sentence
//      with a quantity in the right dimension for a "how tall / how hot" ask, a date for "when", a capitalised run for "who"). Questions, chrome,
//      menus, FAQ boilerplate (fold-chat-junk.js) and block pages never qualify.
//   3. TRIM to the minimal clause that carries the answer WITH the subject it needs ("Ethanol boils at 78.37 °C", never the figure alone):
//      clauses are cut at , ; : dashes and relative words, never inside a number, a name, a bracket or a quotation.
//   4. REWRITE, mechanically, by NAMED rules only (RULES below); every rule is deterministic, logged in `rewrite.rules`, and reversible to the
//      source bytes: `verifyRewrite(rewrite, passage)` re-derives the shipped text from the passage by those rules and rejects anything else.
//      A figure that is not in the source can never appear; no rule can invent a word the source does not hold (pronoun resolution copies the
//      antecedent's own bytes; the unit swap reorders two figures the sentence already states, checked by fold-chat-ground.js figureMatches).
//   5. Below the confidence threshold: a typed GAP ("no sentence in what was read states this"), never a guess.
//
// DECLARED, NOT MEASURED (Constitution II.11 — each with its giver: P2, 2026-10-07, tuned on the 30 DEV asks of eval/ants/p2/asks-dev.mjs only;
// the thresholds were pre-registered in eval/ants/P2-PREREG.md before the HELD asks were run): every number in SPAN, the wh/measure tables,
// the unit and month tables, the discourse markers and the pronoun list. A language not in ASK has no table (an honest gap, not a guess).

import { segments, fold, scriptOf, capitalisationIsSignificant, isUnspaced, casedRuns } from "./fold-chat-mind.js";
import { sentencesWithOffsets } from "./fold-chat-impression.js";
import { functionWordsOf } from "./fold-chat-snippets.js";
import { detectLang } from "./fold-chat-lang.js";
import { junkOf, wallOf } from "./fold-chat-junk.js";
import { maskNavRegion } from "./fold-chat-region.js";
import { figureMatches, figuresIn, stemOf } from "./fold-chat-ground.js";

export const SPAN = Object.freeze({
  minConfidence: 0.62,    // below this: a typed gap
  minCoverage: 0.6,       // weighted share of the ask's terms the sentence (or, for a given subject, the page) must carry
  maxPassages: 5,
  maxSpans: 2,            // spans handed back: the best, and the best from ANOTHER passage when it is nearly as good
  nearlyAsGood: 0.9,
  minWords: 4,            // a candidate sentence has at least this many words
  maxSentenceWords: 130,  // a longer run is a table or a wall (an encyclopedia's lead sentence can run to ~100 words)
  maxWords: 45,           // a span grown to carry its subject / predicate stays within this many words
  convParenMax: 48,       // a parenthesis right after the figure that restates it in another unit is kept when this short
  leadChars: 700,         // the page's lead: terms found here are the page's SUBJECT (given)
  faqBoost: 0.12,
  faqDirect: 0.75,        // a declared FAQ item whose QUESTION carries this share of the ask's terms answers it with its own first answer sentence         // a declared FAQ item whose question shares the ask's terms
  predWeight: 2,          // how much more a word of the ask that is NOT the page's subject (a predicate: born, weather, mascot) weighs in coverage than a subject word
  leadWeight: 0.12,       // prior: a sentence in the first leadSpread characters of a page is likelier to state its subject's facts
  leadSpread: 2500,
  minFit: 0.7,            // a figure whose dimension or noun does not fit the ask is no answer
});

const sq = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const isCased = (s) => capitalisationIsSignificant(/^[\x00-\u024f]*$/.test(s) ? "Latin" : scriptOf(s));

// ── 1. the ask, from the closed classes of its language ───────────────────────────────────────────────
// Each table is ordered (first match wins) and matched against the lower-cased, mark-stripped question (`fold`), except languages listed in RAW
// (Cyrillic and Han, where the marks ARE letters). `cue` words are measure words: they say WHICH quantity, not what it is about.
const DET_EN = "(?:the|a|an|this|that|these|those|his|her|their|its|our|your|my)";
const ASK = {
  en: {
    rules: [
      ["yesno", /^(?:is|are|was|were|do|does|did|can|could|will|would|has|have|had|should|shall|may|might)\b/],
      ["reason", /^why\b|\bhow come\b|\bwhat (?:is|was|were|are) the (?:reason|cause|purpose|point)\b|\bfor what reason\b/],
      ["date", /\bwhen\b|\bwhat (?:year|date|day|month|century|decade|time)\b|\bwhich (?:year|date|day|century)\b|\bin what year\b/],
      ["figure", /\bhow (?:tall|high|long|far|deep|wide|big|large|heavy|old|fast|hot|cold|much|many|often|thick|small|short|warm|expensive|cheap|massive|steep|strong)\b|\bwhat (?:is|are|was|were) the (?:height|length|depth|distance|speed|weight|population|temperature|boiling point|melting point|freezing point|area|size|number|price|cost|age|diameter|mass|width|altitude|elevation|radius|volume|capacity|density|rate|percentage|total|atomic number|atomic mass)\b|\bhow (?:does|do|did) \w+ (?:weigh|cost)\b|\bwhat percent/],
      ["place", /\bwhere\b|\bwhat (?:is|was) the capital\b|\b(?:what|which) (?:country|city|continent|state|region|town|island|ocean)\b/],
      ["list", /^(?:what|which) (?:are|were) (?:the|all|some|its|their)\b|\b(?:list|name) (?:the|all|some)\b|^which \w+ (?:are|were)\b/],
      ["name", /^who (?:is|was|are|were) (?:the|a|an|this|that|his|her)\b|\b(?:who|whom|whose)\b(?!\s+(?:is|was|are|were)\s+(?!the\b|a\b|an\b|this\b|that\b|his\b|her\b))/],
      ["definition", /^(?:what|who) (?:is|are|was|were) |\bwhat does .* mean\b|\bdefine\b|\bmeaning of\b|\bwhat (?:do|does) .* (?:stand for|refer to)\b/],
    ],
    wh: "what which who whom whose when where why how whether does do did is are was were can could will would has have had should shall may might tell me please explain give called named known",
    cues: {
      tall: ["len", ["height", "tall", "high", "altitude", "elevation"]], high: ["len", ["height", "tall", "high", "altitude", "elevation"]],
      long: ["lentime", ["length", "long", "takes", "duration"]], deep: ["len", ["depth", "deep"]], far: ["len", ["distance", "far", "away"]], away: ["len", ["distance", "far", "away"]],
      wide: ["len", ["width", "wide", "across"]], thick: ["len", ["thickness", "thick"]], big: ["size", ["size", "area", "large", "big", "diameter"]], large: ["size", ["size", "area", "large", "big"]],
      heavy: ["mass", ["weight", "weighs", "weigh", "mass", "heavy"]], weigh: ["mass", ["weight", "weighs", "weigh", "mass", "heavy"]], fast: ["speed", ["speed", "fast", "velocity"]],
      old: ["time", ["age", "old", "years"]], hot: ["temp", ["temperature", "hot", "heat"]], cold: ["temp", ["temperature", "cold"]], warm: ["temp", ["temperature", "warm"]],
      height: ["len", ["height", "tall", "high", "altitude", "elevation"]], length: ["len", ["length", "long", "spanning"]], depth: ["len", ["depth", "deep"]], distance: ["len", ["distance", "far", "away"]],
      width: ["len", ["width", "wide", "across"]], speed: ["speed", ["speed", "fast", "velocity"]], weight: ["mass", ["weight", "weighs", "weigh", "mass"]], mass: ["mass", ["weight", "weighs", "mass"]],
      temperature: ["temp", ["temperature"]], age: ["time", ["age", "old", "years"]], area: ["size", ["area", "size"]], size: ["size", ["size", "area", "large", "big"]],
      diameter: ["len", ["diameter", "across", "wide"]], radius: ["len", ["radius"]], altitude: ["len", ["altitude", "height", "elevation"]], elevation: ["len", ["elevation", "height", "altitude"]],
      price: ["money", ["price", "cost", "costs", "priced"]], cost: ["money", ["cost", "costs", "price", "priced"]], expensive: ["money", ["price", "cost", "costs"]], cheap: ["money", ["price", "cost", "costs"]],
      population: ["count", ["population", "inhabitants", "residents", "people"]], percentage: ["pct", ["percent", "percentage", "%"]], percent: ["pct", ["percent", "percentage", "%"]],
      number: ["count", ["number", "total"]], total: ["count", ["total", "number"]], many: ["count", []], much: ["any", []], often: ["any", []],
      boiling: ["temp", ["boils", "boiling", "boil"]], melting: ["temp", ["melts", "melting", "melt"]], freezing: ["temp", ["freezes", "freezing", "freeze"]], atomic: ["count", ["atomic", "number"]],
    },
    months: ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"],
    causal: ["because", "named after", "named for", "named in honor", "called after", "to prevent", "in order to", "so that", "due to", "as protection", "intention", "purpose", "reason", "caused", "result of", "since", "as a result", "so as to", "in response", "to protect", "to stop", "to keep", "aimed", "designed to", "meant to", "built to", "in order"],
    copula: ["is", "are", "was", "were", "refers", "means", "denotes"],
    life: { born: ["born", "birth", "birthday"], died: ["die", "died", "death", "dies"] },
    pron: { it: "n", its: "n:poss", this: "n", they: null, he: "m", she: "f", his: "m:poss", her: "f:poss" },
    markers: ["however", "in addition", "moreover", "furthermore", "additionally", "also", "meanwhile", "nevertheless", "nonetheless", "thus", "therefore", "consequently", "in fact", "indeed", "as a result", "for example", "for instance", "in particular", "overall", "finally", "similarly", "on the other hand", "in contrast"],
  },
  es: {
    rules: [
      ["yesno", /^(?:es|son|fue|fueron|era|eran|tiene|tienen|hay|puede|pueden|existe|ha|han|esta|estan)\b/],
      ["reason", /^por que\b|\bcual es (?:la|el) (?:razon|causa|motivo)\b/],
      ["date", /\bcuando\b|\ben que (?:ano|fecha|siglo)\b|\bque (?:ano|fecha|dia|siglo)\b/],
      ["figure", /\bcuant[oa]s?\b|\bque (?:altura|altitud|elevacion|longitud|profundidad|distancia|velocidad|peso|poblacion|temperatura|superficie|edad|tamano|diametro|masa|anchura)\b|\bcual es (?:la|el) (?:altura|longitud|profundidad|distancia|velocidad|peso|poblacion|temperatura|superficie|edad|tamano|diametro|masa|anchura|precio|numero)\b|\bque tan (?:alto|largo|profundo|lejos|grande)\b/],
      ["place", /\bdonde\b|\bcual es la capital\b|\bque (?:pais|ciudad)\b/],
      ["list", /^(?:cuales|que) (?:son|fueron) (?:los|las)\b/],
      ["name", /\b(?:quien|quienes)\b(?!\s+(?:es|fue|era|son)\s+(?!el\b|la\b|los\b|las\b|un\b|una\b))/],
      ["definition", /^(?:que|quien) (?:es|son|fue|eran?) |\bque significa\b/],
    ],
    wh: "que cual cuales quien quienes cuando donde por como cuanto cuanta cuantos cuantas es son fue fueron era eran tiene tienen hay puede pueden",
    cues: { altura: ["len", ["altura", "alto", "alta", "mide", "metros"]], altitud: ["len", ["altitud", "altura", "elevacion", "metros"]], elevacion: ["len", ["altitud", "altura", "elevacion"]], longitud: ["len", ["longitud", "largo", "larga", "mide"]], profundidad: ["len", ["profundidad", "profundo", "profunda"]], distancia: ["len", ["distancia", "lejos"]], velocidad: ["speed", ["velocidad"]], peso: ["mass", ["peso", "pesa"]], poblacion: ["count", ["poblacion", "habitantes"]], temperatura: ["temp", ["temperatura"]], edad: ["time", ["edad", "anos"]], superficie: ["size", ["superficie", "area"]], tamano: ["size", ["tamano"]], anchura: ["len", ["anchura", "ancho"]], cuantos: ["count", []], cuantas: ["count", []], cuanto: ["any", []], cuanta: ["any", []], alto: ["len", ["altura", "alto", "alta", "mide"]], largo: ["len", ["longitud", "largo", "mide"]] },
    months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    causal: ["porque", "para evitar", "para impedir", "a fin de", "con el fin de", "debido a", "ya que", "causa", "motivo", "razon", "con el objetivo", "para proteger", "para que"],
    copula: ["es", "son", "fue", "fueron", "era", "eran"],
    life: { born: ["nacio", "nacimiento", "nace"], died: ["murio", "muerte", "muere", "fallecio"] },
    pron: { el: "m", ella: "f", este: "m", esta: "f", su: "n:poss", sus: "n:poss" },
    markers: ["sin embargo", "ademas", "asimismo", "por otro lado", "no obstante", "por lo tanto", "ademas de esto", "en cambio", "por ejemplo"],
  },
  fr: {
    rules: [
      ["yesno", /^(?:est[- ]ce (?:que|qu)|est[- ]il|est[- ]elle|a[- ]t[- ]il|a[- ]t[- ]elle|y a[- ]t[- ]il)/],
      ["reason", /^pourquoi\b|\bquelle est la (?:raison|cause)\b/],
      ["date", /\bquand\b|\ben quelle annee\b|\bquelle (?:annee|date)\b|\bquel jour\b/],
      ["figure", /\bcombien\b|\bquelle est la (?:hauteur|longueur|profondeur|distance|vitesse|taille|superficie|population|temperature|masse|largeur|altitude)\b|\bquel est (?:le|l') ?(?:poids|age|prix|nombre|diametre)\b|\bquelle (?:hauteur|longueur|profondeur|distance|vitesse|taille|superficie|population|temperature|masse|largeur|altitude)\b/],
      ["place", /^ou\b|\bou (?:est|se|sont|se trouve)\b|\bquelle est la capitale\b|\bdans quel(?:le)? (?:pays|ville)\b/],
      ["list", /^(?:quels|quelles) (?:sont|etaient) (?:les|des)\b/],
      ["name", /\bqui\b(?!\s+(?:est|etait|sont)\s+(?!le\b|la\b|les\b|un\b|une\b))/],
      ["definition", /^qu.est[- ]ce (?:que|qu)|^c.est quoi|\bque signifie\b|^qui (?:est|etait) |^(?:que|qu) ?est /],
    ],
    wh: "que qu quel quelle quels quelles qui quoi quand ou pourquoi comment combien est sont etait ce il elle a",
    cues: { hauteur: ["len", ["hauteur", "haut", "haute", "mesure", "metres"]], longueur: ["len", ["longueur", "long", "longue", "mesure"]], profondeur: ["len", ["profondeur", "profond"]], distance: ["len", ["distance"]], vitesse: ["speed", ["vitesse"]], poids: ["mass", ["poids", "pese"]], population: ["count", ["population", "habitants"]], temperature: ["temp", ["temperature"]], age: ["time", ["age", "ans"]], superficie: ["size", ["superficie", "surface"]], taille: ["size", ["taille"]], largeur: ["len", ["largeur", "large"]], combien: ["count", []] },
    months: ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"],
    causal: ["parce que", "afin de", "pour empecher", "pour eviter", "en raison de", "car", "cause", "raison", "dans le but", "pour proteger", "pour que"],
    copula: ["est", "sont", "etait", "etaient", "designe", "signifie"],
    life: { born: ["ne", "nee", "naissance", "nait", "naquit"], died: ["mort", "morte", "mourut", "deces", "decede", "meurt"] },
    pron: { il: "m", elle: "f", ce: "n", son: "n:poss", sa: "n:poss", ses: "n:poss" },
    markers: ["cependant", "en outre", "de plus", "par ailleurs", "neanmoins", "toutefois", "ainsi", "donc", "en effet", "par exemple", "en revanche"],
  },
  ru: {
    raw: true,
    rules: [
      ["reason", /^(?:почему|зачем)|по какой причине/],
      ["date", /когда|в каком году|какого числа|в каком веке/],
      ["figure", /сколько|как(?:ая|ов[аоы]?|ой)\s+(?:высота|длина|глубина|площадь|скорость|масса|температура|ширина|протяж)|на какой высоте/],
      ["place", /где\b|в какой стране|в каком городе|как(?:ая|ов[аоы]?)\s+столица/],
      ["list", /какие .* (?:являются|были|есть)|перечисл/],
      ["definition", /что такое|что означает|кто такой|кто такая/],
      ["name", /\b(?:кто|кем|кого)\b/],
      ["yesno", /\bли\b/],
    ],
    wh: "что кто как какой какая какое какие какова каков когда где почему зачем сколько является был была были",
    cues: { высота: ["len", ["высота", "высотой", "высоту", "метров", "высок"]], длина: ["len", ["длина", "длиной", "протяженность", "протяженностью"]], глубина: ["len", ["глубина", "глубиной", "глубок"]], площадь: ["size", ["площадь", "площадью"]], скорость: ["speed", ["скорость", "скоростью"]], масса: ["mass", ["масса", "массой", "вес", "весит"]], температура: ["temp", ["температура"]], ширина: ["len", ["ширина", "шириной"]], сколько: ["any", []] },
    months: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
    causal: ["потому что", "чтобы", "для того чтобы", "из-за", "причина", "так как", "с целью", "для защиты"],
    copula: ["это", "является", "были", "было", "была"],
    pron: {},
    markers: ["однако", "кроме того", "тем не менее", "таким образом", "например", "также"],
  },
  zh: {
    raw: true,
    rules: [
      ["reason", /为什么|为何|原因/],
      ["date", /什么时候|哪一年|哪年|何时|几月|几号|哪天/],
      ["figure", /多少|多高|多长|多深|多远|多大|多重|多宽|多厚|多久/],
      ["place", /哪里|哪儿|在哪|哪个(?:国家|城市)|首都/],
      ["list", /哪些/],
      ["definition", /是什么|什么是|指什么/],
      ["name", /谁/],
      ["yesno", /是否|吗[？?]?$/],
    ],
    wh: "什么 哪 谁 多少 为什么 是 吗 的 了 在 有 多 几 怎么 如何",
    cues: { 高: ["len", ["高", "高度", "米"]], 长: ["len", ["长", "长度", "公里"]], 深: ["len", ["深", "深度"]], 远: ["len", ["距离", "远"]], 多少: ["any", []] },
    months: [],
    causal: ["因为", "为了", "由于", "目的", "原因", "以防止", "防止"],
    copula: ["是"],
    pron: {},
    markers: ["然而", "此外", "另外", "因此", "例如"],
  },
};
export const ASK_LANGS = Object.freeze(Object.keys(ASK));

// ── the declared tables the rewrite and the atoms use ─────────────────────────────────────────────────
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", deg: "°", times: "×", plusmn: "±", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", uuml: "ü", ouml: "ö", auml: "ä", ntilde: "ñ", aacute: "á", iacute: "í", oacute: "ó", uacute: "ú", acirc: "â", ecirc: "ê", ocirc: "ô" };
const UNIT_DIM = new Map();
const addUnits = (dim, ws) => { for (const w of ws) UNIT_DIM.set(fold(w), dim); };
addUnits("len", ["m", "km", "cm", "mm", "mi", "ft", "feet", "foot", "inch", "inches", "yd", "yards", "metre", "metres", "meter", "meters", "kilometre", "kilometres", "kilometer", "kilometers", "mile", "miles", "fathoms", "nmi", "light-years", "au", "metros", "kilometros", "millas", "pies", "metres", "kilometres", "pieds", "metres", "метр", "метра", "метров", "м", "км", "километр", "километра", "километров", "米", "公里", "千米", "厘米"]);
addUnits("mass", ["kg", "g", "mg", "lb", "lbs", "oz", "tonnes", "tonne", "tons", "ton", "pounds", "pound", "kilograms", "kilogram", "grams", "gram", "kilos", "kilogrammes", "tonnes", "т", "кг", "公斤", "吨", "千克"]);
addUnits("temp", ["°c", "°f", "k", "kelvin", "celsius", "fahrenheit", "°", "degrees", "grados", "degres", "градусов", "度", "℃", "°с"]);
addUnits("speed", ["km/h", "kph", "mph", "m/s", "knots", "km/s", "mach", "км/ч", "м/с", "км/с", "公里/小时"]);
addUnits("time", ["years", "year", "days", "months", "hours", "minutes", "seconds", "weeks", "decades", "centuries", "anos", "annees", "ans", "лет", "года", "岁", "年"]);
addUnits("pct", ["%", "percent", "per cent", "por ciento", "pour cent", "процентов", "процента"]);
addUnits("money", ["$", "€", "£", "¥", "usd", "eur", "gbp", "dollars", "euros", "pounds sterling", "yuan", "rupees", "₹", "долларов", "рублей", "元", "美元"]);
addUnits("vol", ["ml", "millilitre", "millilitres", "milliliter", "milliliters", "l", "litre", "litres", "liter", "liters", "gallon", "gallons", "pint", "pints", "tsp", "tbsp", "fl oz", "mililitros", "litros", "millilitres"]);
addUnits("size", ["km2", "m2", "sq", "hectares", "acres", "km²", "m²", "square", "ha", "кв"]);
const CANON = new Map();
for (const g of [["ft", "feet", "foot"], ["m", "metre", "metres", "meter", "meters"], ["km", "kilometre", "kilometres", "kilometer", "kilometers"], ["mi", "mile", "miles"], ["kg", "kilogram", "kilograms", "kilo", "kilos"], ["lb", "lbs", "pound", "pounds"], ["cm", "centimetre", "centimetres", "centimeter", "centimeters"], ["in", "inch", "inches"], ["°c", "celsius"], ["°f", "fahrenheit"], ["t", "tonne", "tonnes", "ton", "tons"]]) for (const w of g) CANON.set(fold(w), g[0]);
const canonUnit = (u) => CANON.get(fold(String(u ?? "").replace(/\s+/g, ""))) || fold(u);
const MULT = ["trillion", "billion", "million", "thousand", "hundred", "millones", "mil", "milliards", "millions", "миллион", "миллиона", "миллионов", "млн", "миллиард", "миллиарда", "млрд", "тыс", "万", "亿", "千"];
const NUM_SRC = String.raw`[+-]?(?:\d{1,3}(?:[,  ]\d{3}|\s\d{3}(?!\d))+|\d+)(?:[.,]\d+)?`;
const QTY_RE = new RegExp(String.raw`(?<![\p{N}.,\p{Script=Latin}\p{Script=Cyrillic}])(?:\$|€|£|¥|₹)?(${NUM_SRC})(?:\s?±\s?${NUM_SRC})?(?:\s?(?:–|-|to)\s?${NUM_SRC})?(?:\s?(${MULT.join("|")})\b)?(?:\s?(%|°\s?[CFcf]\b|℃|(?:(?:metric|short|square|cubic|nautical|imperial|sq)\s)?[\p{L}][\p{L}\p{N}/²³.-]*(?:\s+per\s+\p{L}+)?))?`, "gu");

// weaker cues (a measure verb or noun that often states the quantity without the ask's own word): they count 0.6 of a strong cue
const WEAK_CUES = { len: ["spanning", "stretch", "stretches", "extends", "measures", "measuring", "covers"], mass: ["tonnes", "tons"], temp: ["boils", "melts", "freezes"], time: ["aged"], count: ["total"], size: ["covers", "covering"], speed: ["travels"] };
const NAME_FW_EXTRA = new Set(["it", "its", "this", "that", "he", "she", "they", "his", "her", "their", "the", "a", "an", "in", "on", "at", "of", "for", "by", "from", "as", "while", "after", "before", "during", "since", "although", "however", "also", "one", "two", "some", "many", "most"]);

// ── tokens, terms ─────────────────────────────────────────────────────────────────────────────────────
const stripPoss = (t) => t.replace(/['’]s$/u, "").replace(/s['’]$/u, "s");
const stemKey = (t, lang) => {
  const w = stripPoss(t);
  if (/^\d/.test(w)) return w.replace(/[,.]/g, "");
  if (lang === "zh" || lang === "ja") return w;
  if (lang === "en") return stemOf(w);
  if (lang === "ru") return w.length >= 5 ? w.slice(0, 4) : w;
  return w.length >= 6 ? w.slice(0, 5) : w;
};
const SCRIPT_OF_LANG = { en: "Latin", es: "Latin", fr: "Latin", ru: "Cyrillic", zh: "Han" };
// An unspaced script (Han) is read as characters and overlapping character pairs: the segmenter of a small ICU build cuts Han text into single characters,
// so the pair is the smallest unit that can name a thing (the same choice as eval/snips/lib/text.mjs). Single characters are kept as tokens too, so a
// one-character measure word (高, 长, 深) is still a cue.
function hanTokens(text) {
  const out = []; const fw = functionWordsOf("zh") || new Set();
  for (const m of String(text).matchAll(/\p{Script=Han}+|[\p{L}\p{N}]+/gu)) {
    const run = m[0];
    if (!/\p{Script=Han}/u.test(run)) { const t = run.toLowerCase(); out.push({ t, k: t, raw: run, start: m.index, end: m.index + run.length }); continue; }
    const cs = [...run]; let off = m.index;
    const pos = []; for (const ch of cs) { pos.push(off); off += ch.length; }
    for (let i = 0; i < cs.length; i++) {
      if (!fw.has(cs[i])) out.push({ t: cs[i], k: cs[i], raw: cs[i], start: pos[i], end: pos[i] + cs[i].length, uni: true });
      if (i + 1 < cs.length) { const bg = cs[i] + cs[i + 1]; out.push({ t: bg, k: bg, raw: bg, start: pos[i], end: pos[i + 1] + cs[i + 1].length, bi: true, fwc: fw.has(cs[i]) || fw.has(cs[i + 1]) }); }
    }
  }
  return out;
}
const tokMemo = new Map();
const tokensOf = (text, lang) => {
  const key = lang + "\u0001" + text;
  const hit = tokMemo.get(key); if (hit) return hit;
  let out;
  if (lang === "zh") out = hanTokens(text);
  else {
    const script = SCRIPT_OF_LANG[lang] || scriptOf(text);
    out = segments(String(text ?? ""), script).map((x) => { const t = lang === "ru" ? x.text.toLowerCase() : fold(x.text); return { t, k: stemKey(t, lang), raw: x.text, start: x.start, end: x.end }; });
  }
  if (tokMemo.size > 6000) tokMemo.clear();
  tokMemo.set(key, out); return out;
};

/** The ask: what is wanted (from the closed classes of its language) and the content terms. Pure. `lang` is detected when not given. */
const askHay = (tab, q) => (tab.raw ? q.toLowerCase() : fold(q).replace(/[’']/g, "'"));
/** The language the ask is in. The detector reads a short question full of names badly ("When was Albert Einstein born?" reads as German), so the closed
 *  classes decide first: the detected language when its table recognises the ask, else the first table that does ("when was … born" is English by its own
 *  closed classes), else the detected language (no table: a typed gap). */
function askLangOf(q, given) {
  if (given) return given;
  const d = detectLang(q).lang;
  const recognised = (L) => ASK[L] && ASK[L].rules.some(([, re]) => re.test(askHay(ASK[L], q)));
  if (recognised(d)) return d;
  const other = ASK_LANGS.find(recognised);
  return other || d;
}

/** The ask: what is wanted (from the closed classes of its language) and the content terms. Pure. `lang` is detected when not given. */
export function classifyAsk(question, { lang = null } = {}) {
  // a source named in the ask ("… according to Britannica", "… as per the article") says where to look, not what it is about
  const q = sq(question).replace(/[,\s]+(?:according to|as per|per|as stated (?:by|in)|as reported (?:by|in)|from the|on the)\s+[^?]*?(?=\s*[?？]?\s*$)/i, (m, off, whole) => (/(?:according to|as per|as stated|as reported)/i.test(m) || /(?:article|page|website|site|encyclop\w*|wikipedia|britannica)/i.test(m) ? "" : m));
  const L = askLangOf(q, lang);
  const tab = ASK[L];
  if (!tab) return { supported: false, lang: L, want: null, why: [`no ask table for "${L}"`], terms: [], cues: [], dim: null };
  const hay = tab.raw ? q.toLowerCase() : fold(q).replace(/[’']/g, "'");
  let want = "other", why = [];
  for (const [w, re] of tab.rules) { const m = re.exec(hay); if (m) { want = w; why = [`ask:${w} (${sq(m[0]).slice(0, 30)})`]; break; } }
  const fw = functionWordsOf(L) || new Set();
  const wh = new Set(tab.wh.split(/\s+/).filter(Boolean).map((w) => (tab.raw ? w : fold(w))));
  const cues = []; let dim = null; const cueNouns = new Set(); const ownCue = new Set();
  const toks = tokensOf(q, L);
  const terms = [];
  const seen = new Set();
  const whChars = new Set([...tab.wh.split(/\s+/).join("")]);
  for (let ti = 0; ti < toks.length; ti++) {
    const x = toks[ti];
    if (L === "en" && x.t === "point" && /^(?:boiling|melting|freezing|flash|dew)$/.test(toks[ti - 1]?.t || "")) continue;        // "boiling point" is one measure word, not a subject and a head noun
    if (L === "zh") {
      const c = tab.cues[x.t]; if (c) { cues.push(x.t); if (!dim && c[0] !== "any") dim = c[0]; for (const n of c[1]) cueNouns.add(n); continue; }
      if (!x.bi || x.fwc || [...x.t].some((ch) => whChars.has(ch) || tab.cues[ch])) continue;
      if (!seen.has(x.k)) { seen.add(x.k); terms.push({ t: x.t, k: x.k }); }
      continue;
    }
    const c = tab.cues[x.t];
    if (c) { cues.push(x.t); ownCue.add(x.t); if (!dim && c[0] !== "any") dim = c[0]; for (const n of c[1]) cueNouns.add(tab.raw ? n : fold(n)); if (c[0] !== "any" || x.t === "much" || x.t === "many") continue; }
    if (fw.has(x.t) || fw.has(fold(x.t)) || wh.has(x.t) || NAME_FW_EXTRA.has(x.t)) continue;
    if (x.t.length < 2 && !/^\d/.test(x.t)) continue;
    if (UNIT_DIM.has(x.t) && x.t.length > 1) continue;                  // a unit the asker named ("in feet") says how to show the figure, not what it is about
    if (seen.has(x.k)) continue; seen.add(x.k);
    terms.push({ t: x.t, k: x.k });
  }
  if (want === "figure" && !dim) { if (/\bhow many\b|\bcuant[oa]s\b|\bcombien\b|сколько|多少/.test(hay)) dim = "count"; else dim = "any"; }
  // the unit the asker named ("in feet", "how many metres"): a word of the question that is a known unit; it says which dimension the figure is in
  const unit = toks.map((x) => x.t).find((t) => UNIT_DIM.has(t) && UNIT_DIM.get(t) !== "temp" && t.length > 1) || null;
  if (want === "figure" && unit && (dim === "count" || dim === "any")) dim = UNIT_DIM.get(unit);
  const weakCues = L === "en" ? (WEAK_CUES[dim] || []) : [];
  return { supported: true, lang: L, want, why, terms, cues, cueNouns: [...cueNouns], ownCue: [...ownCue], weakCues, dim, unit, tab };
}

// ── atoms: the thing that IS the answer inside a sentence ─────────────────────────────────────────────
const MONTH_SET = new Set(Object.values(ASK).flatMap((t) => t.months).map((m) => fold(m)));
const NOT_COUNT_NOUN = /^(?:and|the|was|were|that|with|from|which|while|when|where|also|into|than|then|over|more|only|such|each|both|some|many|most|have|will|they|their|this|these|those|ago|but|are|for|not|has|had|its|his|her|our|you|your|can|may|per|via|etc|about|among|between|after|before|during|since|until|under|above|below|inside|outside|within|without|because|although|though|however|whose|whom|here|there|lower|higher|larger|smaller|earlier|later|other|same|first|second|third|last|next|being|been|would|could|should|might|must|just|very|even|still|once|twice|already|approximately|roughly|nearly|almost|around|before|late|early|mid|century|centuries)$/i;
/** Quantities in a text: [{ start, end, text, v, dim, unit }]. dim is 'len'|'mass'|'temp'|'speed'|'time'|'pct'|'money'|'size'|'count' (a number with a multiplier word or a noun),
 *  or 'bare' (a number with nothing after it: only an answer to "how many"/"what number" when a word of the ask stands right before it).
 *  A bare four-digit year is not a quantity, and a number beside a month name is a date, not a quantity. */
export function quantitiesIn(text) {
  const out = []; const src = String(text ?? "");
  for (const m of src.matchAll(QTY_RE)) {
    let unit3 = m[3] || ""; let cut = 0;
    { const trimmed = unit3.replace(/[.\-]+$/, ""); cut += unit3.length - trimmed.length; unit3 = trimmed; }          // a sentence stop is not part of the unit
    if (/^\p{Script=Han}/u.test(unit3)) { const before = unit3.length; const cs = [...unit3]; let k = Math.min(3, cs.length); while (k > 0 && !UNIT_DIM.has(cs.slice(0, k).join(""))) k--; unit3 = k ? cs.slice(0, k).join("") : ""; cut += before - unit3.length; }
    const perM = /^(.*?)\s+per\s+(\p{L}+)$/u.exec(unit3);       // "metres per second", "dollars per hour"
    let perDim = null;
    if (perM) { const bd = UNIT_DIM.get(fold(perM[1])); perDim = bd === "len" && /^(?:second|hour|minute|s|h)$/i.test(perM[2]) ? "speed" : bd || null; unit3 = perM[1] + "/" + perM[2]; }
    const numTxt = m[1]; const mult = m[2] || null; const unitRaw = (unit3).replace(/^(?:metric|short|square|cubic|nautical|imperial|sq)\s/i, (mm) => (/^(?:square|sq)/i.test(mm) ? "sq" : "")).replace(/\s+/g, "");
    const start = m.index + (m[0].length - m[0].trimStart().length); const end = m.index + m[0].length - cut;
    const num = parseFloat(numTxt.replace(/[,\u202f\u00a0](?=\d{3})/g, "").replace(",", "."));
    let u = unitRaw ? fold(unitRaw) : "";
    if (MONTH_SET.has(u)) continue;                                                  // "7 January": a date
    let dim = u ? (UNIT_DIM.get(u) || UNIT_DIM.get(u.replace(/[.]$/, "")) || null) : null;
    if (perDim) dim = perDim;
    if (/^[$€£¥₹]/.test(m[0])) dim = "money";
    if (!dim && mult) dim = "count";
    const isYearish = /^\d{3,4}$/.test(numTxt) && num >= 1000 && num <= 2100;
    if (!dim && unitRaw && /^[\p{L}]{4,}$/u.test(unitRaw) && !NOT_COUNT_NOUN.test(unitRaw)) dim = "count";   // "9.0 million visitors", "115 moons"
    if (!dim && isYearish) continue;
    const prevWord = /(\p{L}+)\s*$/u.exec(src.slice(Math.max(0, start - 20), start));
    if (!dim && prevWord && MONTH_SET.has(fold(prevWord[1]))) continue;               // "October 28": a date
    if (!dim) dim = "bare";
    const tail = unitRaw && dim === "bare" ? 0 : 0; void tail;
    // a unit word that is really the next clause's first word is not part of the quantity
    let e2 = end, t2 = src.slice(start, end);
    if (dim === "bare" && unitRaw) { e2 = start + t2.length - m[3].length; t2 = src.slice(start, e2).trimEnd(); e2 = start + t2.length; }
    while (e2 > start && /[.\-]/.test(src[e2 - 1])) e2--;                                    // a sentence stop is not part of the unit
    out.push({ start, end: e2, text: src.slice(start, e2), v: num, dim, unit: u && dim !== "bare" ? u : null, noun: dim === "count" && unitRaw ? fold(unitRaw) : null });
  }
  return out;
}

const MONTH_RE_CACHE = new Map();
const monthRe = (months) => { const k = months.join("|"); if (!MONTH_RE_CACHE.has(k)) MONTH_RE_CACHE.set(k, monthReBuild(months)); const re = MONTH_RE_CACHE.get(k); if (re) re.lastIndex = 0; return re; };
const monthReBuild = (months) => (months.length ? new RegExp(String.raw`(?:\d{1,2}(?:st|nd|rd|th)?\s+)?(?:${months.join("|")})(?:\s+\d{1,2}(?:st|nd|rd|th)?(?![\d,.]\d))?(?:,?\s+\d{3,4}(?!\d))?`, "giu") : null);
/** Dates in a text (a day-month-year, a month-year, a year, a century): [{ start, end, text }]. */
export function datesIn(text, lang = "en") {
  const src = String(text ?? ""); const tab = ASK[lang] || ASK.en; const out = [];
  const mre = monthRe(tab.months);
  const taken = [];
  if (mre) for (const m of src.matchAll(mre)) {
    if (!/\d/.test(m[0])) {                                 // a bare month ("in June,") is a date; "the March on Washington" is not
      const before = src.slice(Math.max(0, m.index - 12), m.index).toLowerCase(), after = src.slice(m.index + m[0].length, m.index + m[0].length + 2);
      if (!(/\b(?:in|during|since|until|by|from|before|after|en|dans|depuis|jusqu'en|desde|hasta|в)\s+$/.test(before) && /^(?:[,.;:)]|\s*$)/.test(after))) continue;
    }
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] }); taken.push([m.index, m.index + m[0].length]);
  }
  for (const m of src.matchAll(/(?<![\p{L}\p{N}.,])(\d{3,4})(?:\s?(?:BC|AD|BCE|CE)\b)?(?:年(?:\d{1,2}月(?:\d{1,2}[日号])?)?)?(?![\p{N}]|[.,]\d)/gu)) {
    const a = m.index, b = m.index + m[0].length; const y = +m[1];
    if (taken.some(([s, e]) => a >= s && b <= e)) continue;
    if (!(/BC|AD|CE|年/.test(m[0]) || (y >= 1000 && y <= 2100))) continue;
    out.push({ start: a, end: b, text: m[0] });
  }
  for (const m of src.matchAll(/\b\d{1,2}(?:st|nd|rd|th)[- ](?:century)\b(?:\s?(?:BC|AD|BCE|CE)\b)?/gi)) out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  return out.sort((x, y) => x.start - y.start);
}

// ── clauses ─────────────────────────────────────────────────────────────────────────────────────────
const REL_RE = /\s(?=(?:which|whose|where|while|although|whereas|but|who)\s)/giu;
/** Clause ranges of a string, cut at , ; : dashes and relative words — never inside (), [], quotations, or a number. */
export function clausesOf(s) {
  const cuts = []; let depth = 0, inQ = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(" || ch === "[" || ch === "（" || ch === "「") depth++; else if (ch === ")" || ch === "]" || ch === "）" || ch === "」") depth = Math.max(0, depth - 1);
    else if (ch === '"' || ch === "“" || ch === "”") { if (ch === "“") inQ = true; else if (ch === "”") inQ = false; else inQ = !inQ; }
    if (depth || inQ) continue;
    if ((ch === "," || ch === ";" || ch === ":" || ch === "、" || ch === "，" || ch === "；") && (/\s/.test(s[i + 1] || " ") || /[、，；]/.test(ch))) cuts.push(i + 1);
    else if ((ch === "—" || ch === "–") && /\s/.test(s[i - 1] || "") && /\s/.test(s[i + 1] || "")) cuts.push(i + 1);
  }
  REL_RE.lastIndex = 0; let m;
  while ((m = REL_RE.exec(s)) !== null) { let d = 0, q = false; for (let i = 0; i < m.index; i++) { const c = s[i]; if (c === "(" || c === "[") d++; else if (c === ")" || c === "]") d = Math.max(0, d - 1); else if (c === '"') q = !q; } if (!d && !q) cuts.push(m.index); }
  const cs = [...new Set(cuts)].sort((a, b) => a - b); const out = []; let from = 0;
  for (const c of [...cs, s.length]) { if (c > from) { let a = from, b = c; while (a < b && /\s/.test(s[a])) a++; while (b > a && /\s/.test(s[b - 1])) b--; if (b > a) out.push({ start: a, end: b }); } from = c; }
  return out;
}

// ── 2/3. candidates and the span ────────────────────────────────────────────────────────────────────
const isQuestion = (s) => /[?？]\s*$/.test(s) || /^(?:\d+\.\s*)?(?:what|why|how|when|where|who|which|is|are|can|does|do)\b[^.!]{0,140}\?/i.test(s);

function titleOf(p) { const r = String(p?.ref ?? p?.title ?? ""); return r.includes(" — ") ? r.slice(r.indexOf(" — ") + 3) : r; }

/** Page-level index of one passage for this ask: sentences, term frequencies, the page's subject (given terms). */
function indexPassage(p, pi, ask) {
  const raw = String(p?.text ?? "");
  const text = maskNavRegion(raw).text;
  const lang = ask.lang;
  const cands = [];
  // a "sentence" that begins with a lowercase letter is the rest of the previous one (a split at "U.S. state", "e.g. the …"): joined when only a space lies between
  const ss = []; const LOWER = /^\p{Ll}/u; const casedScript = (t) => /^[\x00-\u024f\u0400-\u04ff]/.test(t);
  for (const x of sentencesWithOffsets(text)) {
    const prev = ss[ss.length - 1];
    if (prev && LOWER.test(x.text) && casedScript(x.text) && !/\n/.test(text.slice(prev.end, x.start)) && x.start - prev.end <= 2) { prev.end = x.end; prev.text = text.slice(prev.start, x.end); }
    else ss.push({ ...x });
  }
  for (const s of ss) cands.push({ ...s, src: "text", item: null });
  // the page's DECLARED FAQ/Q&A items: each ANSWER is cut into sentences (coordinates of the item string), the question kept for matching
  const blocks = Array.isArray(p?.declared) ? p.declared : [];
  blocks.forEach((b, bi) => (b.items || []).forEach((it, ii) => {
    const str = String(it); const cut = b.kind === "faq" || b.kind === "qa" ? str.indexOf(" — ") : -1;
    const ans = cut >= 0 ? str.slice(cut + 3) : str; const off = cut >= 0 ? cut + 3 : 0; const qn = cut >= 0 ? str.slice(0, cut) : "";
    for (const s of sentencesWithOffsets(ans)) cands.push({ text: s.text, start: s.start + off, end: s.end + off, src: "item", item: { block: bi, item: ii, kind: b.kind, str, q: qn } });
  }));
  // the page's SUBJECT ("given"): the words of its title. A page that carries no title is judged by its first sentence instead.
  const title = titleOf(p);
  const titleToks = new Set(tokensOf(title, lang).map((x) => x.k));
  const first = title.trim() && !/^(?:A:|B:|H:)/.test(title) ? "" : (cands.find((c) => c.src === "text")?.text || "");
  const leadToks = new Set(tokensOf(first, lang).map((x) => x.k));
  const sents = cands.map((c) => ({ ...c, toks: tokensOf(c.text, lang) }));
  const N = sents.length || 1; const df = new Map();
  for (const s of sents) for (const k of new Set(s.toks.map((x) => x.k))) df.set(k, (df.get(k) || 0) + 1);
  return { p, pi, text, raw, sents, N, df, titleKs: titleToks, given: new Set([...titleToks, ...leadToks]) };
}

const isCapRun = (s) => /^\p{Lu}/u.test(s);
const typeAtoms = (ask, text, toks) => {
  switch (ask.want) {
    case "figure": {
      const dates = datesIn(text, ask.lang);
      return quantitiesIn(text).filter((q) => !dates.some((d) => q.start >= d.start && q.end <= d.end));
    }
    case "date": return datesIn(text, ask.lang);
    case "name": case "place": {
      if (!isCased(text)) return [];
      const fw = functionWordsOf(ask.lang) || new Set();
      const askKs = new Set(ask.terms.map((t) => t.k));
      return casedRuns(text, scriptOf(text), { functionWords: fw }).filter((r) => {
        const ks = tokensOf(r.surface, ask.lang).filter((x) => !fw.has(x.t)).map((x) => x.k);
        if (ks.length && ks.every((k) => askKs.has(k))) return false;                 // the ask's own name is not its answer
        if (NAME_FW_EXTRA.has(fold(r.surface)) || MONTH_SET.has(fold(r.surface)) || /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(r.surface)) return false;
        return true;
      }).filter((r) => {
        const before = text.slice(Math.max(0, r.start - 16), r.start).toLowerCase();
        const locative = /\b(?:in|at|on|near|within|to|from|into|dans|en|cerca de|в|на)\s+(?:the\s+|el\s+|la\s+)?$/.test(before);
        return ask.want === "name" ? !locative : true;      // "who" is not answered by a place after "in"
      }).map((r) => ({ start: r.start, end: r.end, text: r.surface, words: r.surface.split(/\s+/).length }));
    }
    default: return [];
  }
};

/** How well a quantity fits the dimension the ask wants (0..1). A count must be named by a word of the ask or stand right after one. */
function figureFit(ask, a, toks, termKs, cueKs) {
  const d = ask.dim;
  if (a.dim === "bare") {
    if (d !== "count" && d !== "any") return 0;
    const near = toks.filter((x) => x.end <= a.start && a.start - x.end <= 24 && (termKs.has(x.k) || cueKs.has(x.k))).length;
    return near ? 0.9 : 0;
  }
  if (d === "any") return 0.7;
  if (d === "size") return a.dim === "size" ? 1 : a.dim === "len" ? 0.6 : 0;
  if (d === "count") {
    if (a.dim !== "count") return 0.0;
    if (a.noun && (termKs.has(stemKey(a.noun, ask.lang)) || cueKs.has(stemKey(a.noun, ask.lang)))) return 1;
    const near = toks.filter((x) => x.end <= a.start && a.start - x.end <= 24 && (termKs.has(x.k) || cueKs.has(x.k))).length;
    return near ? 0.9 : 0.35;
  }
  if (d === "len") return a.dim === "len" ? 1 : 0;
  if (d === "lentime") return a.dim === "len" || a.dim === "time" ? 1 : 0;
  return a.dim === d ? 1 : 0;
}

const causalHit = (ask, text) => { const h = fold(text); return ask.tab.causal.some((c) => h.includes(fold(c))); };
/** A definition: the sentence's own subject (the words before its first copula) holds a word of the ask. */
function definitionHead(ask, s, termKs) {
  const toks = s.toks.slice(0, 16); const i = toks.findIndex((x) => ask.tab.copula.includes(x.t));
  if (i >= 0 && toks.slice(0, i).some((x) => termKs.has(x.k))) return true;
  // "The greenhouse effect occurs when …": the sentence is ABOUT the asked thing when its words open it, whatever the verb
  const opening = new Set(s.toks.slice(0, 8).map((x) => x.k));
  return ask.terms.length > 0 && ask.terms.every((t) => opening.has(t.k));
}

const NEEDS_SUBJECT = new Set(["figure", "date", "name", "place"]);
/** The clause range [lo,hi] that carries `atom` (or the best clause for an ask with no atom) WITH the subject it needs. Offsets are sentence-relative. */
function spanFor(ask, ix, s, atom, ctx) {
  const st = s.text; const L = ask.lang; const toks = s.toks;
  const { termKs, cueKs, weakKs } = ctx;
  const why = [];
  const clauses = clausesOf(st);
  const tokensIn = (a, b) => toks.filter((x) => x.start >= a && x.end <= b);
  const hasTerm = (a, b) => tokensIn(a, b).some((x) => termKs.has(x.k));
  const hasCue = (a, b) => tokensIn(a, b).some((x) => cueKs.has(x.k));
  const sentenceHasTerm = toks.some((x) => termKs.has(x.k));
  const nonGiven = ask.terms.filter((t) => !ix.given.has(t.k)).map((t) => t.k);
  const need = (a, b) => (sentenceHasTerm ? hasTerm(a, b) : hasTerm(a, b) || hasCue(a, b));
  const words = (a, b) => tokensIn(a, b).length;
  let lo, hi;
  if (atom) {
    const ci = clauses.findIndex((c) => atom.start >= c.start && atom.end <= c.end);
    if (ci < 0) return { start: 0, end: st.length, atom, why: ["sentence"] };
    lo = hi = ci;
  } else if (ask.want === "definition" || words(0, st.length) <= 28) {
    return { start: 0, end: st.length, atom: null, why: ["sentence"] };
  } else {
    // no atom (reason / list / yes-no): the clause range that holds the most of the ask's words, and its cue (a causal word, a series)
    const wgt = (k) => 1 + Math.log(1 + ix.N / (1 + (ix.df.get(k) || 0)));
    const score = (a, b) => { const seen = new Set(); let w = 0; for (const x of tokensIn(a, b)) if (termKs.has(x.k) && !seen.has(x.k)) { seen.add(x.k); w += wgt(x.k); } return w; };
    const cueOk = (a, b) => (ask.want === "reason" ? causalHit(ask, st.slice(a, b)) : ask.want === "list" ? (st.slice(a, b).match(/[,、，]/g) || []).length >= 2 : true);
    let best = null;
    for (let a = 0; a < clauses.length; a++) for (let b = a; b < clauses.length; b++) {
      const A = clauses[a].start, B = clauses[b].end; if (!cueOk(A, B)) continue;
      const sc = score(A, B) - 0.02 * words(A, B);
      if (!best || sc > best.sc + 1e-9) best = { a, b, sc };
    }
    if (!best) return { start: 0, end: st.length, atom: null, why: ["sentence"] };
    lo = best.a; hi = best.b;
  }
  // the subject: add the nearest clause (either side) until the span holds a word of the ask
  for (let guard = 0; guard < 20 && !need(clauses[lo].start, clauses[hi].end) && (lo > 0 || hi < clauses.length - 1); guard++) {
    let bestJ = -1, bestD = Infinity;
    for (let j = 0; j < clauses.length; j++) { if (j >= lo && j <= hi) continue; if (need(clauses[j].start, clauses[j].end)) { const d = j < lo ? lo - j : j - hi; if (d < bestD) { bestD = d; bestJ = j; } } }
    if (bestJ < 0) break;
    if (bestJ < lo) lo = bestJ; else hi = bestJ;
    why.push("subject-clause");
  }
  // a word of the ask that is not the page's subject (a predicate: "designed", "born", "painted") must be in the span when the sentence has it
  const missingPred = () => { const inSpan = new Set(tokensIn(clauses[lo].start, clauses[hi].end).map((x) => x.k)); return nonGiven.filter((k) => toks.some((x) => x.k === k) && !inSpan.has(k)); };
  for (let guard = 0; guard < 6; guard++) {
    const miss = missingPred(); if (!miss.length) break;
    const k = miss[0]; let bestJ = -1, bestD = Infinity;
    for (let j = 0; j < clauses.length; j++) { if (j >= lo && j <= hi) continue; if (tokensIn(clauses[j].start, clauses[j].end).some((x) => x.k === k)) { const d = j < lo ? lo - j : j - hi; if (d < bestD) { bestD = d; bestJ = j; } } }
    if (bestJ < 0) break;
    const nlo = Math.min(lo, bestJ), nhi = Math.max(hi, bestJ);
    if (words(clauses[nlo].start, clauses[nhi].end) > SPAN.maxWords) break;
    lo = nlo; hi = nhi; why.push("predicate-clause");
  }
  // a clause that opens with a relative or connective word ("which …", "where …", "whose …") is not a statement without the clause it hangs on
  const REL_START = /^(?:which|whose|where|while|although|whereas|but|who)$/;
  for (let guard = 0; guard < 4 && lo > 0; guard++) { const f = toks.find((x) => x.start >= clauses[lo].start); if (f && REL_START.test(f.t)) { lo--; why.push("relative-head"); } else break; }
  // a place runs on through the locative clauses that follow ("born in Warsaw, Russian Empire", "Gujarat, India")
  if (ask.want === "place" && atom) {
    const lead = (c) => { const f = toks.find((x) => x.start >= c.start); return f && (isCapRun(st.slice(f.start, f.end)) || /^(?:in|near|on|at|of|from|within|along|by|dans|en|cerca|в|на)$/.test(f.t)); };
    while (hi < clauses.length - 1 && lead(clauses[hi + 1]) && words(clauses[lo].start, clauses[hi + 1].end) <= SPAN.maxWords && hi + 1 - lo <= 4) { hi++; why.push("locative-tail"); }
  }
  let start = clauses[lo].start, end = clauses[hi].end;
  // a figure / date statement ends where the figure does (plus its unit conversion in parentheses, plus a following word of the ask): a tail that starts a new phrase is dropped
  if (atom && (ask.want === "figure" || ask.want === "date") && hi === (clauses.findIndex((c) => atom.start >= c.start && atom.end <= c.end))) {
    let cut = atom.end;
    const paren = /^\s*\(([^()]{1,48})\)/.exec(st.slice(cut));
    if (paren && /\d/.test(paren[1]) && paren[0].length <= SPAN.convParenMax) cut += paren[0].length;
    // absorb the run of the ask's own words (and the function words between them) that follows the figure: "visitors in 2025", "Nobel Prize in Chemistry"
    const fw0 = functionWordsOf(L) || new Set();
    const tt = tokensIn(cut, end).slice(0, 9); let lastEnd = cut;
    for (let i = 0; i < tt.length; i++) { const x = tt[i]; if (termKs.has(x.k) || cueKs.has(x.k)) lastEnd = x.end; else if (!fw0.has(x.t)) break; }
    cut = Math.max(cut, lastEnd);
    const rest = st.slice(cut, end); const first = tokensIn(cut, end)[0]; const fw = functionWordsOf(L) || new Set();
    if (rest.trim() && (!first || fw.has(first.t)) && words(cut, end) >= 3) { end = cut; why.push("tail-cut"); }
  }
  // never end inside a quotation or an open bracket
  const open = () => { const t = st.slice(start, end); return (t.match(/["“”]/g) || []).length % 2 === 1 || (t.match(/[(\[]/g) || []).length !== (t.match(/[)\]]/g) || []).length; };
  if (open()) { end = clauses[hi].end; if (open()) { start = clauses[lo].start; if (open()) { start = 0; end = st.length; } } }
  // a span that starts at the sentence start and ends where the sentence does is the sentence
  const whole = start <= st.search(/\S/) && end >= st.replace(/\s+$/, "").length;
  return { start, end, atom, why: [...why, whole ? "sentence" : "clause-trim"] };
}

/** Score the span that would be shown. Returns null when it cannot answer. */
function scoreSpan(ask, ix, s, si, span, atomFit, ctx, atom = null) {
  const { termKs, cueKs, weakKs, predWeight } = ctx;
  const toks = s.toks.filter((x) => x.start >= span.start && x.end <= span.end);
  const ks = new Set(toks.map((x) => x.k));
  const wOf = (k) => 1 + Math.log(1 + ix.N / (1 + (ix.df.get(k) || 0)));
  let tot = 0, got = 0, inSpan = 0, predN = 0, predIn = 0; const hit = [];
  for (const t of ask.terms) {
    const given = ix.given.has(t.k);
    const w = wOf(t.k) * (given ? 1 : predWeight); tot += w;
    if (!given) predN++;
    if (ks.has(t.k)) { got += w; inSpan++; hit.push(t.t); if (!given) predIn++; }
    else if (given) got += 0.9 * w;                           // the page's own subject: said once, in its lead, for the whole page
  }
  const cueWanted = ask.cueNouns.length > 0;
  const ownKs = ctx.ownKs;
  const ownHit = cueWanted && toks.some((x) => ownKs.has(x.k));
  const cueHit = cueWanted && toks.some((x) => cueKs.has(x.k));
  const weakHit = cueWanted && !cueHit && toks.some((x) => weakKs.has(x.k));
  if (cueWanted) { const w = tot / Math.max(1, ask.terms.length); tot += w; if (ownHit) got += w; else if (cueHit) got += 0.8 * w; else if (weakHit) got += 0.6 * w; }
  const cov = tot ? got / tot : 0;
  if (!(inSpan > 0 || cueHit || weakHit)) return null;
  if (cov < SPAN.minCoverage) return null;
  const pos = s.src === "text" ? Math.max(0, 1 - s.start / SPAN.leadSpread) : 0.3;    // facts about the page's subject sit near its start
  const lead = SPAN.leadWeight * pos;
  const qtoks = s.src === "item" && s.item.q ? tokensOf(s.item.q, ask.lang) : [];
  const faqShare = qtoks.length ? ask.terms.filter((t) => qtoks.some((x) => x.k === t.k)).length / ask.terms.length : 0;
  const faq = SPAN.faqBoost * faqShare;
  const cueScore = cueWanted ? (ownHit ? 1 : cueHit ? 0.8 : weakHit ? 0.5 : 0) : 0.5;     // the asker's own measure word beats its synonym ("population" over "residents")
  // PROXIMITY: the predicate word (born, designed, painted) or the cue (tall, deep) governs the atom it stands next to, in words
  let prox = 0.5;
  if (atom) {
    const anchors = s.toks.filter((x) => x.start >= span.start && x.end <= span.end && ((termKs.has(x.k) && !ix.given.has(x.k)) || cueKs.has(x.k) || weakKs.has(x.k)));
    if (anchors.length) {
      const ai = s.toks.findIndex((x) => x.end > atom.start); const aj = s.toks.findIndex((x) => x.start >= atom.end);
      const at = (ai < 0 ? s.toks.length : ai), at2 = (aj < 0 ? s.toks.length : aj);
      const d = Math.min(...anchors.map((x) => { const i = s.toks.indexOf(x); return i < at ? at - i : i >= at2 ? i - at2 + 1 : 0; }));
      prox = 1 / (1 + d / 8);
    } else prox = 0.2;
  }
  const titleShare = ask.terms.length ? ask.terms.filter((t) => ix.titleKs.has(t.k)).length / ask.terms.length : 0;   // the page says it is ABOUT what was asked
  // a year in the page's title that the ask does not name marks an instance of a recurring thing ("Mount Everest in 2018", "2025 NBA Finals"): a narrower page than the ask
  const yearInTitle = [...ix.titleKs].some((k) => /^\d{4}$/.test(k) && !ask.terms.some((t) => t.k === k));
  const narrow = yearInTitle ? -0.08 : 0;
  const rank = 0.02 / (1 + ix.pi);                                                                                   // the search's own order breaks ties
  const score = 0.4 * cov + 0.2 * atomFit + 0.13 * cueScore + 0.08 * (predN ? predIn / predN : 0.5) + 0.1 * prox + 0.1 * titleShare + narrow + rank + lead + faq;
  return { score, cov, typeFit: atomFit, cueHit, inSpan, hit, why: [`terms:${hit.join("+") || "(given)"}`, `coverage:${cov.toFixed(2)}`, ...(cueHit ? ["cue"] : weakHit ? ["weak-cue"] : []), `type:${ask.want}${ask.dim && ask.want === "figure" ? "/" + ask.dim : ""}=${atomFit.toFixed(1)}`, ...(pos > 0.5 && s.src === "text" ? ["lead"] : []), ...(faq ? ["faq-question-match"] : [])] };
}

/** All answer candidates of one passage: [{ s, si, span, sc }]. */
function candidatesOf(ask, ix, predWeight = SPAN.predWeight) {
  const termKs = new Set(ask.terms.map((t) => t.k)), cueKs = new Set(ask.cueNouns.map((c) => stemKey(c, ask.lang)));
  const weakKs = new Set((ask.weakCues || []).map((c) => stemKey(c, ask.lang)));
  const ownKs = new Set((ask.ownCue || []).map((c) => stemKey(c, ask.lang)));
  const ctx = { termKs, cueKs, weakKs, ownKs, predWeight };
  const out = [];
  // A declared FAQ item whose QUESTION carries the ask's terms answers it with its own first answer sentence (a bare Yes./No. takes the next one too):
  // the page's author already paired the question with its answer.
  const byItem = new Map();
  ix.sents.forEach((s, si) => { if (s.src === "item") { const key = s.item.block + ":" + s.item.item; if (!byItem.has(key)) byItem.set(key, []); byItem.get(key).push({ s, si }); } });
  for (const arr of byItem.values()) {
    const it = arr[0].s.item; if (!it.q) continue;
    const qt = tokensOf(it.q, ask.lang);
    const share = ask.terms.filter((t) => qt.some((x) => x.k === t.k)).length / ask.terms.length;
    if (share < SPAN.faqDirect) continue;
    const first = arr[0].s; let last = first;
    if (first.toks.length <= 3 && arr[1]) last = arr[1].s;
    const text = it.str.slice(first.start, last.end);
    if (isQuestion(text) || text.length < 2) continue;
    const syn = { text, start: first.start, end: last.end, src: "item", item: it, toks: tokensOf(text, ask.lang) };
    let atomFit = 0.5;
    if (NEEDS_SUBJECT.has(ask.want)) { let at = typeAtoms(ask, text, syn.toks); if (ask.want === "figure") at = at.map((a) => ({ ...a, fit: figureFit(ask, a, syn.toks, termKs, cueKs) })).filter((a) => a.fit >= SPAN.minFit); if (at.length) atomFit = 1; }
    const span = { start: 0, end: text.length, atom: null, why: ["faq-answer", "sentence"] };
    const score = 0.55 + 0.35 * share + 0.05 * (atomFit === 1 ? 1 : 0) + 0.02 / (1 + ix.pi);
    out.push({ s: syn, si: arr[0].si, span, sc: { score, cov: share, typeFit: atomFit, cueHit: false, inSpan: 0, hit: [], why: [`faq-question:${share.toFixed(2)}`, "faq-answer"] } });
  }
  // A BIOGRAPHICAL LEAD: "Name (14 March 1879 – 18 April 1955) was …". Its first parenthesis holds the birth date and the death date, in that order — the
  // encyclopedic convention, not a guess — so "when was X born / did X die", asked of a page titled X, is answered by that parenthesis.
  if (ask.want === "date" && ask.tab.life && ix.titleKs.size) {
    const lifeK = (ws) => ws.map((w) => stemKey(w, ask.lang));
    const bornK = lifeK(ask.tab.life.born), diedK = lifeK(ask.tab.life.died);
    const wantBorn = ask.terms.some((t) => bornK.includes(t.k)), wantDied = ask.terms.some((t) => diedK.includes(t.k));
    const first = ix.sents.findIndex((x) => x.src === "text");
    const s0 = first >= 0 ? ix.sents[first] : null;
    if (s0 && (wantBorn !== wantDied) && ask.terms.filter((t) => ix.titleKs.has(t.k)).length >= Math.min(2, ix.titleKs.size)) {
      const pm = /\(([^()]{0,160}?)\)/.exec(s0.text.slice(0, 220));
      if (pm) {
        const ds = datesIn(pm[1], ask.lang);
        const d = wantBorn ? ds[0] : ds[1];
        if (d && ds.length >= (wantDied ? 2 : 1)) {
          const a = pm.index + 1 + d.start, b = pm.index + 1 + d.end;
          const span = { start: 0, end: pm.index + pm[0].length, atom: { start: a, end: b, text: d.text }, why: ["biographical-lead", "clause-trim"] };
          out.push({ s: s0, si: first, span, sc: { score: 0.99 + 0.02 / (1 + ix.pi), cov: 1, typeFit: 1, cueHit: false, inSpan: 0, hit: [], why: [`life:${wantBorn ? "born" : "died"}`, "biographical-lead"] } });
        }
      }
    }
  }
  ix.sents.forEach((s, si) => {
    const words = s.toks.length; const unspaced = ask.lang === "zh";
    if (words < (unspaced ? 4 : SPAN.minWords) || (unspaced ? s.text.length > 320 : words > SPAN.maxSentenceWords)) return;
    const st = s.text;
    if (isQuestion(st) || /^={2,}/.test(st)) return;
    // the chrome gate judges what would be SHOWN (the span), exactly as the strand's own gate judges a snip: a sentence whose unrelated tail is a list of names is not
    // chrome, and a menu line with the figure in it is (its clause is the whole line)
    const spanJunk = new Map();
    const isJunkSpan = (span) => { const t = st.slice(span.start, span.end); if (!spanJunk.has(t)) { const j = junkOf(t, { declared: s.src === "item" }); spanJunk.set(t, !!(j.leading || j.dominated || j.markup)); } return spanJunk.get(t); };
    if (NEEDS_SUBJECT.has(ask.want)) {
      let atoms = typeAtoms(ask, st, s.toks);
      if (ask.want === "figure") atoms = atoms.map((a) => ({ ...a, fit: figureFit(ask, a, s.toks, termKs, cueKs) })).filter((a) => a.fit > 0);
      else atoms = atoms.map((a) => ({ ...a, fit: 1 }));
      if (ask.want === "figure") atoms = atoms.filter((a) => a.fit >= SPAN.minFit);
      // a figure inside a parenthesis that directly follows another figure is that figure in another unit "330 metres (1,083 ft)": not a second answer
      if (ask.want === "figure") atoms = atoms.filter((a, i) => !atoms.some((b, j) => j !== i && b.end <= a.start && /^\s*\(\s*$/.test(st.slice(b.end, a.start))));
      for (const atom of atoms.slice(0, 8)) {
        const span = spanFor(ask, ix, s, atom, ctx);
        let fit = atom.fit;
        if (ask.want === "place") { const around = st.slice(Math.max(0, atom.start - 30), atom.start).toLowerCase(); if (!/\b(?:in|at|near|on|from|of|located|capital|city|en|dans|cerca|в|на)\s*$/.test(around) && !/capital|located|born|city/.test(st.toLowerCase())) fit = 0.6; }
        const sc = scoreSpan(ask, ix, s, si, span, fit, ctx, atom);
        if (sc && !isJunkSpan(span)) out.push({ s, si, span, sc });
      }
      // among the atoms of one sentence the best-scoring span wins; ties go to the one nearest a word of the ask (the earlier)
      return;
    }
    let fit = 0;
    if (ask.want === "definition") fit = definitionHead(ask, s, termKs) ? 1 : 0;
    else if (ask.want === "reason") fit = causalHit(ask, st) ? 1 : 0;
    else if (ask.want === "list") fit = (st.match(/[,、，]/g) || []).length >= 2 ? 1 : 0;
    else if (ask.want === "yesno") fit = s.toks.filter((x) => termKs.has(x.k)).length >= Math.min(2, ask.terms.length) ? 1 : 0;
    else fit = 0.5;
    if (!fit) return;
    const span = spanFor(ask, ix, s, null, ctx);
    const sc = scoreSpan(ask, ix, s, si, span, fit, ctx);
    if (sc && !isJunkSpan(span)) out.push({ s, si, span, sc });
  });
  return out;
}

// ── 4. the mechanical rewrite layer ────────────────────────────────────────────────────────────────────
const PRON_NOT_HEAD = /^(?:it|its|he|she|his|her|this|el|ella|il|elle|su)\b/i;
/** The subject noun phrase of a sentence: from its start to the first comma, parenthesis, semicolon or copula. null when it is not a clean one. */
function subjectNP(sentence, lang) {
  const tab = ASK[lang] || ASK.en; const s = sentence;
  const toks = tokensOf(s, lang);
  if (!toks.length) return null;
  const fw = functionWordsOf(lang) || new Set();
  const DET = new Set(["the", "a", "an", "el", "la", "los", "las", "un", "una", "le", "les", "une", "des", "l"]);
  // a sentence that opens with a preposition / conjunction / adverbial ("At any given point in time,") has no clean subject at its start
  if (fw.has(toks[0].t) && !DET.has(toks[0].t)) return null;
  let end = s.length;
  const stopAt = [s.search(/[,;(\[]/), ...toks.filter((x) => tab.copula.includes(x.t) || ["has", "have", "had", "became", "ha", "tiene", "a"].includes(x.t)).map((x) => x.start)].filter((i) => i > 0);
  if (stopAt.length) end = Math.min(...stopAt);
  const np = s.slice(0, end).replace(/[\s,;:]+$/, "");
  const ntoks = tokensOf(np, lang);
  if (!np || ntoks.length < 1 || ntoks.length > 6) return null;
  if (PRON_NOT_HEAD.test(np)) return null;
  const content = ntoks.filter((x) => !fw.has(x.t) && !NAME_FW_EXTRA.has(x.t));
  if (!content.length) return null;
  return { text: np, start: 0, end: np.length };
}

const cap1 = (s) => s.replace(/^(\s*)(\p{Ll})/u, (_, a, b) => a + b.toUpperCase());

export const RULES = Object.freeze({
  "decode-entities": { doc: "&name; / &#n; entities of the page's own markup become the characters they stand for (declared table)", apply: (t) => t.replace(/&#x([0-9a-f]+);/gi, (m, h) => safeCP(parseInt(h, 16), m)).replace(/&#(\d+);/g, (m, d) => safeCP(+d, m)).replace(/&([a-z]+);/gi, (m, n) => (ENTITIES[n.toLowerCase()] ?? m)) },
  "strip-citation": { doc: "bracketed citation marks ([1], [a], [citation needed], [note 2]) are removed", apply: (t) => t.replace(/\s?\[(?:\d{1,3}|[a-z]|citation needed|note \d{1,2}|who\?|when\?|where\?|clarification needed|better source needed)\]/gi, "") },
  "strip-aside": { doc: "a parenthetical aside with no figure and none of the ask's words (a pronunciation, a variant name) is removed", apply: (t, p) => stripAside(t, p.keep || []) },
  "drop-marker": { doc: "a leading discourse marker (However, In addition, …) is removed", apply: (t, p, ctx) => dropMarker(t, p.lang || "en") },
  "resolve-pronoun": { doc: "a leading pronoun becomes the previous sentence's subject noun phrase, copied from the page", apply: (t, p, ctx) => resolvePronoun(t, p, ctx) },
  "attribute-quote": { doc: "a quoted sentence with its attribution becomes 'According to X, …' (the attribution is kept)", apply: (t) => attributeQuote(t) },
  "unit-swap": { doc: "a figure the sentence already states in the asker's unit is shown first: '330 metres (1,083 ft)' -> '1,083 ft (330 metres)' (both figures are the sentence's own, checked as the same quantity)", apply: (t, p) => unitSwap(t, p.unit) },
  "tidy-space": { doc: "a space before , . ; : ) and after ( is removed", apply: (t) => t.replace(/\s+([,.;:!?)])/g, "$1").replace(/\(\s+/g, "(").replace(/\s{2,}/g, " ").trim() },
  "capitalise": { doc: "the first letter of the shown text is capitalised (scripts with case only)", apply: (t) => cap1(t) },
  "terminal-stop": { doc: "a terminal full stop is added when the shown text ends without one", apply: (t, p) => (/[.!?。！？…]["'”’)\]」]*$/u.test(t.trim()) ? t : t.replace(/[\s,;:—–-]+$/u, "") + (p.mark || ".")) },
});
const safeCP = (n, fallback) => { try { return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : fallback; } catch { return fallback; } };
const RULE_ORDER = ["decode-entities", "strip-citation", "strip-aside", "drop-marker", "resolve-pronoun", "attribute-quote", "unit-swap", "tidy-space", "capitalise", "terminal-stop"];

function stripAside(t, keep) {
  const kf = keep.map((k) => fold(k));
  return t.replace(/\s?\(([^()]{1,80})\)/g, (m, inner) => {
    if (/\d/.test(inner) || inner.includes(",")) return m;                                // a figure or a series is content, a pronunciation is not
    const f = fold(inner); if (kf.some((k) => k && f.includes(k))) return m;
    return "";
  }).replace(/\s?\[([^\[\]]{1,40})\]/g, (m, inner) => (/[^\x00-\x7f]/.test(inner) && !/\d/.test(inner) ? "" : m));
}
function dropMarker(t, lang) {
  const tab = ASK[lang] || ASK.en; const f = fold(t);
  for (const mk of [...tab.markers].sort((a, b) => b.length - a.length)) {
    const mf = fold(mk);
    if (f.startsWith(mf) && /^[,\s]/.test(f.slice(mf.length)) && f.slice(mf.length).trimStart().length) {
      const rest = t.slice(mk.length).replace(/^[,\s]+/, "");
      return rest;
    }
  }
  return t;
}
function resolvePronoun(t, p, ctx) {
  if (!p || !Array.isArray(p.antecedent) || !ctx || typeof ctx.passage !== "string") return t;
  const [a, b] = p.antecedent; const np = ctx.passage.slice(a, b);
  const tab = ASK[p.lang || "en"] || ASK.en;
  const m = /^(\p{L}+)(?![\p{L}'’])/u.exec(t); if (!m) return t;
  const kind = tab.pron[fold(m[1])]; if (!kind) return t;
  const rest = t.slice(m[1].length);
  if (/^[\p{L}]/u.test(np) === false) return t;
  const base = kind.endsWith(":poss") ? np.replace(/[\s.]+$/, "") + (np.endsWith("s") ? "’" : "’s") : np;
  return cap1(base) + rest;
}
function attributeQuote(t) {
  // “Text,” said NAME.   |   NAME said, “Text”   |   NAME said that “Text”
  let m = /^["“]([^"”]{12,})[,.]?["”]\s*,?\s*(?:said|says|wrote|stated|told|according to)\s+([^.]{2,60}?)\.?$/u.exec(t);
  if (m) return `According to ${m[2].trim()}, ${m[1].replace(/[,.]$/, "").replace(/^(\p{Lu})(\p{Ll})/u, (x, a, b) => a + b)}`;
  m = /^(\p{Lu}[^,"“]{1,60}?)\s+(?:said|says|wrote|stated|told us)(?:\s+that)?,?\s+["“]([^"”]{12,})[,.]?["”]\.?$/u.exec(t);
  if (m) return `According to ${m[1].trim()}, ${m[2].replace(/[,.]$/, "")}`;
  return t;
}
function unitSwap(t, unit) {
  if (!unit) return t;
  const uf = fold(unit);
  // "A unitA (B unitB)" -> "B unitB (A unitA)" when unitB is the asker's unit and the two figures are the same quantity
  const re = new RegExp(String.raw`(${NUM_SRC})\s?([\p{L}°][\p{L}°/]*)\s?\(\s?(${NUM_SRC})\s?([\p{L}°][\p{L}°/]*)\s?\)`, "u");
  const m = re.exec(t); if (!m) return t;
  if (canonUnit(m[4]) !== canonUnit(uf) || canonUnit(m[2]) === canonUnit(uf)) return t;
  const a = figuresIn(`${m[1]} ${m[2]}`)[0], b = figuresIn(`${m[3]} ${m[4]}`)[0];
  if (!a || !b || !a.unit || !b.unit || !figureMatches(a, b) && !figureMatches(b, a)) return t;
  return t.slice(0, m.index) + `${m[3]} ${m[4]} (${m[1]} ${m[2]})` + t.slice(m.index + m[0].length);
}

/** Run the named rules over `source` (a verbatim passage slice). `plan` = [{ rule, ...params }]. Returns { text, rules } (only rules that changed it). */
function runRules(source, plan, ctx, registry = RULES) {
  let t = source; const rules = [];
  for (const step of plan) {
    const r = registry[step.rule]; if (!r) throw new Error("unknown rule " + step.rule);
    const next = r.apply(t, step, ctx);
    if (next !== t) { rules.push({ ...step, before: t.length, after: next.length }); t = next; }
  }
  return { text: t, rules };
}
const stepsOf = (rules) => rules.map(({ rule, before, after, ...p }) => ({ rule, ...p }));

/** Re-derive a rewrite from the passage by its named rules; ok only when the shipped text is byte-identical and nothing else was added.
 *  rewrite = { text, source:{start,end,item?}, rules:[{rule,…params}] }; passage = { text, declared? }. */
export function verifyRewrite(rewrite, passage, { registry = RULES } = {}) {
  const bad = (reason) => ({ ok: false, reason });
  if (!rewrite || typeof rewrite.text !== "string" || !rewrite.source || !passage) return bad("shape");
  const src = rewrite.source;
  let base;
  if (src.item) {
    const blocks = Array.isArray(passage.declared) ? passage.declared : []; const it = blocks[src.item.block]?.items?.[src.item.item];
    if (typeof it !== "string") return bad("no such declared item"); base = it.slice(src.start, src.end);
  } else {
    if (!Number.isInteger(src.start) || !Number.isInteger(src.end) || src.start < 0 || src.end > String(passage.text ?? "").length || src.end <= src.start) return bad("range");
    base = String(passage.text).slice(src.start, src.end);
  }
  const steps = Array.isArray(rewrite.rules) ? rewrite.rules : [];
  if (steps.length > 12) return bad("too many rules");
  for (const st of steps) if (!st || !Object.prototype.hasOwnProperty.call(registry, st.rule)) return bad("unnamed rule " + (st && st.rule));
  // rule order is fixed
  let last = -1; for (const st of steps) { const i = RULE_ORDER.indexOf(st.rule); if (i < 0) continue; if (i <= last) return bad("rule order"); last = i; }
  for (const st of steps) if (st.rule === "resolve-pronoun") { const a = st.antecedent; if (!Array.isArray(a) || !Number.isInteger(a[0]) || !Number.isInteger(a[1]) || a[0] < 0 || a[1] <= a[0] || a[1] > String(passage.text ?? "").length || (!src.item && a[1] > src.start)) return bad("antecedent"); }
  let out;
  try { out = runRules(base, stepsOf(steps), { passage: String(passage.text ?? "") }, registry); } catch (e) { return bad("rule error"); }
  if (out.text !== rewrite.text) return bad("does not re-derive");
  // every figure shown is a figure the source (or the antecedent) holds
  const heldText = String(passage.text ?? "") + " " + (Array.isArray(passage.declared) ? passage.declared.flatMap((b) => b.items || []).join(" ") : "");
  const held = new Set((heldText.match(/\d[\d,.]*/g) || []).map((x) => x.replace(/[,.]+$/, "").replace(/,/g, "")));
  for (const n of rewrite.text.match(/\d[\d,.]*/g) || []) if (!held.has(n.replace(/[,.]+$/, "").replace(/,/g, ""))) return bad("figure not in the source: " + n);
  return { ok: true, reason: "" };
}

/** Plan and apply the rules to a span. `prev` = the previous sentence's {text,start} (for a pronoun). */
function rewriteSpan(ask, ix, s, span, prevSent, ctxText) {
  const L = ask.lang;
  const base = s.text.slice(span.start, span.end);
  const plan = [{ rule: "decode-entities" }, { rule: "strip-citation" }, { rule: "strip-aside", keep: ask.terms.map((t) => t.t) }, { rule: "drop-marker", lang: L }];
  // a leading pronoun: only when the antecedent is the previous sentence's subject, it holds a word of the ask, and nothing else in that sentence competes
  const tab = ask.tab; const lead = /^(\p{L}+)/u.exec(base);
  let antecedent = null;
  if (lead && tab.pron[fold(lead[1])] && prevSent && s.src === "text") {
    const np = subjectNP(prevSent.text, L);
    if (np) {
      const kind = tab.pron[fold(lead[1])]; const npTok = tokensOf(np.text, L);
      const fwSet = functionWordsOf(L) || new Set(); const npContent = npTok.filter((x) => !fwSet.has(x.t));
      const holds = npTok.some((x) => ask.terms.some((t) => t.k === x.k)) || (npContent.length > 0 && npContent.every((x) => ix.given.has(x.k)));
      const gendered = (kind === "m" || kind === "f" || kind.startsWith("m:") || kind.startsWith("f:")) ? isCased(np.text) && /^\p{Lu}/u.test(np.text) : true;
      const rivals = (prevSent.text.slice(np.end).match(/\b(?:the|a|an)\s+\p{Lu}\p{L}+|\p{Lu}\p{L}+\s+\p{Lu}\p{L}+/gu) || []).length;
      if (holds && gendered && rivals === 0) antecedent = [prevSent.start + np.start, prevSent.start + np.end];
    }
  }
  if (antecedent) plan.push({ rule: "resolve-pronoun", antecedent, lang: L });
  plan.push({ rule: "attribute-quote" });
  if (ask.unit && ask.want === "figure") plan.push({ rule: "unit-swap", unit: ask.unit });
  plan.push({ rule: "tidy-space" }, { rule: "capitalise" }, { rule: "terminal-stop", mark: /[。！？]/.test(base) ? "。" : "." });
  // the pronoun's antecedent lives in `ctxText` (the passage text); the base slice is of the sentence
  const out = runRules(base, plan, { passage: ctxText });
  // a resolved pronoun that did not change the text means the rule did not apply (not a pronoun at the start after earlier rules): leave it out of the log
  return { text: out.text, rules: stepsOf(out.rules), source: s.src === "item" ? { start: s.start + span.start, end: s.start + span.end, item: { block: s.item.block, item: s.item.item } } : { start: s.start + span.start, end: s.start + span.end } };
}

// ── answerSpan ─────────────────────────────────────────────────────────────────────────────────────────
const GAP_TEXT = "no sentence in what was read states this";
/**
 * @param question string
 * @param passages [{ text, url?, ref?, declared?:[{kind,items}], status? }]
 * @param opts { lang?, minConfidence? }
 * @returns { ask, spans:[{ text, passageIndex, start, end, kind, why, confidence, atom, sentence, rewrite? , item? }], rewrite?, gap? }
 *   `spans[i].text` is VERBATIM (a substring of the passage text, or of the declared item, at [start,end)); `spans[i].rewrite` (and, for the
 *   best span, the top-level `rewrite`) is the mechanical final pass, verifiable by `verifyRewrite`. `gap` is set when nothing clears the threshold.
 */
export function answerSpan(question, passages, opts = {}) {
  const O = { ...SPAN, ...opts };
  const ask = classifyAsk(question, { lang: opts.lang || null });
  const publicAsk = { want: ask.want, lang: ask.lang, terms: (ask.terms || []).map((t) => t.t), dim: ask.dim || null, cues: ask.cues || [], why: ask.why };
  if (!ask.supported) return { ask: publicAsk, spans: [], gap: { kind: "language", reason: `no ask table for "${ask.lang}": the closed classes of that language are not declared, so no span is guessed`, text: GAP_TEXT } };
  if (!ask.terms.length) return { ask: publicAsk, spans: [], gap: { kind: "no-terms", reason: "the ask has no content word to find", text: GAP_TEXT } };
  const list = (Array.isArray(passages) ? passages : []).slice(0, O.maxPassages);
  const found = []; const skipped = []; let dbg = null;
  list.forEach((p, pi) => {
    const text = String(p?.text ?? "");
    const hasDeclared = Array.isArray(p?.declared) && p.declared.length;
    if (!hasDeclared) { const w = wallOf({ status: p?.status || 0, title: p?.title || "", text }); if (w.blocked) { skipped.push({ passageIndex: pi, why: "blocked" }); return; } }
    if (!text.trim() && !hasDeclared) return;
    const ix = indexPassage(p, pi, ask);
    // every (sentence, atom) span that could answer is scored; the best of this passage is kept (ties: the earlier sentence)
    const best = candidatesOf(ask, ix, O.predWeight);
    if (opts.debug) for (const c of best) (dbg ||= []).push({ score: c.sc.score, pi, text: c.s.text.slice(c.span.start, c.span.end), sent: c.s.text, why: [...c.sc.why, ...c.span.why] });
    best.sort((a, b) => b.sc.score - a.sc.score || a.si - b.si || a.span.start - b.span.start);
    const top = best[0];
    if (!top) return;
    const span = top.span;
    // previous sentence (for a pronoun) = the sentence right before in the same source stream
    const same = ix.sents.filter((x) => x.src === top.s.src && (top.s.src === "text" || x.item === top.s.item));
    const k = same.indexOf(top.s); const prev = k > 0 ? same[k - 1] : null;
    const rw = rewriteSpan(ask, ix, top.s, span, prev, ix.raw);
    const verbatim = top.s.text.slice(span.start, span.end);
    const startAbs = top.s.start + span.start, endAbs = top.s.start + span.end;
    const shown = rw.text;
    const conf = Math.min(1, top.sc.score);
    const kind = top.s.src === "item" ? "list-item" : span.why.includes("sentence") ? "sentence" : "phrase";
    const why = [...ask.why, ...top.sc.why, ...span.why, ...(rw.rules.length ? ["rewrite:" + rw.rules.map((r) => r.rule).join(",")] : [])];
    found.push({
      text: verbatim, passageIndex: pi, start: startAbs, end: endAbs, kind, why, confidence: +conf.toFixed(3),
      atom: span.atom ? { text: span.atom.text, start: top.s.start + span.atom.start, end: top.s.start + span.atom.end } : null,
      sentence: { start: top.s.start, end: top.s.end, text: top.s.text },
      shown, rewrite: rw.rules.length || rw.text !== verbatim ? { text: rw.text, rules: rw.rules, source: rw.source } : null,
      ...(top.s.src === "item" ? { item: { block: top.s.item.block, item: top.s.item.item } } : {}),
    });
  });
  // AGREEMENT: how many OTHER passages' best spans carry the same atom (same figure in the same dimension, same date, same name): independent pages saying the same thing.
  // Reported, never used to rank; the wire may treat >= 1 as corroborated (not measured on this eval, whose distractor pages are mostly unrelated).
  const atomKey = (f) => { if (!f.atom) return null; const a = f.atom.text; const q = quantitiesIn(a)[0]; if (q) return "q:" + q.v + "|" + q.dim; return "t:" + fold(a).replace(/\s+/g, " "); };
  for (const f of found) { const k = atomKey(f); f.agreement = k ? found.filter((g) => g !== f && g.passageIndex !== f.passageIndex && atomKey(g) === k).length : 0; }
  found.sort((a, b) => b.confidence - a.confidence);
  const thr = opts.minConfidence ?? O.minConfidence;
  if (opts.debug && dbg) { dbg.sort((a, b) => b.score - a.score); }
  const ok = found.filter((f) => f.confidence >= thr);
  if (!ok.length) return { ask: publicAsk, debug: dbg, spans: [], gap: { kind: "no-span", reason: found.length ? `the closest sentence scored ${found[0].confidence} (< ${thr})` : "no sentence states this", text: GAP_TEXT, nearest: found[0] ? { passageIndex: found[0].passageIndex, confidence: found[0].confidence } : null }, skipped };
  const spans = [ok[0]];
  for (const f of ok.slice(1)) if (spans.length < O.maxSpans && f.passageIndex !== spans[0].passageIndex && f.confidence >= O.nearlyAsGood * ok[0].confidence && fold(f.shown) !== fold(spans[0].shown)) spans.push(f);
  return { ask: publicAsk, spans, rewrite: spans[0].rewrite || undefined, skipped, ...(opts.debug ? { debug: dbg } : {}) };
}

/** The text a reader sees by default for a result: the best span's rewritten words (or its verbatim words), nothing else. */
export const shownText = (r) => (r && r.spans && r.spans[0] ? r.spans[0].shown : "");

/** Minimality, by code: can any single clause be removed while the answer and the subject words stay? true = minimal. */
export function isMinimal(span, key, subjectWords = []) {
  const t = span.shown ?? span.text; const cs = clausesOf(t);
  if (cs.length < 2) return true;
  const kf = fold(key);
  for (let i = 0; i < cs.length; i++) {
    const rest = cs.filter((_, j) => j !== i).map((c) => t.slice(c.start, c.end)).join(" ");
    const f = fold(rest);
    if (f.includes(kf) && subjectWords.every((w) => f.includes(fold(w)))) return false;
  }
  return true;
}
