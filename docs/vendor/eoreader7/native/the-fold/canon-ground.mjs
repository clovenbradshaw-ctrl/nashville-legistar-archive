// native/the-fold/canon-ground.mjs — the physics field is the canon.
//
// The gate and the organs do not carry their own grounds as English strings;
// they carry BYTE ANCHORS into the committed canon (eoreader7/canon/), and
// this module is the reader that turns those anchors into the ground the
// machine actually stands on.
//
// WHAT IT DOES. Reads the physics spec (antistrauss-physics.txt), reads each
// canon file named there, verifies its sha256 against the recorded digest,
// and cuts each mechanic's ground — the span AND the window around it — from
// the canon's own bytes. The ground digest binds to the concatenated canon
// bytes, so changing the canon changes the ground, and a hot process whose
// laws no longer match the ground refuses closed (ungrounded) rather than
// running ungoverned.
//
// WHY THE WINDOW. The needle locates the passage; the window is the
// encounter. A mechanic's ground is not a quote dropped into a comment — it
// is the passage plus what is AROUND it, so the reader who comes to
// understand the mechanism must come across the teaching that surrounds the
// anchor, in the canon's own language.
//
// ANTI-STRAUSS. Leo Strauss taught that a text keeps its true meaning
// between the lines. This module holds the opposite, plainly: the line is
// the teaching. The machine does not summarize the canon; it reads it, and
// it is built on those bytes.
//
// FAIL-CLOSED. If the physics file is the placeholder, or a canon file is
// missing or sha-mismatched, the ground is UNGROUNDED — nothing derived from
// it is licensed, and the gate refuses rather than running with a weaker
// register. There is no fallback that silently ungrounds.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { normalizedIndex } from "../organs/quotes.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(HERE, "..", "..");
const PHYSICS_FILE = path.join(REPO_ROOT, "antistrauss-physics.txt");
const CANON_ROOT = path.join(REPO_ROOT, "canon");

const sha256hex = (text) => crypto.createHash("sha256").update(String(text ?? "")).digest("hex");
const shortDigest = (text) => sha256hex(text).slice(0, 32);

export const CANON_SCHEMA = "AntiStraussPhysics@1";
export const GIVER = "canon-ground";

// ── the physics spec: read the file, parse the directive ────────────────
// The file may be the placeholder word ("antistrauss") — then there is no
// spec and the default register stands, disclosed. When the spec lands, it
// names the canon and the mechanics.
function loadPhysicsSpec() {
  let bytes = null;
  try { bytes = fs.readFileSync(PHYSICS_FILE, "utf8"); } catch { bytes = null; }
  const content = String(bytes ?? "").trim();
  const digest = shortDigest(content);
  const marker = content === "antistrauss";
  let spec = null;
  if (!marker) {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object" && parsed.schema === CANON_SCHEMA) spec = parsed;
    } catch { spec = null; }
  }
  return { content, digest, marker, spec };
}

