// organs/skill-enrich.js — turns a listed skill into a DEFINED, GOVERNED, RELATED one.
//   definition   the eight parameters (skill-definition.js), each from a field or a visible gap
//   governance   Ostrom's principles as attributes: authority, fit, monitoring, sanctions, resolution, nesting
//   relations    uses / usedBy / nests / coApplies, derived from the code (skill-relations.js)
// Nothing here writes prose about a skill beyond assembling its own fields into a sentence, and each answer
// keeps the place it came from.
import { define, ans } from "./skill-definition.js";
import { ladderOf } from "./skill-toggles.js";

const j = (a) => a.filter(Boolean).join("; ");
const iso = (t) => (t ? new Date(t).toISOString().slice(0, 10) : null);

export function definitionOf(s, rel) {
  const f = s.facts ?? {};
  const consumers = rel.usedBy.map((u) => `${u.file}:${u.line}`);
  if (s.origin === "code") return define({
    purpose: ans(s.purpose, s.organ), tension: ans(s.appliesWhen, s.organ), domain: ans(j([`acts on: text`, `needs: ${(s.needs ?? []).join(", ") || "nothing"}`, `owns: ${s.owns ?? "nothing"}`]), s.organ),
    path: ans(j([s.route, rel.uses.length ? `uses ${rel.uses.map((u) => u.path).join(", ")}` : null]), s.organ), policies: ans(s.policies, s.organ),
    ontogeny: null, lineage: ans(`code in ${s.organ}`, s.organ), evidence: s.evidence ? ans(s.evidence.answer, s.evidence.from) : null,
  });
  if (s.kind === "reading rule") return define({
    purpose: ans(`read a measurement written in the shape ${f.head} without the ants or the picture`, "hard-read.json"), tension: ans(s.appliesWhen, "hard-read.json"),
    domain: ans("acts on: text; owns: this rule entry only", "hard-read.json"), path: ans(j([f.textRoute && `text: ${f.textRoute}`, f.imageRoute && `picture: ${f.imageRoute}`]), "hard-read.json"),
    policies: ans("re-checked against its own bytes on every use; can be conceded; never rewritten in place", "organs/hard-read.js (applyRule, concedeRule)"),
    ontogeny: ans(j([f.foundAt && `found ${iso(f.foundAt)}`, f.foundVia && `via ${f.foundVia}`, f.regions && `${f.regions} regions`]), "hard-read.json"),
    lineage: ans("learned on this instance, under route:hard-read", "hard-read.json"), evidence: ans(s.evidence, "hard-read.json"),
  });
  if (s.kind === "layout rule") return define({
    purpose: ans(s.route, "layout-conventions.json"), tension: ans(s.appliesWhen, "layout-conventions.json"), domain: ans("acts on: text pages; owns: nothing", "layout-conventions.json"),
    path: ans(s.evidence, "layout-conventions.json"), policies: null, ontogeny: ans(s.evidence?.match(/found via .*/)?.[0], "layout-conventions.json"),
    lineage: ans(s.standing, "layout-conventions.json"), evidence: null,
  });
  if (s.kind === "form") return define({
    purpose: ans(s.route, "form-priors.jsonl"), tension: ans(s.appliesWhen, "form-priors.jsonl"), domain: ans("acts on: documents; owns: nothing", "form-priors.jsonl"),
    path: ans(s.route, "form-priors.jsonl"), policies: null, ontogeny: ans(s.evidence, "form-priors.jsonl"), lineage: null, evidence: ans(s.standing, "form-priors.jsonl"),
  });
  if (s.kind === "procedure") return define({
    purpose: ans(s.route, s.address), tension: ans(s.appliesWhen, s.address), domain: ans(`needs: ${(s.needs ?? []).join(", ") || "nothing"}`, s.address),
    path: ans(s.route, s.address), policies: ans(s.evidence, s.address), ontogeny: null, lineage: null, evidence: ans(s.standing, s.address),
  });
  // a received prior
  const pol = j([f.declared?.scope && `scope: ${f.declared.scope}`, f.declared?.backoff && `backoff: ${f.declared.backoff}`, f.refusals && `refuses: ${JSON.stringify(f.refusals).slice(0, 160)}`, s.caveat && `limitation: ${s.caveat}`]);
  const ec = f.evidenceCounts ? Object.entries(f.evidenceCounts).filter(([, v]) => v != null && typeof v !== "object").map(([k, v]) => `${k} ${v}`) : [];
  return define({
    purpose: ans(s.route, `derived-priors/${s.kind}/README.md`), tension: s.appliesFrom ? ans(s.appliesWhen, `${s.title}.json#${s.appliesFrom}`) : null,
    domain: ans(j([`acts on: ${s.appliesWhen}`, `needs: ${s.schema ?? "its own schema"}`, "owns: nothing (a received prior is read-only data)"]), `${s.title}.json`),
    path: consumers.length ? ans(`consumed by ${consumers.join(", ")}`, "the code (skill-relations.js scan)") : null,
    policies: ans(pol, `${s.title}.json`), ontogeny: ans(j([f.builtAt && `built ${f.builtAt}`, f.builtBy && `by ${f.builtBy}`, f.history != null && `${f.history} dated history entries`]), `${s.title}.json`),
    lineage: ans(j([s.giver, f.builtFrom && `built from ${JSON.stringify(f.builtFrom).slice(0, 120)}`]), `${s.title}.json`), evidence: ec.length ? ans(`measured over ${ec.join(", ")}`, `${s.title}.json`) : null,
  });
}

/** governanceOf(s, { state, usage, children }) — Ostrom's principles as things a person can read and act on. */
export function governanceOf(s, { state, usage, rel, children }) {
  const u = usage ?? null;
  const rung = ladderOf(state, { conceded: s.conceded, earned: !/provisional/.test(s.standing ?? "") });
  return {
    authority: { answer: `may be changed by a named person only (human:<name>); a received update never resets a local decision${state.decided ? `; last decided by ${state.by}${state.why ? ` — ${state.why}` : ""}` : "; not yet decided here (default: on)"}`, principle: "1 boundaries · 3 collective choice · 7 recognised right to organise" },
    fit: { answer: u ? `fired ${u.fired}× on this instance across ${u.sources.length} source(s): ${u.accepted} accepted, ${u.refused} refused${u.hitRate != null ? ` (hit rate ${(u.hitRate * 100).toFixed(0)}%)` : ""}${u.judged ? `, ${u.judged} judged` : ""}` : `never fired on this instance — its fit to THIS content is unmeasured${s.giver ? `; it was built elsewhere (${s.giver.slice(0, 80)})` : ""}`, principle: "2 congruence with local conditions" },
    monitoring: { answer: u?.lastAt ? `last fired ${iso(u.lastAt)}; every firing is on an append-only record` : "no firing recorded yet", principle: "4 monitoring" },
    sanctions: { answer: `standing: ${rung.rung}${state.flags.length ? ` — ${state.flags.length} flag(s): ${state.flags.map((x) => x.why).join(" | ").slice(0, 200)}` : ""}${state.offBecause ? ` — ${state.offBecause}` : ""}`, rung: rung.rung, principle: "5 graduated sanctions (standing → flagged → conceded → off)" },
    resolution: { answer: s.resolution ?? null, principle: "6 conflict resolution" },
    nesting: { answer: j([s.parent && `nested under ${s.parent}`, children.length && `contains ${children.length} learned rule(s)`, s.circle && `circle: ${s.circle}`]) || null, principle: "8 nested enterprises" },
  };
}
