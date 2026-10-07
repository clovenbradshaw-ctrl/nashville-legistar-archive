// resolutions.js — the discourse at three resolutions, one per grain of the
// Interpretation domain, computed from the record and never written by a
// model. Pure; the referent index and the measurement organ are injected.
//
//   ATMOSPHERE (Interpretation · Ground)  where the conversation stands: the
//     ground it holds, where it last re-zeroed, what it has cited, whether the
//     last exchange moved anything. Read off the transcript as a stream of
//     referent sets — an exchange belongs to the current ground while it
//     shares a referent with the ground after it; the first that shares
//     nothing is the cut (REC). No paraphrase anywhere in it.
//   LENS (Interpretation · Figure)  what is said about the figures in play:
//     the ledger's notes whose ends resolve to the active referents, with
//     their standing and their disputes; the declared voids on them; the
//     conversation's own checked turns that name them.
//   PARADIGM (Interpretation · Pattern)  what recurs: acts that recur between
//     the same referents in the material (the ledger's own recurrence, at
//     binding's structural floor of 2), and the acts a referent bears most.
//
// THREE RULES. (1) Identity is the index's — an end, a name in a question, a
// name in an old answer all resolve through `index.resolve`, never a string
// (P11, P170). (2) Every block is cut where widening stops making a
// difference — `dmdWindow` over rows ordered by relevance, reach = the
// active referents the rows carry (the same measurement historyWindow and
// deriveRecordWindow spend); without the organ the cut is DECLARED and says
// so. (3) The wording is templated in the answer's own register and passes
// the firewall: no "passage", "prompt", "retrieved" — the ledger block's own
// phrases ("read in N places", "stated once so far", "disputed by X — not
// settled", "an open gap, not a finding that it is false") are reused, never
// re-coined.
//
// Why company at ±1 token is NOT here: kind-standing measured that a
// referent's immediate company reads the syntactic frame, not the act
// (saw/wrote 0.744 vs the synonym pair looked/gazed 0.585). The Pattern
// block's material half is recurrence on the ledger, which has a witness
// count and no such confound.
import { referentsOf, fold } from "./dialogue.js";
import { strikeAddresses } from "./firewall.js";

const DEPTHS = Object.freeze([1, 2, 3, 4, 6, 8, 12, 16, 24]); // a ladder, structural; the shallowest depth that reproduces the reach wins
export const DECLARED_LINES = 5; // giver: the ledger block's own HYPERLEXICON_LEDGER_LINES (holon.js), reused as the declared fallback when no measurement organ is injected
export const RECURRENCE_FLOOR = 2; // binding's structural minimum (P58): one arrival has no recurrence to test

const resolveIds = (index, name) => { try { const r = index?.resolve?.(String(name ?? "")); return r instanceof Set ? r : new Set(r ?? []); } catch { return new Set(); } };
const represent = (index, id) => { try { return index?.represent?.(id) ?? id; } catch { return id; } };
const addressOf = (w) => String(typeof w === "string" ? w : (w?.at ?? w?.ref ?? "")).split("~")[0];
const idsOfText = (text, index) => referentsOf(text, index).ids;
const sortedIds = (ids) => [...ids].sort();
const list = (names) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
const turnRef = (t) => `[turn:${t}]`;
// The mouth-facing `text` of every block is struck of addresses (firewall.js::strikeAddresses — one wall, at the mouth's door too); `lines` keep theirs for the record.

/**
 * The shared cut. `rows` are ordered most-relevant-first and each carries
 * `ids` (a Set of referent ids). The window is the shallowest depth at
 * which showing fewer rows changes nothing about the REACH — and reach is
 * measured at the grain the block shows: by default the active referents
 * the rows carry (the history window's own grain); a block passes
 * `reachOf(row)` for its own — the ACT for a note (a second note about the
 * same referent with a different act is a difference; a repeat is not), the
 * ADDRESS for a checked turn (P45's own identity for records). Measured
 * before this was added: reach by referent alone collapsed every list about
 * one referent to a single row. Rows carrying none of the active ids never
 * count and are dropped first.
 */
