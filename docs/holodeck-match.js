// holodeck-match.js — how a search term is resolved against the workspace's own names and text.
// One resolver, the precedent cast.js::resolve already set: strongest signal first, the weakest only when
// everything stronger found nothing, and a tie between distinct candidates REFUSED rather than broken.
//   1. Exact     the term, folded (case, accents), equals a known name or appears verbatim in the text.
//   2. Pattern   the term is a declared pattern: /regex/flags, or wildcards (* any run, ? one character).
//   3. Near-Miss surfaces.js::isNearMissSpelling — one edit, both sides at least MIN_VARIANT_LEN long,
//                token by token, and refused the instant it would reach more than one distinct name
//                (Reed/Reid, Allen/Allan: one edit apart, homophones, different people).
// Shape — Company (kind-standing.js::contextVectors + cosine): names whose surrounding words match a name's,
// ranked against the same scores for every other pair, so "like this" means "beats what any name gets for free".
import { isNearMissSpelling } from './vendor/eoreader7/native/adapters/text/surfaces.js';
import { foldDiacritics } from './vendor/eoreader7/native/organs/source.js';
import { contextVectors, cosine } from './vendor/eoreader7/native/organs/kind-standing.js';

export function modeLine(r) {
  if (!r || r.mode === 'exact') return '';
  if (r.mode === 'pattern') return 'Matched a pattern: ' + (r.pattern || '') + (r.names && r.names.length ? ' (' + r.names.length + ' names)' : '');
  if (r.mode === 'nearmiss') return 'Read as a near-miss: ' + r.why;
  if (r.mode === 'refused') return 'No name picked: ' + r.why;
  return r.why ? 'Nothing matched: ' + r.why : '';
}
export const MODES = {
  exact: { label: 'Exact', desc: 'the words as typed' },
  pattern: { label: 'Pattern', desc: 'a pattern you declared' },
  nearmiss: { label: 'Near-miss', desc: 'one letter off a single known name' },
  refused: { label: 'Refused', desc: 'one letter off several different names, so none was picked' },
  none: { label: 'No match', desc: 'nothing matched at any level' },
};
const fold = s => foldDiacritics(String(s || '').toLowerCase()).replace(/\s+/g, ' ').trim();

