// holodeck-lang.js — THE SUMMARY IN ANY LANGUAGE, ZERO MODEL.
//
// The pipeline (the user's own framing): a proposition is the language-neutral
// GFP (Ground · Figure · Pattern — an end1 · label · end2 with its functional
// standing), already induced by holodeck-profile.js. THIS module is the render
// lens on the way back out: GFP → a language's SPECIFIC GRAMMAR (its basic
// word order, SVO/SOV/VSO, and how the copula binds) → that language's NATURAL
// LANGUAGE (its scaffolding words, its number forms).
//
// ZERO MODEL. Nothing here calls out. The content words — the relation labels
// and values the corpus itself asserted — pass through as the material's own
// words; the scaffolding is a declared per-language phrasebook (the same
// posture askshape-lens.multilingual.js takes: "a native speaker refines
// each"); the inflection comes from UniMorph-derived priors (morphology-eng
// for English, declension-rus for Russian), injected by the caller — a prior
// is data, not a model. A word the lens has no paradigm for passes through
// UNCHANGED and is marked, never fabricated.
//
// The word-order claim is falsifiable per language: the copula/verb's position
// relative to the end1 and the kind is asserted by order (SVO verb between,
// SOV verb last, VSO verb first) and tested in holodeck-lang.test.mjs.

// ── THE GRAMMAR REGISTER: basic word order, WALS-style, declared per language.
// `giver` names the basis; a reader who knows a language's order disagrees
// with a row may move it — this is declared evidence, never assumed.
const ORDER = Object.freeze({
  SVO: 'SVO', SOV: 'SOV', VSO: 'VSO', VOS: 'VOS',
});

export const LANGS = Object.freeze([
  { code: 'en',  autonym: 'English',          script: 'Latn', order: ORDER.SVO },
  { code: 'es',  autonym: 'Español',          script: 'Latn', order: ORDER.SVO },
  { code: 'fr',  autonym: 'Français',         script: 'Latn', order: ORDER.SVO },
  { code: 'de',  autonym: 'Deutsch',          script: 'Latn', order: ORDER.SVO },
  { code: 'ru',  autonym: 'Русский',          script: 'Cyrl', order: ORDER.SVO },
  { code: 'el',  autonym: 'Ελληνικά',         script: 'Grek', order: ORDER.SVO },
  { code: 'fi',  autonym: 'Suomi',            script: 'Latn', order: ORDER.SVO },
  { code: 'id',  autonym: 'Bahasa Indonesia', script: 'Latn', order: ORDER.SVO },
  { code: 'he',  autonym: 'עברית',            script: 'Hebr', order: ORDER.SVO },
  { code: 'zh',  autonym: '中文',              script: 'Hans', order: ORDER.SVO },
  { code: 'ar',  autonym: 'العربية',          script: 'Arab', order: ORDER.VSO },
  { code: 'ja',  autonym: '日本語',            script: 'Jpan', order: ORDER.SOV },
  { code: 'ko',  autonym: '한국어',            script: 'Kore', order: ORDER.SOV },
  { code: 'fa',  autonym: 'فارسی',            script: 'Arab', order: ORDER.SOV },
  { code: 'tr',  autonym: 'Türkçe',           script: 'Latn', order: ORDER.SOV },
  { code: 'la',  autonym: 'Latina',           script: 'Latn', order: ORDER.SOV },
  { code: 'grc', autonym: 'Ἑλληνική',         script: 'Grek', order: ORDER.SOV },
  { code: 'sa',  autonym: 'संस्कृतम्',        script: 'Deva', order: ORDER.SOV },
]);

/** languageOf(x) — a BCP-47 tag, an ISO-639-1/3 code, or an autonym → the
 *  registry code, or null (a typed gap: a language with no registered
 *  grammar is never silently read as English). */
export function languageOf(x) {
  const s = String(x ?? '').trim();
  if (!s) return null;
  const low = s.toLowerCase();
  const two = low.split(/[-_]/)[0];
  const three = LANGS.find((l) => l.code === two || l.autonym.toLowerCase() === low);
  return three ? three.code : null;
}

