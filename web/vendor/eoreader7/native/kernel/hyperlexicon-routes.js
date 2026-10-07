// kernel/hyperlexicon-routes.js — FAST ROUTES in the hyperlexicon's
// environment, over KINDS and their dated LINKS.
// Handle: Wilson, with Xunzi (kinds relate by resemblance, never a strict
// tree) and Shizhen (one specimen placed in a ranked kind): a role word like
// "president" is not a string to match — it is a KIND, addressable in the
// hyperlexicon (`noteId("president", "keeps-company", "kind:role:president")`,
// the same projection kindNotes() makes for discovered kinds), and the
// current state of that kind is a LINK: a dated arrangement from the kind's
// role to its holder, carrying the interval that makes "current" a fact and
// not a guess.
//
// THE TWO SHAPES:
//   kind: { id, label, jurisdiction?, aliases: [], parameters: [], memberOf: [] }
//   link: { id, kindId, holder, since?, until?, at, ref, query?, giver, ordinal? }
// A kind is the GENERALIZATION ("president" is a role-kind); a link is the
// DATE-CARRIED fact ("the president holds-office Donald Trump, since
// 2025-01-20, until 2029-01-20"). A question resolves when the route finds
// the kind and then the link whose interval contains now — the same
// interval logic current-holder.js uses for Wikidata's own dated statements,
// lifted so every door that can date a link feeds the same routes.
//
// KINDS OF THINGS THAT HAVE THINGS. A role like president is not just a
// label — it is a KIND OF THING THAT HAS TERMS: the kind's own structure
// says what its instances carry. The parameter `has-term` is declared the
// moment a dated link arrives (the door dated it), and the role kind becomes
// a MEMBER of the meta-kind `kind:has-term` — the same membership
// projection kindNotes() makes (`(kind:role:president, keeps-company,
// kind:has-term)` is a note like any other, addressable in the ledger).
// "Current" then reads structurally: for a member of kind:has-term, the
// current link is the one whose TERM contains now. Nothing here knows what
// a president is; every dated office, tenured seat, or numbered term that a
// door can date earns the same structure.
//
// THE HOPS — five mechanical entry points, each an O(1) probe:
//   exact-kind   kind by label, then its current link   "the president"
//   alias        kind by a learned alias                "POTUS"
//   jurisdiction kind by jurisdiction, then its link    "president of the US"
//   ordinal      link by ordinal (47th), then its kind  "the 47th president"
//   holder       link by holder (reverse hop)           "who is Donald Trump?"
// A request matching nothing returns the honest absence (kind: null).
//
// THE ORDER of hops is learned stigmergically (kernel/stigmergy.js): every
// resolution attempt deposits a trail under the KIND it was about, and the
// strongest recent successful trail is tried first. Nothing here names a
// role; "president" earns its routes exactly as "mayor" or "founder" do.

import { routeOrderFor } from "./stigmergy.js";

export const ROUTE_SCHEMA = "EOHyperlexiconRoutes@1";
export const ROUTE_TYPES = Object.freeze(["exact-kind", "alias", "jurisdiction", "ordinal", "holder"]);
export const KIND_PREFIX = "kind:role:";
export const LINK_VERB = "holds-office";
// THE ALIAS IS A LEDGER NOTE, NOT A STRING FIELD (2026-09-19, user
// direction: "that should resolve by referent using the hyperlexicon").
// A surface word binds to its REFERENT by an admission act in the
// hyperlexicon's own shape — (POTUS, is-alias-of, kind:role:president) —
// exactly as kindNotes() makes (president, keeps-company,
// kind:role:president) addressable. The route resolves the SURFACE through
// the LEDGER to the REFERENT (the kind id), and only then reads the
// referent's current link. The byAlias index is a projection of the ledger,
// never a parallel store.
export const ALIAS_VERB = "is-alias-of";
// THE META-KIND OF THINGS THAT HAVE TERMS: the kind a role kind belongs to
// the moment any door dates its link. Its name is structural — the same
// genre of name kind-standing's company kinds carry ("kind:before=the" is
// the signature, not a word list); `has-term` is what a dated interval IS.
export const TERM_KIND = "kind:has-term";
export const TERM_PARAMETER = "has-term";

const norm = (s) => String(s ?? "").trim().toLowerCase();
const words = (s) => String(s ?? "").match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
const isCap = (w) => /^\p{Lu}/u.test(w);
/** The role word a kind names — "president" for kind:role:president. */
const headWord = (k) => norm(String(k?.label ?? "").replace(/^the\s+/i, "").split(/\s+/)[0]);

