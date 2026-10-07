import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createNotebookServer } from '../tools/notebook-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'holodeck-browser-test-'));
const server = createNotebookServer({ dir });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  if (process.env.REACT_VENDOR_DIR) for (const f of ['react.production.min.js', 'react-dom.production.min.js', 'babel.min.js']) await page.addInitScript({ path: path.join(process.env.REACT_VENDOR_DIR, f) });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.route(base + '/?*', async r => {
    const response = await r.fetch();
    await r.fulfill({ response, body: (await response.text()).replace('componentDidMount() {', 'componentDidMount() { window.__app=this;') });
  });
  await page.goto(base + '/?work=notebook&fullscreen=1');
  await page.waitForFunction(() => window.__app, { timeout: 30000 });
  await page.locator('.hnb [data-act="add"][data-t="code"]').waitFor({ timeout: 30000 });
  assert.ok(await page.locator('.hd-focus').isVisible());
  assert.equal(await page.locator('.hd-header').isVisible(), false);
  assert.equal(await page.locator('.hd-rail').isVisible(), false);
  await page.locator('.hnb [data-act="add"][data-t="code"]').click();
  let code = page.locator('.hnb textarea[data-src]').last();
  await code.fill('x = 40'); await code.press('Shift+Enter');
  await page.waitForFunction(() => document.querySelectorAll('.hnb textarea[data-src]').length === 2);
  code = page.locator('.hnb textarea[data-src]').last(); await code.fill('x + 2'); await code.press('Control+Enter');
  await page.locator('.hnb [data-out]').last().getByText('42', { exact: true }).waitFor({ timeout: 30000 });
  // Unexecuted edits survive React view removal, focus toggle, and the imperative notebook's own redraws.
  await code.fill('x + 3');
  await page.getByRole('button', { name: 'Chat', exact: true }).first().click();
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click();
  assert.equal(await page.locator('.hnb textarea[data-src]').last().inputValue(), 'x + 3');
  await page.getByRole('button', { name: 'Exit full screen', exact: true }).click();
  await page.getByRole('button', { name: 'Full screen', exact: true }).click();
  assert.equal(await page.locator('.hnb textarea[data-src]').last().inputValue(), 'x + 3');
  await page.reload();
  await page.locator('.hnb textarea[data-src]').last().waitFor({ timeout: 30000 });
  assert.equal(await page.locator('.hnb textarea[data-src]').last().inputValue(), 'x + 3', 'unexecuted edits survive reload');
  await page.locator('.hnb [data-act="run-all"]').click();
  await page.locator('.hnb [data-out]').last().getByText('43', { exact: true }).waitFor({ timeout: 30000 });
  await page.locator('.hnb [data-act="add"][data-t="markdown"]').click();
  await page.locator('.hnb [data-md]').last().dblclick();
  await page.locator('.hnb textarea[data-src]').last().fill('# My experiment\n**Results** stay attached to the run.');
  await page.locator('.hnb textarea[data-src]').last().press('Control+Enter');
  await page.locator('.hnb [data-md]').last().getByText('My experiment').waitFor();
  const download = page.waitForEvent('download');
  await page.locator('.hnb [data-act="dl"][data-path="ipynb"]').click();
  const dl = await download; const file = await dl.path(); const nb = JSON.parse(fs.readFileSync(file));
  assert.equal(nb.nbformat, 4); assert.equal(nb.cells.length, 3);
  await page.locator('[data-import]').setInputFiles({ name: 'roundtrip.ipynb', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(nb)) });
  await page.waitForFunction(() => document.querySelectorAll('.hnb [data-act="goto"]').length === 2);
  await page.locator('.hnb [data-act="restart-run"]').click();
  await page.locator('.hnb [data-out]').last().getByText('43', { exact: true }).waitFor({ timeout: 30000 });
  for (const width of [390, 320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.locator('.hd-focus').evaluate(e => ({ width: e.clientWidth, scroll: e.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions));
  }
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.hd-focus').count(), 0);
  await page.getByRole('button', { name: 'Full screen', exact: true }).click();
  await page.getByRole('button', { name: 'Fold', exact: true }).first().click();
  assert.equal(await page.locator('#ak-composer').isVisible(), true, 'Fold keeps its artifact composer');
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click();
  await page.locator('.hnb [data-out]').last().getByText('43', { exact: true }).waitFor({ timeout: 30000 });
  if (process.env.SCREENSHOT_DIR) { fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'fullscreen-notebook.png') }); }
  assert.deepEqual(errors, []);
  console.log('PASS: desktop/mobile full-screen modes, persistent Python, Shift/Ctrl+Enter, Markdown, unsaved edits, run all, import/export and Escape');
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); fs.rmSync(dir, { recursive: true, force: true });
}