// ── THE PHRASEBOOK: scaffolding per language. `declared` — a render scaffold,
// the same posture as askshape-lens.multilingual.js ("a native speaker refines
// each"). Every entry is a function so a language's grammar — word order, its
// number forms — is expressed by the shape of the sentence it returns.
// `readAs(end1, kind)` is THE grammar carrier: SVO puts the copula between,
// SOV puts it last, VSO puts it first. `ruPlural`/`enPlural` are the language's
// own number systems, not a table lookup.
const ruPlural = (n, one, few, many) => {
  const m = n % 10, h = n % 100;
  return (h >= 11 && h <= 14) || m === 0 || (m >= 5 && m <= 9) ? many : (m === 1 ? one : few);
};

const PHRASES = Object.freeze({
  en: {
    about: 'What it is about', oneLine: 'one line', paragraph: 'paragraph', allCited: 'all, cited',
    readAs: (e, k) => `${e} is read as ${k}`, readAsNone: (e) => `${e} has no established kind`,
    key: 'key',
    propositions: (n) => n + ' proposition' + (n === 1 ? '' : 's'), parameters: (n) => n + ' parameter' + (n === 1 ? '' : 's'),
    eachCited: 'each cited to its source statements', citedIn: 'cited in',
    sourceStmt: (n) => n + ' source statement' + (n === 1 ? '' : 's'), stmtShort: (n) => n + ' stmt' + (n === 1 ? '' : 's'),
    more: (n) => '+' + n, inducedFrom: (n) => `its ${n} parameter${n === 1 ? '' : 's'} induced from the collection's own relations`,
  },
  es: {
    about: 'De qué trata', oneLine: 'una línea', paragraph: 'párrafo', allCited: 'todo, citado',
    readAs: (e, k) => `${e} se lee como ${k}`, readAsNone: (e) => `${e} no tiene una lectura establecida`,
    key: 'clave',
    propositions: (n) => `${n} proposicion${n === 1 ? '' : 'es'}`, parameters: (n) => `${n} parámetro${n === 1 ? '' : 's'}`,
    eachCited: 'cada una citada a sus fuentes', citedIn: 'citado en',
    sourceStmt: (n) => `${n} declaración de fuente${n === 1 ? '' : 's'}`, stmtShort: (n) => `${n} decl.`,
    more: (n) => '+' + n, inducedFrom: (n) => `sus ${n} parámetro${n === 1 ? '' : 's'} inducidos de las propias relaciones de la colección`,
  },
  fr: {
    about: "De quoi il s'agit", oneLine: 'une ligne', paragraph: 'paragraphe', allCited: 'tout, cité',
    readAs: (e, k) => `${e} est lu comme ${k}`, readAsNone: (e) => `${e} n'a pas de lecture établie`,
    key: 'clé',
    propositions: (n) => `${n} proposition${n === 1 ? '' : 's'}`, parameters: (n) => `${n} paramètre${n === 1 ? '' : 's'}`,
    eachCited: 'chacune citée à ses sources', citedIn: 'cité dans',
    sourceStmt: (n) => `${n} déclaration source${n === 1 ? '' : 's'}`, stmtShort: (n) => `${n} décl.`,
    more: (n) => '+' + n, inducedFrom: (n) => `ses ${n} paramètre${n === 1 ? '' : 's'} induits des propres relations de la collection`,
  },
  de: {
    about: 'Worum es geht', oneLine: 'eine Zeile', paragraph: 'Absatz', allCited: 'alles, zitiert',
    readAs: (e, k) => `${e} wird als ${k} gelesen`, readAsNone: (e) => `${e} hat keine etablierte Lesart`,
    key: 'Schlüssel',
    propositions: (n) => `${n} Aussage${n === 1 ? '' : 'n'}`, parameters: (n) => `${n} Parameter`,
    eachCited: 'jede mit ihren Quellen belegt', citedIn: 'zitiert in',
    sourceStmt: (n) => `${n} Quellenaussage${n === 1 ? '' : 'n'}`, stmtShort: (n) => `${n} Auss.`,
    more: (n) => '+' + n, inducedFrom: (n) => `seine ${n} Parameter, aus den eigenen Beziehungen der Sammlung induziert`,
  },
  ru: {
    about: 'О чём это', oneLine: 'одна строка', paragraph: 'абзац', allCited: 'всё, с источниками',
    readAs: (e, k) => `${e} читается как ${k}`, readAsNone: (e) => `${e} без установленного прочтения`,
    key: 'ключ',
    propositions: (n) => ruPlural(n, `${n} утверждение`, `${n} утверждения`, `${n} утверждений`),
    parameters: (n) => ruPlural(n, `${n} параметр`, `${n} параметра`, `${n} параметров`),
    eachCited: 'каждое со ссылкой на источники', citedIn: 'цитируется в',
    sourceStmt: (n) => ruPlural(n, `${n} исходное предложение`, `${n} исходных предложения`, `${n} исходных предложений`),
    stmtShort: (n) => `${n} предл.`,
    more: (n) => '+' + n, inducedFrom: (n) => ruPlural(n, `его ${n} параметр, выведенный из собственных связей коллекции`, `его ${n} параметра, выведенных из собственных связей коллекции`, `его ${n} параметров, выведенных из собственных связей коллекции`),
  },
  el: {
    about: 'Τι είναι περί αυτού', oneLine: 'μία γραμμή', paragraph: 'παράγραφος', allCited: 'όλα, με παραπομπές',
    readAs: (e, k) => `${e} διαβάζεται ως ${k}`, readAsNone: (e) => `${e} δεν έχει σταθερή ανάγνωση`,
    key: 'κλειδί',
    propositions: (n) => `${n} πρόταση${n === 1 ? '' : 'ς'}`, parameters: (n) => `${n} παράμετρο${n === 1 ? 'ς' : 'ι'}`,
    eachCited: 'κάθε μία με τις πηγές της', citedIn: 'αναφέρεται σε',
    sourceStmt: (n) => `${n} πηγαία πρόταση${n === 1 ? '' : 'ς'}`, stmtShort: (n) => `${n} προτ.`,
    more: (n) => '+' + n, inducedFrom: (n) => `οι ${n} παράμετροί του προέκυψαν από τις σχέσεις της ίδιας της συλλογής`,
  },
  fi: {
    about: 'Mistä tässä on kyse', oneLine: 'yksi rivi', paragraph: 'kappale', allCited: 'kaikki, lähtein',
    readAs: (e, k) => `${e} luetaan ${k}na`, readAsNone: (e) => `${e} ei ole vakiintunutta lukutapaa`,
    key: 'avain',
    propositions: (n) => `${n} väite${n === 1 ? '' : 'ttä'}`, parameters: (n) => `${n} parametri${n === 1 ? '' : 'a'}`,
    eachCited: 'jokainen lähteineen', citedIn: 'lähteessä',
    sourceStmt: (n) => `${n} lähdelause${n === 1 ? '' : 'tta'}`, stmtShort: (n) => `${n} lausetta`,
    more: (n) => '+' + n, inducedFrom: (n) => `sen ${n} parametria johdettu kokoelman omista suhteista`,
  },
  id: {
    about: 'Tentang apa ini', oneLine: 'satu baris', paragraph: 'paragraf', allCited: 'semua, dengan sumber',
    readAs: (e, k) => `${e} dibaca sebagai ${k}`, readAsNone: (e) => `${e} belum ada pembacaan yang mapan`,
    key: 'kunci',
    propositions: (n) => `${n} proposisi`, parameters: (n) => `${n} parameter`,
    eachCited: 'masing-masing dengan sumbernya', citedIn: 'dikutip dalam',
    sourceStmt: (n) => `${n} pernyataan sumber`, stmtShort: (n) => `${n} pernyataan`,
    more: (n) => '+' + n, inducedFrom: (n) => `${n} parameternya diinduksi dari relasi koleksi ini sendiri`,
  },
  he: {
    about: 'על מה זה', oneLine: 'שורה אחת', paragraph: 'פסקה', allCited: 'הכל, עם מקורות',
    readAs: (e, k) => `${e} נקרא כ־${k}`, readAsNone: (e) => `${e} אין לו קריאה מבוססת`,
    key: 'מפתח',
    propositions: (n) => `${n} טענה${n === 1 ? '' : 'ות'}`, parameters: (n) => `${n} פרמטר${n === 1 ? '' : 'ים'}`,
    eachCited: 'כל טענה עם מקורותיה', citedIn: 'מצוטט ב־',
    sourceStmt: (n) => `${n} משפט מקור${n === 1 ? '' : 'ות'}`, stmtShort: (n) => `${n} משפטים`,
    more: (n) => '+' + n, inducedFrom: (n) => `${n} פרמטרים שהוסקו מיחסי האוסף עצמו`,
  },
  zh: {
    about: '内容概要', oneLine: '一行', paragraph: '段落', allCited: '全部并注明出处',
    readAs: (e, k) => `${e} 被读作 ${k}`, readAsNone: (e) => `${e} 尚无确定的读法`,
    key: '关键',
    propositions: (n) => `${n} 条命题`, parameters: (n) => `${n} 个参数`,
    eachCited: '每条均注明来源', citedIn: '见',
    sourceStmt: (n) => `${n} 条来源陈述`, stmtShort: (n) => `${n} 条`,
    more: (n) => '+' + n, inducedFrom: (n) => `其 ${n} 个参数由本语料自身的关系统计得出`,
  },
  ar: {
    about: 'ماذا يدور حوله', oneLine: 'سطر واحد', paragraph: 'فقرة', allCited: 'الكل، مع المصادر',
    readAs: (e, k) => `يُقرأ ${e} بوصفه ${k}`, readAsNone: (e) => `${e} بلا قراءة مثبتة`,
    key: 'مفتاح',
    propositions: (n) => `${n} اقتراح${n === 1 ? '' : 'ات'}`, parameters: (n) => `${n} معلمة${n === 1 ? '' : 'ات'}`,
    eachCited: 'كل منها موثّقة بمصادرها', citedIn: 'مذكور في',
    sourceStmt: (n) => `${n} بيان مصدر${n === 1 ? '' : 'ات'}`, stmtShort: (n) => `${n} بيانات`,
    more: (n) => '+' + n, inducedFrom: (n) => `معلماتها الـ${n} المستنتجة من علاقات المجموعة نفسها`,
  },
  ja: {
    about: 'これは何か', oneLine: '一行', paragraph: '段落', allCited: '全て・出典付き',
    readAs: (e, k) => `${e} は ${k} として読まれる`, readAsNone: (e) => `${e} は読まれ方の確立なし`,
    key: '要',
    propositions: (n) => `${n} の命題`, parameters: (n) => `${n} のパラメータ`,
    eachCited: '各命題は出典つき', citedIn: '出典',
    sourceStmt: (n) => `${n} の出典文`, stmtShort: (n) => `${n} 文`,
    more: (n) => '+' + n, inducedFrom: (n) => `この ${n} のパラメータは本コレクション自身の関係から導出`,
  },
  ko: {
    about: '이것이 무엇인가', oneLine: '한 줄', paragraph: '문단', allCited: '모두, 출처 포함',
    readAs: (e, k) => `${e}은(는) ${k}(으)로서 읽힘`, readAsNone: (e) => `${e}의 읽힘이 확립되지 않음`,
    key: '요점',
    propositions: (n) => `${n}개의 명제`, parameters: (n) => `${n}개의 매개변수`,
    eachCited: '각 명제는 출처 포함', citedIn: '출처',
    sourceStmt: (n) => `${n}개의 출처 문장`, stmtShort: (n) => `${n}문`,
    more: (n) => '+' + n, inducedFrom: (n) => `${n}개의 매개변수는 이 콜렉션의 관계에서 유도됨`,
  },
  fa: {
    about: 'این درباره چیست', oneLine: 'یک خط', paragraph: 'بند', allCited: 'همه، با منبع',
    readAs: (e, k) => `${e} بهعنوان ${k} خوانده میشود`, readAsNone: (e) => `${e} خوانش ثابتی ندارد`,
    key: 'کلید',
    propositions: (n) => `${n} گزاره`, parameters: (n) => `${n} پارامتر`,
    eachCited: 'هر گزاره به منبعش استناد دارد', citedIn: 'استناد در',
    sourceStmt: (n) => `${n} جمله منبع`, stmtShort: (n) => `${n} جمله`,
    more: (n) => '+' + n, inducedFrom: (n) => `${n} پارامترِ آن از روابط خود مجموعه استخراج شده`,
  },
  tr: {
    about: 'Bu ne hakkında', oneLine: 'tek satır', paragraph: 'paragraf', allCited: 'tümü, kaynaklı',
    readAs: (e, k) => `${e}, ${k} olarak okunur`, readAsNone: (e) => `${e} için yerleşik bir okuma yok`,
    key: 'anahtar',
    propositions: (n) => `${n} önerme`, parameters: (n) => `${n} parametre`,
    eachCited: 'her biri kaynağına atıflı', citedIn: 'kaynak',
    sourceStmt: (n) => `${n} kaynak cümle`, stmtShort: (n) => `${n} cümle`,
    more: (n) => '+' + n, inducedFrom: (n) => `${n} parametresi bu koleksiyonun kendi ilişkilerinden çıkarıldı`,
  },
  la: {
    about: 'De qua re agitur', oneLine: 'una linea', paragraph: 'paragraphus', allCited: 'omnia, citata',
    readAs: (e, k) => `${e} ${k} legitur`, readAsNone: (e) => `${e} nullam lectionem stabilitam habet`,
    key: 'clavis',
    propositions: (n) => `${n} propositio${n === 1 ? '' : 'nes'}`, parameters: (n) => `${n} parametrum${n === 1 ? '' : 'a'}`,
    eachCited: 'unaquaeque ad suas fontes citatur', citedIn: 'citatur in',
    sourceStmt: (n) => `${n} sententia fontis${n === 1 ? '' : ' fontium'}`, stmtShort: (n) => `${n} sent.`,
    more: (n) => '+' + n, inducedFrom: (n) => `${n} parametra ex propriis collectionis relationibus inducta`,
  },
  grc: {
    about: 'Περὶ τίνος', oneLine: 'μία γραμμή', paragraph: 'παράγραφος', allCited: 'ἅπαντα, παραπεμπόμενα',
    readAs: (e, k) => `${e} ὡς ${k} ἀναγιγνώσκεται`, readAsNone: (e) => `${e} ἀνάγνωσις οὐ βεβαία`,
    key: 'κλείς',
    propositions: (n) => `${n} πρότασις${n === 1 ? '' : 'εις'}`, parameters: (n) => `${n} παράμετρος`,
    eachCited: 'ἑκάστη εἰς τὰς πηγὰς παραπέμπεται', citedIn: 'παραπέμπεται εἰς',
    sourceStmt: (n) => `${n} πηγαία πρότασις`, stmtShort: (n) => `${n} προτ.`,
    more: (n) => '+' + n, inducedFrom: (n) => `${n} παράμετροι ἐκ τῶν οἰκείων σχέσεων τῆς συλλογῆς ἐπαγόμεναι`,
  },
  sa: {
    about: 'अस्य विषयः कः', oneLine: 'एकपङ्क्तिः', paragraph: 'परिच्छेदः', allCited: 'सर्वम्, प्रमाणसहितम्',
    readAs: (e, k) => `${e} ${k}रूपेण पठ्यते`, readAsNone: (e) => `${e} निश्चितं न पठ्यते`,
    key: 'कुञ्जिका',
    propositions: (n) => `${n} प्रतिज्ञा`, parameters: (n) => `${n} परिमाणम्`,
    eachCited: 'प्रत्येकं स्वस्रोतसि उद्धृतम्', citedIn: 'उद्धृतम् अस्मिन्',
    sourceStmt: (n) => `${n} स्रोतवाक्यम्`, stmtShort: (n) => `${n} वाक्यम्`,
    more: (n) => '+' + n, inducedFrom: (n) => `${n} परिमाणानि संग्रहस्य स्वसम्बन्धेभ्यः आनीतानि`,
  },
});