export function dmdCut(rows, active, { dmdWindow = null, declared = DECLARED_LINES, reachOf = null } = {}) {
  const relevant = rows.filter((r) => [...(r.ids ?? [])].some((id) => active.has(id)));
  if (!relevant.length) return { rows: [], window: 0, basis: "nothing carries an active referent", ceiling: false };
  if (typeof dmdWindow !== "function") return { rows: relevant.slice(0, declared), window: Math.min(declared, relevant.length), basis: `declared: no measurement organ injected — ${declared} lines`, ceiling: false };
  // THE WHOLE SET IS NEVER A CANDIDATE. Measured 2026-09-07: with
  // `relevant.length` among the depths, a set whose every row carries a
  // distinct act "converged" at itself — the tautology handed 94 Lens lines
  // about one referent and the sentence window rode its ceiling on every
  // question. Only the ladder's rungs below the set are tried; when none
  // reproduces the whole set's reach the kernel says so
  // (`reach_exceeds_candidates`) and the ladder's TOP is handed as the
  // declared budget (P9), named a ceiling on the record — never a
  // measurement. A set no larger than the declared lines is handed whole.
  const candidates = DEPTHS.filter((d) => d < relevant.length);
  if (!candidates.length) return { rows: relevant, window: relevant.length, basis: "whole set: one row", ceiling: false };
  const keysOf = typeof reachOf === "function" ? reachOf : (r) => [...r.ids].filter((id) => active.has(id));
  const derive = (obs) => sortedIds(new Set(obs.flatMap((r) => keysOf(r))));
  let w;
  let measurementThrew = false;
  try { w = dmdWindow(relevant, derive, { candidates, restrict: (obs, depth) => obs.slice(0, depth), equal: (a, b) => a.length === b.length && a.every((x, i) => x === b[i]) }); }
  catch { measurementThrew = true; }
  if (measurementThrew) {
    const window = Math.min(declared, relevant.length);
    return { rows: relevant.slice(0, window), window, basis: "declared: measurement organ threw — no measured cut", ceiling: false, gap: "measurement_threw" };
  }
  if (w?.window) return { rows: relevant.slice(0, w.window), window: w.window, basis: w.basis ?? "measured", ceiling: false, gap: null };
  // No rung below the set reproduced its reach. A set no larger than the
  // declared lines is handed whole (every row is its own difference and the
  // budget covers it); a larger one is cut at the ladder's top and says so.
  if (relevant.length <= declared) return { rows: relevant, window: relevant.length, basis: `whole set: ${relevant.length} rows within the declared lines — no depth below reproduced their reach`, ceiling: false, gap: w?.gap ?? null };
  const top = candidates.at(-1);
  return { rows: relevant.slice(0, top), window: top, basis: `ceiling: no depth up to ${top} reproduced the reach of all ${relevant.length} rows — the ladder's top handed as the declared budget`, ceiling: true, gap: w?.gap ?? "reach_exceeds_candidates", of: relevant.length };
}

/** The referents in play: the question's own; when it names none, the last answer's (anaphora). */
export function activeReferents(question, transcript = [], index) {
  const own = idsOfText(question, index);
  if (own.size) return { ids: own, basis: "the question's own referents" };
  const last = transcript.length ? transcript[transcript.length - 1] : null;
  const bound = last ? idsOfText(last.answer ?? "", index) : new Set();
  return { ids: bound, basis: bound.size ? "the last answer's referents (the question names none)" : "none" };
}

/** Each exchange as referent sets, in order: what the question named, and what the whole exchange carried. */
export function exchangesOf(transcript = [], index) {
  return (transcript ?? []).map((t) => {
    const asked = idsOfText(t.question ?? "", index);
    return { turn: t.turn, asked, ids: new Set([...asked, ...idsOfText(t.answer ?? "", index)]), refs: [...new Set((t.refs ?? []).map(addressOf).filter(Boolean))] };
  });
}

/**
 * ATMOSPHERE. Grounds are segmented FORWARD on what each question names: an
 * exchange opens a new ground when its question names referents and none of
 * them was carried by the ground so far; a question naming nothing (an
 * anaphor, a quote-me, a why) continues the ground it was asked on. The
 * first cut tried — "any exchange sharing any referent with the ground" —
 * never cut on a novel, because the protagonist is in nearly every answer;
 * the question is where the reader moves, so the question is what segments.
 */
