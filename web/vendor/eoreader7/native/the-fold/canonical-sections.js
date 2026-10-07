// canonical-sections.js — WALKING BACKWARD FROM A REAL DEFINITION
// (2026-09-22).
//
// The user, after "@0:first=title" and a handful of typographic facts:
// "that so does not teach me how to write a white paper. ok go get the
// definition of a white paper and its structure from online, and walk
// backwards to what we would need to do to extract something like that
// from the data." — then, after WHITE_PAPER_SECTIONS below was hand-typed
// from sources I read myself: "this is about learning how to learn more
// than white papers." huntDeclaredStructure, further down, is that: given
// ANY form name, hunt several real external "how to write a ___" guides
// (surf.js's own multi-host search), read each one with the SAME reader
// every other document in this engine goes through (medium.js's
// elementsOf), and keep only the section-name headings that recur across
// MULTIPLE INDEPENDENT pages — the same corroboration floor
// kernel/kind-universe.js already holds everywhere else (a claim from one
// source is provisional; from two DISTINCT sources, corroborated). No
// hand-typed vocabulary required — the vocabulary itself becomes a
// measured, sourced, re-derivable thing.
//
// Everything measured until now (learnParadigmEmergent, necessaryFacts)
// was BLIND induction from typography alone — headings, indentation,
// punctuation. None of that can ever find "has an executive
// summary," because that is not a typographic fact, it is a LEXICAL one:
// does a heading's own TEXT name a known structural role.
//
// THE DEFINITION (real, fetched live 2026-09-22, corroborated across
// independent sources — never invented): a marketing/business white paper
// has eight roles, in this order —
//   Brafton, "How To Write a White Paper": brafton.com/blog/creation/how-to-write-a-white-paper
//   corroborated by (same eight roles, same order, independently):
//   Turtl (turtl.co), EduBirdie (edubirdie.com), Content Marketing
//   Institute (contentmarketinginstitute.com), ActiveCampaign
//   (activecampaign.com), Mojenta (mojenta.com), Weblium (weblium.com),
//   Venngage (venngage.com), Paperflite (paperflite.com).
// The vocabulary below is a DECLARED prior, sourced exactly as above —
// never presented as something this engine measured. What IS measured,
// by matchCanonicalSections/canonicalStructureCoverage, is whether a REAL
// document's own headings actually name these roles, and in what order —
// a mechanical, checkable fact about the bytes, using a hand-curated but
// disclosed vocabulary, the same way kernel/pos-*.json priors are declared
// grammars, not measurements.
export const WHITE_PAPER_SECTIONS = Object.freeze([
  { role: "title", order: 0 }, // handled specially: the document's own first heading/line, not matched by pattern
  { role: "executive-summary", order: 1, patterns: [/executive\s+summary/i, /^summary$/i, /^overview$/i, /\btl;?dr\b/i] },
  { role: "introduction", order: 2, patterns: [/^introduction$/i, /^background$/i, /^context$/i] },
  { role: "problem", order: 3, patterns: [/\bthe\s+problem\b/i, /\bchallenge/i, /\bthe\s+issue\b/i, /^problem\s+statement$/i] },
  { role: "evidence", order: 4, patterns: [/\bresearch\b/i, /\bfindings\b/i, /\bdata\b/i, /\bcase\s+stud/i, /\bmethodology\b/i] },
  { role: "solution", order: 5, patterns: [/\bsolution/i, /\bour\s+approach\b/i, /\bhow\s+it\s+works\b/i, /\bproposed\b/i] },
  { role: "conclusion", order: 6, patterns: [/^conclusion/i, /\bkey\s+takeaway/i, /^summary$/i] },
  { role: "cta", order: 7, patterns: [/\bcall\s+to\s+action\b/i, /\bcontact\s+us\b/i, /\bnext\s+steps\b/i, /\bget\s+started\b/i, /\brequest\s+a\s+demo\b/i, /\blearn\s+more\b/i] },
]);

/** Every heading element in a unit, in document order. */
function headingsOf(unit) {
  const elements = Array.isArray(unit) ? unit : unit?.elements ?? [];
  return elements.filter((e) => e?.cls === "heading" && typeof e.text === "string");
}

