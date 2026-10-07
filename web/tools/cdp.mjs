// tools/cdp.mjs — the smallest Chrome DevTools Protocol client (Node 22's global WebSocket), for driving the real page in a real
// Chromium: open a tab, evaluate in it, click, type, take screenshots, read console errors. No npm packages.
export async function openTab(port = 9222, url = "about:blank") {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0; const wait = new Map(), errors = [], listeners = [];
  ws.onmessage = (m) => { const j = JSON.parse(m.data); if (j.id && wait.has(j.id)) { const w = wait.get(j.id); wait.delete(j.id); j.error ? w.no(new Error(j.error.message)) : w.ok(j.result); return; }
    if (j.method === "Runtime.exceptionThrown") errors.push(j.params.exceptionDetails.exception?.description || j.params.exceptionDetails.text);
    if (j.method === "Runtime.consoleAPICalled" && j.params.type === "error") errors.push(j.params.args.map((a) => a.value ?? a.description).join(" "));
    for (const l of listeners) l(j); };
  const send = (method, params = {}) => new Promise((ok, no) => { const i = ++id; wait.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Runtime.enable"); await send("Page.enable");
  const tab = {
    send, errors, target: t,
    async goto(u) { const done = new Promise((ok) => listeners.push(function f(j) { if (j.method === "Page.loadEventFired") { listeners.splice(listeners.indexOf(f), 1); ok(); } })); await send("Page.navigate", { url: u }); await done; },
    async eval(expr) { const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; },
    async until(expr, { timeout = 30000, every = 250, what = expr } = {}) { const t0 = Date.now(); for (;;) { let v; try { v = await tab.eval(`return (${expr})`); } catch (e) { v = null; } if (v) return v; if (Date.now() - t0 > timeout) throw new Error(`timed out waiting for: ${what}`); await new Promise((r) => setTimeout(r, every)); } },
    async key(k, mods = 0) { const code = { Enter: "Enter" }[k] || k; for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: k, code, modifiers: mods, windowsVirtualKeyCode: k === "Enter" ? 13 : 0, text: type === "keyDown" && k === "Enter" ? "\r" : undefined }); },
    async type(text) { await send("Input.insertText", { text }); },
    async shot(path, w = 1400, h = 1000) { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 }); const r = await send("Page.captureScreenshot", { format: "png" }); (await import("node:fs")).writeFileSync(path, Buffer.from(r.data, "base64")); },
    close() { ws.close(); return fetch(`http://127.0.0.1:${port}/json/close/${t.id}`).catch(() => {}); },
  };
  return tab;
}
