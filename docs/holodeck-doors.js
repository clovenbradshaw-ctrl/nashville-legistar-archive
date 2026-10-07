// Holodeck's thin client for eoreader7's document doorway (POST /v1/documents on the local proxy).
// The proxy runs the machine — void plan, per-cell composition, grounding, admission, fold — and keeps the
// append-only EOT ledger; this file only starts jobs, polls them, and reads that ledger back as cells.

// The proxy this page talks to: the default local address, or one the person stored (a second proxy, another machine).
export const ER7_BASE = (() => { try { return (typeof localStorage !== 'undefined' && localStorage.getItem('fold-explorer-er7')) || 'http://127.0.0.1:11436'; } catch (e) { return 'http://127.0.0.1:11436'; } })();
const HOLONS = ['section', 'paragraph', 'sentence'];

export class DoorError extends Error { constructor(message, type, status) { super(message); this.type = type || 'door_error'; this.status = status || 0; } }

// A job id the proxy's ledger routes resolve unambiguously: they rewrite a trailing _N to :N, so none here.
export function newJobId(now = Date.now(), rand = Math.random) { return 'hd-' + now.toString(36) + rand().toString(36).slice(2, 7); }

async function asJson(r) { const t = await r.text(); try { return JSON.parse(t); } catch (e) { throw new DoorError('the proxy answered ' + r.status + ' with no JSON: ' + t.slice(0, 120), 'not_json', r.status); } }

