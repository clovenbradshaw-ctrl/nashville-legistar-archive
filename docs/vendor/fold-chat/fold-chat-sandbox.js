// fold-chat-sandbox.js — the agent's eyes. Runs what the machine door returned
// in a sandboxed iframe (scripts allowed, NO same-origin: it cannot touch this
// page, its storage, or the bridge) and reports what it actually did:
//
//   · did it load without throwing?
//   · did anything render?
//   · when each control is clicked, does it throw, and does the page change?
//
// These are observed facts, not a model's opinion of its own work. The loop
// (fold-chat-agent.js) turns a failing fact into the next attempt's prompt.
// Browser only — it needs a DOM; the loop's logic is tested in node with a
// fake observer and this is exercised by the live e2e.

import { sampleCalls, describeTrial } from "./fold-chat-trial.js";
/** The probe injected ahead of the artifact. It reports over postMessage with a
 *  per-run nonce; the parent only believes messages from this iframe. */
function probeScript(nonce, { click }) {
  return `<script>(function(){
var P=window.parent,ID=${JSON.stringify(nonce)};
function send(t,d){try{P.postMessage({__foldprobe:ID,type:t,data:d||{}},"*")}catch(e){}}
window.addEventListener("error",function(e){send("error",{message:String(e.message||e.error||"error"),line:e.lineno||null})});
window.addEventListener("unhandledrejection",function(e){var r=e.reason;send("error",{message:"unhandled rejection: "+(r&&r.message||r)})});
var ce=console.error;console.error=function(){send("console",{message:[].slice.call(arguments).map(String).join(" ")});try{ce.apply(console,arguments)}catch(e){}};
function snap(){var b=document.body;return {text:(b&&b.innerText||"").replace(/\\s+/g," ").trim(),html:b?b.innerHTML.length:0,vis:document.querySelectorAll("canvas,svg,img,video").length}}
// Ready when the DOM is ready — NOT when every image, font and external script has finished (a slow or blocked
// resource would hold "load" back and a perfectly good page would be reported as hung). "load" is only a fallback.
// PACING WITHOUT TIMERS: a browser throttles chained timers in an off-screen or long-hidden frame to about one a MINUTE (measured in
// the app's own pane: six chained 120ms timers never finished in 30s). Message-channel tasks are not throttled, so pacing is done
// by yielding a number of tasks; a timer is only the fallback (whichever fires first wins).
function after(ms,n,cb){var d=false;function fin(){if(d)return;d=true;cb()}try{var c=new MessageChannel(),k=0;c.port1.onmessage=function(){if(++k<n)c.port2.postMessage(0);else{try{c.port1.close()}catch(e){}fin()}};c.port2.postMessage(0)}catch(e){}setTimeout(fin,ms)}
var began=false;
function begin(){ if(began)return; began=true; after(200,2,go); }
function go(){
  var s0=snap(),title=document.title||"";
  var ctl=[].slice.call(document.querySelectorAll("button,[role=button],input[type=button],input[type=submit],a[href^='#']")).slice(0,${click ? 12 : 0});
  var inputs=document.querySelectorAll("input,textarea,select").length;
  var labels=[].slice.call(document.querySelectorAll("button,[role=button],input,textarea,select,a,label,h1,h2,h3")).map(function(e){return (e.innerText||e.value||e.placeholder||e.getAttribute("aria-label")||e.title||"").replace(/\\s+/g," ").trim().toLowerCase()}).filter(Boolean).slice(0,60);
  send("loaded",{title:title,textLen:s0.text.length,sample:s0.text.slice(0,80),visuals:s0.vis,controls:ctl.length,inputs:inputs,labels:labels,text:s0.text.slice(0,3000).toLowerCase()});
  // ONE synchronous burst: a frame in a throttled pane gets a turn about every 0.7s (measured), so waiting between clicks would never
  // finish. A click handler updates the page synchronously, so each click is compared with the page right after it. One short
  // yield at the end catches a page that answers a moment later.
  var changed=0;
  for(var i=0;i<ctl.length;i++){
    var before=snap();
    try{ctl[i].click()}catch(e){send("error",{message:"click threw: "+e.message})}
    var a=snap(); if(a.text!==before.text||a.html!==before.html)changed++;
  }
  after(120,3,function(){var f=snap(); if(!changed&&(f.text!==s0.text||f.html!==s0.html))changed=1; send("done",{clicked:ctl.length,changed:changed})});
}
if(document.readyState==="interactive"||document.readyState==="complete")begin();
else{document.addEventListener("DOMContentLoaded",begin);window.addEventListener("load",begin);}
})()<\/script>`;
}

/** Put the probe first: inside <head> if there is one, else ahead of everything. */
export function withProbe(html, nonce, opts) {
  const probe = probeScript(nonce, opts);
  const m = html.match(/<head[^>]*>/i);
  if (m) return html.slice(0, m.index + m[0].length) + probe + html.slice(m.index + m[0].length);
  const d = html.match(/<!doctype[^>]*>/i);
  if (d) return html.slice(0, d.index + d[0].length) + probe + html.slice(d.index + d[0].length);
  return probe + html;
}

