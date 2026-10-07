// wikidata.js — referent identity and entity type from a named giver. PURE:
// no fetch call anywhere in this file, the same wall `web.js`, `github.js`,
// `links.js` and `wheels.js` already stand behind (constitution.test.mjs's
// II.13 scan checks `egressCalls(src).length === 0`). A server owns the
// crossing; this file owns the shape.
//
// WHY, from the incident that produced it. Asked "who was Abraham Lincoln's
// vice president?", the live app answered "Hannibal Hamlin" in 4 of 5 runs
// and dropped Andrew Johnson, and one run promoted Johnson to president
// instead. The relation tier could not fix it: digesting the three real
// fetched pages produced 2,298 SVO edges, of which 13 mention a vice
// presidency, and querying the slot returned ONE subject endpoint whose
// surfaces were "it failed", "Trefousse believes", "Another factor",
// "as Seward". The extractor reads SLOT (what token sits between two spans)
// and has no way to read IDENTITY.
//
// This file reads identity, because a giver publishes it. Measured on the
// real captured fixtures beside this file:
//
//   Hamlin  Q273546  P31 Q5 (human)  holds Q11699  1861-03-04 → 1865-03-04
//   Johnson Q8612    P31 Q5 (human)  holds Q11699  1865-03-04 → 1865-04-15
//   VP      Q11699   P31 office/position, holds nothing (an office is not a holder)
//
// Two people, by stable id, with their real extents — the answer the string
// tier could not reach.
//
// THE CHAIN CLOSES BY IDENTITY, NOT BY SPELLING, and that is the point.
// Hamlin's `replacedBy` IS Johnson's own qid and Johnson's `replaces` IS
// Hamlin's. `chains.js::chainFillers` already verifies exactly this shape
// generically — its own header says it "would be identical code for a
// version history, a chain of custody, or a championship's own title-holder
// sequence" — and its one disclosed weakness is that its default `matches`
// is bidirectional substring containment, so "John C. Breckinridge" and
// "J. C. Breckinridge" do not resolve (chains.test.mjs pins this, and names
// the real fix: "a referent index"). Feeding it qids makes `matches` exact
// equality and that weakness disappears. So this file builds records and
// hands them to the organ that already exists; it re-implements nothing.
//
// WHAT THIS FILE REFUSES TO DO. It does not read Wikipedia's own short
// `description` as an entity type, and that is a measured refusal rather
// than a stylistic one: the live summary API describes Andrew Johnson as
// "President of the United States from 1865 to 1869" — his most notable
// office, not the one being asked about — which is the SAME conflation the
// model made unaided. A short description is an editorial summary; P31 and
// P39 are typed claims with qualifiers. Only the typed claims are read here.

/** The giver, named on every record this file produces. */
export const GIVER = "wikidata.org";

const QID_RE = /^Q\d+$/;
export const isQid = (v) => QID_RE.test(String(v ?? ""));

/**
 * The address a caller's own fetch should read. Kept here so the URL shape
 * lives beside the parser that understands the response, never spelled out
 * at a call site (the same reason web.js owns its own archive addresses).
 */
