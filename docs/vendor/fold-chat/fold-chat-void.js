// fold-chat-void.js — the turn's event record and the question tree projected from it (docs/ANSWER-PIPELINE.md, "Void", "Trace").
// Pure: no DOM, no clock reads, no model, no network.
//
// The record is an APPEND-ONLY list of events. The tree (the "Void" of the contract) is a PROJECTION of those events: state is derived,
// never stored, so replaying the same events into a fresh turn gives a deep-equal tree. A child's status changes only by an event that
// CARRIES EVIDENCE (a row, a probe result, a typed gap); a node with no evidence is 'open', never 'satisfied'.
//
// traceOf(void) reads the same events and writes the first-person lines the person sees: APP-AUTHORED templates keyed by event kind,
// English, never model text. TRACE_TEMPLATES is exported so a later change can translate it. No apparatus nouns on screen.
//
// Event kinds (data carries JSON only):
//   ask          { said, lang, slot, role, referents:[{surface,title}] }       — appended by createTurnVoid(frame)
//   referents    { referents:[{surface,title}] } | { gap }                      — appended by createTurnVoid(frame); evidence: a title, or the typed gap
//   frame-gap    { kind }                                                       — appended by createTurnVoid(frame) when frame.gap
//   read         { source:{title,host,url}, found:false }                       — a source read that states nothing (found:true narrates nothing; 'candidate' does)
//   widen        { asked:[title], read:[{title,host,url}], reason? }            — one wider read of the pages the names resolve to (added by the ANSWERTURN task)
//   candidate    { row }                                                        — a bound row names a filler. evidence: row.sentence
//   no-witness   { kind:'unwitnessed'|'unreached', tried:[…], closest?, reason? }
//   past-only    { row }                                                        — the only row is past tense for a present ask (gap no_present_holder)
//   probes       { probes:[Probe] }                                             — what would make me doubt it (registers one child per probe)
//   probe-result { probe, outcome:'none'|'found'|'unmeasured', lead?, summary?, scope?, passage?, why?, found?, reason?, text? }
//   verdict      { standing, filler?, survived:[…], unmeasured:[…], refuters:[…] }
//   closed       — appended by close() only

const KINDS = Object.freeze(["ask", "referents", "frame-gap", "read", "widen", "candidate", "no-witness", "past-only", "probes", "probe-result", "verdict"]);
const STANDINGS = Object.freeze(["survived", "contested", "refuted", "unmeasured"]);
const LOCAL_KINDS = Object.freeze(["rival-holder", "negation", "later-date"]);