/** Wrap a bare script so the probe can watch it run. */
export function pageFor(code, kind) {
  if (kind === "html") return code;
  if (kind === "js") {
    // A module ("export function …", "import …") is not a classic script: run it as one, or `export` is a SyntaxError that was never the model's fault.
    const isModule = /^\s*(?:export|import)\b/m.test(String(code));
    return `<!doctype html><html><head><meta charset="utf-8"></head><body><script${isModule ? ' type="module"' : ""}>\n${String(code).replace(/<\/script/gi, "<\\/script")}\n<\/script></body></html>`;
  }
  return code;
}

/**
 * Call functions the code defines and report what came back. `exprs` are expressions such as `slugify("Hello, World!")`; each is
 * evaluated inside the code's own scope (a direct eval in the same module), in the same sandboxed frame as everything else:
 * scripts only, no same-origin, no network of the app's. Resolves to [{ expr, ok:true, value } | { expr, ok:false, error }] —
 * `value` is already text (JSON where it can be). Never rejects. A function that never returns is cut off after `timeoutMs`.
 */
export function callMany(code, exprs, { timeoutMs = 5000, host = document.body, signal = null } = {}) {
  return new Promise((resolve) => {
    const list = (exprs || []).map(String).filter(Boolean).slice(0, 12);
    if (!list.length) { resolve([]); return; }
    const nonce = "r" + Math.random().toString(36).slice(2);
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts"); frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;left:0;top:0;width:400px;height:300px;border:0;opacity:0;pointer-events:none;z-index:-1";
    let finished = false, timer = null;
    const finish = (results) => {
      if (finished) return; finished = true;
      clearTimeout(timer); window.removeEventListener("message", onMsg); signal?.removeEventListener?.("abort", onAbort); frame.remove();
      const got = new Map((results || []).map((r) => [r.expr, r]));
      resolve(list.map((expr) => got.get(expr) || { expr, ok: false, error: "did not finish (it may loop forever or wait on something)" }));
    };
    const onAbort = () => finish([]);
    const onMsg = (e) => { const d = e.data; if (e.source === frame.contentWindow && d && d.__foldrun === nonce) finish(d.results); };
    window.addEventListener("message", onMsg);
    signal?.addEventListener?.("abort", onAbort);
    timer = setTimeout(() => finish([]), timeoutMs);
    const isModule = /^\s*(?:export|import)\b/m.test(String(code));
    const runner = `
;(async () => {
  const out = [];
  for (const expr of ${JSON.stringify(list).replace(/</g, "\\u003c")}) {
    try {
      const v = await eval(expr);
      let t; try { t = v === undefined ? "undefined" : typeof v === "function" ? "[function]" : JSON.stringify(v); if (t === undefined) t = String(v); } catch (_) { t = String(v); }
      out.push({ expr, ok: true, value: t.length > 160 ? t.slice(0, 159) + "…" : t });
    } catch (e) { out.push({ expr, ok: false, error: String((e && e.name ? e.name + ": " : "") + (e && e.message ? e.message : e)).slice(0, 160) }); }
  }
  parent.postMessage({ __foldrun: ${JSON.stringify(nonce)}, results: out }, "*");
})();`;
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"></head><body><script${isModule ? ' type="module"' : ""}>\n${String(code).replace(/<\/script/gi, "<\\/script")}\n${runner}\n<\/script></body></html>`;
    host.append(frame);
  });
}

/**
 * Observe an artifact. Resolves to { checks:[{name, ok, detail?}] }. Never
 * rejects on the artifact's own faults — those ARE the result.
 *   ok:true  → evidence the work holds     ok:false → a problem to repair
 *   ok:null  → information only (never fails the round)
 */
/** How much longer to wait on a busy machine: this page's own timer lag, measured now. A starved computer runs the test frame slowly,
 *  and a good page must not be called "hung" because the machine was busy (measured: load average ~300 → a 12s wait was never enough). */
export async function patienceFactor(sampleMs = 100) {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  await new Promise((r) => setTimeout(r, sampleMs));
  const lag = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0 - sampleMs;
  return lag > 1500 ? 4 : lag > 600 ? 3 : lag > 250 ? 2 : 1;
}
export async function observeArtifact(code, opts = {}) {
  const f = await patienceFactor();
  return observeOnce(code, { ...opts, timeoutMs: Math.min(48000, (opts.timeoutMs ?? 12000) * f) });
}

