// block-metrics.mjs — THE FIELD (Field · Structure·Ground).
//
// Fold invariant: A METRIC WITHOUT PROVENANCE IS NOT A ROW. The field is the
// background layer the links sit on: snapshot rows from any associated data
// source, each stamped with its dataset id, source, and asOf. This block
// folds an instance's snapshot through registry adapters — an adapter is a
// pure function { snapshot, push(registry, fields, extra) } and declares
// where its rows live. Same snapshot in, same rows out.
export const METRIC_SCHEMA = "MetricRow@1";

/**
 * foldFieldRows({ snapshot, adapters, provenance }) -> rows[]
 * `adapters` = [{ registry, run({ snapshot, push, provenance }) }].
 * The provenance is stamped by the caller (the snapshot's own metadata) and
 * attached to every row the adapters emit — never added later, never guessed.
 */
export function foldFieldRows({ snapshot, adapters, provenance }) {
  const rows = [];
  let seq = 0;
  const push = (registry, fields, extra = {}) => {
    rows.push({
      schema: METRIC_SCHEMA,
      registry,
      id: `metric:${registry}:${String(++seq).padStart(4, "0")}`,
      ...extra,
      fields,
      provenance: { ...provenance, registry },
    });
  };
  for (const a of adapters ?? []) a.run({ snapshot, push, provenance });
  return rows;
}