// adapters/text/relations-language.js — the LANGUAGE DISPATCH for relation
// reading. All cognition reads GFP-shaped by default; English-SVO (and any
// other positional language with a measured RoleConfig@1) comes online ONLY
// when the caller declares a RoleConfig for that language.
//
// The rule (user direction, verbatim, 2026-09-12, eot-jsonl.mjs): "dont call
// them SVO, call the GFP, and then higher up scope what that means in this
// context." Scoped here: the RECORD is always GFP — {end1, label, end2}
// typed by cell in the cube (Ground/Field/Pattern) — and a language's own
// role assignment (which measured UD relation a side's statistics describe)
// is a per-language lens that a reader selects for that language, declared
// by a `RoleConfig@1` built from that language's own treebank gold
// (scripts/build-role-config.mjs). NO roleConfig declared, or a language
// whose config is absent: the GFP reader (relations-gfp.js) is the base and
// nothing English-shaped comes online.
//
// Both modes return the IDENTICAL public shape so the perceiver's
// edge-builder reads one neutral record:
//   { end1, label, end2, cell, grain, polarity, offset }
// `subject`/`object` appear in a RoleConfig@1's own field names (the UD
// annotation scheme's own two relations) and NEVER on the record — the
// same seam doctrine relations-positional.js already holds.

import { extractGfpRelations, discoverGfpVocabulary } from "./relations-gfp.js";
import { extractPositionalRelation } from "./relations-positional.js";
import { cellLabelOf, makeGrainTyper } from "./grain-typing.js";

/**
 * relationExtractorsFor({ language, roleConfig, posPrior, classifyWord,
 * dominantClass }) → { mode, discoverRelationVocab, extractRelations }
 *
 * `roleConfig` present → mode "svo" (English-SVO / positional comes online,
 * gated per-language by the RoleConfig's own presence); absent → mode
 * "gfp" (the base reader). `posPrior` is required for a RoleConfig to mean
 * anything (role assignment reads the received POS prior); declared without
 * one, the dispatch refuses loudly rather than silently degrading to a
 * guess — the same never-defaulted posture wordclass.js holds.
 *
 * `discoverRelationVocab`/`extractRelations` mirror relations.js's seam so
 * the perceiver's refresh()/perceive() calls are unchanged in SHAPE — only
 * the extractor under them is selected by language.
 */
export function relationExtractorsFor({ language = null, roleConfig = null, posPrior = null, classifyWord = null, dominantClass = null, ...extras } = {}) {
  const hasRoleConfig = Boolean(roleConfig) && Boolean(posPrior);
  if (roleConfig && !posPrior) {
    throw new TypeError("relationExtractorsFor: a RoleConfig@1 without a posPrior is a role assignment with no evidence to read — posPrior is required whenever roleConfig is supplied");
  }

  if (hasRoleConfig) {
    // ── SVO COMES ONLINE FOR THIS LANGUAGE ───────────────────────────────
    // The positional reader (relations-positional.js) assigns ends by the
    // language's OWN measured role statistics. Its output is already
    // neutral {end1, label, end2}; we type the cell with the same
    // grain-typing the GFP reader uses, so an SVO mode and a GFP mode emit
    // records that are indistinguishable in shape.
    const typer = makeGrainTyper(posPrior);
    const extractRelations = (text, opts = {}) => {
      // `phrasalPredicates` is only forwardable when the caller supplies its
      // own `auxiliaryVerbs` closed class — the perceiver's always-on flag
      // must not silently throw (relations-positional.js refuses loudly).
      const phrasal = opts.phrasalPredicates && extras.auxiliaryVerbs;
      const r = extractPositionalRelation(text, {
        roleConfig,
        posPrior,
        classifyWord,
        dominantClass,
        ...(extras.auxiliaryVerbs ? { auxiliaryVerbs: extras.auxiliaryVerbs } : {}),
        ...(extras.verbForms ? { verbForms: extras.verbForms } : {}),
        ...(extras.subjectPronouns ? { subjectPronouns: extras.subjectPronouns } : {}),
        ...(extras.nominalForms ? { nominalForms: extras.nominalForms } : {}),
        ...(extras.chainBridge ? { chainBridge: extras.chainBridge } : {}),
        ...(extras.proclitics ? { proclitics: extras.proclitics } : {}),
        ...(phrasal ? { phrasalPredicates: true } : {}),
      });
      if (!r.end1 || !r.label || !r.end2) return [];
      const grain = typer.grainOf(r.label.word);
      return [{
        end1: r.end1.word,
        label: r.label.word,
        end2: r.end2.word,
        cell: grain && !grain.grain_gap ? cellLabelOf(grain) : "CON·Figure (Link)",
        grain: grain && !grain.grain_gap ? { operator: grain.op, grain: grain.grain, terrain: grain.terrain, stance: grain.stance, settledAs: grain.settledAs } : { settledAs: null, grain_gap: "connector unsettled — kept, never guessed" },
        polarity: "+", // a negation class is a language's own lens; unmeasured here, never guessed
        offset: 0,
      }];
    };
    const discoverRelationVocab = () => ({ verbs: new Set(), candidates: [] });
    return { mode: "svo", language, discoverRelationVocab, extractRelations };
  }

  // ── GFP IS THE BASE ───────────────────────────────────────────────────
  return {
    mode: "gfp",
    language: language ?? null,
    discoverRelationVocab: discoverGfpVocabulary,
    extractRelations: extractGfpRelations,
  };
}