export async function startDocument(base, { task, model, jobId, holonLevel = 'section', webConsent = false, documents }, fetchImpl = fetch) {
  if (!String(task || '').trim()) throw new DoorError('the task is empty', 'empty_task');
  if (!HOLONS.includes(holonLevel)) throw new DoorError('holonLevel must be one of ' + HOLONS.join(', '), 'unknown_holon_level');
  let r; try { r = await fetchImpl(base + '/v1/documents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task: String(task).trim(), model, sessionId: jobId, holonLevel, webConsent, ...(documents && documents.length ? { documents } : {}) }) }); }
  catch (e) { throw new DoorError('eoreader7 is not answering at ' + base, 'unreachable'); }
  const j = await asJson(r);
  if (!r.ok) throw new DoorError((j.error && j.error.message) || 'HTTP ' + r.status, (j.error && j.error.type) || 'http_' + r.status, r.status);
  return j;
}

export async function pollDocument(base, jobId, fetchImpl = fetch) {
  const r = await fetchImpl(base + '/v1/documents/' + encodeURIComponent(jobId), { cache: 'no-store' });
  const j = await asJson(r); if (!r.ok) throw new DoorError((j.error && j.error.message) || 'HTTP ' + r.status, 'http_' + r.status, r.status);
  return j;
}

export async function readLedger(base, jobId, fetchImpl = fetch) {
  const r = await fetchImpl(base + '/v1/documents/' + encodeURIComponent(jobId) + '_1.jsonl', { cache: 'no-store' });
  if (r.status === 404) return { rows: [], malformed: 0, missing: true };
  if (!r.ok) throw new DoorError('HTTP ' + r.status + ' reading the ledger', 'http_' + r.status, r.status);
  return parseLedger(await r.text());
}

export const disclosureOf = rows => { const r = (rows || []).find(x => /^DISCLOSED UNGROUNDED/.test(String(x.text || ''))); return r ? String(r.text).split('\n')[0] : ''; };
export const liveHtmlUrl = (base, jobId) => base + '/v1/documents/' + encodeURIComponent(jobId) + '.html';

// A line that is not an EOT observation is counted, never silently dropped.
export function parseLedger(text) {
  const rows = []; let malformed = 0;
  for (const line of String(text || '').split('\n')) { if (!line.trim()) continue; let r; try { r = JSON.parse(line); } catch (e) { malformed++; continue; } if (!r || typeof r.role !== 'string') { malformed++; continue; } rows.push(r); }
  return { rows, malformed, missing: false };
}

// The void plan's questions are the cells. A ledger holds many plans (resumes, turns, re-plans), so each part is
// addressed by the plan that PRECEDES it in the append-only order, never by the last plan in the file. A part whose
// title is no question of its plan is kept, named unaddressed. Revision rows name no cell (their supersedes is empty
// and they land before their part in a code turn, after several parts in an essay turn), so they stay with their
// plan, unbound — assigning them to a cell by position would be a guess.
export function cellsOf(rows) {
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const sets = []; let cur = null; const unaddressed = []; const whole = []; const mechanical = []; let orphanParts = 0;
  const supOf = r => Array.isArray(r.supersedes) ? r.supersedes : [];
  for (const r of rows) {
    if (r.role === 'plan') { const qs = String(r.text || '').split('\n').map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean); cur = { planId: r.id, plan: qs, cells: qs.map(q => ({ q, parts: [] })), revisions: [] }; sets.push(cur); }
    else if (r.role === 'part') {
      if (!cur) { orphanParts++; unaddressed.push(r); continue; }
      // A part the proxy wrote itself, mechanically and with no model (giver eoreader7:ground — "No ground"), answers no
      // question of the plan and is not a stray: it is the job saying what it could not do.
      if (/^eoreader7:ground/.test(String(r.giver || ''))) { mechanical.push(r); continue; }
      const t = norm(r.title); const c = cur.cells.find(x => { const q = norm(x.q); return q === t || q.startsWith(t) || t.startsWith(q); });
      if (c) c.parts.push(r); else if (supOf(r).some(id => cur.cells.some(x => x.parts.some(p => p.id === id)))) { whole.push(r); cur.whole = r; } else unaddressed.push(r);
    } else if (r.role === 'revision' && cur) cur.revisions.push(r);
  }
  const current = sets.length ? sets[sets.length - 1] : { planId: null, plan: [], cells: [], revisions: [] };
  return { sets, current, unaddressed, whole, mechanical, orphanParts };
}

// The doorway's claims about itself, checked against its own ledger and projection. Each verdict is true, false,
// or null (the state cannot test it yet) — never a pass by default.
const DOC_STATUSES = new Set(['writing', 'complete', 'unsatisfied', 'truncated', 'error', 'unknown']);
export function doorControls(poll, ledger) {
  const rows = ledger.rows; const out = [];
  const add = (name, ok, detail) => out.push({ name, ok, detail });
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  add('status is one the doorway documents', DOC_STATUSES.has(poll.status), poll.status);
  add('every ledger line is an EOT observation', ledger.malformed === 0 && rows.every(r => r.schema === 'EOTObservation@1'), ledger.malformed + ' malformed');
  const fPlan = rows.findIndex(r => r.role === 'plan'), fPart = rows.findIndex(r => r.role === 'part');
  add('the void plan is committed before any cell is composed', fPart < 0 ? null : fPlan >= 0 && fPlan < fPart, fPart < 0 ? 'no part yet' : 'plan at row ' + fPlan + ', first part at row ' + fPart);
  const C = cellsOf(rows); const nParts = rows.filter(r => r.role === 'part').length;
  const beats = C.unaddressed.filter(r => /^[a-z]+(, [a-z]+)+$/.test(r.title)); const strays = C.unaddressed.filter(r => !beats.includes(r));
  add('every part answers a question of the plan before it (fold beats excepted)', nParts ? strays.length === 0 : null, nParts ? (nParts - C.unaddressed.length - C.whole.length - C.mechanical.length) + ' addressed, ' + C.whole.length + ' whole pieces, ' + C.mechanical.length + ' mechanical, ' + beats.length + ' fold beats, ' + strays.length + ' strays' + (strays.length ? ': ' + strays.map(r => JSON.stringify(String(r.title).slice(0, 60))).join(', ') : '') : 'no part yet');
  const paras = String(poll.projection || '').split(/\n{2,}/).map(norm).filter(p => p.length > 40 && !/^#/.test(p) && !/^\d+\. /.test(p));
  const held = rows.map(r => norm(r.text)).join('\n'); const orphan = paras.filter(p => !held.includes(p.slice(0, 120)));
  add('every projected paragraph is held in the ledger', paras.length ? orphan.length === 0 : null, paras.length ? (paras.length - orphan.length) + ' of ' + paras.length + ' found' + (orphan.length ? '; first orphan: ' + JSON.stringify(orphan[0].slice(0, 90)) : '') : 'nothing projected yet');
  const disc = rows.find(r => /^DISCLOSED UNGROUNDED/.test(String(r.text || '')));
  add("the projection carries the ledger's ungrounded disclosure", disc && String(poll.projection || '').trim() ? /ungrounded|no material ground/i.test(poll.projection) : null, disc ? (String(poll.projection || '').trim() ? 'ledger row ' + disc.id + ' discloses it' : 'nothing projected yet') : 'the ledger discloses nothing');
  add('complete means the plan is satisfied', poll.status === 'complete' ? !!(poll.job && poll.job.satisfaction && poll.job.satisfaction.ok) : null, poll.status === 'complete' ? JSON.stringify(poll.job && poll.job.satisfaction).slice(0, 120) : 'status is ' + poll.status);
  return out;
}

// Topic words of a plan: its words minus those every other plan also has, so the void template cancels itself out.
const words = t => new Set(String(t || '').toLowerCase().match(/[a-z][a-z-]{2,}/g) || []);
export function topicWords(planText, otherPlanTexts) { const own = words(planText); for (const o of otherPlanTexts) for (const w of words(o)) own.delete(w); return own; }
// The null is the other jobs. What the piece SAYS is counted sentence by sentence — footnotes and quoted excerpt bullets
// are shown ground, not the answer's claims — and a piece is about its own task only if more of its sentences carry its
// own topic words than carry any other job's. (Counting words over the whole projection passed a bicycle answer that was
// four sentences about Katherine Johnson and one about bicycles, 8 words against 7: the count must be of sentences.)
export function claimSentences(text) {
  const body = String(text || '').split(/^## Footnotes/m)[0];
  return body.split(/\n+/).filter(l => !/^\s*-\s*["\u201c]/.test(l)).join('\n').split(/(?<=[.!?])\s+|\n+/).map(x => x.trim()).filter(x => x.split(/\s+/).length >= 4);
}
export function topicControl(jobs, { isFunctionWord = () => false } = {}) {
  const plans = jobs.map(j => (j.rows.find(r => r.role === 'plan') || {}).text || '');
  const pieceOf = j => { const w = cellsOf(j.rows).whole; return w.length ? w[w.length - 1].text : j.projection; };
  const tokens = t => new Set(String(t || '').toLowerCase().match(/[a-z][a-z-]{2,}/g) || []);
  return jobs.map((j, i) => {
    const sents = claimSentences(pieceOf(j)).map(tokens);
    const carry = ws => sents.filter(t => [...ws].some(w => t.has(w))).length;
    // A function word is no topic ("the" belongs to one task phrase and matches 147 of 211 sentences of any English text):
    // the engine's own isFunctionWord decides, injected because it needs node:fs and this module also runs in the page.
    const strip = ws => new Set([...ws].filter(w => !isFunctionWord(w)));
    const own = strip(topicWords(plans[i], plans.filter((_, k) => k !== i))); const ownN = carry(own);
    const others = plans.map((p, k) => k === i ? null : carry(strip(topicWords(p, plans.filter((_, m) => m !== k))))).filter(x => x != null);
    // "About its task" is defined as: most of what the piece says carries its own topic words, and more than any other
    // job's do. Limit, stated: an essay that names its subject in under half its sentences (pronouns, anaphora) reads as
    // off-topic here; the doorway's pieces are short and explicit, and a false alarm is the safe side of a falsifier.
    const ok = !sents.length || !own.size ? null : ownN * 2 > sents.length && ownN > Math.max(0, ...others);
    return { name: 'the piece is about its own task: most of its sentences carry it, and more than carry another job\'s', ok, detail: ownN + ' of ' + sents.length + ' sentences carry its own topic words (' + [...own].slice(0, 5).join(', ') + '); ' + others.join(', ') + ' carry another job\'s' };
  });
}
// Two jobs with different tasks must not ship the same whole piece. Exact identity: no threshold to tune.
export function identityControl(jobs) {
  const out = [];
  for (let i = 0; i < jobs.length; i++) for (let k = i + 1; k < jobs.length; k++) {
    const wi = cellsOf(jobs[i].rows).whole, wk = cellsOf(jobs[k].rows).whole;
    const pi = (jobs[i].rows.find(r => r.role === 'plan') || {}).text, pk = (jobs[k].rows.find(r => r.role === 'plan') || {}).text;
    const a = wi.length ? wi[wi.length - 1].text : '', b = wk.length ? wk[wk.length - 1].text : '';
    out.push({ name: 'different tasks do not ship the same whole piece', pair: [jobs[i].jobId, jobs[k].jobId], ok: !a || !b || pi === pk ? null : a !== b, detail: a && b ? (a === b ? 'byte-identical, ' + a.length + ' chars each' : 'they differ') : 'a job has no whole piece' });
  }
  return out;
}

// The sources a page holds (name → text) as the documents a job is handed. Empty ones are dropped, never sent.
export const documentsOf = texts => Object.entries(texts || {}).filter(([, t]) => typeof t === 'string' && t.trim()).map(([name, text]) => ({ name, text }));

// What the job's own ground row says the handed-over material did with the ask: the documents admitted as ground, and
// the written refusal of each one that did not carry it. The proxy decides; the page only reads it back.
export function groundOf(rows) {
  const r = (rows || []).find(x => x.role === 'ground'); if (!r) return null;
  const m = /sources:\s*(\{[\s\S]*\})\s*$/m.exec(String(r.text || '')); if (!m) return { licensed: /licensed/i.test(r.title) && !/not licensed/i.test(r.title), none: /^no ground/i.test(r.title), docIds: [], carries: null };
  let src; try { src = JSON.parse(m[1]); } catch (e) { return { licensed: !/not licensed/i.test(r.title), docIds: [], carries: null, unparsed: true }; }
  return { licensed: !/not licensed|^no ground/i.test(r.title), none: /^no ground/i.test(r.title), docIds: src.docIds || [], carries: src.carries || null, web: src.web || 0 };
}

// A ground id as a place a person can read: a passage of the received corpus is "corpus/path (chars a–b)"; a handed-over
// document or a fetched page is shown as it is.
export const prettyGround = id => { const m = /^priors:(.+)#(\d+)-(\d+)$/.exec(String(id)); return m ? m[1] + ' (chars ' + m[2] + '\u2013' + m[3] + ')' : String(id); };