export const kindId = (label) => `${KIND_PREFIX}${norm(label)}`;
export const linkId = (kind, holder) => `${norm(kind)}|${LINK_VERB}|${norm(holder)}`;

/** The kind carries the has-term parameter — its instances are held for intervals. */
export const isTermKind = (kind) => (kind?.parameters ?? []).includes(TERM_PARAMETER);

/**
 * The kinds a dated link declares: the role kind gains the has-term
 * parameter and membership in the meta-kind of things that have terms.
 * Returns the updated kind (or the incoming one when the link carries no
 * dates — an undated link is still a link, it just cannot declare a term).
 */
export function withTermStructure(kind, link) {
  if (!link?.since && !link?.until) return kind;
  const parameters = [...new Set([...(kind?.parameters ?? []), TERM_PARAMETER])];
  const memberOf = [...new Set([...(kind?.memberOf ?? []), TERM_KIND])];
  return { ...kind, parameters, memberOf };
}

/**
 * The kinds as ledger notes — the same projection kindNotes() makes, so
 * each kind is ADDRESSABLE in the hyperlexicon: the role membership
 * (label, keeps-company, kind:id) and, for kinds of things that have terms,
 * the meta-membership (kind:id, keeps-company, kind:has-term).
 */
export function kindNotes(kinds, { witness = null } = {}) {
  const notes = [];
  for (const k of kinds ?? []) {
    const who = witness ?? `hyperlexicon-routes@1:${k.id}`;
    if (k.label) notes.push({ subject: k.label, verb: "keeps-company", object: k.id, witness: who, because: "the role word is a member of its own role-kind" });
    if ((k.parameters ?? []).includes(TERM_PARAMETER)) notes.push({ subject: k.id, verb: "keeps-company", object: TERM_KIND, witness: who, because: "this role kind carries dated links — a kind of thing that has terms" });
  }
  return notes;
}

/** The route request a question makes — read off the LENS's grammar, never off a domain. */
export function parseRouteRequest(ask, factShape, lens = null) {
  const s = String(ask ?? "").trim();
  const shape = factShape ? factShape(s, lens) : null;
  let head = shape?.jurisdiction?.head ?? null;
  const ordinalRe = lens?.ordinal ?? /\b(\d+(?:st|nd|rd|th))\b/i;
  const ordinal = ordinalRe.exec(s)?.[0]?.toLowerCase() ?? null;
  // the jurisdiction: "<head> <of-preposition> [the] Cap…" — the of-set is
  // the lens's own ("of", "de", "des", "von"…); null lens = English default.
  const ofSet = lens ? [...lens.of] : ["of"];
  const jurRe = new RegExp(`\\b(?:${ofSet.map((o) => String(o).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s+(?:the\\s+)?([A-Z][\\p{L}\\p{N}.'\\-]+(?:\\s+[A-Z][\\p{L}\\p{N}.'\\-]+)*)`, "iu").exec(s);
  const jurisdiction = jurRe ? jurRe[1].replace(/[.!?]+$/, "").trim() : null;
  // factShape drops the head on dated/numbered asks ("the 47th president" is
  // closed by its ordinal) — recover it mechanically: the noun after "the
  // <ordinal>" is the role word the ordinal picks ("47th" -> "president").
  if (!head && ordinal) {
    const m = new RegExp(`\\bthe\\s+${ordinal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+([\\p{L}][\\p{L}'’-]*)`, "iu").exec(s);
    if (m) head = m[1];
  }
  let holder = null;
  // a HOLDER ask opens with the lens's own wh-opener ("who is Donald
  // Trump?", "Кто является..."); an ask whose role word merely sits
  // sentence-initial ("Rais ni nani?" — Swahili puts the wh LAST) is not a
  // holder ask, and the caps run is not trusted to say so.
  const first = norm(words(s)[0] ?? "");
  const whFirst = lens ? [...lens.wh].some((w) => String(w).toLowerCase() === first) : first === "who";
  if (whFirst) {
    const toks = words(s);
    const caps = toks.map((w, i) => ({ w, i })).filter((x) => isCap(x.w));
    const jurWords = new Set(String(jurisdiction ?? "").toLowerCase().split(" ").filter(Boolean));
    // the ask's own wh-opener is grammar, never a holder ("Кто является
    // президентом?" — the capitalized wh-word is the opener, not a person)
    const whWords = new Set([...(lens?.wh ?? []), ...(lens ? [] : ["who"])].map((w) => String(w).toLowerCase()));
    const filtered = caps.filter((x) => !jurWords.has(x.w.toLowerCase()) && !whWords.has(x.w.toLowerCase()));
    if (filtered.length) holder = toks.slice(filtered[0].i, filtered[filtered.length - 1].i + 1).join(" ").replace(/[.!?]+$/, "").trim();
  }
  // No definite noun phrase ("who is POTUS?"): the capitalized run is the
  // role word itself — an alias candidate the alias hop probes, and a holder
  // name the holder hop probes. The hops decide which it is; nothing here
  // guesses.
  if (!head && holder) head = holder;
  return { head, jurisdiction, ordinal, holder };
}

