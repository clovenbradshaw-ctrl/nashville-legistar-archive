// fold-chat-agent.js — the agent's loop: plan → act → observe → repair.
//
// A single dispatch to the machine door answers once and stops. An agent works
// the way Claude Code does: it makes an attempt, LOOKS at what the attempt
// actually did, and goes again with what it saw until the work holds or the
// budget is spent. This module is that loop and nothing else. It is pure — the
// door (`dispatch`) and the eyes (`observe`) are injected — so the whole loop
// is testable in node with a fake bridge and a fake observer, and the browser
// supplies the real ones (client.code, and a sandboxed iframe that runs the
// artifact).
//
// The fold's doctrine holds inside the loop: a small model is never asked to
// judge its own work. What the artifact DID when it ran (an error, a blank
// page, a failed test, a control that threw when clicked) is the verdict, and
// the repair prompt carries that observed fact, not the model's opinion.
//
// Every step is an event handed to `emit`, so a surface can show the work as it
// happens — and a stored trace can be replayed through the same renderer.

import { splitToolCalls } from "./fold-chat-client.js";

export const DEFAULT_ROUNDS = 3;
export const MAX_ROUNDS = 6;

/** The artifact kind, from the text alone: a page, a script, or plain text.
 *  Deterministic — never the model's word. */
export function kindOf(text) {
  const t = String(text ?? "").trimStart();
  if (/^<!doctype html>/i.test(t) || /^<html[\s>]/i.test(t)) return "html";
  if (/^<[a-z][\w-]*[\s>\/]/i.test(t)) return "html";          // any leading tag: a fragment is still a page
  if (!t) return "empty";
  return /\b(function|const|let|var|=>|import|export|class)\b/.test(t) ? "js" : "text";
}

/** If the whole answer is ONE fenced block, hand back what is inside it. */
export function stripFence(text) {
  const t = String(text ?? "").trim();
  const m = t.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n?```$/);
  return m ? m[1] : t;
}

/** The short, honest plan for this run — mechanical, stated before acting so
 *  the person sees what the agent is about to do and how it will know. */
export function planFor(task, { maxRounds = DEFAULT_ROUNDS, hasTest = false, pipelines = {} } = {}) {
  const steps = [];
  if (pipelines.read) steps.push("khora reads the ask — what it names, what it leaves open");
  steps.push(pipelines.act === "khora" ? "the khora's agent loop works in its sandbox (list · read · write · run)" : "penelope composes the code (swarm → field → hunt → mouth), through heimdall");
  steps.push("run what comes back in a sandbox and look at what it does");
  if (pipelines.derive) steps.push("janus rules on what was observed — the engine decides, not the model");
  if (hasTest) steps.push("hold it to the behavioral test you attached");
  steps.push(`if it fails, go again with the measured problem (up to ${maxRounds} round${maxRounds === 1 ? "" : "s"})`);
  return steps;
}

/** The first prompt when the person reset to an earlier version: the code as it stood, then what to change. Only the WRITER sees this —
 *  the reader and the requirement check work from the person's own words, never from the page source. */
export function withBase(task, base) {
  if (!base || !base.code) return task;
  const html = base.kind === "html";
  return `Here is the current ${html ? "page" : "file"}. Change it as asked and reply with the whole updated file.\n\n\`\`\`${html ? "html" : "js"}\n${base.code}\n\`\`\`\n\nChange: ${task}`;
}

/** The next prompt: the task, the problems the last attempt actually showed. */
export function repairPrompt({ task, round, findings }) {
  const list = findings.map((f, i) => `${i + 1}. ${f}`).join("\n");
  return [
    `Fix the code you just wrote. This is attempt ${round}.`,
    `The original task: ${task}`,
    `When the code was run, it showed these problems:\n${list}`,
    "Return the complete corrected file only — no explanation, no partial diff.",
  ].join("\n\n");
}

