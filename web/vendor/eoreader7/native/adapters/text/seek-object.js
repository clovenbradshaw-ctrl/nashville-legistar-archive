// native/adapters/text/seek-object.js — the MECHANICAL extraction of a
// construction's OBJECT (the means) from an ask: the exact input the
// hyperlexicon-kind resolution needs.
//
// The existence face needs to know WHAT is being built — "a bomb" vs "an
// app" — read from the ask in any language, with no English POS prior and
// no weapon wordlist. This file is the language-neutral, mechanical half:
// it pulls the FIGURE a construction frame governs. Whether that means is
// foreclosing is the hyperlexicon's KIND judgment, never this file's.
//
// THE SHAPE. A construction ask is `{frame} {means}` in reading order
// ("build a bomb", "cómo construir una bomba") or, in a verb-final clause,
// `{means} {frame}` ("wie man eine Bombe baut", "爆弾の作り方"). The frame is
// a member of a per-language CLOSED CLASS of construction verbs
// (make/build/construct/fabricate/assemble) — GRAMMAR, the same class the
// askshape lens's ACQUIRE already holds, never weapon names. The object is
// the figure the frame governs:
//   1. the end2 of a GFP relation whose connector (label) is a
//      construction frame — the frame as the connecting word itself;
//   2. else the end2 of a GFP relation whose end1 is the frame — the figure
//      immediately following the construction verb, exactly the adjacency
//      the reader already emits;
//   3. else (the reader produced nothing usable: a short ask, a verb-final
//      clause, or a no-whitespace script where the whole ask is one token)
//      the content run NEAREST the frame, following it first then
//      preceding it.
//
// GFP IS THE PRIMARY READ. extractGfpRelations (relations-gfp.js) is reused
// as-is — no hand-rolled parser, no POS prior, no subject/verb/object. The
// fallback reuses the SAME two closed classes (frames + connectors) the
// reader's own figure discovery already uses, so nothing new is assumed.
//
// THE BENEFICIARY IS NOT THE OBJECT. "build an app for users": the relation
// out of the frame is `build —an→ app` (or, in the fallback, the first
// content run after the frame), so "app" resolves and the later benefactive
// "users" never does — the object is the figure in the CONSTRUCTION
// relation, not a figure in a later for/para/für phrase.
//
// Giver of the surface data below: the same per-language grammar classes
// the existence probe carried (native/adapters/text/existence-reading.js —
// SEEK surfaces and connector tokens), narrowed to construction verbs.

import { extractGfpRelations } from "./relations-gfp.js";

const WORD = /[\p{L}\p{N}]+/gu;

// Per-language function-word class (determiners, particles, prepositions,
// pronouns, how/what/step): the tokens a content run is NOT. Never a weapon
// list. These are the closed connector classes existence-reading.js already
// carried, reproduced here so this reader is self-contained grammar.
export const CONNECTORS = {
  en: ["the", "a", "an", "to", "of", "in", "for", "by", "with", "how", "step", "and", "or"],
  spa: ["de", "a", "para", "por", "en", "y", "el", "la", "los", "las", "un", "una", "que", "cómo", "como", "paso"],
  fra: ["de", "à", "a", "pour", "par", "en", "et", "le", "la", "les", "un", "une", "que", "comment", "étape", "etape"],
  deu: ["und", "der", "die", "das", "ein", "eine", "zu", "um", "für", "fur", "im", "in", "mit", "man", "schritt"],
  por: ["de", "a", "para", "por", "em", "e", "o", "a", "os", "as", "um", "uma", "que", "como", "passo"],
  ita: ["di", "a", "per", "in", "e", "il", "la", "lo", "un", "una", "che", "come", "passo"],
  rus: ["и", "в", "на", "с", "по", "к", "для", "как", "чтобы", "из", "от", "за", "шаг"],
  arb: ["في", "من", "على", "إلى", "الى", "عن", "و", "ال", "كيف", "خطوة"],
  cmn_hans: ["如何", "一步一步", "步骤", "制造", "了", "的", "在", "中", "一个"],
  jpn: ["の", "を", "に", "で", "と", "から", "ため", "ために", "段階", "追って", "人", "で"],
  kor: ["을", "를", "의", "에", "에서", "으로", "와", "과", "하기", "위해", "단계별", "방법"],
  hin: ["को", "का", "की", "के", "में", "से", "लिए", "चरण", "दर", "और"],
  swa: ["ya", "za", "kwa", "na", "katika", "jinsi"],
  tur: ["ve", "için", "icin", "ile", "bir", "adım", "adim", "nasıl", "nasil"],
  heb: ["של", "את", "בתוך", "כדי", "ל", "ב", "מ", "צעד"],
  ind: ["untuk", "dengan", "dari", "dan", "di", "langkah", "cara"],
  nld: ["en", "van", "in", "een", "om", "voor", "stap"],
  pol: ["i", "w", "na", "do", "z", "krok", "jak"],
  ukr: ["і", "в", "на", "для", "з", "крок", "як"],
  ces: ["a", "v", "na", "do", "z", "krok", "jak"],
  swe: ["och", "i", "för", "for", "en", "steg", "hur"],
  ell: ["και", "σε", "για", "με", "το", "τη", "του", "της", "βήμα", "πώς", "πως"],
  vie: ["và", "của", "trong", "để", "de", "cho", "một", "từng", "bước", "cách", "làm"],
  tha: ["ของ", "ใน", "เพื่อ", "การ", "ทีละ", "ที", "ละ", "ขั้น", "ตอน"],
  fas: ["و", "در", "برای", "از", "به", "قدم", "گام", "چگونه"],
  dan: ["og", "i", "for", "en", "trin", "hvordan"],
};

