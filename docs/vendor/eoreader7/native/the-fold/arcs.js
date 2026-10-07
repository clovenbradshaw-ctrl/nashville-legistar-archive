// arcs.js — compellingness over TIME: the conversation's recent answers as an
// arc, measured at the arc grain, never per-response. Companion to the
// pathos read (pathos-turn.js) — arcs measures the CONTENT voice, pathos the
// FELT shape; both read the same rolling window and both may speak the next
// turn's voice cue.
//
// THE WINDOW. 8 answers, declared. The 100-turn battery (fold-stress-session,
// turns-100.jsonl) grouped the session into threads of 10 visits × 2 turns =
// 20 answers each and measured flatness ON THE THREAD: distinct openings
// 3-8/20, renewal collapsing from 20-28 new types/visit to 2.7-14. This
// module's rolling 8-answer window is the live conversation's counterpart to
// one thread — shorter, because a real conversation's arc is what is recent,
// and the recency window's own reasoning (READING-POLICY P1: the reach of
// the present) governs how much voice is "now".
//
// TWO MEASURES, both read off the battery's measured failure shapes:
//   framesLocked      — >= 2 of the last 3 answers open with the same 3-word
//                       frame ("The text says" was 32/100 in the battery; a
//                       thread with 3/20 distinct openings was the flattest).
//   renewalCollapsing — mean new word types per answer in the window's recent
//                       half < the earlier half's mean × 0.5. The battery's
//                       collapse band measured 0.14-0.50 (flat threads) vs
//                       0.50 (the one sustained thread); 0.5 is that
//                       boundary, disclosed here, never tuned.
//
// THE CUE is information, never a directive (P55: the model reasons from
// facts; instructions about its own output are the thing L5 distrusts). It
// names the conversation's own words — the model's past openings — and says
// nothing about this instrument's parts (firewall.js::APPARATUS_TERMS; the
// cue texts are asserted clean in arcs.test.mjs).

const WINDOW = 8;
const RECENT = 3; // framesLocked's recency run
const RENEWAL_BOUND = 0.5; // the battery's measured collapse boundary
const FRAME_WORDS = 3;

export const ARCS = Object.freeze({
  WINDOW,
  RECENT,
  RENEWAL_BOUND,
  FRAME_WORDS,
});

const words = (s) => String(s ?? "").trim().split(/\s+/).filter(Boolean);

/** Fresh per-conversation arc state: the recent answers and the thread's
 *  running vocabulary (renewal is measured against everything the arc has
 *  already said — the same "is the conversation still saying anything new"
 *  the battery's thread-scoped seen-set answered). */
export function makeArcState() {
  return { answers: [], seen: new Set() };
}

/** Append one finished answer to the arc. `frame` is the answer's 3-word
 *  opening; `newTypes` is the count of its word types the thread has not
 *  already said. */
export function observeArc(state, { question, answer, at = null }) {
  if (!state || !Array.isArray(state.answers) || !(state.seen instanceof Set)) {
    throw new TypeError("observeArc requires arc state from makeArcState()");
  }
  const text = String(answer ?? "").trim();
  if (!text) throw new TypeError("observeArc requires the answer — the voice that was heard");
  const frame = words(text).slice(0, FRAME_WORDS).join(" ");
  const types = new Set(text.toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 1));
  let newTypes = 0;
  for (const t of types) {
    if (!state.seen.has(t)) newTypes += 1;
    state.seen.add(t);
  }
  state.answers.push(Object.freeze({
    at: at ?? state.answers.length,
    frame,
    text,
    words: words(text).length,
    newTypes,
  }));
  if (state.answers.length > WINDOW) state.answers.shift();
  return state.answers[state.answers.length - 1];
}

/** The arc's reading: does the conversation's recent voice repeat itself?
 *  `flat` is true when either measured failure shape is present. `basis`
 *  names which one, with the exact counts — never a bare label. */
export function arcReading(state, { window = WINDOW } = {}) {
  const answers = state?.answers ?? [];
  const n = answers.length;
  if (n < RECENT) {
    return { n, flat: false, framesLocked: false, renewalCollapsing: false, basis: "fewer than 3 answers — no arc to grade" };
  }
  const last = answers.slice(-RECENT);
  const openings = new Map();
  for (const a of last) openings.set(a.frame, (openings.get(a.frame) ?? 0) + 1);
  const framesLocked = [...openings.values()].some((c) => c >= 2);
  const recent = answers.slice(Math.ceil(n / 2));
  const earlier = answers.slice(0, Math.ceil(n / 2));
  const mean = (xs, f) => xs.reduce((a, x) => a + f(x), 0) / Math.max(xs.length, 1);
  const renewalCollapsing = recent.length > 0
    && mean(earlier, (a) => a.newTypes) > 0
    && mean(recent, (a) => a.newTypes) < mean(earlier, (a) => a.newTypes) * RENEWAL_BOUND;
  const flat = framesLocked || renewalCollapsing;
  const lockedFrame = [...openings.entries()].filter(([, c]) => c >= 2).map(([f]) => `"${f}"`).join(", ");
  const basis = framesLocked
    ? `${RECENT} of the last ${RECENT} answers share an opening (${lockedFrame})`
    : renewalCollapsing
      ? `renewal collapsing: ${mean(recent, (a) => a.newTypes).toFixed(1)} new words/answer in the recent half vs ${mean(earlier, (a) => a.newTypes).toFixed(1)} in the earlier half (bound ${RENEWAL_BOUND}×, from the 100-turn battery's measured collapse band)`
      : "the arc's voice keeps varying";
  return { n, flat, framesLocked, renewalCollapsing, basis, answers: [...answers] };
}

/** The model-facing cue for a flat arc. Information about the conversation's
 *  own words, never a directive — and clean of apparatus vocabulary
 *  (firewall.js), asserted in arcs.test.mjs. */
export function voiceCueFor(reading) {
  if (!reading?.flat) return null;
  if (reading.framesLocked) {
    return "The recent answers in this conversation have all opened with the same words.";
  }
  return "This conversation has been repeating itself — the recent answers said almost nothing new.";
}