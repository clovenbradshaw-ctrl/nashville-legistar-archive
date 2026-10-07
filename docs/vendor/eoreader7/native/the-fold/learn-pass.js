// learn-pass.js — the mechanical hunt+learn pass (2026-09-22), pulled out of
// expertise-surface.mjs so it has exactly ONE implementation shared by every
// entry point: the chat surface, expertise-run.mjs, and expertise-agent.js's
// autonomous loop. `onEvent(event, data)` is an optional progress callback
// (SSE broadcast, or the default no-op) — the logic never depends on
// whether anything is listening, and never changes because of who is.
import { surfQueries, surf, liveWeb } from "./surf.js";
import { segmentCollection, elementsOf } from "./medium.js";
import { learnParadigmEmergent } from "./paradigm.js";
import { learnForm, emergentFacts, necessaryFacts } from "./form-prior.js";
import { loadExpertise, saveExpertise, recordExpertise, projectExpertise, expertiseLines, recordBelief } from "./expertise.js";
import { readPdf, isPdfUrl } from "./pdf-read.js";
import { createHolograph, admit } from "../kernel/bayes-surprise.js";

/** The relative ground for a FORM hunt: text that is NOT an instance of it —
 *  ordinary writing, unrelated to `topic` by construction (the query never
 *  contains the topic word), so the comparison is a genuine neighbour, not
 *  the form's own subject matter under a different name. */
export function populationQueries() {
  return [
    { hunt: "population", q: "example of ordinary written prose", basis: "everyday writing, not shaped by any particular form — the null the hunt is measured against" },
    { hunt: "population", q: "excerpt from a news article full text", basis: "a second, differently-sourced neighbour, so the ground is not one genre's own habits" },
  ];
}

const noop = () => {};

// ── multiple grounds (2026-09-22) ───────────────────────────────────────
// The user: "a lot of the most important information about what a white
// paper is may arise from the way in which white papers are different from
// one another in a way that is different from other random writing or even
// academic writing … many grounds to zero upon, all adjusting based on
// where you're looking from." One ground (plain, unrelated prose) only
// proves "this is shaped/formal writing at all." A SECOND, nearer ground —
// general-purpose, never a hand-picked category like "academic writing" —
// is built mechanically from the SAME exemplar search: it over-fetches, and
// the candidates that were NOT used as instances (found by the identical
// query, at a lower rank) become the "adjacent" ground: real material the
// search itself judged similarly relevant, but not confirmed instances of
// the form. A feature that survives against BOTH grounds is the stronger,
// more specific signal (distinguishes the form even from its own
// neighbours); one that only survives against plain prose is the weaker,
// broader one. Pure and exported so this reasoning is testable without a
// live search.

/** Splits fetched pages (already in rank order) into an instances half and
 *  an adjacent-ground half. Only splits when there is enough for BOTH sides
 *  to meet paradigm.js's own minimum (5) — otherwise everything stays
 *  instances and no adjacent ground is offered (never a fabricated one). */
export function splitForGrounds(pages, { minEach = 5 } = {}) {
  const half = Math.floor(pages.length / 2);
  if (half < minEach) return { instancePages: pages, adjacentPages: [] };
  return { instancePages: pages.slice(0, pages.length - half), adjacentPages: pages.slice(pages.length - half) };
}

/** Tags each of `farFeatures` with which ground(s) it survives: "far" always
 *  (it was measured against the far ground to exist at all), plus "near"
 *  when the SAME key also appears among `nearFeatures` (that paradigm run's
 *  own compressed OR pre-compression `all` set, so a fold on one side still
 *  counts as surviving on the other). Mutates and returns `farFeatures`. */
export function tagGroundedAt(farFeatures, nearParadigm) {
  const nearKeys = nearParadigm ? new Set([...(nearParadigm.features ?? []), ...(nearParadigm.all ?? [])].map((f) => f.key)) : null;
  for (const f of farFeatures) f.groundedAt = nearKeys ? (nearKeys.has(f.key) ? ["far", "near"] : ["far"]) : ["far"];
  return farFeatures;
}

// ── an INSTANCE is one whole document, never a fragment ────────────────────
// The user: "we don't know what's meaningful about that white paper until
// we read a BUNCH of white papers and compare them to each other." One
// fetched page/PDF is one instance of the form, full stop — segmentCollection
// is never run to mine several "instances" out of a single document (that
// was the live bug: one NeurIPS paper's own numbered sections, mistaken for
// 9 separate short items). Reaching the required minimum means reading more
// DISTINCT real documents, never slicing one more finely.
export function toInstanceUnits(pages) {
  return pages.map(({ url, text }) => ({ id: url, elements: elementsOf(text).elements })).filter((u) => u.elements.length >= 2);
}

