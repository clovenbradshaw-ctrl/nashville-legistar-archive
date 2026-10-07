// retrieval.js — increment C of wiring-the-measured-memory-v2: recall is
// retrieval, the missing clause of READING-POLICY P1 ("activation decays,
// identity does not, recall is retrieval"). fold.js's projection (increment
// A) keeps the present window small; this is what brings a DORMANT record —
// beyond that window, absent from the gist — back into view when a new
// question needs it, so a four-message present can still behave like a
// long memory instead of one.
//
// Composed the S9 way (READING-SPEC.md), never blended into one scalar:
//
//   THE CUE GENERATES POSSIBILITY. eoreader7's own `native/memory/
//   activation.js` — Hebbian sparse coding, one-hop pattern completion,
//   causal (recall-before-encode; a record never recalls itself or
//   anything not yet read) — is injected whole and reused unmodified,
//   exactly the reuse pattern `adapters/text/pronouns.js` and
//   `adapters/text/anchoring.js` already establish for it ("turns as
//   frames"; here, records as frames). Only a record sharing DISTINCTIVE,
//   ALREADY-RECURRING vocabulary with the question can surface at all —
//   low (the material's own tokens) sets what is POSSIBLE.
//
//   THE POWER LAW RANKS PROBABILITY, WITHIN THE SURFACED SET ONLY.
//   ACT-R base-level activation (received d=0.5, giver: Anderson — the
//   exact formula native/eval/forgetting-falsification.mjs::actrScore
//   already measured and validated, reused verbatim here rather than
//   re-derived) orders what the cue surfaced by each record's own citation
//   history. Superseded by this conversation's OWN measured need-odds
//   (S17/B2) once it holds enough evidence — the supersession reported in
//   each candidate's own `basis`, never silent (S16).
//
// Never summed: a candidate's `cueWeight` (possibility, from `recall`) and
// `score` (probability, from ACT-R/need-odds) are reported side by side and
// the RANKING uses `score` alone — a blended scalar is the voting term this
// project has refused every time the question has come up.
//
// Typed gaps, never a silent top-k: `retrieval_no_cue` (the question shares
// no vocabulary with anything encoded, or the cue fires on nothing the
// posting table has indexed), `retrieval_no_margin` (candidates surfaced,
// but none clears the declared floor, or the leader is not separated from
// the runner-up). The floors (`minActivation`/`minMargin`) carry the same
// disclosed-unvalidated status every one-hop recall organ in this lineage
// already does (meta-parameters-INVENTORY.md row 3) — self-calibration
// against structurally-certain instances (a verbatim-named return) is the
// named next step, not attempted here.
//
// A known, accepted cost inherited for free from the reused organ, not
// re-derived: "the third occurrence is the first that can recall" — a
// record cited only once has no key a cue can fire on yet (df >= 2 to
// become a cue), so an exact address quoted back by name still resolves
// (direct string match, outside this module's concern), but ASSOCIATIVE
// recall of a twice-cited record waits for its third occurrence. A
// conversation genuinely works this way too.
//
// Output is records (by their own `order`, the position they were encoded
// at), never prose folded into the gist — a recalled record re-enters the
// RECORD projection, where its addresses and disclaimers travel with it.
// Laundering a recall through a paraphrase would inherit the paraphrase's
// own inability to support a claim (fold.js's own header, S1's limit).
//
// Pure, organs injected (cast.js pattern): `tokens`/`codeOf`/`recall`/
// `encodeFrame` arrive as arguments from eoreader7's real
// `native/memory/activation.js`, so this file stays zero-import and
// testable without a browser mount.

const ACTR_D = 0.5;
const ACTR_D_BASIS = "0.5 — ACT-R's received standard, giver named (Anderson); the same formula native/eval/forgetting-falsification.mjs::actrScore already measured";
const DEFAULT_MIN_ACTIVATION = 0.05;
const DEFAULT_MIN_MARGIN = 0.2;
// Trials a (recency, frequency) cell needs before its own tally supersedes
// the ACT-R prior — declared, disclosed as unvalidated on the same terms
// forgetting-falsification.mjs's own d=0.5 carried before it was measured.
// A single ordinary conversation is expected to clear this rarely, which is
// the honest, S17-consistent default: "the received prior stands until the
// material's own measurement holds more evidence."
const NEED_ODDS_EVIDENCE_FLOOR = 5;

const dyadicFloor = (n) => 1 << Math.floor(Math.log2(Math.max(1, n)));

function actrScore(citations, now) {
  let b = 0;
  for (const t of citations) b += 1 / Math.sqrt(Math.max(1, now - t + 1));
  return b;
}

function cellOf(citations, now) {
  const last = citations.length ? citations[citations.length - 1] : now;
  const r = dyadicFloor(now - last + 1);
  const f = dyadicFloor(citations.length || 1);
  return { key: `${r}|${f}`, r };
}

