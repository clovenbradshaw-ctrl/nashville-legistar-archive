// kondo.js — Kondo, the archon of the tidy prompt: what the mouth is handed,
// once, in an order the machine can reuse.
//
// Handle: Marie Kondo — the tidying consultant whose method keeps only what
// earns its place and THANKS each thing before letting it go. Here the house
// is a prompt: a small local model's attention, and a context window it does
// not get back. Kondo walks every call a turn made and names what is carried
// twice, what was resent where the cache could not reuse it, what arrived
// malformed, and what will not fit the window the model actually runs at.
//
// Kondo never cuts a prompt herself. The mouth is not censored (P186) and a
// prompt belongs to its builder: every finding names the OWNER who must let
// the thing go, and the review lands on the record (huginnDecision's
// discipline) — counts and owners only, never the prompt's own text.
//
// The register lives in solon.js — the one authoritative list; this file
// does not restate it. Here: KONDO (the tidy prompt), under heimdall.
//
// She checks in with the archons whose questions these are, and never
// re-decides them:
//   parmenides — whether two units say the SAME thing. Nominated by identical
//                folded words (appearance may nominate, II.7); decided by
//                Parmenides when his `same` is injected. A repeat he refuses
//                is not counted — it is kept as a typed gap.
//   heimdall   — the context window a model is actually loaded at (`windowOf`,
//                heimdall's /api/ps view), and one model asked for under two
//                windows (every switch is a full reload — his to steer).
//   huginn     — which model answered which job: a turn that alternates
//                models is disclosed with its switch count, for him to route.
//   muninn     — what was recalled into the turn: a recalled line the prompt
//                already carries is named with muninn as its owner.
//
// What she measures — every rule structural, none a hand-set size (P9):
//   restated     one unit carried twice in one call.
//   contained    a unit whose every word, in order, already sits inside a
//                longer unit of the same call (a note inside the sentence it
//                was read from).
//   orphaned     residue of a stripped address — `"…":`, a lone colon glued
//                onto the line before a quote — text no writer wrote.
//   unprefixed   a block resent by the next call to the same model outside
//                the prefix the two calls share, so the KV cache recomputes it.
//   over-window  estimated prompt + declared output above the window the
//                model runs at (the runner keeps the head and the tail; the
//                middle goes silently).
//   window-split one model requested under different num_ctx in one stream.
// Token counts are ESTIMATES (chars / 4) unless `tokensOf` is injected, and
// every count says which.
//
// PURE: no fetch, no DOM, no storage. Organs injected; tested against the
// real firewall, the real select protocol, and the real Parmenides.

export const KINDS = Object.freeze({
  RESTATED: "restated",
  CONTAINED: "contained",
  ORPHANED: "orphaned",
  UNPREFIXED: "unprefixed",
  OVER_WINDOW: "over-window",
  WINDOW_SPLIT: "window-split",
});

/** A unit of one word has no company to repeat — the giver is binding's own
 *  structural minimum (arrivals >= 2), derived there and reused here rather
 *  than chosen. */
export const UNIT_FLOOR = 2;

/**
 * Who builds each block, read off the builders' own opening words. A block no
 * row matches is `unowned` — a disclosed gap, never a guess. `quoted` names
 * the builder of quoted lines that ride inside that block.
 */