export function entityUrl(qid) {
  if (!isQid(qid)) throw new TypeError(`wikidata: not a qid: ${JSON.stringify(qid)}`);
  return `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
}

const mainId = (claim) => claim?.mainsnak?.datavalue?.value?.id ?? null;
const qualId = (claim, prop) => claim?.qualifiers?.[prop]?.[0]?.datavalue?.value?.id ?? null;
// Wikidata times are "+1865-03-04T00:00:00Z" with a `precision` (11 = day,
// 9 = year). The leading "+" is an era marker, not a sign to strip blindly —
// a BCE date carries "-" and must stay negative. Precision is CARRIED, never
// assumed: a year-precision date rendered as a day would be a fabricated
// exactness, which is the one thing an address-carrying record may not do.
const qualTime = (claim, prop) => {
  const v = claim?.qualifiers?.[prop]?.[0]?.datavalue?.value;
  if (!v?.time) return null;
  return { time: v.time, precision: v.precision ?? null };
};

/**
 * parseEntity(json) — one Special:EntityData response into the shape this
 * repo already speaks. Returns `null` for anything that is not an entity
 * response, never a half-built object.
 *
 * `positions` is P39 (position held) with its qualifiers: P580 start, P582
 * end, P1365 replaces, P1366 replaced by. Those four are what turn a bare
 * "held this office" into a chain with extents — exactly the fields
 * `succession.js` reads out of a Wikipedia infobox, published as data.
 */
export function parseEntity(json) {
  const entities = json?.entities;
  if (!entities || typeof entities !== "object") return null;
  const entity = Object.values(entities)[0];
  if (!entity?.id) return null;
  const claims = entity.claims ?? {};
  return {
    schema: "EOWikidataEntity@1",
    qid: entity.id,
    label: entity.labels?.en?.value ?? null,
    // The typed claim, never the editorial blurb — see this file's header.
    instanceOf: (claims.P31 ?? []).map(mainId).filter(Boolean),
    positions: (claims.P39 ?? [])
      .map((c) => ({
        position: mainId(c),
        start: qualTime(c, "P580"),
        end: qualTime(c, "P582"),
        replaces: qualId(c, "P1365"),
        replacedBy: qualId(c, "P1366"),
      }))
      .filter((p) => p.position),
    giver: GIVER,
    address: isQid(entity.id) ? entityUrl(entity.id) : null,
  };
}

/** Q5 is `human`. Declared as a constant so a caller never types a bare qid. */
export const HUMAN = "Q5";
export const isHuman = (entity) => (entity?.instanceOf ?? []).includes(HUMAN);

// ── cross-source referents, by qid — never by name string ───────────────────
//
// Found chasing "make cross source referents" (2026-09-15): asked whether
// the-fold's EXISTING cross-document identity primitives — `bridges.js`'s
// exact-(subject,verb,object)-triple crossing, and `reality-kind.js`'s
// `namesCorefer`-based cross-document NAME correspondence — can recognize
// that an English and a Russian Wikipedia article both describe the SAME
// real institution. Neither can, and reality-kind.js's own header already
// says why for the first ("a paraphrase never matches the triple"); the
// second was measured to do something WORSE than simply failing closed.
//
// THE MEASURED FALSE POSITIVE. `namesCorefer("Harvard University", "Uni-
// versity")` returns true even with the real production `commonNoun`
// (`isCommonNoun`, the UD-treebank prior) wired in — not because
// "university" is out-of-vocabulary the way "observatory" was (P219): it IS
// in the treebank, 29 occurrences, but its DOMINANT tag is PROPN at 79% share
// (institution names like "Harvard University" outnumber bare uses like "the
// university" in the training text), so `dominantClass(..., {upos:"NOUN"})`
// never fires and the single-token subset-containment gate never engages.
// A real Russian Wikipedia article for Harvard embeds the English gloss
// "(англ. Harvard University)" — ordinary Wikipedia style for a foreign-
// language name — and `extractSurfaces` reads the bare Latin word
// "University" out of it as its own surface. The two together make
// `namesCorefer` "bridge" the English and Russian Harvard articles — but
// for the WRONG reason: verified live that the identical mechanism ALSO
// "bridges" the English Harvard article to a wholly UNRELATED Russian
// Stanford specimen carrying the same embedded gloss shape. A mechanism
// that cannot tell two different universities apart is not a bridge, it is
// the P219 bug wearing a cross-source costume — disclosed here as a REAL,
// UNFIXED gap in the commonNoun gate (P219/P221/P222 close it only for
// OOV words; a PROPN-dominant common noun like "university"/"college"/
// "institute" is a second, different failure shape the same gate cannot
// see), never used to justify a "successful" cross-lingual bridge.
//
// THE SOUND SIGNAL, receivable rather than derived from the text at all:
// Wikidata assigns one QID per real-world entity, and every Wikipedia
// article in every language that describes that entity carries the SAME
// qid in its own `pageprops.wikibase_item` (confirmed live: Harvard's
// English, German, Spanish and Russian articles all resolve to Q13371;
// Stanford's own English article resolves to the DIFFERENT Q41506). Two
// sources correspond when their OWN declared qids are equal — nothing
// compared, nothing guessed, the same "identity from a giver, not from
// spelling" rule this file's own header already states for
// `chainAgreesByIdentity`. The pure half lives here; the crossing (reading
// each source's own qid) is the caller's, exactly like `entityUrl` above.
export const pagePropsUrl = (lang, title) =>
  `https://${encodeURIComponent(String(lang ?? "en"))}.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&titles=${encodeURIComponent(String(title ?? ""))}&format=json`;

/** The qid a fetched `pagePropsUrl` response names for its page, or null — never guessed when the property is absent (a page with no linked Wikidata item, a redirect MediaWiki did not resolve, a typo'd title). */
export function parsePageProps(json) {
  const pages = json?.query?.pages;
  if (!pages || typeof pages !== "object") return null;
  const page = Object.values(pages)[0];
  const qid = page?.pageprops?.wikibase_item;
  return isQid(qid) ? qid : null;
}

/**
 * qidBridge(sourceA, sourceB) — do two sources (`{qid, ref}`-shaped, ref
 * optional and carried through only for the caller's own address) describe
 * the SAME real-world referent? Equal, present qids bridge; anything else
 * refuses BY NAME rather than defaulting to "no" the same way an ordinary
 * mismatch would — a source with no known qid at all is a different fact
 * (this mechanism was never consulted) from two sources whose qids were
 * both read and genuinely differ (this mechanism was consulted and said no).
 */
export function qidBridge(sourceA, sourceB) {
  const a = sourceA?.qid, b = sourceB?.qid;
  if (!isQid(a) || !isQid(b)) return { bridged: false, reason: "missing_qid", a: sourceA?.ref ?? null, b: sourceB?.ref ?? null };
  return { bridged: a === b, reason: a === b ? null : "different_qid", a: sourceA?.ref ?? null, b: sourceB?.ref ?? null, qid: a === b ? a : null };
}

/**
 * holdersOfPosition(entities, positionQid) — every parsed entity that holds
 * the named position, as `chains.js`-shaped records: `{id, prev, next, seq,
 * fields}`. Feed the result to `chainFillers` with `matches` as exact qid
 * equality and the chain verifies itself by identity.
 *
 * `seq` is deliberately `null`: Wikidata publishes no ordinal here, and an
 * ordinal invented from start-date order would be a number this file made up.
 * `chainFillers` orders by its own pointer walk, which is the real evidence.
 */
export function holdersOfPosition(entities, positionQid) {
  if (!isQid(positionQid)) throw new TypeError(`wikidata: not a qid: ${JSON.stringify(positionQid)}`);
  const records = [];
  for (const e of entities ?? []) {
    if (!e?.qid) continue;
    for (const p of e.positions ?? []) {
      if (p.position !== positionQid) continue;
      records.push({
        id: e.qid,
        prev: p.replaces,
        next: p.replacedBy,
        seq: null,
        label: e.label,
        span: p.start && p.end ? { fromText: p.start.time, toText: p.end.time } : null,
        fields: { position: positionQid, human: isHuman(e) },
        giver: GIVER,
        address: e.address,
      });
    }
  }
  return records;
}

/**
 * chainAgreesByIdentity(records) — does each record's own forward pointer
 * name the record whose backward pointer names it? Checked on qids, so
 * agreement is identity and not spelling.
 *
 * Returns every link it could confirm plus every pointer that named someone
 * outside this set — that second list is not a failure, it is the chain's
 * own edge (Hamlin's `replaces` names Breckinridge, who is genuinely not a
 * VP under Lincoln), and reporting it as an edge rather than a fault is what
 * lets a caller tell "the set is closed here" from "the set is incomplete".
 */
export function chainAgreesByIdentity(records) {
  const byId = new Map((records ?? []).map((r) => [r.id, r]));
  const links = [];
  const openEnds = [];
  for (const r of records ?? []) {
    const forward = r.next && byId.get(r.next);
    if (forward) {
      links.push({ from: r.id, to: forward.id, mutual: forward.prev === r.id });
    } else if (r.next) {
      openEnds.push({ from: r.id, names: r.next, direction: "after", inSet: false });
    }
    if (r.prev && !byId.has(r.prev)) openEnds.push({ from: r.id, names: r.prev, direction: "before", inSet: false });
  }
  return { links, openEnds, mutual: links.length > 0 && links.every((l) => l.mutual) };
}

// ── the seek: from two surface strings to the bindings, by constraint ───────
//
// Nothing below names an entity. The only inputs are the question's own
// anchor ("Abraham Lincoln") and slot term ("vice president"); every step
// after that is a lookup or a filter, and each one is a separate pure
// function so the orchestration (which needs a network, and therefore lives
// on the server) can be paced, recorded, and tested apart from the shapes.
//
// Driven live against the real giver, this is the walk it performs:
//   1  bind the anchor            "Abraham Lincoln" → Q91 (and 4 rival readings)
//   2  bind the slot              "vice president"  → Q42178, the GENERIC role
//   3  the anchor's dated terms   4 of them, all in country Q30
//   4  the specific office        P31=Q42178 ∧ P17=Q30 → Q11699
//   5  inverse index              P39=Q11699 → 63 holders across all time
//   6  bind by interval, PER TERM → 2 under the presidency, 0 under the rest
//
// STEP 2 IS WHY THIS IS A SEEK AND NOT A LOOKUP. "vice president" resolves to
// the generic role, which has no holders anywhere; the office the question is
// actually about is only reachable as an instance of that role scoped to a
// country the ANCHOR's own record supplies. The anchor disambiguates the slot.
//
// STEP 6 CHOOSES NOTHING, and that is a rule rather than a convenience. The
// first cut took the anchor's first dated term — Lincoln's 1847 House seat —
// and returned zero, because nothing in the question says which term it
// means. Enumerating every term and reporting each is the only honest read:
// three of Lincoln's four terms genuinely have no vice president, and that
// zero is an answer. Silently picking one would be inventing the question's
// own scope.

const API = "https://www.wikidata.org/w/api.php";
const enc = encodeURIComponent;

export const searchUrl = (term) =>
  `${API}?action=wbsearchentities&language=en&format=json&limit=5&search=${enc(String(term ?? ""))}`;

export const entitiesUrl = (ids) =>
  `${API}?action=wbgetentities&ids=${(ids ?? []).filter(isQid).join("|")}&props=claims|labels&languages=en&format=json`;

/** The inverse index: everything carrying these statements. `P39=Q11699`. */
export const inverseUrl = (statements, limit = 80) =>
  `${API}?action=query&list=search&format=json&srlimit=${limit}&srsearch=${enc(
    (statements ?? []).map((s) => `haswbstatement:${s}`).join(" "),
  )}`;

/** Candidate referents for a surface string — ambiguity kept, never collapsed. */
export const parseSearch = (json) =>
  (json?.search ?? []).map((r) => ({ qid: r.id, label: r.label, description: r.description ?? null }));

export const parseInverse = (json) => ({
  total: json?.query?.searchinfo?.totalhits ?? 0,
  ids: (json?.query?.search ?? []).map((r) => r.title).filter(isQid),
});

export const parseEntities = (json) =>
  Object.values(json?.entities ?? {})
    .map((e) => parseEntity({ entities: { [e.id]: e } }))
    .filter(Boolean);

/**
 * datedTerms(entity) — every position the anchor held with BOTH ends dated.
 * A term missing an end is skipped rather than treated as open: an undated
 * boundary cannot bound an interval, and guessing one would manufacture the
 * very scope this walk refuses to choose.
 */
export const datedTerms = (entity) =>
  (entity?.positions ?? [])
    .filter((p) => p.start?.time && p.end?.time)
    .map((p) => ({ office: p.position, start: p.start.time, end: p.end.time }));

/** The country an office belongs to, read off the office's own P17. */
export const countryOf = (officeEntity) => (officeEntity?.claimsP17 ?? officeEntity?.country ?? null);

/**
 * bindByTerm(holders, terms, positionQid) — the binding itself, per term,
 * choosing none. `holders` are parsed entities; `terms` are `datedTerms`
 * output. A holder binds to a term when its own term STARTS inside it.
 *
 * Disclosed limit: start-containment only. A tenure that began before the
 * anchor's term and ran into it does not bind here. That is correct for an
 * office whose holders change with the anchor's own administration and wrong
 * for one that does not, and widening it to interval OVERLAP is a real
 * decision with its own consequences, not a bug to quietly patch.
 */
export function bindByTerm(holders, terms, positionQid) {
  return (terms ?? []).map((term) => {
    const bound = [];
    for (const h of holders ?? []) {
      for (const p of h.positions ?? []) {
        if (p.position !== positionQid) continue;
        const s = p.start?.time;
        if (!s || !(s >= term.start && s < term.end)) continue;
        bound.push({
          qid: h.qid,
          label: h.label,
          start: s,
          end: p.end?.time ?? null,
          replaces: p.replaces,
          replacedBy: p.replacedBy,
          giver: GIVER,
          address: h.address,
        });
      }
    }
    bound.sort((a, b) => String(a.start).localeCompare(String(b.start)));
    return { term, bound, coverage: coverageOf(term, bound) };
  });
}

/**
 * coverageOf(term, bound) — how much of the anchor's own term the bound set
 * actually accounts for, end to end.
 *
 * THIS IS THE DISCRIMINATOR, and it was found by the seek returning a true
 * but useless answer. Enumerating every term (above) correctly refuses to
 * choose, but the caller still has to tell "Hamlin and Johnson under the
 * presidency" from "Richard Mentor Johnson and John Tyler during Lincoln's
 * Illinois House seat" — both are real holders whose terms START inside a
 * term Lincoln really held. Containment alone cannot separate them.
 *
 * Coverage can. The two vice presidents TILE the presidency exactly —
 * 1861-03-04 → 1865-03-04 → 1865-04-15, no gap, no overlap, both outer
 * boundaries coincident with the term's own — because the offices are
 * co-extensive by construction. The Illinois pair merely float inside an
 * eight-year window and leave most of it uncovered. A ratio, not a
 * threshold: the caller ranks by it and this function names no cut.
 *
 * The interval arithmetic is deliberately the SAME shape `void-shape.js`
 * already uses for its own covered/void stretches — sort by start, walk a
 * cursor, accumulate what is spanned — rather than a second implementation
 * of "how much of this range is filled".
 */
export function coverageOf(term, bound) {
  const t0 = String(term?.start ?? ""), t1 = String(term?.end ?? "");
  if (!t0 || !t1 || !bound?.length) return { ratio: 0, gaps: t0 && t1 ? 1 : 0, tiles: false };
  const spans = bound
    .filter((b) => b.start && b.end)
    .map((b) => ({ from: String(b.start) < t0 ? t0 : String(b.start), to: String(b.end) > t1 ? t1 : String(b.end) }))
    .filter((s) => s.from < s.to)
    .sort((a, b) => a.from.localeCompare(b.from));
  if (!spans.length) return { ratio: 0, gaps: 1, tiles: false };
  // Timestamps are ISO-ish and lexicographically ordered, so "how much is
  // covered" is measured in DAYS via Date, and a date the parser refuses
  // contributes nothing rather than a guessed magnitude.
  const ms = (t) => Date.parse(String(t).replace(/^\+/, ""));
  const total = ms(t1) - ms(t0);
  if (!Number.isFinite(total) || total <= 0) return { ratio: 0, gaps: 1, tiles: false };
  let covered = 0, gaps = 0, cursor = t0;
  for (const s of spans) {
    if (s.from > cursor) { gaps++; cursor = s.from; }
    if (s.to > cursor) { covered += ms(s.to) - ms(cursor); cursor = s.to; }
  }
  if (cursor < t1) gaps++;
  const ratio = Math.max(0, Math.min(1, covered / total));
  return { ratio: Number(ratio.toFixed(4)), gaps, tiles: gaps === 0 && ratio > 0.99 };
}

// ── the mechanical render ───────────────────────────────────────────────────
//
// TEMPLATE ONLY, and for the reason crown.js states in its own header: "there
// is no free-text generation step for a wrong word to come FROM." Every word
// below is either a label read verbatim from the giver, a date read verbatim
// from a qualifier, the question's own anchor and slot term, or a member of
// the closed connective set declared here. No model call, and none possible.
//
// WHY THIS EXISTS. The bindings were wired into the prompt as content — the
// exact closed set, with real dates, no apparatus vocabulary — and measured
// live three times against gemma2:2b, which still answered "Andrew Johnson
// became president and served as vice president", then dropped him twice.
// Handing a small model a set it must not drop from does not stop it dropping
// from the set. That is L5 at the last mile, and the repo's own
// facts-before-draft experiment already measured facts-vs-material as a tie:
// additions to a prompt do not win. So the set is RENDERED, not requested.
//
// IT REFUSES UNLESS THE SET IS CLOSED. `coverage.tiles` is the gate: only a
// set whose terms account for the anchor's own term end to end, with no gap,
// is a complete answer. Anything less falls through to the ordinary pipeline
// with no render at all — a partial set stated in this voice would be a
// closure claim the data never made.
const CONNECTIVES = Object.freeze({
  possessive: "'s",
  was: "was",
  then: ", then ",
  between: " to ",
  open: " (",
  close: ")",
  stop: ".",
  whole: " Between them they held it for the whole term.",
});

// The English month names, in the order the proleptic Gregorian calendar puts
// them — a received closed class, given by the calendar itself, not a list
// chosen here. It is a RENDERING, not a reading: the giver's own timestamp is
// unchanged and every address still points at it. `succession.js` reads the
// same dates out of infobox prose in exactly this shape ("March 4, 1865"), so
// naming them this way is also the two givers agreeing on the page rather
// than one of them speaking in storage format.
const MONTHS = Object.freeze([
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]);

export const dayOf = (t) => {
  const s = String(t ?? "");
  const m = /^([+-])(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const [, , year, month, day] = m;
  // A zeroed month or day is Wikidata's coarse precision, not a real date —
  // rendering "1834-00-00" as a day would state an exactness the giver
  // explicitly declined to state. Each grain is said at its own grain: a
  // known month with an unknown day is "March 1834", never rounded down to
  // the bare year and never invented up to a day.
  if (month === "00") return year;
  const name = MONTHS[Number(month) - 1];
  if (!name) return year;
  if (day === "00") return `${name} ${year}`;
  return `${name} ${Number(day)}, ${year}`;
};

/**
 * renderHolders({anchor, slot, bound, coverage}) — the answer, assembled.
 * Returns `null` when the set is not closed, when nothing bound, or when a
 * filler carries no readable name: a refusal, never a partial sentence.
 */
export function renderHolders({ anchor, slot, bound, coverage } = {}) {
  const a = String(anchor ?? "").trim();
  const s = String(slot ?? "").trim();
  if (!a || !s || !coverage?.tiles || !Array.isArray(bound) || !bound.length) return null;
  if (bound.some((b) => !b?.label)) return null;
  const parts = bound.map((b) => {
    const from = dayOf(b.start);
    const to = dayOf(b.end);
    return from && to ? `${b.label}${CONNECTIVES.open}${from}${CONNECTIVES.between}${to}${CONNECTIVES.close}` : b.label;
  });
  const head = `${a}${CONNECTIVES.possessive} ${s} ${CONNECTIVES.was} `;
  const body = parts.join(CONNECTIVES.then);
  return `${head}${body}${CONNECTIVES.stop}${bound.length > 1 ? CONNECTIVES.whole : ""}`;
}

// ── learning which property relates a slot entity to its members ────────────
//
// The office case forced this. "vice president" resolves to a generic ROLE
// entity, not a property, so answering "who was X's vice president" needs to
// know which property expresses "holds this office" — and writing `P39` into
// this file would be exactly the preset shape this organ must not have. A
// version history, a band's line-up, an award's recipients and an office's
// holders are the same question with four different properties, and nothing
// should have to be added here to reach the fifth.
//
// So the property is LEARNED, by example, from the giver's own data. A role
// entity carries outgoing claims naming things related to it; fetch a few,
// and whichever property they use to point BACK at the role is the property
// that expresses membership in it. Measured live on Q11699: of 27
// entity-valued claims, the sampled examples pointed back via P39 twice,
// P301 twice, and P2388 / P971 / P527 once each — a real distribution, not a
// single answer, which is why this returns witnesses and counts rather than
// a verdict.
//
// WHAT THIS IS NOT: a decision. It NOMINATES. The hyperlexicon's own rule
// governs what happens next — "observed relation adjacency nominated for
// consideration; nomination is not reasoning permission" — so a candidate
// here becomes usable only by surviving a witness floor, and `given` only
// with a named giver. This function has no opinion about either.

/**
 * backPointersIn(rawEntity, slotQid) — every property this entity uses to
 * point at `slotQid`. Operates on the giver's RAW claim shape (what
 * wbgetentities returns), because `parseEntity` deliberately keeps only the
 * two properties it understands and this walk must see all of them.
 */
export function backPointersIn(rawEntity, slotQid) {
  const out = [];
  for (const [prop, claims] of Object.entries(rawEntity?.claims ?? {})) {
    for (const c of claims ?? []) {
      if (c?.mainsnak?.datavalue?.value?.id === slotQid) {
        out.push(prop);
        break;
      }
    }
  }
  return out;
}

/** Entity-valued claims on the slot itself — the examples to learn from. */
export function exampleIdsFrom(rawEntity) {
  const ids = [];
  for (const claims of Object.values(rawEntity?.claims ?? {})) {
    for (const c of claims ?? []) {
      const v = c?.mainsnak?.datavalue?.value?.id;
      if (isQid(v)) ids.push(v);
    }
  }
  return [...new Set(ids)];
}

/**
 * nominateRelating(slotQid, rawExamples) — the candidates, with their
 * witnesses, ordered by how many independent examples used each property.
 *
 * Each witness is a real qid that really pointed back, so a caller can check
 * the nomination rather than trust the count — the same posture the
 * assertion tier holds ("standing and statement count are always on").
 * Ordering is by witness count then property id, so the result is stable and
 * a tie never resolves by fetch order.
 */
export function nominateRelating(slotQid, rawExamples, { kind = null } = {}) {
  const byProp = new Map();
  for (const e of rawExamples ?? []) {
    if (!e?.id || e.id === slotQid) continue;
    // A WITNESS MUST BE THE KIND OF THING THE QUESTION ASKS FOR, and this
    // guard is why. Counting back-pointers alone, the live walk learned
    // `P301` (category's main topic — Wikimedia housekeeping) over `P39`,
    // two witnesses to one, and found zero holders: a category page points
    // at the office exactly as a person does, and nothing in a bare count
    // can tell a filing relation from a membership one. The question can:
    // "who" seeks a person, and the giver types every entity with P31, so
    // an example that is not that kind is not evidence about how members
    // relate. Omitted, every example counts — the caller decides whether
    // its question has a kind at all.
    if (kind && !instanceOfIn(e).includes(kind)) continue;
    for (const prop of backPointersIn(e, slotQid)) {
      if (!byProp.has(prop)) byProp.set(prop, new Set());
      byProp.get(prop).add(e.id);
    }
  }
  return [...byProp.entries()]
    .map(([property, witnesses]) => ({
      left: slotQid,
      right: property,
      witnesses: [...witnesses],
      count: witnesses.size,
    }))
    .sort((a, b) => b.count - a.count || a.right.localeCompare(b.right));
}

// Reused whole, never re-derived: `emergence/binding.js`'s own structural
// minimum, which `hl-acquire.js` already borrows for the same purpose. One
// witness is a coincidence with nothing to disagree with it; two is the
// smallest set that can.
export const RELATING_WITNESS_FLOOR = 2;

/** P31 off the giver's RAW claim shape — parseEntity's parsed face is not
 *  available where nominations are counted. */
export const instanceOfIn = (rawEntity) =>
  (rawEntity?.claims?.P31 ?? []).map((c) => c?.mainsnak?.datavalue?.value?.id).filter(Boolean);

// The kinds a question can ask for, each naming the giver's own id for it.
// DECLARED, not derived — Q5 is what wikidata.org calls a human — and seeded
// with the one this instrument's own slot reader can currently produce
// ("who" → person, web-claim.js's INTERROGATIVE_PRONOUNS). A second kind is
// a DATA line here, never a code change: that is the whole point of keeping
// it as a table.
export const KIND_QIDS = Object.freeze({ person: HUMAN });
export const kindQidFor = (name) => KIND_QIDS[String(name ?? "").toLowerCase()] ?? null;
export const clearsFloor = (candidate) => (candidate?.count ?? 0) >= RELATING_WITNESS_FLOOR;

/**
 * nominationVerdict(candidates) — what the nominations actually DECIDE, and
 * nothing else. Two nominations that differ in counts but agree on which
 * property leads and whether it clears have made no difference to anything a
 * caller does, and must compare equal.
 *
 * This is the digest a stopping rule tests against, so it deliberately drops
 * everything a further example could change WITHOUT changing the outcome —
 * exact witness counts, the tail of also-rans, the order of ties.
 */
export function nominationVerdict(candidates) {
  const top = (candidates ?? [])[0];
  if (!top) return "none";
  return `${top.right}|${clearsFloor(top) ? "clears" : "short"}`;
}

/**
 * enoughExamples(batches, {kind}) — the stopping rule, Bateson's: sample
 * until another batch is a distinction WITHOUT a difference.
 *
 * `batches` is a generator of example arrays; sampling stops when
 * `settleRuns` consecutive batches leave `nominationVerdict` unchanged, or
 * when the source is exhausted. The number of examples fetched is then a
 * fact about how quickly this slot's evidence settles, not a window someone
 * guessed — which is the whole objection to the `24` this replaces.
 *
 * `settleRuns = 2` is reused, not invented: one unchanged batch is a
 * coincidence with nothing to disagree with it, two is the smallest run that
 * can — the same structural minimum `RELATING_WITNESS_FLOOR` already borrows
 * from `emergence/binding.js`, applied to batches instead of witnesses.
 */
export const SETTLE_RUNS = 2;

export async function enoughExamples(nextBatch, slotQid, { kind = null, settleRuns = SETTLE_RUNS, maxBatches = 12 } = {}) {
  const seen = [];
  let verdict = "none";
  let unchanged = 0;
  let batches = 0;
  while (unchanged < settleRuns && batches < maxBatches) {
    const batch = await nextBatch();
    // A REFUSED FETCH IS NOT AN EXHAUSTED SOURCE, and conflating them is how
    // a walk reports "the evidence ran out" when the giver simply declined.
    // Caught live: rate-limited mid-walk, `paced` returned null, the loop
    // read it as exhaustion and reported `settled: false` as though the data
    // had nothing more to say. The generator signals them apart — `null` is
    // a refusal, `[]` is genuinely nothing left — and the result says which
    // happened rather than leaving a caller to guess (P41: a check may
    // report what it found, never speak for one it never ran).
    if (batch === null || batch === undefined) return refusedResult(seen, slotQid, kind, batches);
    if (!batch.length) break;
    batches++;
    seen.push(...batch);
    const next = nominationVerdict(nominateRelating(slotQid, seen, { kind }));
    if (next === verdict) unchanged++;
    else {
      unchanged = 0;
      verdict = next;
    }
  }
  return {
    examples: seen,
    candidates: nominateRelating(slotQid, seen, { kind }),
    batches,
    settled: unchanged >= settleRuns,
    refused: false,
    examined: seen.length,
  };
}

const refusedResult = (seen, slotQid, kind, batches) => ({
  examples: seen,
  candidates: nominateRelating(slotQid, seen, { kind }),
  batches,
  settled: false,
  refused: true,
  examined: seen.length,
});

// ── the search-aware null ───────────────────────────────────────────────────
//
// SUPERSEDED IN PART, and kept with its finding rather than deleted. What
// follows nulls MAX PREVALENCE — how many witnesses the leading property
// has — against a fixed-margin swap. Measured after building it: that cannot
// work, and not for want of tuning. The curveball exchanges only entries
// where two rows DIFFER, so a property held by every witness never enters
// the swap at all; and preserving every column total is precisely what the
// perturbation is for, while the leader's witness count IS a column total.
// Concentrated evidence and pure noise both return `degenerate`, identically
// (pinned in wikidata.test.mjs). The question moved to `sameness.js`, which
// asks the one the user's own definition names — shared slots WITH differing
// values — instead of asking a margin-preserving null about a margin.
//
// `nominateRelating` SEARCHES: it ranges over every property the examples use
// and keeps the one with the most witnesses. `RELATING_WITNESS_FLOOR` is a
// structural minimum, not a null — it says two is the smallest set that can
// disagree with itself, and says nothing about whether two is surprising when
// the best of twenty-seven properties is being chosen.
//
// `emergence/kinds.js` already learned what that costs, in as many words:
// "there is nothing here to distinguish 'found by search' from 'found by
// chance,' and the single-subset existence gate `eva` already runs is the
// whole ground." Measured consequence, recorded in this repo's own MINE-1
// work: four clusters cleared the existence gate at pValue 0 and ALL FOUR
// were refused by the reseed/search-aware null — `kinds induced: 0`.
//
// So the search is nulled against ITSELF: permute, re-run the same
// best-property search on the permuted incidence, and see how often chance
// alone produces a leader this strong.
//
// THE PERTURBATION IS THE FIXED-MARGIN SWAP, and that choice is inherited
// rather than invented. kinds.js records trying an independent per-column
// shuffle FIRST and rejecting it on measurement: it preserves each field's
// prevalence but not each record's DEGREE, manufactures profile blocks that
// never existed, and the null then saturates against itself — "rejected at a
// stable ~15% collision rate across reseed counts from 24 to 1000 — not
// noise, a structural artefact of the perturbation." The curveball swap
// (Strona et al. 2014; Gotelli 2000's fixed-fixed null) preserves BOTH
// margins exactly — every example's degree and every property's prevalence —
// so it tests the one question worth asking here: do these examples
// concentrate on ONE property more than each example's own degree and each
// property's own overall use already predict?
//
// AND IT REFUSES WHEN IT CANNOT MOVE. Two witnesses that both use exactly
// one property leave a swap nothing to exchange; every draw returns the
// observed value, and a null with zero width has not tested anything.
// kinds.js calls that `degenerate_ground` and declines to report a finding;
// so does this. A refusal here is not a failure of the nomination — it is
// the honest statement that the evidence is too thin to null-test.

// mulberry32, the same generator nul/index.js and kinds.js seed their own
// draws with — one implementation of "a repeatable random", never a second.
const prng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** One curveball step: swap two DIFFERING properties between two examples,
 *  leaving both rows' degrees and both columns' totals untouched. */
export function curveballStep(rows, rnd) {
  if (rows.length < 2) return false;
  const i = Math.floor(rnd() * rows.length);
  let j = Math.floor(rnd() * rows.length);
  if (i === j) j = (j + 1) % rows.length;
  const onlyI = [...rows[i]].filter((p) => !rows[j].has(p));
  const onlyJ = [...rows[j]].filter((p) => !rows[i].has(p));
  if (!onlyI.length || !onlyJ.length) return false;
  const a = onlyI[Math.floor(rnd() * onlyI.length)];
  const b = onlyJ[Math.floor(rnd() * onlyJ.length)];
  rows[i].delete(a); rows[i].add(b);
  rows[j].delete(b); rows[j].add(a);
  return true;
}

const bestCount = (rows) => {
  const tally = new Map();
  for (const r of rows) for (const p of r) tally.set(p, (tally.get(p) ?? 0) + 1);
  let best = 0;
  for (const n of tally.values()) if (n > best) best = n;
  return best;
};

/**
 * relatingNull(slotQid, rawExamples, {kind, draws, seed}) — is the leading
 * property's witness count more than the search would find by chance?
 *
 * Returns `{observed, draws, atOrAbove, rank, degenerate, reason}`. `rank` is
 * the share of draws at or above the observed value — reported, never
 * thresholded here (P4/P9: this function states a number, a caller decides
 * what it licenses). `degenerate: true` means the swap could never move, so
 * nothing was tested.
 */
export function relatingNull(slotQid, rawExamples, { kind = null, draws = 200, seed = 0 } = {}) {
  const rows0 = [];
  for (const e of rawExamples ?? []) {
    if (!e?.id || e.id === slotQid) continue;
    if (kind && !instanceOfIn(e).includes(kind)) continue;
    const props = backPointersIn(e, slotQid);
    if (props.length) rows0.push(new Set(props));
  }
  const observed = bestCount(rows0);
  if (rows0.length < 2) {
    return { observed, draws: 0, atOrAbove: 0, rank: null, degenerate: true, reason: "fewer than two witnesses — a swap needs two rows" };
  }
  const rnd = prng((seed ^ 0x5ea2c4) >>> 0);
  let atOrAbove = 0;
  let moved = 0;
  const samples = [];
  for (let d = 0; d < draws; d++) {
    const rows = rows0.map((r) => new Set(r));
    // Enough attempted swaps to mix; a step that finds no differing pair is
    // counted as attempted, never retried into a different distribution.
    let movedThisDraw = 0;
    for (let k = 0; k < rows.length * 8; k++) if (curveballStep(rows, rnd)) movedThisDraw++;
    if (movedThisDraw) moved++;
    const b = bestCount(rows);
    samples.push(b);
    if (b >= observed) atOrAbove++;
  }
  if (!moved || samples.every((x) => x === samples[0])) {
    return {
      observed,
      draws,
      atOrAbove,
      rank: null,
      degenerate: true,
      reason: moved
        ? `all ${draws} null samples equal (${samples[0]}) — the swap has no room to move`
        : "no draw could exchange anything — every witness uses the same properties",
    };
  }
  return { observed, draws, atOrAbove, rank: Number((atOrAbove / draws).toFixed(4)), degenerate: false, reason: null };
}

// ── the adapter ─────────────────────────────────────────────────────────────
//
// Everything above this line parses one publisher's shapes. Everything the
// REASONING needs lives in seek.js and knows nothing about any of it. This
// function is the seam: it answers seek.js's four questions using the parsers
// above, and it is the only place a property id, a qid, or a URL appears in
// the answer path.
//
// An organ, injected the cast.js way — `get(url)` is supplied by whoever owns
// the crossing (explore-server.mjs, paced and recorded), so this module still
// contains no fetch call and stays testable against captured bytes.
//
// The qualifier ids below are the adapter's whole Wikidata-specific content,
// and that is the correct place for them: start/end time, replaces, replaced
// by. A different source names its own; seek.js never learns any of them.
const QUALIFIER = Object.freeze({ start: "P580", end: "P582", prev: "P1365", next: "P1366" });
const COUNTRY = "P17";
const INSTANCE_OF = "P31";

const qualifierValue = (claim, prop) => claim?.qualifiers?.[prop]?.[0]?.datavalue?.value ?? null;

/**
 * Every entity-valued claim as a relation seek.js can read — not just the two
 * `parseEntity` keeps. A general walk must see the whole neighbourhood, since
 * which relation matters is the thing it is trying to learn.
 */
export function asSourceEntity(rawEntity) {
  if (!rawEntity?.id) return null;
  const relations = [];
  for (const [prop, claims] of Object.entries(rawEntity.claims ?? {})) {
    for (const c of claims ?? []) {
      const value = c?.mainsnak?.datavalue?.value?.id;
      if (!value) continue;
      const start = qualifierValue(c, QUALIFIER.start)?.time ?? null;
      const end = qualifierValue(c, QUALIFIER.end)?.time ?? null;
      relations.push({
        relation: prop,
        value,
        ...(start && end ? { scope: { from: start, to: end } } : {}),
        prev: qualifierValue(c, QUALIFIER.prev)?.id ?? null,
        next: qualifierValue(c, QUALIFIER.next)?.id ?? null,
      });
    }
  }
  return {
    id: rawEntity.id,
    label: rawEntity.labels?.en?.value ?? null,
    kinds: (rawEntity.claims?.[INSTANCE_OF] ?? []).map((c) => c?.mainsnak?.datavalue?.value?.id).filter(Boolean),
    relations,
    address: isQid(rawEntity.id) ? entityUrl(rawEntity.id) : null,
  };
}

/**
 * makeWikidataSource({ get }) — the four questions, answered from Wikidata.
 *
 * `get` returns parsed JSON, or `null` when the giver DECLINED. That
 * distinction is carried through untouched: seek.js treats `null` as a
 * refusal and `[]` as exhaustion, and conflating them is how a walk reports
 * "the evidence ran out" when a rate limit was hit.
 */
export function makeWikidataSource({ get } = {}) {
  if (typeof get !== "function") throw new TypeError("makeWikidataSource: `get` is injected, never built here — this module owns no crossing");
  const raws = new Map();

  const readRaw = async (ids) => {
    const want = [...new Set((ids ?? []).filter(isQid))].filter((i) => !raws.has(i));
    for (let i = 0; i < want.length; i += 20) {
      const j = await get(entitiesUrl(want.slice(i, i + 20)));
      if (!j) return null; // declined — never an empty result
      for (const [id, e] of Object.entries(j.entities ?? {})) raws.set(id, e);
    }
    return (ids ?? []).map((i) => raws.get(i)).filter(Boolean);
  };

  return {
    name: GIVER,
    async resolve(surface) {
      const j = await get(searchUrl(surface));
      // `parseSearch` speaks this publisher's word for an identifier (`qid`);
      // seek.js's contract says `id`. Translating here is exactly the
      // adapter's job — the reasoner must never learn what a qid is.
      return j ? parseSearch(j).map((c) => ({ id: c.qid, label: c.label, description: c.description })) : null;
    },
    async entity(id) {
      const got = await readRaw([id]);
      return got?.length ? asSourceEntity(got[0]) : null;
    },
    async entities(ids) {
      const got = await readRaw(ids);
      return got === null ? null : got.map(asSourceEntity).filter(Boolean);
    },
    async neighbours(id) {
      const got = await readRaw([id]);
      return got?.length ? exampleIdsFrom(got[0]) : [];
    },
    async membersOf(relation, valueId) {
      const j = await get(inverseUrl([`${relation}=${valueId}`], 80));
      return j ? parseInverse(j).ids : null;
    },
    /**
     * Narrow a generic slot to the one scoped to the anchor's own context.
     * "vice president" resolves to a GENERIC role with no holders anywhere;
     * the office actually asked about is the instance of that role in the
     * country of an office the anchor really held. The anchor disambiguates
     * the slot, and that move is this publisher's own — seek.js only knows
     * that a source may or may not offer it.
     */
    async specialize(slotId, { scopes } = {}) {
      const officeIds = (scopes ?? []).map((s) => s.value).filter(isQid);
      const offices = await readRaw(officeIds);
      if (!offices?.length) return [];
      let country = null;
      for (const o of offices) {
        const c = o.claims?.[COUNTRY]?.[0]?.mainsnak?.datavalue?.value?.id;
        if (c) { country = c; break; }
      }
      if (!country) return [];
      const j = await get(inverseUrl([`${INSTANCE_OF}=${slotId}`, `${COUNTRY}=${country}`], 5));
      return j ? parseInverse(j).ids : [];
    },
  };
}

/** Wikidata times are ISO-ish with an era marker; days are the natural unit. */
export const wikidataSpan = (a, b) => {
  const ms = (t) => Date.parse(String(t).replace(/^\+/, ""));
  const d = ms(b) - ms(a);
  return Number.isFinite(d) ? d / 86400000 : NaN;
};
