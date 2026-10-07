// organs/skill-definition.js — WHAT MAKES SOMETHING A SKILL: eight parameters, three lenses, gaps kept visible.
//
// A skill is a role the pipeline can fill: a PATH taken only for some content, switchable, with a giver or
// evidence. Three traditions each ask "what IS this thing?" and they converge on the same handful of answers:
//
//   Holacracy      a role is defined by its Purpose, its Domains (what it exclusively controls), its
//                  Accountabilities (what it does), and its Policies (limits on its authority); it acts to
//                  process a TENSION — a gap between what is and what its purpose says could be.
//   Aristotle      four causes — material (what it is made of / acts on), formal (its shape), efficient
//                  (what sets it going, who made it), final (what it is for).
//   Tinbergen      four questions about any behaviour — mechanism (how it works now), ontogeny (how it
//                  developed in THIS individual), function (what it buys / survival value), phylogeny (its
//                  lineage). Two proximate, two ultimate.
//
// Folded, that is EIGHT parameters. A skill's TRIGGER is the Holacracy tension — the efficient cause that
// calls it. Its PURPOSE is the final cause; its EVIDENCE is that end shown to be achieved (Tinbergen's
// function). Each parameter is answered FROM a field or a README, or it is a GAP — and the gap is shown,
// never filled in. "N of 8 answered" is the enumeration: the finding is the hole (ways-of-knowing:
// ENUMERATION). A skill with most parameters unanswered is not hidden; it is listed as thinly defined.

export const DEFINITION_SCHEMA = "EOSkillDefinition@1";

export const PARAMETERS = Object.freeze([
  { id: "purpose",  label: "Purpose",           asks: "What is it for?",                                        holacracy: "Purpose",                          aristotle: "final cause",                       tinbergen: "function (the intended end)" },
  { id: "tension",  label: "Tension (trigger)", asks: "What gap in the content calls it?",                      holacracy: "the tension a role processes",     aristotle: "efficient cause — what sets it going", tinbergen: "mechanism — the proximate trigger" },
  { id: "domain",   label: "Domain",            asks: "What does it act on, need, and exclusively own?",        holacracy: "Domains",                          aristotle: "material cause",                    tinbergen: null },
  { id: "path",     label: "Path",              asks: "What does it do when called — which organs, which senses?", holacracy: "Accountabilities",              aristotle: "formal cause — its shape",          tinbergen: "mechanism — how it works" },
  { id: "policies", label: "Policies",          asks: "What may it not do?",                                    holacracy: "Policies",                         aristotle: "formal cause — its limits",         tinbergen: null },
  { id: "ontogeny", label: "Development",       asks: "How did it come to be here, in this instance?",          holacracy: "the role's history in this circle", aristotle: "efficient cause — in this instance", tinbergen: "ontogeny" },
  { id: "lineage",  label: "Lineage",           asks: "Where did it come from, and who declared it?",           holacracy: "the parent circle / who created it", aristotle: "efficient cause — the maker",     tinbergen: "phylogeny" },
  { id: "evidence", label: "Evidence",          asks: "What does it buy, and what shows it?",                   holacracy: "accountabilities met",             aristotle: "final cause — achieved",            tinbergen: "function (survival value)" },
]);

const clip = (s, n = 360) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

/** define(answers) -> { slots, answered, total, gaps }. `answers[id]` = { answer, from } or null/undefined = a GAP. */
export function define(answers = {}) {
  const slots = PARAMETERS.map((p) => {
    const a = answers[p.id];
    const has = a && String(a.answer ?? "").trim();
    return { id: p.id, label: p.label, answer: has ? clip(a.answer) : null, from: has ? a.from ?? null : null, gap: !has };
  });
  return { schema: DEFINITION_SCHEMA, slots, answered: slots.filter((s) => !s.gap).length, total: slots.length, gaps: slots.filter((s) => s.gap).map((s) => s.id) };
}

export const ans = (answer, from) => (answer && String(answer).trim() ? { answer, from } : null);
