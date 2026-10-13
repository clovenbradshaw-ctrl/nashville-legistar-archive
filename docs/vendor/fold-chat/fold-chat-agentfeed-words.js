// fold-chat-agentfeed-words.js — every word the agent run feed shows a person.
//
// One pure module (no DOM, no clock): describe(event, context) turns one event
// from runAgent (fold-chat-agent.js) into plain sentences. The feed
// (fold-chat-agentfeed.js) only places them. Keeping the wording here means it
// is unit-tested and changed in one place.
//
//   describe(event, ctx) → { title, detail, bullets, tech, tone, … }
//     title    the one line a person reads for this step
//     detail   one short sentence under it ("" when the title says it all)
//     bullets  plain list items (problems, checks) — already de-duplicated
//     tech     the OLD technical text, byte for byte, behind a "details" toggle
//     tone     ok | bad | warn | info | stop — the feed colours by it
//
// Default text never uses the fold's internal vocabulary (see BANNED in the
// test). Anything free-form that arrives from elsewhere — a model's reason, a
// bridge error — goes through plain()/scrub() so a stray internal word cannot
// leak into the visible line; the original is kept in `tech`.

const plural = (n, w, ws = w + "s") => `${n} ${n === 1 ? w : ws}`;
const cap = (s) => { const t = String(s ?? ""); return t.charAt(0).toUpperCase() + t.slice(1); };
const q = (s) => `“${s}”`;
const NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** 840ms · 3.2s · 41s · 2m 05s — mirrored by secs() in the feed (re-exported there). */
export const secsOf = (ms) => {
  if (!(ms >= 0)) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 10000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 120000) return `${Math.round(ms / 1000)}s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};
const sizeOf = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} chars`);
const bytesOf = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);
const kbOf = (n) => (n >= 1024 ? `${Math.round(n / 1024)} KB` : "under 1 KB");

/** Which stage of the run a plan line stands for (the planFor wording in fold-chat-agent.js). */
export function stageOfStep(step) {
  const s = String(step ?? "").toLowerCase();
  if (/^khora reads/.test(s)) return "read";
  if (/^janus rules/.test(s)) return "rule";
  if (/^run what comes back/.test(s)) return "run";
  if (/^hold it to the behavioral test/.test(s)) return "test";
  if (/^if it fails/.test(s)) return "repair";
  if (/composes the code|agent loop/.test(s)) return "act";
  return null;
}

/** The plain name of a plan stage. `step` is the original planFor line (for the attempt budget). */
export function planLabel(stage, step = "") {
  switch (stage) {
    case "read": return "Understand your request";
    case "act": return "Write the code";
    case "run": return "Try it out";
    case "rule": return "Check the results";
    case "test": return "Check it against the test you attached";
    case "repair": { const m = String(step).match(/up to (\d+)/i); return m && +m[1] > 1 ? `Fix anything that's wrong (up to ${m[1]} attempts)` : "Fix anything that's wrong"; }
    default: return cap(scrub(step));
  }
}

/** The one-line plan header: "Here's what I'll do" + progress. */
export const planHeader = (n, done) => `Here's what I'll do · ${done ? `${done} of ${n} done` : plural(n, "step")}`;

// ---------- keeping the fold's own words out of visible text ----------

