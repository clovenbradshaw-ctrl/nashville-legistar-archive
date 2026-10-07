// organs/consolidation.js — the dream: the offline rhythm that turns a
// day's deposits into a standing field. Medium-blind: it reads the notes
// ledger (kernel/notes.js) and calls the door; it names no medium.
//
// THE ONE LEDGER, MORTAL PROJECTION. The ledger is the immortal record —
// append-only, addressed, re-openable, never edited. This module adds no
// second memory. It IS the night and the morning:
//
//   day     — attention encounters; the door deposits or releases.
//   night   — the dream: the elenchus (the witness at the door, the pattern
//             act) runs over the day's single-witness notes — "does this
//             source state this note?" — so a deposit either earns a second
//             independent vote or is held; and the chemistry's licensed
//             products (the compose step, injected) are heard back into the
//             same ledger.
//   morning — the FIELD is projected: what STANDS (corroborated, or still
//             within the reach of the present) is what the next read primes
//             from; the rest falls to the ECHO — still on the record, by
//             address, out of the field. The aperture reopens.
//
// THE ELENCHUS IS THE MEASURED LEVER (P32/P83/P86). The paraphrase wall is
// crossed by a witness, never by identity, which was measured FLAT. This
// module calls corroborateLedger whole when asked to (or an injected
// elenchus); it invents no statistic and no threshold. The floor is the
// ledger's own >=2-source standing (binding.js's structural minimum); the
// window is the caller's declared reach of the present — the RECENCY_WINDOW,
// attention's reach, the footlights.
//
// FORGETTING IS A PROJECTION DECISION, NEVER A DELETION. Nothing below
// ever mutates or removes a ledger entry; `echo` is a projection of the
// same record, re-openable by address. The record keeps everything; the
// field must not. "The ground must not close; sclerosis is death."
import { corroborateLedger } from "./corroboration.js";

/** note task_id -> the seq of its latest hearing — the present's reach. */
function recencyOf(log) {
  const last = new Map();
  for (const e of log?.entries ?? []) if (e?.task_id != null) last.set(e.task_id, e.seq);
  return last;
}

/**
 * projectField(door, log, { floor, window, now }) — the morning projection:
 * the mortal field over the immortal ledger. A note is IN the field when it
 * STANDS (sources >= floor — corroborated, the measure) or when it is still
 * within `window` of `now` (the reach of the present — attention's trace
 * still in the light). Everything else is the ECHO: still on the record,
 * below the field. `now` defaults to the ledger's last seq; `window` null
 * means only standing counts — the low sets the possibility, the field is
 * what primes the next read. Pure: the log is never touched.
 */
export function projectField(door, log, { floor = 2, window = null, now = null } = {}) {
  if (!door?.foldWithStanding) throw new TypeError("projectField: a notes door (makeNotesText) is required");
  const recency = recencyOf(log);
  let cursor = Number.isFinite(now) ? now : 0;
  for (const [, s] of recency) if (s > cursor) cursor = s;
  const field = [];
  const echo = [];
  for (const n of door.foldWithStanding(log)) {
    const last = recency.get(n.id) ?? 0;
    const inWindow = Number.isFinite(window) && last >= cursor - window;
    if (n.sources >= floor || inWindow) field.push(n);
    else echo.push(n);
  }
  return { field, echo, cursor };
}

/**
 * dream(door, log, opts) — the night. Runs the elenchus (default:
 * corroborateLedger — the witness at the door, under the caller's DECLARED
 * ask budget, P9), hears back any licensed products the caller's compose
 * step offers, then projects the morning field. Returns the re-formed log
 * (append-only — a new ledger, never a mutation) and the night's report.
 *
 * The elenchus is injectable so the rhythm can be tested without a model
 * and so a caller may bring its own judge; the default is the measured
 * one. `compose(door, log)` returns arrangements to hear back — the
 * chemistry's products (reaction.js over the day's edges), at this
 * ledger's grain.
 */
export async function dream(door, log, {
  sources = [], ask = null, selectAsk = null, testimony = null, maxAsks = 0,
  elenchus = corroborateLedger, compose = null, floor = 2, window = null, now = null,
  limitPerSource = null, splitSentences = null,
} = {}) {
  if (typeof elenchus !== "function") throw new TypeError("dream: the elenchus is a function — the witness at the door");
  let next = log;
  const report = { asks: 0, attested: [], contradicted: [], derived: [], refused: null, candidatePairs: 0, standings: null };
  if (maxAsks > 0 && sources.length) {
    const r = await elenchus(next, door, sources, { ask, selectAsk, testimony, maxAsks, limitPerSource, splitSentences });
    next = r.log ?? next;
    report.asks = r.asks ?? 0;
    report.attested = r.attested ?? [];
    report.contradicted = r.contradicted ?? [];
    report.refused = r.refusals ?? null;
    report.candidatePairs = r.candidatePairs ?? 0;
    report.standings = r.standings ?? null;
  }
  if (typeof compose === "function") {
    const products = (await compose(door, next)) ?? [];
    for (const p of products) next = door.hear(next, p);
    report.derived = products.map((p) => `${p.end1 ?? p.subject} ${p.label ?? p.verb} ${p.end2 ?? p.object}`);
  }
  const { field, echo, cursor } = projectField(door, next, { floor, window, now });
  return { log: next, report, field, echo, cursor };
}