// Per-language CLOSED CLASS of construction verbs — make / build /
// construct / fabricate / assemble and their per-language forms, the
// surface class the askshape lens's ACQUIRE already holds. GRAMMAR, never a
// weapon wordlist: a bare means ("a bomb") reads nothing here; only the
// frame governing one does. Matched as substrings (the repo's CJK-safe
// convention — \b is ASCII-anchored and breaks on の/的/को), never as \b.
export const FRAMES = {
  en: ["build", "make", "construct", "fabricate", "assemble", "create", "produce", "manufacture"],
  spa: ["hacer", "construir", "fabricar", "montar", "crear", "producir", "ensamblar"],
  fra: ["faire", "fabriquer", "construire", "monter", "créer", "produire", "assembler"],
  deu: ["baut", "bauen", "herstell", "konstruieren", "machen", "erstellen", "montieren", "zusammenbauen"],
  por: ["fazer", "construir", "fabricar", "montar", "criar", "produzir"],
  ita: ["fare", "costruire", "fabbricare", "montare", "creare", "produrre"],
  rus: ["сделать", "делать", "изготовить", "изготовл", "построить", "собрать", "собирать", "создать", "создавать", "производить"],
  arb: ["صنع", "اصنع", "تصنيع", "بناء", "يصنع", "إنشاء", "أنشئ", "إنتاج"],
  cmn_hans: ["制造", "制作", "建造", "组装", "装配"],
  jpn: ["作り方", "作る", "作っ", "製造", "組み立て", "作成"],
  kor: ["만들", "만드는", "제조", "조립", "제작", "구축"],
  hin: ["बनाने", "बनाओ", "बना", "बनाएं", "निर्माण", "तैयार"],
  swa: ["kutengeneza", "kujenga", "kufanya", "tengeneza", "jenga"],
  tur: ["yapmak", "yapılır", "inşa", "üretmek", "oluşturmak"],
  heb: ["לבנות", "בנה", "לייצר", "ליצור", "בונים", "הרכיב"],
  ind: ["membuat", "buat", "membangun", "merakit", "ciptakan"],
  nld: ["maken", "maak", "bouwen", "bouw", "construeren", "fabriceren"],
  pol: ["zrobić", "zrobic", "zbudować", "zbudowac", "wytworzyć", "wytworzyc", "tworzyć", "tworzyc", "stworzyć", "stworzyc"],
  ukr: ["зробити", "виготовити", "побудувати", "створювати", "створити", "виготовл"],
  ces: ["udělat", "udelat", "postavit", "vyrobit", "vytvořit", "vytvorit", "stavět", "stavet"],
  swe: ["göra", "gora", "bygga", "tillverka", "skapa", "konstruera"],
  ell: ["φτιάξε", "φτιάξ", "φτιάχνω", "κατασκευάζω", "δημιουργώ", "φτιάχν"],
  vie: ["làm", "chế tạo", "xây dựng", "tạo", "lắp ráp"],
  tha: ["ทำ", "สร้าง", "ผลิต", "ประกอบ"],
  fas: ["ساختن", "بساز", "بسازیم", "ساخت", "تولید"],
  dan: ["lave", "bygge", "fremstille", "skabe", "konstruere"],
};

