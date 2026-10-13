// link-contracts.mjs — connect each contract to (1) the legislation that names its contracting party and (2) the
// contracts it replaces or is replaced by. Output: contract-links.json, read by the Holodeck's contract profile.
//
// Legislation. Nashville resolutions that approve a contract name the contracting party in the matter TITLE, not
// the contract number (searching Legistar by number finds nothing), so the hunt is by party name:
//   1. normalise the party (drop LLC/INC/CORP, split "A DBA B" into both names),
//   2. ask the public Legistar web API for matters whose title contains that phrase,
//   3. keep a matter only if it is a resolution or ordinance about a contract-like thing (contract, agreement,
//      lease, grant, amendment, MOU, ...) and its introduction date is not after the contract expired,
//   4. rank by closeness to the likely start of the term, keep the nearest few.
// Every link says which phrase matched and why it was kept. It is a match on a name: it is labelled as one.
//
// Replacement. Two contracts of the same party, department and subject, in successive terms, are linked
// predecessor -> successor. This is INFERRED (the source documents do not say "replaces"), and the link says so.
// Documents that share one contract number are one agreement or program, not a replacement chain.
//
// Read-only against Legistar. Polite delay, on-disk cache (resumable), no credentials.
//
// Usage: node tools/link-contracts.mjs [--seed nashville-contracts-seed.json] [--out contract-links.json]
//          [--delay 400] [--limit N] [--cache <dir>] [--no-legislation]

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).flatMap((a, i, arr) => (a.startsWith('--') ? [[a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : [])));
const abs = (p) => (String(p).startsWith('/') ? String(p) : join(ROOT, String(p)));
const seedPath = abs(args.seed || 'nashville-contracts-seed.json');
const outPath = abs(args.out || 'contract-links.json');
const delay = Number(args.delay || 400);
const limit = args.limit ? Number(args.limit) : Infinity;
const cacheDir = args.cache || join(tmpdir(), 'holodeck-legistar-cache');
mkdirSync(cacheDir, { recursive: true });
const API = 'https://webapi.legistar.com/v1/nashville/matters';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TOP = 40;                       // the number of matters asked for per party; reaching it means "too common"
const docs = JSON.parse(readFileSync(seedPath, 'utf8'));
const skippedCommon = [];
let GENERIC = new Set();              // boilerplate words in legislation titles; filled before the main loop
const DEPT_NAMES = new Set(docs.map((d) => String(d.dept || '').toUpperCase().replace(/[.,;:()"']/g, ' ').replace(/&/g, ' AND ').replace(/\s+/g, ' ').trim()).filter(Boolean));
const tokenOf = (d) => (/\/epav\/([A-Za-z0-9]+)\.pdf/.exec(d.pdfSrc || '') || [])[1] || String(d.id || '').replace(/^nash-/, '');

// ---- party names ----------------------------------------------------------------------------------------
const SUFFIX = new Set(['LLC', 'INC', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'LP', 'LLP', 'PLLC', 'PC', 'THE', 'OF', 'AND', 'DBA', 'D/B/A', 'FKA', 'AKA']);
const clean = (s) => String(s || '').toUpperCase().replace(/[.,;:()"']/g, ' ').replace(/&/g, ' AND ').replace(/\s+/g, ' ').trim();
function partyNames(vendor) {
  const v = clean(vendor);
  if (!v) return [];
  const parts = v.split(/\b(?:DBA|D\/B\/A|FKA|AKA)\b/).map((p) => p.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const toks = p.split(' ').filter((t) => !SUFFIX.has(t));
    const name = toks.join(' ').trim();
    // a name of one short token is too generic to search on (it would match half of Legistar)
    if (name.length >= 6 && (toks.length >= 2 || name.length >= 9)) out.push(name);
  }
  return [...new Set(out)];
}

// ---- legislation ----------------------------------------------------------------------------------------
async function legistarSearch(name) {
  const key = createHash('sha1').update(name).digest('hex').slice(0, 20);
  const f = join(cacheDir, key + '.json');
  if (existsSync(f)) { const c = JSON.parse(readFileSync(f, 'utf8')); return Array.isArray(c) ? { rows: c, capped: c.length >= TOP } : c; }
  const u = new URL(API);
  u.searchParams.set('$filter', `substringof('${name.replace(/'/g, "''")}',MatterTitle) eq true`);
  u.searchParams.set('$orderby', 'MatterIntroDate desc');
  u.searchParams.set('$top', String(TOP));
  let rows = null;
  for (let a = 0; a < 4 && !rows; a++) {
    try {
      const r = await fetch(u, { headers: { Accept: 'application/json', 'User-Agent': 'holodeck-contract-links/1.0 (public-records research)' }, signal: AbortSignal.timeout(30000) });
      if (r.ok) rows = await r.json(); else if (![429, 500, 502, 503, 504].includes(r.status)) rows = [];
    } catch (e) { /* retry */ }
    if (!rows) await sleep(1500 * (a + 1));
  }
  rows = (rows || []).map((m) => ({ id: m.MatterId, file: m.MatterFile, title: m.MatterTitle, type: m.MatterTypeName, status: m.MatterStatusName,
    intro: (m.MatterIntroDate || '').slice(0, 10), passed: (m.MatterPassedDate || '').slice(0, 10), guid: m.MatterGuid }));
  // the API's own result cap was hit: the phrase matches too many matters to say which one is this contract's
  const res = { rows, capped: rows.length >= TOP };
  writeFileSync(f, JSON.stringify(res));
  await sleep(delay);
  return res;
}
const CONTRACTISH = /\b(contract|agreement|lease|grant|amendment|memorandum of understanding|mou|license|sublease|easement|services|purchase|lessee|sponsorship)\b/i;
const yearOf = (s) => { const m = /(\d{4})\s*$/.exec(String(s || '')); return m ? +m[1] : null; };
const legUrl = (m) => `https://nashville.legistar.com/LegislationDetail.aspx?ID=${m.id}&GUID=${m.guid}`;

async function legislationFor(d) {
  // a party name that is really a department name is the department, not a vendor
  const names = partyNames(d.vendor).filter((n) => !DEPT_NAMES.has(n));
  if (!names.length) return [];
  const exp = yearOf(d.expires) || d.year || null;
  const found = new Map();
  // words of the contract's own description, minus boilerplate that most legislation titles contain
  const aboutWords = new Set([...words(d.about)].filter((w) => !GENERIC.has(w)));
  for (const n of names) {
    const res = await legistarSearch(n);
    if (res.capped) { skippedCommon.push(n); continue; }       // too common to attribute
    for (const m of res.rows) {
      if (!/resolution|ordinance/i.test(m.type || '')) continue;
      if (!CONTRACTISH.test(m.title || '')) continue;
      const iy = m.intro ? +m.intro.slice(0, 4) : null;
      if (exp && iy && iy > exp) continue;                       // introduced after the contract had expired
      const phrase = n.toLowerCase();
      if (!(m.title || '').toLowerCase().includes(phrase)) continue;
      const prev = found.get(m.id);
      // corroboration beyond the name: the title also speaks of this contract's own subject or department
      const tw = words(m.title);
      // the party's own name is the match, not corroboration of it: its words, its initials (MNAA), and
      // stems of its words ("metro" for "metropolitan")
      const vw = [...new Set([...words(n), ...words(d.vendor)])];
      const initials = clean(d.vendor).split(/[^A-Z0-9]+/).filter(Boolean).map((w) => w[0]).join('');
      const ofParty = (w) => w === initials || vw.some((p) => p === w || (w.length >= 4 && (p.startsWith(w) || w.startsWith(p))));
      const sharedAbout = [...aboutWords].filter((w) => tw.has(w) && !ofParty(w));
      const dept = clean(d.dept);
      const deptHit = dept && clean(m.title).includes(dept);
      const why = { phrase: n, timing: exp && iy ? `introduced ${iy}, contract expires ${exp}` : 'timing unknown', sharedAbout: sharedAbout.slice(0, 3), deptNamed: !!deptHit,
        strength: (sharedAbout.length || deptHit) ? 'corroborated' : 'name only' };
      if (!prev) found.set(m.id, { ...m, url: legUrl(m), why });
    }
  }
  // nearest to the likely start of the term (expiry minus a typical few years), then most recent
  const target = exp ? exp - 3 : null;
  return [...found.values()]
    .sort((a, b) => {
      const da = target && a.intro ? Math.abs(+a.intro.slice(0, 4) - target) : 99, db = target && b.intro ? Math.abs(+b.intro.slice(0, 4) - target) : 99;
      return da - db || String(b.intro).localeCompare(String(a.intro));
    })
    .sort((a, b) => (b.why.strength === 'corroborated') - (a.why.strength === 'corroborated'))   // stable: corroborated first
    .slice(0, 6)
    .map(({ id, guid, ...m }) => ({ ...m, matterId: id, basis: 'named',
      note: `Title names "${m.why.phrase}"` + (m.why.sharedAbout.length ? ` and mentions ${m.why.sharedAbout.join(', ').toLowerCase()}` : '') + (m.why.deptNamed ? ' and the department' : '') +
        `; ${m.why.timing}. ${m.why.strength === 'corroborated' ? 'Also matches this contract\'s subject or department.' : 'A match on the name alone — check it is the same agreement.'}` }));
}

// ---- replacement ----------------------------------------------------------------------------------------
const STOP = new Set(['SERVICES', 'SERVICE', 'AGREEMENT', 'AGMT', 'CONTRACT', 'THE', 'AND', 'FOR', 'OF', 'TO', 'IN', 'ON']);
const words = (s) => new Set(clean(s).split(/[^A-Z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
const expKey = (d) => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(d.expires || ''); return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : (d.year ? String(d.year) : ''); };
function replacementLinks() {
  const links = {};
  const add = (id, k, v) => { (links[id] = links[id] || { replaces: [], replacedBy: [] })[k].push(v); };
  const groups = new Map();
  for (const d of docs) {
    const v = clean(d.vendor); if (!v || !d.dept) continue;
    const key = v + '|' + d.dept;
    (groups.get(key) || groups.set(key, []).get(key)).push(d);
  }
  let chains = 0;
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    // one agreement or program repeated across documents is not a replacement chain
    const nums = new Set(g.map((d) => d.contractNo).filter(Boolean));
    if (nums.size < 2) continue;
    const ordered = g.filter((d) => expKey(d)).sort((a, b) => expKey(a).localeCompare(expKey(b)));
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1], cur = ordered[i];
      if (prev.contractNo === cur.contractNo) continue;
      const shared = [...words(prev.about)].filter((w) => words(cur.about).has(w));
      if (!shared.length && (prev.about || cur.about)) continue;       // different subject: a different contract, not a successor
      const basis = { basis: 'inferred', why: `Same party and department, successive terms${shared.length ? ', both about ' + shared.slice(0, 3).join(', ').toLowerCase() : ''}. The documents do not say "replaces"; this is inferred.` };
      add(cur.id, 'replaces', { id: prev.id, contractNo: prev.contractNo, title: prev.title, expires: prev.expires, ...basis });
      add(prev.id, 'replacedBy', { id: cur.id, contractNo: cur.contractNo, title: cur.title, expires: cur.expires, ...basis });
      chains++;
    }
  }
  return { links, pairs: chains };
}

// ---- run ------------------------------------------------------------------------------------------------
const out = { schema: 'ContractLinks@1', generatedAt: new Date().toISOString(), source: 'Nashville Legistar web API (public) and the seed',
  note: 'legislation links are matches on the contracting party\'s name; replacement links are inferred from successive terms.', links: {} };
const rep = replacementLinks();
for (const [id, v] of Object.entries(rep.links)) out.links[id] = { legislation: [], ...v };

let n = 0, withLeg = 0;
if (!args['no-legislation']) {
  // pass 1: search every party name (cached), so we know which words are boilerplate in legislation titles.
  // A word in more than half of all the matter titles retrieved is boilerplate by definition ("between",
  // "metropolitan", "government", "resolution"...) and cannot corroborate that a title is about THIS contract.
  for (const d of docs) for (const nm of partyNames(d.vendor)) if (!DEPT_NAMES.has(nm)) { const r = await legistarSearch(nm); if (r.capped) skippedCommon.push(nm); }
  {
    const titles = new Map();
    const { readdirSync } = await import('node:fs');
    for (const f of readdirSync(cacheDir)) { try { const c = JSON.parse(readFileSync(join(cacheDir, f), 'utf8')); for (const m of (Array.isArray(c) ? c : c.rows || [])) titles.set(m.id, m.title); } catch (e) { /* skip */ } }
    // boilerplate is measured among the titles a link can actually come from (contract-type ones), since
    // that is the pool a candidate title is compared within; the instrument words that admitted a title
    // ("lease", "agreement"...) are excluded outright, and so are words most contracts' own text contains.
    const pool = [...titles.values()].filter((t) => CONTRACTISH.test(t || ''));
    const df = new Map();
    for (const t of pool) for (const w of words(t)) df.set(w, (df.get(w) || 0) + 1);
    const adf = new Map();
    for (const d of docs) for (const w of words(d.about)) adf.set(w, (adf.get(w) || 0) + 1);
    const typeWords = words(CONTRACTISH.source.replace(/\\b|[()]/g, ' ').replace(/\|/g, ' '));
    GENERIC = new Set([...df].filter(([, c]) => c * 2 > pool.length).map(([w]) => w));
    for (const [w, c] of adf) if (c * 2 > docs.length) GENERIC.add(w);
    for (const w of typeWords) GENERIC.add(w);
    console.error(`  ${titles.size} distinct matter titles (${pool.length} contract-type); ${GENERIC.size} boilerplate words: ${[...GENERIC].slice(0, 40).join(', ').toLowerCase()}`);
  }
  for (const d of docs) {
    if (n >= limit) break;
    n++;
    const leg = await legislationFor(d);
    if (leg.length) { withLeg++; (out.links[d.id] = out.links[d.id] || { replaces: [], replacedBy: [] }).legislation = leg; }
    if (n % 25 === 0) console.error(`  ${n}/${Math.min(docs.length, limit)} contracts · ${withLeg} with legislation`);
  }
}
for (const l of Object.values(out.links)) { l.legislation = l.legislation || []; l.replaces = l.replaces || []; l.replacedBy = l.replacedBy || []; }
writeFileSync(outPath, JSON.stringify(out, null, 1));
const withRep = Object.values(out.links).filter((l) => l.replaces.length || l.replacedBy.length).length;
console.log(`contracts: ${docs.length} | searched: ${n} | with legislation: ${withLeg} | in a replacement chain: ${withRep} (${rep.pairs} links) -> ${outPath}`);
console.log(`names skipped as too common to attribute: ${[...new Set(skippedCommon)].length}${skippedCommon.length ? ' (e.g. ' + [...new Set(skippedCommon)].slice(0, 4).join(', ') + ')' : ''}`);
