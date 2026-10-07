// gore.js — Gore, the web searcher. "Gore" after the fisher's spear: it goes
// out and brings back material, one targeted strike at a time.
//
// Gore is ITERATIVE, not a one-shot fetch. Writing an essay, you gather
// sources before writing, but you also go back for more, double-check
// yourself, and re-zero your thesis as you learn. Gore has the same four
// moves, each bounded by a DMD boundary — the shallowest depth at which
// showing fewer results changes nothing about REACH (the same discipline
// dmdCut holds in resolutions.js, applied to WHICH sources are worth
// fetching):
//
//   gather(query)          — search + fetch pages up to the DMD boundary:
//                            once additional results add no new reach over the
//                            ones already held, fetching more is a waste.
//   cueGoDeeper(cue)       — given a specific theme/referent the piece needs,
//                            search narrowly for IT and fetch what addresses
//                            it. One strike, not a scatter.
//   doubleCheck(atoms)     — verify a claim: search the claim's own atoms
//                            (a number, a name) and fetch the pages that speak
//                            to it. Corroboration needs 2+ distinct hosts
//                            (web-hunt.js's minHosts), else it is uncorroborated.
//
// Every crossing is recorded (P13: the web organ is the one sanctioned
// egress). Each fetched page is EOT-retained (full text recoverable) and
// stepped through the constitutional reader — the same holograph as local
// material. This module OWNS NO NETWORK (same discipline as native/organs/
// web.js): it is pure state — boundaries, reach, harvest decisions. The
// fetches themselves live in the caller (proxy-runner), which records them.

// ── the DMD boundary over a harvest ─────────────────────────────────────────
// Results are rows ordered by relevance (the search engine's rank). reach of
// the k-th result = how much NEW material it contributes over the k-1 already
// held (measured by added distinct content-bearing tokens). The boundary is
// the shallowest k at which adding one more result changes reach by nothing
// worth keeping. Without a scoring function, the conservative fallback is a
// declared cap (P9: budgets are named, never tuned).
export function goreBoundary(results = [], { maxResults = 6, minNew = 8, tokenize = null } = {}) {
  const list = Array.isArray(results) ? results.slice(0, maxResults) : [];
  if (!list.length) return { keep: 0, boundary: "empty", basis: "no results to harvest" };
  if (typeof tokenize !== "function") {
    return { keep: list.length, boundary: "declared", basis: `no tokenizer injected — declared cap ${maxResults}` };
  }
  const seen = new Set();
  let kept = 0;
  for (let i = 0; i < list.length; i++) {
    const tokens = tokenize(String(list[i]?.snippet ?? list[i]?.text ?? "")).filter((t) => t.length > 3);
    const fresh = tokens.filter((t) => !seen.has(t));
    seen.add(...tokens);
    if (fresh.length < minNew && i > 0) {
      return { keep: i, boundary: "dmd", basis: `result ${i + 1} adds only ${fresh.length} new tokens (< ${minNew}) — reach stops growing` };
    }
    kept++;
  }
  return { keep: kept, boundary: "all", basis: `all ${kept} results contribute reach` };
}

// ── harvest decisions ───────────────────────────────────────────────────────
// Which fetched pages are worth EOT-retaining: a page that adds no new
// content-bearing token over the harvest already held is a page already
// covered. {keep, dropped, basis}.
export function selectHarvest(pages = [], { tokenize = null, minNew = 12 } = {}) {
  const kept = [];
  const dropped = [];
  const seen = new Set();
  for (const p of pages) {
    const text = String(p?.text ?? "");
    const tokens = typeof tokenize === "function" ? tokenize(text).filter((t) => t.length > 3) : text.toLowerCase().split(/[^a-z]+/).filter((t) => t.length > 3);
    const fresh = tokens.filter((t) => !seen.has(t));
    if (fresh.length < minNew && kept.length) {
      dropped.push({ url: p.url, basis: `adds only ${fresh.length} new tokens over the ${kept.length} page(s) already held` });
      continue;
    }
    seen.add(...tokens);
    kept.push(p);
  }
  return { kept, dropped, basis: `kept ${kept.length}, dropped ${dropped.length} as already-covered` };
}

// ── the four moves ──────────────────────────────────────────────────────────
// Each returns a plan the caller executes (search + fetch + EOT-ize). Pure:
// no network here, just the decision.

export function gatherPlan(query, { boundary = null } = {}) {
  return { move: "gather", query, boundary };
}

export function cueGoDeeperPlan(cue, { query = null } = {}) {
  return { move: "go-deeper", cue, query: query ?? cue };
}

export function doubleCheckPlan(atoms = [], { query = null } = {}) {
  const q = query ?? atoms.join(" ");
  return { move: "double-check", atoms, query: q };
}

// ── corroboration ───────────────────────────────────────────────────────────
// A claim is corroborated when 2+ DISTINCT hosts say it (web-hunt.js's
// minHosts). {ok, hosts, verdict}.
export function corroborate(claims = [], { minHosts = 2 } = {}) {
  const byHost = new Map();
  for (const c of claims) {
    const host = String(c?.host ?? "").replace(/^www\./, "");
    if (!host) continue;
    if (!byHost.has(host)) byHost.set(host, new Set());
    byHost.get(host).add(String(c?.claim ?? "").toLowerCase());
  }
  const hosts = [...byHost.keys()];
  const ok = hosts.length >= minHosts;
  return {
    ok,
    hosts,
    verdict: ok ? "multiple-corroborated" : hosts.length === 1 ? "single-corroborated" : "uncorroborated",
    basis: `${hosts.length} distinct host(s), need ${minHosts}`,
  };
}