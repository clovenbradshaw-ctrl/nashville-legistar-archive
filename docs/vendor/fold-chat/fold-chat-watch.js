// fold-chat-watch.js — the DISCOURSE WATCHER. Pure: no DOM, no IO, no model. Its inputs are three, and it keeps them apart:
//   the EXCHANGE      what the person asked and what was said back (the thread);
//   the ACTIONS       what the system DID this turn — a typed log of searches issued, pages read or unreadable, models called, lanes run,
//                     lines read back (the turn feed, `actionsOf`): its meta-awareness, so it judges content in the light of what was done;
//   the CONTENT       what was surfed — the pages that came back, as text (`contentOf`) — so it can say whether they bear on the thread.
// It never writes the answer and never repairs one. It runs TWICE per turn and is a relay:
//
//   PRE  (before anything goes to the internet)  pre({ ask, prior })
//        "What does the person actually want?" Reads the ask against the thread AND against the BATON the last watcher left, and
//        names the want (answer | source | explain | challenge | continue | chat), what the turn is expected to do (search which topic,
//        or not at all; a model, or not), and any want the last turn left UNMET. It does not dispatch: the plan is fold-chat-flow.js
//        planTurn, there is ONE owner of it; the watcher states the expectation next to it, and the audit holds the turn to it.
//   POST (after the turn)   post({ ask, prior, pre, reads, spoken, reached })
//        Lays what the turn DID against the expectation → typed flags (shown, never repaired) — and LEAVES A BATON for the next
//        watcher: the want, whether it was met, the topic, what was tried, what to avoid, what is still open.
//
// THE BATON is the connective tissue between turns. It is NOT the discourse summary (fold-chat-exchange.js: what was asked and said,
// for the model and the person). The summary is the record of the exchange; the baton is the watcher's note to its next self about the
// WORK — "the person asked for a primary source; none was reached; these domains were tried". It rides on the assistant message
// (`watch.baton`), is plain JSON, and a turn with no earlier baton starts clean.
//
// THE BATON IS COMPACT: domains and the gist of what was done — never full URLs, queries or step lists. The full account is kept apart on the
// message (`watch.detail`) and the next watcher does not carry it; it is read only when the person DRILLS DOWN ("what did you search for?",
// "which pages?", "what did you actually do?") — then `inspectReply` answers from it, in the app's words, with no search and no model.
//
// Why (measured 2026-10-06, live chat): "find a primary source" after an answer about the king of the UK was searched as its own words
// and teacher guides to primary sources were read and spoken as the answer; "where did you get that?" then searched the PREVIOUS
// source-ask, because the thread took it for the topic. Nothing watched the exchange for "this search is about the follow-up, not
// the thread", and nothing remembered that a want had gone unmet. The flags below are those findings, generalised.
//
// DECLARED, NOT MEASURED (Constitution II.11): `minReads`, the reading of a page as "about" a word when its URL carries it, and the
// English-only cue lists inherited from fold-chat-thread.js / fold-chat-sourceask.js. A language without cues is simply `opens`/`answer`.

import { planTurn } from "./fold-chat-flow.js";
import { threadOf, topicOf } from "./fold-chat-thread.js";
import { wantsNewSource, sourceRecall } from "./fold-chat-sourceask.js";
import * as ground from "./fold-chat-ground.js";

export const WATCH = Object.freeze({
  minReads: 2,      // fewer reads than this is too little to say a search was about something else
});