export function atmosphereBlock({ question = "", transcript = [], index, prominence = null }) {
  const ex = exchangesOf(transcript, index).filter((e) => e.ids.size);
  if (!ex.length) return { lines: [], text: "", ground: null, basis: "no exchange resolves to a referent yet" };
  const grounds = [];
  for (const e of ex) {
    const cur = grounds.at(-1);
    const opens = !cur || (e.asked.size && ![...e.asked].some((id) => cur.ids.has(id)));
    if (opens) grounds.push({ exchanges: [e], ids: new Set(e.ids) });
    else { cur.exchanges.push(e); for (const id of e.ids) cur.ids.add(id); }
  }
  const ground = grounds.at(-1), before = grounds.length > 1 ? grounds.at(-2) : null;
  // The ground is named by its most PROMINENT referents — by how many of its exchanges carry each, then by the caller's prominence (the mention book's count in the material) — so a one-off surface the index admitted ("God Which") never names a ground a real being stands on. Measured 2026-09-07, live.
  const inExchanges = (g, id) => g.exchanges.filter((e) => e.ids.has(id)).length;
  const rank = (g) => [...g.ids].sort((a, b) => inExchanges(g, b) - inExchanges(g, a) || ((typeof prominence === "function" ? prominence(b) : 0) - (typeof prominence === "function" ? prominence(a) : 0)));
  const named = (g) => list(rank(g).slice(0, 3).map((id) => represent(index, id)));
  const first = ground.exchanges[0].turn, last = ground.exchanges.at(-1).turn;
  const n = ground.exchanges.length;
  const lines = [];
  lines.push(`For ${n === 1 ? "one exchange" : `${n} exchanges`} the conversation has stood on ${named(ground)} ${n === 1 ? turnRef(first) : `[turn:${first}–${last}]`}${before ? `; it turned there at turn ${first} from ${named(before)}` : ""}.`);
  const cited = [...new Set(ground.exchanges.flatMap((e) => e.refs))];
  if (cited.length) {
    const bySource = new Map(); for (const r of cited) { const s = r.split("#")[0]; bySource.set(s, (bySource.get(s) ?? 0) + 1); }
    lines.push(`Cited on this ground so far: ${[...bySource].map(([s, k]) => `${k} place${k === 1 ? "" : "s"} in ${s}`).join(", ")}.`);
  }
  if (n >= 2) {
    const earlier = new Set(ground.exchanges.slice(0, -1).flatMap((e) => [...e.ids]));
    const fresh = [...ground.exchanges.at(-1).ids].filter((id) => !earlier.has(id));
    lines.push(fresh.length ? `The last exchange brought ${list(fresh.sort((a, b) => ((typeof prominence === "function" ? prominence(b) : 0) - (typeof prominence === "function" ? prominence(a) : 0))).slice(0, 3).map((id) => represent(index, id)))} onto this ground.` : "The last exchange brought nothing the ground had not already held.");
  }
  return { lines, text: strikeAddresses(`Where the conversation stands:\n${lines.join("\n")}`), ground: { turns: [first, last], ids: sortedIds(ground.ids), cited: cited.length, before: before ? sortedIds(before.ids) : null, grounds: grounds.length }, basis: "grounds segmented on what each question names; a question naming nothing the ground held opens a new one" };
}

const standingPhrase = (n) => {
  const by = [...new Set((n.disputedBy ?? []).map((d) => (typeof d === "string" ? d : d?.source)).filter(Boolean))];
  const disputed = by.length ? `; disputed by ${by.join(", ")} — not settled` : "";
  const sources = Number.isFinite(n.sources) ? n.sources : new Set((n.witnesses ?? []).map((w) => addressOf(w).split("#")[0])).size;
  const primaries = n.kinds?.primary ?? 0;
  if (primaries && sources >= 2) return `read in ${sources} places, one of them a source the account itself cites${disputed}`;
  if (sources >= 2) return `read in ${sources} places${disputed}`;
  return `stated once so far${disputed}`;
};
const addressesOf = (n, max = 2) => [...new Set((n.witnesses ?? []).map(addressOf).filter((a) => a && a.includes("#")))].slice(0, max);
const noteIds = (n, index) => new Set([...resolveIds(index, n.subject ?? n.end1), ...resolveIds(index, n.object ?? n.end2)]);
const noteLine = (n) => `${n.subject ?? n.end1} — ${n.verb ?? n.label}→ ${n.object ?? n.end2}`;

/**
 * THE LENS'S OWN CUT, shared. Notes whose ends resolve to the active
 * referents, ranked by how many active referents they carry, then by
 * co-activation (the other end is a referent the question or the last
 * answer also names), then by standing, then by recurrence — and cut at
 * the act grain. activation-retrieval.js calls this SAME function so the
 * sentences it hands at a resolution that carries the Lens are the ones
 * that ground the Lens's shown acts (THE-HOLOGRAPH §6: a higher holon
 * replaces the material it was computed from) — one ranking, one cut,
 * never two lists that drift. `acts` is the set of `id|label` keys shown.
 */