/** Is the link's own interval (or refresh date) current at `now`? */
export function linkCurrent(link, now) {
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const s = link?.since ? new Date(link.since).getTime() : NaN;
  const u = link?.until ? new Date(link.until).getTime() : NaN;
  if (!Number.isNaN(s) && t < s) return false;
  if (!Number.isNaN(u) && t >= u) return false;
  return true;
}

/**
 * The current link of a kind: the one whose interval contains now; ties and
 * undated links fall back to the most recently refreshed (`at` desc).
 */
export function currentLinkOf(kind, links, now = new Date()) {
  const owned = (links ?? []).filter((l) => l?.kindId === kind?.id);
  if (!owned.length) return null;
  const covering = owned.filter((l) => linkCurrent(l, now));
  if (covering.length) return covering.sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")))[0];
  return owned.sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")))[0];
}

/**
 * The route index: O(1) tables over the same kinds, links and LEDGER NOTES.
 * Built once, frozen — the street map, not the streets. `aliasNotes` are the
 * hyperlexicon's own admission acts ((surface, is-alias-of, kindId)) — the
 * byAlias table is their projection, so a surface resolves to the kind
 * (the referent) the ledger binds it to.
 */
export function buildRouteIndex(kinds = [], links = [], aliasNotes = []) {
  const byLabel = Object.create(null);
  const byAlias = Object.create(null);
  const byJurisdiction = Object.create(null);
  const byHolder = Object.create(null);
  const byOrdinal = Object.create(null);
  const byId = Object.create(null);
  for (const k of kinds) {
    const key = norm(k.label);
    if (key) byLabel[key] = k;
    if (k.id) byId[k.id] = k;
    if (k.jurisdiction) byJurisdiction[norm(k.jurisdiction)] = k;
  }
  // THE ALIAS HOP READS THE LEDGER: (POTUS, is-alias-of, kind:role:president)
  // binds the surface to the REFERENT id; the kind is resolved by that id.
  // A CONTESTED surface — two admissions binding it to DIFFERENT referents —
  // resolves to NOTHING: the honest ambiguity, disclosed on the index, never
  // a silent last-writer-wins (falsified live, 2026-09-19).
  const contested = Object.create(null);
  {
    const bySurface = new Map();
    for (const n of aliasNotes ?? []) {
      if (n?.verb !== ALIAS_VERB || !n?.subject || !n?.object) continue;
      const set = bySurface.get(norm(n.subject)) ?? new Set();
      set.add(n.object);
      bySurface.set(norm(n.subject), set);
    }
    for (const [surface, objects] of bySurface) if (objects.size > 1) contested[surface] = [...objects];
  }
  for (const n of aliasNotes ?? []) {
    if (n?.verb !== ALIAS_VERB || !n?.subject || !n?.object) continue;
    if (contested[norm(n.subject)]) continue; // contested — bound to no single referent
    const kind = byId[n.object] ?? byLabel[n.object];
    if (kind) byAlias[norm(n.subject)] = kind;
  }
  for (const l of links) {
    const hk = norm(l.holder);
    if (hk) (byHolder[hk] ??= []).push(l);
    if (l.ordinal) (byOrdinal[norm(l.ordinal)] ??= []).push(l);
  }
  const fresh = (t) => Object.freeze({ ...t });
  return Object.freeze({
    byLabel: fresh(byLabel), byAlias: fresh(byAlias), byJurisdiction: fresh(byJurisdiction),
    byHolder: fresh(byHolder), byOrdinal: fresh(byOrdinal),
    links: Object.freeze([...links]),
    aliasNotes: Object.freeze([...(aliasNotes ?? [])]),
    contested: fresh(contested),
  });
}