/**
 * matchCanonicalSections(unit, vocabulary) →
 *   { hasTitle, matched: [{ role, order, headingIndex, text }], missing: [role,…] }
 * A heading's text is tested against each role's patterns in declaration
 * order; the FIRST heading to match a role wins that role (a document
 * that says "Summary" twice doesn't get credited twice). "title" is
 * satisfied by the mere presence of any heading/first line — a document
 * either opens with something or it doesn't, no pattern needed.
 */
export function matchCanonicalSections(unit, vocabulary = WHITE_PAPER_SECTIONS) {
  const headings = headingsOf(unit);
  const matched = [];
  const claimed = new Set();
  for (const spec of vocabulary) {
    if (spec.role === "title") continue;
    for (let i = 0; i < headings.length; i++) {
      if (claimed.has(i)) continue;
      if (spec.patterns.some((re) => re.test(headings[i].text))) {
        matched.push({ role: spec.role, order: spec.order, headingIndex: i, text: headings[i].text });
        claimed.add(i);
        break;
      }
    }
  }
  matched.sort((a, b) => a.headingIndex - b.headingIndex);
  const hasTitle = headings.length > 0 || (Array.isArray(unit) ? unit.length > 0 : (unit?.elements?.length ?? 0) > 0);
  const foundRoles = new Set(matched.map((m) => m.role));
  const missing = vocabulary.filter((s) => s.role !== "title" && !foundRoles.has(s.role)).map((s) => s.role);
  // Order correctness: are the matched roles' own declared `order` values
  // non-decreasing in the order the headings actually appear? (a document
  // that puts "Call to Action" before "Executive Summary" fails this even
  // if both roles are present.)
  const orderOk = matched.every((m, i) => i === 0 || m.order >= matched[i - 1].order);
  return { hasTitle, matched, missing, orderOk, coverage: (hasTitle ? 1 : 0) + matched.length, total: vocabulary.length };
}

/**
 * canonicalStructureCoverage(instances, vocabulary) →
 *   { n, perRole: [{role, support}], meanCoverage, orderConsistency, basis }
 * Across many real instances: what fraction actually name each canonical
 * role, on average how many of the 8 roles are present, and how often
 * (among documents with 2+ matched roles) they appear in the right
 * relative order. This is the mechanical check for "is this the SAME KIND
 * of document the canonical definition describes" — a corpus that scores
 * near zero on this is honestly a DIFFERENT kind, not a defective
 * measurement.
 */
export function canonicalStructureCoverage(instances, vocabulary = WHITE_PAPER_SECTIONS) {
  const n = instances.length;
  if (n === 0) return { n: 0, perRole: [], meanCoverage: 0, orderConsistency: null, basis: "no instances" };
  const results = instances.map((u) => matchCanonicalSections(u, vocabulary));
  const roles = vocabulary.filter((s) => s.role !== "title");
  const perRole = roles.map((s) => ({ role: s.role, support: results.filter((r) => r.matched.some((m) => m.role === s.role)).length / n }));
  const meanCoverage = results.reduce((a, r) => a + r.coverage, 0) / n / vocabulary.length;
  const withMultiple = results.filter((r) => r.matched.length >= 2);
  const orderConsistency = withMultiple.length ? withMultiple.filter((r) => r.orderOk).length / withMultiple.length : null;
  return {
    n, perRole, meanCoverage, orderConsistency,
    basis: `${n} instance(s) checked against the ${vocabulary.length}-role canonical structure (declared, sourced — see this file's header); mean coverage ${(meanCoverage * 100).toFixed(0)}% of roles present${orderConsistency != null ? `, order-consistent in ${(orderConsistency * 100).toFixed(0)}% of the ${withMultiple.length} instance(s) with 2+ matched roles` : " (too few multi-role instances to check order)"}`,
  };
}

// ── huntDeclaredStructure: the vocabulary itself, hunted and corroborated ──
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A heading's text, mechanically normalized to a comparable term: leading
 *  step numbers stripped ("1.", "Step 3:"), lowercased, punctuation gone,
 *  whitespace collapsed. Two independently-authored pages that both say
 *  "Executive Summary" (however numbered or cased) normalize to the same
 *  term; two that don't share real vocabulary don't. */
