// transcript-reading.js — WHAT THE READER IS HANDED OF A CONVERSATION
// (2026-09-22). The proxy writes the conversation as a marked-up transcript
// ("[user]: …", "[assistant]: …", "[System Context]: …"), and the marks are
// load-bearing elsewhere (the corpus's chat documents, transcriptFromSession).
// The READER must not see them: measured on six turns with the proxy's own
// reader, the marks became beings — "user" and "assistant" — and put each
// question's opening word mid-line after the colon, where it read as a name
// ("Tell", "What", "Why"). The session's Atmosphere then said the
// conversation "has stood on The, What and How", and nothing the fold held
// could stand in for the history the model was re-sent.
//
// The marks are BLANKED to spaces of their own length, never cut: the
// reader's sentence anchors are absolute positions in the transcript, and
// a blanked byte moves none of them (the same move organs/web.js blankSpans
// makes for page furniture). Who said a line is the encounter's metadata,
// not a word in it. The marks are a closed set: the proxy's own three.

export const TRANSCRIPT_MARK = /^\[(?:user|assistant|system|System Context)\]:[ \t]?/gm;

/** The transcript with its role marks blanked to spaces of equal length. */
export function readableTranscript(text) {
  return String(text ?? "").replace(TRANSCRIPT_MARK, (m) => " ".repeat(m.length));
}
