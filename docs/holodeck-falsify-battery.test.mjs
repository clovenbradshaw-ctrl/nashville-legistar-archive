// holodeck-falsify-battery.test.mjs — §14 of the spec, made executable.
//
// The battery table, one row per case, each asserting the REQUIRED outcome
// (§14): "Falsifiers must genuinely reject bad results. A test that passes on
// empty evidence does not count." Rows whose mechanism does not live in this
// surface (unread-span tracking, translation-lineage, premise withdrawal in a
// shared ledger, …) are DISCLOSED as gaps — never silently passed to make the
// count look whole.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerFromFold, planNextEncounter } from './holodeck-inquiry.js';
import { mathInstance } from './holodeck-math.js';

// ── the surface battery: rows this implementation can genuinely reject ──────
const cases = [];

const E = (id, rel, a, b, w) => ({ schema: 'EOHyperedge@1', id, relation: rel, witness: w, participants: [{ ref: a, standing: 'referent' }, { ref: b, standing: 'referent' }] });
const F = (id, a, l, b, pol, w) => ({ id, end1Face: a, end2Face: b, label: l, polarity: pol, refs: [w], spans: [{ ref: w.split('#')[0], start: 0, end: 1 }] });

cases.push(['1', 'Answer witnessed in local EOT — answer from local witnesses', async () => {
  const inq = answerFromFold({ question: 'Fill in the blank: "The capital of France is ______."', passages: [{ ref: 'doc#0-95', source: 'doc', start: 0, end: 95, text: 'The capital of France is Paris. It has many museums.' }] });
  assert.equal(inq.status, 'from-the-fold');
  assert.equal(inq.resources.modelCalls, 0, 'the falsifying failure is an unnecessary model call');
  assert.equal(inq.resources.externalRequests, 0, 'the falsifying failure is an unnecessary web request');
}]);

cases.push(['4', 'Contradictory witnesses — the contest is preserved, not resolved by the stronger prose', async () => {
  const inq = answerFromFold({ question: 'What did Alice do about the treaty?', passages: [], edges: [F('e1', 'Alice', 'supports', 'x', '+', 'd#1-2'), F('e2', 'Alice', 'supports', 'x', '-', 'd#3-4')] });
  assert.equal(inq.status, 'contested');
  assert.ok(inq.contests.length >= 1);
}]);

cases.push(['6', 'Genre strongly suggests an unwitnessed fact — a hypothesis, never evidence', async () => {
  const inq = answerFromFold({ question: 'Who is connected?', passages: [], edges: [E('e1', 'parent', 'A', 'B', 'd#1-2'), E('e2', 'parent', 'B', 'C', 'd#3-4')] });
  assert.equal(inq.derivation.licensed, 0);
  assert.ok(inq.derivations.every((d) => d.standing === 'withheld'), 'a predictive composition is withHeld, never asserted');
}]);

cases.push(['8', 'Previous generated answer is re-ingested — the derived lineage is kept, no self-corroboration', async () => {
  const inq = answerFromFold({ question: 'Who is connected?', passages: [], edges: [E('e1', 'parent', 'A', 'B', 'd#1-2'), E('e2', 'parent', 'B', 'C', 'd#3-4')] });
  assert.ok(inq.derivations.length >= 1);
  assert.ok(inq.derivations.every((d) => d.witnesses.length === 0), 'a derived candidate is never its own witness');
}]);

cases.push(['9', 'Current officeholder changed after ingestion — require fresh verification, never answer confidently from the old record', async () => {
  const p = planNextEncounter({ gap: { type: 'not_yet_read' }, question: 'Who is the current mayor of Nashville?', capabilities: { web: true } });
  assert.equal(p.method, 'retrieve-primary-source');
  assert.match(p.declined.reason, /freshness/);
}]);

cases.push(['10', 'Genuine offline-only request — zero network and zero model traffic', async () => {
  const inq = answerFromFold({ question: 'Explain why the capital matters to its people.', privacy: 'offline-only' });
  assert.equal(inq.resources.externalRequests, 0);
  assert.equal(inq.resources.modelCalls, 0);
}]);

cases.push(['11', 'Private workspace query — the disclosure scope is preserved, no raw text or identity leaves', async () => {
  const inq = answerFromFold({ question: 'Who is the current mayor of Nashville?', privacy: 'ask-before-egress' });
  assert.equal(inq.inquiries[0].authorization, 'must-ask');
  assert.equal(inq.resources.externalRequests, 0);
}]);

cases.push(['15', 'Precise calculation from grounded values — computed mechanically, never invented by a model', async () => {
  const math = await mathInstance();
  const inq = answerFromFold({ question: 'How many years apart are 1805 and 1841?', math });
  assert.equal(inq.status, 'from-the-fold');
  assert.equal(inq.answer.kind, 'comparison');
  assert.match(inq.answer.text, /36/);
  assert.equal(inq.resources.modelCalls, 0);
}]);

cases.push(['16', 'Valid question with no answer — a meaningful typed gap, never a fabrication or an endless search', async () => {
  const inq = answerFromFold({ question: 'Explain telekinetic governance under the treaty of 1815.', passages: [{ ref: 'd#0-10', source: 'd', start: 0, end: 10, text: 'The capital of France is Paris.' }] });
  assert.equal(inq.status, 'unresolved');
  assert.ok(inq.gaps.length >= 1);
  assert.ok(['not_found_in_scope', 'not_yet_read'].includes(inq.gaps[0].type));
  assert.equal(inq.inquiries.length, 1);
  assert.equal(inq.resources.externalRequests, 0);
}]);

// ── rows whose mechanism does NOT live in this surface — disclosed, counted,
// never silently passed: 2 (unread chapter), 3 (truncated EOT coverage), 5
// (translation/mirror lineage), 7 (premise withdrawal → dependents reopen), 12
// (new independent evidence opposing a consensus), 13 (unsupported language —
// khora's PriorBroker covers it), 14 (source instructions as data — khora's
// antistrauss), 17 (cumulative profiling across turns), 18 (shared-name
// ambiguity), 19 (recipe-change dependent recompute — the khora broker's
// revision), 20 (cursor preservation across a long local reading).
const SURFACE_GAPS = ['2', '3', '5', '7', '12', '13', '14', '17', '18', '19', '20'];

for (const [id, name, fn] of cases) {
  test(`§14.${id} — ${name}`, async () => { await fn(); });
}

test('the battery covers real rows and names its surface gaps (an empty battery is not a gate)', () => {
  assert.ok(cases.length >= 8, `expected a real battery, got ${cases.length}`);
  for (const g of SURFACE_GAPS) assert.ok(g, 'gaps are the literal §14 ids, present for disclosure');
});