const words = (q) => String(q ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
const stem = (w) => (ground.stemOf ? ground.stemOf(w) : w);   // the chat's own stemmer (the one provenance and the grounding use)

const RELATION = { "source-ask": "source-ask", move: "push-back", meta: "meta", retry: "nudge", carried: "continues", elliptical: "continues", standalone: "opens" };

/** How this ask relates to the thread, and what the turn is expected to do. Read-only over `prior` (the stored messages BEFORE the ask). */
export function watchTurn(ask, prior = [], opts = {}) {
  const plan = planTurn(ask, prior, opts);
  const thread = threadOf(prior);
  const relation = RELATION[plan.kind] || "opens";
  const topicAsk = thread.topicAsk || thread.ask || null;
  const expect = {
    search: plan.mode === "web" ? (relation === "opens" ? "own" : "topic") : "none",
    topic: plan.mode === "web" ? (plan.search || ask) : null,
    model: !!plan.modelMay,
  };
  return { relation, plan, thread, topicAsk, expect, ownWords: words(ask) };
}

const hostWords = (url) => words(String(url || "").replace(/^https?:\/\/(?:www\.)?/, "").replace(/[._\-/=?&]+/g, " "));

/** What the turn did, against what the watcher expected. `reads` are the URLs (or "host/path" strings) the turn read. `spoken` is what
 *  the person was shown. Flags, each with the evidence that raised it:
 *    follow_up_searched_literally   a continuing / source / meta / nudge ask whose every read page is silent about the thread's topic
 *    searched_when_none_expected    the plan said no search and pages were read anyway
 *    repeated_last_answer           the answer is word-for-word the previous one (a loop)
 *    drifted_from_thread            a continuing ask whose answer shares no content word with the thread's topic ask or last answer */
export function audit({ ask, prior = [], plan = null, reads = [], spoken = "" } = {}) {
  const w = watchTurn(ask, prior, {});
  const flags = [];
  const pl = plan || w.plan;
  const topicStems = new Set(words(topicOf(w.topicAsk || "")).map(stem));
  const ownStems = new Set(words(ask).map(stem).filter((x) => x.length > 2));
  // a continuing / source / meta / nudge ask is about the THREAD's topic: if every page it read is silent about that topic (no topic word in its
  // URL), the search was about something else — in the measured case, the follow-up's own words ("primary sources") carried over from an earlier turn
  if (w.relation !== "opens" && topicStems.size && reads.length >= WATCH.minReads) {
    const off = reads.filter((u) => { const hw = new Set(hostWords(u).map(stem)); return ![...topicStems].some((s) => hw.has(s)); });
    if (off.length === reads.length) flags.push({ flag: "follow_up_searched_literally", relation: w.relation, topic: [...topicStems].join(" "), evidence: off.slice(0, 5) });
  }
  if (pl && pl.mode !== "web" && reads.length) flags.push({ flag: "searched_when_none_expected", evidence: reads.slice(0, 3) });
  const last = [...prior].reverse().find((m) => m?.role === "assistant" && String(m.content || "").trim());
  const norm = (t) => words(t).join(" ");
  if (last && norm(spoken) && norm(spoken) === norm(last.content)) flags.push({ flag: "repeated_last_answer" });
  if (w.relation === "continues" && String(spoken).trim()) {
    const ctx = new Set([...topicStems, ...words(last?.content || "").map(stem)].filter((x) => x.length > 2));
    const said = words(spoken).map(stem).filter((x) => x.length > 2);
    if (ctx.size && said.length && !said.some((s) => ctx.has(s))) flags.push({ flag: "drifted_from_thread", evidence: String(spoken).slice(0, 80) });
  }
  return { relation: w.relation, expect: w.expect, flags };
}


const WANT = { "source-ask": "source", move: "challenge", meta: "explain", retry: "continue", carried: "answer", elliptical: "answer", standalone: "answer" };

/** The baton the last watcher left: on the last assistant message of the thread (or null). */
export function batonOf(prior = []) {
  const m = [...(Array.isArray(prior) ? prior : [])].reverse().find((x) => x?.role === "assistant" && x.watch && x.watch.baton);
  return m ? m.watch.baton : null;
}

/** PRE: what does the person actually want — before any search. `inherited` is the last watcher's baton; `unmet` is a want it left open. */
export function pre({ ask, prior = [], opts = {} } = {}) {
  const w = watchTurn(ask, prior, opts);
  const baton = batonOf(prior);
  let want = WANT[w.plan.kind] || "answer";
  if (isInspectAsk(ask) && detailOf(prior)) want = "inspect";
  if (want === "chat") want = "answer";
  const sub = want === "source" ? (wantsNewSource(ask) ? "new" : "recall") : null;
  const unmet = baton && baton.met === false ? { want: baton.want, sub: baton.sub || null, topic: baton.topic || null, tried: baton.tried || [] } : null;
  const notes = [];
  if (unmet && want === "source" && sub === "new") notes.push("the last turn did not reach what was asked; do not repeat the same hosts");
  if (unmet && unmet.want === "source" && (w.relation === "nudge" || w.relation === "push-back")) notes.push("the person is pressing on a source request that is still open");
  return { ...w, want, sub, inherited: baton, unmet, avoid: unmet ? unmet.tried : [], notes };
}

/** POST: hold the turn to what PRE expected, then leave the baton. `reached` = the turn gave the person what they wanted (a verified
 *  source line for a source want; an answer for an answer want) — the caller says so, from its own evidence (provenance.verified). */
export function post({ ask, prior = [], pre: p = null, reads = [], spoken = "", reached = null, tier = null, events = null, passages = null, setAside = [] } = {}) {
  const pr = p || pre({ ask, prior });
  const did = actionsOf(events);
  const content = contentOf(passages);
  if (content.length && !reads.length) reads = content.map((c) => c.url).filter(Boolean);
  const a = audit({ ask, prior, plan: pr.plan, reads, spoken });
  const verdicts = content.length ? pageVerdicts(content, topicStemsOf(pr, prior)) : [];
  const offTopic = [...verdicts.filter((v) => !v.bears), ...(setAside || []).map((u) => ({ url: String(u), bears: false }))];
  if (verdicts.length >= 2 && offTopic.length * 2 > verdicts.length) a.flags.push({ flag: "surfed_content_off_topic", evidence: offTopic.map((v) => v.url).slice(0, 5), of: verdicts.length });
  if (pr.expect.search === "none" && (did.searches || did.searched.length)) a.flags.push({ flag: "searched_when_none_expected", evidence: did.searched.slice(0, 2) });
  const reread = pr.avoid && pr.avoid.length && hostsOf(reads).length && hostsOf(reads).every((h) => pr.avoid.includes(h));
  if (reread && pr.sub === "new") a.flags.push({ flag: "repeated_hosts_despite_baton", evidence: hostsOf(reads).slice(0, 4) });
  const met = reached == null ? null : !!reached;
  const hosts = hostsOf(reads);
  const tried = [...new Set([...(pr.unmet ? pr.unmet.tried : []), ...hosts])].slice(0, 12);
  const open = [];
  if (pr.want === "source" && met === false) open.push(pr.sub === "new" ? "no primary page reached for the topic" : "no verified source line to read back");
  if (pr.want === "source" && met && tier && tier !== "primary" && tier !== "origin" && pr.sub === "new") { open.push("only a secondary page was reached"); }
  const baton = {
    schema: "Baton@1", relation: pr.relation, want: pr.want, sub: pr.sub, topic: pr.expect.topic || pr.topicAsk || null,
    met: pr.want === "source" && pr.sub === "new" && met && tier && tier !== "primary" && tier !== "origin" ? false : met,
    tried, open, flags: [...new Set(a.flags.map((f) => f.flag))],
    did: compactDid(did, hosts, offTopic),
  };
  const detail = { queries: did.searched, searches: did.searches, urls: (reads || []).slice(0, 20), unreadable: did.unreadable, offTopic: offTopic.map((v) => v.url).slice(0, 10), steps: did.titles.slice(0, 30), lanes: did.lanes };
  // A turn that only READ BACK (a recall, a drill-down) did no work of its own: the work state the last acting turn left rides on unchanged, so an unmet want stays unmet.
  const inh = pr.inherited;
  const carried = !!(inh && (pr.want === "inspect" || (did.recalled && !did.searches && !did.read)));
  const out = carried ? { ...inh, relation: pr.relation, want: inh.want, lastTurnWant: pr.want, carried: true } : baton;
  return { relation: pr.relation, want: pr.want, flags: a.flags, baton: out, detail: carried ? null : detail, verdicts, appAnswered: carried };
}

/** The app-authored line for the feed, from PRE: what it understood the person to want. No model. */
export function wantLine(p) {
  const t = p?.expect?.topic ? ` \u201c${String(p.expect.topic).slice(0, 80)}\u201d` : "";
  if (p.want === "source") return p.sub === "recall" ? "Read this as: where did the last answer come from" : `Read this as: a source for the last answer's topic${t}`;
  if (p.want === "inspect") return "Read this as: what did you actually do last turn";
  if (p.want === "challenge") return "Read this as: are you sure about the last answer";
  if (p.want === "explain") return "Read this as: say the last answer differently";
  if (p.want === "continue") return "Read this as: pick the earlier ask back up";
  return p.relation === "continues" ? `Read this as: a follow-on about${t}` : `Read this as: a new question${t}`;
}


const hostsOf = (urls) => [...new Set((urls || []).map((u) => String(u).replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "")))].filter(Boolean);

