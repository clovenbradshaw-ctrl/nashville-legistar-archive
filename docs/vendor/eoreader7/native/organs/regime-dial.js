// organs/regime-dial.js — the one shared wall every visual-hierarchy
// archon that needs a numeric threshold imports, rather than each
// inventing its own copy: a threshold with no giver and no stated basis
// is exactly the "practitioner heuristic, no empirical support" class the
// literature review this whole team is built on keeps catching (the
// three-sizes rule, the grayscale test, the Z-pattern) — never manufacture
// a fourth one here. Mirrors kernel/assembly.js's own S16 regime-dial
// discipline ({ value, giver, basis }, giver mandatory); assembly.js has
// no standalone exported validator to import, so this is a small, real,
// independent implementation of the same rule, not a duplicate of one
// that already existed.
export function requireRegimeDial(dial, name) {
  if (!dial || typeof dial !== "object" || dial.value === undefined || typeof dial.giver !== "string" || !dial.giver.trim() || typeof dial.basis !== "string" || !dial.basis.trim()) {
    throw new TypeError(`visual-hierarchy: regime dial "${name}" must declare { value, giver, basis } — a threshold with no giver and no stated basis is an invented rule, exactly the class of "practitioner heuristic, no empirical support" this team refuses to manufacture`);
  }
  return dial;
}