const GIVER = 'declared render scaffold — a native speaker refines each (askshape-lens.multilingual.js posture)';

// The copula/verb token of each lens's `readAs` template — the word whose
// position in the sentence the word-order law is falsified against.
const VERB = Object.freeze({
  en: 'is read as', es: 'se lee como', fr: 'est lu comme', de: 'wird als', ru: 'читается как',
  el: 'διαβάζεται ως', fi: 'luetaan', id: 'dibaca sebagai', he: 'נקרא כ־', zh: '被读作',
  ar: 'يُقرأ', ja: 'として読まれる', ko: '(으)로서 읽힘', fa: 'خوانده میشود', tr: 'olarak okunur',
  la: 'legitur', grc: 'ἀναγιγνώσκεται', sa: 'पठ्यते',
});

/** lensFor(code) — the registered lens: { code, order, autonym, phrases, verb, giver },
 *  or { gap } for a language with no lens — never an English attempt on it. */
export function lensFor(code) {
  const c = languageOf(code);
  if (!c) return { gap: { reason: 'no_lens_for_language', detail: `no summary lens is registered for "${code}" — a reader that needs one refuses, never renders another language's` } };
  const phrases = PHRASES[c];
  if (!phrases) return { gap: { reason: 'no_phrasebook_for_language', language: c, detail: `the ${c} grammar is registered but its scaffolding is not written yet` } };
  const meta = LANGS.find((l) => l.code === c);
  return { code: c, order: meta.order, autonym: meta.autonym, script: meta.script, phrases, verb: VERB[c], giver: GIVER };
}