const REFUSALISH = /^\(?(penelope's coding pipeline returned no artifact|the machine door returned no text|the machine door returned only a tool request)/i;

/** Turn one door answer into { text, calls }. A tool call returned as text is
 *  an invocation, not the answer. The penelope lane returns a clean artifact. */
export function readAnswer(out) {
  const raw = String(out?.text ?? "");
  if (out?.lane === "penelope-code-agent") return { text: raw, calls: [] };
  const { text, calls } = splitToolCalls(raw);
  return { text, calls };
}

/** What KIND of artifact the ask is for, read off its own words: a page (html) or "any". A model that answers a page
 *  request with a bare script has not done the task, however clean the script is — so the loop names it. */
export function expectedKind(task) {
  const t = String(task ?? "");
  if (/\b(html|web ?page|page|website|landing|dashboard|ui|interface|form|calculator|timer|counter|game|widget|app)\b/i.test(t) && /\b(button|display|show|click|field|input|page|html|screen|label|form|list)\b/i.test(t)) return "html";
  return "any";
}

/** The failing facts in one round: failing checks, a failed gate, an empty
 *  answer. Each is a sentence the next attempt can act on. */
export function findingsOf({ checks = [], verdict = null, text = "", calls = [], kind = null, expect = "any" }) {
  const out = [];
  if (!text.trim() || REFUSALISH.test(text.trim())) {
    out.push(calls.length
      ? `The answer was only a tool request (${calls.map((c) => c.name).join(", ")}) and no code was returned.`
      : "No code was returned.");
  }
  else if (expect === "html" && kind === "js") out.push("The ask is for a page, but the answer was a bare script. Return ONE complete HTML document (<!doctype html>, <html>, <style> and <script> inline) that builds the controls and display in the page itself.");
  else if (kind === "text") out.push(`The answer was prose, not code (${text.trim().length} chars). Return the complete file.`);
  if (verdict && verdict.ok === false) out.push(`The ${verdict.ownTest === false ? "generation gate" : "behavioral test"} failed: ${verdict.reason || "no reason given"}.`);
  for (const c of checks) if (c.ok === false) out.push(c.detail ? `${c.name}: ${c.detail}` : c.name);
  return out;
}

/** What the ask itself names that the page must show: controls ("Start, Pause
 *  and Reset buttons", "a Save button") and anything in quotes. Mechanical —
 *  read off the ask's own words, never guessed. The khora's referents are
 *  reported beside these, but only the ask's own named things are held to. */
export function requirementsOf(task) {
  const t = String(task ?? "");
  const out = new Map();
  const add = (term, kind) => { const k = String(term).trim().toLowerCase().replace(/\s+/g, " "); if (k.length >= 2 && k.length <= 24 && !out.has(k)) out.set(k, { term: k, kind }); };
  for (const m of t.matchAll(/["“`]([^"”`\n]{2,24})["”`]/g)) add(m[1], "quoted");
  const NOUN = "(?:buttons?|controls?|toggles?|links?|tabs?|inputs?|fields?|sliders?)";
  for (const m of t.matchAll(new RegExp("((?:[A-Z][\\w-]*(?:\\s*,\\s*(?:and\\s+|or\\s+)?|\\s+(?:and|or)\\s+))+[A-Z][\\w-]*)\\s+" + NOUN + "\\b", "g"))) {
    for (const w of m[1].split(/\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+/)) add(w, "control");
  }
  for (const m of t.matchAll(new RegExp("\\b([A-Z][\\w-]{1,20})\\s+" + NOUN + "\\b", "g"))) add(m[1], "control");
  // "10%, 15% and 20% tip buttons" — percentage labels, alone or in a list, with at most one word before the noun
  const PCT = "\\d+(?:\\.\\d+)?%";
  for (const m of t.matchAll(new RegExp("((?:" + PCT + "(?:\\s*,\\s*(?:and\\s+|or\\s+)?|\\s+(?:and|or)\\s+))*" + PCT + ")\\s+(?:[a-z]+\\s+)?" + NOUN + "\\b", "gi"))) {
    for (const w of m[1].split(/\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+/)) add(w, "control");
  }
  return [...out.values()];
}

/** The reasoning spec JANUS rules on, built from what the sandbox OBSERVED —
 *  every claim is a universal with its measured counterexamples, so the verdict
 *  is the engine's, not the agent's. `facts` is observeArtifact's facts. */
export function reasoningSpec({ facts, requirements = [] }) {
  const u = [];
  const at = (e) => `${e.message}${e.line ? ` (line ${e.line})` : ""}`;
  u.push({ ref: "u-load", end1: "the page", label: "loads without throwing", end2: "when it is opened", tested: 1,
    counterexamples: facts.loaded === false ? ["measured: the page never finished loading (it hung or blocked)"] : (facts.loadErrors || []).map((e) => `measured: loading threw ${at(e)}`) });
  if (facts.loaded !== false && facts.page !== false) u.push({ ref: "u-render", end1: "the page", label: "shows something", end2: "once it has loaded", tested: 1, counterexamples: facts.rendered ? [] : ["measured: the page is blank — no text, controls or visuals"] });
  if (facts.controls > 0) u.push({ ref: "u-click", end1: "every control on the page", label: "responds without throwing", end2: "when clicked", tested: Math.max(1, facts.clicked || 0),
    counterexamples: (facts.clickErrors || []).map((e) => `measured: a click threw ${at(e)}`) });
  if (requirements.length) {
    const hay = ((facts.labels || []).join(" | ") + " | " + (facts.text || "")).toLowerCase();
    const missing = requirements.filter((r) => !hay.includes(r.term));
    u.push({ ref: "u-ask", end1: "every control or text the ask names", label: "appears on the page", end2: "as the ask wrote it", tested: requirements.length,
      counterexamples: missing.map((r) => `measured: the page shows no “${r.term}” (the ask names it)`) });
  }
  return { universals: u };
}

/** The sentences the next attempt can act on, from janus's verdict: the
 *  measured counterexamples of every universal the engine refuted. */
export function refutedFindings(spec, verdict) {
  const refuted = new Set((verdict?.findings || []).filter((f) => f.kind === "universal_refuted" || f.severity === "error").map((f) => f.at));
  const out = [];
  for (const u of spec.universals || []) if (refuted.has(u.ref) || (!verdict && u.counterexamples.length)) out.push(...u.counterexamples);
  return out;
}

/** How long heimdall asked us to wait, if the refusal is a "busy — retry in Ns". */
export function busyWaitSeconds(err) {
  const m = String(err?.message || err || "").match(/retry in (\d+)\s*s/i);
  return m ? Math.min(120, Math.max(1, parseInt(m[1], 10))) : null;
}

/** Sleep that Stop can interrupt. Resolves true if it slept the whole time. */
export function abortableSleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(false);
    const t = setTimeout(() => { signal?.removeEventListener?.("abort", onAbort); resolve(true); }, ms);
    const onAbort = () => { clearTimeout(t); resolve(false); };
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

/**
 * Run the loop.
 *
 * @param task         the person's ask, verbatim
 * @param dispatch     async (prompt, { sessionId, round, verification, signal }) → the door's answer
 *                     { sessionId, text, activity, ms, lane, executed, agents }
 * @param observe      async (artifactText, { kind, round }) → { checks: [{ name, ok, detail?, info? }] }
 *                     (a check with ok:true is evidence; ok:false is a problem; ok:null is information)
 * @param read         async (task) → EORead@1   (khora reads the ask; optional, never fatal)
 * @param derive       async (spec) → { ok, findings }   (janus rules on the observed facts; optional)
 * @param actPipeline  "penelope" | "khora" — which pipeline the dispatch rides (shown, not branched on)
 * @param escalate     async (prompt, { round, prior, signal, onTry }) → door answer — a SEALED remote draw. Used when the local
 *                     machine is busy (>= escalateBusyS), slow (> slowAfterMs) or returns nothing usable; sticky once used.
 * @param base          { code, kind } — the version the person reset to; the first writer prompt carries it, nothing else does
 * @param onVersion    ({ round, text, kind, maker, activity, units, ms }) → void — each attempt's code the moment it lands, before it is observed (the fold keeps these)
 * @param deriveTimeoutMs janus is model-free and answers in ~1s when idle, but khora's proxy is single-threaded: measured 22–60s when it was busy
 *                     (36–48% of a run). The ruling gets this long, then the round is judged from the measured facts and the feed says so.
 * @param pageToRemote a request for a PAGE goes straight to the escalation maker: measured 4 of 4 times, penelope's local lane returned a bare
 *                     script for a page ask, so every local round was wasted time.
 * @param emit         (event) → void — every step, as it happens
 * @param signal       AbortSignal — Stop. Checked at every boundary and handed to dispatch.
 * @param maxRounds    the budget; the loop never exceeds it
 * @returns { ok, stopped, exhausted, error, rounds, artifact, sessionId, events }
 */
export async function runAgent({ task, dispatch, observe, read = null, derive = null, actPipeline = "penelope", emit = () => {}, signal = null, maxRounds = DEFAULT_ROUNDS, sessionId = null, verification = null, clock = () => Date.now(), sleep = abortableSleep, maxBusyWaits = 4, base = null, onVersion = null, deriveTimeoutMs = 4000, pageToRemote = true, escalate = null, slowAfterMs = 90000, escalateBusyS = 8 }) {
  const budget = Math.max(1, Math.min(MAX_ROUNDS, Math.floor(maxRounds) || DEFAULT_ROUNDS));
  const events = [];
  const t0 = clock();
  const ev = (type, data = {}) => { const e = { type, at: clock() - t0, ...data }; events.push(e); try { emit(e); } catch {} return e; };
  const rounds = [];
  let artifact = "";
  const result = (extra) => ({ ok: false, stopped: false, exhausted: false, error: null, rounds, artifact, sessionId, events, ms: clock() - t0, ...extra });

  ev("start", { task, maxRounds: budget });
  ev("plan", { steps: planFor(task, { maxRounds: budget, hasTest: !!verification, pipelines: { read: !!read, derive: !!derive, act: actPipeline } }) });

  // KHORA READS THE ASK — once, model-free. A reader that finds nothing says
  // so; it is never fatal and never invented around.
  let readInfo = null;
  if (read) {
    if (signal?.aborted) { ev("stopped", { round: 0 }); return result({ stopped: true }); }
    ev("reading", { pipeline: "khora" });
    const tRead = clock();
    try {
      readInfo = await read(task);
      ev("read", { pipeline: "khora", referents: (readInfo?.referents || []).length, relations: (readInfo?.relations || []).length, gaps: (readInfo?.gaps || []).length, ms: readInfo?.ms ?? clock() - tRead, names: (readInfo?.referents || []).slice(0, 6).map((r) => r.text || r.name || r.label || String(r)) });
    } catch (err) {
      if (signal?.aborted || err?.name === "AbortError") { ev("stopped", { round: 0 }); return result({ stopped: true }); }
      ev("read", { pipeline: "khora", error: String(err?.message || err) });
    }
  }
  const requirements = requirementsOf(task);
  ev("requirements", { terms: requirements.map((r) => r.term) });

  let prompt = withBase(task, base);
  const expect = base && base.kind === "html" ? "html" : expectedKind(task);   // editing a page stays a page, whatever the words say
  let findings = [];
  let escalated = false;
  let prevSigs = null;
  if (pageToRemote && escalate && actPipeline === "penelope" && expect === "html") {
    escalated = true;
    ev("escalate", { round: 1, why: "page", reason: "this is a web page, and the code writer on this computer only writes functions" });
  }
  for (let n = 1; n <= budget; n++) {
    if (signal?.aborted) { ev("stopped", { round: n }); return result({ stopped: true }); }
    ev("round", { round: n, of: budget, repair: n > 1 });
    if (n > 1) ev("repair", { round: n, findings });
    let out;
    const tAct = clock();
    // The local door, with a deadline when there is somewhere to escalate to: a
    // draw that has not come back in `slowAfterMs` is cancelled and escalated.
    const callLocal = async () => {
      const inner = new AbortController();
      const onOuter = () => inner.abort();
      signal?.addEventListener?.("abort", onOuter, { once: true });
      let slow = false;
      const timer = escalate && slowAfterMs > 0 ? setTimeout(() => { slow = true; inner.abort(); }, slowAfterMs) : null;
      try { return await dispatch(prompt, { sessionId, round: n, verification, signal: inner.signal }); }
      catch (e) { if (slow) throw Object.assign(new Error("the local machine is slow"), { slow: true }); throw e; }
      finally { clearTimeout(timer); signal?.removeEventListener?.("abort", onOuter); }
    };
    try {
      for (let waits = 0; ;) {
        const remote = escalated && !!escalate;
        ev("act", { round: n, pipeline: remote ? "remote" : actPipeline, prompt: prompt.length > 240 ? prompt.slice(0, 240) + "…" : prompt, continuing: !!sessionId && !remote });
        try {
          out = remote ? await escalate(prompt, { round: n, prior: artifact || null, signal, onTry: (model) => ev("try", { round: n, model }) }) : await callLocal();
          break;
        } catch (err) {
          if (signal?.aborted || err?.name === "AbortError") throw err;
          const secs = busyWaitSeconds(err);
          // Delay is not a reason to sit still when there is a sealed remote model
          // to go to: escalate at once, say why, and never wait a long busy hold.
          if (!remote && escalate && (err.slow || (secs != null && secs >= escalateBusyS))) {
            escalated = true;
            ev("escalate", { round: n, why: err.slow ? "slow" : "busy", reason: err.slow ? `the local machine took over ${Math.round(slowAfterMs / 1000)}s` : `the local machine is busy (~${secs}s)` });
            continue;
          }
          // A short busy hold is waited out (visibly; Stop interrupts it).
          if (remote || secs == null || waits >= maxBusyWaits) throw err;
          waits++;
          ev("wait", { round: n, seconds: secs + 1, attempt: waits, of: maxBusyWaits, reason: String(err.message).slice(0, 160) });
          if (!(await sleep((secs + 1) * 1000, signal))) { ev("stopped", { round: n }); return result({ stopped: true }); }
        }
      }
    } catch (err) {
      if (signal?.aborted || err?.name === "AbortError") { ev("stopped", { round: n }); return result({ stopped: true }); }
      ev("error", { round: n, message: String(err?.message || err), status: err?.status ?? null });
      return result({ error: String(err?.message || err) });
    }
    if (signal?.aborted) { ev("stopped", { round: n }); return result({ stopped: true }); }
    sessionId = out?.sessionId || sessionId;

    const { text: raw, calls } = readAnswer(out);
    const text = stripFence(raw);
    const kind = kindOf(text);
    for (const a of Array.isArray(out?.activity) ? out.activity : []) ev("tool", { round: n, tool: a.tool, status: a.status || "done", title: a.title || null });
    for (const c of calls) ev("tool", { round: n, tool: c.name, status: "requested", title: c.arguments?.filePath || c.arguments?.command || null });
    ev("acted", { round: n, ms: out?.ms ?? clock() - tAct, lane: out?.lane || null, executed: out?.executed !== false, chars: text.length, kind, model: out?.model || null, audit: out?.audit || null, escalated: !!out?.agents?.escalated || (escalated && !!escalate) });
    if (text.trim() && !REFUSALISH.test(text.trim()) && (kind === "html" || kind === "js")) artifact = text;
    if (onVersion && (kind === "html" || kind === "js") && text.trim() && !REFUSALISH.test(text.trim())) {
      const lane = out?.lane || "";
      const maker = lane === "sealed-remote" ? { kind: "remote", model: out?.model || null } : lane === "khora-agent" ? { kind: "agent-loop" } : { kind: "penelope" };
      try { onVersion({ round: n, text, kind, maker, activity: Array.isArray(out?.activity) ? out.activity : [], units: out?.agents?.units || [], ms: out?.ms ?? null }); } catch { /* the fold never blocks the work */ }
    }

    let checks = [], facts = null;
    if ((kind === "html" || kind === "js") && !REFUSALISH.test(text.trim())) {
      ev("observing", { round: n, kind });
      try { const o = await observe(text, { kind, round: n, signal }); checks = o?.checks ?? []; facts = o?.facts ?? null; }
      catch (err) { checks = [{ name: "observation", ok: null, detail: "the sandbox could not run this: " + String(err?.message || err) }]; }
      if (signal?.aborted) { ev("stopped", { round: n }); return result({ stopped: true }); }
      for (const c of checks) ev("check", { round: n, name: c.name, ok: c.ok, detail: c.detail || null });
    }
    const verdict = out?.agents?.verdict ?? null;
    if (verdict) ev("check", { round: n, name: verification ? "your behavioral test" : "penelope's own gate", ok: verdict.ok !== false, detail: verdict.reason || null });

    // JANUS RULES. What the sandbox measured becomes universals with their
    // counterexamples; the engine's own organs decide what holds. If janus
    // cannot be reached the round is judged from the measured facts directly,
    // and the feed says so — a missing ruling is never a silent pass.
    let roundFindings;
    let ruling = null;
    if (derive && facts) {
      const spec = reasoningSpec({ facts, requirements });
      ev("deriving", { round: n, pipeline: "janus", claims: spec.universals.length });
      const tD = clock();
      try {
        const dl = new AbortController(); const onOuter = () => dl.abort(); signal?.addEventListener?.("abort", onOuter, { once: true });
        let to = null;
        const deadline = new Promise((_, rej) => { to = setTimeout(() => { dl.abort(); rej(Object.assign(new Error(`no answer within ${Math.round(deriveTimeoutMs / 1000)}s`), { deadline: true })); }, deriveTimeoutMs); });
        try { ruling = await Promise.race([derive(spec, { signal: dl.signal }), deadline]); }
        finally { clearTimeout(to); signal?.removeEventListener?.("abort", onOuter); }
        const fs_ = Array.isArray(ruling?.findings) ? ruling.findings : [];
        ev("derive", { round: n, pipeline: "janus", ok: ruling?.ok !== false && !(ruling?.errors > 0), ms: clock() - tD, findings: fs_.map((f) => ({ at: f.at, kind: f.kind, severity: f.severity })), held: fs_.filter((f) => f.severity !== "error").length, refuted: fs_.filter((f) => f.severity === "error").length });
      } catch (err) {
        if (!err?.deadline && (signal?.aborted || err?.name === "AbortError")) { ev("stopped", { round: n }); return result({ stopped: true }); }
        ev("derive", { round: n, pipeline: "janus", error: String(err?.message || err), fallback: true });
        ruling = null;
      }
      const hard = findingsOf({ checks: [], verdict, text, calls, kind, expect });
      roundFindings = [...hard, ...refutedFindings(spec, ruling)];
    } else {
      roundFindings = findingsOf({ checks, verdict, text, calls, kind, expect });
    }
    findings = roundFindings;
    rounds.push({ n, ms: out?.ms ?? null, lane: out?.lane || null, kind, chars: text.length, checks, findings: [...findings], ruled: !!ruling });

    if (!findings.length) {
      ev("done", { ok: true, rounds: n, passed: checks.filter((c) => c.ok === true).length + (verdict?.ok ? 1 : 0) });
      return result({ ok: true });
    }
    if (n < budget && escalate && !escalated && (kind === "empty" || kind === "text" || REFUSALISH.test(text.trim()))) {
      escalated = true;
      ev("escalate", { round: n + 1, why: "empty", reason: "the local draw returned nothing usable" });
    }
    // STUCK: the repair came back with the same problems. Asking the same maker the same question again is not a plan —
    // change the maker. (Measured live: penelope's local lane can only compose JS functions, so a page request got the
    // same bare script on every one of three rounds.)
    const sig = (f) => String(f).toLowerCase().replace(/\(line \d+\)|\d+/g, "#").slice(0, 70);
    const nowSigs = new Set(findings.map(sig));
    if (n < budget && n > 1 && escalate && !escalated && findings.length && prevSigs && [...nowSigs].some((x) => prevSigs.has(x))) {
      escalated = true;
      ev("escalate", { round: n + 1, why: "stuck", reason: "the same problems came back after a repair" });
    }
    prevSigs = nowSigs;
    if (n < budget) {
      prompt = repairPrompt({ task, round: n + 1, findings });
    }
  }
  ev("done", { ok: false, rounds: budget, exhausted: true, findings });
  return result({ exhausted: true });
}
