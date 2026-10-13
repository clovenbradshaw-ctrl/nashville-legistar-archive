/* fold-canvas — an n8n-style node canvas for the fold, on Litegraph.js (vendored). No build.
 *
 * Nodes chain left-to-right: a Trigger node feeds Step nodes. The chain becomes the automation's
 * `steps[]` — the same shape fold-scheduler already runs. The canvas is *only the builder*;
 * fold-scheduler (the Worker) is the runner. No credential is ever stored: type `{{secret:NAME}}`
 * into a url/headers/body field and the runner resolves it at call time.
 *
 * Wiring into the fold is the fold-scheduler client for auth + the create call.
 */
(function () {
  'use strict';
  if (typeof LiteGraph === 'undefined' || typeof FoldScheduler === 'undefined') return;

  // ── nodes ──────────────────────────────────────────────────────────────────
  function TriggerNode() {
    LiteGraph.LGraphNode.call(this);
    this.title = 'Trigger';
    this.addOutput('then', 'seq');
    this.interval = 60;
    this.automationName = 'automation';
    this.addWidget('text', 'name', this.automationName, (v) => { this.automationName = v; });
    this.addWidget('number', 'every (min)', this.interval, (v) => { this.interval = v; }, { min: 1, step: 1, precision: 0 });
    this.size = [220, 90];
  }
  TriggerNode.title = 'Trigger';
  TriggerNode.prototype = Object.create(LiteGraph.LGraphNode.prototype);
  TriggerNode.prototype.constructor = TriggerNode;

  var METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];
  function StepNode() {
    LiteGraph.LGraphNode.call(this);
    this.title = 'Step';
    this.addInput('in', 'seq');
    this.addOutput('then', 'seq');
    this.kind = 'request';
    this.method = 'GET'; this.url = ''; this.headers = ''; this.body = ''; this.act = ''; this.params = '';
    var self = this;
    this.addWidget('combo', 'kind', this.kind, (v) => { self.kind = v; }, { values: ['request', 'action'] });
    this.addWidget('combo', 'method', this.method, (v) => { self.method = v; }, { values: METHODS });
    this.addWidget('text', 'url', this.url, (v) => { self.url = v; });
    this.addWidget('text', 'action', this.act, (v) => { self.act = v; });
    this.addWidget('text', 'params (JSON)', this.params, (v) => { self.params = v; });
    this.addWidget('text', 'headers (JSON)', this.headers, (v) => { self.headers = v; });
    this.addWidget('text', 'body', this.body, (v) => { self.body = v; });
    this.size = [260, 210];
  }
  StepNode.title = 'Step';
  StepNode.prototype = Object.create(LiteGraph.LGraphNode.prototype);
  StepNode.prototype.constructor = StepNode;

  LiteGraph.registerNodeType('fold/trigger', TriggerNode);
  LiteGraph.registerNodeType('fold/step', StepNode);

  var graph, canvas;

  function outNode(node) {
    var o = node.outputs && node.outputs[0];
    if (!o || !o.links || !o.links.length) return null;
    var link = graph.links[o.links[0]];
    return link ? graph.getNodeById(link.target_id) : null;
  }

  function jsonOr(v, what) {
    if (!v || !v.trim()) return undefined;
    try { return JSON.parse(v); } catch (e) { throw new Error(what + ' must be valid JSON'); }
  }

  function stepOf(n) {
    if (n.kind === 'action') {
      if (!n.act) throw new Error('an action step needs an action name');
      return { action: n.act, params: jsonOr(n.params, 'params') || {} };
    }
    if (!n.url) throw new Error('a request step needs a URL');
    var s = { method: n.method || 'GET', url: n.url };
    var h = jsonOr(n.headers, 'headers'); if (h) s.headers = h;
    if (n.body && n.method !== 'GET' && n.method !== 'HEAD') s.body = n.body;
    return s;
  }

  // Walk the trigger's chain; that order is the automation's steps.
  function build() {
    var trigger = (graph._nodes || []).filter(function (n) { return n.type === 'fold/trigger'; })[0];
    if (!trigger) throw new Error('add a Trigger node');
    var intervalMinutes = Math.max(1, Math.trunc(trigger.interval || 60));
    var name = (trigger.automationName || '').trim() || 'automation';
    var steps = [], n = outNode(trigger), guard = 0;
    while (n && guard++ < 50) { if (n.type === 'fold/step') steps.push(stepOf(n)); n = outNode(n); }
    if (!steps.length) throw new Error('connect at least one Step to the Trigger');
    return { name: name, intervalMinutes: intervalMinutes, steps: steps };
  }

  function save() { try { localStorage.setItem('fold:canvas', JSON.stringify(graph.serialize())); } catch (e) {} }
  function load() {
    var s; try { s = localStorage.getItem('fold:canvas'); } catch (e) {}
    if (!s) return false;
    try { graph.configure(JSON.parse(s)); return true; } catch (e) { return false; }
  }
  function status(msg, cls) {
    var el = document.getElementById('status'); if (!el) return;
    el.textContent = msg || ''; el.className = cls || 'muted';
  }

  window.initFoldCanvas = function () {
    var el = document.getElementById('graph');
    if (!el) return;
    graph = new LGraph();
    canvas = new LiteGraph.LGraphCanvas(el, graph);

    if (!load()) {
      var t = LiteGraph.createNode('fold/trigger'); t.pos = [60, 80]; graph.add(t);
      var s = LiteGraph.createNode('fold/step'); s.pos = [360, 60]; graph.add(s);
      t.connect(0, s, 0);
    }

    function size() { el.width = el.clientWidth || 900; el.height = el.clientHeight || 560; canvas.resize(); }
    size();
    window.addEventListener('resize', size);

    var $ = function (id) { return document.getElementById(id); };
    if ($('api')) { $('api').value = FoldScheduler.api || ''; $('api').onchange = function () { FoldScheduler.setApi($('api').value.trim()); }; }
    if ($('signin')) $('signin').textContent = FoldScheduler.signedIn() ? 'Sign out' : 'Sign in with GitHub';
    if ($('signin')) $('signin').onclick = function () { if (FoldScheduler.signedIn()) { FoldScheduler.signOut(); location.reload(); } else { FoldScheduler.signIn(location.href); } };
    if ($('addTrigger')) $('addTrigger').onclick = function () { var n = LiteGraph.createNode('fold/trigger'); n.pos = [60 + Math.random() * 160, 60 + Math.random() * 160]; graph.add(n); save(); };
    if ($('addStep')) $('addStep').onclick = function () { var n = LiteGraph.createNode('fold/step'); n.pos = [340 + Math.random() * 160, 60 + Math.random() * 160]; graph.add(n); save(); };
    if ($('clear')) $('clear').onclick = function () { graph.clear(); save(); };
    if ($('create')) $('create').onclick = function () {
      status('');
      if (!FoldScheduler.api) return status('Set the Worker URL first.', 'err');
      if (!FoldScheduler.signedIn()) return status('Sign in first.', 'err');
      var job; try { job = build(); } catch (e) { return status(e.message, 'err'); }
      save();
      FoldScheduler.createJob(job).then(
        function () { status('Created "' + job.name + '" (' + job.steps.length + ' steps).', 'ok'); },
        function (e) { status('Could not create: ' + (e.message || e), 'err'); },
      );
    };

    status(FoldScheduler.signedIn() ? 'Signed in.' : 'Not signed in — build freely, sign in to save.', 'muted');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { window.initFoldCanvas(); });
  else window.initFoldCanvas();
})();
