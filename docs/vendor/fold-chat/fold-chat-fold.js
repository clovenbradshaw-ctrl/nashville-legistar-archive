// fold-chat-fold.js — the FOLD: one build, kept whole.
//
// A fold is the object an agent run leaves behind. It is three things at once, and
// the person can look at any of them:
//
//   the artifact   what exists NOW — the in-progress page, updated as each attempt lands
//   the log        the append-only record of how it got there: what was read, which maker drew
//                  which unit (penelope's field / hunt / mouth, a remote model, the agent loop),
//                  every EDIT between attempts (real line diffs), what was observed and ruled,
//                  and the fold step itself ("contributions → artifact")
//   the folded     the finished code, line by line, with WHO WROTE EACH LINE and in which attempt —
//   output         the contributions folded into one file with their provenance still on them
//
// The log is modelled on penelope's ArrangementEOT / Provenance@2 (stages intent → read → arrange →
// draw → fold → verify). Where penelope's pipeline reports a stage (the code lane returns each unit's
// outcome and the gate verdict), that is recorded as penelope's. Everything else — the edits between
// attempts, the sandbox's observations, janus's ruling, the escalation — is recorded by this app, and
// each entry says which it is (`by`). Nothing is reconstructed and presented as the pipeline's own.
//
// Pure: no DOM, no network. The viewer (fold-chat-foldview.js) reads it; the agent loop writes to it.

import { diffLines, diffStat, hunksOf } from "./fold-chat-workspace.js";

export const FOLD_SCHEMA = "Fold@1";
const MAX_VERSIONS = 8, MAX_CODE = 200_000, MAX_HUNK_LINES = 60, MAX_HUNKS = 12, MAX_LOG = 400;

export function createFold({ task = "", id = null, now = () => Date.now() } = {}) {
  return { schema: FOLD_SCHEMA, id: id || "fold_" + now().toString(36) + Math.random().toString(36).slice(2, 6), task: String(task), startedAt: now(), status: "running", versions: [], log: [], seq: 0, _now: now };
}

const clock = (f) => (typeof f._now === "function" ? f._now() : Date.now());
const lineCount = (s) => (s ? String(s).split("\n").length : 0);

/** Append one entry to the log. Append-only: nothing already in the log is ever changed. */
export function addLog(fold, { round = null, stage, by = "app", title = "", detail = "", tech = "", edit = null, unit = null, ok = null }) {
  if (fold.log.length >= MAX_LOG) return null;
  const e = { seq: ++fold.seq, at: clock(fold) - fold.startedAt, round, stage, by, title, detail, tech, edit, unit, ok };
  fold.log.push(e);
  return e;
}

/** What penelope's code lane reports per unit, as log entries. `activity` rows are { tool: stage, status, title: unit }. */
const PENELOPE_STAGES = { swarm: "arrange", field: "draw", hunt: "draw", mouth: "draw", gate: "verify" };

/**
 * A new version of the artifact landed (one per attempt).
 * v = { round, maker:{ kind:"penelope"|"agent-loop"|"remote", model? }, code, kind:"html"|"js"|…, ms?, activity?, units?, verdict? }
 */
