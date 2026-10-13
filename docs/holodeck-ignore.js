// holodeck-ignore.js — the surface's consumer of the ignore faculty.
//
// THE FACULTY IS KHORA'S, and it is a key part of khora's awareness — measured,
// reversible and disclosed, already:
//   · organs/source.js     whole-page furniture blanking — LENGTH-PRESERVING
//                          (furniture → spaces), decided with the whole document
//                          in view; `chunk.blanked` carries the same characters.
//                          Measured: 13–63× more furniture than per-sentence.
//   · organs/tschichold.js a dropped line that RECURS is furniture; it mints a
//                          `drop-lines` / `templateLines` rule with its evidence
//                          ("N dropped line(s) recur"). A WATERMARK IS THIS CASE.
//   · organs/web.js        the REVERSIBLE half of the furniture wall: calling
//                          text furniture is disclosed, never silent/irreversible.
//   · organs/grounding.js  every reader skips the same furniture — so a surface
//                          that reads through khora inherits one ignore, not one per app.
// The discipline: BLANK (never delete), PRESERVE offsets, MINT a falsifiable
// rule, DISCLOSE.
//
// This module is the surface's stand-in until khora's blanked spans + minted
// rules are exposed on the reading path. It follows the SAME shape (blank,
// preserve offsets, mint a `drop-lines` candidate with a falsifier) so it can be
// replaced by khora's organ without a change of meaning.
//
// The general signal is REPETITION — a short line recurring across a document
// (running head/foot, boilerplate, template, watermark). A watermark is one
// instance; a person's declared rule is the other.

const LS = 'hd:ignore-rules';

export function rules() { try { const a = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
export function addRule(r) { const a = rules(); a.push({ schema: 'IgnoreRule@1', id: 'ig' + Date.now().toString(36), at: new Date().toISOString(), kind: 'phrase', ...r }); try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} return a; }
export function removeRule(id) { const a = rules().filter(r => r.id !== id); try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} return a; }

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const isShortLine = (n) => n.length >= 3 && n.length <= 60 && n.split(' ').length <= 6;
// A repeated line that reads like a sentence is NOT ignored on repetition alone.
const looksLikeStamp = (n) => /[A-Za-z]/.test(n) && !/[.!?]$/.test(n);
const STAMP = /\b(view only|confidential|draft|sample|copy|watermark|proof|do not (copy|distribute)|uncontrolled)\b/i;

/** planIgnores(text, { pages }) -> { ignored, kept, removed, rule }.
 *  Blanks ignored lines length-preservingly and mints one falsifiable rule. */
export function planIgnores(text, { pages = 1 } = {}) {
  const lines = String(text || '').split('\n');
  const counts = new Map();
  lines.forEach((l) => { const n = norm(l); if (isShortLine(n)) counts.set(n, (counts.get(n) || 0) + 1); });
  const declared = new Map(rules().filter(r => r.kind === 'phrase' && r.text).map(r => [norm(r.text).toLowerCase(), r]));
  const floor = Math.max(3, Math.ceil((pages || 1) * 0.5));
  const ignored = [];
  for (const [n, c] of counts) {
    const low = n.toLowerCase();
    if (declared.has(low)) { ignored.push({ text: n, rule: 'declared', signal: 'declared', evidence: 'you set this aside (' + c + '×)' }); continue; }
    if (c >= floor && looksLikeStamp(n) && (n === n.toUpperCase() || STAMP.test(n))) ignored.push({ text: n, rule: 'drop-lines', signal: 'repetition', evidence: c + ' dropped line(s) recur — a running head/footer, boilerplate, or a watermark' });
  }
  if (!ignored.length) return { ignored: [], kept: text, removed: 0, rule: null };
  // BLANK, never delete: the ignored line's characters become spaces, so every
  // offset after it is unmoved (khora's length-preserving discipline).
  const blank = new Set(ignored.map(x => x.text));
  const kept = lines.map(l => blank.has(norm(l)) ? ' '.repeat(l.length) : l).join('\n');
  // MINT the falsifiable rule tschichold would: what recurs is furniture.
  const rule = { schema: 'IgnoreRule@1', id: 'ig' + Date.now().toString(36), at: new Date().toISOString(), kind: 'recurring-line', primitive: 'templateLines', table: ignored.map(x => x.text).slice(0, 20), evidence: ignored[0].evidence, claim: 'a line that recurs in a document is furniture, not material', falsifier: 'a recurring line a person confirms is material (e.g. a required form field) falsifies this rule', standing: 'disclosed' };
  try { const a = rules(); a.push(rule); localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {}
  return { ignored, kept, removed: ignored.length, rule };
}
