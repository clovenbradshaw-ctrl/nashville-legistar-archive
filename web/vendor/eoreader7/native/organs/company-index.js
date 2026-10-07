// native/organs/company-index.js — COMPANY, INDEXED ONCE (2026-09-28).
//
// The recursive reader re-derives the heard surfaces on every reprojection
// over EVERY sentence read so far (recursive.js's own header calls the term
// "O(prefix)"): heardSurfaces re-tokenises the whole past for its vocabulary
// counts, and discoverCompanyKinds re-walks it for contextVectors. Indexed by
// first word the walk is fast (kind-standing.js, deae43e), but the prefix is
// still re-read every time — superlinear over a book, measured: 400KB of War
// and Peace 26s after that fix, with the per-500-sentence cost still climbing.
//
// This organ holds the past so it is read ONCE. `add` takes a sentence and
// stores the two tokenisations the two consumers use — the whitespace+clean
// words contextVectors reads (and an inverted index word -> [sentence,
// position]) and the letter/number split heardSurfaces counts — so
// `vectors(surfaces)` reproduces contextVectors byte for byte and `counts` /
// `sentenceCounts` reproduce heardSurfaces' own tallies, over everything
// added so far. A caller adds only what is new; nothing here is medium-
// specific beyond the two tokenisers, which are the consumers' own and are
// injectable.
//
// Not a cache of results: a cache answers the same question faster; this
// answers a NEW question (the vocabulary grows every reprojection) without
// re-reading the material. The II.23 controls that live with
// discoverCompanyKinds' tests are unchanged — the null arm shuffles
// sentences it is handed, so it is handed sentences, never an index.

const DEFAULT_CLEAN = (t) => t.replace(/^[^\p{L}]+|[^\p{L}'’]+$/gu, "");
const DEFAULT_COUNT_SPLIT = /[^\p{L}\p{N}']+/u;

export function createCompanyIndex({ clean = DEFAULT_CLEAN, countSplit = DEFAULT_COUNT_SPLIT, minCountLength = 3 } = {}) {
  const words = [];              // sentence -> cleaned whitespace tokens (contextVectors' own)
  const byWord = new Map();      // cleaned word -> [[sentence, position], ...]
  const counts = new Map();      // heardSurfaces' vocabulary tally
  const sentenceCounts = new Map();
  const single = new Map();      // cleaned word -> its running company map (single-word surfaces answered in O(1))
  const add = (sentence) => {
    const text = String(sentence?.text ?? sentence ?? "");
    const idx = words.length;
    const ws = text.split(/\s+/).map(clean);
    words.push(ws);
    ws.forEach((w, i) => {
      if (!w) return;
      if (!byWord.has(w)) byWord.set(w, []); byWord.get(w).push([idx, i]);
      // running company for the single-word case — the vocabulary heardSurfaces
      // asks about is single words, and asking is O(vocabulary), not O(prefix)
      if (!single.has(w)) single.set(w, new Map());
      const v = single.get(w);
      const before = i > 0 ? ws[i - 1].toLowerCase() : "^";
      const after = i + 1 < ws.length ? ws[i + 1].toLowerCase() : "$";
      v.set(`before=${before}`, (v.get(`before=${before}`) ?? 0) + 1);
      v.set(`after=${after}`, (v.get(`after=${after}`) ?? 0) + 1);
    });
    const seen = new Set();
    for (const w of text.split(countSplit)) {
      if (w.length < minCountLength) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
      if (!seen.has(w)) { seen.add(w); sentenceCounts.set(w, (sentenceCounts.get(w) ?? 0) + 1); }
    }
    return idx;
  };
  /** contextVectors' own output over everything added: every start position where the surface's words match, overlaps included, in sentence order. */
  const vectors = (surfaces) => {
    const vecs = new Map(surfaces.map((s) => [s, new Map()]));
    for (const s of surfaces) {
      const pw = s.split(" ");
      if (pw.length === 1) { const v = single.get(s); if (v) vecs.set(s, new Map(v)); else vecs.delete(s); continue; }
      const hits = byWord.get(pw[0]); if (!hits) continue;
      const v = vecs.get(s);
      for (const [si, i] of hits) {
        const ws = words[si];
        if (i + pw.length > ws.length) continue;
        let ok = true; for (let j = 1; j < pw.length; j++) if (ws[i + j] !== pw[j]) { ok = false; break; }
        if (!ok) continue;
        const before = i > 0 ? ws[i - 1].toLowerCase() : "^";
        const after = i + pw.length < ws.length ? ws[i + pw.length].toLowerCase() : "$";
        v.set(`before=${before}`, (v.get(`before=${before}`) ?? 0) + 1);
        v.set(`after=${after}`, (v.get(`after=${after}`) ?? 0) + 1);
      }
    }
    for (const [k, v] of [...vecs]) if (!v.size) vecs.delete(k);
    return vecs;
  };
  return Object.freeze({ schema: "EOCompanyIndex@1", add, vectors, counts, sentenceCounts, get size() { return words.length; } });
}

export const isCompanyIndex = (x) => x?.schema === "EOCompanyIndex@1" && typeof x.vectors === "function";
