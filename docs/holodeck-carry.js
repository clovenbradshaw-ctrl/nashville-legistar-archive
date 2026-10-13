// holodeck-carry.js — the conversation's carry, COMPUTED from the record (THE-HOLOGRAPH §6, the mechanical summary).
//
// The workspace chat's System-1 summary (topic / flow / entities) used to be written by a SECOND model call per turn
// (holodeck-ask.js refreshSummary). This module computes the same fields with no model: the khora's Atmosphere over the
// conversation read as a stream of referent sets (resolutions.js::atmosphereBlock, vendored), where identity is the
// material's own cast (the ground reading's `rix.cast`: id + surfaces) and never a capitalisation scan.
//
//   ATMOSPHERE  where the conversation stands: the ground it holds, where it last turned, what it has cited, whether the last
//               exchange moved anything.
//   LENS        what the checked turns (the summary's warrant records) say about the referents in play.
//
// Recomputed from the history each turn — never from its own earlier output — so it cannot drift the way a summary of a
// summary does. The mouth-facing text is struck of addresses (firewall.js); `lines` keep them for the record. The cut is the
// khora's DECLARED one (no `dmdWindow` is injected here) and the basis says so.
//
// Pure: no DOM, no IO, no model.
import { atmosphereBlock, lensBlock, activeReferents } from './vendor/eoreader7/native/the-fold/resolutions.js';

const fold = (s) => String(s == null ? '' : s).normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
const WORDCH = /[\p{L}\p{N}]/u;
// A surface this short is a function word, not a name (the same floor readingBlock holds on the cast).
const MIN_SURFACE = 4;

function occurs(hay, needle) {
  if (!needle) return false;
  const unspaced = UNSPACED.test(needle);
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    if (unspaced) return true;
    const before = hay[i - 1], after = hay[i + needle.length];
    if (!(before && WORDCH.test(before)) && !(after && WORDCH.test(after))) return true;
  }
  return false;
}

/** The index the khora blocks resolve through, built from the ground reading's cast. Ids are the cast ids. */
export function indexOfCast(rix) {
  const cast = (rix && Array.isArray(rix.cast) ? rix.cast : []).filter((c) => c && (c.id != null));
  const rows = cast.map((c) => ({ id: String(c.id), name: (c.surfaces && c.surfaces[0]) || String(c.id), forms: [...new Set((c.surfaces && c.surfaces.length ? c.surfaces : [c.id]).map((x) => fold(x).replace(/\s+/g, ' ').trim()).filter((x) => x.length >= MIN_SURFACE || UNSPACED.test(x)))] })).filter((r) => r.forms.length);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const memo = new Map();
  const resolveIn = (text) => {
    const hay = fold(text).replace(/\s+/g, ' ');
    if (memo.has(hay)) return new Set(memo.get(hay));
    const out = new Set(rows.filter((r) => r.forms.some((f) => occurs(hay, f))).map((r) => r.id));
    memo.set(hay, [...out]);
    return out;
  };
  const resolve = (name) => { const n = fold(name).replace(/\s+/g, ' ').trim(); return new Set(rows.filter((r) => r.forms.includes(n)).map((r) => r.id)); };
  const represent = (id) => byId.get(String(id))?.name ?? String(id);
  return { resolve, resolveIn, represent, events: [], size: rows.length };
}

/** The conversation as exchanges: the history's user/assistant pairs, then the turn in hand. */
export function transcriptOf(history, { question = '', answer = '', used = [] } = {}) {
  const out = []; let ask = null;
  for (const m of history || []) {
    if (m && m.role === 'user') ask = m;
    else if (m && m.role === 'assistant' && ask && String(m.content || '').trim()) { out.push({ turn: out.length + 1, question: String(ask.content || ''), answer: String(m.content), refs: [] }); ask = null; }
  }
  if (String(question || '').trim() && String(answer || '').trim()) out.push({ turn: out.length + 1, question: String(question), answer: String(answer), refs: [...used] });
  return out;
}

/** carryOf → { text, lines, entities, active, basis }. Empty text (and a basis saying why) when nothing resolves to a referent. */
export function carryOf({ rix, history, question, answer, used = [], records = [] }) {
  const index = indexOfCast(rix);
  if (!index.size) return { text: '', lines: [], entities: [], active: [], basis: 'no cast in the ground reading' };
  const transcript = transcriptOf(history, { question, answer, used });
  const q = transcript.at(-1)?.question ?? '';
  const active = activeReferents(q, transcript, index);
  const atmosphere = atmosphereBlock({ question: q, transcript, index });
  const lens = lensBlock({ question: q, active: active.ids, index, notes: [], voids: [], records, transcript });
  const blocks = [atmosphere, lens].filter((b) => b && b.text);
  const tally = new Map();
  for (const t of transcript) for (const id of new Set([...index.resolveIn(t.question), ...index.resolveIn(t.answer)])) tally.set(id, (tally.get(id) || 0) + 1);
  const entities = [...tally].sort((a, b) => b[1] - a[1]).map(([id]) => index.represent(id));
  return { text: blocks.map((b) => b.text).join('\n\n'), lines: [...atmosphere.lines, ...(lens.lines || [])], entities, active: [...active.ids].map((id) => index.represent(id)), basis: [atmosphere.basis, lens.basis].filter(Boolean).join(' · ') };
}

const firstClause = (t) => String(t || '').trim().split(/[.?!\n]/)[0].slice(0, 120);

/**
 * mechanicalRefresh({ FOLD, from, foldLine, rix, history, question, answer, used }) → { summary, refresh }.
 * The no-model counterpart of holodeck-ask's refreshSummary. `from` is the summary WITH this turn's warrant record; the result
 * is that summary advanced by the fold line, with Flow = the Atmosphere (addresses struck), Entities = the cast's names for the
 * referents the conversation has carried, Topic kept (else the opening clause of the first ask). The same entity veto the model
 * path runs (FOLD.extractSummaryFindings) is run here; if it refuses, only the fold advances and the refusal is returned.
 * Nothing resolving leaves the summary exactly as advanceSummaryFold gives it, with `refresh.ok` false and the reason.
 */
export function mechanicalRefresh({ FOLD, from, foldLine, rix, history, question, answer, used = [] }) {
  const advanced = FOLD.advanceSummaryFold(from, foldLine);
  const c = carryOf({ rix, history, question, answer, used, records: from.records || [] });
  if (!c.text) return { summary: advanced, refresh: { ok: false, mechanical: true, why: c.basis } };
  const flow = c.text.split('\n').filter((l) => l.trim() && !/:$/.test(l.trim())).join(' ').replace(/\s+/g, ' ').trim();
  const firstAsk = (history || []).find((m) => m && m.role === 'user' && String(m.content || '').trim().length >= 24) || { content: question };
  const next = { ...advanced, topic: advanced.topic || firstClause(firstAsk.content) || null, flow: flow || advanced.flow, entities: c.entities.slice(0, 8), carry: { basis: c.basis, active: c.active, lines: c.lines } };
  const w = FOLD.extractSummaryFindings(from.entities || [], next.entities, { records: FOLD.projectRecords(next), folds: next.folds });
  if (!w.ok) return { summary: { ...advanced, flow: next.flow, topic: next.topic, carry: next.carry }, refresh: { ok: false, mechanical: true, why: w.findings.map((f) => f.detail).join('; ') } };
  return { summary: next, refresh: { ok: true, mechanical: true } };
}