/** ACTIONS: the turn feed's events (fold-chat-turnfeed.js: line / begin / end with a title and a note) read into what the system did.
 *  Counts and names only: the titles are the app's own words, so this reads them by the words the app itself uses. */
export function actionsOf(events) {
  const evs = (Array.isArray(events) ? events : []).filter((e) => e && e.type === "t" && e.title);
  const out = { searches: 0, searched: [], read: 0, unreadable: 0, modelCalls: 0, recalled: false, lanes: [], titles: [] };
  for (const e of evs) {
    const t = String(e.title), n = String(e.note || "");
    if (e.op === "begin") continue;
    out.titles.push(t);
    let m;
    if (/^Searched /i.test(t)) out.searches++;
    if ((m = /searching for\s*[\u201c"]?([^\u201d"]+)/i.exec(n))) out.searched.push(m[1].trim().slice(0, 90));
    if (/^Could not read/i.test(t)) out.unreadable++;
    else if (/^Read (?!your question|what you|back|the draft)/i.test(t)) out.read++;
    if (/^Wrote the answer|^Asked the model|^The model/i.test(t)) out.modelCalls++;
    if (/^Read back|^Read this/i.test(t)) out.recalled = true;
    if (/^Verified where|^Could not verify a source/i.test(t)) out.lanes.push("provenance");
  }
  out.searched = [...new Set(out.searched)];
  out.lanes = [...new Set(out.lanes)];
  return out;
}