export function parsePattern(term) {
  const t = String(term || '').trim();
  const m = t.match(/^\/(.+)\/([gimsuy]*)$/);
  try {
    if (m) return new RegExp(m[1], m[2].includes('i') ? m[2] : m[2] + 'i');
    if (/[*?]/.test(t)) return new RegExp('\\b' + t.split('').map(c => c === '*' ? '[\\p{L}\\p{N}\'’-]*' : c === '?' ? '[\\p{L}\\p{N}]' : c.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('') + '\\b', 'iu');
  } catch (e) { return { error: String(e.message || e) }; }
  return null;
}

// Resolve a term against a list of candidate names (strings). Returns { mode, names, why, pattern }.
// Candidates are merged by REFERENT before any tie is counted (cast.js::resolve refuses on more than one distinct
// referent, never on more than one distinct string). `sameAs(name)` maps a name to its referent key (aliases,
// the reader's cast); without it, names that fold to the same form (case, accents) are one referent.
function byReferent(list, sameAs) {
  const seen = new Map();
  for (const n of list) { const k = sameAs ? (sameAs(n) || fold(n)) : fold(n); if (!seen.has(k)) seen.set(k, n); }
  return [...seen.values()];
}
export function resolveTerm(term, rawNames, { sameAs = null } = {}) {
  const names = rawNames || [];
  const t = String(term || '').trim(); if (!t) return { mode: 'none', names: [], why: '' };
  const ft = fold(t);
  const exact = byReferent(names.filter(n => fold(n) === ft), sameAs);
  if (exact.length) return { mode: 'exact', names: exact, why: exact.length > 1 ? 'the same spelling names ' + exact.length + ' records' : '' };
  const pat = parsePattern(t);
  if (pat && pat.error) return { mode: 'none', names: [], why: 'the pattern did not parse: ' + pat.error, patternError: pat.error };
  if (pat) { const hit = byReferent(names.filter(n => pat.test(n)), sameAs); return { mode: hit.length ? 'pattern' : 'none', names: hit, pattern: pat, why: hit.length ? '' : 'no name fits ' + pat };  }
  const contains = byReferent(names.filter(n => (' ' + fold(n) + ' ').includes(' ' + ft + ' ')), sameAs);
  if (contains.length) return { mode: 'exact', names: contains, why: 'every name that contains the words' };
  const parts = ft.split(' ').filter(p => p.length > 2); if (!parts.length) return { mode: 'none', names: [], why: '' };
  const variant0 = [];
  for (const n of names) { const toks = fold(n).split(' '); if (parts.every(p => toks.some(s => isNearMissSpelling(s, p)))) variant0.push(n); }
  const variant = byReferent(variant0, sameAs);
  if (variant.length === 1) return { mode: 'nearmiss', names: variant, why: '“' + t + '” is one letter off “' + variant[0] + '”, and off no other name' };
  if (variant.length > 1) return { mode: 'refused', names: [], candidates: variant.slice(0, 6), why: '“' + t + '” is one letter off ' + variant.length + ' different names (' + variant.slice(0, 4).join(', ') + '), so none was picked' };
  return { mode: 'none', names: [], why: '' };
}

// Match a term against running text (statements, passages): exact phrase, else pattern, else a near-miss
// that resolves to exactly one known name (and then the text is searched for THAT name).
export function textMatcher(term, names, opts) {
  const t = String(term || '').trim(); const ft = fold(t);
  const pat = parsePattern(t);
  if (pat && !pat.error) return { mode: 'pattern', test: s => pat.test(String(s || '')), pattern: pat };
  const r = resolveTerm(t, names || [], opts);
  if (r.mode === 'nearmiss') { const target = fold(r.names[0]); return { mode: 'nearmiss', test: s => fold(s).includes(target), resolved: r.names[0], why: r.why }; }
  if (r.mode === 'refused') return { mode: 'refused', test: s => fold(s).includes(ft), why: r.why, candidates: r.candidates };
  return { mode: 'exact', test: s => fold(s).includes(ft) };
}

// Company shape: who keeps the same company as `name`. Sentences are statements' text. The floor is the
// 95th percentile of every other pair's similarity, so a name is "like" another only when it beats that.
export function companyLike(name, surfaces, sentences, { limit = 10 } = {}) {
  const pool = [...new Set([name, ...surfaces])].filter(Boolean).slice(0, 400);
  const vecs = contextVectors(sentences, pool);
  const vx = vecs.get(name); if (!vx) return { ok: false, why: 'this name never appears with words around it' };
  const others = [...vecs.keys()].filter(k => k !== name);
  const scored = others.map(k => ({ name: k, sim: cosine(vx, vecs.get(k)) })).sort((a, b) => b.sim - a.sim);
  const base = []; const ks = others.slice(0, 60);
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) base.push(cosine(vecs.get(ks[i]), vecs.get(ks[j])));
  base.sort((a, b) => a - b); const floor = base.length ? base[Math.floor(base.length * 0.95)] : 0;
  const top = scored.filter(x => x.sim > floor && x.sim > 0).slice(0, limit);
  const share = (a, b) => { const out = []; for (const [k, v] of a) if (b.get(k)) out.push([k, Math.min(v, b.get(k))]); return out.filter(x => !/=(\^|\$|and|the|of|a|to|in|for|,)$/.test(x[0])).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k]) => { const w = k.slice(k.indexOf('=') + 1); return k.startsWith('before=') ? 'after “' + w + '”' : 'before “' + w + '”'; }); };
  return { ok: true, floor, n: base.length, list: top.map(x => ({ ...x, shared: share(vx, vecs.get(x.name)) })) };
}
