import test from 'node:test';
import assert from 'node:assert/strict';
import * as FOLD from './vendor/the-fold/fold.js';
import { indexOfCast, transcriptOf, carryOf, mechanicalRefresh } from './holodeck-carry.js';

const rix = { cast: [
  { id: 'c1', surfaces: ['Ada Lovelace', 'Lovelace'], mentions: 9 },
  { id: 'c2', surfaces: ['Alan Turing'], mentions: 7 },
  { id: 'c3', surfaces: ['李白'], mentions: 3 },
  { id: 'c4', surfaces: ['God'], mentions: 50 },
] };

test('identity is the cast\'s: surfaces resolve by diacritic/case fold on word boundaries, in any script', () => {
  const ix = indexOfCast(rix);
  assert.deepEqual([...ix.resolveIn('what did ada lovelace write?')], ['c1']);
  assert.deepEqual([...ix.resolveIn('谁是李白')], ['c3']);
  assert.deepEqual([...ix.resolveIn('the Lovelaces were rich')], [], 'a longer word is not the surface');
  assert.deepEqual([...ix.resolveIn('god help us')], [], 'a function-word-short surface never resolves');
  assert.equal(ix.represent('c1'), 'Ada Lovelace');
});

test('the transcript is the history pairs plus the turn in hand', () => {
  const t = transcriptOf([{ role: 'user', content: 'q1' }, { role: 'assistant', content: 'a1' }], { question: 'q2', answer: 'a2', used: ['x.txt#0-9'] });
  assert.equal(t.length, 2); assert.deepEqual(t[1].refs, ['x.txt#0-9']);
});

test('carryOf: where the conversation stands, struck of addresses; turns on a new subject', () => {
  const history = [{ role: 'user', content: 'Who is Ada Lovelace?' }, { role: 'assistant', content: 'Ada Lovelace wrote notes.' }];
  const c = carryOf({ rix, history, question: 'Who is Alan Turing?', answer: 'Alan Turing studied computation.' });
  assert.match(c.text, /turned there/);
  assert.ok(!/\[turn:/.test(c.text)); assert.ok(c.lines.some((l) => /\[turn:/.test(l)));
  assert.ok(c.entities.includes('Alan Turing') && c.entities.includes('Ada Lovelace'));
});

test('mechanicalRefresh: no model, Flow is the Atmosphere, Entities are the cast, and the turn advances', () => {
  let summary = FOLD.emptySummary();
  const history = [];
  const q = 'Who is Ada Lovelace and what did she write about the engine?', a = 'Ada Lovelace wrote notes on the Analytical Engine.';
  const foldLine = FOLD.mechanicalFoldLine(q, a);
  const withRecord = FOLD.addWarrantRecord(summary, FOLD.buildWarrantRecord({ turn: 1, plane: 'world', gist: foldLine, channels: ['material'], refs: [], unsupported: [], open: [] }));
  const r = mechanicalRefresh({ FOLD, from: withRecord, foldLine, rix, history, question: q, answer: a });
  assert.equal(r.refresh.ok, true); assert.equal(r.refresh.mechanical, true);
  assert.equal(r.summary.turnCount, 1);
  assert.match(r.summary.flow, /stood on Ada Lovelace/);
  assert.deepEqual(r.summary.entities, ['Ada Lovelace']);
  assert.match(r.summary.topic, /Ada Lovelace/);
});

test('nothing resolving leaves the summary as advanceSummaryFold gives it, and says why (so the model path can run)', () => {
  const from = FOLD.emptySummary();
  const r = mechanicalRefresh({ FOLD, from, foldLine: 'f', rix: { cast: [] }, history: [], question: 'hi', answer: 'hello' });
  assert.equal(r.refresh.ok, false); assert.match(r.refresh.why, /no cast/);
  assert.equal(r.summary.turnCount, 1);
});
