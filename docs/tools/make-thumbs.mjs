// make-thumbs.mjs — first-page JPEG thumbnails for every PDF source in a seed
// file, so the Sources grid can show the real page instead of extracted text.
//
// Each PDF is pulled through the Holodeck server's own /epav/<token>.pdf route
// (archive.org twin first, else ePAV), page 1 is rendered with poppler's
// pdftoppm, and the JPEG lands in thumbs/<token>.jpg. Idempotent: a token that
// already has a thumbnail is skipped, so re-runs only fill gaps. The PDF itself
// is never kept — only the ~15–40 KB image.
//
// Usage: node tools/make-thumbs.mjs [--seed nashville-contracts-seed.json]
//          [--base http://127.0.0.1:8872] [--out thumbs] [--width 360]
//          [--workers 4] [--limit N] [--tmp <dir>]

import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).flatMap((a, i, arr) => (a.startsWith('--') ? [[a.slice(2), arr[i + 1]]] : [])));
const seed = join(ROOT, args.seed || 'nashville-contracts-seed.json');
const base = (args.base || 'http://127.0.0.1:8872').replace(/\/$/, '');
const out = join(ROOT, args.out || 'thumbs');
const width = Number(args.width || 360);
const workers = Number(args.workers || 4);
const limit = args.limit ? Number(args.limit) : Infinity;
const tmp = args.tmp || tmpdir();

mkdirSync(out, { recursive: true });
mkdirSync(tmp, { recursive: true });

const tokenOf = (d) => (/\/epav\/([A-Za-z0-9]+)\.pdf/.exec(d.pdfSrc || '') || [])[1] || String(d.id || '').replace(/^nash-/, '');
const docs = JSON.parse(readFileSync(seed, 'utf8')).filter((d) => d.pdfSrc || /^nash-/.test(d.id || ''));
const todo = [...new Set(docs.map(tokenOf))].filter((t) => t && !existsSync(join(out, t + '.jpg'))).slice(0, limit);
console.log(`${docs.length} pdf sources · ${todo.length} need a thumbnail · base ${base} · ${workers} workers`);

const failed = [];
let done = 0, bytes = 0;

async function one(tok) {
  const pdf = join(tmp, `thumb-${tok}.pdf`), stem = join(tmp, `thumb-${tok}`);
  try {
    // upstreams (archive.org, ePAV) 5xx under load: retry with backoff before giving up
    let buf = null, lastErr = null;
    for (let attempt = 0; attempt < 4 && !buf; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 60000);
      try {
        // default: the same order the Holodeck server uses — archive.org twin first, then ePAV —
        // fetched directly so a stopped dev server can't stall the batch. --base routes via a server instead.
        const urls = args.base ? [`${base}/epav/${tok}.pdf`] : [
          `https://archive.org/download/nashville-epav-contract-${tok}/${tok}.pdf`,
          `http://documents.nashville.gov/Request/Open/${tok}?source=Contracts&sourceAppId=14&isArchived=True`,
        ];
        for (const u of urls) {
          try {
            const r = await fetch(u, { signal: ctl.signal, headers: { 'User-Agent': UA } });
            if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
            const b = Buffer.from(await r.arrayBuffer());
            if (b.slice(0, 5).toString() === '%PDF-') { buf = b; break; }
            lastErr = new Error('not a PDF');
          } catch (e) { lastErr = e; }
        }
      } finally { clearTimeout(t); }
    }
    if (!buf) throw lastErr || new Error('fetch failed');
    if (buf.slice(0, 5).toString() !== '%PDF-') throw new Error('not a PDF');
    writeFileSync(pdf, buf);
    await run('pdftoppm', ['-jpeg', '-jpegopt', 'quality=70', '-f', '1', '-l', '1', '-scale-to-x', String(width), '-scale-to-y', '-1', '-singlefile', pdf, stem], { timeout: 60000 });
    const jpg = stem + '.jpg';
    bytes += statSync(jpg).size;
    renameSync(jpg, join(out, tok + '.jpg'));
  } catch (e) {
    failed.push(`${tok}\t${String(e.message || e).split('\n')[0].slice(0, 120)}`);
  } finally {
    rmSync(pdf, { force: true });
    rmSync(stem + '.jpg', { force: true });
    done++;
    if (done % 25 === 0 || done === todo.length) console.log(`  ${done}/${todo.length} · ${failed.length} failed · ${(bytes / 1024).toFixed(0)} KB written`);
  }
}

let next = 0;
await Promise.all(Array.from({ length: Math.min(workers, todo.length) }, async () => {
  while (next < todo.length) await one(todo[next++]);
}));

if (failed.length) writeFileSync(join(out, '_failed.tsv'), failed.join('\n') + '\n');
console.log(`done: ${todo.length - failed.length} written, ${failed.length} failed${failed.length ? ' (see ' + join(args.out || 'thumbs', '_failed.tsv') + ')' : ''}`);