/** One hop: a named probe. Returns the kind (or the link for holder/ordinal) or null. */
export function hop(index, route, request, links, now) {
  const r = request ?? {};
  switch (route) {
    case "exact-kind": {
      const k = r.head ? index.byLabel[norm(r.head)] : null;
      return k ? { kind: k, link: currentLinkOf(k, links, now) } : null;
    }
    case "alias": {
      const k = r.head ? index.byAlias[norm(r.head)] : null;
      return k ? { kind: k, link: currentLinkOf(k, links, now) } : null;
    }
    case "jurisdiction": {
      const k = r.jurisdiction ? index.byJurisdiction[norm(r.jurisdiction)] : null;
      if (!k) return null;
      // the ask's own head must be the kind's head: "the CEO of the United
      // States" must not borrow the president kind's link
      if (r.head && headWord(k) !== norm(r.head)) return null;
      return { kind: k, link: currentLinkOf(k, links, now) };
    }
    case "ordinal": {
      if (!r.ordinal) return null;
      // The ordinal IS the specifier — "the 46th president" names a past
      // link, so the interval filter does not apply here (it would delete
      // exactly the link the ask wants).
      const candidates = index.byOrdinal[norm(r.ordinal)] ?? [];
      const pick = r.head
        ? candidates.find((l) => norm(l.kindId) === norm(kindId(r.head)))
        : candidates[0];
      if (!pick) return null;
      const kind = Object.values(index.byLabel).find((k) => k.id === pick.kindId) ?? null;
      return kind ? { kind, link: pick } : null;
    }
    case "holder": {
      if (!r.holder) return null;
      const pick = (index.byHolder[norm(r.holder)] ?? []).filter((l) => linkCurrent(l, now))[0];
      if (!pick) return null;
      const kind = Object.values(index.byLabel).find((k) => k.id === pick.kindId) ?? null;
      return kind ? { kind, link: pick } : null;
    }
    default: return null;
  }
}

/**
 * The route — the stigmergic resolution. The learned order of hops is
 * computed from the environment's own trails under the KIND the ask is
 * about, then each hop is probed in that order. PURE: it reads, it does not
 * deposit — the caller (the store) records the trail with the latency it
 * actually measured.
 */
export function routeAsk(index, request, { kinds = [], links = null, trails = null, now = new Date(), routes = ROUTE_TYPES, rng } = {}) {
  const key = request?.head ?? request?.holder ?? null;
  const order = routeOrderFor(trails, key, { now, routes, rng });
  // SPECIFICITY IS A LOCK, NOT A PREFERENCE. An ordinal or jurisdiction ask
  // names its own ground ("the 46th president", "president of France") — the
  // fall-through to the kind's current link would answer the WRONG office
  // with confidence ("the 46th president" -> today's link; "president of
  // France" -> the US kind). A scoped ask resolves only through its own hop,
  // or not at all. A holder ask preempts ONLY WHILE THE COLONY HASN'T
  // LEARNED: an alias head like "POTUS" is also a holder-candidate (its caps
  // run reads both ways), and an unconditional preemption would cost the
  // colony a wasted probe on every resolution forever (falsified live by the
  // swarm: "who is POTUS?" spent one probe on the holder hop every time).
  // Once trails exist under the head, the learned order governs.
  let finalOrder;
  if (request?.ordinal) finalOrder = ["ordinal"];
  else if (request?.jurisdiction) finalOrder = ["jurisdiction"];
  else {
    const known = key ? Boolean(trails?.[key]?.length) : false;
    const specific = request?.holder && !known ? ["holder"] : [];
    finalOrder = [...specific, ...order.filter((r) => !specific.includes(r))];
  }
  const linkPool = links ?? index?.links ?? [];
  for (const route of finalOrder) {
    const hit = hop(index, route, request, linkPool, now);
    if (hit?.link) return { route, kind: hit.kind, link: hit.link, order: finalOrder, ok: true };
  }
  return { route: null, kind: null, link: null, order: finalOrder, ok: false };
}

export const serializeRoutes = ({ kinds = [], links = [], aliasNotes = [], trails = {} } = {}) => ({
  schema: ROUTE_SCHEMA,
  kinds: kinds.map((k) => ({ ...k, aliases: [...(k.aliases ?? [])] })),
  links: links.map((l) => ({ ...l })),
  aliasNotes: (aliasNotes ?? []).map((n) => ({ ...n })),
  trails,
});

export function loadRoutes(data = null) {
  if (!data || data.schema !== ROUTE_SCHEMA) return { kinds: [], links: [], aliasNotes: [], trails: {} };
  const kinds = (data.kinds ?? []).map((k) => ({ ...k, aliases: [...(k.aliases ?? [])] }));
  const links = (data.links ?? []).map((l) => ({ ...l }));
  const aliasNotes = (data.aliasNotes ?? []).map((n) => ({ ...n }));
  const trails = Object.fromEntries(Object.entries(data.trails ?? {}).map(([h, list]) => [h, [...list]]));
  return { kinds, links, aliasNotes, trails };
}