// ── INFLECTION: UniMorph-derived priors, injected (a prior is data, not a
// model). morphology-eng.json carries English's irregular tail (form → lemma);
// declension-rus.json carries Russian noun case rules. A word with no
// paradigm passes through unchanged and is marked `inflected: false` — the
// corpus's own material is never rewritten, only disclosed.
let _priors = { engMorph: null, rusDecl: null };
let _plurIndex = new Map();
export function setPriors({ engMorph = null, rusDecl = null } = {}) {
  _priors = { engMorph, rusDecl };
  _plurIndex = new Map();
  if (engMorph && engMorph.forms) {
    const pluralLike = (f) => /(s|es|ies|ves|ren|xen)$/i.test(f);
    for (const [form, lemmas] of Object.entries(engMorph.forms)) {
      if (String(form).toLowerCase() === String(lemmas[0] || '').toLowerCase()) continue;
      for (const lemma of lemmas) {
        const cur = _plurIndex.get(lemma);
        if (!cur || (pluralLike(form) && !pluralLike(cur))) _plurIndex.set(lemma, form);
      }
    }
  }
}

const EN_IRREGULAR = Object.freeze({
  child: 'children', person: 'people', man: 'men', woman: 'women', mouse: 'mice', foot: 'feet',
  tooth: 'teeth', goose: 'geese', ox: 'oxen', datum: 'data', medium: 'media', criterion: 'criteria',
  phenomenon: 'phenomena', analysis: 'analyses', basis: 'bases', crisis: 'crises', thesis: 'theses',
});

