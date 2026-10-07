// overview.js — bounded, replayable views over versioned UTF-8 text.
// No model, semantic absence inference, silent relocation, or inferred speaker.
// Imported media must declare their text extraction; these bytes are not the media.
export const BLOCKS = Object.freeze(['frame', 'witness', 'relation', 'contrast', 'trace', 'measure', 'negative-space', 'inquiry']);
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });
const fail = message => { throw new TypeError(message); };
const text = (v, name) => typeof v === 'string' && v.trim() ? v : fail(name + ' must be declared');
export const canonical = v => JSON.stringify(sort(v));
function sort(v) { return Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])])) : v; }
export async function digest(v) {
  const bytes = typeof v === 'string' ? enc.encode(v) : v;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
function scalarBoundary(s, i) {
  if (!Number.isInteger(i) || i < 0 || i > s.length) return false;
  const a = s.charCodeAt(i - 1), b = s.charCodeAt(i);
  return !(a >= 0xd800 && a <= 0xdbff && b >= 0xdc00 && b <= 0xdfff);
}
export async function anchor(source, start, end) {
  if (!scalarBoundary(source.text, start) || !scalarBoundary(source.text, end) || start >= end) fail('invalid character range or surrogate seam');
  return { source: source.id, version: await digest(source.text), space: source.space,
    unit: 'byte', encoding: 'utf8', start: enc.encode(source.text.slice(0, start)).length,
    end: enc.encode(source.text.slice(0, end)).length, quote: source.text.slice(start, end) };
}
export async function reopen(ref, sources) {
  const s = sources.find(x => x.id === ref.source);
  if (!s) return { ok: false, gap: 'missing-source' };
  if (await digest(s.text) !== ref.version) return { ok: false, gap: 'stale-source' };
  const bytes = enc.encode(s.text);
  if (ref.space !== s.space || ref.unit !== 'byte' || ref.encoding !== 'utf8' || !Number.isInteger(ref.start) || !Number.isInteger(ref.end) || ref.start < 0 || ref.end <= ref.start || ref.end > bytes.length) return { ok: false, gap: 'invalid-address' };
  try {
    const before = dec.decode(bytes.slice(0, ref.start)), quote = dec.decode(bytes.slice(ref.start, ref.end));
    dec.decode(bytes.slice(ref.end));
    if (quote !== ref.quote) return { ok: false, gap: 'altered-quote' };
    return { ok: true, quote, before, after: dec.decode(bytes.slice(ref.end)), source: s };
  } catch { return { ok: false, gap: 'utf8-seam' }; }
}
function normalizeSources(sources) {
  if (!Array.isArray(sources) || !sources.length) fail('source scope must contain material');
  const ids = new Set();
  return sources.map(s => {
    if (ids.has(s.id)) fail('duplicate source identity'); ids.add(s.id);
    text(s.id, 'source identity'); text(s.title, 'source title'); text(s.space, 'address space');
    if (typeof s.text !== 'string') fail('source text must be supplied, including empty text');
    if (!s.text.isWellFormed()) fail('source text contains unpaired surrogates; cannot preserve UTF-8 identity');
    if (!['complete', 'partial', 'unread'].includes(s.coverage)) fail('reading coverage must be declared');
    return { id: s.id, title: s.title, text: s.text, space: s.space, coverage: s.coverage,
      giver: s.giver || null, limitations: text(s.limitations, 'source limits') };
  });
}
function ranges(s, query) {
  // Lines are display units, never claims; preserve original whitespace and offsets.
  const out = []; let start = 0, byteStart = 0;
  for (const line of s.text.split('\n')) {
    if (line.trim() && (!query || line.includes(query))) out.push([start, start + line.length, byteStart, byteStart + enc.encode(line).length]);
    start += line.length + 1; byteStart += enc.encode(line).length + 1;
  }
  return out;
}
export async function composeOverview(input) {
  const recipe = structuredClone(input);
  const sources = normalizeSources(recipe.sources);
  const f = recipe.frame || {};
  for (const k of ['question', 'viewpoint', 'owner', 'experiencer', 'selection']) text(f[k], 'frame.' + k);
  if (typeof f.query !== 'string') fail('literal query must be explicitly declared, even as empty');
  const manifest = await Promise.all(sources.map(async s => ({ id: s.id, title: s.title, version: await digest(s.text), bytes: enc.encode(s.text).length, space: s.space, coverage: s.coverage, giver: s.giver, limitations: s.limitations })));
  const revision = await digest(canonical(manifest));
  const declared = Object.fromEntries(['question', 'viewpoint', 'owner', 'experiencer', 'selection', 'query'].map(k => [k, f[k]]));
  const frame = { type: 'frame', id: 'frame', ...declared, revision, manifest, transformation: 'declared scope; exact case-sensitive line selection', limits: 'Literal retrieval does not establish meaning, truth, speaker identity, independence, or equitable representation.' };
  const blocks = [frame];
  for (const s of sources) {
    if (s.coverage === 'unread') continue;
    for (const [a, b, start, end] of ranges(s, f.query)) {
      const ref = { source: s.id, version: manifest.find(m => m.id === s.id).version, space: s.space, unit: 'byte', encoding: 'utf8', start, end, quote: s.text.slice(a, b) };
      blocks.push({ type: 'witness', id: 'w:' + s.id + ':' + ref.start + ':' + ref.end, text: ref.quote,
        giver: s.giver, refs: [ref], premises: [], transformation: 'verbatim line selection; no paraphrase', limits: s.limitations });
    }
  }
  const witnesses = blocks.filter(b => b.type === 'witness');
  blocks.push({ type: 'measure', id: 'measure', text: witnesses.length + ' selected passages in ' + sources.length + ' selected sources',
    value: witnesses.length, denominator: sources.length, unit: 'selected text lines',
    premises: witnesses.map(w => w.id), refs: [], transformation: 'count selected witness rows', limits: 'Passage count is not importance, independent corroboration, or representation equity.' });
  for (const [i, e] of (recipe.expectations || []).entries()) {
    for (const k of ['expected', 'basis', 'owner', 'query', 'next']) text(e[k], 'expectation.' + k);
    const basisIds = e.basisIds || [];
    if (basisIds.some(id => !witnesses.some(w => w.id === id))) fail('expectation basis must resolve to selected witnesses');
    if (!['owned', 'sourced'].includes(e.standing) || (e.standing === 'sourced' && !basisIds.length)) fail('expectation ownership or source basis missing');
    const hits = [];
    for (const s of sources) {
      if (s.coverage === 'unread') continue;
      let from = 0, pos;
      while ((pos = s.text.indexOf(e.query, from)) !== -1) {
        hits.push(await anchor(s, pos, pos + e.query.length)); from = pos + e.query.length;
      }
    }
    const partial = sources.some(s => s.coverage !== 'complete' || !s.text.trim());
    const id = 'negative:' + i;
    blocks.push({ type: 'negative-space', id, expected: e.expected, basis: e.basis, owner: e.owner, standing: e.standing,
      premises: basisIds, refs: hits, query: e.query, manifest, revision,
      status: hits.length ? 'literal-matches' : partial ? 'incomplete-search' : 'not-found-in-scope',
      text: hits.length ? hits.length + ' literal matches; whether they represent this perspective remains open.' : partial ? 'No literal match in readable material; collection coverage is incomplete.' : 'No literal match in this selected collection.',
      stakes: e.stakes ? { text: e.stakes, standing: 'owned-hypothesis', owner: e.owner } : null,
      transformation: 'case-sensitive exact substring search across declared readable text',
      limits: 'A lexical absence does not establish a missing voice or an absence in the world. Wording variants and indirect testimony remain untested.' });
    blocks.push({ type: 'inquiry', id: 'inquiry:' + i, text: e.next, owner: e.owner, premises: [id], refs: [], transformation: 'owned next evidence request', limits: 'Proposed inquiry; no outcome claimed.' });
  }
  // Explicitly owned arrangements over existing witnesses, not semantic extraction.
  for (const b of recipe.arrangements || []) {
    if (!['relation', 'contrast', 'trace'].includes(b.type)) fail('unsupported arrangement');
    text(b.id, 'arrangement identity'); text(b.owner, 'arrangement owner'); text(b.text, 'arrangement account'); text(b.basis, 'arrangement basis');
    if (!Array.isArray(b.premises) || !b.premises.length || b.premises.some(id => !witnesses.some(w => w.id === id))) fail('arrangement premises must be witnesses');
    blocks.push({ ...b, standing: 'owned-arrangement', refs: [], transformation: 'user-declared arrangement of witnessed passages', limits: 'Evidence association does not verify the semantic relationship or chronology.' });
  }
  if (new Set(blocks.map(b => b.id)).size !== blocks.length) fail('duplicate block identity');
  const reverse = {};
  for (const b of blocks) for (const r of b.refs || []) (reverse[r.source] ||= []).push({ block: b.id, start: r.start, end: r.end });
  return { schema: 'Overview@1', revision, frame, blocks, reverse, recipe, noModel: true };
}
export async function verifyOverview(overview, currentSources = overview.recipe.sources) {
  try {
    const expected = await composeOverview({ ...overview.recipe, sources: currentSources });
    const same = canonical(expected) === canonical(overview);
    return { ok: same, gap: same ? null : expected.revision !== overview.revision ? 'stale-source-or-scope' : 'altered-artifact-or-derivation' };
  } catch (e) { return { ok: false, gap: 'invalid-contract', detail: e.message }; }
}
export function dependents(overview, id) {
  const reached = new Set([id]); let changed;
  do { changed = false; for (const b of overview.blocks) if (!reached.has(b.id) && (b.premises || []).some(p => reached.has(p))) { reached.add(b.id); changed = true; } } while (changed);
  return [...reached].filter(x => x !== id);
}
export function blocksAt(overview, source, start, end) {
  const direct = (overview.reverse[source] || []).filter(r => r.start < end && r.end > start).map(r => r.block);
  return [...new Set(direct.flatMap(id => [id, ...dependents(overview, id)]))];
}