/** CONTENT: the pages that came back, as text (bounded). */
export function contentOf(passages) {
  return (Array.isArray(passages) ? passages : []).filter((p) => p && String(p.text ?? "").trim())
    .map((p) => ({ url: String(p.url || p.source || ""), title: String(p.ref || p.title || ""), text: String(p.text).slice(0, 4000) }));
}

/** The topic the thread is about, as stems: the earlier ask that stood on its own, and the last answer's own words. */
export function topicStemsOf(pr, prior = []) {
  const last = [...(Array.isArray(prior) ? prior : [])].reverse().find((m) => m?.role === "assistant" && String(m.content || "").trim());
  const src = [pr?.expect?.topic || pr?.topicAsk || "", last?.content || ""].join(" ");
  const generic = new Set(["who", "what", "when", "where", "why", "how", "which", "does", "did", "the", "and", "for", "are", "was", "that", "this", "with", "have", "has", "from", "your", "you", "tell", "about"]);
  return [...new Set(words(src).filter((w) => w.length > 2 && !generic.has(w)).map(stem))];
}

/** Does each surfed page bear on the topic? A page bears when its text carries at least half of the topic's stems (rounded up; one is enough for a one-stem topic). */
export function pageVerdicts(content, stems) {
  const need = Math.max(1, Math.ceil(stems.length / 2));
  return (content || []).map((c) => {
    const have = new Set(words(c.text).map(stem));
    const shares = stems.filter((x) => have.has(x));
    return { url: c.url, title: c.title, shares: shares.length, need, bears: shares.length >= need };
  });
}

/** The pages worth keeping for this turn: only those that bear on the topic — and only if at least one does (never an empty hand). */
export function keepOnTopic(passages, pr, prior = []) {
  const content = contentOf(passages);
  if (!content.length) return passages;
  const v = pageVerdicts(content, topicStemsOf(pr, prior));
  const ok = new Set(v.filter((x) => x.bears).map((x) => x.url));
  const kept = passages.filter((p) => ok.has(String(p.url || p.source || "")));
  return kept.length ? kept : passages;
}

