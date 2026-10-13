// fold-chat-continue.js — when the model's reply is CUT OFF, the chat asks it to continue, and the pieces are joined MECHANICALLY.
// Pure: no DOM, no IO, no model. The model writes drafts; this module only decides whether a draft was cut, builds the reprompt, and joins
// two drafts without adding or changing a word (the Pivot then reads the joined draft — fold-chat-pivot.js — so the person only ever sees
// what survived being read once, across however many model answers it took).
//
//   cutOff({ finish, text })        → { cut, why }   `length` (the stream's own finish_reason) is the evidence; with NO finish reported at
//                                      all, a tail that stops mid-sentence is read as cut ("unterminated"). A model that said it STOPPED
//                                      (finish "stop") ended on purpose, whatever its last character.
//   continueMessages(messages, so)  → the messages that hand the model its own draft back and ask for the rest
//   joinDraft(prev, next)           → { text, overlap }  next with any REPEATED lead (the last words of prev, said again) removed, then joined
//
// The one other edit is a SEAM MARK: an ellipsis ending prev or opening next (the model's "…" where it was cut off and where it resumed) is dropped.
// DECLARED, not measured (Constitution II.11): `maxRounds` and `minOverlapWords`; giver: the author, 2026-10-06. Two rounds bound the cost
// of a stuck model (each round is a full model call on a small local model); three words is the shortest repeat that is not coincidence.

export const CONTINUE = Object.freeze({
  giver: "the author, 2026-10-06; declared, not measured (II.11)",
  maxRounds: 2,
  minOverlapWords: 3,
  prompt: "Continue exactly where you stopped. Write only the words that come next; do not repeat anything you have already written.",
});

const TERMINAL = /[.!?。！？؟…:;"')\]”’」』»]\s*$/u;
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const words = (s) => (String(s ?? "").match(WORD) || []).map((w) => w.toLocaleLowerCase("und"));

export function cutOff({ finish = null, text = "" } = {}) {
  const t = String(text ?? "").replace(/\s+$/, "");
  if (!t) return { cut: false, why: null };
  if (finish === "length") return { cut: true, why: "length" };
  if (finish == null && !TERMINAL.test(t) && /[\p{L}\p{N}]$/u.test(t)) return { cut: true, why: "unterminated" };
  return { cut: false, why: null };
}

export function continueMessages(messages, draftSoFar) {
  const list = Array.isArray(messages) ? messages : [];
  return [...list, { role: "assistant", content: String(draftSoFar ?? "") }, { role: "user", content: CONTINUE.prompt }];
}

/** Join a draft and its continuation. The only edit is REMOVING a repeated lead (>= minOverlapWords words that end `prev`). */
export function joinDraft(prev, next, { minOverlapWords = CONTINUE.minOverlapWords } = {}) {
  // an ellipsis the model put where it was cut off ("… into the") or where it resumed ("… chemical energy") is a SEAM MARK, not text
  const ELL = /(?:\.{3,}|\u2026)/;
  const a = String(prev ?? "").replace(/\s+$/, "").replace(new RegExp("\\s*" + ELL.source + "\\s*$", "u"), "");
  let b = String(next ?? "").replace(new RegExp("^\\s*" + ELL.source + "\\s*", "u"), (m) => (/\n\s*\n/.test(m) ? "\n\n" : ""));
  const paragraph = /^\s*\n\s*\n/.test(b);
  b = b.replace(/^\s+/, "");
  if (!b) return { text: a, overlap: 0 };
  if (!a) return { text: b, overlap: 0 };
  // the longest run of words that ends prev and starts next (caseless), measured on the words, cut from next by position
  const aw = words(a), bw = words(b);
  let k = 0;
  for (let n = Math.min(aw.length, bw.length, 40); n >= minOverlapWords; n--) {
    if (aw.slice(aw.length - n).join(" ") === bw.slice(0, n).join(" ")) { k = n; break; }
  }
  let rest = b;
  if (k) { let seen = 0, m; WORD.lastIndex = 0; while ((m = WORD.exec(b)) && seen < k) { seen++; if (seen === k) { rest = b.slice(m.index + m[0].length); break; } } rest = rest.replace(/^[\s,;:.!?。！？]+/u, ""); }
  if (!rest.trim()) return { text: a, overlap: k };
  return { text: a + (paragraph ? "\n\n" : " ") + rest, overlap: k };
}
