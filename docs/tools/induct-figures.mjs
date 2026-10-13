// induct-figures.mjs — induce the KINDS with the upgraded scores-patch kernel.
//
// The hand-rolled document-frequency clustering is replaced by the vendored
// eoreader7 kind-induction engine (Kanada's atomist induction: a kind is induced
// from what its instances share, nothing declared in advance). Every contract is
// an entity; every key it carries is a structural feature; the kernel induces the
// kinds and reports its diagnostics.
//
// Usage: node tools/induct-figures.mjs [--dir figures]

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kindEvidence, createKindInductionIndex, kindCandidates, kindDiagnostics } from '../vendor/eoreader7/native/kernel/kind-induction.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).flatMap(a => a.startsWith('--') ? [[a.slice(2), process.argv[process.argv.indexOf(a) + 1]]] : []));
const dir = args.dir || join(ROOT, 'figures');

const norm = k => String(k).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const files = readdirSync(dir).filter(f => /\.json$/.test(f) && !f.startsWith('_'));
const docs = files.map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')));

const keysOf = d => { const s = new Set(); d.sections.forEach(sec => sec.keys.forEach(k => { s.add(norm(k.key)); k.children.forEach(c => s.add(norm(c.key))); })); return s; };

// Each contract is an entity; each key it carries is a structural feature.
// sequencePosition is required by the kernel (it orders evidence per entity).
const entries = [];
for (const d of docs) { let seq = 0; for (const k of keysOf(d)) { if (!k) continue; entries.push(kindEvidence({ id: d.id + '|' + k, entityRef: d.id, evidenceType: 'structural_feature', featureKey: 'key', featureValue: k, sequencePosition: seq++, witnessRefs: [d.id] })); } }

const index = createKindInductionIndex(entries, { minMembers: 3 });
const candidates = kindCandidates(index);
const diag = kindDiagnostics(index);

// feature document-frequency, to name/interpret the induced kinds
const df = new Map(); for (const d of docs) for (const k of keysOf(d)) df.set(k, (df.get(k) || 0) + 1);

// A human label per kind: its most distinctive shared feature (or the common template).
const labelOf = c => { const p = (c.distinguishingParameters || [])[0]; return p ? p.featureValue : (c.memberCount > docs.length * 0.3 ? 'the common template' : 'unlabelled kind'); };
const perDoc = {};
for (const c of candidates) for (const ref of (c.memberRefs || [])) perDoc[ref] = { kind: c.kindKey, label: labelOf(c), n: c.memberCount };

const out = { documents: docs.length, evidence: entries.length, diagnostics: diag, kinds: candidates.map(c => ({ ...c, label: labelOf(c) })), perDoc };
writeFileSync(join(dir, '_kinds.json'), JSON.stringify(out, null, 1));

console.log('documents', docs.length, '· evidence entries', entries.length);
console.log('kernel diagnostics:', JSON.stringify({ entities: diag.populationKinds && diag.populationKinds.entities, parameters: diag.populationKinds && diag.populationKinds.parameters, validated: diag.populationKinds && diag.populationKinds.validated }));
console.log('\nInduced kinds (scores-patch kernel):', candidates.length);
candidates.slice(0, 20).forEach((c, i) => console.log(`  ${String(i + 1).padStart(2)}. ${String(c.memberCount).padStart(3)} docs · "${labelOf(c)}" · cohesion ${(c.cohesion || 0).toFixed(2)}`));
