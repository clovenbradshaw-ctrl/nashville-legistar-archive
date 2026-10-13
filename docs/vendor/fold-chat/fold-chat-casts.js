// fold-chat-casts.js — whose turn established each referent, and a scope the person can actually reach (fix (e)).
//
// A pronoun binds only to referents the PERSON's own turns established, or that the FOLD showed them in an answer —
// never to a referent only a SOURCE asserted. That is the sibling-word failure (Great Wall vs Berlin Wall: "about the
// Great Wall" returned the Berlin Wall turn) and the top-2 pollution (D1: 17/18 near-carry queries carried a second,
// unrelated referent). The record's weight still ranks; the holder scope and the person's refusals are hard filters.
//
// OFF by default: resolveQuestion/followUp use it only when the caller passes `casts` (the live page reads
// localStorage["fold-chat:casts"] === "on"). Pure; node-testable. The model never sees this module.
import { personLike } from "./fold-chat-mind.js";

const fold = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const H = { USER: "user", FOLD: "fold", SOURCE: "source" };

export const CASTS = Object.freeze({
  // DECLARED (II.11): a SOURCE's assertion is not the person's establishment; the fold's shown answer is reachable.
  accessibility: Object.freeze({ [H.USER]: [H.FOLD], [H.FOLD]: [H.SOURCE, H.USER], [H.SOURCE]: [] }),
  // DECLARED, never measured: animacy of a thing-shaped surface (an article title, an office, a structure, a year).
  inanimate: /\b(?:election|presidential|office|presidency|king|queen|prime minister|mayor|president|wall|tower|bridge|river|city|capital|planet|element|band|album|record label|article|page|edition|ship|war|battle|treaty|law)\b|\b(?:19|20)\d{2}\b|·|—/i,
  pronounGender: Object.freeze({ he: "p", him: "p", his: "p", she: "p", her: "p", hers: "p", it: "n", its: "n" }),
});

/** The head token and first token of a surface, folded — what "appears in a turn" means. */
const tokenRuns = (s) => (String(s).match(/[\p{L}\p{N}]+/gu) || []).map(fold);

/** The gendered pronoun form the ask actually uses, or null (used only to filter a referent's animacy). */
export function pronounOf(ask, gate) {
  if (gate?.kind !== "pronoun") return null;
  return tokenRuns(ask).find((w) => CASTS.pronounGender[w]) || null;
}

const mentions = (surface, text) => {
  const ws = tokenRuns(surface);
  if (!ws.length) return false;
  const t = new Set(tokenRuns(text));
  return ws.some((w) => t.has(w));
};

/** Build the cast from the chat's messages and referent record. `established`: [{ id, surface, holder, person, weight, age }]. */
export function castOf(messages = [], record = {}) {
  const userSeen = new Set(), foldSeen = new Set();
  for (const m of messages || []) {
    const c = String(m?.content ?? m?.text ?? "");
    if (!c) continue;
    const into = m.role === "user" ? userSeen : foldSeen;
    tokenRuns(c).forEach((w) => into.add(w));
  }
  const entities = (record?.entities || []).map((e, i) => ({ e, i })).sort((a, b) => (b.e.weight || 0) - (a.e.weight || 0));
  const established = entities.map(({ e, i }) => {
    const surface = e.surface || e.text || "";
    const inUser = [...userSeen].some((w) => mentions(surface, w)) || mentions(surface, [...userSeen].join(" "));
    const inFold = !inUser && (mentions(surface, [...foldSeen].join(" ")));
    const holder = inUser ? H.USER : inFold ? H.FOLD : H.SOURCE;
    return { id: fold(surface), surface, holder, person: personLike(surface, null) && !CASTS.inanimate.test(surface), weight: e.weight || 0, age: i };
  });
  const userReachable = new Set([H.USER, ...(CASTS.accessibility[H.USER] || [])]);
  return { H, established, accessibility: CASTS.accessibility, userReachable, fold: CASTS };
}

/** Resolve an anaphor to ONE referent under the person's scope. `pronoun` = the matched pronoun form of the ask.
 *  Returns the resolveQuestion shape ({ said, resolved, carried:[{surface, by}], reason, id }). */
export function resolveCast(question, cast, { rejected = null, pronoun = null } = {}) {
  const said = String(question ?? "").trim();
  const base = { said, resolved: said, carried: [], reason: "no-record" };
  if (!cast || !cast.established.length) return base;
  const refused = new Set((Array.isArray(rejected) ? rejected : []).map((x) => fold(x).trim()));
  const wantAnim = pronoun && CASTS.pronounGender[pronoun] ? CASTS.pronounGender[pronoun] : null;
  let pool = cast.established.filter((e) => cast.userReachable.has(e.holder) && e.holder !== H.SOURCE && !refused.has(e.id));
  if (wantAnim === "n") pool = pool.filter((e) => !e.person);
  else if (wantAnim === "p") { const pl = pool.filter((e) => e.person); if (pl.length) pool = pl; }
  if (!pool.length) return { ...base, reason: wantAnim ? "nothing-person-like-or-reachable" : "nothing-reachable", why: "the referent the ask points back to is out of the person's scope, or was refused" };
  // one best, never top-2: a second referent pollutes the query (D1 1a)
  const top = [...pool].sort((a, b) => (b.weight - a.weight) || (a.age - b.age))[0];
  const carried = [{ surface: top.surface, by: "cast:holder-scope" }];
  return { ...base, carried, resolved: `${said} (about: ${top.surface})`, reason: "carried", id: top.id };
}