const enPlural = (w) => {
  const t = String(w ?? '').trim(); if (!t) return t;
  const low = t.toLowerCase();
  if (EN_IRREGULAR[low]) return t[0] === t[0].toUpperCase() ? EN_IRREGULAR[low][0].toUpperCase() + EN_IRREGULAR[low].slice(1) : EN_IRREGULAR[low];
  if (/(s|x|z|ch|sh)$/i.test(t)) return t + 'es';
  if (/[bcdfghjklmnpqrstvwxz]y$/i.test(t)) return t.slice(0, -1) + 'ies';
  if (/[^aeiou]o$/i.test(t)) return t + 'es';
  return t + 's';
};

/** plural(word, code) — the number form of a word in a language: English
 *  inflects (the UniMorph-attested irregular tail first, then the regular
 *  rules); the scaffolding carries the other languages' number systems; a
 *  word the lens cannot inflect passes through unchanged, marked. */
export function plural(word, code) {
  const low = String(word ?? '').trim().toLowerCase();
  if (languageOf(code) === 'en') {
    if (low) {
      const attested = _plurIndex.get(low);
      if (attested) return { word: attested, inflected: true, via: 'unimorph' };
      const irr = EN_IRREGULAR[low];
      if (irr) return { word: irr, inflected: true, via: 'irregular' };
    }
    return { word: enPlural(word), inflected: true };
  }
  return { word: String(word ?? ''), inflected: false };
}

