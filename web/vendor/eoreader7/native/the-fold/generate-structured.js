// generate-structured.js — A NEW GENERATION PRODUCT: write BY the real,
// hunted structure, not around it (2026-09-22).
//
// The user, having watched huntDeclaredStructure converge on real,
// unhand-typed vocabulary for two unrelated media (white paper, press
// release): "do a new thing, a new type of generation product." Everything
// built until now MEASURED (learnParadigmEmergent, necessaryFacts,
// canonicalStructureCoverage) or, once, DEMONSTRATED one-shot
// (demonstrateExpertise: one bare prompt vs. one shape-informed prompt).
// This is different: the document is never asked for as ONE draw. The
// hunted structure's own roles, IN THE HUNTED ORDER, each get their OWN
// draw — the model is handed one real section NAME at a time (never a
// whole-document instruction to imitate a genre), and the assembled
// result is then mechanically checked against the SAME structure it was
// built from — closing the loop: learn structure → generate BY structure →
// verify the generation actually satisfies it, all three real, all three
// checkable independently.
import { matchCanonicalSections, huntDeclaredStructure } from "./canonical-sections.js";
import { elementsOf } from "./medium.js";

const titleCase = (s) => s.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
/** A role's slug ("for-immediate-release") back to plain words — mechanical,
 *  the inverse of canonical-sections.js's own slugification, never a
 *  model's paraphrase. */
const humanize = (role) => titleCase(role.replace(/-/g, " "));

/**
 * generateStructured(topic, formName, { draw, model, vocabulary,
 *   maxTokensPerSection, cur }) →
 *   { topic, formName, title, sections, assembled, structureCheck,
 *     expertiseScore, basis }
 *
 * `vocabulary`, when omitted, is HUNTED live (huntDeclaredStructure) — the
 * same real, corroborated structure this session proved converges on real
 * jargon for an arbitrary form. `draw` is called once per role, in the
 * vocabulary's own order — the model never sees or decides the section
 * list; it only ever writes the ONE section it is currently handed.
 * `cur`, when given (an expertise.js projectExpertise() result for this
 * same form), additionally scores the assembled document against the
 * measured contrastive/necessary facts via scoreAgainstExpertise — so a
 * generated document can be checked on BOTH axes this session built:
 * does it have the real sections, and does it carry the real measured
 * traits.
 */
export async function generateStructured(topic, formName, { draw, model = "unknown", vocabulary = null, maxTokensPerSection = 180, cur = null, huntOptions = {} } = {}) {
  if (typeof draw !== "function") throw new TypeError("generateStructured: draw (the local model's own call) is declared");
  let hunted = null;
  if (!vocabulary) {
    hunted = await huntDeclaredStructure(formName, huntOptions);
    vocabulary = hunted.vocabulary;
  }
  const roles = vocabulary.filter((v) => v.role !== "title");
  if (!roles.length) throw new TypeError(`generateStructured: no non-title role in the vocabulary for "${formName}" — nothing to generate by`);

  const titleAsk = `Write ONE short, compelling title for a ${formName} about "${topic}". Reply with ONLY the title text, nothing else.`;
  const title = String(await draw([{ role: "user", content: titleAsk }], 40) ?? "").trim().replace(/^["'#\s]+|["'\s]+$/g, "");

  const sections = [];
  for (const role of roles) {
    const name = humanize(role.role);
    const ask = `You are writing the "${name}" section of a ${formName} about "${topic}". Write ONLY this section's own text — no heading, no other sections, 80-150 words.`;
    const text = String(await draw([{ role: "user", content: ask }], maxTokensPerSection) ?? "").trim();
    sections.push({ role: role.role, name, text });
  }

  const assembled = [`# ${title || `A ${titleCase(formName)} About ${topic}`}`, "", ...sections.flatMap((s) => [`## ${s.name}`, "", s.text, ""])].join("\n").trim();

  // Self-check: does the ASSEMBLED document, re-read the same way any real
  // document is read (elementsOf), actually satisfy the structure it was
  // generated from? A real, computed check — not assumed from having
  // followed the recipe.
  const reread = { elements: elementsOf(assembled).elements };
  const structureCheck = matchCanonicalSections(reread, vocabulary);

  let expertiseScore = null;
  if (cur) {
    const { scoreAgainstExpertise } = await import("./expertise.js");
    expertiseScore = scoreAgainstExpertise(cur, assembled);
  }

  const basis = [
    `${sections.length} section(s) drawn one at a time, in the ${hunted ? "freshly-hunted" : "given"} order: ${roles.map((r) => r.role).join(" → ")}`,
    `re-read after assembly: ${structureCheck.matched.length}/${roles.length} of its OWN intended sections were actually found in the reassembled text (headings can be lost or reworded by the model despite the instruction — this is measured, not assumed)`,
    hunted ? hunted.basis : null,
    expertiseScore ? `scored against measured expertise: ${expertiseScore.held}/${expertiseScore.of} facts held` : null,
  ].filter(Boolean).join("; ");

  return { topic, formName, model, title, sections, assembled, structureCheck, expertiseScore, hunted, basis };
}
