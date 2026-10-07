// claims.js — the claim ledger: ONE epistemic state per checkable claim.
//
// Born from a measured failure (2026-08-17): the relation tier's badge said
// "not in the material" while the web check — same turn, same claim — had
// counted 2 of 3 pages stating it, and the two verdicts never met. Each
// organ was honest; the instrument as a whole did not know what it knew.
// This module is the mechanical fix, the same discipline the self plane
// already proved (reflex.js: a ledger of acts, written by code, never
// authored by a model): every tier NOTES its verdict onto the claim's one
// record, every surface renders a PROJECTION of that record, and a later
// check can read what an earlier one established.
//
// Pure: no DOM, no IO, no model. Append-only in operation: notes accumulate
// (seq, not clock); per aspect the LATEST note is the standing state — a
// verdict is the result of a whole check, never an increment. Listeners
// fire per key so a surface can redraw when any tier lands.
//
// The key is the claim's own content words, joined — the SAME construction
// proofTargets dedupes on and the edge badges stamp, held here once so no
// two callers can drift apart on what "the same claim" means.

// ── the ontology: claims are not one kind of thing ──────────────────────────
// An ATOM ("70,000", "Kutuzov") is an ingredient — not truth-apt alone; its
// check is containment. A RELATION ("Napoleon led the French") is a claim
// about the world; its check is binding. A DISCOURSE claim ("a matter of
// much debate", "estimates vary") is a claim about the LITERATURE — its
// truthmaker is the state of accounts, so a single account can never settle
// it, however complete. Measured live 2026-08-17: "a matter of much debate"
// flagged "not in the material" by a tier that was never licensed to judge
// it — one pasted paragraph is one account, and whether something is
// debated is a question about many. The nature travels on the state so
// every projection can phrase the right question.
//
// The set is closed and tiny, like holon.js's ACT_WORDS: words that name
// acts of discourse — debating, estimating, reporting — never events. A
// claim whose every content word is discourse-or-question-furniture is
// about the discourse; one word of world-content makes it a world claim.
const DISCOURSE_WORDS = new Set([
  "debate", "debated", "debates", "dispute", "disputed", "controversy",
  "controversial", "consensus", "scholars", "historians", "sources",
  "accounts", "estimates", "estimated", "believed", "claimed", "reported",
  "according", "matter", "question", "uncertain", "unclear", "varies",
  "varying", "ranging", "interpretations",
]);
const FURNITURE = new Set(["the", "a", "an", "of", "is", "was", "are", "were", "much", "very", "more", "most", "many", "some"]);

export function claimNature(claim) {
  const words = String(claim?.text ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !FURNITURE.has(w));
  if (!words.length) return "about-the-world";
  return words.every((w) => DISCOURSE_WORDS.has(w)) ? "about-the-discourse" : "about-the-world";
}

export function claimKey(claim) {
  const tokens = claim?.tokens?.length
    ? claim.tokens
    : String(claim?.text ?? "")
        .split(/\s+/)
        .filter((w) => w.length > 2);
  return tokens.map((t) => String(t).toLowerCase()).join(" ");
}

export function createClaimLedger() {
  const entries = [];
  const byKey = new Map();
  const listeners = new Map();

  const fire = (key) => {
    const state = byKey.get(key);
    for (const fn of listeners.get(key) ?? []) fn(state);
  };

  return {
    /** Append one tier's verdict for a claim. `aspect` names the tier
     * ("material" | "corroboration" | "web" | "primary" | "echo");
     * `payload` is that tier's own result shape, carried whole. */
    note(claim, aspect, payload) {
      const key = claimKey(claim);
      if (!key) return null;
      const prev = byKey.get(key) ?? {
        key,
        kind: claim?.kind ?? null,
        nature: claimNature(claim),
        text: claim?.text ?? null,
        sentence: claim?.sentence ?? null,
        revisions: [],
      };
      // Revision is a first-class event: a later check CHANGING an aspect's
      // verdict is belief updating in the open, and the record keeps the
      // from→to — the raw material a surprise meter measures (the engine's
      // emergence/surprise.js is the licensed instrument; this ledger only
      // keeps the honest events it would read).
      const fromVerdict = prev[aspect]?.verdict ?? null;
      const toVerdict = payload?.verdict ?? null;
      const revised = fromVerdict !== null && fromVerdict !== toVerdict;
      entries.push({ seq: entries.length + 1, key, aspect, payload, ...(revised ? { revised: { from: fromVerdict, to: toVerdict } } : {}) });
      byKey.set(key, {
        ...prev,
        [aspect]: payload,
        revisions: revised ? [...prev.revisions, { aspect, from: fromVerdict, to: toVerdict }] : prev.revisions,
      });
      fire(key);
      return key;
    },
    state(key) {
      return byKey.get(key) ?? null;
    },
    all() {
      return [...byKey.values()];
    },
    entries() {
      return [...entries];
    },
    /** Redraw hook: called with the claim's folded state on every note. */
    subscribe(key, fn) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(fn);
      return () => listeners.get(key)?.delete(fn);
    },
  };
}

