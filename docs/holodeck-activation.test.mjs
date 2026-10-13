// holodeck-activation.test.mjs — the §7 meaning-activation gate.
// Composed from the vendored organs; the identity index is REBUILT from the
// surface's OWN admitted cast (the reading's work, never re-derived here), so
// a referent the reading did not admit can never activate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexFromCast, activationRetrieval } from './holodeck-activation.js';

const rix = { cast: [{ id: 'bob', surfaces: ['Bob'] }, { id: 'carol', surfaces: ['Carol'] }] };
const IX = { chunks: [
  { ref: 'd#0-60', source: 'd', start: 0, end: 60, text: 'Bob mentored Carol for years.' },
  { ref: 'd#61-120', source: 'd', start: 61, end: 120, text: 'Carol later led the laboratory in Paris.' },
] };

test('§7 — a question about an admitted referent activates its sentences via the mention book', () => {
  const index = indexFromCast(rix);
  assert.ok(index, 'the engine identity index rebuilds from the cast');
  assert.ok(index.resolve('Bob').size >= 1, 'the admitted referent resolves');
  const r = activationRetrieval({ rix, IX, question: 'What did Bob do?' });
  assert.ok(r, 'the question resolves to an admitted referent');
  assert.equal(r.meta.basis, 'activation');
  assert.ok(r.passages.length >= 1);
  assert.ok(r.passages.some((p) => /Bob mentored/.test(p.text)), 'the referent\'s own sentence is activated');
});

test('FALSIFIER — a question resolving to no admitted referent yields null, so the term fallback stands disclosed', () => {
  const r = activationRetrieval({ rix, IX, question: 'Who invented the telephone?' });
  assert.equal(r, null);
});

test('§7 — seen refs are excluded (the same folded set the term retriever honours)', () => {
  const r = activationRetrieval({ rix, IX, question: 'What did Bob do?', seen: new Set(['d#0-29']) });
  assert.ok(r.passages.every((p) => p.ref !== 'd#0-29'));
});

test('a null or cast-less reading never activates (no phantom referents)', () => {
  assert.equal(activationRetrieval({ rix: null, IX, question: 'What did Bob do?' }), null);
  assert.equal(activationRetrieval({ rix: {}, IX, question: 'What did Bob do?' }), null);
});