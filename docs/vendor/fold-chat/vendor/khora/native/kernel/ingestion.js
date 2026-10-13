// native/kernel/ingestion.js — WHAT HAS NOT BEEN FULLY INGESTED, and the
// judgment it asks for (2026-09-28). Medium-blind, kernel-level. Standing:
// nomination.
//
// User direction, verbatim: "Are we able to tell what hasn't been fully
// ingested, and when that shows up inside something being reasoned over,
// provide the full span section to an llm to make a judgement relative to
// the respective for whom? But I want us to see how much we can do
// mechanically."
//
// THE MECHANICAL PART IS MOST OF IT. Every reader in this codebase already
// leaves a record of where it went and what it could not settle: the
// occupancy reader's typed refusals (`inverted_subject`, `pronoun_unbound`,
// `occupant_not_a_referent`…), the undecided slots it left `contested` or
// `none`, the binder's `pronoun_frame_named` gaps, the native perceiver's
// `gaps` entries — each at an address. Ingestion standing is READ OFF that
// record, per holon (kernel/gfp-claim.js's addresses: "/", "/p3", "/p3/s12"):
//   unread   — no reader's reach covers the holon
//   partial  — a reader reached it and left typed gaps or open slots INSIDE it
//   read     — reached, nothing open inside it
// A reader that reached "/p3" reached everything under it; a gap at
// "/p3/s12" is a gap inside "/p3". Nothing here decides what a gap means.
//
// WHEN IT SHOWS UP INSIDE REASONING. A claim cites a holon. If that holon's
// standing is not `read`, `judgmentRequest` builds the ask — the ENCLOSING
// holon's full text (the section, one level up — `sectionOf` is the
// caller's, since bytes are the caller's), the for-whom it is asked FOR
// (kernel/for-whom.js: giver, question, priors — the frame the judgment
// stands in, never a view from nowhere), the mechanical findings (which
// readers reached it, which gaps, which open slots), and the question in
// the for-whom's own terms. This module never calls a model. The answer
// comes back as a POINT — a verdict index over declared candidates, never
// prose (the select posture, the-fold P32) — and `landJudgment` records it
// as an EOCollapse@1 over an EOUndecided@1 for THAT for-whom, under a rule
// named for the judge, with the judge's recipe as giver. A second for-whom
// asks its own question and lands its own collapse; the two stand together.
//
// THE WALL. A judgment is a collapse FOR a for-whom, not a fact about the
// material: it never changes the ingestion standing (the gaps stay on the
// record), it never re-types a reader's refusal, and a request for a holon
// already `read` is refused — there is nothing to ask.

import { undecided, collapse } from "./undecided.js";
import { holon, contains, ancestry, segmentsOf } from "./gfp-claim.js";

export const INGESTION_SCHEMA = "EOIngestionStanding@1";
export const JUDGMENT_REQUEST_SCHEMA = "EOJudgmentRequest@1";
export const STANDINGS = Object.freeze(["unread", "partial", "read"]);
export const JUDGMENT_CANDIDATES = Object.freeze(["holds", "refused", "undetermined"]);

const inside = (outer, inner) => contains(holon(outer), holon(inner));

/**
 * ingestionStanding({ holon: h, reached, gaps, slots })
 *   reached: [{ holon, recipe }]          — a reader (by recipe) reached this holon and everything under it
 *   gaps:    [{ holon, reason, recipe? }]  — a typed gap a reader landed at this holon
 *   slots:   [{ holon, verdict, id? }]    — an undecided slot's latest collapse verdict at this holon
 * -> { schema, holon, standing, readers, gaps, openSlots, because }
 */
export function ingestionStanding({ holon: h, reached = [], gaps = [], slots = [] } = {}) {
  const target = holon(h);
  const readers = [...new Set(reached.filter((r) => r?.holon && inside(r.holon, target)).map((r) => r.recipe ?? "reader"))];
  if (!readers.length) return Object.freeze({ schema: INGESTION_SCHEMA, holon: target, standing: "unread", readers: Object.freeze([]), gaps: Object.freeze([]), openSlots: Object.freeze([]), because: "no reader's reach covers this holon" });
  const here = gaps.filter((g) => g?.holon && inside(target, g.holon)).map((g) => Object.freeze({ holon: holon(g.holon), reason: g.reason ?? "gap", recipe: g.recipe ?? null, detail: g.detail ?? null }));
  const open = slots.filter((s) => s?.holon && inside(target, s.holon) && s.verdict !== "chosen").map((s) => Object.freeze({ holon: holon(s.holon), verdict: s.verdict ?? "open", id: s.id ?? null }));
  const standing = here.length || open.length ? "partial" : "read";
  return Object.freeze({ schema: INGESTION_SCHEMA, holon: target, standing, readers: Object.freeze(readers), gaps: Object.freeze(here), openSlots: Object.freeze(open), because: standing === "read" ? `reached by ${readers.length} reader(s), nothing open inside` : `reached by ${readers.length} reader(s); ${here.length} typed gap(s) and ${open.length} open slot(s) inside` });
}

/** The claims (each carrying `ground`, a holon) that rest on a holon not fully read, with the standing they rest on. */
export function unreadCited({ claims = [], reached = [], gaps = [], slots = [] } = {}) {
  return claims.map((c) => ({ claim: c, standing: ingestionStanding({ holon: c?.ground ?? "/", reached, gaps, slots }) })).filter((x) => x.standing.standing !== "read");
}

