// activation-retrieval.js — retrieval as ACTIVATION over the reading, not a
// string matcher over containers.
//
// Handle: Kahanamoku (alias "Duke"), after Duke Kahanamoku, who carried
// surfing to the wider world — read the water, then ride the wave that is
// actually there. The archon of the surf (eoreader7 README Handle table).
//
// THE-HOLOGRAPH.md §6 is the theory; this is
// the organ. Pure: the referent index, the sentence splitter and the
// measurement organ are injected (the cast.js posture).
//
// INJECTED, not imported: the surface's dialogue (referentsOf, fold) and
// resolutions (activeReferents, dmdCut, lensCut, DECLARED_LINES) organs are
// handed to bindActivationRetrieval — an organ never imports a surface. The
// fold binds them once (activation-wiring.js) and every caller there keeps the
// names it always had.
//
// THE ADDRESS BOOK. `mentionBook(chunks, index)` walks every chunk's
// sentences once and records, for every referent the index establishes,
// the addresses of the sentences it stands in — absolute byte ranges that
// self-verify against the chunk's own text (P5.2). It is a projection of
// the index and costs seconds on a novel; nothing here waits on the
// relation reader's full admission.
//
// THE ACTIVATION. A question activates referents (its own through the
// index; the last answer's when it names none — resolutions.js's
// activeReferents). Hop 0 is every sentence an active referent stands in.
// Hop 1 is the referents those sentences co-mention, plus the other ends of
// the ledger's notes whose one end is active, and then THEIR sentences.
// Rows are ranked by hop, then by how many active referents they carry,
// then by document order, and cut where showing one more changes nothing
// about the reach — dmdWindow at the sentence grain, reach = the active and
// hop-1 referents the shown sentences carry (resolutions.js::dmdCut).
//
// THE FALLBACK. A question that resolves to no referent, or one whose
// referents stand in no sentence, gets the term retriever it always had,
// and the result says `basis: "surface"`. Nothing is silently mixed.
//
// WHAT IS HANDED. The passages returned are SENTENCES in the chunk shape
// (`ref`, `source`, `start`, `end`, `text`), so every downstream organ —
// the snip walls, the grounding checks, cite.js — reads them as material.
// The mouth gets the sentences verbatim, address-free (firewall.js); the
// record keeps the addresses. The chunk survives only as the paragraph the
// writer chose, an address container, never a retrieval unit.