function bumpTally(map, key, hit) {
  const c = map.get(key) ?? { trials: 0, arrivals: 0 };
  c.trials += 1;
  c.arrivals += hit;
  map.set(key, c);
}

/**
 * The conversation's own measured need-odds for a (recency, frequency)
 * cell — the exact cell/margin fallback shape
 * native/eval/forgetting-falsification.mjs::needOdds already validated,
 * read here instead of re-derived. `odds: null` is a declared miss (no
 * evidence yet), never a zero standing in for "never needed again."
 */
function needOdds(index, citations, now) {
  const { key, r } = cellOf(citations, now);
  const cell = index.cellTallies.get(key);
  if (cell && cell.trials > 0) return { odds: cell.arrivals / cell.trials, trials: cell.trials, basis: `this conversation's own cell ${key}`, own: true };
  const marg = index.recencyTallies.get(r);
  if (marg && marg.trials > 0) return { odds: marg.arrivals / marg.trials, trials: marg.trials, basis: `this conversation's own recency margin ${r}`, own: true };
  // THE CORPUS RUNG (2026-09-01, user direction: odds come "from both this
  // document itself, and the structure of similar documents its read in the
  // past"). A received NeedPrior@1 — the IDENTICAL dyadic-cell shape,
  // harvested by live_priors/scripts/build-need-prior.mjs with the same
  // prequential construction forgetting-falsification.mjs validated, and
  // EARNED before shipping: frozen, it beat cold ACT-R on a held-out work
  // it never pooled (Dracula: 0.1924 vs 0.1725 mean precision, paired
  // 316-260). Sits BELOW the material's own measurement (S17: the received
  // prior stands only until the material holds more evidence) and ABOVE
  // ACT-R (which is the same idea with no corpus behind it — a universal
  // exponent instead of measured cells). Never blended: precedence only.
  // Disclosed approximation: the prior's step is the SENTENCE and this
  // index's clock is the TURN — dyadic cells absorb scale, but the basis
  // string names the giver so a reader can weigh it.
  const rp = index.receivedNeedPrior;
  if (rp) {
    const pc = rp.cells?.[key];
    if (pc && pc.trials > 0) return { odds: pc.arrivals / pc.trials, trials: pc.trials, basis: `received corpus cell ${key} (${rp.giver ?? "NeedPrior@1"})`, own: false };
    const pm = rp.recencyMargins?.[String(r)];
    if (pm && pm.trials > 0) return { odds: pm.arrivals / pm.trials, trials: pm.trials, basis: `received corpus recency margin ${r} (${rp.giver ?? "NeedPrior@1"})`, own: false };
  }
  return { odds: null, trials: 0, basis: null, own: false };
}

/** A fresh retrieval index — the memory/activation.js-shaped state
 * (`df`/`gramDf`/`posting`/`edges`/`read`) plus this file's own citation
 * history and need-odds tallies. One per conversation, held beside
 * `state.summary` (app.js), never rebuilt per turn. */
export function createRetrievalIndex({ receivedNeedPrior = null } = {}) {
  return {
    memory: { df: new Map(), gramDf: new Map(), posting: new Map(), edges: new Map(), read: 0 },
    citedAt: new Map(),
    cellTallies: new Map(),
    recencyTallies: new Map(),
    receivedNeedPrior,
  };
}

/**
 * Mark `order` as cited/used AGAIN as of `turnIndex` — the need-odds
 * TRAINING signal (B2). Every record already carrying at least one prior
 * citation gets one trial on its own (recency, frequency) cell as it stood
 * just before this event; `order` alone gets the arrival. Mirrors
 * native/eval/forgetting-falsification.mjs::runArm's own loop, made
 * incremental rather than batch.
 *
 * Call this ONLY on a genuine re-use — a record actually recalled and used
 * again, never on a record's own birth. A record being CREATED
 * (`encodeRecord`) is not a moment any OTHER already-live record was
 * "needed and missed"; training every live record's tally off every new
 * arrival would seed a false, universal "never needed again" signal from
 * ordinary conversational growth alone, and a target record could land in
 * one of those polluted cells purely by (recency, frequency) coincidence.
 * `encodeRecord` seeds its own citation history directly, without this
 * function's training side effect, for exactly that reason.
 */
export function recordCitation(index, order, turnIndex) {
  for (const [liveOrder, citations] of index.citedAt) {
    if (citations.length && citations[citations.length - 1] >= turnIndex) continue; // never learn from the future
    const { key, r } = cellOf(citations, turnIndex);
    const hit = liveOrder === order ? 1 : 0;
    bumpTally(index.cellTallies, key, hit);
    bumpTally(index.recencyTallies, r, hit);
  }
  const prior = index.citedAt.get(order) ?? [];
  index.citedAt.set(order, [...prior, turnIndex]);
}

