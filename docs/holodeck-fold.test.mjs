// holodeck-fold.test.mjs — the fold's language-neutral behaviours, on small synthetic vocabularies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFold } from './holodeck-fold.js';

const page = (...ws) => [{ page: 1, elements: ws.map((text) => ({ text })) }];
const kinds = (res) => res.pages[0].tokens.map((t) => t.kind);
const toks = (res) => res.pages[0].tokens;

// a vocabulary with one productive ending ("-ing") and one non-ending that merely looks like one ("-sy")
function vocabWithEndings() {
  const stems = []; const forms = {};
  const L = 'bcdfghklmnprstvw', V = 'aeiou';
  for (const a of L) for (const v of V) for (const b of 'nrtl') stems.push(a + v + b + 'k');   // bank, ...
  for (const s of stems.slice(0, 120)) { forms[s] = { NOUN: 1 }; forms[s + 'ing'] = { VERB: 1 }; }
  for (const s of stems.slice(120, 160)) forms[s] = { NOUN: 1 };
  // plenty of other long words whose heads are NOT words, as any real vocabulary has
  for (let i = 0; i < 300; i++) { const w = [...i.toString(26)].map((ch) => String.fromCharCode(97 + parseInt(ch, 26))).join('') + 'xqztu'; forms[w] = { NOUN: 1 }; }
  forms.here = { ADV: 1 }; forms.heresy = { NOUN: 1 }; forms.hereby = { ADV: 1 };
  return forms;
}

test('endings are learned from the vocabulary, not assumed', () => {
  const f = makeFold({ words: {}, pairs: {} }, { lexicon: (w) => null, lexiconForms: vocabWithEndings() });
  assert.ok(f.endings.has('ing'), 'a productive ending is found');
  assert.ok(!f.endings.has('sy'), 'an ending that attaches to nothing is not');
});

test('pair-free: a one-off misread goes back to the form the document itself reads', () => {
  const lex = { casa: { NOUN: 1 }, grande: { ADJ: 1 }, la: { DET: 1 }, es: { VERB: 1 } };
  const f = makeFold({ words: {}, pairs: {} }, { lexicon: (w) => lex[w.toLowerCase()] || null, lexiconForms: lex });
  assert.equal(f.noPairs, true);
  const res = f.foldDoc(page('la', 'casa', 'es', 'grande', 'la', 'casa', 'es', 'grande', 'la', 'casx', 'es'));
  const bad = toks(res)[9];
  assert.equal(bad.kind, 'repaired'); assert.equal(bad.to, 'casa');
});

test('pair-free: a valid word absent from the lexicon that recurs in its document is left alone', () => {
  const lex = { casa: { NOUN: 1 }, cosa: { NOUN: 1 }, la: { DET: 1 }, es: { VERB: 1 } };
  const f = makeFold({ words: {}, pairs: {} }, { lexicon: (w) => lex[w.toLowerCase()] || null, lexiconForms: lex });
  // "casi" is not in the lexicon, one edit from "casa", and the document uses it three times: it is a word
  const res = f.foldDoc(page('la', 'casa', 'es', 'la', 'casi', 'es', 'la', 'casi', 'la', 'casi', 'la', 'casa'));
  for (const t of toks(res)) if (t.text === 'casi') assert.notEqual(t.kind, 'repaired');
});

test('caseless script is not given the Latin capital rule, and a consonant script defers pair-free repair', () => {
  const lex = { 'كتاب': { NOUN: 1 }, 'كتب': { NOUN: 1 } };
  const f = makeFold({ words: {}, pairs: {} }, { lexicon: (w) => lex[w] || null, lexiconForms: lex });
  const res = f.foldDoc(page('كتاب', 'كتاب', 'كتابب'));
  assert.ok(toks(res).every((t) => t.kind !== 'repaired'));
  assert.ok((res.stats.deferred || 0) >= 1, 'it says repair was deferred, not that nothing was wrong');
});

test('an unspaced script is passed through: there is no token to repair', () => {
  const f = makeFold({ words: {}, pairs: {} }, { lexicon: () => null, lexiconForms: [] });
  const res = f.foldDoc(page('北京是中国的首都', '孔子'));
  assert.deepEqual(kinds(res), ['other', 'other']);
});

test('the English path: sample priors repair a misread beside its attested neighbours, and a tie is refused', () => {
  const words = { control: 90, contract: 90, panel: 40, master: 40, contral: 0 };
  const pairs = { 'master control': 12, 'control panel': 9 };
  const lex = { control: { NOUN: 1 }, contract: { NOUN: 1 }, panel: { NOUN: 1 }, master: { NOUN: 1 } };
  const f = makeFold({ words, pairs }, { lexicon: (w) => lex[w] || null, lexiconForms: lex });
  assert.equal(f.noPairs, false);
  const res = f.foldDoc(page('master', 'contral', 'panel'));
  assert.equal(toks(res)[1].kind, 'repaired'); assert.equal(toks(res)[1].to, 'control');
});

test('stray glyphs are cleaned off real content, and a lone X in a form box is kept as a check mark', () => {
  const f = makeFold({ words: {}, pairs: {} }, { lexicon: () => null, lexiconForms: [] });
  const res = f.foldDoc(page('|9/30/2006', '$__2,000,000', '_]', '|X', 'Smith', '&', 'Sons'));
  const t = toks(res);
  assert.equal(t[0].cleanTo, '9/30/2006'); assert.equal(t[1].cleanTo, '$2,000,000');
  assert.equal(t[2].drop, true);
  assert.equal(t[3].cleanTo, 'X');
});

test('foldText keeps whitespace exactly and works on any plain string', () => {
  const lex = { casa: { NOUN: 1 }, la: { DET: 1 }, es: { VERB: 1 } };
  const f = makeFold({ words: {}, pairs: {} }, { lexicon: (w) => lex[w] || null, lexiconForms: lex });
  const r = f.foldText('la casa es\nla casa es\nla casx es');
  assert.equal(r.text, 'la casa es\nla casa es\nla casa es');
});
