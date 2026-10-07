// the fold — capture · content script.
//
// Runs on every page, but reads nothing on its own. Two triggers, both explicit:
//
//  1. A page the fold opened as <url>#fold-capture — the TARGET. Wait for the page to settle and for
//     any human-check to be cleared, then hand the rendered DOM back to the fold and close. This is
//     the automatic path: the fold opens the page, you solve a challenge if there is one, and the
//     fold captures it without a click.
//  2. The toolbar button — captures the current tab the same way.
//
// Capture means reading document.documentElement.outerHTML of the page the person is already
// looking at and posting it to the fold. The fold opens the page, so window.opener is the fold tab
// and the DOM travels by postMessage; if there is no opener, it is routed through the background.

const CHALLENGE = /(just a moment|cf-chl|attention required|enable javascript and cookies|checking your browser|verifying you are human|are you a robot|prove you are|prove you'?re|access to this page has been denied|unusual traffic)/i;

function payload() {
  return { type: 'fold-ingest', url: location.href, title: document.title,
    html: '<!doctype html>' + document.documentElement.outerHTML, t: Date.now() };
}

// Still a challenge page, or an empty shell? If so we wait — the person may be proving themselves.
function looksBlocked() {
  const t = (document.body && document.body.innerText) || '';
  return t.trim().length < 40 || CHALLENGE.test(t);
}

function deliver() {
  const d = payload();
  if (window.opener && window.opener !== window) { try { window.opener.postMessage(d, '*'); } catch (e) {} }
  else { try { chrome.runtime.sendMessage({ type: 'fold-capture', data: d }); } catch (e) {} }
  try { window.close(); } catch (e) {}
}

function captureSoon() {
  if (looksBlocked()) { setTimeout(captureSoon, 800); return; }
  deliver();
}

let armed = false;
function arm() { if (armed) return; armed = true; captureSoon(); }

if (location.hash.indexOf('fold-capture') >= 0) arm();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'fold-capture-now') { arm(); sendResponse({ ok: true }); }
});