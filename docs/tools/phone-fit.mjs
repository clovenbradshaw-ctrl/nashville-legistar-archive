// tools/phone-fit.mjs — does the page fit a phone? At width W (default 390) it loads the page with a clean cache, measures
// document.scrollWidth against the visible width on the start page (empty, then with a dropped document), with the rail shown
// (below 720px this layout stacks the rail full-width), and in Ask the Fold's Chat and Notebook modes, and names any element
// that sticks out. Needs Chromium on --remote-debugging-port=9222 (tools/cdp.mjs).
//   W=390 node tools/phone-fit.mjs        (PAGE=… to point elsewhere; screenshots go to $SP or the temp dir)
import { openTab } from "./cdp.mjs";
const W = +(process.env.W || 390), SP = process.env.SP || (await import("node:os")).tmpdir(), PAGE = process.env.PAGE || "http://127.0.0.1:8000/index.html";
const t = await openTab(); await t.send("Network.setCacheDisabled", { cacheDisabled: true });
await t.send("Emulation.setDeviceMetricsOverride", { width: W, height: 844, deviceScaleFactor: 2, mobile: W < 700 });
await t.goto(PAGE + "?x=" + Date.now()); await new Promise(r => setTimeout(r, 3500));
const m = (label) => t.eval(`const vv = Math.round(visualViewport.width), sw = document.documentElement.scrollWidth;
  const out = [...document.body.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vv + 1 && !e.closest('[style*="overflow-x"],[style*="overflow:auto"],.tabs,[data-tabs]'); });
  const leaves = out.filter(e => ![...e.children].some(c => out.includes(c)));
  return ${JSON.stringify(label)} + ': innerWidth ' + innerWidth + ' vv ' + vv + ' scrollWidth ' + sw + (sw <= vv ? ' OK' : ' OVERFLOW') + leaves.slice(0, 8).map(e => '\\n    ' + e.tagName + ' r=' + Math.round(e.getBoundingClientRect().right) + ' ' + JSON.stringify((e.textContent||'').trim().slice(0, 40))).join('');`);
const btn = (txt) => t.eval(`const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(txt)}); if (b) b.click(); return !!b`);
const openRail = () => t.eval(`const b = document.querySelector('button[title="Expand"]'); if (b) b.click(); return !!b`);
console.log(await m('start (empty)'));
// add real content the way a person does: drop a text file on the page
const doc = Array.from({ length: 40 }, (_, i) => `Minutes of the Metropolitan Council meeting ${i + 1}. Councilmember Freddie O'Connell moved to approve the Office of Homeless Services budget of $4,250,000 for fiscal year 2025, seconded by Councilmember Jennifer Gamble; the Department of Law advised that the Continuum of Care contract with the Metropolitan Development and Housing Agency requires a supplemental appropriation.`).join("\n\n");
await t.eval(`const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(doc)}], 'council-minutes-with-a-rather-long-file-name-2025.txt', { type: 'text/plain' })); for (const k of ['dragenter','dragover','drop']) document.body.dispatchEvent(new DragEvent(k, { dataTransfer: dt, bubbles: true, cancelable: true }));`);
await new Promise(r => setTimeout(r, 9000));
await t.eval(`document.querySelector('.hdp button[aria-label="Close"], .hdp-top button:last-child')?.click(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`); await new Promise(r => setTimeout(r, 1000));
console.log(await m('start (with a document)'));
await openRail(); await new Promise(r => setTimeout(r, 600)); console.log(await m('rail shown'));
await t.shot(`${SP}/p-${W}-start.png`, W, 844);
await btn('Ask the Fold') || (await openRail(), await new Promise(r => setTimeout(r, 500)), await btn('Ask the Fold')); await new Promise(r => setTimeout(r, 2000));
console.log(await m('ask/chat'));
await btn('Notebook'); await new Promise(r => setTimeout(r, 2500)); console.log(await m('ask/notebook'));
await t.shot(`${SP}/p-${W}-notebook.png`, W, 844);
console.log('console errors:', t.errors.length ? t.errors.slice(0, 3) : 'none');
await t.close(); process.exit(0);
