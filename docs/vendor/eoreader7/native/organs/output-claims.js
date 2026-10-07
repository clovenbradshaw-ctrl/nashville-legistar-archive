// output-claims.js — the claim-FORMS the falsification chase found missing:
// the pass could earn SVO edges but not CAUSAL, TEMPORAL, UTTERANCE, or
// CONDITIONAL claims — so the CAUSE/THEN/DIALOGUE probes fell through to
// word-overlap binds. This organ earns those relations from the material's
// own sentences, each with its byte address, in the same discipline every
// other claim carries: the words are the material's, the FORM is declared.
//
// THE ARCHITECTONIC (2026-09-16, from the critique): the table is DERIVED,
// never gathered. The four gathered "kinds" of the first cut were a
// transcendental illusion: causal and conditional are ONE form — the
// hypothetical, ground-and-consequence (Kant's hypothetical judgment) — not
// two discoveries; temporal is NO kind but the form of inner sense, the
// sequence any series is read in (Kant's pure intuition of time); utterance
// is not a logical form at all but the testimony register — a relation
// between persons, which belongs to the practical sphere, never the logical.
// So this organ emits exactly three things, named apart:
//
//   forms      — the derived logical form this organ earns: hypothetical
//                (ground / consequence), the ONE form the four old kinds
//                really were.
//   sequence   — the order the material states, read off its temporal
//                images (first/then/אז/πρῶτον): NOT a claim-kind, the form
//                of inner sense — the medium any series is read in. A
//                medium with no series (a single still) has no sequence.
//   testimony  — the social register: quoted words and a bound speaker.
//                Earned by the witness protocol, never by form alone.
//
// THE FORM/IMAGE SPLIT (the schematism, made a field). The FORM is derived,
// universal — the condition of reading anything, in any language, in any
// medium. The IMAGE is the empirical trigger that invokes the form — the
// material's own connective (because, כי, ἐπεί, quia; the cut in film, the
// transition in audio). Every emitted entry carries BOTH: `form` (derived)
// and `image` (the material's word that invoked it) + `language`. The bytes
// certify the image; they never contain the form.
//
// THE S39 DISCIPLINE — LANGUAGE-BLIND CORE, PER-LANGUAGE SPECIALIZATION.
// The CORE is one act in every language: hear a sentence's own image and
// classify which form it invokes. The SPECIALIZATION is the image table — a
// declared, giver-named closed class per language, exactly as pronouns.js's
// PRONOUN_PRIORS holds one entry per language (a new language is a new
// entry, never a guess). A language with NO registered image set returns a
// typed gap (`no_claim_image_prior`), never a silent English match — the
// identical rule S39 holds for pronouns. The `language` parameter defaults
// to "en"; byte-identical in spirit to the original English-only organ when
// omitted.
//
// THE ARCHONS (Amendment XVII / compendium): Nagarjuna owns the consequence
// (refutes by consequence, asserts nothing); Partee owns the when (tense is
// anaphora — the sequence is a reference, not a content); Terry Gross +
// Scheherazade own the testimony (the interviewer drawing the guest out;
// nested tellers, each "I" bound to its declared frame). The form is
// Nagarjuna's; the sequence is Partee's; the testimony is Gross's.
//
// PURE. splitSentences injected (the cast.js pattern); no model, no I/O.

export const OUTPUT_CLAIMS_SCHEMA = "OutputClaims@2";
export const OUTPUT_CLAIMS_LANGUAGE = "en";
export const OUTPUT_CLAIMS_LANGUAGE_META = Object.freeze({
  giver: "lang/en (English) · lang/heb (WLC Tanakh, OpenScriptures morphhb) · lang/grc (Homer, Greek Wikisource) · lang/la (Latin corpus)",
  scope: "per-language IMAGE sets for the hypothetical form, the sequence, and the testimony register; a language with no registered images is a typed gap, never a silent English match",
});

// ── THE DERIVED TABLE — one logical form, two registers ────────────────────
// Derived, never gathered: causal and conditional were one form all along
// (the hypothetical); temporal is the form of inner sense, not a kind;
// utterance is testimony, a practical register, not a logical one.
export const FORMS = Object.freeze(["hypothetical"]);
export const REGISTERS = Object.freeze(["sequence", "testimony"]);

