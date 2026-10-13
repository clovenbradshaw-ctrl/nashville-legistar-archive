// holodeck-research.js — the research assistant's acquisition loop. Pure orchestration: every outward act (search a
// lane, read a page, parse a text) is injected, so this module holds the DECISIONS and a test can drive all of them
// with a fake web. No DOM, no network, no clock of its own, no model.
//
//   const run = await research(question, { search, read, parse, background, route, ... });
//
// What it does, in the order it does it:
//   1. SEARCH   the question goes to the lanes the fold's router picks for it (web always; encyclopedia / code /
//               papers / archive when the ask's own words or the web hits call for them). Every result is a
//               candidate carrying everything that found it.
//   2. GATE     a candidate is READ only if its title+snippet+address mention the question's terms beyond what a
//               same-length stretch of ordinary English does (relevance null, holodeck-research-null.js).
//               Turned-away candidates are listed with the numbers, never dropped silently.
//   3. READ     in order of that evidence, a few at a time. A page that cannot be read is a typed gap with the lanes
//               that were tried; a page that was read but is not about the question is a typed refusal.
//   4. STOP     after each batch: is another source still expected to bring even one name or word nobody in the
//               corpus has said (Good–Turing, leave-one-out)? Yes → keep reading; no → saturated, stop. When the
//               relevance-cleared pool runs out first, widen to the lanes the router held back, then follow the
//               strongest earned referent; a followed name that surfaces nothing that clears the null ends it.
//               No page cap, no source count.
//   5. RECORD   one HolodeckResearchRun@1: lanes, searches, every candidate with its verdict, every source with its
//               text hash and the lane that read it, the null numbers behind every decision, and the typed gaps.
//
// The only constants are resource ones (how many pages are fetched at once) and the null's DRAWS; they are declared.

import { DRAWS, termsOf, termUnits, relevance, earnedGain, saturationTest, hash32, stemsOf, proseTest, corpusIndex, phraseKeyness } from './holodeck-research-null.js';
import { readSource, referentKey, namesIn } from './holodeck-research-read.js';

export const SCHEMA = 'HolodeckResearchRun@1';
/** Pages fetched at once. A resource limit (each read parses a document in the tab), not a statistical one; it is also
 *  the unit of the stopping test, so the null is never asked about less than one such batch. */
export const CONCURRENCY = 3;

const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

/** One address, one candidate: scheme, "www.", fragment, trailing slash and tracking parameters do not make a new page. */
export function normUrl(u) {
  try {
    const x = new URL(String(u).trim()); x.hash = '';
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_[ce]id$|ref$|ref_src$)/i.test(k)) x.searchParams.delete(k);
    return x.hostname.replace(/^www\./, '').toLowerCase() + x.pathname.replace(/\/+$/, '') + (x.search || '');
  } catch (e) { return clean(u).toLowerCase(); }
}

/** The strongest earned referent not yet followed and not already in the question: the next thing worth asking about.
 *  `support`: Map referent -> number of sources; `surface`: Map referent -> a written form. `keyed` (optional): Map
 *  referent -> { outside, g } — when given, only a name the corpus says beyond what ordinary English would (outside the
 *  null) is a candidate, and the most keyed comes first. */
