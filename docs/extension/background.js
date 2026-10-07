// the fold — capture · background service worker.
//
// Routes a capture into the fold's open tab, and opens the fold if it is not already open. This is
// the fallback path: normally the capture page posts its DOM straight to its opener (the fold tab).
// We only step in when there was no opener (e.g. the tab was opened manually, or a reload lost it).
//
// The fold origin must match where the fold is served. If the fold is served elsewhere, edit
// FOLD_URL below to the real address. The content script on the fold page (when it is open) is what
// turns the capture into an ingest; if the fold is not open we open it and retry delivery.

const FOLD_URL = 'https://scores-patch-points.github.io/the-fold/index.html'; // adjust to where the fold is served

function isFoldUrl(u) {
  if (!u) return false;
  try { const o = new URL(u).origin; const base = new URL(FOLD_URL).origin;
    return o === base && String(u).indexOf('holodeck') >= 0; } catch (e) { return false; }
}

async function foldTab() {
  const tabs = await chrome.tabs.query({}); 
  return tabs.find(tb => isFoldUrl(tb.url));
}

async function injectInto(tabId, data) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: d => { window.postMessage({ type: 'fold-ingest', url: d.url, title: d.title, html: d.html, t: d.t }, '*'); },
    args: [data],
  });
  return true;
}

async function route(data) {
  const tab = await foldTab();
  if (tab) { try { await injectInto(tab.id, data); return true; } catch (e) { return false; } }
  chrome.tabs.create({ url: FOLD_URL + '#ingest' });
  let guard = 0;
  const retry = setInterval(async () => { if (guard++ > 20) return clearInterval(retry); if (await route(data)) clearInterval(retry); }, 1500);
  setTimeout(() => clearInterval(retry), 30000);
  return true;
}

chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg && msg.type === 'fold-capture' && msg.data) route(msg.data);
});

chrome.action.onClicked.addListener(async tab => {
  try { await chrome.tabs.sendMessage(tab.id, { type: 'fold-capture-now' }); }
  catch (e) { /* a page with no content script (chrome://, a store page) cannot be captured */ }
});