export function addVersion(fold, v) {
  const code = String(v.code ?? v.text ?? "").slice(0, MAX_CODE);   // runAgent's onVersion hands the code over as `text`
  const prev = fold.versions[fold.versions.length - 1] || null;
  const diff = diffLines(prev ? prev.code : null, code);
  const stat = diffStat(diff);
  const hunks = prev ? hunksOf(diff, 2).slice(0, MAX_HUNKS).map((h) => ({ lines: h.lines.slice(0, MAX_HUNK_LINES) })) : [];
  const n = fold.versions.length + 1;
  const maker = v.maker || { kind: "unknown" };
  const rec = { n, round: v.round ?? n, maker, kind: v.kind || "text", code, chars: code.length, lines: lineCount(code), at: clock(fold) - fold.startedAt, ms: v.ms ?? null, units: (v.units || []).slice(0, 40), diffStat: stat, hunks, checks: [], problems: [], held: null };
  fold.versions.push(rec);
  if (fold.versions.length > MAX_VERSIONS) fold.versions.splice(1, fold.versions.length - MAX_VERSIONS);   // keep the first and the most recent

  const who = maker.kind === "remote" ? `remote:${maker.model || "model"}` : maker.kind === "penelope" ? "penelope" : maker.kind === "agent-loop" ? "khora" : "app";
  if (maker.kind === "penelope") {
    for (const a of v.activity || []) {
      const stage = PENELOPE_STAGES[a.tool] || "draw";
      addLog(fold, { round: rec.round, stage, by: "penelope", unit: a.tool === "gate" ? null : a.title || null, ok: a.status === "refused" || a.status === "walled" || a.status === "failed" ? false : true,
        title: a.tool === "gate" ? `gate · ${a.title || "verdict"}` : `${a.tool}${a.title ? " · " + a.title : ""}`, detail: a.status && a.status !== "done" ? a.status : "", tech: JSON.stringify(a) });
    }
  } else if (maker.kind === "remote") {
    addLog(fold, { round: rec.round, stage: "draw", by: who, title: `${maker.model || "a remote model"} wrote the ${prev ? "revised " : ""}file`, detail: `${rec.lines} lines`, tech: `sealed-external · ${maker.model || ""}` });
  } else if (maker.kind === "agent-loop") {
    addLog(fold, { round: rec.round, stage: "draw", by: who, title: "the agent loop wrote the file", detail: `${rec.lines} lines` });
  }
  if (prev) {
    addLog(fold, { round: rec.round, stage: "edit", by: "app", title: `attempt ${rec.round} changed the code`, detail: stat.added || stat.removed ? `+${stat.added} −${stat.removed} lines` : "no change", edit: { added: stat.added, removed: stat.removed, hunks: rec.hunks.length, versionN: n }, ok: stat.added + stat.removed > 0 });
  } else {
    addLog(fold, { round: rec.round, stage: "edit", by: "app", title: "first draft", detail: `${rec.lines} lines`, edit: { added: stat.added, removed: 0, hunks: 0, versionN: n }, ok: true });
  }
  addLog(fold, { round: rec.round, stage: "fold", by: maker.kind === "penelope" ? "penelope" : "app", title: "contributions → artifact", detail: `${rec.chars.toLocaleString("en-US")} chars${rec.units.length ? ` · ${rec.units.length} unit${rec.units.length === 1 ? "" : "s"}` : ""}`, tech: "ArrangementEOT fold step" });
  return rec;
}

/** Map one agent-loop event onto the log (and onto the version it concerns). */
export function addEvent(fold, e) {
  if (!e || !e.type) return null;
  const v = (n) => fold.versions.find((x) => x.round === n) || fold.versions[fold.versions.length - 1] || null;
  switch (e.type) {
    case "read":
      return addLog(fold, { round: 0, stage: "read", by: "khora", title: e.error ? "could not read the ask" : "read the ask", detail: e.error ? String(e.error).slice(0, 120) : `${e.referents || 0} referents · ${e.relations || 0} relations${e.gaps ? ` · ${e.gaps} gaps` : ""}`, ok: !e.error });
    case "requirements":
      return addLog(fold, { round: 0, stage: "read", by: "app", title: "what the page will be checked for", detail: (e.terms || []).map((t) => "“" + t + "”").join(" · ") || "nothing named", ok: true });
    case "escalate":
      return addLog(fold, { round: e.round ?? null, stage: "escalate", by: "app", title: "went to a stronger maker", detail: e.reason || e.why || "", ok: true });
    case "wait":
      return addLog(fold, { round: e.round ?? null, stage: "retry", by: "app", title: `machine busy — waiting ${e.seconds}s`, detail: `attempt ${e.attempt} of ${e.of}`, ok: null });
    case "repair":
      return addLog(fold, { round: e.round ?? null, stage: "repair", by: "app", title: `fixing ${e.findings.length} problem${e.findings.length === 1 ? "" : "s"}`, detail: e.findings.slice(0, 4).join(" | ").slice(0, 400), ok: null });
    case "check": {
      const ver = v(e.round);
      if (ver) { ver.checks.push({ name: e.name, ok: e.ok, detail: e.detail || null }); if (e.ok === false) ver.problems.push(e.detail ? `${e.name}: ${e.detail}` : e.name); }
      return addLog(fold, { round: e.round ?? null, stage: "observe", by: /gate|test/i.test(e.name) ? "penelope" : "sandbox", title: e.name, detail: e.detail || "", ok: e.ok });
    }
    case "derive":
      return addLog(fold, { round: e.round ?? null, stage: "verify", by: "janus", title: e.error ? "ruling unavailable" : e.ok ? "every claim holds" : `refuted ${e.refuted} claim${e.refuted === 1 ? "" : "s"}`, detail: e.error ? String(e.error).slice(0, 120) : `${e.held || 0} held`, ok: e.error ? null : !!e.ok });
    case "done": {
      const last = fold.versions[fold.versions.length - 1];
      fold.status = e.ok ? "held" : "gave-up";
      if (last) last.held = !!e.ok;
      return addLog(fold, { round: e.rounds ?? null, stage: "done", by: "app", title: e.ok ? "it holds" : "gave up", detail: e.ok ? `${e.rounds} attempt${e.rounds === 1 ? "" : "s"}, ${e.passed} check${e.passed === 1 ? "" : "s"} passed` : (e.findings || []).slice(0, 3).join(" | ").slice(0, 300), ok: !!e.ok });
    }
    case "stopped": fold.status = "stopped"; return addLog(fold, { round: e.round ?? null, stage: "done", by: "app", title: "stopped by you", ok: null });
    case "error": fold.status = "failed"; return addLog(fold, { round: e.round ?? null, stage: "done", by: "app", title: "failed", detail: String(e.message || "").slice(0, 200), ok: false });
    default: return null;
  }
}