/** The enclosing holon: one level up, or "/" at the top. */
export const parentOf = (h) => { const segs = segmentsOf(h); return segs.length <= 1 ? "/" : "/" + segs.slice(0, -1).join("/"); };

/**
 * judgmentRequest({ standing, forWhom, sectionOf, claim })
 *   standing:  an EOIngestionStanding@1 that is not `read`
 *   forWhom:   EOForWhom@1 (id, giver, question) — the frame the judgment is FOR
 *   sectionOf: (holon) -> text | null — the caller hands over the enclosing holon's full text
 *   claim:     the thing being reasoned over that cited the holon (kept verbatim on the request)
 * -> EOJudgmentRequest@1 | null (null when there is nothing to ask)
 */
export function judgmentRequest({ standing, forWhom, sectionOf, claim = null } = {}) {
  if (standing?.schema !== INGESTION_SCHEMA) throw new TypeError("judgmentRequest: an EOIngestionStanding@1");
  if (!forWhom?.id || !forWhom?.question) throw new TypeError("judgmentRequest: a for-whom with an id and a question — a judgment nobody asked for, for nothing, is a view from nowhere");
  if (typeof sectionOf !== "function") throw new TypeError("judgmentRequest: sectionOf(holon) is the caller's — bytes are never held here");
  if (standing.standing === "read") return null;
  const section = parentOf(standing.holon);
  const text = sectionOf(section) ?? sectionOf(standing.holon) ?? null;
  const left = [...standing.gaps.map((g) => `${g.reason}@${g.holon}`), ...standing.openSlots.map((s) => `${s.verdict}@${s.holon}`)];
  return Object.freeze({
    schema: JUDGMENT_REQUEST_SCHEMA,
    holon: standing.holon, section, ancestry: Object.freeze(ancestry(standing.holon)),
    text, forWhom: Object.freeze({ id: forWhom.id, giver: forWhom.giver ?? null, question: forWhom.question, priors: Object.freeze([...(forWhom.priors ?? [])]) }),
    findings: Object.freeze({ standing: standing.standing, readers: standing.readers, left: Object.freeze(left) }),
    claim,
    candidates: JUDGMENT_CANDIDATES,
    ask: `Read the section at ${section} for the question «${forWhom.question}». The readers that reached ${standing.holon} left open: ${left.join(", ") || "nothing named"}. Does the section settle the claim? Point at one of: ${JUDGMENT_CANDIDATES.join(" / ")}.`,
  });
}

/**
 * landJudgment(request, { answer, read, judge, cursor }) -> { record, collapse, reading }
 *   answer: the judge's own words — prose, whatever it wrote (user direction, 2026-09-28: "We
 *           can't stop it from writing a verdict in prose and shouldn't, but we can read that
 *           mechanically for the answer")
 *   read:   (answer, request) -> { verdict, anchored, decider?, because? } — the caller's medium
 *           reader (organs/judgment-reader.js for text): which candidate the prose commits to,
 *           and whether what it points at as deciding is IN the section it was handed
 *   judge:  { recipe } — the judge's own address (model + prompt + version), the collapse's giver
 * The reading is mechanical and the collapse is derived from it: a committed candidate whose
 * decider is anchored in the section is CHOSEN; a committed candidate that points at nothing in
 * the section is CONTESTED against `undetermined` (the judge asserted, the bytes did not back it);
 * no single commitment is NONE. A verdict already a point (a candidate string) is read as itself.
 */
export function landJudgment(request, { answer, verdict = null, read = null, judge, cursor = null } = {}) {
  if (request?.schema !== JUDGMENT_REQUEST_SCHEMA) throw new TypeError("landJudgment: an EOJudgmentRequest@1");
  if (!judge?.recipe) throw new TypeError("landJudgment: the judge's recipe is declared — a verdict with no address is a rumour");
  let reading;
  if (verdict !== null && answer === undefined) reading = { verdict, anchored: true, decider: null, because: "a point, not prose" };
  else {
    if (typeof read !== "function") throw new TypeError("landJudgment: prose is read by an injected reader — the kernel reads no medium");
    reading = read(answer, request) ?? { verdict: null, anchored: false };
  }
  const idx = JUDGMENT_CANDIDATES.indexOf(reading.verdict);
  const und = JUDGMENT_CANDIDATES.indexOf("undetermined");
  const record = undecided({ question: request.forWhom.question, slot: `judgment:${request.holon}`, giver: `kernel/ingestion.js for ${request.forWhom.id}`, cursor, at: { holon: request.holon, section: request.section }, candidates: JUDGMENT_CANDIDATES.map((v) => ({ value: v, via: "judgment", features: { left: request.findings.left.length } })) });
  const rule = {
    name: `judgment:${judge.recipe}`, giver: judge.recipe,
    decide: () => {
      if (idx < 0) return { reason: `the judge's words commit to no single candidate (${reading.because ?? "none read"})` };
      if (!reading.anchored) return { contested: [idx, und], reason: `the judge said "${reading.verdict}" but what it points at is not in the section it was handed (${reading.because ?? "no decider"})` };
      return { chosen: idx, reason: `the judge's words commit to "${reading.verdict}" for ${request.forWhom.id}${reading.decider ? `, deciding on «${String(reading.decider).slice(0, 80)}»` : ""}` };
    },
  };
  return { record, collapse: collapse(record, { forWhom: { id: request.forWhom.id }, rule, cursor }), reading };
}
