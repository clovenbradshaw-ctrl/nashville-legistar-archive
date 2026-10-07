// reading-worker.js — module worker. Builds a compact index from an EO reading (.jsonl.zst).
// Strategy: first check if the repo already has a pre-built index.json beside the .zst; if so,
// fetch it directly (no decompression). Otherwise download + decompress in memory, index, and
// write only the compact index to OPFS — never the raw decompressed JSONL.
import { packIndex } from './idx-binary.js';
import { buildIndex } from './reading-index.js';
// The reading corpus is vendored beside the app (fixtures/reading/…), so the view no longer
// reaches a clovenbradshaw repo at runtime. Only the pre-built index and its cursor are vendored;
// the .zst path is the key the pre-built index sits beside, never fetched when the index is present.
// The main thread may pass an absolute `url` (localStorage hd:reading) to point at another source.
const SRC_URL = new URL('fixtures/reading/f3affd2e11370118-causalTextPerceiver_reviseTextFold_refresh25.jsonl.zst', self.location.href).href;
async function dirOf(path) { let d = await navigator.storage.getDirectory(); for (const p of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(p, { create: true }); return d; }
// Write the index as JSON (the historical fallback) and as a binary FRIX file so the
// fold's open path is one arrayBuffer(), no JSON.parse. The .bin is the fast path.
async function writeIndex(dir, out, obj) {
  const fh = await dir.getFileHandle(out, { create: true }); const w = await fh.createWritable(); await w.write(JSON.stringify(obj)); await w.close();
  try {
    const bh = await dir.getFileHandle(out.replace(/\.json$/, '.idx.bin'), { create: true });
    const bw = await bh.createWritable(); await bw.write(packIndex(obj)); await bw.close();
  } catch (e) { console.warn('[reading-worker] binary index write failed:', e); }
}
// zstd frame header → declared content size (null if the frame doesn't declare one).
function frameSize(b) { if (b[0] !== 0x28 || b[1] !== 0xB5 || b[2] !== 0x2F || b[3] !== 0xFD) throw new Error('not a zstd frame');
  const fhd = b[4], fcs = fhd >> 6, single = (fhd >> 5) & 1, did = [0, 1, 2, 4][fhd & 3]; let o = 5 + (single ? 0 : 1) + did;
  const n = fcs === 0 ? (single ? 1 : 0) : [0, 2, 4, 8][fcs]; if (!n) return null; let v = 0; for (let i = n - 1; i >= 0; i--) v = v * 256 + b[o + i]; return n === 2 ? v + 256 : v; }
self.onmessage = async e => {
  try {
    const { url = SRC_URL, out = 'reading-refresh25.index.json' } = e.data || {};
    const t0 = Date.now();
    // 1. Check for a pre-built index in the repo (no download or decompression needed).
    const prebuiltUrl = url.replace(/\.zst$/, '.index.json');
    postMessage({ stage: 'checking' });
    const prebuilt = await fetch(prebuiltUrl).then(r => r.ok ? r.json() : null).catch(() => null);
    if (prebuilt && prebuilt.schema === 'FoldReadingIndex@2') {
      const dir = await dirOf('ohs-custody');
      await writeIndex(dir, out, prebuilt);
      postMessage({ done: true, index: { lines: prebuilt.lines, bad: prebuilt.bad, encounters: prebuilt.encounters, sources: Object.keys(prebuilt.sources || {}).length, cast: prebuilt.castTotal, bonds: prebuilt.bondsTotal, canon: prebuilt.canonTotal, identities: prebuilt.identitiesTotal, ms: Date.now() - t0, from: 'repo-prebuilt', topCast: (prebuilt.cast || []).slice(0, 12).map(c => c.surfaces[0] + ' (' + c.mentions + ', ' + c.srcN + ' sources, ' + c.standing + ')'), topBonds: (prebuilt.bonds || []).slice(0, 10).map(b => b.a + ' — ' + b.b + ' ×' + b.n + ' in ' + b.srcN), churn: (prebuilt.identities || []).slice(0, 8).map(i => i.left + ' ↔ ' + i.right + ' ×' + i.n + ' ' + JSON.stringify(i.events)) } });
      return;
    }
    // 2. No pre-built index: download + decompress in memory, index, write only the compact index.
    postMessage({ stage: 'downloading' });
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
    postMessage({ stage: 'decompressing', mb: Math.round(buf.length / 1e6) });
    const M = await import('https://esm.sh/@bokuweb/zstd-wasm@0.0.27'); await M.init(); const raw = M.decompress(buf);
    const want = frameSize(buf); if (want !== null && raw.length !== want) throw new Error('decoder produced ' + raw.length + ' bytes; the zstd frame declares ' + want + '. Refusing a silent mis-decode.');
    if (raw.length < 1000 || raw[0] !== 123) throw new Error('decoder produced ' + raw.length + ' bytes that are not JSON lines');
    postMessage({ stage: 'indexing', pct: 0 });
    const lines = new TextDecoder().decode(raw).split('\n');
    const cur2 = await fetch(url.replace(/\.zst$/, '.cursor')).then(r => r.ok ? r.json() : null).catch(() => null);
    const index = buildIndex(lines, url, cur2, t0);
    if (cur2 && cur2.sequence && cur2.sequence !== index.encounters) throw new Error('Decoded ' + index.encounters + ' encounters; the reading’s cursor records ' + cur2.sequence + '.');
    const dir = await dirOf('ohs-custody'); await writeIndex(dir, out, index);
    postMessage({ done: true, index: { lines: index.lines, bad: index.bad, encounters: index.encounters, sources: Object.keys(index.sources || {}).length, cast: index.castTotal, bonds: index.bondsTotal, canon: index.canonTotal, identities: index.identitiesTotal, ms: index.ms, topCast: index.cast.slice(0, 12).map(c => c.surfaces[0] + ' (' + c.mentions + ', ' + c.srcN + ' sources, ' + c.standing + ')'), topBonds: index.bonds.slice(0, 10).map(b => b.a + ' — ' + b.b + ' ×' + b.n + ' in ' + b.srcN), churn: index.identities.slice(0, 8).map(i => i.left + ' ↔ ' + i.right + ' ×' + i.n + ' ' + JSON.stringify(i.events)) } });
  } catch (err) { postMessage({ err: String(err && err.message || err) }); }
};