export const OWNERS = Object.freeze([
  { re: /^You are (?:talking with someone|writing one part|The Fold)/, owner: "holon.js (system prompt)" },
  { re: /^What the sources say, verbatim:/, owner: "snip-check.js (snipBlock)" },
  { re: /^My notes so far|^I made no notes/, owner: "fact-block.js (buildFactBlock)", quoted: "holon.js (spanBlock)" },
  { re: /^What the sources state about this:|^Looked for and not found so far:|^The record's own position/, owner: "dialogue.js (expectationFacts)" },
  { re: /^From earlier reading|^Still reading/, owner: "muninn (holon.js ledgerBlock)" },
  { re: /^What these sources say about it:|These sources do not use|is not someone or something|are not people or things/, owner: "correction.js (premiseFacts)" },
  { re: /^Established here already/, owner: "learned.js (learnedFacts)" },
  { re: /^What this material is, by its own title page/, owner: "source.js (declaredIdentity)" },
  { re: /^What they seem to be asking for:/, owner: "about-call.js (interpretAsk)" },
  { re: /^The conversation so far:/, owner: "fold.js (discourse line)" },
  { re: /^Sentences:|^Claim: "/, owner: "testimony.js (buildSelectMessages)" },
  { re: /^Passage:|^Sentence: /, owner: "testimony.js (buildWitnessMessages)" },
  // A block that is nothing but a quoted sentence IS a span the notes rest on
  // (holon.js spanBlock): it carries no header of its own, so it is known by
  // shape. Last, so a real header always wins.
  { re: /^\s*"/, owner: "holon.js (spanBlock)" },
]);

const LIST_MARK = /^\s*(?:[-•*]|\d+[.)])\s+/;
const TRAILING_ASIDE = /\s*\([^()]*\)\s*$/;
const QUOTED_LINE = /^\s*".*"\s*:?\s*$/;
const clip = (s, n = 120) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** The words of a text: marks stripped, lower-cased, split on anything not a
 *  letter or digit in any script (P62) — the fold both sides of a comparison share. */
export function wordsOf(text) {
  return String(text ?? "").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function rowOf(line, owners) {
  for (const row of owners) if (row.re.test(line)) return row;
  return null;
}

/**
 * Every line of every message as a unit — where it sits (message, block,
 * offset), the header of its block, its owner, and its folded words (a list
 * marker and one trailing parenthetical aside are not part of what it says).
 */
export function unitsOf(messages, { owners = OWNERS } = {}) {
  const units = [];
  (messages ?? []).forEach((m, msg) => {
    const role = m?.role ?? null;
    const lines = String(m?.content ?? "").split("\n");
    let offset = 0, block = 0, inBlock = 0, header = null, row = null;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const start = offset;
      offset += line.length + 1;
      if (!line.trim()) { if (inBlock) { block++; inBlock = 0; header = null; row = null; } continue; }
      if (inBlock === 0) {
        const next = lines[li + 1];
        const isHeader = /:\s*$/.test(line) && next != null && next.trim() !== "" && !LIST_MARK.test(line) && !QUOTED_LINE.test(line);
        row = rowOf(line.trim(), owners);
        header = isHeader ? line.trim() : null;
        inBlock++;
        if (isHeader) continue;
      } else inBlock++;
      const quoted = QUOTED_LINE.test(line);
      const owner = (quoted && row?.quoted) || row?.owner || (role === "system" ? "unowned" : `conversation:${role}`);
      const bare = line.replace(LIST_MARK, "").replace(TRAILING_ASIDE, "").trim();
      units.push({ msg, role, block, line: li, start, text: line, bare, header, owner, words: wordsOf(bare) });
    }
  });
  return units;
}

/** Blocks (runs of non-blank lines) with their offset inside the message, owner and words. */
export function blocksOf(messages, { owners = OWNERS } = {}) {
  const blocks = [];
  (messages ?? []).forEach((m, msg) => {
    const content = String(m?.content ?? "");
    const re = /[^\n]+(?:\n[^\n]*\S[^\n]*)*/g;
    let hit;
    while ((hit = re.exec(content))) {
      const text = hit[0];
      const first = text.split("\n")[0].trim();
      blocks.push({ msg, start: hit.index, text, owner: rowOf(first, owners)?.owner ?? (m?.role === "system" ? "unowned" : `conversation:${m?.role ?? "?"}`), words: wordsOf(text) });
    }
  });
  return blocks;
}

function renderOf(messages) {
  const base = [];
  let text = "";
  for (const m of messages ?? []) {
    text += `${m?.role ?? ""}\n`;
    base.push(text.length);
    text += `${String(m?.content ?? "")}\n`;
  }
  return { text, base };
}

function commonPrefix(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

export function makeKondo({ same = null, windowOf = null, tokensOf = null, owners = OWNERS } = {}) {
  const count = (text) => (typeof tokensOf === "function"
    ? { n: tokensOf(text), estimated: false }
    : { n: Math.ceil(String(text ?? "").length / 4), estimated: true });

  /** One call: what it carries twice, what arrived malformed, whether it fits. */
  function reviewCall(call) {
    const messages = call?.messages ?? [];
    const units = unitsOf(messages, { owners });
    const findings = [];
    const gaps = [];
    const counted = new Set();

    // RESTATED — nominated by identical folded words; decided by Parmenides.
    const byKey = new Map();
    for (const u of units) {
      if (u.words.length < UNIT_FLOOR) continue;
      const key = u.words.join(" ");
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(u);
    }
    for (const group of byKey.values()) {
      if (group.length < 2) continue;
      const [kept, ...rest] = group;
      for (const u of rest) {
        let via = "folded-words";
        if (typeof same === "function") {
          let v;
          try { v = same(kept.bare, u.bare); } catch (e) { v = { verdict: "refused", detail: String(e?.message ?? e) }; }
          if (v?.verdict !== "same") { gaps.push({ type: "identity_not_same", by: "parmenides", verdict: v?.verdict ?? "refused", detail: v?.detail ?? null, text: clip(u.bare) }); continue; }
          via = `parmenides:${v.via ?? "same"}`;
        }
        counted.add(u);
        findings.push({ kind: KINDS.RESTATED, owner: u.owner, alsoBy: kept.owner, chars: u.text.length, via, text: clip(u.bare) });
      }
    }

    // CONTAINED — every word of a unit, in order, already inside a longer one.
    const padded = units.map((u) => ` ${u.words.join(" ")} `);
    for (let i = 0; i < units.length; i++) {
      const a = units[i];
      if (counted.has(a) || a.words.length < UNIT_FLOOR) continue;
      for (let j = 0; j < units.length; j++) {
        if (i === j || units[j].words.length <= a.words.length) continue;
        if (!padded[j].includes(padded[i])) continue;
        counted.add(a);
        findings.push({ kind: KINDS.CONTAINED, owner: a.owner, carriedBy: units[j].owner, chars: a.text.length, text: clip(a.bare) });
        break;
      }
    }

    // ORPHANED — address residue: a quoted line closed by a colon, a colon
    // glued onto the line before a quote, or a line of nothing but punctuation.
    for (let k = 0; k < units.length; k++) {
      const u = units[k];
      const t = u.text.trim();
      const next = units[k + 1];
      const lone = /^[\p{P}\s]+$/u.test(t);
      const quotedColon = /^".*":$/.test(t);
      const gluedColon = !quotedColon && !lone && /:$/.test(t) && next && next.msg === u.msg && next.line === u.line + 1 && /^"/.test(next.text.trim());
      if (lone || quotedColon || gluedColon) findings.push({ kind: KINDS.ORPHANED, owner: u.owner, chars: lone ? t.length : 1, text: clip(t, 60) });
    }

    // OVER-WINDOW — against heimdall's loaded window first, the request second.
    const text = messages.map((m) => String(m?.content ?? "")).join("\n");
    const tokens = count(text);
    const out = Number(call?.options?.num_predict ?? call?.maxTokens ?? 0) || 0;
    let window = null;
    let windowFrom = null;
    if (typeof windowOf === "function" && call?.model) {
      try { const w = windowOf(call.model); if (Number.isFinite(w)) { window = w; windowFrom = "heimdall"; } } catch { /* unknown, never convicting */ }
    }
    if (window == null && Number.isFinite(call?.options?.num_ctx)) { window = call.options.num_ctx; windowFrom = "requested"; }
    if (window == null) gaps.push({ type: "no_window", detail: "neither heimdall's loaded window nor a requested num_ctx — over-window not measured" });
    else if (tokens.n + out > window) findings.push({ kind: KINDS.OVER_WINDOW, owner: "heimdall (window)", tokens: tokens.n, out, window, windowFrom, estimated: tokens.estimated, chars: 0 });

    const wasteChars = findings.reduce((n, f) => n + (f.chars ?? 0), 0);
    return { chars: text.length, tokens: tokens.n, estimated: tokens.estimated, window, windowFrom, units: units.length, findings, gaps, waste: { chars: wasteChars, tokens: Math.ceil(wasteChars / 4) } };
  }

  /** A turn: every call, plus what only shows between calls. */
  function reviewTurn(calls) {
    const list = Array.isArray(calls) ? calls : [];
    const reviews = list.map((c, i) => ({ call: i + 1, kind: c?.kind ?? null, model: c?.model ?? null, ...reviewCall(c) }));
    const cross = [];

    // UNPREFIXED — a block the previous call to the same model also carried,
    // placed after the point where the two prompts stop being identical.
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1];
      const b = list[i];
      if (a?.model && b?.model && a.model !== b.model) continue;
      const ra = renderOf(a?.messages);
      const rb = renderOf(b?.messages);
      const shared = commonPrefix(ra.text, rb.text);
      const before = new Set(blocksOf(a?.messages, { owners }).filter((blk) => blk.words.length >= UNIT_FLOOR).map((blk) => blk.words.join(" ")));
      let chars = 0;
      const blockOwners = new Set();
      for (const blk of blocksOf(b?.messages, { owners })) {
        if (blk.words.length < UNIT_FLOOR || !before.has(blk.words.join(" "))) continue;
        if (rb.base[blk.msg] + blk.start >= shared) { chars += blk.text.length; blockOwners.add(blk.owner); }
      }
      if (chars) cross.push({ kind: KINDS.UNPREFIXED, call: i + 1, after: i, owner: [...blockOwners].join(", "), chars, sharedPrefixChars: shared });
    }

    // WINDOW-SPLIT — one model, more than one requested window.
    const windows = new Map();
    for (const c of list) {
      if (!c?.model) continue;
      const w = Number.isFinite(c?.options?.num_ctx) ? c.options.num_ctx : "default";
      if (!windows.has(c.model)) windows.set(c.model, new Set());
      windows.get(c.model).add(w);
    }
    for (const [model, ws] of windows) if (ws.size > 1) cross.push({ kind: KINDS.WINDOW_SPLIT, owner: "heimdall", model, windows: [...ws], chars: 0 });

    // MODELS — disclosed for huginn, not counted as waste.
    const sequence = list.map((c) => c?.model ?? null);
    let switches = 0;
    for (let i = 1; i < sequence.length; i++) if (sequence[i] && sequence[i - 1] && sequence[i] !== sequence[i - 1]) switches++;

    const tokens = reviews.reduce((n, r) => n + r.tokens, 0);
    const wasteChars = reviews.reduce((n, r) => n + r.waste.chars, 0);
    const cacheChars = cross.reduce((n, f) => n + (f.chars ?? 0), 0);
    return {
      calls: reviews,
      cross,
      models: { switches, sequence },
      totals: { tokens, estimated: reviews.every((r) => r.estimated), carriedTwice: { chars: wasteChars, tokens: Math.ceil(wasteChars / 4) }, recomputed: { chars: cacheChars, tokens: Math.ceil(cacheChars / 4) } },
    };
  }

  return { reviewCall, reviewTurn, KINDS };
}

/**
 * The record line for a review — kinds, owners, counts; never the prompt's
 * text. Pure; the caller stamps the time and lands it (huginnDecision's shape).
 */
export function kondoDecision({ act = "review", turn = null, where = null, review = null } = {}) {
  const entry = { act: `kondo-${act}` };
  if (turn != null) entry.turn = turn;
  if (where) entry.where = where;
  if (!review) return entry;
  entry.calls = review.calls.length;
  entry.tokens = review.totals.tokens;
  entry.estimated = review.totals.estimated;
  entry.carriedTwiceTokens = review.totals.carriedTwice.tokens;
  entry.recomputedTokens = review.totals.recomputed.tokens;
  const tally = new Map();
  for (const f of [...review.calls.flatMap((c) => c.findings), ...review.cross]) {
    const key = `${f.kind}|${f.owner ?? "unowned"}`;
    const t = tally.get(key) ?? { kind: f.kind, owner: f.owner ?? "unowned", count: 0, chars: 0 };
    t.count++;
    t.chars += f.chars ?? 0;
    tally.set(key, t);
  }
  entry.findings = [...tally.values()];
  const gaps = [...new Set(review.calls.flatMap((c) => c.gaps.map((g) => g.type)))];
  if (gaps.length) entry.gaps = gaps;
  if (review.models?.switches) entry.modelSwitches = review.models.switches;
  return entry;
}

/** One plain line for a person reading a log — never handed to a model. */
export function kondoLine(review) {
  if (!review) return "";
  const t = review.totals;
  const est = t.estimated ? "≈" : "";
  const parts = [`${review.calls.length} call${review.calls.length === 1 ? "" : "s"}, ${est}${t.tokens} tokens`];
  const byKind = (kind) => [...review.calls.flatMap((c) => c.findings), ...review.cross].filter((f) => f.kind === kind);
  const owners = (fs) => [...new Set(fs.map((f) => f.owner))].join("; ");
  const twice = [...byKind(KINDS.RESTATED), ...byKind(KINDS.CONTAINED)];
  if (twice.length) parts.push(`${twice.length} line${twice.length === 1 ? "" : "s"} carried twice (${est}${t.carriedTwice.tokens} tokens — ${owners(twice)})`);
  const un = byKind(KINDS.UNPREFIXED);
  if (un.length) parts.push(`${un.length} resend${un.length === 1 ? "" : "s"} outside the shared prefix (${est}${t.recomputed.tokens} tokens recomputed — ${owners(un)})`);
  const orph = byKind(KINDS.ORPHANED);
  if (orph.length) parts.push(`${orph.length} orphaned address residue${orph.length === 1 ? "" : "s"} (${owners(orph)})`);
  const over = byKind(KINDS.OVER_WINDOW);
  if (over.length) parts.push(`${over.length} over the window`);
  const split = byKind(KINDS.WINDOW_SPLIT);
  if (split.length) parts.push(`window split on ${split.map((f) => `${f.model} (${f.windows.join(" vs ")})`).join(", ")}`);
  if (review.models?.switches) parts.push(`${review.models.switches} model switch${review.models.switches === 1 ? "" : "es"}`);
  return `Kondo: ${parts.join("; ")}.`;
}

// ── THE TIDY: the same duplication, cut by the BUILDER before it is sent ─────
// Kondo reports and never cuts a prompt herself; this is the cut a BUILDER can
// make from her findings, and it is deliberately narrow. The draft prompt
// carries TWO verbatim carriers of the same sentences (the snips, and the spans
// the notes rest on) and TWO structured carriers of the same claims (this
// turn's fresh notes, and the expectation's restatement of them, plus the
// ledger's older ones). Keeping ONE of each drops the repetition without
// removing a LAYER — the reader still gets the source's own sentences AND the
// claims read out of them, which is the standing direction ("never give it the
// raw text alone, we always feed it the hyperlexicon's surf and fold with the
// minimal raw spans").
//
// Measured on a real turn before this existed: 486 of 1,285 tokens of one draft
// prompt were lines that prompt already carried.
//
// THE PAIRS ARE DECLARED, NEVER INFERRED. A block is pruned only against the
// blocks named here, and only inside the section named here — so a void, a
// premise, a title page, a learned correction or the discourse line is never
// touched, and a claim is never dropped because something UNRELATED happens to
// contain its words. A section that loses every line loses its header with it.
// APPLIED IN ORDER, and the keys are recomputed after each pair — a rule must
// prune against what SURVIVES, never against a line an earlier rule already
// dropped, or a note could be cut for restating a span that is itself gone and
// the claim would leave the prompt altogether.
export const TIDY_PAIRS = Object.freeze([
  // the same bytes twice: a span under the notes, already quoted in the snips
  { from: /spanBlock/, against: [/snipBlock/], section: null, entry: true },
  // the same claim twice: the expectation restating a note, or a sentence
  { from: /expectationFacts/, against: [/buildFactBlock/, /snipBlock/, /spanBlock/], section: /^What the sources state about this:/, entry: false },
  // the same claim again, older: a ledger note this turn already read
  { from: /ledgerBlock/, against: [/buildFactBlock/, /snipBlock/, /spanBlock/], section: /^From earlier reading/, entry: false },
  // LAST, and only against what still stands: a note whose whole claim already
  // sits, word for word in order, inside a sentence the prompt still carries.
  // The note was the reading of THAT sentence; with the sentence present the
  // note is the same thing said twice, and a note the sentences do NOT carry
  // (a claim read from a passage that did not survive retrieval, a derived one)
  // stays — which is what makes this a cut and not a deletion of the layer.
]);

// THE NOTES CUT, MEASURED AND NOT IN THE DEFAULT (2026-09-15). A note whose
// claim the snips already carry word for word LOOKS like pure duplication, and
// cutting it is the largest remaining saving — and it makes the mouth worse
// exactly where this instrument exists to be careful. Measured live, gemma2:2b,
// one question whose material does NOT contain the answer, ten trials an arm,
// hand-read rather than regex-scored: untidied 0 fabrications, claims-only 0,
// notes-cut 3-4 ("John C.", "his vice presidential ticket was John C."). The
// controls (two questions the material DOES answer) were 5/5 in every arm, so
// the cost is not recall, it is that the notes layer keeps a near-miss sentence
// from being read as the answer. Reachable as a declared arm (KONDO_TIDY=full)
// so the finding can be re-measured, never as the default.
export const TIDY_NOTES_PAIR = Object.freeze(
  // AGAINST THE SNIPS ONLY, never the spans — and that is a constraint from
  // another law, not a taste. The compression ladder (P179) says a higher
  // resolution hands LESS: level 0 hands the passages/spans AND the snips,
  // level 2 only the snips. Pruning notes against the spans too prunes the
  // LOWER rung harder than the upper one and inverts the ladder — measured,
  // 504 material chars at level 0 against 631 at level 2 on
  // dialogue-turn.test.mjs's own fixture. Pruned against the snips alone,
  // level 0 stays a superset of level 2 by construction and the ladder holds.
  { from: /buildFactBlock/, against: [/snipBlock/], section: /^My notes so far|^I made no notes/, entry: false },
);

/** A line's identity for the tidy: its words, without a list marker, a trailing
 *  aside (the standing phrase) or the quotes a span is printed in. */
const tidyKey = (line) => wordsOf(String(line ?? "").replace(LIST_MARK, "").replace(TRAILING_ASIDE, "").replace(/^\s*"|"\s*$/g, "")).join(" ");
const carries = (haystack, key) => haystack.has(key) || [...haystack].some((k) => ` ${k} `.includes(` ${key} `));

/**
 * tidyMaterial(parts) → { parts, dropped } — `parts` is the array a builder is
 * about to join into one material block, in order. Returns the same array with
 * the declared duplicates removed, and every dropped line named with its owner
 * so the cut is disclosed rather than silent.
 */
export function tidyMaterial(parts, { owners = OWNERS, pairs = TIDY_PAIRS } = {}) {
  let list = (parts ?? []).map((p) => (p == null ? "" : String(p)));
  const ownerOf = list.map((p) => rowOf(p.split("\n")[0].trim(), owners)?.owner ?? "unowned");
  const dropped = [];
  const keysNow = () => {
    const keysBy = new Map();
    list.forEach((p, i) => {
      const set = keysBy.get(ownerOf[i]) ?? new Set();
      for (const line of p.split("\n")) {
        const k = tidyKey(line);
        if (k && k.split(" ").length >= UNIT_FLOOR) set.add(k);
      }
      keysBy.set(ownerOf[i], set);
    });
    return keysBy;
  };
  for (const rule of pairs) list = applyPair(list, ownerOf, rule, keysNow(), dropped);
  return { parts: list, dropped };
}

function applyPair(list, ownerOf, rule, keysBy, dropped) {
  return list.map((p, i) => {
    const owner = ownerOf[i];
    if (!rule.from.test(owner) || !p.trim()) return p;
    const against = new Set();
    for (const [o, keys] of keysBy) if (rule.against.some((re) => re.test(o))) for (const k of keys) against.add(k);
    if (!against.size) return p;

    // A span block is blank-line separated ENTRIES (a quoted sentence may run
    // to several lines); every other block is a list of lines under a header.
    if (rule.entry) {
      const kept = p.split(/\n{2,}/).filter((entry) => {
        const k = tidyKey(entry.replace(/\n/g, " "));
        if (k && k.split(" ").length >= UNIT_FLOOR && carries(against, k)) { dropped.push({ owner, text: entry.slice(0, 120) }); return false; }
        return true;
      });
      return kept.join("\n\n");
    }

    const lines = p.split("\n");
    const out2 = [];
    let header = null;
    let sectionKept = 0;
    const closeSection = () => {
      if (header && sectionKept === 0) { const at = out2.lastIndexOf(header); if (at >= 0) out2.splice(at, 1); }
      header = null;
      sectionKept = 0;
    };
    for (const line of lines) {
      const isHeader = /:\s*$/.test(line) && !LIST_MARK.test(line);
      if (isHeader) { closeSection(); header = line; out2.push(line); continue; }
      const inSection = !rule.section || (header && rule.section.test(header.trim()));
      const k = tidyKey(line);
      if (inSection && k && k.split(" ").length >= UNIT_FLOOR && carries(against, k)) { dropped.push({ owner, text: line.slice(0, 120) }); continue; }
      out2.push(line);
      if (line.trim()) sectionKept++;
    }
    closeSection();
    return out2.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  });
}