/**
 * The composed one-liner every surface may show — each tier's verdict in
 * plain words, joined, never phrased stronger than its own count. Absent
 * tiers say nothing (an unchecked aspect is not a verdict).
 */
export function composedSentence(state) {
  if (!state) return "";
  const parts = [];
  const m = state.material;
  const discourse = state.nature === "about-the-discourse";
  if (m?.verdict === "bound") parts.push("your material states this");
  else if (m?.verdict === "contradicted") parts.push("your material says otherwise");
  else if (m?.verdict === "unbound")
    // A single account is never licensed to settle a claim about the
    // literature — the honest phrasing names the category, not a failure.
    parts.push(discourse ? "a question about the accounts — one document can't settle it" : "your material never says this");
  else if (m?.verdict === "unsupported") parts.push(discourse ? "a question about the accounts — one document can't settle it" : "not in your material");
  else if (m?.verdict === "unheard" || m?.verdict === "beyond-reach") parts.push("couldn't be checked against the material");
  const c = state.corroboration;
  if (c && !m) {
    parts.push(
      c.sources >= 2
        ? `backed by ${c.sources} sources in your material`
        : c.refs >= 1
          ? "backed by one source in your material"
          : "not in your material",
    );
  }
  const w = state.web;
  if (w?.verdict === "web-corroborated")
    parts.push(`the web states it: ${w.stating?.length ?? 0} of ${w.consulted} page(s) (${w.independence?.hosts ?? 0} site(s))`);
  else if (w?.verdict === "web-uncorroborated") parts.push(`the web: 0 of ${w.consulted} page(s) state it`);
  else if (w)
    // A search that ran and found nothing is a different fact from a
    // crossing that failed — the gap's own detail says which (the same
    // distinction foldProof draws; reproduced here 2026-08-17 when a
    // zero-result search composed as "not reached").
    parts.push(w.gap?.detail ? `web: ${w.gap.detail}` : "the web was not reached");
  // The semantic witness (testimony.js, P32) is deliberately NOT composed
  // here. It carries a QUOTE (the passage's own deciding sentence), which
  // this function's terse one-clause-per-tier style has no room for — its
  // own dedicated note (app.js's chip `run()`, prepended beside this one)
  // is where the quote lives. Composing a second, quote-less summary of the
  // same finding here duplicated it: measured live 2026-08-19, "a reader
  // over statmuse.com says otherwise" rendered twice, run together with no
  // separator, once from here and once from the dedicated note. `ledger.note`
  // still records the witness aspect for the record; this function just
  // never speaks it.
  // Phrased from the counts, never the verdict token: rankPrimary ranks
  // EVERY class of citation (primary.test.mjs pins a tertiary essay site as
  // a real "other"-class candidate), so "stated-by-primary" is a container
  // label, not a claim that the class was checked. CLAUDE.md's own line:
  // "nothing anywhere phrases a web verdict stronger than 'stated by N of M
  // pages (K distinct hosts)'".
  const p = state.primary;
  if (p?.verdict === "stated-by-primary") parts.push(`stated by ${p.stating ?? 0} of ${p.read ?? 0} source(s) the article cites`);
  else if (p?.verdict === "unstated-by-consulted") parts.push(`${p.read ?? 0} source(s) the article cites were read; none states it`);
  // The reference library (live_priors): the local, versioned prior every
  // belief revises from — checked with zero egress. THE PROVENANCE RULE
  // (user, 2026-08-17): a prior referenced in the surf is a citation like
  // any other — its payload must carry, per consulted document, the path,
  // the snip's byte offsets, the category, and the publisher pedigree the
  // corpus keeps in frontmatter (official URL, department, date). A count
  // with no addresses behind it would be knowledge from nowhere wearing a
  // library card; the projection may phrase the count, the record keeps
  // the documents.
  const pr = state.priors;
  if (pr?.consulted) parts.push(`the reference library: ${pr.stating ?? 0} of ${pr.consulted} document(s) state it`);
  return parts.join(" · ");
}