/** An app-authored reply from the baton alone — "where did you get that?" when the last turn left that want UNMET: say what was done and that nothing verified. */
export function batonReply(p) {
  const b = p?.inherited;
  if (!b || b.met !== false || !(p.want === "source" && p.sub === "recall")) return null;
  const did = b.did || {};
  const tried = (b.tried || []).slice(0, 5).join(", ");
  const read = did.read ? `I read ${did.read} page${did.read === 1 ? "" : "s"}${tried ? ` (${tried})` : ""}` : "I did not read a page";
  const off = did.offTopicN ? `, ${did.offTopicN} of them did not bear on it` : "";
  return `Last time ${read}${off}, and could not point to a sentence in them that says it. I have no source to read back, and I would rather say so than guess.`;
}


/** The compact account that rides in the baton: counts, domains and a one-line gist. */
export function compactDid(did, hosts = [], offTopic = []) {
  const parts = [];
  if (did.searches || did.searched.length) parts.push(`searched ${did.searches || did.searched.length} time${(did.searches || did.searched.length) === 1 ? "" : "s"}`);
  if (did.read) parts.push(`read ${did.read} page${did.read === 1 ? "" : "s"} on ${hosts.length} domain${hosts.length === 1 ? "" : "s"}`);
  if (did.unreadable) parts.push(`${did.unreadable} could not be read`);
  if (offTopic.length) parts.push(`${offTopic.length} did not bear on it`);
  if (did.modelCalls) parts.push(`${did.modelCalls} model call${did.modelCalls === 1 ? "" : "s"}`);
  if (did.recalled) parts.push("read back an earlier line");
  return { gist: parts.join(", ") || "nothing outside the conversation", domains: hosts.slice(0, 8), searches: did.searches || did.searched.length, read: did.read, unreadable: did.unreadable, modelCalls: did.modelCalls, offTopicN: offTopic.length };
}

// A request to look inside the system's own workings for the last turn — a drill-down. Closed English cue list (DECLARED, NOT MEASURED).
const INSPECT_RES = [
  /^(?:what|which)\s+(?:did\s+you|have\s+you)\s+(?:search(?:\s+for)?|look(?:\s+up)?|read|check|do|try|find|use|ask)(?:\s+(?:for|up|there|exactly|actually|just now|last time))*\s*[?!.,…]*$/iu,
  /^(?:what|which)\s+(?:pages?|sites?|websites?|sources?|domains?|links?|queries|searches)\s+(?:did\s+you\s+(?:read|use|search|look|check|try|visit|open)|were\s+(?:read|used|searched|checked))\s*[?!.,…]*$/iu,
  /^(?:what|which)\s+(?:did\s+you\s+actually\s+(?:do|read|search|find))\s*[?!.,…]*$/iu,
  /^(?:how|why)\s+did\s+you\s+(?:search|look|read|get there|do that|check)(?:\s+(?:that|there|for that|it))?\s*[?!.,…]*$/iu,
  /^(?:show|tell)\s+me\s+(?:what|how)\s+you\s+(?:did|searched|looked|checked|got there|found it)\s*[?!.,…]*$/iu,
  /^(?:show|tell)\s+me\s+(?:your\s+)?(?:steps|workings|process|search|queries|pages|sites|reasoning)\s*[?!.,…]*$/iu,
  /^what\s+(?:was|were)\s+(?:your\s+)?(?:search|query|queries|steps|process)\s*[?!.,…]*$/iu,
  /^(?:how)\s+did\s+you\s+(?:come\s+up\s+with|work\s+out|arrive\s+at)\s+(?:that|this|it)\s*[?!.,…]*$/iu,
];
export const isInspectAsk = (q) => { const t = String(q ?? "").trim(); return !!t && t.length <= 70 && INSPECT_RES.some((re) => re.test(t)); };

/** The detail of the last turn that acted (the most recent assistant message that stored one). */
export function detailOf(prior = []) {
  const m = [...(Array.isArray(prior) ? prior : [])].reverse().find((x) => x?.role === "assistant" && x.watch && x.watch.detail && (x.watch.detail.urls?.length || x.watch.detail.queries?.length || x.watch.detail.searches));
  return m ? { detail: m.watch.detail, gist: m.watch.baton?.did?.gist || "", domains: m.watch.baton?.did?.domains || [] } : null;
}

