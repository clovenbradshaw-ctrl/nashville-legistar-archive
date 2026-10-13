/* fold-scheduler-client — the fold's sign-in control for recurring tasks.
 *
 * Identity only: this is the GitHub login button. There is NO "connect Cloudflare" step — the
 * fold-scheduler Worker holds no Cloudflare credential and cannot reach any Cloudflare account.
 * A task that must act on someone's own account runs in a Worker *they* deploy (see the README).
 *
 * The fold is a static page on a different origin, so the session is a bearer in localStorage,
 * not a cookie. The OAuth callback hands the token back in the URL fragment (#fs_token=…), which
 * never leaves the browser; this script captures it, stores it, and strips the fragment.
 *
 * Include it once, pointing at your deployed Worker:
 *
 *   <script src="fold-scheduler-client.js"
 *           data-api="https://fold-scheduler.<your-subdomain>.workers.dev"
 *           data-ui></script>
 *
 * `data-ui` adds a small floating control. Without it you still get window.FoldScheduler:
 *
 *   FoldScheduler.signIn()                 -> GitHub login
 *   FoldScheduler.me()                     -> { signedIn, email, name, … }
 *   FoldScheduler.listJobs()               -> { jobs: [...] }
 *   FoldScheduler.createJob({...})         -> { job }
 *   FoldScheduler.runJob(id) / deleteJob(id)
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) {
    var all = document.querySelectorAll('script[data-api]');
    script = all[all.length - 1] || null;
  }
  var API = ((script && script.getAttribute('data-api')) || window.FOLD_SCHEDULER_URL
    || (function () { try { return localStorage.getItem('fold:fs_api'); } catch (e) { return ''; } })() || '').replace(/\/$/, '');
  var UI = !!(script && script.hasAttribute('data-ui'));
  var TOKEN_KEY = 'fold:fs_token';

  function token() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  // Capture the session the OAuth callback dropped in the fragment, then clean the address bar.
  (function capture() {
    if (!location.hash) return;
    var m = /(?:^|[#&])fs_token=([^&]+)/.exec(location.hash);
    if (m) { setToken(decodeURIComponent(m[1])); history.replaceState(null, '', location.pathname + location.search); }
  })();

  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    if (opts.body) headers['content-type'] = 'application/json';
    var tok = token();
    if (tok) headers.authorization = 'Bearer ' + tok;
    return fetch(API + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
        return j;
      }, function () { if (!r.ok) throw new Error('HTTP ' + r.status); return {}; });
    });
  }

  var FoldScheduler = {
    api: API,
    setApi: function (url) {
      try { localStorage.setItem('fold:fs_api', String(url || '').replace(/\/$/, '')); } catch (e) {}
      location.reload();
    },
    signedIn: function () { return !!token(); },
    signOut: function () { setToken(null); if (UI) render(); },
    signIn: function (ret) {
      window.location = API + '/auth/github?return=' + encodeURIComponent(ret || location.href);
    },
    me: function () { return api('/me'); },
    actions: function () { return api('/actions'); },
    listJobs: function () { return api('/jobs'); },
    createJob: function (job) { return api('/jobs', { method: 'POST', body: job }); },
    runJob: function (id) { return api('/jobs/' + encodeURIComponent(id) + '/run', { method: 'POST' }); },
    deleteJob: function (id) { return api('/jobs/' + encodeURIComponent(id), { method: 'DELETE' }); },
  };
  window.FoldScheduler = FoldScheduler;

  if (UI) {
    var bar;
    function render() {
      if (!bar) return;
      if (!FoldScheduler.signedIn()) {
        bar.innerHTML = '';
        bar.appendChild(button('Sign in with GitHub', function () { FoldScheduler.signIn(); }));
        return;
      }
      bar.innerHTML = '';
      bar.appendChild(span('Checking…'));
      FoldScheduler.me().then(function (m) {
        bar.innerHTML = '';
        bar.appendChild(span(m.name || m.email || 'signed in'));
        bar.appendChild(button('Sign out', function () { FoldScheduler.signOut(); }, 'fs-quiet'));
      }).catch(function () {
        bar.innerHTML = '';
        bar.appendChild(button('Sign in with GitHub', function () { FoldScheduler.signIn(); }));
      });
    }
    function button(label, onClick, cls) {
      var b = document.createElement('button');
      b.textContent = label; b.type = 'button';
      b.className = 'fs-btn' + (cls ? ' ' + cls : '');
      b.onclick = onClick; return b;
    }
    function span(text, cls) {
      var s = document.createElement('span');
      s.textContent = text; s.className = 'fs-txt' + (cls ? ' ' + cls : ''); return s;
    }

    bar = document.createElement('div');
    bar.id = 'fold-scheduler-bar';
    bar.setAttribute('style', [
      'position:fixed', 'z-index:2147483000', 'right:12px', 'bottom:12px',
      'display:flex', 'gap:8px', 'align-items:center',
      'font:13px/1.3 system-ui,-apple-system,sans-serif',
      'background:#111a', 'color:#eee', 'padding:8px 10px', 'border-radius:999px',
      'backdrop-filter:blur(6px)', 'box-shadow:0 2px 12px #0006',
    ].join(';'));
    function ready() { document.body.appendChild(bar); render(); }
    if (document.body) ready(); else document.addEventListener('DOMContentLoaded', ready);
  }
})();
