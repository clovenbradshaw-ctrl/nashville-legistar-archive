// holodeck-research-log.js — the run's event stream, said in plain words. Pure: events in, rows out. The page shows
// these rows as the acquisition happens and again, whole, in the Research view; it adds nothing of its own.
//
//   const log = makeLog({ label });  run → emit: ev => log.push(ev);  log.rows() / log.stats() / log.summary()
//
// A row is { key, chip, tone, title, line, url? } with tone one of ok · mut · warn · bad. A candidate's row is updated in
// place as it moves (to read → reading → read / couldn't read / not about it), so the list reads like a ledger, not a
// scroll. The register names never appear here: they live in holodeck-research-terrain.js and the docs.

const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const n = (x, w) => x + ' ' + w + (x === 1 ? '' : 's');
const words = c => Math.round(c / 6).toLocaleString();

export function makeLog({ label = s => s } = {}) {
  const rows = [], byKey = new Map();
  const S = { searches: 0, searchFailed: 0, found: 0, toRead: 0, setAside: 0, read: 0, unread: 0, notAbout: 0, batches: 0, stopped: null };
  const put = (key, row) => { let r = byKey.get(key); if (r) Object.assign(r, row); else { r = { key, ...row }; byKey.set(key, r); rows.push(r); } return r; };
  const state = new Map();   // candidate id -> last state, so counters stay exact when a row is updated
  const map = { toRead: 'toRead', setAside: 'setAside', read: 'read', unread: 'unread', notAbout: 'notAbout' };
  const move = (id, to) => {
    const from = state.get(id); if (from === to) return;
    if (from && map[from] && S[map[from]] > 0) S[map[from]]--;
    if (map[to]) S[map[to]]++;
    state.set(id, to);
  };
  return {
    push(ev) {
      switch (ev.t) {
        case 'lanes': {
          put('lanes', { chip: 'Looking in', tone: 'ok', title: ev.lanes.map(l => label(l.scope)).join(' · '), line: ev.lanes.map(l => label(l.scope) + ' — ' + l.why).filter(x => / — .+/.test(x)).join(' · ') + (ev.held && ev.held.length ? ' · held back until needed: ' + ev.held.map(label).join(', ') : '') });
          break; }
        case 'note': put('note:' + rows.length, { chip: 'Note', tone: 'warn', title: ev.why, line: '' }); break;
        case 'round': if (ev.round > 0) put('round:' + ev.round, { chip: ev.kind === 'widened' ? 'Looking further' : 'Following a name', tone: 'mut', title: ev.why, line: ev.scopes.map(label).join(' · ') + ' · “' + ev.queries.join('”, “') + '”' }); break;
        case 'search': {
          const k = 'search:' + ev.scope + '|' + ev.q;
          if (ev.state === 'start') put(k, { chip: 'Asking', tone: 'mut', title: label(ev.scope), line: '“' + ev.q + '”' });
          else { if (ev.state === 'found') { S.searches++; } else { S.searches++; S.searchFailed++; }
            put(k, ev.state === 'found' ? { chip: 'Found ' + ev.n, tone: ev.n ? 'ok' : 'mut', title: label(ev.scope) + (ev.engine ? ' · ' + ev.engine : ''), line: '“' + ev.q + '”' }
              : { chip: 'No answer', tone: 'bad', title: label(ev.scope), line: '“' + ev.q + '” — ' + ev.why }); }
          break; }
        case 'candidate': {
          S.found++;
          if (ev.verdict === 'admitted') { move(ev.id, 'toRead'); put('c:' + ev.id, { chip: ev.ungated ? 'To read (unscreened)' : 'To read', tone: ev.ungated ? 'mut' : 'ok', title: ev.title, line: host(ev.url) + ' · found by ' + label(ev.scope) + (ev.ungated ? '' : ' · mentions the question’s words well beyond chance'), url: ev.url }); }
          else { move(ev.id, 'setAside'); put('c:' + ev.id, { chip: 'Set aside', tone: 'mut', title: ev.title, line: host(ev.url) + ' · ' + ev.why, url: ev.url }); }
          break; }
        case 'read': {
          if (ev.state === 'reading') { move(ev.id, 'reading'); put('c:' + ev.id, { chip: 'Reading…', tone: 'mut' }); break; }
          if (ev.state === 'read') { move(ev.id, 'read'); put('c:' + ev.id, { chip: 'Read', tone: 'ok', title: ev.title, line: host(ev.url) + ' · ' + (ev.via || 'direct') + ' · ' + n(ev.statements || 0, 'statement') + ', ' + n(ev.referents || 0, 'name') + ' · about the question (' + ev.g + ' vs ' + ev.nullMax + ' by chance)', url: ev.url }); }
          else if (ev.state === 'not-prose') { move(ev.id, 'notAbout'); put('c:' + ev.id, { chip: 'Not prose', tone: 'warn', title: ev.title, line: host(ev.url) + ' · ' + ev.why, url: ev.url }); }
          else if (ev.state === 'off-topic') { move(ev.id, 'notAbout'); put('c:' + ev.id, { chip: 'Not about it', tone: 'warn', title: ev.title, line: host(ev.url) + ' · ' + ev.why, url: ev.url }); }
          else { move(ev.id, 'unread'); put('c:' + ev.id, { chip: 'Couldn’t read', tone: 'bad', title: ev.title, line: host(ev.url) + ' · ' + ev.why, url: ev.url }); }
          break; }
        case 'batch': {
          S.batches = ev.n;
          const t = ev.test;
          if (!ev.kept) put('batch:' + ev.n, { chip: 'Checked', tone: 'mut', title: 'Batch ' + ev.n + ': none of these could be kept', line: '' });
          else put('batch:' + ev.n, { chip: 'Checked', tone: 'ok', title: 'Batch ' + ev.n + ': ' + n(ev.sources, 'source') + ' read so far, ' + n(ev.newlyConfirmed || 0, 'name') + ' newly confirmed by two sources',
            line: !t || t.testable === false ? 'Too few sources to tell yet — reading on.' : t.saturated ? 'Another source is expected to bring ' + t.expected + ' new name or word — under one. Saturated.' : 'Another source is expected to bring about ' + t.expected + ' name or word nobody has used yet — reading on.' });
          break; }
        case 'stop': {
          S.stopped = ev.stop;
          put('stop', { chip: 'Stopped', tone: ev.stop.reason === 'saturated' ? 'ok' : ev.stop.reason === 'no-candidates' ? 'bad' : 'mut', title: STOP_WORDS[ev.stop.reason] || ev.stop.reason, line: ev.stop.detail });
          break; }
      }
    },
    rows: () => rows.slice(),
    stats: () => ({ ...S }),
    /** One sentence for the end of a run. */
    summary() {
      const x = S; if (!x.found) return 'Nothing was found' + (x.searchFailed ? ' (' + n(x.searchFailed, 'search') + ' failed).' : '.');
      return 'Found ' + x.found + ' · read ' + x.read + (x.unread ? ' · couldn’t read ' + x.unread : '') + (x.notAbout ? ' · ' + x.notAbout + ' not about it' : '') + ' · set aside ' + x.setAside + '.';
    },
  };
}