/** The version to show as THE artifact: the one that held, else the latest html, else the latest. */
export function artifactOf(fold) {
  const vs = fold.versions;
  return vs.find((x) => x.held) || [...vs].reverse().find((x) => x.kind === "html") || vs[vs.length - 1] || null;
}

/**
 * The folded output: the artifact's lines, each with the attempt and maker that WROTE it. A line carried unchanged
 * from an earlier attempt keeps its original author; a line added or rewritten belongs to the attempt that did it.
 * Where a penelope version named its units, lines are also tagged with the unit they sit in.
 */
export function foldedLines(fold, version = artifactOf(fold)) {
  if (!version) return [];
  const upto = fold.versions.indexOf(version);
  let cur = [];
  for (let k = 0; k <= upto; k++) {
    const ver = fold.versions[k];
    const text = ver.code.split("\n");
    if (k === 0) { cur = text.map((t) => ({ text: t, round: ver.round, maker: ver.maker })); continue; }
    const prevLines = cur;
    const d = diffLines(fold.versions[k - 1].code, ver.code);
    const next = []; let i = 0;
    for (const h of d) {
      if (h.op === "eq") { next.push(prevLines[i] ? { ...prevLines[i], text: h.line } : { text: h.line, round: ver.round, maker: ver.maker }); i++; }
      else if (h.op === "del") i++;
      else next.push({ text: h.line, round: ver.round, maker: ver.maker });
    }
    cur = next;
  }
  // unit tags: a unit runs from the line that defines it to the line before the next unit's definition
  const names = (version.units || []).map((u) => (typeof u === "string" ? u : u?.name)).filter(Boolean);
  if (names.length) {
    const starts = [];
    cur.forEach((l, idx) => { for (const nm of names) if (new RegExp("(?:function\\s*\\*?\\s*|(?:const|let|var)\\s+|class\\s+)" + nm.replace(/[$]/g, "\\$&") + "\\b").test(l.text)) { starts.push([idx, nm]); break; } });
    starts.forEach(([idx, nm], s) => { const end = s + 1 < starts.length ? starts[s + 1][0] : cur.length; for (let j = idx; j < end; j++) cur[j] = { ...cur[j], unit: nm }; });
  }
  return cur.map((l, i) => ({ n: i + 1, ...l }));
}

/**
 * The FRAMES of a fold: the moments the CONTENT changes — not the actions taken about it (reading the ask, checking, escalating).
 * Frame 0 is the empty start. Then, per attempt:
 *   the first draft  → one frame per unit as it is folded in (penelope's units), or one frame if the code has none;
 *   a later attempt  → one frame per CHANGE (a run of added/removed lines), applied in order to the attempt before;
 *   an identical re-draft → no frame at all (nothing changed).
 * Every frame holds the full code as it stood, so any frame can be shown, replayed or reset to. Pure.
 *   frame = { n, round, versionN, kind:"start"|"first"|"unit"|"change"|"revision", label, code, complete, step:[k,m]|null, added, removed }
 *   `complete` is true on the last frame of an attempt — the whole attempt, not a half-applied one.
 */
