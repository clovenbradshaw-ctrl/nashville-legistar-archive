// organs/skill-routes.js — THE PATHS THE PIPELINE CAN TAKE THAT ARE CODE, NOT DATA.
//
// Fold invariant: A SKILL NAMES ITS TRIGGER. Something that applies to all content is the pipeline itself,
// not a skill; a skill is a path taken only when its trigger fires. Each route says WHEN, WHAT it does, what
// it NEEDS and OWNS, its POLICIES, how it RESOLVES a disagreement, what shows it WORKS, and — plainly —
// whether the pipeline currently honours its on/off switch (`honored`). A route is code, so there is no
// artifact to copy these from: this table is authored here, and every claim in it points at the file or the
// test that backs it (`evidence.from`). The rows that ARE artifacts (priors, layout rules, learned rules,
// forms) are read from those artifacts, never from here.
export const ROUTES = Object.freeze([
  {
    id: "route:hard-read", title: "hard-read", kind: "route", organ: "native/organs/hard-read.js", honored: true, circle: "admission (a source enters the corpus)",
    purpose: "Read a measurement the ordinary reader saw and could not read, and keep what was learned in doing so.",
    appliesWhen: "text where a symbol is followed by a measurement the plain quantity reader saw and did not read (stacked TeX errors, split stat/sys errors)",
    route: "typeset the region, look at it (OpenCV), read it (Tesseract); accept only when the text reading and the picture reading agree; learn a rule from recurrence",
    needs: ["python3 + opencv + matplotlib", "tesseract"], owns: "the `<file>::hardread` source it admits; hard-read.json (trails and rules); its usage record",
    policies: "two different senses must agree — one sense alone is never accepted; a rule is learned only from recurrence of one shape by one route pair; a learned rule is re-checked against its own bytes on every use; rules are append-only and can be conceded; the small model may only POINT at a candidate reading, never write a value",
    resolution: "when the text and the picture disagree, the small model may choose between candidates whose every number occurs in the region's own characters; a judged reading carries no trail and teaches no rule",
    evidence: { answer: "native/conformance/hardread.test.mjs (8 tests; four of its rules — two-sense acceptance, trails only for the accepted reading, the recurrence floor, a shared image trail — were each checked by a deliberate mutation and all four mutants were caught); on a real 9-paper corpus with the anchor H_0, 5 measurements the ordinary reader saw and skipped → 4 read (each address re-checked), 1 left listed as unread", from: "native/conformance/hardread.test.mjs; run of 2026-09-28" },
  },
  {
    id: "route:look", title: "look-at-layout", kind: "route", organ: "native/organs/look.js", honored: false, circle: "admission (a source enters the corpus)",
    purpose: "Read text whose layout the flat reader misreads, by seeing it the way a person would.",
    appliesWhen: "pages showing table rows, box drawing, very short lines, or columns (weirdFormattingScore signals)",
    route: "render the text to an image and read it with CV/OCR and a vision model", needs: ["opencv + tesseract", "a vision model"], owns: "the `<file>::look` source it admits",
    policies: null, resolution: null, evidence: null,
  },
  {
    id: "route:analysis", title: "learned analyses", kind: "route", organ: "native/organs/analysis-store.js", honored: true, circle: "analysis (a plain-language question about ingested data)",
    purpose: "Answer a question about a table with a method this instance has LEARNED — none is built in — and state, in its own scope and result, exactly what was checked.",
    appliesWhen: "a plain-language question whose words overlap a learned method's name, description or claim, asked of an ingested table with numeric columns",
    route: "retrieve the learned methods that match; for each named column run the method's check and its control; write a claim that reads only as wide as the check; a person promotes it",
    needs: ["python3 + numpy", "an ingested table"], owns: "analyses.jsonl (the hash-chained library of methods, their lineage and the runs that admitted them); the notebook cells it writes",
    policies: "a method is admitted only if it runs, states its own scope and result, gives the same answer twice, its CONTROL fails on data where the claim is false by construction, and it generalises to a second column; a model may never promote a claim; a method that is off is never retrieved; switching one off needs a reason; nothing is deleted, only conceded",
    resolution: "when two methods disagree about one column both findings are shown; neither overrides the other and nothing is promoted for the person",
    evidence: { answer: "native/conformance/notebook.test.mjs (the gate, the repair loop, reuse with no model, /learn, switches, audit)" },
  },
]);
