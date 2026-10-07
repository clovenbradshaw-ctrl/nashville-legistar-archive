/* Sockeye speaks:
 * “the  majority  were  four  years  old  and 
hence  in  accord  with  the  theory.  But  the  smallest  members  of  the  run  (almost  invariably 
males)  were  but  three  years  old,  while  a  considerable  number  of  the  larger  fish  were 
unmistakably  in  theii'  fifth  year.”
 *
 * This file implements the  "return-curve" model, where salmon identity is tracked through a curve representing their  "homing" to the natal stream, rather than a single point.  This model, grounded in the  natural process of salmon migration, is distinct from traditional models based on fixed points in time and space.
 *
 * — the engineering record below, kept whole —
 */
// native/kernel/return-curve.js — how identity RETURNS, measured. Omnimodal.
// Handle: Sockeye — after the salmon's natal homing: how an identity comes home, run as a curve rather than a point. Amendment XVII.
//
// Events in, curve out: each event is (key, at, form) — an identity the
// caller tracks, an integer position on the caller's own clock, and a label
// for the SHAPE the return took. Nothing here knows what a pronoun, a
// leitmotif, or a re-establishing shot is: "form" is a caller-declared
// label, exactly as "role" is in perceiver/text/roles.js. The same curve
// answers the same question in any medium — a full restatement vs a
// four-note fragment of a theme (music), a face close-up vs an
// over-the-shoulder re-introduction (film), a pronoun vs a re-glossed
// definite description (prose). The NL reading of the labels lives in
// adapters/text/accessibility.js, not here (READING-SPEC S6).
//
// WHY THIS IS A KERNEL ORGAN: the mapping gap-since-last-return -> form
// is the AUTHOR'S OWN model of the audience's memory, whatever the medium —
// a composer restates fully after a movement and fragments within a phrase
// for the same reason a novelist re-glosses at distance and pronominalizes
// up close. Reading that curve out of the material is how a reader learns
// the material's intended decay instead of declaring one (S13).
//
// DIALS: none. Bins are dyadic (structural doubling). Forms are DISCOVERED
// from the events. The per-form "majority window" is the widest bin whose
// plurality the form holds — where a plurality flips is structural, not a
// tuned constant.

const binFloorOf = (gap) => 1 << Math.floor(Math.log2(Math.max(1, gap)));

/**
 * returnCurve(events) → { returns, forms, bins, majorityWindow }
 *
 *   events   [{key, at, form}] in any order; `at` is an integer on the
 *            caller's own clock (P5.4: the caller states its unit).
 *   bins     [{floor, ceiling, total, counts, shares}] dyadic, ascending.
 *   majorityWindow  form -> the widest bin ceiling at which that form is
 *            the strict majority of returns, or null if it never is.
 */
export function returnCurve(events = []) {
  const byKey = new Map();
  for (const e of events) {
    if (!e || e.key == null || !Number.isFinite(e.at) || e.form == null) continue;
    if (!byKey.has(e.key)) byKey.set(e.key, []);
    byKey.get(e.key).push(e);
  }

  const bins = new Map(); // floor -> Map(form -> n)
  const forms = new Set();
  let returns = 0;
  for (const list of byKey.values()) {
    list.sort((a, b) => a.at - b.at);
    for (let i = 1; i < list.length; i += 1) {
      const gap = list[i].at - list[i - 1].at;
      if (gap < 1) continue;                       // co-arrival is not a return
      const floor = binFloorOf(gap);
      if (!bins.has(floor)) bins.set(floor, new Map());
      const row = bins.get(floor);
      row.set(list[i].form, (row.get(list[i].form) ?? 0) + 1);
      forms.add(list[i].form);
      returns += 1;
    }
  }

  const orderedForms = [...forms].sort();
  const rows = [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([floor, row]) => {
    const total = [...row.values()].reduce((a, b) => a + b, 0);
    const counts = Object.fromEntries(orderedForms.map((f) => [f, row.get(f) ?? 0]));
    const shares = Object.fromEntries(orderedForms.map((f) => [f, total ? (row.get(f) ?? 0) / total : 0]));
    return Object.freeze({ floor, ceiling: floor * 2 - 1, total, counts, shares });
  });

  const majorityWindow = {};
  for (const f of orderedForms) {
    let w = null;
    for (const r of rows) if (r.total && r.counts[f] / r.total > 0.5) w = r.ceiling;
    majorityWindow[f] = w;
  }

  return Object.freeze({
    schema: "EOReturnCurve@1",
    returns,
    forms: Object.freeze(orderedForms),
    bins: Object.freeze(rows),
    majorityWindow: Object.freeze(majorityWindow),
  });
}
