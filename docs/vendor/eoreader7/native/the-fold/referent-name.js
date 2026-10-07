// referent-name.js — THE PRETTY NAME IS AN ASSERTION, REVISABLE IN THE LOG
// (2026-09-21, the user's law: "a prettyName on a referent is an assertion
// that can be revised in the log").
//
// The reading-log's `represent` picks the longest surface silently — a fixed
// ladder with no assertion behind it, no reason, no revision. That is exactly
// the convention-hardcode this system retires everywhere else: the prettyName
// of a referent is NOT a datum; it is an ASSERTION — "this surface names this
// referent" — carrying a basis (WHY this surface is the name FOR WHOM), a
// stance (holds / doubted / refused / conceded), and an APPEND-ONLY LOG of its
// revisions. A better surface is a SUPERSEDE, never an edit; the prior name is
// the superseded history entry, kept, never erased (the EOT discipline, the
// same reconsiderShape concedes a cell with).
//
// The prettyName is a DISPLAY projection of the shadow: the referent's identity
// is its hashId; the name is a projection FOR a declared for-whom. Two for-whom
// frames may name one referent differently (S43: two readings by two recipes
// are two instruments) — each keeps its own name assertion in the log.
//
// PURE: no fetch, no model. The name is a value with a log; a revision is a
// pure function of the assertion + the candidate + the basis.
const NAME_SCHEMA = "EOReferentName@1";
export const NAME_STANCES = Object.freeze({ HOLDS: "holds", DOUBTED: "doubted", REFUSED: "refused", CONCEDED: "conceded" });

export function createNameRegister() {
  return { schema: NAME_SCHEMA, byId: new Map() };
}

// ASSERT a prettyName for a referent FOR WHOM. The assertion is born with its
// log (one entry: the name, the basis, the for-whom). Never a bare string.
// KEYED BY referent + for-whom (S43: two recipes, two instruments — one
// referent may be named differently for two for-whoms; each name is its own
// assertion in its own log, never merged into one voice). Re-asserting the
// SAME referent FOR THE SAME whom is refused — revise it in the log, never
// re-assert over it.
export function assertName(register, referentId, { name = "", basis = "", forWhom = null, giver = "the reading" } = {}) {
  if (!register) return null;
  const key = `${referentId}\u0000${String(forWhom ?? "any")}`;
  const current = register.byId.get(key);
  const entry = {
    schema: NAME_SCHEMA,
    referent: referentId,
    forWhom: forWhom ?? null,
    name: String(name ?? ""),
    basis: String(basis ?? ""),
    stance: NAME_STANCES.HOLDS,
    giver: String(giver ?? "the reading"),
    at: new Date().toISOString(),
    // THE BODY IS THE LOG: every state this name has occupied, appended never
    // edited. Born with the asserted name.
    history: [{ name: String(name ?? ""), basis: String(basis ?? ""), stance: NAME_STANCES.HOLDS, at: new Date().toISOString() }],
  };
  if (current) {
    // The referent already has a name FOR THIS WHOM — this is a REVISION
    // (supersede, never edit): the prior name becomes the superseded entry.
    return { refused: { type: "already_named", referent: referentId, forWhom, current: current.name, detail: "a referent is named once FOR a given whom; revise it in the log, never re-assert over it" } };
  }
  register.byId.set(key, entry);
  return entry;
}

// REVISE the prettyName FOR WHOM — appended to the log, never an edit. The
// prior name is the superseded history entry; the revision carries its own
// basis and giver. A revision to a name the same for-whom already holds is a
// genuine change; a revision from a different for-whom is a DIFFERENT name
// (S43: two recipes, two instruments) — both live in the log.
export function reviseName(register, referentId, { name = "", basis = "", forWhom = null, giver = "the reading", concede = false } = {}) {
  if (!register) return { refused: { type: "no_register", detail: "reviseName: a name register is required" } };
  const key = `${referentId}\u0000${String(forWhom ?? "any")}`;
  const entry = register.byId.get(key);
  if (!entry) return { refused: { type: "unnamed", referent: referentId, forWhom, detail: "reviseName: no name asserted for this referent FOR this whom" } };
  const was = entry.name;
  const stance = concede ? NAME_STANCES.CONCEDED : NAME_STANCES.HOLDS;
  // APPEND, never edit — the EOT discipline. The name's log keeps every state
  // it has occupied; folding reads the current one per for-whom.
  entry.history.push({ name: String(name ?? ""), basis: String(basis ?? ""), stance, forWhom: forWhom ?? entry.forWhom, giver: String(giver ?? "the reading"), at: new Date().toISOString() });
  entry.previousName = was;
  entry.name = String(name ?? "");
  entry.basis = String(basis ?? "");
  entry.stance = stance;
  entry.updatedAt = new Date().toISOString();
  return { revised: true, referent: referentId, forWhom: forWhom ?? entry.forWhom, was, now: entry.name, history: entry.history.length };
}

// CONCEDE the prettyName — a name the material demonstrated wrong is CONCEDED
// (REC, never an edit), exactly reconsiderShape concedes a refuted shape cell.
export function concedeName(register, referentId, { basis = "", forWhom = null, giver = "the reading" } = {}) {
  return reviseName(register, referentId, { name: null, basis, forWhom, giver, concede: true });
}

// FOLD the name FOR WHOM: the current name is folded from the log, per
// for-whom (a conceded name is folded away — the absence of the wrong path).
export function nameFor(register, referentId, { forWhom = null } = {}) {
  const key = `${referentId}\u0000${String(forWhom ?? "any")}`;
  const entry = register?.byId?.get(key);
  if (!entry) return null;
  const log = entry.history ?? [];
  if (!log.length) return null;
  const last = log[log.length - 1];
  return last.stance === NAME_STANCES.CONCEDED ? null : { name: last.name, basis: last.basis, stance: last.stance, referent: referentId, forWhom: forWhom ?? null, history: log.length };
}

// The display projection: `represent` used to pick the longest surface
// silently; now it reads the asserted name FOR WHOM, falling back to the
// longest surface only when no name is asserted (the received default,
// disclosed — never a silent ladder).
export function representName(register, referentId, { forWhom = null, fallback = "" } = {}) {
  const n = nameFor(register, referentId, { forWhom });
  return n ? n.name : (fallback || referentId);
}