// The notebook with NO server at all: the page is served as plain static files, nothing answers on the notebook port,
// and clicking Notebook must start Python in the tab by itself (Pyodide) and run cells there. Real clicks, real typing,
// real downloads, a real browser.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, 'http://127.0.0.1');
    const file = path.resolve(ROOT, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
    if (!file.startsWith(path.resolve(ROOT)) || !TYPES[path.extname(file)]) { res.writeHead(404); res.end(); return; }
    const body = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] }); res.end(body);
  } catch (e) { if (!res.headersSent) res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(300000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route('http://127.0.0.1:8900/**', (r) => r.abort()); // there is no notebook server in this test, by design
  await page.goto(base + '/?work=notebook');
  await page.locator('.hnb [data-act="add"][data-t="code"]').waitFor({ timeout: 60000 });

  const idle = () => page.waitForFunction(() => { const t = document.querySelector('.hnb [data-cmd]'); return t && !/Working/.test(t.placeholder); }, null, { timeout: 300000 });
  const addCell = async (source) => {
    const before = await page.locator('.hnb textarea[data-src]').count();
    await page.locator('.hnb [data-act="add"][data-t="code"]').click();
    const cell = page.locator('.hnb textarea[data-src]').nth(before);
    await cell.fill(source); await cell.press('Control+Enter');
    await idle(); return cell;
  };
  await addCell('x = 40');
  await addCell('x + 2');
  await page.locator('.hnb [data-out]').last().getByText('42', { exact: true }).waitFor();
  await addCell('import numpy as np\nint(np.arange(5).sum())');
  await page.locator('.hnb [data-out]').last().getByText('10', { exact: true }).waitFor();
  await addCell('print("hello from the browser")');
  await page.locator('.hnb [data-out]').last().getByText('hello from the browser').waitFor();

  await page.locator('.hnb [data-act="add"][data-t="markdown"]').click();
  await page.locator('.hnb [data-md]').last().dblclick();
  await page.locator('.hnb textarea[data-src]').last().fill('# In the tab\n**no server** ran this');
  await page.locator('.hnb textarea[data-src]').last().press('Control+Enter');
  await idle();
  await page.locator('.hnb [data-md]').last().getByText('In the tab').waitFor();

  await addCell('import matplotlib.pyplot as plt\nplt.plot([1, 2, 3])\nplt.show()');
  await page.locator('.hnb img.fig').last().waitFor(); // Pyodide downloads matplotlib and the figure is captured inline

  await page.locator('.hnb [data-act="run-all"]').click();
  await idle();
  await page.locator('.hnb [data-out]').nth(1).getByText('42', { exact: true }).waitFor();

  const badge = await page.locator('.hnb .mode').innerText();
  assert.match(badge, /Running in this tab/); assert.match(badge, /Pyodide/); assert.match(badge, /chains verify/);
  await page.getByText('Restart kernel').waitFor();
  assert.equal(await page.getByText('Interrupt').count(), 0, 'no process to interrupt in the tab');

  const download = page.waitForEvent('download');
  await page.locator('.hnb [data-act="dl"][data-path="ipynb"]').click();
  const file = await (await download).path();
  const nb = JSON.parse(fs.readFileSync(file));
  assert.equal(nb.nbformat, 4); assert.equal(nb.cells.length, 6); assert.equal(nb.metadata.kernelspec.display_name, 'Python 3 (Pyodide)');
  assert.ok(nb.cells.find((c) => c.source === 'x + 2').outputs.some((o) => JSON.stringify(o).includes('42')));

  await page.reload();
  await page.locator('.hnb [data-act="add"][data-t="code"]').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.hnb textarea[data-src]')].some((t) => t.value === 'x + 2'), null, { timeout: 60000 });
  await page.locator('.hnb [data-out]').nth(1).getByText('42', { exact: true }).waitFor({ timeout: 60000 });
  assert.deepEqual(errors, []);
  console.log('PASS: no server, no install — clicking Notebook started Pyodide in the tab, ran cells (numpy, matplotlib inline), kept the ledgers verified, survived reload and exported nbformat 4');
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise((r) => server.close(r));
}