/** DRILL DOWN: the full account of the last acting turn, in the app's words, from what the watcher stored. No search, no model. */
export function inspectReply(prior = [], ask = "") {
  const d = detailOf(prior);
  if (!d) return null;
  const x = d.detail;
  const lines = [];
  const q = String(ask || "").toLowerCase();
  const onlyPages = /\b(?:pages?|sites?|websites?|domains?|links?|sources?)\b/.test(q) && !/\b(?:search|quer|steps|do|did you actually)\b/.test(q.replace(/did you read/, ""));
  const onlySearch = /\bsearch(?:ed)?\b|\bqueries\b|\bquery\b/.test(q) && !/\bpages?\b/.test(q);
  if (!onlyPages && x.queries?.length) lines.push(`I searched for: ${x.queries.map((q) => `\u201c${q}\u201d`).join("; ")}.`);
  else if (!onlyPages && x.searches) lines.push(`I searched ${x.searches} time${x.searches === 1 ? "" : "s"}.`);
  if (!onlySearch && x.urls?.length) lines.push(`I read: ${x.urls.map((u) => String(u).replace(/^https?:\/\/(?:www\.)?/, "")).join(", ")}.`);
  if (!onlySearch && !onlyPages && x.unreadable) lines.push(`${x.unreadable} page${x.unreadable === 1 ? "" : "s"} could not be read.`);
  if (!onlySearch && x.offTopic?.length) lines.push(`These did not bear on the question: ${x.offTopic.map((u) => String(u).replace(/^https?:\/\/(?:www\.)?/, "")).join(", ")}.`);
  if (!onlySearch && !onlyPages && x.lanes?.length) lines.push(`Checks run: ${x.lanes.join(", ")}.`);
  return lines.length ? lines.join(" ") : null;
}


/** The messages the MODEL may see: a turn the app answered from the watcher's own record (a drill-down, a read-back) is not a turn the model took part in, so neither the ask
 *  nor the app's reply goes into its history — measured 2026-10-06: left in, "which pages did you read" made the next answer talk about its sources instead of the question. */
export function withoutAppAnswered(messages) {
  const msgs = Array.isArray(messages) ? messages : [];
  const drop = new Set();
  msgs.forEach((m, i) => { if (m?.role === "assistant" && m.watch && m.watch.appAnswered) { drop.add(i); for (let j = i - 1; j >= 0; j--) { if (msgs[j]?.role === "user") { drop.add(j); break; } } } });
  return msgs.filter((_, i) => !drop.has(i));
}


/** "Are you sure?" about an answer the chat looked up: said by the app from the source line that answer stored — never by a model that cannot see how the answer was checked.
 *  Returns { text, provenance } or null (nothing to say it from: the model-grounded thread reply stands). */
export function challengeReply(p, prior = []) {
  if (!p || p.want !== "challenge" || !p.thread || !p.thread.has) return null;
  const r = sourceRecall(prior, "");
  const msgs = Array.isArray(prior) ? prior : [];
  const last = [...msgs].reverse().find((m) => m?.role === "assistant" && !(m.watch && m.watch.appAnswered) && String(m.content || "").trim());
  if (!last) return null;
  if (!r) {
    if (!last.grounding && !last.provenance) return null;   // an answer with no lookup behind it (chit-chat): not this reply's to give
    return { text: "I am not sure. Nothing I read said it in so many words, so treat it as unconfirmed.", provenance: null };
  }
  const hosts = [...new Set(r.provenance.pointers.map((x) => x.host).filter(Boolean))].slice(0, 3).join(", ");
  return r.hasPrimary
    ? { text: `I checked it against ${hosts}, and the sentence is shown below. That is as far as I can check it.`, provenance: r.provenance }
    : { text: `Not fully. The only place I found it was ${hosts}, which I treat as a pointer rather than a source, so treat it as unconfirmed. Ask me to find a primary source and I will search for one.`, provenance: r.provenance };
}