function normalizeHeading(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/^\s*(\d+[.):]?|step\s*\d+[.:]?)\s*/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// A live run against "white paper" corroborated "skip to content" and
// "categories" across independent pages — not because they describe the
// FORM's structure, but because many sites share the same CMS/template
// chrome, which organs/web.js's extractReadable ("a reader, not a
// browser," its own disclosed limit) does not fully strip. A small,
// declared stoplist of common site-navigation vocabulary, excluded before
// corroboration is even tallied — disclosed here as exactly that, never
// presented as part of what was "discovered."
const CHROME_STOPLIST = new Set([
  "skip to content", "table of contents", "categories", "category", "tags", "tag",
  "comments", "leave a comment", "share this", "share", "subscribe", "search",
  "menu", "related posts", "related articles", "sidebar", "footer", "navigation",
  "privacy policy", "terms of service", "cookie policy", "newsletter", "follow us",
  // A SECOND live run (still 2026-09-22) found the first stoplist wasn't
  // enough: two DIFFERENT hosts (real cross-site independence, the host
  // fix above working correctly) still "corroborated" on generic top-nav
  // vocabulary that an entire industry of SaaS/marketing sites happens to
  // share — not because it names part of a white paper.
  // "solution" (singular) is deliberately NOT stoplisted: nav-chrome for a
  // product category is near-universally plural ("Solutions"), while a real
  // document's own proposed-answer section is singular ("Solution", "Our
  // Solution") — verified 2026-09-24 on two independent, on-topic sources
  // (Purdue OWL, InstructionalSolutions) that both use the singular for a
  // real content heading. Stoplisting the plural alone keeps the original
  // SaaS-nav fix without silently deleting real document structure.
  "home", "blog", "pricing", "products", "product", "solutions",
  "resources", "about", "about us", "contact", "contact us", "login", "log in",
  "sign up", "get started", "templates", "features", "pricing plans", "faq",
]);

/**
 * huntDeclaredStructure(topic, { web, search, fetch, maxPages, minCorroboration }) →
 *   { vocabulary, pagesUsed, basis }
 * Hunts real "how to write a TOPIC" / "TOPIC structure/format" pages
 * (surf.js's own multi-host search — the SAME hunt mechanism learn-pass.js
 * already uses for instances), reads each with medium.js's elementsOf (the
 * SAME reader every document in this engine goes through), and keeps a
 * heading's normalized term only when it recurs on at least
 * `minCorroboration` DISTINCT HOSTS (organs/web.js's hostOf, not merely
 * distinct URLs — a live run found two pages on the SAME site, e.g. a
 * blog's homepage and one of its articles, sharing nav/sidebar chrome
 * that then wrongly "corroborated" itself; they are not independent
 * evidence) — kernel/kind-universe.js's own corroboration floor, never a
 * single confident-looking source. The
 * resulting vocabulary is in the exact shape matchCanonicalSections/
 * canonicalStructureCoverage already consume — no hand-typed vocabulary
 * required to check ANY form's real structure, not only a white paper's.
 * Pages with fewer than 3 headings are skipped (too little structure to
 * trust as a "how it's organized" guide rather than a stray page).
 */