/**
 * Wire a newly-landed record into the index so a LATER turn can recall it.
 * Encode-after-recall, never before (memory/activation.js's own causality
 * invariant) — call this only once a record already exists, after any
 * `recallCandidates` call for the SAME turn, never before it.
 *
 * Seeds `order`'s own citation history with its birth turn, WITHOUT
 * training need-odds off it — see `recordCitation`'s own header for why a
 * record's birth is not a retrieval event.
 */
export function encodeRecord(index, order, record, organs, { edgeSlots } = {}) {
  const { tokens, codeOf, encodeFrame } = organs || {};
  if (typeof tokens !== "function" || typeof codeOf !== "function" || typeof encodeFrame !== "function")
    throw new TypeError("encodeRecord: tokens/codeOf/encodeFrame are injected organs (eoreader7's native/memory/activation.js) — required, never defaulted");
  const ws = tokens(record?.gist ?? "");
  const { trace } = codeOf(ws, index.memory, {});
  encodeFrame(index.memory, order, ws, trace, edgeSlots != null ? { edgeSlots } : undefined);
  index.citedAt.set(order, [order]);
}

/**
 * Recall candidate records for a new question. Returns
 * `{candidates, gap}` — `candidates` is `[]` on any gap, never a guessed
 * top-k. Each candidate carries `order` (the record's own encoding
 * position — the caller's join key back to its actual record object),
 * `cueWeight` (possibility, disclosure only), `score` and `basis`
 * (probability — what the ranking actually used).
 */
export function recallCandidates(index, questionText, organs, {
  turnIndex,
  completion = 0.5,
  topEdges = 6,
  minActivation = DEFAULT_MIN_ACTIVATION,
  minMargin = DEFAULT_MIN_MARGIN,
  needOddsFloor = NEED_ODDS_EVIDENCE_FLOOR,
} = {}) {
  const { tokens, codeOf, recall } = organs || {};
  if (typeof tokens !== "function" || typeof codeOf !== "function" || typeof recall !== "function")
    throw new TypeError("recallCandidates: tokens/codeOf/recall are injected organs (eoreader7's native/memory/activation.js) — required, never defaulted");
  if (!Number.isInteger(turnIndex))
    throw new TypeError("recallCandidates: turnIndex is declared — the caller's own clock (P5.4), never defaulted");

  const ws = tokens(questionText ?? "");
  const { cue } = codeOf(ws, index.memory, {});
  if (!cue.size) {
    return { candidates: [], gap: "retrieval_no_cue", detail: "the question shares no distinctive, already-recurring vocabulary with any encoded record" };
  }
  const activation = recall(cue, index.memory, { completion, topEdges, selfOrder: -1 });
  if (!activation.size) {
    return { candidates: [], gap: "retrieval_no_cue", detail: "the cue fired on nothing the posting table has indexed yet" };
  }

  const scored = [...activation.entries()]
    .map(([order, cueWeight]) => {
      const citations = (index.citedAt.get(order) ?? []).filter((t) => t < turnIndex);
      let need = needOdds(index, citations, turnIndex);
      // An OWN tally under the evidence floor does not merely fail — it
      // yields to the received corpus prior if one is loaded (S17), and
      // only then to ACT-R. Rebuilt without the thin own-tallies so the
      // prior rung is reachable.
      if (need.own && need.trials < needOddsFloor && index.receivedNeedPrior) {
        const bare = { cellTallies: new Map(), recencyTallies: new Map(), receivedNeedPrior: index.receivedNeedPrior };
        need = needOdds(bare, citations, turnIndex);
      }
      const useNeedOdds = need.odds != null && need.trials >= needOddsFloor;
      return {
        order,
        cueWeight,
        score: useNeedOdds ? need.odds : actrScore(citations, turnIndex),
        basis: useNeedOdds
          ? `measured: ${need.basis} (${need.trials} trials) supersedes the received ACT-R prior`
          : `declared: ACT-R base-level, d=${ACTR_D} (${ACTR_D_BASIS})`,
      };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (top.score < minActivation) {
    return { candidates: [], gap: "retrieval_no_margin", detail: `the strongest candidate's own score (${top.score.toFixed(3)}) does not clear the declared floor (${minActivation})` };
  }
  const margin = scored.length > 1 && top.score > 0 ? (top.score - scored[1].score) / top.score : 1;
  if (margin < minMargin) {
    return { candidates: [], gap: "retrieval_no_margin", detail: `the leader is not separated from the runner-up (margin ${margin.toFixed(3)} < ${minMargin})` };
  }
  return { candidates: scored, gap: null };
}
