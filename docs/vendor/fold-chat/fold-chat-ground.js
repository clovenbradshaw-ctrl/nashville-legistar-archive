// fold-chat-ground.js — the fold's grounding mechanisms, ported lean for the
// chat surface, and its per-turn RECORD in the holodeck's own voice.
//
// The fold's organs (eoreader7 native/organs: cite.js, grounding.js, source.js)
// run the full pipeline against a workspace's retrieved chunks. This surface is
// sealed-external and never touches the workspace, so the material it grounds
// against is the one it already carries: the person's OWN messages. Same
// mechanisms, reading that material:
//
//   stripSelfCitations  the model is never shown an address and never asked to
//                       cite; a bracket address in its OWN output is neutralized.
//   attribute/coverage  attach each answer sentence to the material it shares a
//                       PHRASE with (a consecutive run of >= MIN_RUN tokens),
//                       addressed to a byte range within that message, and veto
//                       the attachment if the sentence commits to a proper name
//                       the material does not contain.
//   unsupportedClaims   the figures and names in the answer the material does
//                       not say at all.
//   turnRecord          the holodeck's one-line record: addresses checked,
//                       nothing unsupported (or how many are not in the material).
//
// It never judges whether an uncited claim is TRUE; it says what the material
// backs and what it does not. The model proposes; the record decides.

export const MIN_RUN = 2;
const ABBREV = /\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|e\.g|i\.e|no|fig|inc|ltd|co|gov|dept|approx|est)\.$/i;

/** Split an answer into sentences. A newline boundary is unconditional; only
 *  a ./!/? boundary can be an abbreviation in disguise. */
export function splitSentences(text) {
  const src = String(text ?? "");
  const pieces = [];
  let start = 0;
  const re = /(?<=[.!?])\s+|\n+/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const piece = src.slice(start, m.index);
    const boundaryIsSentencePunct = /[.!?]$/.test(src.slice(0, m.index));
    if (boundaryIsSentencePunct && ABBREV.test(piece.trimEnd())) continue;
    const trimmed = piece.trim();
    if (trimmed) pieces.push(trimmed);
    start = m.index + m[0].length;
  }
  const tail = src.slice(start).trim();
  if (tail) pieces.push(tail);
  const out = [];
  for (const piece of pieces) {
    if (out.length && /^\[[^\]\s]+#\d+-\d+\]/.test(piece)) out[out.length - 1] += " " + piece;
    else out.push(piece);
  }
  return out;
}

function fold(s) {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Tokens with their character offsets in the source, so a shared run can be
 *  mapped back to a real byte range. */
export function tokensWithOffsets(text) {
  const src = String(text ?? "");
  const folded = src.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const out = [];
  const re = /[\p{L}\p{N}]+/gu;
  let m;
  while ((m = re.exec(folded)) !== null) out.push({ t: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
  return out;
}

export function tokenize(text) { return tokensWithOffsets(text).map((x) => x.t); }

/** The longest run of tokens two sequences share in order. A shared word is a
 *  coincidence; a shared run is a phrase, the smallest thing that can be said
 *  to have come from somewhere. */
export function overlap(a, b) {
  const x = a || [], y = b || [];
  let prev = new Uint16Array(y.length + 1);
  let best = 0;
  for (let i = 1; i <= x.length; i++) {
    const row = new Uint16Array(y.length + 1);
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) { row[j] = prev[j - 1] + 1; if (row[j] > best) best = row[j]; }
    }
    prev = row;
  }
  return best;
}

/** The best aligned run, with the material token index where it ends, so the
 *  shared phrase can be addressed. */
function bestRun(sentenceTokens, matTokens) {
  const a = sentenceTokens, b = matTokens;
  let prev = new Uint16Array(b.length + 1);
  let best = 0, endJ = -1;
  for (let i = 1; i <= a.length; i++) {
    const row = new Uint16Array(b.length + 1);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        row[j] = prev[j - 1] + 1;
        if (row[j] > best) { best = row[j]; endJ = j; }
      }
    }
    prev = row;
  }
  return { score: best, endJ };
}

const ALREADY_CITED = /\[[^\]\s]+#\d+-\d+\]/g;

export function stripSelfCitations(text) {
  let removed = 0;
  const out = String(text ?? "").replace(ALREADY_CITED, () => { removed++; return "[citation removed — not issued by this instrument]"; });
  return { text: out, removed };
}