// ── plain words ──────────────────────────────────────────────────────────────────────────────────────────────────
const q = (s) => `“${s}”`;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const list = (xs) => (xs.length <= 1 ? xs.join("") : xs.length === 2 ? `${xs[0]} or ${xs[1]}` : `${xs.slice(0, -1).join(", ")}, or ${xs[xs.length - 1]}`);
const andList = (xs) => (xs.length <= 1 ? xs.join("") : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`);
const dot = (s) => (/[.!?。！？]$/u.test(String(s)) ? "" : ".");
const site = (s) => (s && s.host ? ` (${s.host})` : "");

/** What each check is called, per probe kind. `doubt` = [mid-sentence, sentence-start] forms, so no casing is computed. */
export const PROBE_WORDS = Object.freeze({
  "life-dates": { doubt: ["a death", "A death"], looked: "a death date", check: (name) => `whether ${name} is still living` },
  "rival-holder": { doubt: ["another holder", "Another holder"], looked: "another holder", check: () => "whether another source names a different holder" },
  "later-date": { doubt: ["a later holder", "A later holder"], looked: "a later holder", check: () => "whether a later-dated source names a newer holder" },
  negation: { doubt: ["a source saying otherwise", "A source saying otherwise"], looked: "a source saying otherwise", check: () => "whether a source says it is not so" },
});
const DOUBT_ORDER = ["later-date", "rival-holder", "life-dates", "negation"];

const ASK_PHRASE = Object.freeze({
  person: (role, of) => `who holds the role ${role ? q(role) : "asked about"}${of}`,
  time: (role, of) => `a date: ${role ? q(role) : "the thing asked about"}${of}`,
  quantity: (role, of) => `how many: ${role ? q(role) : "the thing asked about"}${of}`,
  place: (role, of) => `where: ${role ? q(role) : "the thing asked about"}${of}`,
  thing: (role, of) => `what is the ${role ? q(role) : "thing asked about"}${of}`,
});
export const askPhrase = (d0) => {
  // the ask's leftover words are its role ("king"); when the names took them all ("king" resolved as a page too), the FIRST name the
  // person wrote is what is asked about and the rest is what it is "of" — read from order, never from case
  const all = d0.referents || [];
  const d = !d0.role && all.length >= 2 ? { ...d0, role: all[0].surface, referents: all.slice(1) } : d0;
  const refs = (d.referents || []).map((r) => q(r.title || r.surface)).filter(Boolean);
  const of = refs.length ? ` of ${andList(refs)}` : "";
  return (ASK_PHRASE[d.slot] || ASK_PHRASE.thing)(d.role, of);
};

const GAP_SAY = Object.freeze({
  no_grammar_for_language: "I can't read the grammar of this language yet, so I'm not guessing.",
  frame_unread: "I couldn't read this question as one fact to look up.",
  referents_unresolved: "I couldn't match the names in the question to pages, so I'm not guessing.",
});

/** The trace templates, keyed by event kind. (data, state) -> [{ say, detail?, probe?, result? }]. English; replace to translate. */
export const TRACE_TEMPLATES = Object.freeze({
  ask: (d) => (d.slot
    ? [{ say: `It looks like a question of fact: ${askPhrase(d)}.` }, { say: "I can't answer that from memory, so I'm reading sources." }]
    : [{ say: "I can't tell what single fact is being asked." }]),
  referents: () => [],
  "frame-gap": (d) => [{ say: GAP_SAY[d.kind] || GAP_SAY.frame_unread }],
  read: (d) => (d.found === false && d.source
    ? [{ say: `I read ${d.source.title || "a page"}${site(d.source)}, but no sentence in it states the answer.` }] : []),
  widen: (d) => {
    const asked = (d.asked || []).map(q);
    const read = (d.read || []).map((r) => `${r.title || "a page"}${site(r)}`);
    return read.length
      ? [{ say: `Nothing I had read stated it, so I looked wider and read ${andList(read)}.` }]
      : [{ say: `Nothing I had read stated it, so I looked wider at ${andList(asked)}${d.reason ? `, but ${d.reason}` : " and found nothing I could read"}.`, unmeasured: !!d.reason }];
  },
  candidate: (d, s) => {
    const row = d.row || {};
    const name = (row.filler && row.filler.text) || s.filler;
    return [{ say: `I read ${(row.source && row.source.title) || "a page"}${site(row.source)}. One sentence states it: “${row.sentence}”${dot(row.sentence)}`, detail: name ? `The sentence names ${name}.` : undefined }];
  },
  "no-witness": (d) => {
    const lines = [];
    const n = (d.tried || []).length;
    if (d.kind === "unreached") lines.push({ say: "I could not read any source, so I'm not answering." });
    else lines.push({ say: `I read ${plural(n, "source")}, and none has a sentence that states it, so I'm not answering.` });
    if (d.closest && d.closest.sentence) lines.push({ say: `The closest sentence I found is “${d.closest.sentence}”${dot(d.closest.sentence)}`, detail: (d.closest.source && d.closest.source.title) || undefined });
    return lines;
  },
  "past-only": (d) => [{ say: `The only sentence I found is in the past tense: “${d.row.sentence}” — it doesn't say who holds it now, so I'm not answering.`, detail: (d.row.source && d.row.source.title) || undefined }],
  probes: (d, s) => {
    const kinds = DOUBT_ORDER.filter((k) => (d.probes || []).some((p) => p.kind === k));
    if (!kinds.length) return [];
    const text = list(kinds.map((k, i) => PROBE_WORDS[k].doubt[i === 0 ? 1 : 0]));
    return [{ say: `That says ${s.filler || "that"}. What would make me doubt it? ${text}.` }];
  },
  "probe-result": (d, s) => {
    const p = d.probe || {};
    const w = PROBE_WORDS[p.kind] || { looked: p.kind, check: () => "that" };
    const name = s.filler || (p.query || "it");
    if (d.outcome === "unmeasured") {
      return [{ say: `This could not be checked (${w.check(name)}): ${d.reason || "I had nothing to check it with"}.`, probe: p, result: "found nothing to check with", unmeasured: true }];
    }
    if (d.outcome === "found") {
      if (p.network) {
        return [
          { say: `I searched ${q(p.query)} and read ${d.lead && d.lead.title ? `the page ${q(d.lead.title)}` : "its page"}.`, probe: p },
          { say: d.why, detail: d.passage && d.passage.text, probe: p, result: `found ${d.found || "something against it"}` },
        ];
      }
      return [{ say: `${d.why}${d.passage ? ` It says: “${d.passage.text}”${dot(d.passage.text)}` : ""}`, detail: (d.passage && d.passage.title) || undefined, probe: p, result: `found ${d.found || "something against it"}` }];
    }
    if (p.network) {
      return [{ say: `I searched ${q(p.query)} and read ${d.lead && d.lead.title ? `the page ${q(d.lead.title)}` : "its page"}: ${d.summary || "nothing there counts against it"}.`, probe: p, result: "found nothing" }];
    }
    return [{ say: `I looked for ${w.looked} in ${d.scope || "the rest of that page"} and found none.`, probe: p, result: "found nothing" }];
  },
  verdict: (d, s) => {
    const name = d.filler || s.filler || "that";
    const lines = [];
    if (d.standing === "survived") lines.push({ say: `So I'm answering ${name}, and saying what I checked.` });
    else if (d.standing === "contested") lines.push({ say: "So I'm not picking one: the sources disagree, and I'm showing both." });
    else if (d.standing === "refuted") lines.push({ say: `So I'm not answering ${name}: what I found says it can't be right.` });
    else lines.push({ say: `So I'm giving ${name} only because the source says so: none of my checks could be run, and I'm saying so.`, unmeasured: true });
    if (d.standing === "survived" && (d.unmeasured || []).length) lines.push({ say: `I could not check: ${list(d.unmeasured.map(stripReason))}.`, unmeasured: true });
    return lines;
  },
});
const stripReason = (s) => String(s).split(": ")[0];

