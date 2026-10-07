// handles.mjs — THE NAMES A PERSON MAY CHANGE, AND THE IDS THEY MAY NOT.
//
// Fold invariant: A HANDLE IS A LABEL, NEVER AN IDENTITY. Every thing the
// surface shows has a stable `id` (what records, addresses and tests store)
// and a display `label` (what a person reads). Only the label is renameable.
// So renaming "Void" to "Sources" changes what is drawn and nothing that is
// recorded: no address, no hash, no status ever moves.
//
// Three namespaces: `terrain` (the nine terrains), `status` (the claim
// statuses of bench.mjs), `slot` (the dock's slots, dock.mjs). Overrides are
// a plain { ns: { id: label } } object — the shape a settings panel stores.
//
// A bad override is never silently dropped and never crashes a render: it
// falls back to the default and is DISCLOSED in `rejected`.

export const HANDLE_SCHEMA = "EOHandles@1";

export const DEFAULT_HANDLES = Object.freeze({
  terrain: Object.freeze({
    void: "Void", field: "Field", entity: "Entity", kind: "Kind", network: "Network",
    link: "Link", paradigm: "Paradigm", atmosphere: "Atmosphere", lens: "Lens",
  }),
  status: Object.freeze({
    stated: "stated", conjectured: "conjectured", computed_in_range: "computed in range", proved: "proved",
  }),
  slot: Object.freeze({
    subject: "Subject", sources: "Sources", measures: "Measures", objects: "Objects", relations: "Relations", rows: "Rows",
    received: "Received", learned: "Learned here",
  }),
  surface: Object.freeze({ skills: "Skills" }),
});

export const LABEL_MAX = 32;
const FORBIDDEN = /[<>&"'`\u0000-\u001f]/;

/** validateLabel(s) -> { ok: true, label } | { ok: false, reason } */
export function validateLabel(s) {
  const label = String(s ?? "").replace(/\s+/g, " ").trim();
  if (!label) return { ok: false, reason: "empty" };
  if (label.length > LABEL_MAX) return { ok: false, reason: `longer than ${LABEL_MAX} characters` };
  if (FORBIDDEN.test(label)) return { ok: false, reason: "contains markup or control characters" };
  return { ok: true, label };
}

const key = (s) => s.toLowerCase();

/** resolveHandles(overrides) -> { handles, rejected }
 *  `handles` has every default id with either the override or the default;
 *  `rejected` lists each override refused, with its reason. Uniqueness is
 *  per namespace and case-insensitive — two ids drawn identically could not
 *  be told apart on screen. A rename that collides is the one refused (see
 *  below); it keeps its default and the refusal is listed. */
export function resolveHandles(overrides = {}) {
  const handles = {};
  const rejected = [];
  for (const ns of Object.keys(DEFAULT_HANDLES)) {
    handles[ns] = { ...DEFAULT_HANDLES[ns] };
    const given = overrides?.[ns] ?? {};
    for (const id of Object.keys(given)) {
      if (!(id in DEFAULT_HANDLES[ns])) rejected.push({ ns, id, label: given[id], reason: "unknown id" });
    }
    // Uniqueness. Ids the person did NOT rename keep their default label and
    // hold it first; a rename that lands on any held label (another id's
    // default or an earlier rename) is the one refused. Renaming can never
    // take a word away from something the person left alone.
    const taken = new Map(); // key(label) -> id
    for (const id of Object.keys(DEFAULT_HANDLES[ns])) if (!(id in given)) taken.set(key(DEFAULT_HANDLES[ns][id]), id);
    for (const id of Object.keys(DEFAULT_HANDLES[ns])) {
      if (!(id in given)) continue;
      const v = validateLabel(given[id]);
      if (!v.ok) { rejected.push({ ns, id, label: given[id], reason: v.reason }); taken.set(key(DEFAULT_HANDLES[ns][id]), id); continue; }
      const holder = taken.get(key(v.label));
      if (holder && holder !== id) { rejected.push({ ns, id, label: given[id], reason: `same as "${holder}"` }); if (!taken.has(key(DEFAULT_HANDLES[ns][id]))) taken.set(key(DEFAULT_HANDLES[ns][id]), id); continue; }
      handles[ns][id] = v.label;
      taken.set(key(v.label), id);
    }
  }
  return { schema: HANDLE_SCHEMA, handles, rejected };
}

/** labelOf(handles, ns, id) -> the drawn label; an unknown id draws as itself
 *  (never invented, never blank). */
export function labelOf(handles, ns, id) {
  return handles?.[ns]?.[id] ?? DEFAULT_HANDLES[ns]?.[id] ?? String(id);
}

/** setHandle(overrides, ns, id, label) -> { overrides } | { error }
 *  Returns a NEW overrides object; an empty label clears the override. */
export function setHandle(overrides, ns, id, label) {
  if (!DEFAULT_HANDLES[ns] || !(id in DEFAULT_HANDLES[ns])) return { error: "unknown handle" };
  const next = { ...overrides, [ns]: { ...(overrides?.[ns] ?? {}) } };
  if (String(label ?? "").trim() === "") { delete next[ns][id]; return { overrides: next }; }
  const v = validateLabel(label);
  if (!v.ok) return { error: v.reason };
  const trial = resolveHandles({ ...next, [ns]: { ...next[ns], [id]: v.label } });
  const clash = trial.rejected.find((r) => r.ns === ns && r.id === id);
  if (clash) return { error: clash.reason };
  next[ns][id] = v.label;
  return { overrides: next };
}