/** rusLemma(word) — best-effort Russian lemmatization through the UniMorph
 *  declension rules (the rule with the most evidence strips the suffix).
 *  Never canonical, always disclosed. */
export function rusLemma(word) {
  const w = String(word ?? '').trim().toLowerCase();
  if (!w || !_priors.rusDecl || !_priors.rusDecl.rules) return { word: w, gap: 'no_russian_declension_prior' };
  let best = null;
  for (const r of _priors.rusDecl.rules) {
    if (!w.endsWith(r.from) || r.from === '') continue;
    if (!best || r.count > best.count) best = r;
  }
  if (!best) return { word: w, gap: 'no_rule' };
  return { word: w.slice(0, w.length - best.from.length) + best.to, rule: best, inflected: true };
}

/** englishIrregular(word) — the UniMorph-derived irregular tail: does a
 *  common noun have an attested irregular plural in the prior? */
export function englishIrregular(word) {
  const low = String(word ?? '').trim().toLowerCase();
  return EN_IRREGULAR[low] || null;
}

// ── THE RENDERER: GFP → grammar → natural language. ─────────────────────────
// Content words (relation labels, values) pass through as the corpus's own
// material; the scaffolding and the sentence shape come from the lens.
const STANDINGS = { fixed: 'fixed', 'one-at-a-time': 'one at a time', 'many-valued': 'many-valued', 'time-unknown': 'time unknown', unexposed: 'unexposed', unknown: null };