// ── evidence ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** Does this event carry evidence for the status it would set? An event without it changes nothing. */
export function hasEvidence(ev) {
  const d = (ev && ev.data) || {};
  switch (ev && ev.kind) {
    case "referents": return !!(d.gap || (Array.isArray(d.referents) && d.referents.some((r) => r && r.title)));
    case "candidate": return !!(d.row && typeof d.row.sentence === "string" && d.row.sentence);
    case "past-only": return !!(d.row && typeof d.row.sentence === "string" && d.row.sentence);
    case "widen": return Array.isArray(d.asked) && d.asked.length > 0;
    case "no-witness": return d.kind === "unreached" ? !!d.reason : (Array.isArray(d.tried) && d.tried.length > 0) || !!(d.closest && d.closest.sentence);
    case "frame-gap": return !!d.kind;
    case "probe-result":
      if (!d.probe || !d.probe.id) return false;
      if (d.outcome === "found") return !!(d.passage && d.passage.text);
      if (d.outcome === "none") return !!(d.lead || (typeof d.scope === "string" && d.scope));
      if (d.outcome === "unmeasured") return !!d.reason;
      return false;
    case "verdict": return STANDINGS.includes(d.standing) && ((d.survived || []).length + (d.unmeasured || []).length + (d.refuters || []).length > 0);
    default: return false;
  }
}

// ── the turn's record ────────────────────────────────────────────────────────────────────────────────────────────
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const deepFreeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) deepFreeze(o[k]); } return o; };

const roleOf = (frame) => (frame && Array.isArray(frame.predicate) ? frame.predicate.map((p) => p.surface || p.stem).filter(Boolean).join(" ") : "");