// ── surprise activation (2026-09-22) ────────────────────────────────────
// The user, earlier this session: "we need the bayesan surprise as the
// delta to the holograph" — kernel/bayes-surprise.js was built for exactly
// this and, until now, was never wired into the expertise pipeline. Reading
// N real instances of a form ONE AT A TIME into a Dirichlet holograph and
// tracking each admission's Bayesian surprise (belief CHANGE, not just
// unexpectedness) is the mechanical form of "compare them to each other":
// early readings surprise the holograph a lot (it knows nothing yet); a
// genuinely recurring slot's surprise should fall as more real instances
// corroborate it. A slot whose surprise does NOT fall is not yet earned —
// disclosed, never hidden.
export function surpriseActivation(instances) {
  if (instances.length < 2) return null;
  const holo = createHolograph({ alpha: 1, gamma: 1 });
  const perInstanceBayes = [];
  for (const u of instances) perInstanceBayes.push(admit(holo, emergentFacts(u)).bayes);
  const half = Math.floor(instances.length / 2);
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const early = mean(perInstanceBayes.slice(0, half)), late = mean(perInstanceBayes.slice(half));
  return {
    admissions: instances.length,
    perInstanceBayes: perInstanceBayes.map((b) => +b.toFixed(3)),
    meanBayesEarlyHalf: +early.toFixed(3), meanBayesLateHalf: +late.toFixed(3),
    stabilizing: late < early,
    basis: `${instances.length} instance(s) admitted one at a time: mean Bayesian surprise ${early.toFixed(2)} bits (first ${half}) → ${late.toFixed(2)} bits (last ${instances.length - half})${late < early ? " — falling: later readings corroborate rather than surprise" : " — NOT falling: this form has not stabilized on this few readings"}`,
  };
}

// ── the running belief log (2026-09-22) ─────────────────────────────────
// The user: "competency without surprise is nothing, make sure the archon
// understands that and has a running log of what they believe competency
// is." Not a claim about ANY ONE form — a standing position this archon
// holds about what competency itself requires, updated from real runs'
// own numbers, mechanical (never the model inventing a lesson it wasn't
// handed). Returns null when a run taught nothing new about competency
// itself (an ordinary confirmed corroboration, nothing surprising).
export function beliefFromRun(topic, outcome) {
  if (outcome.refused && outcome.reason === "under_powered") {
    return { statement: `Competency in "${topic}" cannot come from one reading. Only ${outcome.instances} real instance(s) were found — too few to know what recurs, let alone what's surprising.`, evidence: outcome };
  }
  if (outcome.refused && outcome.reason === "no_null") {
    return { statement: `A shape without a relative ground is not competency, only description. "${topic}" had ${outcome.instances} instance(s) but only ${outcome.population} comparison text(s) — nothing to be surprised AGAINST yet.`, evidence: outcome };
  }
  if (outcome.ok && outcome.activation) {
    return outcome.activation.stabilizing
      ? { statement: `Reading more instances of "${topic}" one at a time made later readings LESS surprising (${outcome.activation.meanBayesEarlyHalf}→${outcome.activation.meanBayesLateHalf} bits) — this is what corroboration actually looks like: not a rule asserted once, but surprise falling as more real examples agree.`, evidence: outcome.activation }
      : { statement: `"${topic}" has not stabilized on ${outcome.activation.admissions} reading(s) — later instances were not measurably less surprising than earlier ones (${outcome.activation.meanBayesEarlyHalf}→${outcome.activation.meanBayesLateHalf} bits). Competency here is still provisional, honestly, not asserted past what was actually corroborated.`, evidence: outcome.activation };
  }
  return null;
}

// A form's shape can genuinely pivot on the stance it's read under (the
// user: "writing a competent white paper for the tech sector is different
// than for food science"). `stance`, when given, does two things — never
// one: (1) it becomes part of the STORED NAME (`topic — stance`), so a
// stance-scoped paradigm is its OWN record, never silently averaged into
// the unscoped one; (2) it adds stance-scoped exemplar queries ALONGSIDE
// the bare-topic ones (never replacing them), because surf.js's own
// documented finding is that an incidental subject folded into the
// exemplar query pulls in subject-matter pages instead of form examples —
// here the "subject" is exactly what's being deliberately asked for, so
// it is added as its own explicit query, not smuggled into the bare one.
export function stanceQueries(topic, stance) {
  if (!stance) return [];
  return [
    { hunt: "exemplars", q: `${stance} ${topic} examples full text`, basis: `real instances of "${topic}" specifically within "${stance}" — a stance-scoped exemplar query, alongside the bare-topic one, never in place of it` },
    { hunt: "exemplars", q: `what is a ${topic} for ${stance}`, basis: `the form-word in its own question form, scoped to the stance` },
  ];
}