export async function huntDeclaredStructure(topic, { web = null, search = null, fetch = null, maxPages = 8, minCorroboration = 2, learn = false } = {}) {
  // OPT-IN, default false: existing callers and every test in
  // canonical-sections-falsify.test.mjs are byte-identical to before this
  // was added, since none of them pass `learn`. When a caller DOES pass
  // `learn: true` (the pipeline's own void-spec.js is meant to), a form
  // already folded from a real prior observation (form-priors.js -- never
  // hand-typed, see that file's own header) is returned without spending a
  // fresh hunt; otherwise this hunts exactly as before and the real result
  // is appended to the log, so the NEXT ask about the same form benefits.
  if (learn) {
    const { foldFormPrior } = await import("./form-priors.js");
    const prior = foldFormPrior(topic);
    if (prior && prior.roles.length) {
      return { vocabulary: prior.vocabulary, pagesUsed: 0, hostsUsed: 0, sources: [], fromPrior: true, basis: `not hunted this call — ${prior.basis}` };
    }
  }
  const { elementsOf } = await import("./medium.js");
  const { surf, liveWeb } = await import("./surf.js");
  const { hostOf } = await import("../organs/web.js");
  const w = web ?? liveWeb();
  const queries = [
    { hunt: "structure", q: `how to write a ${topic} structure sections`, basis: `real, external structural guides for "${topic}"` },
    { hunt: "structure", q: `${topic} format template sections example`, basis: `an alternate phrasing, so the hunt is not one query's own idiosyncrasy` },
  ];
  const s = await surf({ spec: {}, search: search ?? w.search, fetch: fetch ?? w.fetch, queries, maxSources: maxPages });
  const perPage = [];
  for (const src of s.sources) {
    if (src.status !== "fetched" || !src.chars) continue;
    const headings = elementsOf(src.text).elements.filter((e) => e.cls === "heading" && e.text);
    if (headings.length < 3) continue;
    perPage.push({ url: src.url, host: hostOf(src.url) ?? src.url, headings: headings.map((h, i) => ({ text: h.text, order: headings.length > 1 ? i / (headings.length - 1) : 0 })) });
  }
  const bySlug = new Map();
  for (const page of perPage) {
    const seenOnThisPage = new Set();
    for (const h of page.headings) {
      const norm = normalizeHeading(h.text);
      const wordCount = norm.split(" ").filter(Boolean).length;
      if (norm.length < 3 || wordCount === 0 || wordCount > 6 || seenOnThisPage.has(norm) || CHROME_STOPLIST.has(norm)) continue;
      seenOnThisPage.add(norm);
      if (!bySlug.has(norm)) bySlug.set(norm, { rawTexts: new Set(), pages: new Set(), orders: [] });
      const rec = bySlug.get(norm);
      rec.rawTexts.add(h.text);
      rec.pages.add(page.host);
      rec.orders.push(h.order);
    }
  }
  const corroborated = [...bySlug.entries()]
    .filter(([, rec]) => rec.pages.size >= minCorroboration)
    .map(([slug, rec]) => ({
      slug, meanOrder: rec.orders.reduce((a, b) => a + b, 0) / rec.orders.length,
      corroboratedBy: rec.pages.size, exampleText: [...rec.rawTexts][0],
      pattern: new RegExp(slug.split(" ").map(escapeRe).join("\\s+"), "i"),
    }))
    .sort((a, b) => a.meanOrder - b.meanOrder);
  const vocabulary = [
    { role: "title", order: 0 },
    ...corroborated.map((c, i) => ({ role: c.slug.replace(/\s+/g, "-"), order: i + 1, patterns: [c.pattern], corroboratedBy: c.corroboratedBy, exampleText: c.exampleText })),
  ];
  const hostsUsed = new Set(perPage.map((p) => p.host)).size;
  const result = {
    vocabulary, pagesUsed: perPage.length, hostsUsed, sources: perPage.map((p) => p.url),
    basis: `${perPage.length} real page(s) across ${hostsUsed} distinct host(s) (of ${s.sources.length} fetched) had >= 3 headings and were read; ${corroborated.length} section-name term(s) corroborated across >= ${minCorroboration} distinct HOSTS: ${corroborated.map((c) => c.exampleText).join(", ") || "none"}`,
  };
  // Preserve half of the same protocol swarm-server.mjs/content-rules.mjs
  // already use for hard-meaning content types, applied here to a form's
  // structure: a REAL hunt's result is appended so the next `learn: true`
  // caller for the same form does not have to hunt again. Only fires on a
  // hunt this function itself just ran — never on a caller-supplied
  // `vocabulary` and never on a test's injected fixtures (learn defaults
  // false, see the guard above).
  if (learn) {
    const { appendFormObservation } = await import("./form-priors.js");
    appendFormObservation({ form: topic, vocabulary: result.vocabulary, pagesUsed: result.pagesUsed, hostsUsed: result.hostsUsed, sources: result.sources, basis: result.basis, giver: "huntDeclaredStructure" });
  }
  return result;
}
