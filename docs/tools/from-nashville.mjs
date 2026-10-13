// from-nashville.mjs — the first corpus adapter. Normalizes Metro Nashville
// ePAV contract records into the generic items.json shape, so pack-corpus.mjs
// stays corpus-agnostic. Impressions come from the repo's deterministic
// contract-ledger.jsonl; identity/pointers from epav-fetched.jsonl.
//
// Usage: node tools/from-nashville.mjs [--repo <path>] [--out items.json]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).flatMap((a, i, arr) => (a.startsWith('--') ? [[a.slice(2), arr[i + 1]]] : [])));
const repo = args.repo || '/Users/mlacy/Documents/3.0/nashville-legistar-archive';
const out = args.out || 'items.json';
const data = join(repo, 'data');

const readJsonl = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

const meta = new Map();
for (const r of readJsonl(join(data, 'epav-fetched.jsonl'))) meta.set(r.epav_token, r);

const rows = new Map();
for (const r of readJsonl(join(data, 'contract-ledger.jsonl'))) {
  const t = r.epav_token;
  if (!t) continue;
  (rows.get(t) || rows.set(t, []).get(t)).push(r);
}

const items = [];
for (const [tok, rs] of rows) {
  rs.sort((a, b) => a.at[0] - b.at[0]);
  const parts = [];
  let lastEnd = -1;
  for (const r of rs) {
    const [a, b] = r.at;
    if (a < lastEnd && b <= lastEnd) continue;
    parts.push(r.verbatim);
    lastEnd = Math.max(lastEnd, b);
  }
  const m = meta.get(tok) || {};
  const pointer = { resolver: 'epav', id: tok, url: m.epav_url || `http://documents.nashville.gov/Request/Document/${tok}` };
  if (m.archive_url) pointer.archive = m.archive_url;
  items.push({
    id: 'nash-' + tok,
    title: `${m.contract_number || tok} — ${m.contracting_party || ''}`.trim().replace(/[—-]\s*$/, ''),
    type: 'Contract',
    pointer,
    tags: { department: m.department || null, contract_number: m.contract_number || null, destroyed: !!m.destroyed_per_retention_schedule },
    text: parts.join('\n'),
  });
}

writeFileSync(out, JSON.stringify(items));
console.log(`normalized ${items.length} contracts -> ${out}`);