/**
 * runLearnPass({ topic, stance, sourceUrls, populationUrls, source, onEvent }) →
 *   { ok:true, status, corroboration, confirmed, instances, population, lines }
 *   | { refused:true, reason, instances, population, basis? }
 *
 * sourceUrls/populationUrls, when given, are read directly (a person's own
 * pasted links). When either is omitted, the hunt runs itself: surf.js's
 * own multi-query, multi-host swarm search (surfQueries for instances,
 * stanceQueries() above too when a stance is given, populationQueries()
 * above for the ground) — the search query is built ONLY from `topic`/
 * `stance`, never from any chat text or free-form message.
 */
export async function runLearnPass({ topic, stance = null, sourceUrls = [], populationUrls = [], source, onEvent = noop }) {
  const name = stance ? `${topic} — ${stance}` : topic;
  onEvent("status", { phase: "surf", topic, stance });
  const web = liveWeb();
  // A .pdf URL is routed through pdf-read.js (pdftotext + vision-assisted
  // pages for anything that doesn't extract cleanly) instead of the HTML
  // reader — same shape returned ({title, text, chars, headings}) so every
  // caller below (the manual `read`, and `surf`'s own `fetch`) is unchanged.
  const fetchAny = async (url) => {
    if (!isPdfUrl(url)) return web.fetch(url);
    const r = await readPdf({ url, onPage: (p) => onEvent("absorb", { url, hunt: null, phase: "vision", ...p }) });
    onEvent("absorb", { url, hunt: null, phase: "pdf", pages: r.pages, flagged: r.flaggedPages.length, looked: r.visionPages.length, basis: r.basis });
    return { title: r.title, text: r.text, chars: r.chars, headings: [] };
  };
  const read = async (urls, hunt) => {
    const out = [];
    for (const url of urls) {
      onEvent("absorb", { url, hunt, phase: "fetching" });
      let page;
      try { page = await fetchAny(url); } catch (e) { onEvent("absorb", { url, hunt, phase: "failed", error: String(e?.message ?? e).slice(0, 200) }); continue; }
      onEvent("absorb", { url, hunt, phase: "read", chars: page.text.length, title: page.title, excerpt: page.text.slice(0, 1200) });
      out.push({ url, text: page.text });
    }
    return out;
  };
  const hunted = new Set();
  const swarm = async (queries, hunt, maxSources = 6) => {
    onEvent("status", { phase: "hunting", hunt, topic });
    const s = await surf({ spec: { topic: null, form: { token: topic } }, search: web.search, fetch: fetchAny, queries, maxSources });
    onEvent("hunt", { hunt, topic, basis: s.basis, found: s.candidates, fetched: s.fetched, hosts: s.hosts });
    const pages = [];
    for (const src of s.sources) {
      if (src.status !== "fetched" || !src.chars) { onEvent("absorb", { url: src.url, hunt, phase: "failed", error: src.error ?? "no text" }); continue; }
      hunted.add(src.url);
      onEvent("absorb", { url: src.url, hunt, phase: "read", chars: src.chars, title: src.pageTitle, excerpt: src.text.slice(0, 1200) });
      pages.push({ url: src.url, text: src.text });
    }
    return { pages, basis: s.basis };
  };
  // A pasted link is a SEED, never the whole corpus: "we don't know what's
  // meaningful about that [one document] until we read a bunch of them and
  // compare them to each other." The swarm ALWAYS hunts for more real,
  // distinct documents (over-fetched, 12, so splitForGrounds has enough for
  // a second, nearer ground too) — a person's own links are added as extra,
  // guaranteed-real seed instances, not a substitute for the hunt.
  const seedPages = sourceUrls.length ? await read(sourceUrls, "instances") : [];
  const huntedPages = (await swarm([...surfQueries({ topic: null, form: { token: topic } }), ...stanceQueries(topic, stance)], "instances", 12)).pages;
  const { instancePages: huntedInstancePages, adjacentPages } = splitForGrounds(huntedPages);
  const instancePages = [...seedPages, ...huntedInstancePages];
  const popPages = populationUrls.length ? await read(populationUrls, "population") : (await swarm(populationQueries(), "population")).pages;
  const huntedUrls = [...hunted];
  const toGroundUnits = (pages) => pages.flatMap(({ url, text }) => {
    const seg = segmentCollection(text);
    return seg.units.length > 1 ? seg.units.map((u) => ({ ...u, id: `${url}#${u.id}` })) : [{ id: url, elements: elementsOf(text).elements }];
  }).filter((u) => u.elements.length >= 2);
  // Instances/adjacent are NEVER segmentCollection-split (toInstanceUnits,
  // above) — one real document is one instance. The far ground alone still
  // uses segmentCollection (population material is not what's being defined,
  // and is often genuinely a multi-item page, e.g. several news blurbs).
  const instances = toInstanceUnits(instancePages), population = toGroundUnits(popPages), adjacent = toInstanceUnits(adjacentPages);
  onEvent("status", { phase: "learning", topic, instances: instances.length, population: population.length, adjacent: adjacent.length });
  const ex = loadExpertise();
  const recordAndSaveBelief = (outcome) => { const b = beliefFromRun(name, outcome); if (b) { recordBelief(ex, { ...b, giver: "mechanical:runLearnPass" }); saveExpertise(ex); onEvent("belief", b); } return outcome; };
  if (instances.length < 5 || population.length < 5) {
    const reason = instances.length < 5 ? "under_powered" : "no_null";
    onEvent("status", { phase: "refused", reason, instances: instances.length, population: population.length });
    return recordAndSaveBelief({ refused: true, reason, instances: instances.length, population: population.length });
  }
  const paradigm = learnParadigmEmergent({ name, instances, population });
  if (paradigm.refused) {
    onEvent("status", { phase: "refused", reason: paradigm.refused, basis: paradigm.basis });
    return recordAndSaveBelief({ refused: true, reason: paradigm.refused, basis: paradigm.basis, instances: instances.length, population: population.length });
  }
  // The second, nearer ground (see splitForGrounds/tagGroundedAt above): run
  // only when the over-fetch actually yielded enough, and its own refusal
  // never fails the whole pass — the far ground alone is still a complete,
  // honest result, just without the extra tier of distinction.
  let nearParadigm = null;
  if (adjacent.length >= 5) {
    const np = learnParadigmEmergent({ name, instances, population: adjacent });
    if (!np.refused) nearParadigm = np;
    onEvent("status", { phase: "near-ground", topic, adjacent: adjacent.length, used: !!nearParadigm, reason: np.refused ?? null });
  }
  tagGroundedAt(paradigm.features, nearParadigm);
  // Surprise activation: a FRESH holograph (this engine has no prior belief
  // about "name" — it may be reading its first one) admits the real
  // instances one at a time, in the order they were found; the ledger
  // carries whether later readings corroborated (surprise fell) or the form
  // has not yet stabilized on this few readings — computed, not asserted.
  const activation = surpriseActivation(instances);
  const formPrior = learnForm(instances, { slots: "emergent" });
  // "what do all X have that other things may or may not have?" (2026-09-22)
  // — the WITHIN-KIND question, no ground required. Computed alongside the
  // contrastive paradigm above, never in place of it: a fact can be
  // necessary to the kind and still fail to distinguish it from the ground
  // (this is exactly what the contrastive pass alone was silently
  // discarding). necessaryFacts refuses under 5 instances the same way
  // learnParadigmEmergent does; a refusal here is disclosed, not hidden.
  const necessity = necessaryFacts(instances);
  const before = projectExpertise(ex, name);
  const allUrls = [...sourceUrls, ...huntedUrls];
  const groundNote = nearParadigm
    ? `2 grounds: ${population.length} plain-prose (far) + ${adjacent.length} other material the search also found (near/adjacent) — ${paradigm.features.filter((f) => f.groundedAt?.includes("near")).length}/${paradigm.features.length} feature(s) hold against both`
    : `1 ground: ${population.length} plain-prose (far)${adjacent.length ? ` — ${adjacent.length} adjacent candidate(s) found but too few or refused for a second ground` : ""}`;
  const r = recordExpertise(ex, {
    name, paradigm, formPrior,
    source: source || allUrls.join(","),
    note: `${instances.length} instance(s) via the surface (${sourceUrls.length ? "pasted" : "hunted"} examples, ${populationUrls.length ? "pasted" : "hunted"} ground)${stance ? `; stance: "${stance}"` : ""}; ${groundNote}${activation ? `; ${activation.basis}` : ""}`,
    sources: instancePages.map((p) => ({ url: p.url, text: p.text })),
    activation, necessity,
  });
  saveExpertise(ex);
  onEvent("ledger", { topic, stance, name, revision: (before?.revision ?? 0) + 1, status: r.status, corroboration: r.corroboration, confirmed: r.confirmed, lines: expertiseLines(ex, name) });
  onEvent("status", { phase: "done", topic, status: r.status, corroboration: r.corroboration, confirmed: r.confirmed });
  return recordAndSaveBelief({ ok: true, refused: false, name, topic, stance, status: r.status, corroboration: r.corroboration, confirmed: r.confirmed, instances: instances.length, population: population.length, grounds: nearParadigm ? 2 : 1, activation, lines: expertiseLines(ex, name) });
}