// ── THE PER-LANGUAGE IMAGE TABLE (S39's shape) ─────────────────────────────
// Each entry is a closed class of the material's OWN connectives, per
// language, with its giver named. The words are the material's; the FORM is
// this organ's. A language absent here earns a typed gap. The hypothetical
// form is split into its two sides — ground (because/if — the antecedent)
// and consequent (therefore — the consequence) — each its own image class,
// so a sentence is typed with the side it carries.
const IMAGES = Object.freeze({
  en: Object.freeze({
    giver: "lang/en",
    hypothetical: Object.freeze({
      ground: /(?:because|since|caused|caused by|as a result of|owing to|due to|if|unless|provided that|on condition that|whether|had\s+.*\s+would)/i,
      consequent: /(?:therefore|hence|so that|which is why|would have)/i,
    }),
    sequence: /(?:first|then|next|afterward|afterwards|before|after|when|while|once|at that time|then came)/i,
    testimony: /(?:\bsaid\b|\basked\b|\breplied\b|\banswered\b|\bcried\b|\bwhispered\b|\bsaid to\b|\bspoke\b|said:)/i,
  }),
  // Hebrew — measured from the WLC Tanakh (2Sam) itself: כי (because/that),
  // לכן (therefore), אז (then), אחרי (after), אם (if), אמר/ענה/השיב (said/
  // answered), ראשית/בתחילה (first). The images are written in BARE letters
  // (no niqqud — the material's niqqud is folded before matching), and
  // WITHOUT \b boundaries, because Hebrew prefixes (ו ה ל ב) attach to the
  // word (ויאמר is אמר with a vav prefix). Giver: the corpus's own usage,
  // read off the real bytes — never a guessed vocabulary.
  heb: Object.freeze({
    giver: "lang/heb (measured from WLC Tanakh, OpenScriptures morphhb)",
    hypothetical: Object.freeze({
      ground: /(?:כי|משום|בגלל|אם|אלא אם|לולא|אילולא)/u,
      consequent: /(?:לכן|על כן)/u,
    }),
    sequence: /(?:אז|אחרי|אחר כך|ראשית|בתחילה|אחרון|ואחרי|לפני)/u,
    testimony: /(?:אמר|ענה|השיב|קרא|לחש|צעק)/u,
  }),
  // Greek — measured from the real Iliad (Homer, Greek Wikisource): εἰ (if),
  // ἐπεί/ἐπειδή (since/because), οὖν (therefore), πρῶτον/ἔπειτα (first/then),
  // μετὰ (after), ὅτι (that/because), ἔφη/εἶπεν (said). Images in BARE
  // letters (no polytonic accents — folded before matching), \b dropped for
  // the same prefix-attachment reason. Giver: Homer's own usage.
  grc: Object.freeze({
    giver: "lang/grc (measured from Homer, Greek Wikisource el.wikisource.org)",
    hypothetical: Object.freeze({
      ground: /(?:επει|επειδη|οτι|διοτι|ει|εαν|ειπερ|ει μη)/u,
      consequent: /(?:ουν|ουνεκα)/u,
    }),
    sequence: /(?:πρωτον|επειτα|μετα|τοτε|υστερον|προτερον|ως ταχιστα)/u,
    testimony: /(?:εφη|ειπεν|απεκριθη|ημειψεν|φατο)/u,
  }),
  // Latin — measured from the latin-originals corpus conventions (the census
  // already names Latin's case-marked reader as real work).
  la: Object.freeze({
    giver: "lang/la (Latin corpus, live_priors latin-originals)",
    hypothetical: Object.freeze({
      ground: /(?:quia|quod|propter|si|nisi|dummodo|si modo|quod si)/i,
      consequent: /(?:igitur|ergo|itaque|quapropter)/i,
    }),
    sequence: /(?:primum|deinde|postea|postquam|antequam|cum|ubi|mox)/i,
    testimony: /(?:\bdixit\b|\bait\b|\binquit\b|\brespondit\b|\bclamavit\b)/i,
  }),
});

const triggerGap = (language) =>
  language && language !== "en" && !IMAGES[language]
    ? { type: "no_claim_image_prior", language, detail: `the claim images are declared for ${Object.keys(IMAGES).join(", ")}; ${language} has none — a typed gap, never a silent English match` }
    : null;

export const claimKindTriggerGap = triggerGap;

