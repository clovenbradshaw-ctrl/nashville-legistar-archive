#!/usr/bin/env node
// tools/notebook-falsify.mjs — run the registered falsification criteria F1–F9 (eoreader7 NOTEBOOK-FALSIFICATION.md) against THIS page,
// in a real Chromium, through the real UI: clicks, typing, Shift+Enter, a dropped file. Every verdict says what was checked and what was
// seen. Nothing is retried until it passes; a failure is printed as a failure.
//
//   node tools/notebook-falsify.mjs [--page http://127.0.0.1:8000/index.html] [--server http://127.0.0.1:8900] [--cdp 9222] [--out results.json]
//
// Needs: the page served (python3 -m http.server 8000), eoreader7's holodeck.mjs on --server with a FRESH --dir (the run expects an empty
// workspace), python3 + numpy on that machine, and a Chromium with --remote-debugging-port. Writes screenshots next to --out.
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { spawnSync } from "node:child_process";
import { openTab } from "./cdp.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const PAGE = arg("page", "http://127.0.0.1:8000/index.html"), SERVER = arg("server", "http://127.0.0.1:8900"), OUT = arg("out", path.join(os.tmpdir(), "notebook-falsify.json"));
const SHOTS = path.dirname(OUT); const R = []; const say = (id, pass, detail) => { R.push({ id, pass, detail }); console.log(`${pass === true ? "PASS" : pass === false ? "FAIL" : "ABSENT"}  ${id}  ${detail}`); };
const get = async (u) => { try { return await fetch(u); } catch (e) { return fetch(u); } }; // one retry: a keep-alive socket can go stale during a long colony run
// the conversation the PAGE is showing (the server's own default is its first open tab, which is not the same thing)
const shown = () => t.eval(`return document.querySelector('.hnb .tab.on')?.dataset.c || null`);
const state = async (c) => { c = c || await shown(); return (await get(`${SERVER}/notebook/state${c ? `?c=${c}` : ""}`)).json(); };

// data: one series with bursts (structure), one white noise (none), a time column
const csvBursty = () => { let a = 4242; const r = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296), g = () => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) * 1.41; };
  let env = 0; const rows = ["t_s,bursty,white"]; for (let i = 0; i < 9000; i++) { env = 0.999 * env + 0.045 * g(); rows.push(`${(i * 0.001).toFixed(3)},${(g() * Math.exp(env * 3)).toFixed(4)},${g().toFixed(4)}`); } return rows.join("\n"); };
const csvNoise = () => { let a = 99; const r = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296), g = () => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) * 1.41; };
  const rows = ["t_s,noise"]; for (let i = 0; i < 9000; i++) rows.push(`${(i * 0.001).toFixed(3)},${g().toFixed(4)}`); return rows.join("\n"); };

const t = await openTab(Number(arg("cdp", 9222)));
const idle = () => t.until(`(() => { const l = document.querySelector('.hnb [data-cmd]'); return l && !/^Working/.test(l.placeholder); })()`, { timeout: 600000, what: "the pane to finish working" });
const line = async (text) => { await t.until(`document.querySelector('.hnb [data-cmd]')`, { what: "the command bar" }); await t.eval(`const l = document.querySelector('.hnb [data-cmd]'); l.value = ${JSON.stringify(text)}; l.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));`); await new Promise((r) => setTimeout(r, 200)); await idle(); };
const click = async (sel, i = 0) => { await t.eval(`const e = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if (!e) throw new Error('no element ' + ${JSON.stringify(sel)}); e.click();`); await new Promise((r) => setTimeout(r, 200)); await idle(); };
const notice = () => t.eval(`const n = document.querySelector('.hnb [data-notice]'); return n ? n.innerText : ''`);
const drop = async (name, text) => { await t.eval(`const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(text)}], ${JSON.stringify(name)}, { type: 'text/csv' })); const r = document.querySelector('.hnb'); r.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); r.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));`); await new Promise((r) => setTimeout(r, 400)); await idle(); };