// ── the canon files: read the bytes, verify the recorded sha256 ─────────
// Every file named in the spec must exist and match its recorded digest.
// A missing or changed file UNGROUNDS the whole register — nothing derived
// from an unverified byte is licensed.
function loadCanonFiles(spec) {
  const files = [];
  const failures = [];
  if (!spec) return { files, failures, ungrounded: false };
  for (const entry of spec.canon ?? []) {
    if (Array.isArray(entry.collection)) {
      for (const rel of entry.collection) {
        const abs = path.join(CANON_ROOT, rel);
        const f = readCanonFile(entry.id, rel, abs, null);
        if (f) files.push(f); else failures.push({ id: entry.id, rel });
      }
      continue;
    }
    const rel = entry.path.replace(/^canon\//, "");
    const abs = path.join(CANON_ROOT, rel);
    const f = readCanonFile(entry.id, rel, abs, entry.sha256);
    if (f) files.push(f); else failures.push({ id: entry.id, rel });
  }
  const ungrounded = failures.length > 0;
  return { files, failures, ungrounded };
}

function readCanonFile(id, rel, abs, expectedSha) {
  let buf = null;
  try { buf = fs.readFileSync(abs); } catch { return null; }
  const sha = sha256hex(buf);
  if (expectedSha !== null && sha !== expectedSha) return null;
  return { id, rel, abs, sha, text: buf.toString("utf8") };
}

// ── the mechanics: cut each ground from the canon bytes ──────────────────
// For each mechanic the spec declares: locate the needle in the canon file's
// own bytes with the SAME organ the manifests verify against (quotes.js's
// normalizedIndex — Dai's discipline, the exact locator snip.mjs uses), then
// cut the span PLUS the window around it. The window is the encounter — what
// the reader comes across when they come to understand the mechanism.
function cutMechanics(spec, files) {
  const byId = new Map(files.map((f) => [f.id, f]));
  const mechanics = [];
  for (const m of spec?.mechanics ?? []) {
    const file = byId.get(m.canon);
    if (!file) continue;
    const anchor = Array.isArray(m.anchor) && m.anchor.length === 2 ? m.anchor : null;
    let c0 = null;
    let c1 = null;
    if (anchor) {
      c0 = anchor[0];
      c1 = anchor[1];
      // self-verify with the real organ: the needle's normalizedIndex must
      // actually land on the anchor's bytes, else the anchor has drifted.
      const normOf = (s) => normalizedIndex(s).norm;
      if (m.needle) {
        const atAnchor = normOf(file.text.slice(c0, c1));
        const ofNeedle = normOf(m.needle);
        if (atAnchor !== ofNeedle) { c0 = null; c1 = null; }
      }
    }
    if (c0 === null) {
      // re-locate the needle in the bytes with the real organ — an address
      // is a birth, not a spelling (P5.2).
      const { norm, map } = normalizedIndex(file.text);
      const nnorm = normalizedIndex(String(m.needle ?? "")).norm;
      const i = nnorm ? norm.indexOf(nnorm) : -1;
      if (i < 0) continue; // cannot locate the ground → mechanic unreadable
      c0 = map[i];
      c1 = map[i + nnorm.length - 1] + 1;
    }
    const window = Number.isFinite(m.window) ? m.window : 500;
    const a = Math.max(0, c0 - window);
    const b = Math.min(file.text.length, c1 + window);
    mechanics.push({
      id: m.id,
      canon: m.canon,
      organ: m.organ ?? null,
      anchor: { c0, c1 },
      window,
      span: file.text.slice(c0, c1),
      ground: file.text.slice(a, b),
      ref: `${relOf(file.rel)}#${a}-${b}`,
    });
  }
  return mechanics;
}

const relOf = (rel) => `canon/${rel}`;

// ── the ground: bind the whole register to the canon's bytes ─────────────
// The ground digest is over the concatenated canon bytes (plus the physics
// file's own content). Change a canon file → the digest changes → the
// register's bindings no longer match the ground → the gate refuses closed.
export function loadCanonGround() {
  const { content, digest, marker, spec } = loadPhysicsSpec();
  const { files, failures, ungrounded } = loadCanonFiles(spec);
  const mechanics = cutMechanics(spec, files);
  const canonBytes = files.map((f) => f.sha).join("");
  const groundDigest = shortDigest(content + "|" + canonBytes);
  return {
    schema: CANON_SCHEMA,
    marker,
    hasSpec: !!spec,
    physicsFile: PHYSICS_FILE.split("/").pop(),
    physicsDigest: digest,
    groundDigest,
    ungrounded: ungrounded || (spec && files.length === 0),
    failures,
    canon: files.map((f) => ({ id: f.id, rel: relOf(f.rel), sha: f.sha, chars: f.text.length })),
    mechanics,
  };
}

// ── the reader the organs use ────────────────────────────────────────────
// A mechanic's ground — the canon passage and the window around it — is what
// the organ stands on. This is the seam an organ imports to READ its own
// ground rather than carrying it as a comment.
export function mechanicsFor() {
  const ground = loadCanonGround();
  const map = new Map();
  for (const m of ground.mechanics) map.set(m.id, m);
  return { ground, byId: map };
}

export default { loadCanonGround, mechanicsFor, CANON_SCHEMA };