export const STOP_WORDS = {
  saturated: 'It stopped because another source would not have taught it anything it lacks',
  'candidates-exhausted': 'It stopped because there was nothing further to read',
  'no-candidates': 'It found nothing to read',
  aborted: 'You stopped it',
};

/** The same rows, rebuilt from a stored run record (the live stream is gone after a reload): the record's lanes,
 *  searches, candidates, reads, batches and stop are replayed as events through the same log. */
export function rowsOfRecord(rec, label = s => s) {
  const log = makeLog({ label });
  const byRound = r => (x => x.round === r || (r === 0 && x.round == null));
  const lanes0 = (rec.lanes || []).filter(byRound(0));
  log.push({ t: 'lanes', lanes: lanes0, held: (rec.notAsked || []).map(x => x.scope) });
  const rounds = new Map((rec.rounds || []).map(r => [r.round, r]));
  const maxR = Math.max(0, ...(rec.rounds || []).map(r => r.round), ...(rec.batches || []).map(b => b.round || 0));
  const cands = rec.candidates || [], batches = rec.batches || [], curve = rec.curve || [];
  let ci = 0;
  for (let r = 0; r <= maxR; r++) {
    const R = rounds.get(r); if (r > 0 && R) log.push({ t: 'round', round: r, kind: R.kind, scopes: R.scopes, queries: R.queries, why: R.why || '' });
    for (const s of (rec.searches || []).filter(x => (x.round || 0) === r)) log.push(s.ok ? { t: 'search', scope: s.scope, q: s.q, state: 'found', n: s.n, engine: s.engine } : { t: 'search', scope: s.scope, q: s.q, state: 'failed', why: s.why });
    for (const c of cands.filter(c => ((c.found[0] || {}).round || 0) === r)) {
      const sr = c.snippetRel || {}, scope = (c.found[0] || {}).scope;
      log.push({ t: 'candidate', id: c.id, url: c.url, title: c.title, scope, verdict: c.verdict, g: sr.g, nullMax: sr.nullMax, ungated: sr.ok === false, why: c.verdict === 'admitted' ? '' : c.why });
      if (c.state === 'kept') log.push({ t: 'read', id: c.id, url: c.url, title: c.title, state: 'read', via: '', chars: 0, g: (c.textRel || {}).g, nullMax: (c.textRel || {}).nullMax, statements: 0, referents: 0 });
      else if (c.state === 'unread') log.push({ t: 'read', id: c.id, url: c.url, title: c.title, state: 'unread', why: c.why });
      else if (c.state === 'off-topic') log.push({ t: 'read', id: c.id, url: c.url, title: c.title, state: 'off-topic', why: c.why });
      else if (c.state === 'not-prose') log.push({ t: 'read', id: c.id, url: c.url, title: c.title, state: 'not-prose', why: c.why });
      ci++;
    }
    let k = 0;
    for (const b of batches.filter(b => (b.round || 0) === r)) {
      const cv = b.kept ? curve.find(x => x.batch === b.n) : null;
      log.push({ t: 'batch', n: b.n, kept: b.kept, newlyConfirmed: b.newlyConfirmed, test: b.test, sources: cv ? cv.sources : b.kept, referents: cv ? cv.referents : 0, earned: cv ? cv.earned : 0 }); k++;
    }
  }
  if (rec.stop) log.push({ t: 'stop', stop: rec.stop, corpus: rec.corpus });
  return log.rows();
}