export function lensCut({ active, index, notes = [], dmdWindow = null, question = "", transcript = [] }) {
  if (!active?.size) return { rows: [], window: 0, basis: "no active referent", acts: new Set(), ceiling: false };
  const last = transcript?.length ? transcript[transcript.length - 1] : null;
  const co = new Set([...idsOfText(question, index), ...idsOfText(last?.answer ?? "", index)].filter((id) => !active.has(id)));
  const rows = (notes ?? []).map((n) => ({ n, ids: noteIds(n, index), sources: Number.isFinite(n.sources) ? n.sources : 0, seen: (n.witnesses ?? []).length }))
    .filter((r) => r.ids.size)
    .sort((a, b) => [...b.ids].filter((id) => active.has(id)).length - [...a.ids].filter((id) => active.has(id)).length
      || [...b.ids].filter((id) => co.has(id)).length - [...a.ids].filter((id) => co.has(id)).length
      || b.sources - a.sources || b.seen - a.seen);
  const act = (r) => [...r.ids].filter((id) => active.has(id)).map((id) => `${id}|${fold(r.n?.verb ?? r.n?.label)}`);
  const cut = dmdCut(rows, active, { dmdWindow, reachOf: act });
  return { ...cut, act, acts: new Set(cut.rows.flatMap(act)), coactive: sortedIds(co) };
}

/**
 * LENS. Notes whose ends resolve to the active referents, with standing,
 * addresses and disputes; the declared voids on them; the conversation's
 * own checked turns that name them. Each list cut by the measurement.
 */
export function lensBlock({ question = "", active, index, notes = [], voids = [], records = [], transcript = [], dmdWindow = null }) {
  if (!active?.size) return { lines: [], text: "", basis: "no active referent" };
  const notesCut = lensCut({ active, index, notes, dmdWindow, question, transcript });
  const act = (r) => [...r.ids].filter((id) => active.has(id)).map((id) => `${id}|${fold(r.n?.verb ?? r.n?.label ?? r.v?.verb ?? r.v?.label)}`);
  const voidRows = (voids ?? []).filter((v) => v && (v.subject ?? v.end1)).map((v) => ({ v, ids: new Set([...resolveIds(index, v.subject ?? v.end1), ...resolveIds(index, v.object ?? v.end2)]) }));
  const voidsCut = dmdCut(voidRows, active, { dmdWindow, reachOf: act });
  const recordRows = [...(records ?? []).map((r) => ({ turn: r.turn, text: r.gist ?? "", refs: (r.refs ?? []).map(addressOf) })), ...(transcript ?? []).map((t) => ({ turn: t.turn, text: String(t.answer ?? "").split(/(?<=[.!?])\s+/)[0] ?? "", refs: (t.refs ?? []).map(addressOf) }))]
    .filter((r) => r.text)
    .map((r) => ({ ...r, ids: idsOfText(r.text, index) }))
    .sort((a, b) => b.turn - a.turn);
  const seenTurn = new Set();
  const recordsCut = dmdCut(recordRows.filter((r) => (seenTurn.has(r.turn) ? false : (seenTurn.add(r.turn), true))), active, { dmdWindow, reachOf: (r) => (r.refs.length ? r.refs : [...r.ids].filter((id) => active.has(id)).map((id) => `${id}|turn`)) });
  const byRef = new Map();
  const add = (id, line) => { if (!byRef.has(id)) byRef.set(id, []); byRef.get(id).push(line); };
  for (const r of notesCut.rows) { const id = [...r.ids].find((x) => active.has(x)); const addr = addressesOf(r.n); add(id, `- ${noteLine(r.n)}${addr.length ? ` [${addr.join(", ")}]` : ""} (${standingPhrase(r.n)})`); }
  for (const r of voidsCut.rows) { const id = [...r.ids].find((x) => active.has(x)); const sc = r.v.scope ?? {}; const over = Array.isArray(sc.sources) && sc.sources.length ? `looked for in ${sc.sources.length} source${sc.sources.length === 1 ? "" : "s"}` : "looked for in what was read"; add(id, `- looked for and not found so far: ${r.v.subject ?? r.v.end1} — ${r.v.verb ?? r.v.label}→ ${r.v.object ?? r.v.end2 ?? "?"} (${over}; an open gap, not a finding that it is false)`); }
  for (const r of recordsCut.rows) { const id = [...r.ids].find((x) => active.has(x)); add(id, `- earlier in this conversation ${turnRef(r.turn)}: ${r.text}${r.refs.length ? ` [${r.refs.slice(0, 2).join(", ")}]` : ""}`); }
  if (!byRef.size) return { lines: [], text: "", basis: "nothing on the ledger or the record names the active referents", windows: { notes: notesCut.window, voids: voidsCut.window, records: recordsCut.window }, cuts: { notes: { window: notesCut.window, basis: notesCut.basis, ceiling: notesCut.ceiling, of: notesCut.of ?? null } } };
  const lines = [];
  for (const [id, ls] of byRef) { lines.push(`${represent(index, id)}:`); lines.push(...ls); }
  return { lines, text: strikeAddresses(`What is said about ${list([...byRef.keys()].map((id) => represent(index, id)))}:\n${lines.join("\n")}`), windows: { notes: notesCut.window, voids: voidsCut.window, records: recordsCut.window }, cuts: { notes: { window: notesCut.window, basis: notesCut.basis, ceiling: notesCut.ceiling === true, of: notesCut.of ?? null } }, basis: { notes: notesCut.basis, voids: voidsCut.basis, records: recordsCut.basis } };
}

