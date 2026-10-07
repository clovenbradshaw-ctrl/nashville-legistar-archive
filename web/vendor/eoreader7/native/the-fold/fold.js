// fold.js — The Fold, standing on its own.
//
// Ported from eochatX's app/client/eo-discourse.ts (which is itself a port of
// eochat/server/conversation-summary.js). Same algorithm, no framework, no
// build step, no imports: a plain ES module a browser loads directly.
//
// The claim this module exists to make true: a conversation's context window
// does not grow with the conversation. Each turn is folded to what it
// contributed, a running summary tracks how the discourse evolved, and only
// a bounded PROJECTION of the fold/record store is ever resent. The raw
// transcript beyond a small recency window is never sent again.
//
// This module is pure. No IO, no model calls. The one model call the fold
// spends (the summary refresh) is executed by the caller and handed back in as
// a raw string, which is what keeps this testable in node and safe in a
// browser.
//
// STORE VS PROJECTION (spec: wiring-the-measured-memory-v2, increment A).
// `summary.folds` and `summary.records` are the STORE — append-only, never
// truncated here. RECENCY_WINDOW already reads "the reach of the present is
// never derived from material length" (P1); the same rule binds the store
// itself, which had one bug this file is the fix for: `addWarrantRecord` and
// `advanceSummaryFold`/`updateSummaryWithFold` used to slice the STORE at
// RECORDS_IN_PROMPT/MAX_FOLDS_IN_PROMPT, which is retroactive forgetting —
// record #9 landing destroyed record #1 permanently, for the one tier
// (System 2, the addressed record) P1 says does not decay. What is bounded
// now is only the PROJECTION: `buildRecordSystemMessage`/
// `buildSummaryUpdatePrompt` slice a WINDOW out of the store at render time,
// and that window is a parameter (defaulting to the declared constant below)
// rather than a fact baked into the store. `deriveRecordWindow` measures that
// window from the store's own behavior (dmdWindow, S5) when an engine organ
// is injected; a caller with none gets the declared default, stated as
// exactly that — a declaration, never mistaken for a measurement (P4).

// ── Two folds, not one fold at two resolutions ───────────────────────────────
//
// System 1 is a ~100-character paraphrase of what a turn contributed, rolled
// into a running summary. It is associative and lossy on purpose: it is what a
// person actually retains from a conversation, the gist and not the
// transcript.
//
// Its limit is not that it is short. It is that a paraphrase has no address.
// "the report put the figure at 12%" and "the report put the figure at 21%"
// fold to the same line, and nothing in the prompt can tell them apart or get
// back to the source. Harmless for following a conversation, disqualifying as
// evidence.
//
// System 2 is the answer to that, and it is a different KIND of record rather
// than a longer one: it keeps the address. What the turn established, which
// channels carried it, the byte ranges the check actually ran against, what
// failed that check, what was left open. A System 2 fold can be re-opened; a
// System 1 fold can only be recalled.

export const SUMMARY_MAX_CHARS = 200;
export const ENTITIES_MAX = 8;
export const CONTEXT_MAX_CHARS = 150;
export const FLOW_MAX_CHARS = 200;
export const FOLD_MAX_CHARS = 100;
// The DECLARED PROJECTION window for folds — never the store's own size.
// Disclosed scope: unlike RECORDS_IN_PROMPT below, this pass does not ship a
// measured supersession for it — a fold string (System 1's own paraphrase)
// has no structural identity this zero-import module can extract the way a
// record's own `refs` gives deriveRecordWindow one, and inventing an NLP
// extractor here would be exactly the thing this file's own purity refuses.
// The declared constant stands; a caller with a real tokenizer can measure
// its own window over `summary.folds` and pass it to buildSummaryUpdatePrompt.
export const MAX_FOLDS_IN_PROMPT = 12;

// The DECLARED PROJECTION window for records — same status as
// MAX_FOLDS_IN_PROMPT above. The record STORE itself (summary.records) is
// never bounded by this constant; only buildRecordSystemMessage's slice is.
export const RECORDS_IN_PROMPT = 8;
export const RECORD_REFS_MAX = 6;
export const RECORD_OPEN_MAX = 4;

/** Raw turns still sent verbatim. Everything older is only ever the fold. */
export const RECENCY_WINDOW = 4;

/** The record store's live window — the tail a caller may treat as
 * currently salient (what a prompt would show, what a consolidation check
 * treats as "live"). One implementation, shared by buildRecordSystemMessage
 * and any caller (app.js's witness gate) that needs the identical bound
 * without re-deriving the slice. */