const runsOf = (s) => String(s ?? "").match(WORD) ?? [];

/**
 * seekObject(text, { language }) → { object, found, frame }
 *
 * `frame` — the construction surface matched (a member of the per-language
 *   construction-verb closed class above), or null when none is present.
 * `object` — the figure/word the frame governs (the means), as it appears in
 *   the text, or null when no object resolves.
 * `found` — false when the ask carries no construction frame ("how does a
 *   fire extinguisher work" has no seek) or no object resolves.
 *
 * Language-neutral: whitespace languages read the frame→object adjacency the
 * GFP reader emits; CJK/Devanagari (no whitespace, the whole ask one token)
 * fall through the same reader to the nearest-content-run rule. Never an
 * English POS prior, never a weapon name.
 */
export function seekObject(text, { language = "en" } = {}) {
  const t = String(text ?? "");
  const lower = t.toLowerCase();
  const frames = FRAMES[language] ?? FRAMES.en;
  const connectors = new Set((CONNECTORS[language] ?? CONNECTORS.en).map((c) => c.toLowerCase()));

  // The frame occurrences in reading order (substring match, CJK-safe).
  const hits = [];
  for (const surface of frames) {
    let at = lower.indexOf(surface);
    while (at !== -1) {
      hits.push({ surface, start: at, end: at + surface.length });
      at = lower.indexOf(surface, at + 1);
    }
  }
  if (hits.length === 0) return { object: null, found: false, frame: null };
  hits.sort((a, b) => a.start - b.start);

  // THE GFP READER, fed the same content-figure floor the existence probe
  // used (length >= 3, not a connector) plus the frames themselves, so the
  // frame is always a mention candidate even when it is short or sits in a
  // function-word class. minRec 1 — a single-sentence ask must read; nothing
  // needs to recur.
  const allTokens = runsOf(t).map((w) => w.toLowerCase());
  const figures = new Set(allTokens.filter((w) => w.length >= 3 && !connectors.has(w)));
  for (const { surface } of hits) figures.add(surface);
  const relations = extractGfpRelations(t, { minRec: 1, figures });

  const isFrame = (s) => frames.some((f) => String(s ?? "").toLowerCase().includes(f));
  const frameOf = (s) => frames.find((f) => String(s ?? "").toLowerCase().includes(f)) ?? null;

  // (1) THE FRAME AS CONNECTOR: the object is the end2 of the relation whose
  // label carries the construction frame — the frame did the connecting.
  for (const r of relations) {
    if (isFrame(r.label)) return { object: r.end2, found: true, frame: frameOf(r.label) };
  }

  // (2) THE FRAME AS end1: the object is the figure immediately following
  // the construction verb — the GFP reader's own adjacency, which is exactly
  // "build —an→ app", never the later benefactive "users".
  for (const r of relations) {
    if (isFrame(r.end1)) return { object: r.end2, found: true, frame: frameOf(r.end1) };
  }

  // (3) The reader produced nothing usable (short ask, verb-final clause,
  // no-whitespace script): the content run NEAREST the frame, following it
  // first, else preceding it. The frame span is widened to its enclosing
  // token so an inflected "building" reads from its whole boundary.
  const gov = hits[0];
  const partialBefore = t.slice(0, gov.start).match(/[\p{L}\p{N}]$/u)?.[0] ?? "";
  const partialAfter = t.slice(gov.end).match(/^[\p{L}\p{N}]+/u)?.[0] ?? "";
  const tokenStart = gov.start - partialBefore.length;
  const tokenEnd = gov.end + partialAfter.length;
  for (const run of runsOf(t.slice(tokenEnd))) {
    if (!connectors.has(run.toLowerCase())) return { object: run, found: true, frame: gov.surface };
  }
  for (const run of runsOf(t.slice(0, tokenStart)).reverse()) {
    if (!connectors.has(run.toLowerCase())) return { object: run, found: true, frame: gov.surface };
  }

  return { object: null, found: false, frame: gov.surface };
}

export default seekObject;