export function frontier(support, surface, questionStems, used, keyed = null) {
  const qs = new Set(questionStems);
  let list = [...support].filter(([r, n]) => n >= 2 && !used.has(r) && !stemsOf(r).every(s => qs.has(s)));
  if (keyed) list = list.filter(([r]) => keyed.has(r) && keyed.get(r).outside);
  list.sort((a, b) => (keyed ? keyed.get(b[0]).g - keyed.get(a[0]).g : 0) || b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return list.length ? { referent: list[0][0], surface: surface.get(list[0][0]) || list[0][0], support: list[0][1] } : null;
}

const sha256hex = async text => {
  try { const b = new TextEncoder().encode(text); const d = await globalThis.crypto.subtle.digest('SHA-256', b); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { return 'fnv:' + hash32(text).toString(16); }
};

/**
 * @param question  what the person typed
 * @param deps {
 *   search(scope, q)            -> { results:[{title,url,snippet,source,kind}], engine }   (throws on failure)
 *   read(url, cand)             -> { ok, text, title, via, url, error }
 *   parse(text)                 -> { sts:[{s,e,text,names,figs,dates,frame}], referents:[key] }   (default: readSource)
 *   background                  -> makeBackground(...) | null
 *   route(question)             -> { scopes, why, rest }                 the fold's router
 *   probe(webResults, chosen)   -> { add, why }                          the fold's host vote
 *   queriesFor(question)        -> [query]                               the fold's per-entity split
 *   isFunction(word)            -> bool                                  closed-class words (optional)
 *   cooling(scope) / limited(scope, err)                                 the fold's rate-limit memory (optional)
 *   emit(event)                 streaming: lane / search / candidate / read / source / batch / round / stop
 *   signal                      AbortSignal
 *   concurrency, now, sha256, keySalt
 *   noStop                      CONTROL ONLY: read every admitted candidate whatever the null says (the stop is still recorded in `wouldStopAt`)
 * }
 */
export async function research(question, deps) {
  const q = clean(question);
  const D = { parse: readSource, route: () => ({ scopes: ['web'], why: { web: 'the open web answers anything' }, rest: [] }), probe: () => ({ add: [], why: {} }),
    queriesFor: x => [x], emit: () => {}, concurrency: CONCURRENCY, now: Date.now, sha256: sha256hex, keySalt: '', ...deps };
  const emit = ev => { try { D.emit(ev); } catch (e) {} };
  const aborted = () => !!(D.signal && D.signal.aborted);
  const bg = D.background && D.background.ok ? D.background : null;
  const qStems = stemsOf(q);
  // the question's named things: capitalised runs that do not merely open the sentence
  const entities = namesIn(q, null).map(n => n.name);
  const { units: terms, anchors } = termUnits(q, { isFunction: D.isFunction, bg, entities });
  const rec = { schema: SCHEMA, question: q, startedAt: new Date(D.now()).toISOString(), draws: DRAWS, terms: terms.map(u => u.join(' ')), anchors: anchors.map(u => u.join(' ')), background: bg ? { tokens: bg.n, vocabulary: bg.v } : null,
    lanes: [], searches: [], candidates: [], sources: [], gaps: [], rounds: [], batches: [], curve: [], stop: null, notAsked: [] };
  const key0 = D.keySalt + '|' + q;

  // ── lanes: what the router picked, and why ─────────────────────────────────────────────────────────────────────
  const routed = D.route(q);
  const searched = new Set();            // scope|query already asked
  const used = new Set(routed.scopes);   // scopes asked at least once
  rec.lanes = routed.scopes.map(s => ({ scope: s, why: routed.why[s] || '', round: 0 }));
  emit({ t: 'lanes', lanes: rec.lanes, held: routed.rest });
  if (!terms.length) emit({ t: 'note', why: 'the question has no content terms, so relevance cannot be measured; candidates are read in the order the lanes returned them' });
  if (!bg) emit({ t: 'note', why: 'no ordinary-English background is loaded, so relevance is NOT measured and candidates are read unscreened, in lane order' });

  // ── state ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const cands = new Map(); let nextId = 1;
  const support = new Map(), surface = new Map();   // referent -> n sources, written form
  const laneTally = new Map();                      // scope -> { found, admitted, read, kept }
  const tally = s => laneTally.get(s) || (laneTally.set(s, { found: 0, admitted: 0, read: 0, kept: 0 }), laneTally.get(s));
  const followed = new Set();
  let batchNo = 0, lastTest = null, round = 0; rec.wouldStopAt = null;

  const gate = c => {
    const text = c.title + ' . ' + c.snippet + ' . ' + c.url.replace(/^https?:\/\//, '').replace(/[\/_\-.?=&%+]+/g, ' ');
    if (!bg || !terms.length) return { ok: false, why: !bg ? 'relevance is not measured (no background)' : 'no content terms' };
    return relevance(terms, text, bg, { key: key0 + '|' + c.key + '|snippet', anchors });
  };

  // ── 1. search ───────────────────────────────────────────────────────────────────────────────────────────────────
  async function searchRound(scopes, queries, round) {
    const jobs = [];
    for (const s of scopes) for (const query of queries) {
      const k = s + '|' + query; if (searched.has(k)) continue; searched.add(k);
      if (D.cooling && D.cooling(s)) { const why = 'cooling down after a rate limit'; rec.searches.push({ scope: s, q: query, ok: false, why, round }); rec.gaps.push({ kind: 'lane-cooling', scope: s, q: query, why }); emit({ t: 'search', scope: s, q: query, state: 'failed', why }); continue; }
      jobs.push((async () => {
        emit({ t: 'search', scope: s, q: query, state: 'start', round });
        try {
          const out = await D.search(s, query);
          const results = (out && out.results) || [];
          rec.searches.push({ scope: s, q: query, ok: true, engine: out && out.engine || '', n: results.length, round });
          emit({ t: 'search', scope: s, q: query, state: 'found', n: results.length, engine: out && out.engine || '', round });
          return { s, query, results, engine: out && out.engine || '' };
        } catch (e) {
          const why = String((e && e.message) || e).slice(0, 160);
          if (D.limited) { try { D.limited(s, e); } catch (x) {} }
          rec.searches.push({ scope: s, q: query, ok: false, why, round });
          rec.gaps.push({ kind: 'lane-failed', scope: s, q: query, why });
          emit({ t: 'search', scope: s, q: query, state: 'failed', why, round });
          return null;
        }
      })());
    }
    const got = (await Promise.all(jobs)).filter(Boolean);
    const fresh = [];
    for (const g of got) g.results.forEach((r, rank) => {
      if (!r || !r.url || !/^https?:/i.test(r.url)) return;
      const key = normUrl(r.url); let c = cands.get(key);
      const found = { scope: g.s, q: g.query, rank, engine: g.engine, round };
      if (c) { c.found.push(found); tally(g.s).found++; return; }
      c = { id: 'c' + nextId++, key, url: r.url, title: clean(r.title) || r.url, snippet: clean(r.snippet), kind: r.kind || g.s, source: r.source || '', found: [found], verdict: null, state: 'pending' };
      cands.set(key, c); fresh.push(c); tally(g.s).found++;
    });
    // gate the new candidates
    for (const c of fresh) {
      const r = gate(c); c.snippetRel = r.ok ? { g: r.g, nullMax: r.nullMax, p: r.p, matched: r.matched.slice(0, 4), L: r.L } : { ok: false, why: r.why };
      if (!r.ok) { c.verdict = 'admitted'; c.ungated = true; }
      else if (r.outside) c.verdict = 'admitted';
      else { c.verdict = 'turned-away'; c.state = 'turned-away'; c.why = 'its title and snippet mention the question’s terms no more than ' + r.draws + ' same-length stretches of ordinary English do (' + r.g + ' vs the null’s highest ' + r.nullMax + ')'; rec.gaps.push({ kind: 'turned-away', id: c.id, url: c.url, title: c.title, why: c.why, found: c.found.map(f => f.scope) }); }
      if (c.verdict === 'admitted') for (const f of c.found) tally(f.scope).admitted++;
      emit({ t: 'candidate', id: c.id, url: c.url, title: c.title, scope: c.found[0].scope, verdict: c.verdict, g: c.snippetRel.g, nullMax: c.snippetRel.nullMax, ungated: !!c.ungated, why: c.why || '' });
    }
    return fresh;
  }

  // ── 2. read, test, stop ─────────────────────────────────────────────────────────────────────────────────────────
  const order = (a, b) => ((b.snippetRel && b.snippetRel.g) || 0) - ((a.snippetRel && a.snippetRel.g) || 0) || b.found.length - a.found.length || (a.id < b.id ? -1 : 1);
  async function readOne(c) {
    c.state = 'reading'; emit({ t: 'read', id: c.id, url: c.url, title: c.title, state: 'reading' });
    let rd; try { rd = await D.read(c.url, c); } catch (e) { rd = { ok: false, error: String((e && e.message) || e).slice(0, 120) }; }
    for (const f of c.found) tally(f.scope).read++;
    if (!rd || !rd.ok || !clean(rd.text)) {
      c.state = 'unread'; c.why = (rd && rd.error) ? 'no lane returned its text (' + rd.error + ')' : 'no lane returned its text';
      rec.gaps.push({ kind: 'unread', id: c.id, url: c.url, title: c.title, why: c.why, tried: rd && rd.tried || null });
      emit({ t: 'read', id: c.id, url: c.url, title: c.title, state: 'unread', why: c.why });
      return;
    }
    const text = String(rd.text);
    const rel = bg && terms.length ? relevance(terms, text, bg, { key: key0 + '|' + c.key + '|text', anchors }) : { ok: false, why: 'not measured' };
    c.textRel = rel.ok ? { g: rel.g, nullMax: rel.nullMax, p: rel.p, matched: rel.matched.slice(0, 6), L: rel.L } : { ok: false, why: rel.why };
    if (rel.ok && !rel.outside) {
      c.state = 'off-topic'; c.why = 'read (' + rel.L.toLocaleString() + ' words) but it is not about the question: ' + rel.g + ' against the null’s highest ' + rel.nullMax;
      rec.gaps.push({ kind: 'off-topic-when-read', id: c.id, url: c.url, title: c.title, why: c.why, via: rd.via || null });
      emit({ t: 'read', id: c.id, url: c.url, title: c.title, state: 'off-topic', why: c.why, via: rd.via, g: rel.g, nullMax: rel.nullMax });
      return;
    }
    const parsed = D.parse(text);
    c.state = 'kept'; c.via = rd.via || ''; c.readTitle = clean(rd.title) || c.title; c.text = text;
    c.referents = new Set((parsed.referents || []).filter(Boolean));
    c.reading = { statements: parsed.sts.length, names: [...c.referents].length };
    c.sts = parsed.sts;
    emit({ t: 'read', id: c.id, url: c.url, title: c.readTitle, state: 'read', via: c.via, chars: text.length, g: c.textRel.g, nullMax: c.textRel.nullMax, statements: parsed.sts.length, referents: c.referents.size });
  }

  async function drain() {
    for (;;) {
      if (aborted()) return 'aborted';
      const queue = [...cands.values()].filter(c => c.verdict === 'admitted' && c.state === 'pending').sort(order);
      if (!queue.length) return null;
      const batch = queue.slice(0, D.concurrency);
      await Promise.all(batch.map(readOne));
      // a text that clears the relevance null can still be a record, not prose (a metadata dump): judged against the
      // other sources read, and refused with the numbers
      for (const c of batch.filter(c => c.state === 'kept')) {
        const peers = [...cands.values()].filter(o => o !== c && o.state === 'kept').map(o => o.text);
        const pt = proseTest(c.text, peers, { key: key0 + '|' + c.key + '|prose' });
        if (pt.testable && pt.outside) {
          c.state = 'not-prose'; c.why = 'read, but it is a record rather than prose: ' + (pt.obs * 100).toFixed(1) + ' % of its characters are structure, against at most ' + (pt.nullMax * 100).toFixed(1) + ' % in any of ' + pt.draws + ' stretches of the other sources';
          rec.gaps.push({ kind: 'not-prose', id: c.id, url: c.url, title: c.title, why: c.why, via: c.via || null });
          emit({ t: 'read', id: c.id, url: c.url, title: c.title, state: 'not-prose', why: c.why, via: c.via });
        }
      }
      const kept = batch.filter(c => c.state === 'kept');
      batchNo++;
      for (const c of kept) {
        c.sha256 = await D.sha256(c.text);
        for (const f of c.found) tally(f.scope).kept++;
      }
      if (!kept.length) { emit({ t: 'batch', n: batchNo, round, sources: batch.map(c => c.id), kept: 0, test: null }); rec.batches.push({ n: batchNo, round, ids: batch.map(c => c.id), kept: 0, test: null }); continue; }
      // what this batch added, in the corpus's own terms
      const gain = earnedGain(support, kept.map(c => c.referents));
      for (const c of kept) for (const r of c.referents) { support.set(r, (support.get(r) || 0) + 1); }
      for (const c of kept) for (const st of c.sts) for (const n of st.names) { const k = referentKey(n); if (k && !surface.has(k)) surface.set(k, n); }
      const earned = [...support.values()].filter(n => n >= 2).length;
      const keptAll = [...cands.values()].filter(c => c.state === 'kept');
      // novelty: names and words of 4+ letters, per source (a corpus of mirrors has none to give)
      const sat = saturationTest(keptAll.map(c => new Set([...c.referents, ...stemsOf(c.text).filter(w => w.length >= 4)])));
      lastTest = sat;
      const b = { n: batchNo, round, ids: batch.map(c => c.id), kept: kept.length, newlyConfirmed: gain.delta,
        test: sat.testable ? { expected: sat.expected, looMax: sat.looMax, f1: sat.f1, n: sat.n, saturated: sat.saturated } : { testable: false, why: sat.why } };
      rec.batches.push(b); rec.curve.push({ batch: batchNo, sources: keptAll.length, referents: support.size, earned, singletons: support.size - earned });
      emit({ t: 'batch', ...b, referents: support.size, earned, sources: keptAll.length });
      if (sat.testable && sat.saturated) {
        if (rec.wouldStopAt == null) rec.wouldStopAt = batchNo;   // recorded even for a control run that reads on, so the stop can be audited
        if (!D.noStop) return 'saturated';
      }
    }
  }

  // ── rounds ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const baseQueries = [...new Set([q, ...(D.queriesFor(q) || [])].map(clean).filter(Boolean))];
  let stop = null;
  // earned names the corpus says beyond ordinary English (computed only when a name is about to be followed)
  const keyedNames = () => {
    if (!bg) return null;
    const earned = [...support].filter(([, n]) => n >= 2).map(([r]) => r);
    if (!earned.length) return new Map();
    const idx = corpusIndex([...cands.values()].filter(c => c.state === 'kept').map(c => c.text));
    return new Map(earned.map(r => { const k = phraseKeyness(surface.get(r) || r, idx, bg, { key: key0 }); return [r, k.ok ? k : { outside: false, g: 0 }]; }));
  };
  rec.rounds.push({ round: 0, kind: 'asked', scopes: [...routed.scopes], queries: baseQueries });
  emit({ t: 'round', round: 0, kind: 'asked', scopes: routed.scopes, queries: baseQueries });
  await searchRound(routed.scopes, baseQueries, 0);
  stop = await drain();
  let webHits = [...cands.values()].filter(c => c.found.some(f => f.scope === 'web')).map(c => ({ url: c.url, title: c.title }));

  while (!stop && !aborted()) {
    // the pool is exhausted and the last tested batch (if any) was still learning: reach further
    const stillLearning = D.noStop || !lastTest || !lastTest.testable || !lastTest.saturated;
    if (!stillLearning) { stop = 'saturated'; break; }
    round++;
    // widen first: lanes the router held back, plus any the web hits vote for
    const pr = D.probe(webHits, [...used]) || { add: [], why: {} };
    const widen = [...new Set([...(pr.add || []), ...routed.rest])].filter(s => !used.has(s));
    let scopes, queries, kind, why = '';
    if (widen.length) { scopes = widen; queries = baseQueries; kind = 'widened'; why = [...cands.values()].some(c => c.state === 'kept') ? 'the corpus was still learning when the routed lanes ran out' : 'nothing could be kept from the routed lanes, so it looked in the ones the router had held back'; for (const s of widen) rec.lanes.push({ scope: s, why: (pr.why && pr.why[s]) || 'held back by the router; reached for because the corpus was still learning', round }); }
    else {
      const f = frontier(support, surface, qStems, followed, keyedNames());
      if (!f) { stop = 'candidates-exhausted'; break; }
      followed.add(f.referent);
      const productive = [...laneTally].filter(([, v]) => v.kept > 0).map(([s]) => s);
      scopes = productive.length ? productive : [...used]; queries = [clean(f.surface + ' ' + q)]; kind = 'followed';
      why = '“' + f.surface + '” is witnessed by ' + f.support + ' sources and is not in the question';
    }
    for (const s of scopes) used.add(s);
    rec.rounds.push({ round, kind, scopes, queries, why });
    emit({ t: 'round', round, kind, scopes, queries, why });
    const fresh = await searchRound(scopes, queries, round);
    webHits = webHits.concat(fresh.filter(c => c.found.some(f => f.scope === 'web')).map(c => ({ url: c.url, title: c.title })));
    const admitted = fresh.filter(c => c.verdict === 'admitted').length;
    // following a name that surfaced nothing new to read ends the search: there is no further direction the corpus itself points
    if (!admitted && kind === 'followed') { stop = 'candidates-exhausted'; break; }   // a followed name that surfaces nothing clearing the null ends the search
    stop = await drain();
  }
  if (aborted()) stop = 'aborted';

  // ── the record ──────────────────────────────────────────────────────────────────────────────────────────────────
  const all = [...cands.values()];
  for (const s of routed.rest) if (!used.has(s)) rec.notAsked.push({ scope: s, why: stop === 'saturated' ? 'the corpus had saturated before this lane was needed' : 'not reached' });
  // admitted candidates left unread are listed, never silently dropped
  for (const c of all) if (c.verdict === 'admitted' && c.state === 'pending') {
    c.state = 'held'; c.why = stop === 'saturated' ? 'cleared the relevance null but was not read: the corpus had saturated' : stop === 'aborted' ? 'cleared the relevance null but was not read: you stopped the run' : 'cleared the relevance null but was not read';
    rec.gaps.push({ kind: 'held', id: c.id, url: c.url, title: c.title, why: c.why, found: c.found.map(f => f.scope) });
  }
  rec.sources = all.filter(c => c.state === 'kept').map(c => ({ id: c.id, url: c.url, title: c.readTitle, via: c.via, chars: c.text.length, sha256: c.sha256, found: c.found, snippetRel: c.snippetRel, textRel: c.textRel, reading: c.reading, referents: [...c.referents], text: c.text }));
  rec.candidates = all.map(c => ({ id: c.id, url: c.url, title: c.title, kind: c.kind, state: c.state, verdict: c.verdict, why: c.why || '', found: c.found, snippetRel: c.snippetRel, textRel: c.textRel || null }));
  const earned = [...support].filter(([, n]) => n >= 2);
  rec.corpus = { sources: rec.sources.length, referents: support.size, earned: earned.length, heardOnce: support.size - earned.length };
  rec.lanesTally = Object.fromEntries(laneTally);
  rec.stop = { reason: !all.length ? 'no-candidates' : stop || 'candidates-exhausted', test: lastTest && lastTest.testable ? { expected: lastTest.expected, looMax: lastTest.looMax, f1: lastTest.f1, n: lastTest.n } : null,
    detail: stop === 'saturated' && lastTest ? 'another source is expected to bring ' + lastTest.expected + ' name or word the ' + lastTest.n + ' read have not used (at most ' + lastTest.looMax + ' with any one source set aside) — under the floor of one, so reading more would not have taught it anything it lacks'
      : !all.length ? 'no lane returned a result (' + rec.searches.filter(x => !x.ok).length + ' of ' + rec.searches.length + ' searches failed or were cooling down)'
      : stop === 'aborted' ? 'you stopped it' : 'every candidate that cleared the relevance null was read, and no further lane or followed name produced a new one' };
  rec.endedAt = new Date(D.now()).toISOString();
  emit({ t: 'stop', stop: rec.stop, corpus: rec.corpus });
  return rec;
}
