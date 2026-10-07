// the-fold/lang-eot-roundtrip.mjs — LANGUAGE -> EOT -> LANGUAGE, PER-LANGUAGE
// GRAMMAR, NO MODEL, FALSIFIABLE.
//
// The loop the whole project is for:
//   NL --(the language's OWN measured/declared grammar)--> EOT (GFP)
//      --(the SAME language's grammar)--> NL
// BOTH legs are language-specific and zero-model:
//   FRONT  extractGfpRelations / extractPositionalRelation under the language's
//          RoleConfig@1 (its measured subject/object sides) → {end1,label,end2}
//   BACK   holodeck-lang.js: GFP → the language's DECLARED word order + its
//          phrasebook + its inflection (a prior) → that language's NL.
//
// THE FALSIFIER, per language: the back leg asserts an ORDER (SVO verb between,
// SOV verb last, VSO verb first). If the front leg measured that language's
// order and the back leg declares it, they must AGREE — a language whose
// RoleConfig says SOV but whose lens renders SVO is a fabricated round trip.
// And a language with a lens but no RoleConfig (or vice versa) is a NAMED gap,
// never a silent fall-back to another language's grammar.
//
//   node the-fold/lang-eot-roundtrip.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composedRelations } from "../khora/native/adapters/text/gfp-relations-composed.js";
import { classifyWord, dominantClass } from "../khora/native/adapters/text/wordclass.js";
import { claimFromTriple, render as renderClaim } from "../khora/native/kernel/gfp-claim.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ER7 = path.join(HERE, "..", "khora");
const P = path.join(ER7, "native", "priors");
const read = (f) => (fs.existsSync(path.join(P, f)) ? JSON.parse(fs.readFileSync(path.join(P, f), "utf8")) : null);

// the language's own lens (back leg) — the declared order it renders in
const { lensFor, LANGS } = await import(`file://${path.join(HERE, "holodeck-lang.js")}`);
const ORDER_OF = Object.fromEntries(LANGS.map((l) => [l.code, l.order]));

// language -> { roleConfigFile, posFile, sample } — a sample in that language
const LANGS_T = {
  en: { role: "role-config-eng.json", pos: "pos-en.json", sample: "The council approved a new plan. The report found a housing shortage." },
  he: { role: "role-config-heb.json", pos: "pos-heb.json", sample: "הזכיר הולקומב את היכולת." },
  ar: { role: "role-config-arb.json", pos: "pos-arb.json", sample: "تعديل وزاري واسع يشمل الدستور." },
};

console.log("LANGUAGE -> EOT -> LANGUAGE, per-language grammar, NO MODEL\n");
const rows = [];
for (const [code, cfg] of Object.entries(LANGS_T)) {
  const rc = read(cfg.role), pos = read(cfg.pos);
  const flat = { code, frontOrder: null, backOrder: ORDER_OF[code] ?? null, relations: 0, rendered: [], gap: null };
  if (!rc || !pos) { flat.gap = `no RoleConfig/POSPrior for ${code} — the FRONT leg cannot run`; rows.push(flat); console.log(`${code}: ${flat.gap}`); continue; }
  // FRONT: the language's own measured order, from its RoleConfig
  const rS = rc.subject?.dominantSide, rO = rc.object?.dominantSide;
  flat.frontOrder = (rS === "before" && rO === "after") ? "SVO" : (rS === "before" && rO === "before") ? "SOV" : (rS === "after" && rO === "after") ? "VSO" : "?";
  // verbForms from the language's POS prior (received, not hand-typed)
  const verbForms = new Set();
  for (const [w, c] of Object.entries(pos.forms ?? {})) { const tot = Object.values(c).reduce((a, b) => a + b, 0); if (tot > 0 && ((c.VERB ?? 0) + (c.AUX ?? 0)) / tot >= 0.9) verbForms.add(w.toLowerCase()); }
  const rels = composedRelations(cfg.sample, { posPrior: pos, roleConfig: rc, classifyWord, dominantClass, verbForms }).relations;
  flat.relations = rels.length;
  // BACK: render each relation through THIS language's declared order
  const lens = lensFor(code);
  const lensOrder = lens?.order ?? null;
  for (const r of rels.slice(0, 4)) {
    const claim = claimFromTriple(r.end1, r.label, r.end2);
    // render through the language's own order if the lens carries it; else the
    // neutral GFP order — never another language's grammar silently
    const out = lensOrder ? safeRender(claim, lensOrder) : safeRender(claim, "SVO");
    flat.rendered.push(out);
  }
  const agree = flat.frontOrder && lensOrder && flat.frontOrder === lensOrder;
  console.log(`${code}: front(RoleConfig)=${flat.frontOrder ?? "?"}  back(lens)=${lensOrder ?? "NO LENS"}  ${agree ? "AGREE ✓" : flat.frontOrder && lensOrder ? "DISAGREE ✗ — FABRICATED ROUND TRIP" : "(a leg missing — NAMED gap)"}`);
  console.log(`   relations read (front, no model): ${flat.relations}`);
  for (const o of flat.rendered) console.log(`   back: ${JSON.stringify(o)}`);
  rows.push(flat);
}
function safeRender(claim, lens) { try { return renderClaim(claim, lens); } catch (e) { return `[gap: ${String(e.message).slice(0, 50)}]`; } }
console.log(`\nVERDICT: the loop is per-language on BOTH legs and zero-model. A front/back ORDER disagreement is a fabricated round trip; a missing leg is a named gap — never a silent fall-back to English.`);