export function framesOf(fold) {
  const frames = [{ n: 0, round: null, versionN: null, kind: "start", label: "the ask", code: "", complete: false, step: null, added: 0, removed: 0 }];
  const push = (f) => frames.push({ n: frames.length, step: null, complete: false, added: 0, removed: 0, ...f });
  fold.versions.forEach((v, i) => {
    const prev = i > 0 ? fold.versions[i - 1] : null;
    const diff = diffLines(prev ? prev.code : null, v.code);
    const stat = diffStat(diff);
    if (prev && !stat.added && !stat.removed) return;                 // the same code again changed nothing
    const base = { round: v.round, versionN: v.n };
    if (!prev) {
      const lines = foldedLines(fold, v), order = [];
      for (const l of lines) if (l.unit && !order.includes(l.unit)) order.push(l.unit);
      if (order.length >= 2) {
        order.forEach((u, k) => {
          const keep = new Set(order.slice(0, k + 1));
          let end = -1; lines.forEach((l, idx) => { if (l.unit && keep.has(l.unit)) end = idx; });
          const last = k === order.length - 1;
          push({ ...base, kind: "unit", label: `unit ${u}`, code: last ? v.code : lines.slice(0, end + 1).map((l) => l.text).join("\n"), complete: last, step: [k + 1, order.length], added: last ? stat.added : 0, removed: 0 });
        });
        return;
      }
      push({ ...base, kind: "first", label: "first draft", code: v.code, complete: true, added: stat.added, removed: 0 });
      return;
    }
    // changes = runs of consecutive non-equal ops; frame k applies the first k of them to the attempt before
    const groupOf = []; let g = 0, inRun = false;
    diff.forEach((d, j) => { if (d.op === "eq") { inRun = false; groupOf[j] = 0; } else { if (!inRun) { g++; inRun = true; } groupOf[j] = g; } });
    const m = g;
    if (m < 2 || m > 12) { push({ ...base, kind: "revision", label: `attempt ${v.round}`, code: v.code, complete: true, added: stat.added, removed: stat.removed }); return; }
    for (let k = 1; k <= m; k++) {
      const out = []; let added = 0, removed = 0;
      diff.forEach((d, j) => {
        const gj = groupOf[j];
        if (d.op === "eq") out.push(d.line);
        else if (gj <= k) { if (d.op === "add") out.push(d.line); }   // applied: the new line is in, the old one is out
        else if (d.op === "del") out.push(d.line);                      // not yet applied: the old line is still there
        if (gj === k) { if (d.op === "add") added++; else if (d.op === "del") removed++; }
      });
      push({ ...base, kind: "change", label: `change ${k} of ${m}`, code: out.join("\n"), complete: k === m, step: [k, m], added, removed });
    }
  });
  return frames;
}

/** Who wrote how much of the folded output — a one-line honest summary. */
export function authorship(lines) {
  const by = new Map();
  for (const l of lines) { const k = l.maker?.kind === "remote" ? `remote:${l.maker.model || ""}` : l.maker?.kind || "?"; by.set(k, (by.get(k) || 0) + 1); }
  return [...by.entries()].map(([k, n]) => ({ maker: k, lines: n, share: lines.length ? n / lines.length : 0 })).sort((a, b) => b.lines - a.lines);
}

/** A copy safe to store on a message: bounded and JSON-clean. */
export function snapshot(fold) {
  const { _now, ...rest } = fold;
  return JSON.parse(JSON.stringify(rest));
}

/** Rehydrate a stored snapshot into something the viewer can read (and, if needed, keep appending to). */
export function revive(snap, now = () => Date.now()) {
  if (!snap || snap.schema !== FOLD_SCHEMA) return null;
  return { ...snap, _now: now };
}

export const LOG_STAGES = Object.freeze({ read: "read", arrange: "arrange", draw: "draw", edit: "edit", fold: "fold", observe: "observe", verify: "verify", repair: "repair", escalate: "escalate", retry: "retry", done: "done" });
