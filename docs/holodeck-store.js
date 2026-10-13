// holodeck-store.js — the two-tier corpus store AND the append-only search index.
//
// Packed corpus (tools/pack-corpus.mjs): hot.json (resident) + impressions.bin (OPFS).
// Append-only index (tools/build-index.mjs -> tools/fold-index.mjs):
//   index.log.jsonl   source of truth (doc/chunk/vector/tombstone records)
//   vectors.f16       fp16 rows
//   current.json      the fold the surface loads (chunks + spans + row refs)
//
// Embeddings are a PROPOSER only: a hit is a span to confirm by reading.

const DB = 'holodeck-store';

async function opfsDir(path, create = true) {
  const root = await navigator.storage.getDirectory();
  let d = root;
  for (const p of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(p, { create });
  return d;
}
async function opfsFile(path, create) {
  const parts = path.split('/');
  const name = parts.pop();
  const d = await opfsDir(parts.join('/'), create);
  return d.getFileHandle(name, { create });
}
async function opfsHas(path) { try { await opfsFile(path, false); return true; } catch { return false; } }
async function opfsWrite(path, buf) {
  const fh = await opfsFile(path, true);
  const w = await fh.createWritable();
  await w.write(buf);
  await w.close();
}
async function opfsSlice(path, start, end) {
  const fh = await opfsFile(path, false);
  const f = await fh.getFile();
  return new Uint8Array(await f.slice(start, end).arrayBuffer());
}

function norm(v) { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; const o = new Float32Array(v.length); for (let i = 0; i < v.length; i++) o[i] = v[i] / s; return o; }
function halfToF32(buf, count) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const h = dv.getUint16(i * 2, true);
    const sign = (h & 0x8000) ? -1 : 1, exp = (h >> 10) & 0x1f, mant = h & 0x3ff;
    let v;
    if (exp === 0) v = mant * Math.pow(2, -24);
    else if (exp === 31) v = mant ? NaN : Infinity;
    else v = (1 + mant / 1024) * Math.pow(2, exp - 15);
    out[i] = sign * v;
  }
  return out;
}

export async function openStore({ base = '', corpus = 'nashville', fetchImpl = fetch } = {}) {
  const dir = `${base}/store/${corpus}`;
  const hot = await (await fetchImpl(`${dir}/hot.json`)).json();
  const coldPath = `${DB}/${corpus}/${hot.cold.file}`;
  if (!(await opfsHas(coldPath))) await opfsWrite(coldPath, await (await fetchImpl(`${dir}/${hot.cold.file}`)).arrayBuffer());

  const byId = new Map(hot.items.map((it) => [it.id, it]));
  const dec = new TextDecoder();

  // append-only search index fold (optional)
  let fold = null, idxVec = null, rowMeta = [];
  try {
    fold = await (await fetchImpl(`${dir}/current.json`)).json();
    const vb = new Uint8Array(await (await fetchImpl(`${dir}/${fold.vector.file}`)).arrayBuffer());
    idxVec = halfToF32(vb, fold.vector.rows * fold.dim);
    rowMeta = new Array(fold.vector.rows);
    for (const it of fold.items) for (const c of it.chunks) if (c && c.row != null) rowMeta[c.row] = { id: it.id, title: it.title, span: c.off };
  } catch { /* no index fold yet */ }

  return {
    corpus, hot,
    count: () => hot.items.length,
    item: (id) => byId.get(id) || null,
    ids: () => hot.items.map((it) => it.id),
    hasIndex: () => !!idxVec,

    async impression(id) {
      const it = byId.get(id);
      if (!it) return null;
      return dec.decode(await opfsSlice(coldPath, it.off[0], it.off[1]));
    },

    // Lexical baseline over the packed impressions.
    async searchLexical(q, { limit = 25 } = {}) {
      const needle = String(q).toLowerCase().trim();
      if (!needle) return [];
      const all = new Uint8Array(await (await (await opfsFile(coldPath, false)).getFile()).arrayBuffer());
      const hits = [];
      for (const it of hot.items) {
        const seg = dec.decode(all.subarray(it.off[0], it.off[1]));
        const i = seg.toLowerCase().indexOf(needle);
        if (i < 0) continue;
        hits.push({ id: it.id, title: it.title, pointer: it.pointer || null, start: i, end: i + needle.length, snippet: seg.slice(Math.max(0, i - 45), i + needle.length + 45).replace(/\s+/g, ' ').trim() });
        if (hits.length >= limit) break;
      }
      return hits;
    },

    // Chunk-level semantic search over the append-only index. `embed(text)`
    // is supplied by the caller and MUST prefix with 'search_query: ' (the
    // index was built with 'search_document: '). Returns proposer hits with
    // real spans, plus the same query against a random null of equal shape.
    async searchIndex(q, { embed, limit = 15, nullControl = true } = {}) {
      if (!idxVec || !embed || !fold) return null;
      const dim = fold.dim, n = fold.vector.rows;
      const qv = norm(await embed(q));
      const rank = (mat) => { const a = new Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < dim; j++) s += qv[j] * mat[i * dim + j]; a[i] = [i, s]; } a.sort((x, y) => y[1] - x[1]); return a.slice(0, limit); };
      const hits = rank(idxVec).map(([i, s]) => ({ ...rowMeta[i], score: +s.toFixed(4) }));
      let nul = null;
      if (nullControl) {
        const nr = new Float32Array(n * dim);
        for (let i = 0; i < n; i++) { let ss = 0; for (let j = 0; j < dim; j++) { const x = Math.random() * 2 - 1; nr[i * dim + j] = x; ss += x * x; } ss = Math.sqrt(ss) || 1; for (let j = 0; j < dim; j++) nr[i * dim + j] /= ss; }
        nul = rank(nr).map(([i, s]) => +(s).toFixed(4));
      }
      return { query: q, hits, null: nul, topHit: hits[0]?.score ?? null, topNull: nul ? nul[0] : null, lift: nul ? +(hits[0].score - nul[0]).toFixed(4) : null };
    },
  };
}
