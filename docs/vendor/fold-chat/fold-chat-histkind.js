// fold-chat-histkind.js — what of a CREATIVE turn rides back to the model as history. Pure: no DOM, no IO, no model, no clock.
//
// The bug (user, 2026-10-06; G3): the person asked "write me a song about trampolines" (the assistant text came back EMPTY), then "who is mt. mckinlet
// named afer?" — and the answer came back AS A SONG ("President McKinley, a name that rings so bold…"). Cause (eval/ants/g3/trace.mjs, G3-RESULTS.md):
// `modelHistory` (fold-chat-channels.js) omits an assistant turn that wrote nothing but KEEPS the person's ask, so the model's history was
//   [user "write me a song about trampolines", user "who is mt. mckinlet named afer?"]
// and the whole short exchange rides verbatim (`conversationVerbatim`). A creative turn that DID write text would ride the same way (its lyrics are
// in the window). A small model keeps writing in the register it was last asked for.
//
// THE RULE (declared, not measured; giver: the user's bug report): a creative exchange (the ask classifies as generate/compose, or its reply is marked
// creative) is not conversation for a FACTUAL turn. For a turn that is not itself creative, and whose ask does not lean on the last exchange (it is not
// anaphoric: fold-chat-anaphora.js), each creative exchange is replaced by ONE plain line stating the fact that it happened — never the ask, never the
// lyrics — or dropped (`mode: "drop"`). A creative turn after a creative turn keeps everything: the person is still writing.
//
//   styleSafeMessages(messages, { kind, classify, leansOnLast, mode }) -> messages   (same shape in and out: feed the result to modelHistory)
//   MARKER                                                                           the one line
//
// The marker states a fact about the chat; it is not an instruction (the door's information-not-prohibition rule, fold-chat-gary.js).

export const CREATIVE_KINDS = Object.freeze(["generate", "compose"]);
export const MARKER = "[Earlier in this chat the person asked for a creative piece of writing.]";

const textOf = (m) => String(m?.content ?? "").trim();
const isCreativeReply = (m) => !!(m && m.role === "assistant" && (m.grounding?.creative || CREATIVE_KINDS.includes(m.grounding?.kind) || CREATIVE_KINDS.includes(m.kind)));

/**
 * The stored messages with each creative exchange replaced by the marker (or dropped), for a turn that should not hear it.
 *   kind        the kind of THIS turn (classifyTurn). A creative kind returns the messages unchanged.
 *   classify    (ask) -> kind, injected (fold-chat-discourse.js classifyTurn): an ask that classifies as generate/compose is creative
 *   (the pending ask — the final user message with no reply — is never touched)
 *   leansOnLast the ask points back at the last exchange (anaphoraOf(...).carry): "make it rhyme", "who is it about" — then the last exchange stays verbatim
 *   mode        "marker" (default) | "drop"
 */
export function styleSafeMessages(messages, { kind = null, classify = null, leansOnLast = false, mode = "marker" } = {}) {
  const msgs = Array.isArray(messages) ? messages : [];
  if (CREATIVE_KINDS.includes(kind)) return msgs;
  const out = [];
  let lastWasMarker = false;
  // exchanges: a user ask and the assistant replies that follow it before the next user ask
  let i = 0;
  const exchanges = [];
  while (i < msgs.length) {
    const m = msgs[i];
    if (m?.role === "user") { const ex = [m]; let j = i + 1; while (j < msgs.length && msgs[j]?.role !== "user") { ex.push(msgs[j]); j++; } exchanges.push(ex); i = j; }
    else { exchanges.push([m]); i++; }
  }
  // the PENDING ask (the turn being answered: a final exchange with no reply yet) is never touched; "the last exchange" is the one before it
  const pending = exchanges.length && exchanges[exchanges.length - 1].length === 1 && exchanges[exchanges.length - 1][0]?.role === "user" ? exchanges.length - 1 : -1;
  const lastIdx = pending >= 0 ? pending - 1 : exchanges.length - 1;
  exchanges.forEach((ex, n) => {
    if (n === pending) { out.push(...ex); lastWasMarker = false; return; }
    const ask = ex[0]?.role === "user" ? ex[0] : null;
    const creative = !!ask && ((typeof classify === "function" && CREATIVE_KINDS.includes(classify(textOf(ask)))) || ex.slice(1).some(isCreativeReply));
    if (!creative || (leansOnLast && n === lastIdx)) { out.push(...ex); lastWasMarker = false; return; }
    if (mode === "marker" && !lastWasMarker) { out.push({ role: "user", content: MARKER, marker: true }); lastWasMarker = true; }
  });
  return out;
}