const quoteMark = (s) => {
  const m = String(s ?? "").match(/[«"'“‘]([^»"”’]{2,160})[»"”’]/);
  return m ? m[1].trim() : null;
};

// THE FOLD, SCRIPT-AWARE (the S39 lesson, applied to connectives): Hebrew
// carries niqqud and cantillation between letters (כִּי is כ+ִ+י), Greek
// carries polytonic accents, Latin none. The image set is written in the
// language's BARE letters; the material's sentence must be folded to those
// before matching — the same NFD-strip dialogue.js::fold uses, extended so
// the match is over the bare script, never the pointed one. A language whose
// script marks vowels (heb, grc) folds; one that does not (la, en) folds to
// itself.
const foldScript = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f\u0591-\u05c7]/g, "");

/**
 * claimKindsOf(text, { splitSentences, source, language }) →
 *   { forms, sequence, testimony, gap, basis }
 * Every sentence of `text`, classified by its OWN images, under the DECLARED
 * language's image table. A language with no registered images returns a
 * typed gap — never an English match. Every entry carries the derived
 * `form`/`register` and the material's `image` (the trigger word) + language:
 * the bytes certify the image; they never contain the form.
 */
export function claimKindsOf(text = "", { splitSentences = null, source = null, language = "en" } = {}) {
  const t = String(text ?? "");
  const gap = triggerGap(language);
  if (gap) return { forms: [], sequence: [], testimony: [], basis: `no image set for ${language}`, gap };
  if (!t.trim()) return { forms: [], sequence: [], testimony: [], basis: "no text", gap: null };
  const img = IMAGES[language];
  const sentences = (splitSentences ? (() => { try { return splitSentences(t); } catch { return [t]; } })() : [t])
    .map((s) => (typeof s === "string" ? s : s?.text ?? ""))
    .filter((s) => String(s).trim().length > 4);

  const forms = [];
  const sequence = [];
  const testimony = [];
  const seen = new Set();
  for (const s of sentences) {
    const st = String(s).trim();
    if (seen.has(st)) continue;
    seen.add(st);
    const start = t.indexOf(st);
    const end = start >= 0 ? start + st.length : 0;
    // match against the folded script (bare letters), report the original
    const folded = foldScript(st).toLowerCase();
    // THE HYPOTHETICAL FORM (Nagarjuna) — ground & consequence are one form;
    // a sentence may carry BOTH a ground-image and a consequent-image
    // ("because X, therefore Y") — each side is then emitted, never merged
    // into one silent pick.
    const g = folded.match(img.hypothetical.ground);
    const c = folded.match(img.hypothetical.consequent);
    if (g) {
      forms.push({
        form: "hypothetical",
        side: "ground",
        sentence: st,
        image: g[0],
        language,
        ref: source ?? null,
        span: { start, end },
        from: "image",
      });
    }
    if (c) {
      forms.push({
        form: "hypothetical",
        side: "consequent",
        sentence: st,
        image: c[0],
        language,
        ref: source ?? null,
        span: { start, end },
        from: "image",
      });
    }
    // THE SEQUENCE (Partee) — the order the material states; the form of
    // inner sense, never a claim-kind.
    const seq = folded.match(img.sequence);
    if (seq) {
      sequence.push({
        form: "sequence",
        position: (st.match(/^(first|then|next|afterward|afterwards)/i) || [])[1] ?? "ordered",
        sentence: st,
        image: seq[0],
        language,
        ref: source ?? null,
        span: { start, end },
        from: "image",
      });
    }
    // THE TESTIMONY REGISTER (Terry Gross) — a relation between persons: the
    // quoted words must be real, the speaker bound. Earned by the witness
    // protocol, never by form alone.
    const ut = folded.match(img.testimony);
    if (ut) {
      const quoted = quoteMark(st);
      if (!quoted) continue;
      const speaker =
        (st.match(/^([A-Z][\w'’\- ]{1,40}?)\s+(?:said|asked|replied|answered|cried|whispered|spoke)\b/) ||
          st.match(/(?:replied|answered|cried|whispered)\s+([A-Z][\w'’\- ]{1,40})[,.]?$/) ||
          [])[1] ?? null;
      testimony.push({
        form: "testimony",
        speaker,
        quoted,
        sentence: st,
        image: ut[0],
        language,
        ref: source ?? null,
        span: { start, end },
        from: "image",
      });
    }
  }
  const basis = `${forms.length} hypothetical form(s), ${sequence.length} sequence(s), ${testimony.length} testimony row(s) heard under ${language} (form: ${FORMS.join(", ")}; registers: ${REGISTERS.join(", ")})`;
  return { forms, sequence, testimony, gap: null, basis };
}