const SCRUB = [
  [/\bmeasured:\s*/gi, ""],
  [/\b(?:heimdall|khora|janus|penelope)(?:'s)?\b/gi, "the system"],
  [/\bsealed[- ]external\b|\bsealed[- ]remote\b|\bsealed\b/gi, "private"],
  [/\bsandbox(?:ed)?\b/gi, "test area"],
  [/\bledger\b/gi, "record"],
  [/\bfrontier\b/gi, "stronger"],
  [/\brefuted\b/gi, "failed"],
  [/\bclaims?\b/gi, "checks"],
  [/\bpipeline\b/gi, "process"],
  [/\bUncaught\s+/g, ""],
  [/\bUnexpected token\s+['"“]?([^'"”\s]+)['"”]?/gi, "Unexpected “$1”"],
  [/\btokens?\b/gi, "word"],
  [/\b(?:the )?(?:door|lane|mouth|gate)\b/gi, "service"],
];
/** Replace internal vocabulary in free text we did not write (model reasons, bridge errors). */
export const scrub = (s) => SCRUB.reduce((t, [re, to]) => t.replace(re, to), String(s ?? "")).replace(/\s{2,}/g, " ").trim();

// ---------- problems and checks, in plain sentences ----------

const loadError = (msg) => `The page opens with an error: ${scrub(msg)}`;
const clickError = (msg) => {
  let m = scrub(msg).replace(/^\w*Error:\s*/, "");
  const at = m.match(/^(.*?)\s+at\s+([A-Za-z_$][\w$]*)$/);
  if (at) return `Clicking ${q(cap(at[2]))} causes an error: ${at[1]}`;
  return `Clicking a button causes an error: ${m}`;
};

/** One measured problem (a repair finding or a failing check) → one plain sentence. */
export function plainProblem(raw) {
  const t0 = String(raw ?? "").trim().replace(/^measured:\s*/i, "");
  let m;
  if (/the page never finished loading/i.test(t0)) return "The page never finished opening";
  if ((m = t0.match(/^loads without errors:\s*(.+)$/is))) return loadError(m[1]);
  if ((m = t0.match(/^loading threw\s+(.+)$/is))) return loadError(m[1]);
  if (/(^|: )the page is blank/i.test(t0)) return "The page is blank";
  if ((m = t0.match(/the page shows no [“"](.+?)[”"]/i))) return `I can't find ${q(cap(m[1]))} on the page — you asked for it`;
  if ((m = t0.match(/a click threw:?\s*(.+)$/is))) return clickError(m[1]);
  if (/^controls respond:/i.test(t0)) return cap(scrub(t0.replace(/^controls respond:\s*/i, "")));
  if (/^The ask is for a page, but the answer was a bare script/i.test(t0)) return "You asked for a web page, but I wrote a script instead of a page";
  if (/^No code was returned/i.test(t0)) return "No code came back";
  if (/^The answer was only a tool request/i.test(t0)) return "The AI asked to use a tool instead of writing code";
  if (/^The answer was prose, not code/i.test(t0)) return "The AI answered in sentences instead of writing code";
  if ((m = t0.match(/^The generation gate failed:\s*(.*?)\.?$/is))) return `It didn't pass the built-in quality check${m[1] && !/^no reason/i.test(m[1]) ? `: ${scrub(m[1])}` : ""}`;
  if ((m = t0.match(/^The behavioral test failed:\s*(.*?)\.?$/is))) return `It doesn't pass the test you attached${m[1] && !/^no reason/i.test(m[1]) ? `: ${scrub(m[1])}` : ""}`;
  if ((m = t0.match(/^renders something visible:\s*(.+)$/is))) return cap(scrub(m[1]));
  return cap(scrub(t0));
}

/** De-duplicated plain problems, in order. */
export const plainProblems = (list) => [...new Set((list || []).map(plainProblem).filter(Boolean))];

/** One sandbox/gate check → { tone, text } as a plain statement. Failing checks speak as problems. */
export function plainCheck(name, ok, detail = null) {
  const n = String(name || "").toLowerCase();
  if (n === "your behavioral test") return ok === false ? { tone: "bad", text: plainProblem(`The behavioral test failed: ${detail || "no reason given"}.`) } : { tone: "ok", text: "It passes the test you attached" };
  if (n === "penelope's own gate") return ok === false ? { tone: "bad", text: plainProblem(`The generation gate failed: ${detail || "no reason given"}.`) } : { tone: "ok", text: "It passed the built-in quality check" };
  if (n === "loads without errors") return ok === true ? { tone: "ok", text: "The page opens without errors" } : { tone: "bad", text: plainProblem(`loads without errors: ${detail || "the page never finished loading"}`) };
  if (n === "renders something visible") return ok === true ? { tone: "ok", text: "The page shows something on screen" } : { tone: "bad", text: "The page is blank" };
  if (n === "controls respond") {
    if (ok === true) { const c = String(detail || "").match(/clicked (\d+)/); return { tone: "ok", text: c ? (+c[1] === 1 ? "The button responds when clicked" : `All ${c[1]} buttons respond when clicked`) : "The buttons respond when clicked" }; }
    if (ok === false) return { tone: "bad", text: plainProblem(`a click threw: ${String(detail || "").replace(/^a click threw:?\s*/, "")}`) };
    return { tone: "info", text: "I couldn't confirm the buttons respond — the test didn't finish" };
  }
  if (n === "console") return { tone: "info", text: `The page printed messages while running: ${scrub(detail || "")}`.trim() };
  if (n === "runs as code") return { tone: "info", text: "This isn't a page or a script, so there was nothing to try out" };
  if (n === "observation") return { tone: "info", text: `I couldn't try it out: ${scrub(String(detail || "").replace(/^the sandbox could not run this:\s*/i, ""))}` };
  const tone = ok === true ? "ok" : ok === false ? "bad" : "info";
  return { tone, text: cap(scrub(detail ? `${name}: ${detail}` : name)) };
}

/** "Increment, Decrement and Reset" */
export function listOf(items) {
  const a = (items || []).map(String);
  return a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
}

/** The ask's named controls, in plain words. */
export function askedFor(terms) {
  const t = (terms || []).map(cap);
  if (!t.length) return "I didn't find specific buttons or labels to check for.";
  return `You asked for ${listOf(t)}. I'll check the page has ${t.length === 1 ? "it" : "each one"}.`;
}

/** Why we went online, in plain words. */
export function whyOnline(e = {}) {
  const r = String(e.reason || "");
  if (e.why === "slow") { const m = r.match(/over (\d+)s/); return `the AI on this computer was taking too long${m ? ` (over ${m[1]} seconds)` : ""}`; }
  if (e.why === "busy") { const m = r.match(/~(\d+)s/); return `this computer's AI was busy${m ? ` (about ${m[1]} seconds' wait)` : ""}`; }
  if (e.why === "empty") return "the last attempt came back with nothing usable";
  return scrub(r) || "this computer couldn't do it in time";
}
export const REASSURANCE = "Only your request and the code so far are sent, with names, folder paths, emails and keys swapped for placeholders. The code itself can still be read. Nothing else from your computer leaves it.";

/** A bridge/door error → { text, detail } in plain words. */
export function plainError(message) {
  const m = String(message ?? "");
  if (/every server is busy|retry in \d+\s*s|is busy/i.test(m)) {
    const w = m.match(/retry in (\d+)\s*s/i) || m.match(/least wait is ~(\d+)s/i);
    return { text: "The AI is too busy right now", detail: w ? `Try again in about ${w[1]} seconds.` : "Try again in a little while." };
  }
  if (/not allowed|refused|\b40[13]\b|forbidden/i.test(m)) return { text: "The AI service wouldn't take this request", detail: "That AI isn't allowed for this kind of job. Try again, or pick a different one." };
  if (/timed? ?out|took too long|deadline/i.test(m)) return { text: "The AI took too long to answer", detail: "Try again in a moment." };
  if (/no (?:coding |code )?(?:machine|door|model|server).*(?:attached|connected|available|configured)|not attached|nothing attached|no machine/i.test(m)) return { text: "No AI is connected to write code", detail: "Connect one, then try again." };
  if (/failed to fetch|network|offline|ECONN|unreachable|couldn't reach|could not reach/i.test(m)) return { text: "I couldn't reach the AI", detail: "Check that it's running and you're online, then try again." };
  return { text: scrub(m) || "Something unexpected happened", detail: "" };
}

const KIND_WORDS = { html: "a web page", js: "a script", text: "text, not code", empty: "nothing" };

const TOOL_VERBS = [
  [/^(read|view|open|cat)$/i, "Looked at file", "look at file"],
  [/^(write|create|save)$/i, "Wrote file", "write file"],
  [/^(edit|patch|apply_patch|replace|update)$/i, "Changed file", "change file"],
  [/^(list|ls|glob|find|tree)$/i, "Looked at the files", "look at the files"],
  [/^(grep|search|rg)$/i, "Searched the files", "search the files"],
  [/^(run|bash|sh|shell|exec|execute|node|test)$/i, "Ran the code", "run the code"],
];
/** A tool call → { title, detail }. */
export function toolWords(e) {
  const name = String(e.tool || "tool");
  const hit = TOOL_VERBS.find(([re]) => re.test(name));
  const asked = e.status === "requested";
  const base = hit ? (asked ? `Asked to ${hit[2]}` : hit[1]) : (asked ? "Asked to use a tool" : "Used a tool");
  const target = e.title ? scrub(e.title) : "";
  return { title: base, detail: target, tech: `${cap(name)}${e.title ? `(${e.title})` : ""}${e.status && e.status !== "done" ? ` [${e.status}]` : ""}` };
}

// ---------- describe ----------

const none = (tone = "info") => ({ title: "", detail: "", bullets: [], tech: "", tone });

/**
 * One event → plain words. `ctx` (all optional):
 *   live        the run is in progress (changes tenses/counting down)
 *   left        seconds left on a busy wait
 *   remote      this act/acted is the online AI
 *   continuing  this local act revises earlier code
 *   terms       the ask's named controls (for the "understanding" step)
 *   canGoOnline escalation is available (slow-step hint)
 *   tries       how many online services were tried so far
 */
export function describe(e, ctx = {}) {
  const ev = e || {};
  switch (ev.type) {
    case "start": return { ...none(), tech: `start · ${ev.task ? `“${String(ev.task).slice(0, 80)}”` : ""}` };
    case "plan": {
      const steps = Array.isArray(ev.steps) ? ev.steps : [];
      const bullets = steps.map((s) => planLabel(stageOfStep(s), s));
      return { title: "Here's what I'll do:", detail: "", bullets, tech: steps.join("\n"), tone: "info" };
    }
    case "reading": return { title: "Understanding your request", detail: "", bullets: [], tech: "Read the ask (khora)", tone: "info" };
    case "read": {
      if (ev.error) return { title: "Understanding your request", detail: "I couldn't study it in depth, so I'm going ahead without that.", bullets: [], tech: `did not answer — going on without it\n${ev.error}`, tone: "info" };
      const none_ = !ev.referents && !ev.relations;
      const base = (none_ ? "no referents or relations" : `${plural(ev.referents, "referent")} · ${plural(ev.relations, "relation")}`) + (ev.gaps ? ` · ${plural(ev.gaps, "gap")} disclosed` : "") + (!none_ && ev.names?.length ? " · " + ev.names.join(", ") : "");
      return { title: "Understanding your request", detail: "", bullets: [], tech: base, tone: "ok" };
    }
    case "requirements": {
      const terms = ev.terms || [];
      return { title: "Understanding your request", detail: askedFor(terms), bullets: [], tech: terms.length ? "held to " + terms.map((t) => "“" + t + "”").join(" ") : "the ask names no controls to hold the page to", tone: "info" };
    }
    case "round": return { title: `Attempt ${ev.round} of ${ev.of}`, detail: "", bullets: [], tech: `Round ${ev.round} of ${ev.of}${ev.repair ? " · repairing" : ""}`, tone: "info" };
    case "repair": {
      const list = plainProblems(ev.findings);
      const n = list.length;
      return {
        title: `Attempt ${ev.round ?? ctx.round ?? "?"}${ctx.of ? ` of ${ctx.of}` : ""} — fixing ${plural(n, "problem")}${n ? ":" : ""}`,
        detail: "", bullets: list, tone: "warn",
        tech: `Round ${ev.round ?? ctx.round} · repairing — ${plural((ev.findings || []).length, "problem")}:\n` + (ev.findings || []).map((f) => `– ${f}`).join("\n"),
      };
    }
    case "act": {
      const remote = ev.pipeline === "remote";
      const lab = remote ? "Ask a remote model" : ev.pipeline === "khora" ? (ev.continuing ? "Revise in the agent loop" : "Agent loop") : (ev.continuing ? "Revise" : "Compose");
      const attr = remote ? "sealed" : ev.pipeline === "khora" ? "khora" : "penelope";
      return { title: remote ? "Waiting for the online AI" : ev.continuing ? "Fixing the code…" : "Writing the code…", detail: "", bullets: [], tech: `${lab} (${attr})`, tone: "info" };
    }
    case "try": return { title: "", detail: ctx.tries > 1 ? "That one didn't answer — trying another online AI…" : "Contacting an online AI service…", bullets: [], tech: `trying ${ev.model}…`, tone: "info" };
    case "wait": {
      const left = ctx.live && ctx.left != null ? Math.max(0, ctx.left) : ev.seconds;
      const when = ctx.live ? (left > 0 ? `trying again in ${left}s` : "trying again now") : `waited ${ev.seconds}s, then tried again`;
      return { title: "The AI is busy right now", detail: `${when} (attempt ${ev.attempt} of ${ev.of})`, bullets: [], tech: `Machine busy — ${ctx.live ? `retrying in ${ev.seconds}s` : `waited ${ev.seconds}s`} · attempt ${ev.attempt}/${ev.of}\n${String(ev.reason ?? "")}`, tone: "warn" };
    }
    case "escalate": {
      const why = whyOnline(ev);
      const clause = String(ev.reason || "").replace(/^the local machine is /i, "local is ").replace(/^the local machine took /i, "local took ").replace(/^the local draw /i, "local draw ");
      return {
        title: "Asking a more powerful AI online for help", detail: cap(why), bullets: [REASSURANCE], tone: "warn",
        tech: `Escalating to a sealed remote model ${clause ? "— " + clause : ""}\nonly your task text and the last attempt's code leave this machine, de-identified (names, paths, emails, keys → placeholders, mapped back here), through heimdall's sealed-external gate — never workspace files`,
      };
    }
    case "tool": { const t = toolWords(ev); return { title: t.title, detail: t.detail, bullets: [], tech: t.tech, tone: "info" }; }
    case "acted": {
      const remote = ctx.remote || ev.lane === "sealed-remote";
      const lane = ev.lane === "sealed-remote" ? `${ev.model || "remote"} · sealed-external` : ev.lane === "khora-agent" ? "agent loop finished" : (ev.lane || "door");
      const tech = `answered · ${lane} · ${ev.kind} · ${sizeOf(ev.chars)}${ev.executed === false ? " · composed, not executed" : ""}${ev.escalated ? " · escalated to the frontier" : ""}`;
      const what = KIND_WORDS[ev.kind] || "an answer";
      const got = ev.kind === "text" ? "It came back as text, not code." : ev.kind === "empty" ? "Nothing usable came back." : `It's ${what}.`;
      return { title: remote ? "The online AI answered" : ctx.continuing ? "Fixed the code" : "Wrote the code", detail: got, bullets: [], tech, tone: ev.kind === "html" || ev.kind === "js" ? "ok" : "warn" };
    }
    case "observing": return { title: ev.kind === "html" ? "Trying it out — opening the page and clicking every button" : "Trying it out — running the code", detail: "", bullets: [], tech: ev.kind === "html" ? "Run in sandbox and click its controls (sandbox)" : "Run in sandbox (sandbox)", tone: "info" };
    case "check": {
      const c = plainCheck(ev.name, ev.ok, ev.detail);
      return { title: c.text, detail: "", bullets: [], tech: ev.detail ? `${ev.name}: ${ev.detail}` : String(ev.name ?? ""), tone: c.tone, ok: ev.ok };
    }
    case "deriving": return { title: "Checking the results", detail: "", bullets: [], tech: `Rule (janus) on ${plural(ev.claims, "claim")}`, tone: "info" };
    case "derive": {
      if (ev.error) return { title: "Checking the results", detail: "The extra check wasn't available, so I judged from what I saw directly.", bullets: [], tech: `could not be reached — judged from the measured facts\n${ev.error}`, tone: "info" };
      if (ev.ok) return { title: "Checking the results", detail: "Everything I measured is fine", bullets: [], tech: `every claim holds · ${ev.held || (ev.findings || []).length} held · none refuted`, tone: "ok" };
      const n = ev.refuted;
      return { title: "Checking the results", detail: n > 0 ? `${plural(n, "check")} failed` : "Some checks failed", bullets: [], tech: `refuted ${plural(ev.refuted, "claim")} — the engine's veto, not the model's opinion · ${ev.held || 0} held`, tone: "bad" };
    }
    case "audit": {
      const entries = ev.entries || [], sum = ev.summary || {};
      const n = entries.length;
      const L = { gate: "raw · the provider can read it", masked: "private details masked", abstract: "abstracted", worlds: "possible worlds", direct: "direct from this page" };
      const tech = `${plural(n, "request")} left this machine (audit)\n` + [`${(sum.hosts || []).map((h) => h.host).join(", ") || "—"} · ${bytesOf(sum.bytes || 0)}${sum.leaks ? ` · ⚠ ${sum.leaks} leak(s) flagged` : " · no leaks flagged"}`]
        .concat(entries.map((x) => `${x.model || x.host} · ${L[x.level] || x.level} · ${x.bytes} B · ${x.verified === true ? "ledger agrees" : x.verified === false ? "ledger DISAGREES: " + (x.problems?.[0] ?? "") : x.via === "direct" ? "no second ledger (direct)" : "not yet verified"}${x.status === "failed" ? " · failed" : ""}`)).join("\n");
      const direct = n > 0 && entries.every((x) => x.via === "direct" || x.level === "direct");
      const bad = entries.some((x) => x.verified === false || x.leaks) || sum.leaks > 0;
      const allOk = n > 0 && entries.every((x) => x.verified === true);
      const raw = entries.some((x) => x.level === "gate");
      const summarised = entries.some((x) => x.level === "abstract" || x.level === "worlds");
      const masked = entries.some((x) => x.level === "masked");
      const bullets = [];
      if (raw) bullets.push("The outside service can read this text.");
      else if (masked) bullets.push("Names, folder paths, emails and keys were swapped for placeholders before sending. The code itself can still be read.");
      else if (summarised) bullets.push("Only a summary was sent, not your exact words.");
      const verdict = bad ? { tone: "bad", text: "Something was sent that I didn't intend — open it to see" }
        : allOk ? { tone: "ok", text: "Double-checked: what was sent matches what I meant to send" }
        : direct ? null : { tone: "info", text: "Not double-checked yet" };
      return {
        title: n > 1 ? `Sent ${n} requests to an outside AI service` : "Sent to an outside AI service",
        detail: `Your request and the code so far (${kbOf(sum.bytes || 0)}). Nothing else.`,
        bullets, verdict, tone: bad ? "bad" : "info",
        links: entries.map((x) => ({ id: x.id, label: "show exactly what was sent" })),
        tech,
      };
    }
    case "done": {
      const secs = secsOf(ev.at || 0);
      if (ev.ok) return { title: `Done — it works. ${plural(ev.rounds, "attempt")}, ${secs}.`, detail: "", bullets: [], tech: `it holds — ${plural(ev.rounds, "round")}, ${plural(ev.passed, "check")} passed · ${secs}`, tone: "ok" };
      return {
        title: `I couldn't get it working after ${plural(ev.rounds, "attempt")}.`,
        detail: "The closest version is below, and here's what's still wrong:",
        bullets: plainProblems(ev.findings), tone: "bad",
        tech: `gave up — still failing after ${plural(ev.rounds, "round")} · ${secs}\nthe last attempt is below, with what was wrong:\n` + (ev.findings || []).map((f) => `– ${f}`).join("\n"),
      };
    }
    case "stopped": return { title: "Stopped.", detail: "", bullets: [], tech: `stopped by you · ${secsOf(ev.at || 0)}`, tone: "stop" };
    case "error": {
      const p = plainError(ev.message);
      return { title: `Something went wrong: ${p.text.charAt(0).toLowerCase()}${p.text.slice(1)}.`, detail: p.detail, bullets: [], tech: `the run failed\n${String(ev.message ?? "")}`, tone: "bad" };
    }
    default: return none();
  }
}

/** The live status line's verb, in plain words. */
export function liveWords(stage, pipe = null) {
  switch (stage) {
    case "read": return "Understanding your request";
    case "act": return pipe === "remote" ? "Waiting for the online AI" : "Writing the code";
    case "run": return "Trying it out";
    case "rule": return "Checking the results";
    case "wait": return "Waiting for the AI to be free";
    default: return "Working";
  }
}

/** The slow-step reassurance. `canGoOnline`: null = unknown. */
export function slowWords(pipe, canGoOnline = null) {
  if (pipe === "remote") return "Free online AI services can take 10 to 40 seconds.";
  const base = "This is taking a while — the AI on this computer can be slow.";
  return canGoOnline ? `${base} I'll ask a stronger AI online if it takes much longer.` : `${base} It's still working.`;
}