const NAME_RUN_RE = /(?<![\p{L}\p{N}_])(\p{Lu}[\p{L}\p{N}_.'-]*(?:\s+\p{Lu}[\p{L}\p{N}_.'-]*)+)(?<=[\p{L}\p{N}_])/gu;
const ACRONYM_RE = /(?<![\p{L}\p{N}_])(\p{Lu}{2,})(?![\p{L}\p{N}_])/gu;

/** The names a sentence commits to: runs of >= 2 capitalized words, and bare
 *  acronyms. */
export function namesIn(text) {
  const s = String(text ?? "");
  const names = new Set();
  for (const m of s.matchAll(NAME_RUN_RE)) names.add(m[1]);
  for (const m of s.matchAll(ACRONYM_RE)) names.add(m[1]);
  return [...names];
}

function namesSupported(text, hayFolded) {
  return namesIn(text).every((n) => {
    const parts = tokenize(n).filter((p) => p.length > 1);
    return parts.length > 0 && parts.every((p) => hayFolded.includes(p));
  });
}

const NUMBER_RE = /\b\d[\d,]*(?:\.\d+)?%?(?:st|nd|rd|th|s)?\b/g;
export function numbersIn(text) {
  const out = new Set();
  for (const m of String(text ?? "").matchAll(NUMBER_RE)) out.add(m[0].replace(/,/g, "").toLowerCase());
  return [...out];
}

/** Attribute each sentence of an answer to the material it came from. `material`
 *  is [{ ref, label, text }] where `ref` is the display name and `label` the
 *  short source tag (S1, S2). Returns [{ text, ref, source, span, score }];
 *  `ref`/`span` are null when the sentence is not grounded. */
export function attribute(answer, material = []) {
  if (!material.length) return [];
  const offered = material.map((m) => ({ ...m, toks: tokensWithOffsets(m.text) }));
  return splitSentences(answer).map((text) => {
    const st = tokenize(text);
    let best = { score: 0, endJ: -1 }, hit = null;
    for (const m of offered) {
      const r = bestRun(st, m.toks.map((x) => x.t));
      if (r.score > best.score) { best = r; hit = m; }
    }
    const hay = offered.map((m) => tokenize(m.text).join(" ")).join(" \n ");
    if (best.score < MIN_RUN || !hit || !namesSupported(text, tokenize(hit.text).join(" "))) return { text, ref: null, source: null, span: null, score: best.score };
    const endTok = hit.toks[best.endJ - 1];
    const startTok = hit.toks[best.endJ - best.score];
    const span = { start: startTok.start, end: endTok.end };
    return { text, ref: hit.ref, source: hit.source, span, address: `${hit.ref}#${span.start}-${span.end}`, score: best.score };
  });
}

export function coverage(answer, material = []) {
  const entries = attribute(answer, material);
  const grounded = entries.filter((e) => e.ref);
  const refs = [...new Set(grounded.map((e) => e.address))];
  return { entries, grounded: grounded.length, total: entries.length, refs, ratio: entries.length ? grounded.length / entries.length : 0 };
}

/** The checkable claims the material does NOT support. */
export function unsupportedClaims(answer, material = []) {
  const hayNumbers = new Set();
  const hayFolded = [];
  for (const m of material) {
    for (const n of numbersIn(m.text)) hayNumbers.add(n);
    hayFolded.push(tokenize(m.text).join(" "));
  }
  const hay = hayFolded.join(" \n ");
  const numbers = numbersIn(answer).filter((n) => !hayNumbers.has(n));
  const names = namesIn(answer).filter((name) => {
    const parts = tokenize(name).filter((p) => p.length > 1);
    return parts.length > 0 && !parts.every((p) => hay.includes(p));
  });
  return { numbers, names };
}

/** The full per-turn RECORD, holodeck-shaped: what was addressed, what is not
 *  in the material, the ungrounded sentences, and the one-line record. */