export function bindActivationRetrieval({ referentsOf, fold, activeReferents, dmdCut, lensCut, DECLARED_LINES } = {}) {
  for (const [k, v] of Object.entries({ referentsOf, fold, activeReferents, dmdCut, lensCut }))
    if (typeof v !== "function") throw new TypeError(`bindActivationRetrieval: ${k} is injected`);
  if (!DECLARED_LINES) throw new TypeError("bindActivationRetrieval: DECLARED_LINES is injected");
  // THE GRAIN OF A SENTENCE IS THE ACT. Reach by referent alone hands ONE
  // sentence about Porfiry and cuts the next, which says something different
  // about him (measured 2026-09-07 in the turn test). So when a reader is
  // injected, a shown sentence's reach includes the acts it states about the
  // active referents (the relation reader's own labels — the same claims the
  // Lens block lists), and a sentence adds reach only when it carries an act no
  // shown sentence carries. Without a reader the reach is referents only, and
  // the result says so.
  //
  // SENTENCE_CEILING is a declared budget (P9), not a measurement: the reader
  // is run over at most this many candidate sentences per hop, so a referent
  // that stands in a thousand sentences never costs a thousand reads at a
  // turn. The cut inside the ceiling is measured; the ceiling itself is
  // declared and carried on the result.
  const SENTENCE_CEILING = 24;

  const resolveIds = (index, name) => { try { const r = index?.resolve?.(String(name ?? "")); return r instanceof Set ? r : new Set(r ?? []); } catch { return new Set(); } };

  /**
   * mentionBook(chunks, index, { splitSentences }) → { sentences, byId, gaps }
   * One row per sentence that mentions an established referent; `byId` maps a
   * referent id to the indexes of its sentences in document order. A sentence
   * whose text does not read back from its own byte range is a typed gap,
   * never a row (P5.2).
   */
  function mentionBook(chunks = [], index, { splitSentences } = {}) {
    if (typeof splitSentences !== "function") throw new TypeError("mentionBook: splitSentences is injected");
    const sentences = []; const byId = new Map(); const gaps = [];
    for (const c of chunks ?? []) {
      const text = String(c?.text ?? ""); if (!text.trim()) continue;
      let sents = []; try { sents = splitSentences(text); } catch { continue; }
      for (const s of sents) {
        const st = String(s?.text ?? ""); const off = Number(s?.offset ?? -1);
        if (!st.trim() || off < 0) continue;
        if (text.slice(off, off + st.length) !== st) { gaps.push({ ref: c.ref, offset: off, reason: "sentence does not read back from its offset" }); continue; }
        const ids = referentsOf(st, index).ids;
        if (!ids.size) continue;
        const start = (Number(c.start) || 0) + off, end = start + st.length;
        const row = { ref: `${c.source ?? String(c.ref ?? "").split("#")[0]}#${start}-${end}`, source: c.source ?? String(c.ref ?? "").split("#")[0], chunkRef: c.ref, start, end, text: st, ids, order: sentences.length };
        sentences.push(row);
        for (const id of ids) { if (!byId.has(id)) byId.set(id, []); byId.get(id).push(row.order); }
      }
    }
    return { sentences, byId, gaps, referents: byId.size };
  }

  /**
   * activate({ question, transcript, index, book, notes, dmdWindow }) →
   * { passages, basis, active, hop1, window, why }
   */
  function activate({ question = "", transcript = [], index, book, notes = [], dmdWindow = null, read = null, resolutions = 0 }) {
    if (!index || !book) return { passages: [], basis: "surface", active: [], hop1: [], window: 0, why: !index ? "no referent index" : "no mention book" };
    const act = activeReferents(question, transcript, index);
    const active = act.ids;
    if (!active.size) return { passages: [], basis: "surface", active: [], hop1: [], window: 0, why: "the question resolves to no referent" };
    const hop0 = new Set(); for (const id of active) for (const i of book.byId.get(id) ?? []) hop0.add(i);
    if (!hop0.size) return { passages: [], basis: "surface", active: [...active].sort(), hop1: [], window: 0, why: "the active referents stand in no sentence of the material" };
    // hop 1: co-mentioned in hop-0 sentences, and the other ends of notes touching an active referent
    const hop1 = new Set();
    for (const i of hop0) for (const id of book.sentences[i].ids) if (!active.has(id)) hop1.add(id);
    for (const n of notes ?? []) {
      const s = resolveIds(index, n.subject ?? n.end1), o = resolveIds(index, n.object ?? n.end2);
      const touches = [...s].some((id) => active.has(id)) || [...o].some((id) => active.has(id));
      if (!touches) continue;
      for (const id of [...s, ...o]) if (!active.has(id)) hop1.add(id);
    }
    const hop1Sentences = new Set(); for (const id of hop1) for (const i of book.byId.get(id) ?? []) if (!hop0.has(i)) hop1Sentences.add(i);
    // THE ACTS OF A SENTENCE ARE ON THE LOG. A note's spans carry the addresses
    // it was read from (`ref#start-end` inside a chunk, or a bare address); a
    // sentence's acts are the labels of the notes whose spans fall inside its
    // own byte range — a projection of the ledger, no reader at the turn.
    // The reader (`read`) is consulted only for a sentence no note covers,
    // when one is injected; a corpus with its reading on the ledger never
    // pays for it again (the page admits at arrival and keeps the log — P98/P99).
    const spanRanges = [];
    for (const n of notes ?? []) {
      const label = fold(n.verb ?? n.label); if (!label) continue;
      const ends = [...resolveIds(index, n.subject ?? n.end1), ...resolveIds(index, n.object ?? n.end2)].filter((id) => active.has(id) || hop1.has(id));
      if (!ends.length) continue;
      for (const sp of n.spans ?? []) {
        const at = String(sp?.at ?? sp?.ref ?? "");
        const m = /^(.*?)#(\d+)-(\d+)(?:#(\d+)-(\d+))?$/.exec(at); if (!m) continue;
        const base = Number(m[2]); const rel = m[4] != null;
        const start = rel ? base + Number(m[4]) : Number(m[2]), end = rel ? base + Number(m[5]) : Number(m[3]);
        spanRanges.push({ source: m[1].split("#")[0], start, end, keys: ends.map((id) => `${id}|${label}`) });
      }
    }
    // THE LENS REPLACES THE SENTENCES IT WAS COMPUTED FROM. At a resolution
    // that hands the Lens (level >= 2), the mouth already holds the acts about
    // the active referents as notes; the sentences it is handed are the ones
    // that GROUND those shown acts — one ranking, one cut, the same
    // `lensCut` the Lens block spends — plus one sentence per active referent
    // no shown act covers. A sentence whose only reach is a hop-1 referent or
    // an act the Lens's cut left out adds nothing the Lens does not carry, and
    // is not handed. Measured before this: at act grain over the whole
    // ledger every question about a protagonist rode the 48-sentence ceiling
    // (10k tokens a call) beside a Lens of 94 lines that stated the same acts.
    // Below level 2 the sentences ARE the acts' only carrier, and the reach is
    // the full one: active and hop-1 referents and every act on the log.
    const lens = resolutions >= 2 && (notes ?? []).length ? lensCut({ active, index, notes, dmdWindow, question, transcript }) : null;
    // Grounding is on the log by definition: the Lens's acts are ledger notes, so a sentence grounds a shown act when that note's span falls inside it — no reader consulted for ranking, ever (the reader below is spent only on the ceiling's candidates, below level 2).
    const logActsOf = (r) => [...new Set(spanRanges.filter((sp) => sp.source === r.source && sp.start < r.end && sp.end > r.start).flatMap((sp) => sp.keys))];
    // AT THE CEILING, GROUND THE DECLARED LINES. When the Lens's cut converged,
    // every shown act is grounded by a sentence. When it did not — the ladder's
    // top handed as the declared budget — grounding every one of 24 acts hands
    // 24 sentences beside 24 notes that state them (measured 2026-09-07: 3,114
    // chars of sentences beside a 1,705-char Lens, no compression at all), so
    // the sentences ground the top DECLARED_LINES shown acts, the same declared
    // number the ledger block hands unmeasured, and the record says "ceiling".
    const lensActs = lens ? (lens.ceiling ? new Set(lens.rows.slice(0, DECLARED_LINES).flatMap(lens.act)) : lens.acts) : new Set();
    const grounds = (r) => (lensActs.size ? logActsOf(r).filter((k) => lensActs.has(k)) : []);
    const carries = (row, set) => [...row.ids].filter((id) => set.has(id)).length;
    // At a resolution that hands the Lens, the candidates are the sentences that GROUND its shown acts first (one sentence often grounds several), then the ones carrying the most active referents; the ceiling then caps what the cut may see.
    const rows0 = [...hop0].map((i) => ({ ...book.sentences[i], hop: 0 })).sort((a, b) => grounds(b).length - grounds(a).length || carries(b, active) - carries(a, active) || carries(b, hop1) - carries(a, hop1) || a.order - b.order);
    const rows1 = [...hop1Sentences].map((i) => ({ ...book.sentences[i], hop: 1 })).sort((a, b) => carries(b, hop1) - carries(a, hop1) || a.order - b.order);
    const rows = [...rows0.slice(0, SENTENCE_CEILING), ...rows1.slice(0, SENTENCE_CEILING)];
    const acts = new Map(); // row order → the acts on the log inside this sentence (or, failing any, what the reader hears — read once per row, never beyond the ceiling)
    const actsOf = (r) => {
      if (acts.has(r.order)) return acts.get(r.order);
      const onLog = [...new Set(spanRanges.filter((sp) => sp.source === r.source && sp.start < r.end && sp.end > r.start).flatMap((sp) => sp.keys))];
      if (onLog.length || typeof read !== "function") { acts.set(r.order, onLog); return onLog; }
      let out = [];
      try {
        for (const c of read(r.text)?.claims ?? []) {
          const ends = [...resolveIds(index, c.end1 ?? c.subject), ...resolveIds(index, c.end2 ?? c.object)];
          const on = ends.filter((id) => active.has(id) || hop1.has(id));
          const label = fold(c.label ?? c.verb);
          if (label && on.length) for (const id of on) out.push(`${id}|${label}`);
        }
      } catch { out = []; }
      out = [...new Set(out)]; acts.set(r.order, out); return out;
    };
    const reachOf = lensActs.size
      ? (r) => [...r.ids].filter((id) => active.has(id)).map((id) => `0:${id}`).concat(grounds(r))
      : (r) => [...r.ids].filter((id) => active.has(id)).map((id) => `0:${id}`).concat([...r.ids].filter((id) => hop1.has(id)).map((id) => `1:${id}`), actsOf(r));
    const cut = dmdCut(rows, new Set([...active, ...hop1]), { dmdWindow, reachOf });
    const passages = cut.rows.map((r) => ({ ref: r.ref, source: r.source, chunkRef: r.chunkRef, start: r.start, end: r.end, text: r.text, hop: r.hop, ids: [...r.ids].sort() }));
    const grounded = new Set(cut.rows.flatMap(grounds)).size;
    return { passages, basis: "activation", grain: spanRanges.length || typeof read === "function" ? "act" : "referent", actsOnLog: spanRanges.length, ceiling: SENTENCE_CEILING, active: [...active].sort(), activeBasis: act.basis, hop1: [...hop1].sort(), window: cut.window, cutBasis: cut.basis, cutCeiling: cut.ceiling === true, lens: lens ? { window: lens.window, acts: lens.acts.size, groundingOf: lensActs.size, grounded, basis: lens.basis, ceiling: lens.ceiling === true } : null, hop0Count: hop0.size, hop1Count: hop1Sentences.size, why: `${hop0.size} sentence(s) carry the active referent(s), ${hop1Sentences.size} more carry what they stand with; ${cut.window} handed${lens ? ` — grounding ${grounded} of the Lens's ${lensActs.size} shown acts` : ""}` };
  }

  /**
   * makeActivationRetrieval({ index, book, notes, transcript, dmdWindow, fallback })
   * → the `retrieveWith(chunks, question, limit, folded)` the turn takes.
   * `notes` and `transcript` may be functions (read at call time — the
   * ledger and the transcript grow as the conversation goes). The returned
   * array carries `basis`, `active`, `hop1`, `window`, `why` as properties so
   * the turn can record what retrieval did.
   */
  function makeActivationRetrieval({ index, book, notes = [], transcript = [], dmdWindow = null, fallback = null, read = null, resolutions = 0 } = {}) {
    const live = (v) => (typeof v === "function" ? v() : v) ?? [];
    return function retrieveByActivation(chunks, question, limit, folded) {
      const r = activate({ question, transcript: live(transcript), index, book, notes: live(notes), dmdWindow, read, resolutions });
      let out;
      if (r.passages.length) out = r.passages;
      else { out = typeof fallback === "function" ? [...(fallback(chunks, question, limit, folded) ?? [])] : []; r.basis = "surface"; r.why = `${r.why}; term retrieval stood in`; }
      Object.defineProperty(out, "retrieval", { value: { basis: r.basis, grain: r.grain ?? null, actsOnLog: r.actsOnLog ?? 0, ceiling: r.ceiling ?? null, active: r.active, activeBasis: r.activeBasis ?? null, hop1: r.hop1, window: r.window, cutBasis: r.cutBasis ?? null, cutCeiling: r.cutCeiling ?? false, lens: r.lens ?? null, hop0Count: r.hop0Count ?? 0, hop1Count: r.hop1Count ?? 0, why: r.why }, enumerable: false });
      return out;
    };
  }
  return { SENTENCE_CEILING, mentionBook, activate, makeActivationRetrieval };
}
