// fold-chat-hints.js — the language priors fold-chat-mind.js resolveQuestion is handed (pronoun forms that signal 'the last
// answer's referent', gendered personal forms, honorific titles). GENERATED, never hand-edited: it is the ethos priors
// eval/priors/out/hints-v1.json (ethos derived-priors/pronoun-priors (UD EWT / GSD FEATS) and name-priors; built by eval/priors/e4/build-hints.mjs; ethos commit 1c510a6), reshaped to { carryTriggers, personalPronouns, titles }.
// Regenerate: node scripts/gen-hints.mjs. A language with no prior (zh, ja, ar, …) is simply absent: it never carries.
// (ru: the gendered forms are triggers only, not personalPronouns — the prior's own note, measured worse otherwise.)

export const HINTS = Object.freeze({
  "en": {
    "carryTriggers": [
      "they",
      "them",
      "he",
      "his",
      "it",
      "him",
      "their",
      "she",
      "himself",
      "its",
      "one",
      "themselves",
      "itself",
      "there",
      "her",
      "it's",
      "herself",
      "the"
    ],
    "personalPronouns": [
      "he",
      "his",
      "him",
      "she",
      "himself",
      "her",
      "herself"
    ],
    "titles": [
      "mr",
      "mrs",
      "miss",
      "ms",
      "mx",
      "dr",
      "prof",
      "professor",
      "rev",
      "reverend",
      "fr",
      "sir",
      "madam",
      "madame",
      "mademoiselle",
      "monsieur",
      "herr",
      "frau",
      "fraulein",
      "signor",
      "signora",
      "signorina",
      "lord",
      "lady",
      "dame",
      "count",
      "countess",
      "duke",
      "duchess",
      "baron",
      "baroness",
      "viscount",
      "viscountess",
      "earl",
      "marquis",
      "marquess",
      "voivode",
      "king",
      "queen",
      "prince",
      "princess",
      "captain",
      "capt",
      "colonel",
      "col",
      "major",
      "general",
      "gen",
      "admiral",
      "lieutenant",
      "lt",
      "sergeant",
      "sgt"
    ]
  },
  "ru": {
    "carryTriggers": [
      "он",
      "ним",
      "ему",
      "они",
      "него",
      "нему",
      "их",
      "его",
      "её",
      "нём",
      "них",
      "им",
      "она",
      "ней",
      "неё",
      "ними",
      "ей",
      "оно"
    ],
    "personalPronouns": [],
    "titles": []
  },
  "es": {
    "carryTriggers": [],
    "personalPronouns": [],
    "titles": [
      "don",
      "doña",
      "dona",
      "señor",
      "senor",
      "señora",
      "senora",
      "señorita",
      "senorita",
      "sr",
      "sra",
      "srta",
      "fray",
      "sor"
    ]
  }
});

/** The hints for a language code ('en', 'ru', …), or null when the priors have none. */
export const hintsFor = (lang) => HINTS[String(lang || "en").toLowerCase().split("-")[0]] || null;
