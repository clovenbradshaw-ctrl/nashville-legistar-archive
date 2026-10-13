// fold-chat-answer.js — the per-turn ANSWER MODE. Pure: no DOM, no IO.
//
//   facing — the existing spread: the model's response is drawn FROM snipped sources.
//   snips  — "Sources only": NO model call; the answer is the sources' own passages, verbatim.
//
// The same shape as effort (fold-chat-web.js): chosen in the composer's "this turn" chip, captured once at send
// and stamped on the ask (`message.answerMode`), remembered as the next default (`fold-chat:answerMode`); a
// re-run reuses the original turn's mode unless the chip was moved since. Default: facing.

export const ANSWER_MODES = Object.freeze([
  { key: "facing", label: "Facing page", note: "the model writes from snipped sources" },
  { key: "snips", label: "Sources only", note: "no model — the sources' own passages, unchanged" },
]);

/** A known answer-mode key, or the fallback ("facing" unless told otherwise). Never throws on stored junk. */
export function normAnswerMode(v, fallback = "facing") {
  return typeof v === "string" && ANSWER_MODES.some((m) => m.key === v) ? v : fallback;
}

/** Which mode a RE-RUN uses: the original turn's, unless the chip was moved since the last send (`changed`). */
export function resolveAnswerMode({ original = null, composer = "facing", changed = false } = {}) {
  const c = normAnswerMode(composer);
  if (changed) return c;
  return normAnswerMode(original, c);
}

/** The mode a stored turn ran in: a user message's own `answerMode`, else that of the assistant message that
 *  answered it; for an assistant message its own, else the user message before it. null if it predates the control. */
export function answerModeOfTurn(messages, index) {
  const msgs = Array.isArray(messages) ? messages : [];
  const m = msgs[index];
  if (!m) return null;
  const own = (x) => (x && typeof x.answerMode === "string" ? normAnswerMode(x.answerMode, null) : null);
  if (m.role === "assistant") {
    if (own(m)) return own(m);
    for (let i = index - 1; i >= 0; i--) if (msgs[i].role === "user") return own(msgs[i]);
    return null;
  }
  if (own(m)) return own(m);
  for (let j = index + 1; j < msgs.length; j++) if (msgs[j].role === "assistant") return own(msgs[j]);
  return null;
}
