// pace.js — the system's awareness of its own speed. Pure.
//
// Latency is not guessed and not configured; it is MEASURED, from the
// runtime's own telemetry. Ollama's final stream chunk reports what actually
// happened — prompt_eval_count and eval_count in real tokens, their
// durations in real nanoseconds — and this module keeps those observations
// on an append-only log (the same discipline as every other log here:
// entries are appended, never mutated; the current pace is a fold).
//
// From the fold, two derived facts per model, both measured and both
// carrying their sample count:
//   tokens-per-char   — how this model's tokenizer sees this conversation's
//                       text (chars are what the app can count before a
//                       call; tokens are what the model actually eats)
//   prefill and decode rates — tokens/second, separately, because a long
//                       prompt pays prefill and a long answer pays decode
//                       and conflating them predicts neither.
//
// A prediction before any measurement exists is a typed gap, never a guess:
// the first call reports "pace unmeasured", not a number with no ground.

export function emptyPaceLog() {
  return Object.freeze({ entries: Object.freeze([]), nextSeq: 0 });
}

/** Append one observed call. Fields come straight off Ollama's final chunk. */
export function recordCall(log, { model, promptChars, promptTokens, promptNs, outTokens, outNs }) {
  const entry = Object.freeze({
    seq: log.nextSeq,
    model: String(model),
    promptChars: Number(promptChars) || 0,
    promptTokens: Number(promptTokens) || 0,
    promptNs: Number(promptNs) || 0,
    outTokens: Number(outTokens) || 0,
    outNs: Number(outNs) || 0,
  });
  return Object.freeze({
    entries: Object.freeze([...log.entries, entry]),
    nextSeq: log.nextSeq + 1,
  });
}

/** The current pace for one model — derived, never stored. */
export function foldPace(log, model) {
  const rows = log.entries.filter((e) => e.model === model && e.promptTokens > 0);
  if (!rows.length) return { model, calls: 0 };
  const sum = (f) => rows.reduce((n, r) => n + f(r), 0);
  const promptChars = sum((r) => r.promptChars);
  const promptTokens = sum((r) => r.promptTokens);
  const promptNs = sum((r) => r.promptNs);
  const outTokens = sum((r) => r.outTokens);
  const outNs = sum((r) => r.outNs);
  return {
    model,
    calls: rows.length,
    tokensPerChar: promptChars > 0 ? promptTokens / promptChars : null,
    prefillTps: promptNs > 0 ? promptTokens / (promptNs / 1e9) : null,
    decodeTps: outNs > 0 ? outTokens / (outNs / 1e9) : null,
    // What a call on this model has actually produced, on average — the
    // honest stand-in for "how long will the answer take" when the caller
    // sets no cap: predict from what this conversation's calls have done.
    meanOutTokens: rows.length ? outTokens / rows.length : null,
  };
}

/**
 * Predict a call's wall time from the measured pace. `outTokens` is the
 * caller's cap — the bound on decode, which is what a cap is for.
 * Unmeasured pace returns the typed gap; the caller says "unmeasured", it
 * does not invent a number.
 */
export function predictCall(pace, promptChars, outTokens) {
  if (!pace || !pace.calls || !pace.tokensPerChar || !pace.prefillTps || !pace.decodeTps) {
    return { ms: null, gap: "pace unmeasured — no completed call on this model yet" };
  }
  const promptTokens = promptChars * pace.tokensPerChar;
  const ms = (promptTokens / pace.prefillTps + outTokens / pace.decodeTps) * 1000;
  return { ms: Math.round(ms), promptTokens: Math.round(promptTokens), basis: `measured over ${pace.calls} call(s)` };
}

/**
 * Fit a prompt to the model's context window, mechanically and DISCLOSED.
 *
 * The one non-arbitrary "too long" is the window itself — a hardware-shaped
 * fact the runtime declares, not a taste threshold. When the estimated
 * prompt exceeds the declared window, passages are dropped from the END of
 * the retrieval ranking (the least-relevant first — the ranking already
 * ordered them) until the estimate fits, and the drop is returned as a
 * typed note for the record. No measurement yet → nothing is trimmed and
 * the gap says why: trimming on an unmeasured estimate would be a guess
 * acting like a fact.
 */
export function fitToWindow({ pace, contextTokens, fixedChars, passages, outTokens }) {
  if (!contextTokens || !pace?.tokensPerChar) {
    return { passages, dropped: [], note: null };
  }
  const budget = contextTokens - outTokens;
  const tokens = (chars) => chars * pace.tokensPerChar;
  const kept = [...passages];
  const dropped = [];
  const total = () => tokens(fixedChars + kept.reduce((n, p) => n + p.text.length, 0));
  while (kept.length && total() > budget) {
    dropped.push(kept.pop());
  }
  return {
    passages: kept,
    dropped,
    note: dropped.length
      ? `trimmed to fit ${contextTokens.toLocaleString()}-token window: dropped ${dropped.map((p) => p.ref).join(", ")}`
      : null,
  };
}