/**
 * PARADIGM. What recurs: an act recurring between the same two referents
 * (witness count at binding's floor), and the acts a referent bears most
 * across the ledger. Material-side only — the conversation's own corrections
 * already reach the mouth as facts in scope (P126) and are not doubled here.
 */
export function paradigmBlock({ active, index, notes = [], dmdWindow = null }) {
  if (!active?.size) return { lines: [], text: "", basis: "no active referent" };
  const key = (ids) => sortedIds(ids).join("+");
  const pairs = new Map();
  const bears = new Map();
  for (const n of notes ?? []) {
    const s = resolveIds(index, n.subject ?? n.end1), o = resolveIds(index, n.object ?? n.end2);
    const count = Math.max((n.witnesses ?? []).length, (n.spans ?? []).length, 1);
    const label = fold(n.verb ?? n.label);
    if (!label) continue;
    if (s.size && o.size) { const k = `${key(s)}|${label}|${key(o)}`; const p = pairs.get(k) ?? { s, o, label: n.verb ?? n.label, count: 0 }; p.count += count; pairs.set(k, p); }
    for (const id of [...s, ...o]) { if (!active.has(id)) continue; const m = bears.get(id) ?? new Map(); m.set(label, (m.get(label) ?? 0) + count); bears.set(id, m); }
  }
  const rows = [...pairs.values()].filter((p) => p.count >= RECURRENCE_FLOOR).map((p) => ({ p, ids: new Set([...p.s, ...p.o]), count: p.count })).sort((a, b) => b.count - a.count);
  const cut = dmdCut(rows, active, { dmdWindow, reachOf: (r) => [`${key(r.p.s)}|${fold(r.p.label)}|${key(r.p.o)}`] });
  const lines = cut.rows.map((r) => `«${r.p.label}» recurs between ${represent(index, [...r.p.s][0])} and ${represent(index, [...r.p.o][0])} (${r.count} places).`);
  for (const [id, m] of bears) {
    const top = [...m].filter(([, c]) => c >= RECURRENCE_FLOOR).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (top.length) lines.push(`${represent(index, id)} most often stands in «${top.map(([l]) => l).join("», «")}».`);
  }
  if (!lines.length) return { lines: [], text: "", window: cut.window, basis: "nothing recurs at the floor for the active referents" };
  return { lines, text: strikeAddresses(`What recurs:\n${lines.join("\n")}`), window: cut.window, basis: cut.basis };
}

/**
 * resolutionBlocks({ level, ... }) → { text, atmosphere, lens, paradigm }.
 * level 0: nothing; 1: atmosphere; 2: + lens; 3: + paradigm. Every block is
 * a computed reading with its own basis; `text` is what the mouth is handed.
 */
export function resolutionBlocks({ level = 0, question = "", transcript = [], index, notes = [], voids = [], records = [], dmdWindow = null, prominence = null }) {
  const out = { level, text: "", atmosphere: null, lens: null, paradigm: null, active: null };
  if (!level || !index) return { ...out, basis: !index ? "no conversation index" : "level 0" };
  const active = activeReferents(question, transcript, index);
  out.active = { ids: sortedIds(active.ids), basis: active.basis };
  const blocks = [];
  if (level >= 1) { out.atmosphere = atmosphereBlock({ question, transcript, index, prominence }); if (out.atmosphere.text) blocks.push(out.atmosphere.text); }
  if (level >= 2) { out.lens = lensBlock({ question, active: active.ids, index, notes, voids, records, transcript, dmdWindow }); if (out.lens.text) blocks.push(out.lens.text); }
  if (level >= 3) { out.paradigm = paradigmBlock({ active: active.ids, index, notes, dmdWindow }); if (out.paradigm.text) blocks.push(out.paradigm.text); }
  out.text = blocks.join("\n\n");
  return out;
}