/** renderSummary(profile, built, { code, size, provenance }) — the summary as
 *  natural language in the lens's own grammar. `small` one line, `medium` a
 *  paragraph, `full` every proposition with its source-statement counts.
 *  Returns null when the profile asserts nothing. */
export function renderSummary(profile, built, { code = 'en', size = 'medium', provenance = null } = {}) {
  if (!profile || !profile.parameters || !profile.parameters.length) return null;
  const lens = lensFor(code);
  if (lens.gap) throw new TypeError(`holodeck-lang: ${lens.gap.reason} — ${lens.gap.detail}`);
  const ph = lens.phrases;
  const props = profile.parameters;
  const name = built?.surfaceOfId?.get(profile.id) || profile.id;
  const kind = (profile.kinds || []).map((k) => (k.signatures || []).slice(0, 4).join(' · ') || k.kindKey).join(' / ');
  const keyed = props.filter((p) => p.kindCharacteristic);
  const cite = (p, v) => (provenance && provenance.get(p.rel + '\u0001' + String(v.value)) || []).length;
  const valTxt = (v) => (built?.surfaceOfId?.get(v.value) ?? String(v.value)) + (v.count > 1 ? ' ×' + v.count : '');
  if (size === 'small') {
    const lead = (keyed.length ? keyed : props.slice(0, 3)).map((p) => p.rel).join(', ');
    return `${kind ? ph.readAs(name, kind) : ph.readAsNone(name)} — ${ph.key}: ${lead} · ${ph.parameters(props.length)}.`;
  }
  if (size === 'full') {
    const sents = [kind ? ph.readAs(name, kind) + `, ${ph.inducedFrom(props.length)}.` : ph.readAsNone(name) + '.'];
    for (const p of props) {
      const st = STANDINGS[p.standing];
      const vals = p.values.slice(0, 4).map((v) => {
        const c = cite(p, v);
        return valTxt(v) + (c ? ' · ' + ph.sourceStmt(c) : '');
      }).join(', ');
      sents.push(`${p.kindCharacteristic ? ph.key + ' ' : ''}${p.rel}${st ? ' (' + st + ')' : ''}: ${vals}${p.values.length > 4 ? ' ' + ph.more(p.values.length - 4) : ''}.`);
    }
    return sents.join('\n');
  }
  const heads = keyed.length ? keyed : props.slice(0, 2);
  const part = heads.map((p) => p.rel + ': ' + p.values.slice(0, 3).map(valTxt).join(', ') + (p.values.length > 3 ? ' ' + ph.more(p.values.length - 3) : '')).join('; ');
  const more = props.length > heads.length ? ` · ${ph.parameters(props.length - heads.length)} ${ph.more(0).replace('+', '')}` : '';
  return `${kind ? ph.readAs(name, kind) : ph.readAsNone(name)}. ${part}${more ? ' · ' + ph.more(props.length - heads.length) : ''}.`;
}

/** summaryVals(profile, built, { code, provenance }) — the full localized
 *  binding for a surface: the section labels, the size buttons, and the
 *  per-size prose — everything the summary field shows, in one language. */
export function summaryVals(profile, built, { code = 'en', provenance = null } = {}) {
  const lens = lensFor(code);
  const no = { has: false, code: lens.gap ? (languageOf(code) || code) : code };
  if (!profile || !profile.parameters || !profile.parameters.length) return no;
  if (lens.gap) return no;
  const ph = lens.phrases;
  const n = profile.parameters.length;
  const countLabel = ph.propositions(n) + ' · ' + ph.eachCited;
  return {
    has: true, code: lens.code, autonym: lens.autonym, order: lens.order, giver: lens.giver, verb: lens.verb,
    aboutLabel: ph.about, oneLine: ph.oneLine, paragraph: ph.paragraph, allCited: ph.allCited,
    countLabel, citedIn: ph.citedIn, key: ph.key, more: ph.more,
    stmtShort: (n) => ph.stmtShort(n), sourceStmt: (n) => ph.sourceStmt(n),
    text: (size) => renderSummary(profile, built, { code: lens.code, size, provenance }) || '',
  };
}

/** langOptions() — the registry as a picker's options: code + autonym. */
export function langOptions() {
  return LANGS.map((l) => ({ code: l.code, label: l.autonym }));
}