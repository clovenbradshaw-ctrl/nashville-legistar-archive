// native/organs/data-integration.js — THE TEMPLATE: how any arbitrary
// external data (a corpus reading, a fetched dataset, a generated artifact —
// anything this engine reads or produces that is not itself engine code)
// gets integrated into a reader's own record without its bytes ever landing
// here. Medium-blind, kernel-adjacent. Born from a real mistake, same day:
// eoreader7's own OHS ground reading was committed and pushed INTO this
// repo before this existed, caught, and relocated to the corpus's own repo
// (ohs-custody). THE WALL this file exists to be: a resource is registered
// by its ADDRESS and its IDENTITY (a hash), never by its bytes — and an
// address that resolves inside the log's own declared repo root is a
// refused, typed act, not a silent success.
//
// Nothing new is built for "append-only log, folded at an iteration": that
// is kernel/task-log.js, already the one implementation grid.js, the-fold's
// build-log.js and notes.js (the hyperlexicon) all wear a thin shaping
// layer over. This file is that shaping layer, for one more domain —
// PROPOSE (INS) a first-sighted resource, EVIDENCE a re-confirmation of the
// identical bytes from another run, SUPERSEDE a genuine revision (the
// address or hash changed), fold via task-log's own projectTasks — the SAME
// vocabulary, not a second one.
//
// Typing: notes.js's own precedent (2026-08-28, corroborated this session)
// is that a first-sighted, individuated thing is INS·Figure — Existence
// domain (a birth), Figure grain (one instance, not yet a pattern across
// many) — landing on terrain Entity. A registered external resource is the
// same shape one register over: not a textual assertion, a DATA resource,
// but "individuated into the record on first sighting" either way. Matched
// here rather than re-derived.

import { createTaskLog, append, projectTasks, checkCubeProgression } from "../kernel/task-log.js";

export const DATA_INTEGRATION_SCHEMA = "EODataIntegration@1";
export const CELL = Object.freeze({ op: "INS", grain: "Figure" });

function isUrl(address) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(String(address ?? ""));
}

/** THE WALL. A URL is external by construction — this engine can read one,
 *  it cannot secretly BE the thing behind one. A local path is refused if it
 *  resolves inside `repoRoot` (declared by the caller, never assumed — an
 *  engine repo does not get to certify its own innocence by omission). */
function addressOutsideRepo(address, repoRoot) {
  if (isUrl(address)) return { outside: true, reason: "url" };
  const path = String(address ?? "");
  if (!path) return { outside: false, reason: "empty_address" };
  const resolved = path.startsWith("/") ? path.replace(/\/+$/, "") : null;
  const root = String(repoRoot ?? "").replace(/\/+$/, "");
  if (resolved == null) return { outside: false, reason: "relative_path_unverifiable" };
  const inside = resolved === root || resolved.startsWith(root + "/");
  return { outside: !inside, reason: inside ? "resolves_inside_repo_root" : "resolves_outside_repo_root" };
}

function requireDeclared(fields, given) {
  for (const f of fields) if (given[f] == null || given[f] === "") throw new TypeError(`data-integration: "${f}" is declared by the caller, never defaulted (P9) — the whole point of this file is that nothing about a resource is assumed`);
}

/**
 * registerResource(log, resourceId, { address, hash, corpus, recipe, giver,
 * repoRoot, because }) → new log.
 *
 * `address`: where the actual bytes live — a URL, or an absolute local path
 * OUTSIDE `repoRoot`. `hash`: the caller's own content identity for those
 * bytes (sha256 or equivalent — this file does not compute one, it records
 * what the caller attests). `corpus`/`recipe`/`giver`: what was read, how,
 * and who is vouching (a person, a pipeline name — never blank). `repoRoot`:
 * the absolute root of the repo this log itself lives in — the wall's own
 * ground truth, declared once per caller, not inferred from `process.cwd()`
 * (a log built by one script and read by another must not depend on where
 * either happened to run from).
 *
 * Refuses, typed, rather than silently admitting: an address that resolves
 * inside `repoRoot`, or any required field left undeclared.
 */