/** Open the turn's record for a Frame. events[0] is the 'ask'; the referents (and a frame gap) follow, from the frame's own fields. */
export function createTurnVoid(frame) {
  const f = frame || {};
  const events = [];
  let closed = false;
  const push = (kind, data) => { const ev = deepFreeze({ n: events.length, kind, data: clone(data) ?? {} }); events.push(ev); return ev; };
  push("ask", { said: f.said || "", lang: f.lang || null, slot: f.slot || null, role: roleOf(f), referents: (f.referents || []).map((r) => ({ surface: r.surface, title: r.title || null })) });
  if (f.gap && f.gap.kind) push("frame-gap", { kind: f.gap.kind });
  if ((f.referents || []).length) push("referents", { referents: f.referents.map((r) => ({ surface: r.surface, title: r.title || null })) });
  else if (f.gap && f.gap.kind === "referents_unresolved") push("referents", { gap: "referents_unresolved" });
  const handle = {
    /** The tree, derived from the events every time it is read. */
    get void() { return projectVoid(events); },
    /** A snapshot of the append-only record (frozen entries). */
    get events() { return events.slice(); },
    get closed() { return closed; },
    note(kind, data = {}) {
      if (closed) throw new Error("this turn's record is closed");
      if (!KINDS.includes(kind) || kind === "ask") throw new TypeError(`unknown event kind: ${kind}`);
      return push(kind, data);
    },
    /** Seal the record; later notes throw. Returns the final tree. */
    close() { if (!closed) { closed = true; push("closed", {}); } return projectVoid(events); },
  };
  return handle;
}

/** Rebuild a turn from a frame and its events (the replay used to prove the tree is a projection). */
export function replayVoid(frame, events) {
  const t = createTurnVoid(frame);
  const seeded = t.events.length;
  for (const ev of events.slice(seeded)) { if (ev.kind === "closed") t.close(); else t.note(ev.kind, ev.data); }
  return t;
}

// ── the projection ───────────────────────────────────────────────────────────────────────────────────────────────
const mk = (id, kind, text, status, basis, children, events) => ({ id, kind, text, status, basis, children, events });

