// build-epav-ocr.mjs — OCR every Metro Nashville ePAV contract PDF into a
// per-contract overlay record the reader can paint ON TOP of the rendered page.
//
// These contracts are scans: the PDF has no text layer, so "the PDF with the
// text on top of it" needs OCR with word boxes. Each contract becomes
// ocr/<token>.json in the schema the reader's overlay already expects:
//
//   [ { page, width, height, text, elements: [ { text, start, region:[l,t,w,h], conf } ] } ]
//
// ocr/<token>.json is served same-origin (tools/serve.mjs) and the reader
// fetches it per contract, draws the page image, then paints the OCR words at
// their real positions on top.
//
// Resumable: a token with an existing output is skipped. Parallelism across
// contracts with --workers; a contract's pages run sequentially.
//
// Usage:
//   node tools/build-epav-ocr.mjs [--seed nashville-contracts-seed.json] [--outdir ocr] [--dpi 200] [--workers 4] [--limit N] [--token <one>]

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).flatMap((a) => (a.startsWith('--') ? [[a.slice(2), process.argv[process.argv.indexOf(a) + 1]]] : [])));
const seed = args.seed || join(ROOT, 'nashville-contracts-seed.json');
const outdir = args.outdir || join(ROOT, 'ocr');
const dpi = parseInt(args.dpi || '200', 10);
const workers = parseInt(args.workers || '4', 10);
const limit = args.limit ? parseInt(args.limit, 10) : null;
const single = args.token || null;
const EPAV = 'http://documents.nashville.gov/Request/Open/';
const EPAV_QUERY = '?source=Contracts&sourceAppId=14&isArchived=True';

mkdirSync(outdir, { recursive: true });

const tokens = (single ? [single] : JSON.parse(readFileSync(seed, 'utf8')).map((x) => x.id.replace(/^nash-/, '')))
  .filter((t) => /^[A-Za-z0-9]+$/.test(t));
const todo = tokens.filter((t) => !existsSync(join(outdir, t + '.json')));
if (limit) todo.length = Math.min(todo.length, limit);
console.log('tokens', tokens.length, '· to build', todo.length, '· out', outdir, '· dpi', dpi, '· workers', workers);

const run = (cmd, args2, input) => new Promise((res, rej) => {
  const c = spawn(cmd, args2, { stdio: input ? ['pipe', 'pipe', 'inherit'] : ['ignore', 'pipe', 'inherit'] });
  const out = [];
  c.stdout.on('data', (b) => out.push(b));
  c.on('error', rej);
  c.on('close', (code) => (code === 0 ? res(Buffer.concat(out)) : rej(new Error(cmd + ' exit ' + code))));
  if (input) c.stdin.end(input);
});

// PNG width/height straight from the IHDR (bytes 16-24 of the file).
function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const isWordRow = (r) => r.length >= 12 && r[0] === '5' && (r[11] || '').trim() !== '';

async function ocrContract(token) {
  const r = await fetch(EPAV + token + EPAV_QUERY);
  if (!r.ok) throw new Error('ePAV ' + r.status);
  const pdf = Buffer.from(await r.arrayBuffer());

  mkdirSync(join(outdir, '.build-' + token), { recursive: true });
  await run('pdftoppm', ['-png', '-r', String(dpi), '-', join(outdir, '.build-' + token, 'p')], pdf);

  const { readdirSync } = await import('node:fs');
  const pages = readdirSync(join(outdir, '.build-' + token))
  const recs = [];
  for (const f of pages) {
    const pageNo = +(/p-(\d+)/.exec(f)[1]);
    const img = readFileSync(join(outdir, '.build-' + token, f));
    const { w, h } = pngSize(img);
    await run('tesseract', [join(outdir, '.build-' + token, f), join(outdir, '.build-' + token, 't' + pageNo), 'tsv']);
    const tsv = readFileSync(join(outdir, '.build-' + token, 't' + pageNo + '.tsv'), 'utf8');
    const elements = [];
    const words = [];
    const rows = tsv.split('\n').map((l) => l.split('\t'));
    for (const row of rows) {
      if (!isWordRow(row)) continue;
      const conf = parseFloat(row[10]);
      if (!(conf >= 40)) continue;
      const text = row[11].trim();
      if (!text) continue;
      const e = { text, region: [parseInt(row[6], 10), parseInt(row[7], 10), parseInt(row[8], 10), parseInt(row[9], 10)], conf };
      elements.push(e);
      words.push(text);
    }
    const text = words.join(' ');
    let st = 0;
    for (const e of elements) { e.start = st; st += e.text.length + 1; }
    recs.push({ page: pageNo, width: w, height: h, text, elements });
  }
  rmSync(join(outdir, '.build-' + token), { recursive: true, force: true });
  const tmp = join(outdir, token + '.json.tmp');
  writeFileSync(tmp, JSON.stringify(recs));
  writeFileSync(join(outdir, token + '.json'), JSON.stringify(recs));
  rmSync(tmp, { force: true });
  return { token, pages: recs.length, chars: recs.reduce((n, r) => n + r.text.length, 0) };
}

let done = 0, failed = 0;
const start = Date.now();
async function pool() {
  let i = 0;
  const work = async () => {
    while (i < todo.length) {
      const t = todo[i++];
      const t0 = Date.now();
      try { const r = await ocrContract(t); done++; const rate = Math.round(todo.length * (Date.now() - start) / 60000 / Math.max(1, done)); console.log(`OK  ${t}  ${r.pages}p ${r.chars}c ${Math.round((Date.now() - t0) / 1000)}s  (${done}/${todo.length}, ~${rate}m left)`); }
      catch (e) { failed++; console.log(`ERR ${t} :: ${e.message}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(workers, todo.length) }, work));
}
await pool();
console.log(`done: ${done} ok, ${failed} failed, ${(Date.now() - start) / 60000} min`);