export function registerResource(log, resourceId, { address, hash, corpus, recipe, giver, repoRoot, because = null } = {}) {
  if (typeof resourceId !== "string" || !resourceId) throw new TypeError("registerResource: resourceId is declared by the caller — a stable name for this resource's own thread");
  requireDeclared(["address", "hash", "corpus", "recipe", "giver", "repoRoot"], { address, hash, corpus, recipe, giver, repoRoot });
  const wall = addressOutsideRepo(address, repoRoot);
  if (!wall.outside) return { log, refused: { resourceId, address, repoRoot, reason: wall.reason, basis: `refused: "${address}" ${wall.reason === "resolves_inside_repo_root" ? `resolves inside this log's own declared repo root ("${repoRoot}") — a resource is registered by where it lives, never copied in` : wall.reason}` } };
  const next = append(log, {
    kind: "propose", task_id: resourceId, operator: "INS", operator_basis: "produced", grain: "Figure",
    schema: DATA_INTEGRATION_SCHEMA, address, hash, corpus, recipe, giver, because,
    description: `${corpus} — ${recipe}, first registered`,
  });
  return { log: next, refused: null };
}

/**
 * reconfirmResource(log, resourceId, { address, hash, giver }) — lands an
 * EVIDENCE entry (task-log.js's own accumulating kind: support added,
 * nothing re-typed) when a later run reports the IDENTICAL hash for this
 * resource — the same bytes, witnessed again, from wherever this caller's
 * own run reads it. Refuses, typed, when the hash differs: a genuine change
 * is a revision (`reviseResource`), never a silent reconfirm — conflating
 * the two would let a resource's identity drift one "reconfirm" at a time.
 */
export function reconfirmResource(log, resourceId, { address, hash, giver } = {}) {
  requireDeclared(["address", "hash", "giver"], { address, hash, giver });
  const current = projectTasks(log).find((t) => t.task_id === resourceId);
  if (!current) return { log, refused: { resourceId, reason: "no_such_resource", basis: `refused: "${resourceId}" has no live registration to reconfirm` } };
  if (current.hash !== hash) return { log, refused: { resourceId, reason: "hash_mismatch", basis: `refused: reported hash differs from the registered one ("${hash}" vs "${current.hash}") — this is a revision, call reviseResource` } };
  const next = append(log, { kind: "evidence", task_id: resourceId, evidence: [`${giver}@${address}`] });
  return { log: next, refused: null };
}

/**
 * reviseResource(log, resourceId, { address, hash, corpus, recipe, giver,
 * repoRoot, because }) — a genuine change: the address moved, the bytes
 * changed, or both. Same wall as registration (an in-repo address is
 * refused identically). Lands `kind: "supersede"` UNDER THE SAME task_id
 * (build-log.js's own precedent for "modify this one, not a net-new one") —
 * task-log.js's `projectTasks` folds it as this resource's current state;
 * every prior entry stays on the log, unedited (append-only).
 */
export function reviseResource(log, resourceId, { address, hash, corpus, recipe, giver, repoRoot, because } = {}) {
  requireDeclared(["address", "hash", "corpus", "recipe", "giver", "repoRoot", "because"], { address, hash, corpus, recipe, giver, repoRoot, because });
  const current = projectTasks(log).find((t) => t.task_id === resourceId);
  if (!current) return { log, refused: { resourceId, reason: "no_such_resource", basis: `refused: "${resourceId}" has no live registration to revise — register it first` } };
  const wall = addressOutsideRepo(address, repoRoot);
  if (!wall.outside) return { log, refused: { resourceId, address, repoRoot, reason: wall.reason, basis: `refused: "${address}" ${wall.reason === "resolves_inside_repo_root" ? `resolves inside this log's own declared repo root ("${repoRoot}")` : wall.reason}` } };
  const next = append(log, {
    kind: "supersede", task_id: resourceId, operator: "SYN", operator_basis: "produced", grain: "Figure",
    schema: DATA_INTEGRATION_SCHEMA, address, hash, corpus, recipe, giver, because,
    description: `${corpus} — ${recipe}, revised: ${because}`,
  });
  return { log: next, refused: null };
}

/**
 * foldRegistry(log) → the currently-live registered resources, one row per
 * resourceId, in first-registered order — task-log.js's own `projectTasks`,
 * unmodified: "folded at a given iteration" IS this. A caller wanting an
 * EARLIER iteration slices `log.entries` to that seq and folds a task-log
 * built from the slice (`createTaskLog` + repeated `append`) — this file
 * adds no second cursor mechanism where task-log.js's own log-of-entries
 * already is one.
 */
export function foldRegistry(log) {
  return projectTasks(log).map((t) => ({
    resourceId: t.task_id, cell: t.cell, address: t.address, hash: t.hash,
    corpus: t.corpus, recipe: t.recipe, giver: t.giver, because: t.because,
    witnesses: t.evidence, registeredAtSeq: t.first_seq, revisedAtSeq: t.last_seq,
  }));
}

/** createResourceLog() — a fresh log admitting only the two operators this
 *  file uses (INS for a birth, SYN for a revision) — narrower than the full
 *  nine-operator chain on purpose: a resource registry has no DEF, no EVA,
 *  no REC of its own; those belong to whatever reads the resource, not to
 *  the fact that it was registered. */
export function createResourceLog() {
  return createTaskLog({ admits: ["INS", "SYN"] });
}

export { checkCubeProgression };