/** events -> the Void tree (contract shape). Pure; reads only the events. */
export function projectVoid(events) {
  const evs = Array.isArray(events) ? events : [];
  const ask = evs.find((e) => e.kind === "ask");
  const ad = (ask && ask.data) || {};
  const ev = (...kinds) => evs.filter((e) => kinds.includes(e.kind));
  const good = (list) => list.filter(hasEvidence);

  // referents
  const refEvs = ev("referents");
  const refGood = good(refEvs);
  const refResolved = refGood.find((e) => !e.data.gap);
  const refStatus = refResolved ? "satisfied" : refGood.length ? "refused" : "open";
  const refNames = (ad.referents || []).map((r) => q(r.surface));
  const refNode = mk("v0.1", "referents", `what ${andList(refNames) || "the names"} ${refNames.length > 1 ? "refer" : "refers"} to`,
    refStatus, refResolved ? "read" : refGood.length ? "unmeasured" : "declared", [], refEvs);

  // the probes and their results, last-wins per id
  const planned = new Map();
  for (const e of ev("probes")) for (const p of e.data.probes || []) planned.set(p.id, { probe: p, ev: e });
  const results = new Map();
  for (const e of ev("probe-result")) if (e.data.probe && e.data.probe.id) results.set(e.data.probe.id, e);
  for (const [id, e] of results) if (!planned.has(id)) planned.set(id, { probe: e.data.probe, ev: null });
  const probeNodes = [...planned.values()].map(({ probe, ev: pe }, i) => {
    const re = results.get(probe.id);
    const ok = re && hasEvidence(re);
    const status = !ok ? "open" : re.data.outcome === "none" ? "satisfied" : re.data.outcome === "found" ? "refused" : "unmeasured";
    const basis = !ok ? "declared" : re.data.outcome === "unmeasured" ? "unmeasured" : "read";
    return mk(`v0.5.${i + 1}`, "falsify", probe.why || probe.kind, status, basis, [], [pe, re].filter(Boolean));
  });
  const kindOf = (id) => planned.get(id).probe.kind;

  // filler
  const cands = good(ev("candidate"));
  const cand = cands[cands.length - 1];
  const nowit = good(ev("no-witness"))[0];
  const verdictEv = good(ev("verdict")).slice(-1)[0];
  const stand = verdictEv && verdictEv.data.standing;
  let fillerStatus = "open", fillerBasis = "declared";
  if (cand) { fillerStatus = stand === "contested" ? "contested" : stand === "refuted" ? "refused" : stand === "unmeasured" ? "unmeasured" : "satisfied"; fillerBasis = fillerStatus === "unmeasured" ? "unmeasured" : "read"; }
  else if (nowit) { fillerStatus = nowit.data.kind === "unreached" ? "unmeasured" : "refused"; fillerBasis = nowit.data.kind === "unreached" ? "unmeasured" : "read"; }
  const filler = cand ? (cand.data.row.filler && cand.data.row.filler.text) || "" : "";
  const fillerNode = mk("v0.2", "filler", filler ? `who or what fills it: ${q(filler)}` : "who or what fills it", fillerStatus, fillerBasis, [], ev("read", "candidate", "no-witness", "verdict"));

  // currency: is it the CURRENT one?
  const lifeId = [...planned.keys()].find((id) => kindOf(id) === "life-dates");
  const lifeRes = lifeId && results.get(lifeId) && hasEvidence(results.get(lifeId)) ? results.get(lifeId) : null;
  const past = good(ev("past-only"))[0];
  let curStatus = "open", curBasis = "declared";
  if (past) { curStatus = "refused"; curBasis = "read"; }
  else if (lifeRes) { curStatus = lifeRes.data.outcome === "none" ? "satisfied" : lifeRes.data.outcome === "found" ? "refused" : "unmeasured"; curBasis = curStatus === "unmeasured" ? "unmeasured" : "read"; }
  const curNode = mk("v0.3", "currency", "is it the current one", curStatus, curBasis, [], [...(past ? [past] : []), ...(lifeId ? [planned.get(lifeId).ev, results.get(lifeId)].filter(Boolean) : [])]);

  // rival: is there another holder?
  const rivalIds = [...planned.keys()].filter((id) => LOCAL_KINDS.includes(kindOf(id)));
  const rivalRes = rivalIds.map((id) => results.get(id)).filter((e) => e && hasEvidence(e));
  let rivStatus = "open", rivBasis = "declared";
  if (rivalRes.some((e) => e.data.outcome === "found")) { rivStatus = "contested"; rivBasis = "read"; }
  else if (rivalRes.some((e) => e.data.outcome === "none")) { rivStatus = "satisfied"; rivBasis = "read"; }
  else if (rivalRes.length) { rivStatus = "unmeasured"; rivBasis = "unmeasured"; }
  const rivNode = mk("v0.4", "rival", "is there another holder", rivStatus, rivBasis, [], rivalIds.flatMap((id) => [planned.get(id).ev, results.get(id)].filter(Boolean)));

  // falsify: any attempt that refuted -> refused; any still open -> open; else satisfied unless every one is unmeasured
  const ps = probeNodes.map((n) => n.status);
  let falStatus = "open", falBasis = "declared";
  if (ps.length) {
    if (ps.includes("refused")) falStatus = "refused";
    else if (ps.includes("open")) falStatus = "open";
    else if (ps.includes("satisfied")) falStatus = "satisfied";
    else falStatus = "unmeasured";
    falBasis = falStatus === "open" ? "declared" : falStatus === "unmeasured" ? "unmeasured" : "read";
  }
  const falNode = mk("v0.5", "falsify", "what would make me doubt it", falStatus, falBasis, probeNodes, ev("probes", "probe-result"));

  // the ask
  let status = "open";
  const frameGap = good(ev("frame-gap"))[0];
  if (frameGap || (nowit && !cand)) status = nowit && nowit.data.kind === "unreached" && !frameGap ? "unmeasured" : "refused";
  else if (past && !cand) status = "refused";
  else if (verdictEv) status = stand === "survived" ? "satisfied" : stand === "contested" ? "contested" : stand === "refuted" ? "refused" : "unmeasured";
  const root = mk("v0", "ask", askPhrase(ad), status, status === "unmeasured" ? "unmeasured" : "asked", [refNode, fillerNode, curNode, rivNode, falNode], evs.slice());
  return root;
}

/** The invariant: a node is anything but 'open' only because an event of the right kind that carries evidence says so. Throws on a violation. */
const STATUS_KINDS = Object.freeze({
  ask: ["verdict", "no-witness", "past-only", "frame-gap"], referents: ["referents"], filler: ["candidate", "no-witness"],
  currency: ["probe-result", "past-only"], rival: ["probe-result"], falsify: ["probe-result"],
});
export function assertInvariant(node) {
  const kinds = STATUS_KINDS[node.kind] || [];
  if (node.status !== "open" && !node.events.some((e) => kinds.includes(e.kind) && hasEvidence(e))) {
    throw new Error(`void ${node.id} (${node.kind}) is '${node.status}' with no evidence`);
  }
  for (const c of node.children) assertInvariant(c);
  return true;
}

