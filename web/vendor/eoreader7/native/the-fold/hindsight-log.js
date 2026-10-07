// the-fold/hindsight-log.js — kernel/hindsight.js over the constitutional
// reader's own log (2026-09-25): the two identity events recursive.js writes
// (EOReferentMerge@1 with `kept`/`folded`, EOReferentReassignment@1 with
// `from`/`to`) and the entries that refer to beings (EOMention@1's `referent`,
// EOReferent@1's own `id`). Schema-aware where the kernel is blind; nothing
// here reads bytes or guesses a field.
import { hindsight } from "../kernel/hindsight.js";

const isMerge = (e) => e?.schema === "EOReferentMerge@1";
const isReassignment = (e) => e?.schema === "EOReferentReassignment@1";

/** The ids an identity event re-addressed: a merge's kept and folded beings; a
 *  reassignment's from and to. Null for any other entry. */
export function touchedByEvent(entry) {
  if (isMerge(entry)) return [entry.kept, ...(entry.folded ?? [])].filter((x) => x != null);
  if (isReassignment(entry)) return [entry.from, entry.to].filter((x) => x != null);
  return null;
}

/** The being ids a log entry refers to — a mention's referent, a referent's own
 *  id, an identity event's touched ids. Schema-keyed, never guessed. */
export function referentRefsOf(entry) {
  if (!entry || typeof entry !== "object") return [];
  if (entry.schema === "EOMention@1") return entry.referent != null ? [entry.referent] : [];
  if (entry.schema === "EOReferent@1") return entry.id != null ? [entry.id] : [];
  return touchedByEvent(entry) ?? [];
}

/** Every identity event on the log, with its position and what it touched. */
export function identityEvents(entries) {
  const out = [];
  (entries ?? []).forEach((e, i) => { const touched = touchedByEvent(e); if (touched) out.push({ index: i, schema: e.schema, touched }); });
  return out;
}

/** hindsightFromLog(entries, eventIndex, { index, trials, rng }) — the kernel
 *  walk with the reader's own schemas supplied. Refuses, typed, when the entry
 *  at eventIndex is not an identity event. */
export function hindsightFromLog(entries, eventIndex, { index = null, trials = 200, rng = Math.random } = {}) {
  const event = entries?.[eventIndex];
  const touched = touchedByEvent(event);
  if (!touched) return { gap: "not_an_identity_event", eventIndex, schema: event?.schema ?? null };
  return hindsight(entries, eventIndex, { touched, refsOf: referentRefsOf, idOf: (e, i) => e?.id ?? `#${i}`, index, trials, rng });
}
