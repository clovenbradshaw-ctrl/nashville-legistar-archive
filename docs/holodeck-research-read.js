// holodeck-research-read.js — the mechanical reading the research assistant does while it is still acquiring: text in,
// statements out, every statement carrying the character span it came from. Pure: no DOM, no network, no model.
//
// This is the small, portable twin of what index.html's analyze() does per document (sentences, names, figures,
// dates, framing). The page injects the Holodeck's OWN finder (splitSentences / findNames / findFigures / findDates /
// frameOf) through the same shape, so the stopping rule and the terrain the person sees come from one reading; this
// default is what runs in tests, in node, and when the page's finder is not available. Nothing here is a model.
//
//   readSource(text) -> { sts: [{ s, e, text, names:[surface], figs:[{raw,value,unit,s,e}], dates:[{raw,year,s,e}], frame }],
//                         referents: [normalized name] }
//
// s/e are offsets into the exact string given, so a statement can always be sliced back out of its source:
// text.slice(st.s, st.e) === st.text.

import { fold } from './holodeck-research-null.js';

const ABBR = /(?:\b(?:a\.m|p\.m|U\.S|U\.K|Mr|Mrs|Ms|Dr|St|Ltd|Inc|Co|No|vs|Jr|Sr|Gov|Sen|Rep|Mt|Ft|approx|etc|e\.g|i\.e)|\b[A-Z])\.$/;

export function splitStatements(text) {
  const out = []; const re = /[^\n]+?(?:[.!?]+(?=\s|$)|(?=\n)|$)/g; let m, carry = null;
  while ((m = re.exec(text))) {
    if (m[0] === '') { re.lastIndex++; continue; }
    const lead = m[0].length - m[0].replace(/^\s+/, '').length, tt = m[0].trim();
    if (!tt) continue;
    const s = m.index + lead, e = s + tt.length;
    if (carry) { carry.e = e; carry.text = text.slice(carry.s, e); if (!ABBR.test(tt)) { out.push(carry); carry = null; } continue; }
    if (ABBR.test(tt) && /[.]$/.test(tt) && tt.length < 60) { carry = { s, e, text: tt }; continue; }
    out.push({ s, e, text: tt });
  }
  if (carry) out.push(carry);
  return out;
}

const WORD = "\\p{Lu}[\\p{L}\\p{M}'’&.]*(?:-\\p{Lu}[\\p{L}\\p{M}'’&.]*)*";
// "and" is deliberately not a connector: "A and B and C" is a list of names, far more often than it is one name
const NAME_RE = new RegExp(WORD + '(?:\\s+(?:(?:of|the|de|del|la|von|van|der|&)\\s+)*' + WORD + ')*', 'gu');

/** Capitalised runs in one statement. A single capitalised word that opens the statement is an opener, not a name,
 *  unless the same word is written capitalised mid-statement somewhere in the source (`midCaps`). */
export function namesIn(t, midCaps) {
  const out = []; let m; NAME_RE.lastIndex = 0;
  while ((m = NAME_RE.exec(t))) {
    let run = m[0].replace(/[.,;:]+$/, '').replace(/['’]s$/i, '');
    let idx = m.index;
    const atStart = /^[\s"“'(\[]*$/.test(t.slice(0, idx));
    const words = run.split(/\s+/);
    if (atStart && words.length === 1 && !(midCaps && midCaps.has(fold(run)))) continue;
    if (/^(?:of|the|de|del|la|von|van|der|&)$/i.test(words[0])) continue;
    if (run.replace(/[^\p{L}]/gu, '').length < 2) continue;
    out.push({ name: run, s: idx, e: idx + run.length });
  }
  return out;
}

export function figuresIn(t) {
  const out = []; const re = /(\$|£|€)?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(\s*(million|billion|thousand|bn|k)\b)?(\s*(%|percent|[A-Za-z]+))?/g; let m;
  while ((m = re.exec(t))) {
    if (m.index > 0 && /[A-Za-z0-9:.]/.test(t[m.index - 1])) continue;
    const cur = m[1], num = parseFloat(m[2].replace(/,/g, '')), mult = m[4]; let unit = m[6] || '';
    if (!cur && !mult && /^\d{4}$/.test(m[2]) && num >= 1000 && num <= 2099) continue;   // a year is a date, not a figure
    let end = m.index + m[0].length;
    if (unit && /^[A-Z]/.test(unit)) { end -= (m[5] || '').length; unit = ''; }
    if (cur) unit = cur === '$' ? 'dollars' : cur === '£' ? 'pounds' : 'euros';
    else if (unit === '%' || unit === 'percent') unit = 'percent';
    else if (!unit || /^(am|pm|a|an|the|and|or|of|in|on|at|to|by|for|was|were|is|are|th|st|nd|rd|s|times?)$/i.test(unit)) continue;
    else unit = unit.toLowerCase().replace(/s$/, '');
    const val = num * ({ million: 1e6, billion: 1e9, bn: 1e9, thousand: 1e3, k: 1e3 }[mult] || 1);
    out.push({ raw: t.slice(m.index, end).trim(), value: val, unit, s: m.index, e: end });
  }
  return out;
}

export function datesIn(t) {
  const out = []; const re = /\b(1[0-9]{3}|20[0-9]{2}|January|February|March|April|June|July|August|September|October|November|December)\b/g; let m;
  while ((m = re.exec(t))) out.push({ raw: m[1], s: m.index, e: m.index + m[1].length, year: /^\d{4}$/.test(m[1]) ? +m[1] : null });
  return out;
}

export function frameOf(t) {
  const l = t.toLowerCase();
  if (/\b(may|might|could|possibly|perhaps|likely|unclear|appears to|seems)\b/.test(l)) return 'uncertain';
  if (/\b(said|says|told|reported|estimated|according to|wants|claims?|claimed|argued|believes?)\b/.test(l)) return 'attributed';
  if (/\b(will|plans? to|should|expected to|expects?|intends?|proposed?|aims? to|scheduled)\b/.test(l)) return 'plan';
  return 'fact';
}

/** The referent a surface stands for: folded, spaces collapsed, a leading "the" shed. */
export const referentKey = name => fold(name).replace(/\s+/g, ' ').replace(/^the\s+/, '').trim();

export function readSource(text) {
  text = String(text || '');
  const raw = splitStatements(text);
  // names written capitalised mid-statement anywhere in the source: evidence that a sentence-opening word is a name
  const midCaps = new Set();
  for (const st of raw) { const re = /(?<=[\p{L}\p{N},;:)]\s)\p{Lu}[\p{L}\p{M}'’-]*/gu; let m; while ((m = re.exec(st.text))) midCaps.add(fold(m[0])); }
  const sts = raw.map(st => {
    const ns = namesIn(st.text, midCaps);
    return { s: st.s, e: st.e, text: st.text, names: ns.map(n => n.name), nameSpans: ns, figs: figuresIn(st.text), dates: datesIn(st.text), frame: frameOf(st.text) };
  });
  const refs = new Set(); for (const st of sts) for (const n of st.names) { const k = referentKey(n); if (k) refs.add(k); }
  return { sts, referents: [...refs] };
}