function observeOnce(code, { kind = "html", timeoutMs = 12000, host = document.body, signal = null } = {}) {
  return new Promise((resolve) => {
    if (kind !== "html" && kind !== "js") {
      resolve({ checks: [{ name: "runs as code", ok: null, detail: `a ${kind} answer is not run` }] });
      return;
    }
    const nonce = "p" + Math.random().toString(36).slice(2);
    const errors = [], consoleErrors = [];
    const loadErrors = [], clickErrors = [];
    let loaded = null, done = null, finished = false, LINE_OFFSET = 0;
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");          // scripts only: no same-origin, no forms, no popups
    frame.setAttribute("aria-hidden", "true");
    // ON-screen but invisible: a hidden or off-screen cross-origin frame has its timers throttled to ~1/second, which made
    // every click step cost a full second (measured: 3 buttons = 4.0s, 12 buttons > 13s). opacity:0 keeps it "visible" to the browser.
    frame.style.cssText = "position:fixed;left:0;top:0;width:900px;height:640px;border:0;opacity:0;pointer-events:none;z-index:-1";
    const finish = () => {
      if (finished) return; finished = true;
      clearTimeout(timer); clearTimeout(hardCap); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("message", onMsg); signal?.removeEventListener?.("abort", finish);
      frame.remove();
      const checks = [];
      const rendered = !!loaded && (loaded.textLen > 0 || loaded.visuals > 0 || loaded.controls > 0 || loaded.inputs > 0);
      if (loadErrors.length) {
        checks.push({ name: "loads without errors", ok: false, detail: loadErrors.slice(0, 3).map((e) => e.message + (e.line ? ` (line ${e.line})` : "")).join(" · ") });
      } else if (!loaded) {
        checks.push({ name: "loads without errors", ok: false, detail: "the page never finished loading (it hung or blocked)" });
      } else {
        checks.push({ name: "loads without errors", ok: true, detail: loaded.title ? `“${loaded.title}”` : null });
      }
      if (loaded) {
        // Only a PAGE is expected to draw something; a function or module that draws nothing is exactly as asked.
        if (kind === "html") checks.push({ name: "renders something visible", ok: rendered, detail: rendered ? `${loaded.textLen} chars of text · ${loaded.controls} control(s) · ${loaded.inputs} input(s) · ${loaded.visuals} visual(s)` : "the page is blank" });
        if (loaded.controls > 0) {
          if (!done) checks.push({ name: "controls respond", ok: null, detail: `clicked ${loaded.controls} control(s); the sandbox did not report back` });
          else checks.push({ name: "controls respond", ok: clickErrors.length === 0, detail: clickErrors.length ? `a click threw: ${clickErrors[0].message}` : `clicked ${done.clicked}; ${done.changed} changed the page` });
        }
      }
      if (consoleErrors.length) checks.push({ name: "console", ok: null, detail: consoleErrors.slice(0, 2).join(" · ") });
      const facts = {
        loaded: !!loaded, loadErrors, clickErrors, rendered, page: kind === "html",
        controls: loaded?.controls || 0, clicked: done?.clicked || 0, changed: done?.changed || 0,
        labels: loaded?.labels || [], text: loaded?.text || "", title: loaded?.title || "",
      };
      // A function that merely loads has not shown it works: call it with sample inputs and REPORT what came back (never judged —
      // ok:null — the person and the checker see the values). Only for code with no load error.
      if (kind === "js" && loaded && !loadErrors.length) {
        const calls = sampleCalls(code);
        if (calls.length) {
          callMany(code, calls, { host, signal }).then((trials) => {
            facts.trials = trials;
            checks.push({ name: "tried it", ok: null, detail: trials.map(describeTrial).join("\n") });
            resolve({ checks, facts });
          });
          return;
        }
      }
      resolve({ checks, facts });
    };
    const onMsg = (e) => {
      const d = e.data;
      if (e.source !== frame.contentWindow || !d || d.__foldprobe !== nonce) return;
      if (d.type === "error") { if (d.data && d.data.line) d.data.line = d.data.line > LINE_OFFSET ? d.data.line - LINE_OFFSET : null; errors.push(d.data); (loaded ? clickErrors : loadErrors).push(d.data); }
      else if (d.type === "console") consoleErrors.push(d.data.message);
      else if (d.type === "loaded") loaded = d.data;
      else if (d.type === "done") { done = d.data; finish(); }
    };
    window.addEventListener("message", onMsg);
    signal?.addEventListener?.("abort", finish);
    // A tab in the background does not run the test frame at all, so "it never reported back" there means "nobody looked", not
    // "the page hung". Judge only a frame that had the chance to run: if the tab is hidden when the clock runs out, wait for it to
    // be shown and start the clock again (a hard cap keeps a forgotten tab from holding the run forever).
    const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";
    let timer = null, hardCap = null;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { if (!loaded && hidden()) return; finish(); }, timeoutMs); };
    const onVisible = () => { if (!hidden() && !loaded && !finished) arm(); };
    document.addEventListener("visibilitychange", onVisible);
    hardCap = setTimeout(finish, Math.max(timeoutMs, 300000));
    arm();
    // The probe is injected ahead of the artifact, so the browser's line numbers are offset by its length (and by the one
    // wrapper line for a bare script). Report lines relative to the MODEL'S code — "line 63" must mean line 63 of what it wrote.
    const probeLines = (probeScript(nonce, { click: true }).match(/\n/g) || []).length;
    LINE_OFFSET = probeLines + (kind === "js" ? 1 : 0);
    frame.srcdoc = withProbe(pageFor(code, kind), nonce, { click: true });
    host.append(frame);
  });
}