try {
  await t.goto(PAGE); await new Promise((r) => setTimeout(r, 2500));
  await t.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Ask the Fold').click()`);
  await t.until(`[...document.querySelectorAll('button')].some(x => x.textContent.trim() === 'Data notebook')`);
  await t.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Data notebook').click()`);
  await t.until(`document.querySelector('.hnb [data-tabs]')`, { timeout: 20000, what: "the tab strip" });
  const S0 = await state(); const C1 = S0.conv.id;
  console.log(`page ${PAGE} · server ${SERVER} · python ${S0.server.env.python} numpy ${S0.server.env.numpy} · first tab ${C1}`);

  // ── F2: the Jupyter basics, through the UI ──────────────────────────────────
  await drop("mixed.csv", csvBursty());
  const f2 = {};
  f2.ingest = /mixed\.csv/.test(await t.eval(`return document.querySelector('.hnb .given')?.innerText || ''`));
  await line("/py 6*7"); f2.lastExpr = await t.eval(`return [...document.querySelectorAll('.hnb pre.out')].some(p => p.innerText.trim() === '42')`);
  await line("/md ## A note **bold** and `code`"); f2.markdown = await t.eval(`return [...document.querySelectorAll('.hnb .md')].some(m => m.querySelector('h4') && m.querySelector('b') && m.querySelector('code'))`);
  const visibleCode = `[...document.querySelectorAll('.hnb textarea[data-src]')].filter(x => !x.hidden)`;
  const nBefore = await t.eval(`return ${visibleCode}.length`);
  await click('.hnb [data-act="add"][data-t="code"]');
  await t.until(`${visibleCode}.length > ${nBefore}`, { what: "the new code cell" });
  const newId = await t.eval(`const last = ${visibleCode}.at(-1); last.focus(); return last.dataset.src`);
  await t.type("import numpy as np\nprint('#finding mean of 0..9 =', np.arange(10).mean())");
  await t.key("Enter", 8); await idle(); await new Promise((r) => setTimeout(r, 400)); await idle();
  const afterShift = await t.eval(`return { out: [...document.querySelectorAll('.hnb pre.out')].map(p => p.innerText).join('\\n'), cells: [...document.querySelectorAll('.hnb textarea[data-src]')].filter(x=>!x.hidden).map(x => x.dataset.src), active: document.activeElement?.dataset?.src || null }`);
  f2.shiftEnter = /#finding mean of 0\.\.9 = 4\.5/.test(afterShift.out) && afterShift.cells.indexOf(newId) >= 0 && afterShift.cells.length > afterShift.cells.indexOf(newId) + 1;
  f2.movedOn = afterShift.active !== null && afterShift.active !== newId;
  await line("/py import matplotlib.pyplot as plt\nplt.plot([1, 3, 2]); show()");
  f2.figure = await t.eval(`return [...document.querySelectorAll('.hnb img.fig')].some(i => i.naturalWidth > 50)`);
  const before = (await state(C1)).ledgers.nb.filter((e) => e.kind === "exec").length;
  await click('.hnb [data-act="run-all"]');
  const S2 = await state(C1); const codeCells = S2.ledgers.nb.filter((e) => e.kind === "cell" && e.type === "code").length; f2.runAll = S2.ledgers.nb.filter((e) => e.kind === "exec").length >= before + codeCells - 1;
  const ip = await t.eval(`const r = await fetch(${JSON.stringify(SERVER)} + '/notebook/ipynb?c=${C1}'); return await r.json()`);
  const nbErr = []; if (ip.nbformat !== 4) nbErr.push("nbformat"); if (!Number.isInteger(ip.nbformat_minor)) nbErr.push("nbformat_minor"); if (!ip.metadata || typeof ip.metadata !== "object") nbErr.push("metadata"); if (!Array.isArray(ip.cells)) nbErr.push("cells");
  for (const [i, c] of (ip.cells || []).entries()) { for (const k of ["cell_type", "metadata", "source"]) if (!(k in c)) nbErr.push(`cells[${i}].${k}`); if (c.cell_type === "code") for (const k of ["outputs", "execution_count"]) if (!(k in c)) nbErr.push(`cells[${i}].${k}`); if (c.cell_type === "code") for (const o of c.outputs) { if (!o.output_type) nbErr.push(`cells[${i}].outputs.output_type`); if (o.output_type === "stream" && !("name" in o && "text" in o)) nbErr.push(`cells[${i}] stream fields`); if (o.output_type === "display_data" && !("data" in o && "metadata" in o)) nbErr.push(`cells[${i}] display_data fields`); } }
  f2.ipynb = nbErr.length === 0;
  say("F2", Object.values(f2).every(Boolean), `drop-to-ingest ${f2.ingest}; last expression shown (6*7 → 42) ${f2.lastExpr}; markdown renders (heading, bold, code) ${f2.markdown}; + Code then Shift+Enter ran the cell ${f2.shiftEnter} and moved focus to the next cell ${f2.movedOn}; matplotlib figure inline ${f2.figure}; Run all ran every code cell ${f2.runAll}; exported .ipynb nbformat-4 required fields ${f2.ipynb ? "all present" : "MISSING " + nbErr.join(", ")}`);
  await t.shot(path.join(SHOTS, "f2-notebook.png"));

  // ── a plain-words question: learned methods → model → colony; the gate; claims ──
  await line("what is going on in this file?");
  const S3 = await state(C1); const claims = S3.ledgers.nb.filter((e) => e.kind === "cell" && e.type === "claim");
  console.log(`asked: ${claims.length} claim(s), ${S3.library.length} learned method(s)`);

  // ── F3: Run all twice, identical outputs ────────────────────────────────────
  await click('.hnb [data-act="run-all"]'); await click('.hnb [data-act="run-all"]');
  const S4 = await state(C1); const diffs = [];
  for (const c of S4.ledgers.nb.filter((e) => e.kind === "cell" && e.type === "code")) { const ex = S4.ledgers.nb.filter((e) => e.kind === "exec" && e.cell === c.id); if (ex.length < 2) { diffs.push(`${c.id}: fewer than two runs`); continue; } const [a, b] = ex.slice(-2); if (a.output !== b.output || a.result !== b.result || JSON.stringify(a.scope) !== JSON.stringify(b.scope) || JSON.stringify((a.figures || []).map((f) => f.sha)) !== JSON.stringify((b.figures || []).map((f) => f.sha))) diffs.push(c.id); }
  say("F3", diffs.length === 0, `Run all twice over ${S4.ledgers.nb.filter((e) => e.kind === "cell" && e.type === "code").length} code cells (incl. ${claims.length * 2} check/control cells the colony's methods wrote): ${diffs.length ? "DIFFERED: " + diffs.join(", ") : "every output, #scope, #result and figure hash identical (run time excluded)"}`);

  // ── F4: every number in a "What was found" line is in a sealed run's output ──
  await click('.hnb [data-act="retype"][data-type="chat"]');
  const found = await t.eval(`return [...document.querySelectorAll('.hnb .bub.ai .md')].map(m => { const t = m.innerText; const i = t.indexOf('What was found'); if (i < 0) return ''; const j = t.indexOf('Claims (proposed', i); return t.slice(i + 14, j < 0 ? undefined : j); }).join('\\n')`);
  const nums = [...found.matchAll(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)].map((m) => m[0]);
  const outs = S4.ledgers.nb.filter((e) => e.kind === "exec").map((e) => e.output).join("\n");
  const orphan = nums.filter((n) => !outs.includes(n));
  say("F4", nums.length > 0 && orphan.length === 0, nums.length ? `${nums.length} number(s) read from the chat view's “What was found” lines; ${orphan.length ? "NOT in any sealed run's output: " + orphan.join(", ") : "every one occurs in the stored output of a sealed exec entry (chain re-verified in the page)"}` : "no “What was found” numbers on screen to trace — cannot be judged");

  // ── F8: the Generate view writes Methods from the ledger ──────────────────────
  await click('.hnb [data-act="retype"][data-type="generate"]');
  await t.shot(path.join(SHOTS, "f8-generate.png"));
  const meth = await t.eval(`return document.querySelector('.hnb [data-methods]')?.innerText || ''`);
  const shownClaims = await t.eval(`return [...document.querySelectorAll('.hnb .gen table tr td:first-child b')].map(b => b.innerText)`);
  const miss = []; for (const c of claims) { const m = meth.match(new RegExp(`Claim ${c.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} [\\s\\S]*?null: ([^;]+); n = ([^;]+); seed = ([^;]+);[\\s\\S]*?(?:control|no control)`)); if (!m || /not stated/.test(m[1] + m[2] + m[3])) miss.push(c.id); }
  const envOk = /python \d+\.\d+/.test(meth) && /numpy \d+\.\d+/.test(meth) && /er7py library [0-9a-f]{8,}/.test(meth);
  say("F8", claims.length > 0 && miss.length === 0 && envOk, `${shownClaims.length} claim row(s) in the Generate view, ${claims.length} claim(s) on the ledger; Methods names null, n and seed for ${claims.length - miss.length}/${claims.length}${miss.length ? " — MISSING for " + miss.join(", ") : ""}; environment (python, numpy, library hash) ${envOk ? "named" : "MISSING"}`);

  // ── F5: a fork is a prefix ──────────────────────────────────────────────────
  await click('.hnb [data-act="retype"][data-type="notebook"]');
  // a promotion in the parent that must NOT travel
  const promote = claims[0]?.id; if (promote) { await t.eval(`const b = [...document.querySelectorAll('.hnb [data-act="promote"]')].find(x => x.dataset.card === ${JSON.stringify(promote)} && x.dataset.to === 'conjectured'); b.click()`); await idle(); }
  const parentBefore = (await state(C1)).ledgers; const cutCell = (claims.at(-1) ?? S4.ledgers.nb.find((e) => e.kind === "cell")).id;
  await t.eval(`[...document.querySelectorAll('.hnb [data-act="fork"]')].find(x => x.dataset.at === ${JSON.stringify(cutCell)}).click()`); await idle();
  const SF = await state(); const F = SF.conv; const parentAfter = (await state(C1)).ledgers;
  const cut = parentBefore.nb.findLastIndex((e) => e.id === cutCell || e.cell === cutCell);
  const prefixSame = SF.ledgers.nb.length === cut + 1 && SF.ledgers.nb.every((e, i) => e.hash === parentBefore.nb[i].hash);
  const parentSame = JSON.stringify(parentBefore.nb.map((e) => e.hash)) === JSON.stringify(parentAfter.nb.map((e) => e.hash)) && JSON.stringify(parentBefore.bench.map((e) => e.hash)) === JSON.stringify(parentAfter.bench.map((e) => e.hash));
  const lineageShown = await t.eval(`return document.querySelector('.hnb [data-lineage]')?.innerText || ''`);
  const noPromo = !SF.ledgers.bench.some((e) => e.kind === "promote");
  // write in the fork; the parent must not change
  await line("/md written only in the fork"); const parentAfterWrite = (await state(C1)).ledgers.nb.map((e) => e.hash);
  say("F5", prefixSame && parentSame && F.parent === C1 && F.forkHash === parentBefore.nb[cut].hash && /promotion\(s\) stayed with the parent/.test(lineageShown) && noPromo && JSON.stringify(parentAfterWrite) === JSON.stringify(parentAfter.nb.map((e) => e.hash)),
    `forked ${C1} at cell ${cutCell} from its ⑂ button → ${F.id}: first ${cut + 1} entries hash-identical to the parent's ${prefixSame}; parent unchanged by the fork ${parentSame} and by a write in the fork ${JSON.stringify(parentAfterWrite) === JSON.stringify(parentAfter.nb.map((e) => e.hash))}; lineage recorded (parent ${F.parent}, cut seal ${String(F.forkHash).slice(0, 12)}) and shown: “${lineageShown.slice(0, 140)}”; parent's promotion (${promote ?? "none made"}) not carried ${noPromo}`);

  // ── F6: tabs isolated and typed ─────────────────────────────────────────────
  await click('.hnb [data-act="menu"]'); await click('.hnb [data-act="new"][data-type="chat"]');
  const SC = await state(); const C3 = SC.conv.id;
  const leak = await t.eval(`const txt = document.querySelector('.hnb [data-view]').innerText; return { mixed: /mixed\\.csv/.test(txt), cells: [...document.querySelectorAll('.hnb [data-cell]')].length, type: document.querySelector('.hnb [data-view]').dataset.view }`);
  const wsBefore = SC.ledgers.workspace.length, nbHashes = (await state(C1)).ledgers.nb.map((e) => e.hash);
  await t.eval(`document.querySelector('.hnb [data-act="goto"][data-c="${C1}"]').click()`); await idle();
  await click('.hnb [data-act="retype"][data-type="generate"]');
  const SR = await state(C1); const retype = SR.ledgers.workspace.slice(wsBefore); const nbAfter = SR.ledgers.nb.map((e) => e.hash);
  const tabsShown = await t.eval(`return [...document.querySelectorAll('.hnb [data-act="goto"]')].map(b => b.innerText.replace(/\\s+/g, ' ').trim())`);
  say("F6", !leak.mixed && leak.cells === 0 && leak.type === "chat" && SC.ledgers.nb.length === 0 && retype.length === 1 && retype[0].kind === "retype" && JSON.stringify(nbHashes) === JSON.stringify(nbAfter) && tabsShown.length >= 3,
    `${tabsShown.length} tabs open (${tabsShown.join(" | ")}); the new chat tab ${C3} shows no file of ${C1} ${!leak.mixed}, no cell ${leak.cells === 0}, and its ledger is empty ${SC.ledgers.nb.length === 0}; flag change notebook→generate on ${C1} added ${retype.length} workspace entry (${retype.map((e) => e.kind).join(", ")}) and changed no notebook hash ${JSON.stringify(nbHashes) === JSON.stringify(nbAfter)}`);
  await click('.hnb [data-act="retype"][data-type="notebook"]');

  // ── F7: nulls are said; a control that passes is refused ──────────────────────
  await click('.hnb [data-act="menu"]'); await click('.hnb [data-act="new"][data-type="notebook"]');
  await drop("noise.csv", csvNoise());
  await line("/explore structure in noise");
  const SN = await state(); const nullSaid = SN.ledgers.nb.some((e) => e.kind === "cell" && /Nothing cleared the bar/.test(e.source)) && await t.eval(`return /Nothing cleared the bar/.test(document.querySelector('.hnb [data-view]').innerText)`);
  const newClaims = SN.ledgers.nb.filter((e) => e.kind === "cell" && e.type === "claim").length;
  await line("/claim noise has no memory");
  await line(`/check k1 import numpy as np\nfrom turb import series\nt,x,rep=series("noise.csv","noise")\nprint("#finding noise lag-1 autocorrelation", round(float(np.corrcoef(x[:-1],x[1:])[0,1]),3))\nscope_sample(1,0,"one series")\nresult(True)`);
  await line(`/control k1 import numpy as np\nfrom turb import series\nt,x,rep=series("noise.csv","noise")\nscope_sample(1,1,"same series, not destroyed")\nresult(True)`);
  const cells = (await state()).ledgers.nb.filter((e) => e.kind === "cell" && e.type === "code").map((e) => e.id);
  await line(`/learn ${cells.at(-2)} ${cells.at(-1)} as does noise have memory`); const refusal = await notice();
  say("F7", nullSaid && newClaims === 0 && /control did NOT fail/.test(refusal), `on a white-noise column the colony's answer says “Nothing cleared the bar” ${nullSaid} and makes ${newClaims} claim(s); a method taught with a control that returns true is refused: “${refusal.replace(/\s+/g, " ").slice(0, 170)}”`);

  // ── R4: a switched-off method is never used and nothing is written around it ─
  await t.eval(`document.querySelector('.hnb [data-act="goto"][data-c="${C1}"]').click()`); await idle();
  const libBefore = (await state(C1)).library; let r4 = "no learned method to switch";
  if (libBefore.length) {
    await click('.hnb [data-act="drawer"][data-tab="skills"]'); await click('.hnb [data-act="switch"][data-id="all"]');
    await click('.hnb [data-act="switch-go"][data-id="all"]'); const noReason = await notice();
    await t.eval(`document.querySelector('.hnb [data-why="all"]').value = 'falsification run: are off methods really unused?'`); await click('.hnb [data-act="switch-go"][data-id="all"]');
    await click('.hnb [data-act="drawer"][data-tab=""]');
    await line("what is going on in this file?"); const refused = await notice(); const libAfter = (await state(C1)).library;
    await click('.hnb [data-act="drawer"][data-tab="audit"]'); const aud = await t.eval(`return document.querySelector('.hnb .drawer').innerText`);
    await t.shot(path.join(SHOTS, "r4-audit.png")); await click('.hnb [data-act="drawer"][data-tab=""]');
    const ok = /needs a reason/.test(noReason) && /switched off/.test(refused) && /will not (learn|write) a new (method|one) around/.test(refused) && libAfter.length === libBefore.length && /off by human:/.test(aud) && /verifies here/.test(aud);
    r4 = `${ok ? "PASS" : "FAIL"} — off without a reason refused (“${noReason.slice(0, 80)}”); after switching all learned analyses off (reason recorded), the same question was refused: “${refused.replace(/\s+/g, " ").slice(0, 150)}”; library size ${libBefore.length} → ${libAfter.length} (nothing written around it); audit shows the switch and all chains verify here: ${/off by human:/.test(aud) && /verifies here/.test(aud)}`;
    await click('.hnb [data-act="drawer"][data-tab="skills"]'); await click('.hnb [data-act="switch"][data-id="all"]'); await click('.hnb [data-act="switch-go"][data-id="all"]'); await click('.hnb [data-act="drawer"][data-tab=""]');
  }
  console.log(`R4  ${r4}`); R.push({ id: "R4", pass: /^PASS/.test(r4), detail: r4 });

  // ── chain-break display: the page believes its own check, not the server ──────
  const brk = await t.eval(`const M = await import(new URL('holodeck-notebook.js', location.href).href); const el = document.createElement('div'); document.body.appendChild(el);
    const tamper = async (u, o) => { const r = await fetch(u, o); if (!/\\/state/.test(u)) return r; const j = await r.json(); if (j.ledgers.nb[0]) j.ledgers.nb[0] = { ...j.ledgers.nb[0], source: 'altered after sealing' }; return new Response(JSON.stringify(j)); };
    const pane = M.mount(el, { fetch: tamper, base: ${JSON.stringify(SERVER)} }); await pane.refresh(); for (let i = 0; i < 80 && !el.querySelector('[data-chains]'); i++) await new Promise(r => setTimeout(r, 100)); const s = el.querySelector('[data-chains]').innerText; el.remove(); return s`);
  R.push({ id: "chain-break", pass: /CHAIN BROKEN/.test(brk), detail: `a /state whose first notebook entry was altered in transit is shown as “${brk}”` }); console.log(`${/CHAIN BROKEN/.test(brk) ? "PASS" : "FAIL"}  chain-break  shown as “${brk}”`);

  // ── F1: the bundle re-runs in a clean python3 ─────────────────────────────────
  await t.eval(`document.querySelector('.hnb [data-act="goto"][data-c="${C1}"]').click()`); await idle();
  const b64 = await t.eval(`const r = await fetch(${JSON.stringify(SERVER)} + '/notebook/bundle?c=${C1}'); const b = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s)`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "f1-clean-")); fs.writeFileSync(path.join(dir, "bundle.zip"), Buffer.from(b64, "base64"));
  spawnSync("python3", ["-c", "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])", path.join(dir, "bundle.zip"), path.join(dir, "b")]);
  const rr = spawnSync("python3", ["run_all.py"], { cwd: path.join(dir, "b"), encoding: "utf8", env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: dir }, timeout: 900000 });
  const exp = JSON.parse(fs.readFileSync(path.join(dir, "b", "expected.json"), "utf8"));
  const marked = exp.runs.reduce((n, r) => n + r.lines.length, 0);
  say("F1", rr.status === 0 && exp.skipped.length === 0, `bundle from the page's ⤓ Bundle route, unzipped into ${dir}/b, run with plain python3 (PATH only, no fold server, no PYTHONPATH): exit ${rr.status}; ${(rr.stdout.match(/reproduced .*/) || ["?"])[0]}; ${marked} #finding/#result lines compared; ${exp.skipped.length ? "NOT reproducible: " + exp.skipped.map((s) => `${s.cell} (${s.why})`).join("; ") : "no cell skipped"}${rr.status ? "\n" + rr.stdout.slice(-800) : ""}`);

  // ── F9: declared out of scope ────────────────────────────────────────────────
  say("F9", null, "typeset equations, citation management and real-time co-editing: absent from the pane (markdown renders headings, bold, italic, code and bullets only; no citation store; one person per server, no shared cursor). Recorded as absent, not as passed.");

  // ── phone width: tab strip scrolls, drawer is full width ─────────────────────
  await t.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await new Promise((r) => setTimeout(r, 500));
  const phone = await t.eval(`const s = document.querySelector('.hnb [data-tabs]'); return { scroll: getComputedStyle(s).overflowX, over: document.documentElement.scrollWidth - innerWidth }`);
  await click('.hnb [data-act="drawer"][data-tab="skills"]'); const dw = await t.eval(`return Math.round(document.querySelector('.hnb .drawer').getBoundingClientRect().width) + '/' + Math.round(visualViewport.width)`); // the drawer against the VISIBLE width
  await t.shot(path.join(SHOTS, "phone-drawer.png"), 390, 844); await click('.hnb [data-act="drawer"][data-tab=""]'); await t.shot(path.join(SHOTS, "phone.png"), 390, 844);
  R.push({ id: "R8-phone", pass: phone.scroll === "auto" && dw.split("/")[0] === dw.split("/")[1], detail: `at a 390px phone: tab strip overflow-x ${phone.scroll}; drawer/visible width ${dw}px; the host page's own layout is ${phone.over}px wider than its viewport (not the pane's)` }); console.log(`R8-phone  ${JSON.stringify(phone)} drawer ${dw}`);
  const mounts = await t.eval(`return window.__hnbMounts || 0`); console.log(`(the host handed the pane an element ${mounts} time(s); one pane instance served them all)`);
  R.push({ id: "console", pass: t.errors.length === 0, detail: t.errors.length ? t.errors.slice(0, 5).join(" | ") : "no console errors or exceptions during the run" });
} catch (e) { R.push({ id: "run", pass: false, detail: "the run stopped: " + e.message }); console.log("STOPPED", e.message); }
finally { fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), page: PAGE, server: SERVER, results: R }, null, 1)); await t.close(); }
process.exit(R.some((r) => r.pass === false) ? 1 : 0);