export function turnRecord(answer, material = [], { turn = 1, question = "", model = "", sealed = false } = {}) {
  const has = material.length > 0 && material.some((m) => String(m?.text ?? "").trim().length >= 40);
  const cov = has ? coverage(answer, material) : { entries: [], grounded: 0, total: splitSentences(answer).length, refs: [], ratio: 0 };
  const uns = has ? unsupportedClaims(answer, material) : { numbers: [], names: [] };
  // Addressed sources, deduped by address.
  const seen = new Set();
  const sources = [];
  for (const e of cov.entries) {
    if (!e.address || seen.has(e.address)) continue;
    seen.add(e.address);
    sources.push({ address: e.address, ref: e.ref, span: e.span, text: e.text });
  }
  const ungrounded = cov.entries.filter((e) => !e.ref).map((e) => e.text);
  const bad = [...uns.numbers, ...uns.names];
  const bits = [
    nbOrd(cov.refs.length, "address", "addresses") + " checked",
    bad.length ? bad.length + " not in the material" : "nothing unsupported",
    cov.total - cov.grounded > 0 ? (cov.total - cov.grounded) + " sentence(s) ungrounded" : "every sentence grounded",
  ];
  const line = has
    ? `On record · turn ${turn} · ${bits.join(" · ")}`
    : `On record · turn ${turn} · no material carried · the answer stands on the model alone`;
  // The facing page rides the record when material was read (never over a
  // greeting): the spread the surface renders.
  const facing = has ? facingPage(answer, material) : { sources: [], response: [], has: false };
  // examined: the panel is shown ONLY when the fold actually read material
  // (the holodeck's lesson — a grounding report over nothing is noise, and a
  // greeting is not a claim). A materialless turn carries examined:false and
  // the surface renders no panel at all.
  return { turn, hasMaterial: has, examined: has, coverage: cov, unsupported: uns, sources, ungrounded, facing, line };
}

const nbOrd = (n, a, b) => n + " " + (n === 1 ? a : (b || a + "s"));

/** The facing page: the turn as a book spread (the holodeck's own construction,
 *  ported lean). LEFT are the SOURCES — each cited passage numbered S1, S2, …
 *  by first use, carrying the verbatim sentence read from the real material and
 *  its permanent address (ref#byteStart-byteEnd). RIGHT is the RESPONSE — every
 *  sentence tagged [S#] to the passage it draws from, or [M] for the mouth's own
 *  prose (ungrounded). Nothing is re-summarized: the snip is the material's own
 *  bytes and the tags are the turn's own attributions, laid side by side.
 *  Returns { sources, response, has }. */
export function facingPage(answer, material = []) {
  const entries = attribute(answer, material);
  const fnum = new Map();
  for (const e of entries) if (e.ref && !fnum.has(e.address)) fnum.set(e.address, fnum.size + 1);
  const cites = new Map();
  for (const e of entries) if (e.ref) cites.set(e.address, (cites.get(e.address) || 0) + 1);
  const sources = [...fnum.entries()].map(([address, n]) => {
    const e = entries.find((x) => x.address === address);
    return { n: "S" + n, address, ref: e?.ref ?? null, span: e?.span ?? null, text: String(e?.text ?? "").trim(), cite: cites.get(address) || 0 };
  });
  const response = entries.map((e) => ({
    tag: e.ref && fnum.has(e.address) ? "S" + fnum.get(e.address) : "M",
    text: String(e.text ?? "").trim(),
    grounded: !!(e.ref && fnum.has(e.address)),
    address: e.ref ? e.address : null,
  }));
  return { sources, response, has: sources.length > 0 };
}

/** The fold-voice note appended under an answer that overreached — what the
 *  material does not say, named. */
export function ungroundedNote(unsupported) {
  const parts = [];
  if (unsupported.numbers.length) parts.push(`figures ${unsupported.numbers.slice(0, 6).join(", ")}`);
  if (unsupported.names.length) parts.push(`names ${unsupported.names.slice(0, 6).join(", ")}`);
  if (!parts.length) return "";
  return `⟂ fold: the material here does not say ${parts.join("; ")} — not grounded in what you gave me.`;
}

/** A mechanical one-line gist for the record (System 1 style): the answer's
 *  first sentence, clipped. Never a claim about truth, only a fold of the text. */
export function foldLine(question, answer) {
  const s = splitSentences(answer).find((x) => x.length > 12) || String(answer || "").trim();
  const clip = s.replace(/\s+/g, " ").trim().slice(0, 160);
  return clip ? (clip.length < s.length ? clip + "…" : clip) : "";
}