export function projectRecords(summary, { window = RECORDS_IN_PROMPT } = {}) {
  return (summary?.records ?? []).slice(-window);
}

/** The fold store's live window — same reasoning as projectRecords above,
 * shared by buildSummaryUpdatePrompt. */
export function projectFolds(summary, { window = MAX_FOLDS_IN_PROMPT } = {}) {
  return (summary?.folds ?? []).slice(-window);
}

export function truncate(text, max) {
  const s = String(text ?? "").trim();
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

export function emptySummary() {
  return {
    topic: null,
    entities: [],
    context: null,
    language: null,
    turnCount: 0,
    flow: null,
    folds: [],
    records: [],
  };
}

// ── System 1: the running summary ────────────────────────────────────────────

/**
 * The fold line for a finished turn, built mechanically from the turn's own
 * text. Deliberately NOT a model call: a second background call per turn is
 * exactly the fragility this design is trying to avoid, and the summary
 * refresh downstream is what actually turns these lines into discourse.
 */
export function mechanicalFoldLine(question, answer) {
  return truncate(`Q: ${question} A: ${answer}`, FOLD_MAX_CHARS);
}

/**
 * `folds` is the STORE (every fold since the conversation began, unbounded).
 * `window` is the PROJECTION bound applied here, at render time — never
 * upstream, so nothing calling this with the whole store needs to know its
 * own size. Defaults to the declared MAX_FOLDS_IN_PROMPT (see its own
 * comment on why this pass leaves fold-window measurement unbuilt); a
 * caller with its own measured window may pass one in. Positional turn
 * labels below are relative to the WINDOW, not the store — unchanged
 * behavior from before this split, since the window was previously imposed
 * on the store itself and is now imposed here instead.
 */
export function buildSummaryUpdatePrompt(prev, folds, { window = MAX_FOLDS_IN_PROMPT } = {}) {
  const prevBlock = prev.topic
    ? `PREV: ${prev.topic} | ${prev.flow || ""} | ${(prev.entities || []).join(",")} | ${prev.context || ""}`
    : "First turn.";

  const recentFolds = (folds || []).slice(-window);
  const foldLines = recentFolds.map((f, i) => `Turn ${i + 1}: ${f}`).join("\n");

  return `${prevBlock}

TURNS:
${foldLines}

Update the summary to include the latest turn. Track DISCOURSE FLOW — how the conversation evolved turn by turn, not message details. Every field stays short. A field you have nothing new for is left EMPTY, and the previous value carries; never fill a field for the sake of filling it. The fields, and what each is for:
- topic: one short phrase naming what the conversation is about now
- flow: one short sentence on how the thread evolved across all turns
- entities: only the people, organizations, or works actually named so far (max 8) — never turn labels, never prose
- context: what the reader must still know from earlier turns to follow along
- language: ISO 639-1 code of the dominant language`;
}

export const FOLD_SYSTEM_PROMPT =
  "You track a running discourse summary for an ongoing conversation. Follow the user message's instructions exactly. Leave a field empty when nothing new belongs in it.";

/**
 * The refresh reply's shape, as grammar for a runtime that can enforce one
 * (Ollama structured outputs). The prompt above stays a request;
 * normalizeSummary still treats whatever arrives as untrusted — the schema
 * only makes the common case arrive well-formed instead of nearly-so.
 * turnCount is deliberately absent: it is counted mechanically and nothing
 * the model returns for it is read.
 */
export const FOLD_SCHEMA = {
  type: "object",
  properties: {
    topic: { type: "string" },
    flow: { type: "string" },
    entities: { type: "array", items: { type: "string" } },
    context: { type: "string" },
    language: { type: "string" },
  },
  required: ["topic", "flow", "entities", "context", "language"],
};

function parseSummaryResponse(response) {
  try {
    const jsonMatch = String(response).match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function normalizeSummary(parsed, prev, folds) {
  if (!parsed) return { ...prev, folds, turnCount: prev.turnCount + 1 };
  return {
    // The System 2 records are never rewritten by the summary-refresh model
    // call. A model that could edit the record could edit the evidence.
    records: prev.records ?? [],
    // An EMPTY field is the model's abstain (the prompt says so): the
    // previous value carries. A required schema field cannot be omitted,
    // so "" and [] are the only honest way to say "nothing new here" — and
    // treating them as new values would blank the summary every time the
    // model declined to invent one.
    topic: truncate(
      typeof parsed.topic === "string" && parsed.topic.trim() ? parsed.topic : prev.topic,
      SUMMARY_MAX_CHARS,
    ),
    flow: truncate(
      typeof parsed.flow === "string" && parsed.flow.trim() ? parsed.flow : prev.flow,
      FLOW_MAX_CHARS,
    ),
    entities: Array.isArray(parsed.entities) && parsed.entities.length
      ? parsed.entities.slice(0, ENTITIES_MAX).map((e) => String(e).slice(0, 40))
      : prev.entities,
    context: truncate(
      typeof parsed.context === "string" && parsed.context.trim() ? parsed.context : prev.context,
      CONTEXT_MAX_CHARS,
    ),
    language:
      typeof parsed.language === "string" && parsed.language.trim() ? parsed.language : prev.language,
    // Counted here, never read back from the response. The prompt states the
    // number and a model will still return a different one — observed on the
    // very first fold of a conversation, which came back as turn two. A count
    // is mechanical; nothing is gained by letting the summary call revise it,
    // and what is lost is that turnCount and the fold list stop agreeing.
    turnCount: prev.turnCount + 1,
    folds,
  };
}

/**
 * Roll a new turn fold into the running summary. The fold STORE
 * (`summary.folds`) is appended to, never truncated — a bounded window is a
 * presentation concern (buildSummaryUpdatePrompt's own `window` parameter),
 * not a fact this store gets to bake in. See the file header.
 */
export function updateSummaryWithFold(prev, turnFold, rawResponse) {
  const prevSummary = prev || emptySummary();
  const folds = [...(prevSummary.folds || []), turnFold];
  const parsed = rawResponse ? parseSummaryResponse(rawResponse) : null;
  return normalizeSummary(parsed, prevSummary, folds);
}

/** Carry the summary forward unchanged, appending only the fold. Store, not
 * projection — see updateSummaryWithFold's header note. */
export function advanceSummaryFold(prev, turnFold) {
  const prevSummary = prev || emptySummary();
  const folds = [...(prevSummary.folds || []), turnFold];
  return {
    ...prevSummary,
    folds,
    turnCount: prevSummary.turnCount + 1,
  };
}

// ── Consolidation, witnessed ──────────────────────────────────────────────────
//
// The summary refresh (S1) is a consolidation step: a model rewrites
// topic/flow/entities/context wholesale, each refresh conditioned on the
// last — the exact chained shape drift compounds under while every single
// step looks clean (this project's own NELL lesson). Records are already
// protected from it (normalizeSummary's own comment: "a model that could
// edit the record could edit the evidence"); the GIST has no such wall.
// `extractSummaryFindings` is the mechanical check that gives it one, shaped
// to compose with `witness.js::witnessRegressed` exactly as a code witness
// does — a caller (app.js) that already has both imported calls
// `witnessRegressed({ok: true, findings: []}, extractSummaryFindings(...))`
// before accepting a refreshed summary, refusing when it regressed. The
// `{ok:true, findings:[]}` left side is trivially clean BY CONSTRUCTION —
// there is nothing to regress against before the transition is examined —
// and witnessRegressed is still the right verb for it: it names the check
// with the same vocabulary this repo already draws on for every other
// "did this landing hold together" question, and a future pass that wants
// to carry forward an already-disclosed absence (rather than re-flagging it
// every single turn) only has to supply a non-trivial left side.
//
// Two finding kinds, matching the measured failure mode exactly (a name a
// live record still cites silently vanishing from `entities`; a name with
// no record or fold behind it silently appearing):
//
//   lost_live_entity     — named in `prevEntities`, still cited by a live
//                           record's own text, absent from `nextEntities`.
//   unsupported_addition — new in `nextEntities` (not already in
//                           `prevEntities`), and no live record or fold
//                           names it.
//
// The support check is literal, case-insensitive containment against a
// record's `gist` or a fold's own text — the same posture P31's `company`
// containment already holds this repo to: a claim of semantic
// understanding is not made here, only "the words are there." Whatever a
// summary already carried forward stays uncontested (an already-unsupported
// name is not flagged again as a NEW addition), matching witnessRegressed's
// own subset rule.
function textSupports(haystack, name) {
  const n = String(name ?? "").trim().toLowerCase();
  if (!n) return false;
  return String(haystack ?? "").toLowerCase().includes(n);
}

export function extractSummaryFindings(prevEntities, nextEntities, { records, folds } = {}) {
  const prev = prevEntities || [];
  const next = nextEntities || [];
  const liveRecords = records || [];
  const liveFolds = folds || [];
  const supported = (name) =>
    liveRecords.some((r) => textSupports(r?.gist, name)) ||
    liveFolds.some((f) => textSupports(f, name));

  const findings = [];
  for (const name of prev) {
    if (supported(name) && !next.includes(name)) {
      findings.push({
        kind: "lost_live_entity",
        id: name,
        detail: `"${name}" is still cited by a live record or fold, but the refreshed summary no longer names it`,
      });
    }
  }
  for (const name of next) {
    if (!prev.includes(name) && !supported(name)) {
      findings.push({
        kind: "unsupported_addition",
        id: name,
        detail: `"${name}" is new in the refreshed summary, and no live record or fold names it`,
      });
    }
  }
  return { ok: findings.length === 0, findings };
}

// ── System 2: the addressed record ───────────────────────────────────────────

/**
 * Build the System 2 fold for a finished turn. Purely mechanical — every field
 * is read off work the turn already did, so a turn's record cannot disagree
 * with its own grounding check.
 */
export function buildWarrantRecord(input) {
  const clean = (list, max, chars) =>
    [...new Set((list || []).filter(Boolean).map((s) => truncate(s, chars)))]
      .slice(0, max);
  return {
    turn: input.turn,
    // The plane the check ran on. "world" is a record checked against the
    // material; "self" is one checked against the instrument's own act
    // ledger (reflex.js). The two are different kinds of authority and are
    // typed here, at the record's birth, so nothing downstream has to
    // guess from the shape of a ref.
    plane: input.plane === "self" ? "self" : "world",
    gist: truncate(input.gist, FOLD_MAX_CHARS),
    channels: [...new Set(input.channels || [])],
    refs: clean(input.refs, RECORD_REFS_MAX, 120),
    unsupported: clean(input.unsupported, RECORD_REFS_MAX, 80),
    open: clean(input.open, RECORD_OPEN_MAX, 140),
  };
}

/**
 * Append a warrant record to the STORE. Never truncated here — the record
 * tier is the one P1 says does not decay, and the store used to slice at
 * RECORDS_IN_PROMPT, which meant record #9 landing destroyed record #1
 * permanently. A record that falls out of the projection window
 * (buildRecordSystemMessage) is not forgotten; it stays addressed and
 * re-openable in the store, exactly as a turn beyond RECENCY_WINDOW is.
 */
export function addWarrantRecord(summary, record) {
  const prev = summary || emptySummary();
  return {
    ...prev,
    records: [...(prev.records ?? []), record],
  };
}

/**
 * Measure the record projection's window from the store's own behavior,
 * rather than trusting the declared RECORDS_IN_PROMPT — S5's rule ("the rate
 * is measured, not set") applied to this store. `dmdWindow` is an injected
 * organ (native/kernel/activation.js's own export, cast.js pattern: fold.js
 * stays zero-import and testable without it); omitted, this function returns
 * the declared fallback outright and says so in `basis`, never silently.
 *
 * `derive` is mechanical, per the spec this closes: the live-identity set is
 * the union of every record's own `refs` (the addresses a record actually
 * cited — the closest thing this record shape has to a referent/claim id;
 * `gist`/`channels` are free text this module has no tokenizer for and does
 * not invent one to read). The measured window is the shallowest depth at
 * which forgetting older records changes no conclusion about which addresses
 * are currently live.
 *
 * Returns `{window, gamma, basis, tried, gap}` — `window` is `fallback` on
 * any gap (too little material for the smallest candidate, or
 * `reach_exceeds_candidates`), never a silent widest-candidate guess.
 */
export function deriveRecordWindow(records, { dmdWindow, candidates = [2, 4, 8, 16, 32], fallback = RECORDS_IN_PROMPT } = {}) {
  const store = records || [];
  if (typeof dmdWindow !== "function") {
    return { window: fallback, gamma: null, basis: "declared: no measurement organ injected (dmdWindow)", tried: null, gap: null };
  }
  const usable = candidates.filter((c) => c < store.length);
  if (!usable.length) {
    return { window: fallback, gamma: null, basis: "declared: fewer records than the smallest candidate depth — nothing to measure yet", tried: null, gap: null };
  }
  const identitiesOf = (recent) => [...new Set(recent.flatMap((r) => r.refs || []))].sort();
  const equal = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const measured = dmdWindow(store, identitiesOf, { candidates: usable, equal });
  if (measured.window == null) {
    return { window: fallback, gamma: null, basis: measured.basis, tried: measured.tried, gap: measured.gap };
  }
  return { window: measured.window, gamma: measured.gamma, basis: measured.basis, tried: measured.tried, gap: null };
}

// ── What actually goes in the prompt ─────────────────────────────────────────

export function buildSummarySystemMessage(summary) {
  if (!summary || !summary.topic) return null;
  const parts = [];
  parts.push(
    "PAST DISCOURSE — context from earlier turns ONLY. It is background for threads that started earlier, not the subject of the current turn. Answer the user's current question as a fresh request; use this only to follow along when it clearly refers to something already discussed.",
  );
  // Said here as well as in the record block, because this is the block a
  // model is most tempted to mine for a fact: it is the only thing in the
  // prompt that looks like a memory of what was established.
  parts.push(
    "This is a paraphrase, not a record. It cannot support a factual claim: if an answer would rest on something in here, say it would need to be checked rather than restating it as settled.",
  );
  parts.push(`Topic: ${summary.topic}`);
  if (summary.flow) parts.push(`Flow: ${summary.flow}`);
  if (summary.entities?.length)
    parts.push(`Entities: ${summary.entities.join(", ")}`);
  if (summary.context) parts.push(`Carried context: ${summary.context}`);
  return parts.join("\n");
}

/**
 * The System 2 folds, rendered for the prompt. Separate block, separate
 * framing, on purpose: merged into PAST DISCOURSE, an addressed record would
 * inherit the paraphrase's disclaimer, and a paraphrase would inherit the
 * record's authority. Two facts that differ must not read alike.
 *
 * `window` bounds the PROJECTION only — `summary.records` is the unbounded
 * store (see file header); this is where and when a bound is finally
 * applied. Defaults to the declared RECORDS_IN_PROMPT; pass a measured one
 * (deriveRecordWindow) to supersede it, the supersession being the caller's
 * to report (S16: "never silent").
 */
export function buildRecordSystemMessage(summary, { window = RECORDS_IN_PROMPT } = {}) {
  const records = projectRecords(summary, { window });
  if (!records.length) return null;
  const parts = [
    "ON RECORD — earlier turns that were checked, with the addresses they were checked against. Unlike PAST DISCOURSE, these can be re-opened: the sources named here still exist and can be read again. You may rely on a line here, and you must not contradict one without saying you are doing so.",
  ];
  // The plane note appears only when a self record is present, and it is
  // one sentence: a record checked against the instrument's own ledger must
  // never be readable as a check that ran against the material.
  if (records.some((r) => r.plane === "self"))
    parts.push(
      "A turn marked · self was checked against the instrument's own act ledger, not the material: it supports claims about how this instrument worked, never claims about the world.",
    );
  for (const r of records) {
    const bits = [`Turn ${r.turn}${r.plane === "self" ? " · self" : ""}: ${r.gist}`];
    if (r.channels.length) bits.push(`  carried by: ${r.channels.join(", ")}`);
    if (r.refs.length) bits.push(`  checked against: ${r.refs.join("; ")}`);
    if (r.unsupported.length)
      bits.push(`  NOT supported by that material: ${r.unsupported.join("; ")}`);
    if (r.open.length) bits.push(`  left open: ${r.open.join("; ")}`);
    parts.push(bits.join("\n"));
  }
  return parts.join("\n\n");
}

/**
 * Assemble the exact message array for the next turn.
 *
 * The whole point of the module in one function: `history` may be a thousand
 * turns long, and what comes back is one system message plus at most
 * RECENCY_WINDOW raw messages plus the new question. Everything older is
 * present only as the folded summary inside the system message.
 *
 * One system message, at index 0: WebLLM's own request validation rejects a
 * second system message anywhere else, so the blocks are merged rather than
 * appended as separate messages.
 */
export function buildTurnMessages({ basePrompt, summary, history, question, sourceBlock, recordWindow }) {
  const systemParts = [];
  if (basePrompt) systemParts.push(basePrompt);
  const past = buildSummarySystemMessage(summary);
  if (past) systemParts.push(past);
  const onRecord = buildRecordSystemMessage(summary, recordWindow != null ? { window: recordWindow } : undefined);
  if (onRecord) systemParts.push(onRecord);
  if (sourceBlock) systemParts.push(sourceBlock);

  const messages = [];
  if (systemParts.length)
    messages.push({ role: "system", content: systemParts.join("\n\n") });
  for (const m of (history || []).slice(-RECENCY_WINDOW))
    messages.push({ role: m.role, content: m.content });
  messages.push({ role: "user", content: question });
  return messages;
}

export function charCount(messages) {
  return (messages || []).reduce((n, m) => n + (m.content || "").length, 0);
}