// ── the trace ────────────────────────────────────────────────────────────────────────────────────────────────────
const SAYS_ONLY_WITH_EVIDENCE = Object.freeze(["widen", "candidate", "past-only", "no-witness", "frame-gap", "probe-result", "verdict"]);
/** Read the turn's events (from a tree root, or from the createTurnVoid handle) into the first-person lines. Every line is who:'app'. */
export function traceOf(v, { templates = TRACE_TEMPLATES } = {}) {
  const evs = (v && v.events) || [];
  const out = [];
  const state = { filler: "" };
  const add = (line) => out.push({ n: out.length + 1, who: "app", ...line });
  let pending = [];                  // consecutive local 'found nothing' results, said as ONE line
  let pendingU = [];                 // consecutive local results that could not be run for the same reason, said as ONE line
  const flushU = () => {
    if (!pendingU.length) return;
    const checks = pendingU.map((d) => PROBE_WORDS[d.probe.kind] ? PROBE_WORDS[d.probe.kind].check(state.filler || d.probe.query || "it") : d.probe.kind);
    add({ say: `This could not be checked (${andList(checks)}): ${pendingU[0].reason || "I had nothing to check it with"}.`, probe: pendingU[0].probe, result: "found nothing to check with", unmeasured: true });
    pendingU = [];
  };
  const flush = () => {
    flushU();
    if (!pending.length) return;
    const byScope = new Map();
    for (const d of pending) { const k = d.scope || "the rest of that page"; byScope.set(k, [...(byScope.get(k) || []), d]); }
    for (const [scope, ds] of byScope) {
      const things = DOUBT_ORDER.filter((k) => ds.some((d) => d.probe.kind === k)).map((k) => PROBE_WORDS[k].looked);
      add({ say: `I looked for ${andList(things)} in ${scope} and found none.`, probe: ds[0].probe, result: "found nothing" });
    }
    pending = [];
  };
  for (const ev of evs) {
    if (ev.kind === "closed") continue;
    if (ev.kind === "candidate" && ev.data.row && ev.data.row.filler) state.filler = ev.data.row.filler.text || state.filler;
    if (ev.kind === "probe-result" && ev.data.outcome === "none" && ev.data.probe && !ev.data.probe.network && hasEvidence(ev)) { flushU(); pending.push(ev.data); continue; }
    if (ev.kind === "probe-result" && ev.data.outcome === "unmeasured" && ev.data.probe && !ev.data.probe.network && hasEvidence(ev)
      && (!pendingU.length || pendingU[0].reason === ev.data.reason)) { if (pending.length) flush(); pendingU.push(ev.data); continue; }
    flush();
    if (SAYS_ONLY_WITH_EVIDENCE.includes(ev.kind) && !hasEvidence(ev)) continue;  // no evidence, no line
    const tpl = templates[ev.kind];
    if (!tpl) continue;
    for (const line of tpl(ev.data, state)) add(line);
  }
  flush();
  return out;
}

/** Note a runFalsify() result into the turn: what was planned, what each attempt found, and the verdict. */
export function noteFalsification(turn, run, filler) {
  turn.note("probes", { probes: run.probes });
  for (const k of run.checks) {
    const d = { probe: k.probe, outcome: k.outcome };
    if (k.lead) d.lead = k.lead;
    if (k.summary) d.summary = k.summary;
    if (k.scope) d.scope = k.scope;
    if (k.text) d.text = k.text;
    if (k.reason) d.reason = k.reason;
    if (k.found) d.found = k.found;
    if (k.why) d.why = k.why;
    if (k.refuters && k.refuters[0]) { d.passage = k.refuters[0].passage; d.why = d.why || k.refuters[0].why; }
    turn.note("probe-result", d);
  }
  turn.note("verdict", { standing: run.standing, filler: filler || undefined, survived: run.survived, unmeasured: run.unmeasured, refuters: run.refuters.map((r) => ({ kind: r.probe.kind, why: r.why })) });
}
