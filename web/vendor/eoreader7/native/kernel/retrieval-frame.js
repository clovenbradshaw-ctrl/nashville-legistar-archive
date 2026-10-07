// native/kernel/retrieval-frame.js — no view from nowhere, on the way OUT.
//
// User, 2026-09-06: "there's no view from nowhere and a retrieval always has
// scoping based on what the person is really asking."
//
// notes.js already holds this discipline for the way IN. A ledger is created
// by a reader standing somewhere — which organs ran, which priors were
// injected, which were deliberately absent — and `createNotes({frame})`
// records that standing as the log's own first entry at DEF Ground, the
// declaration of interpretive ground. `frameOf` reports the gap by name and
// NEVER invents a frame to fill it.
//
// The reading declares its frame. The retrieval does not. That is the missing
// half, and it is the same cell: a retrieval is an atmosphere too.
//
// ── WHAT WENT WRONG WITHOUT IT, MEASURED ─────────────────────────────────
//
// `activation.js::dmdWindow` requires a conclusion, and says so in its own
// error: "derive is the conclusion a difference must make a difference TO —
// it is required." Measuring how far back one must look before a referent
// stops changing, a conclusion was supplied — "what does this referent stand
// in, and beside whom" — buried in a code comment, and the result reported as
//
//     the measured reach of Prince Andrew is 41 mentions
//
// as though reach were a property of Prince Andrew. It is not. It is a
// property of (Prince Andrew, that conclusion, that cursor). Change the
// question and the number changes. The sentence was a view from nowhere
// wearing a measurement, and nothing in the result could have caught it,
// because nothing in the result said what had been asked.
//
// ── WHAT A RETRIEVAL STANDS ON ───────────────────────────────────────────
//
//   asking      the question in the person's own words — never paraphrased,
//               because the paraphrase is already an interpretation and the
//               frame is supposed to record interpretations, not perform them
//   conclusion  what a difference must make a difference TO. This is the one
//               that makes a reach number mean anything.
//   atSeq       the cursor. Identity is retrieval-time (P1), so the same
//               question at 25% and at 100% is two different retrievals and
//               a frame that omits the cursor has not said where it stood.
//   organs      which readers were in play, which priors, which absent
//
// ── THE RULE THIS FILE KEEPS ─────────────────────────────────────────────
//
// A retrieval WITHOUT a declared frame is not refused — a refusal that breaks
// every existing caller is not a wall, and notes.js made the same judgement
// for the same reason. But the gap is reported BY NAME, and no frame is ever
// invented to fill it. `undeclared` is a real state and it is the honest one
// for every retrieval in this tree today.

/** Canonical form: key-sorted, prose-free — the same rule notes.js uses, so two identical frames get one id. */
const canon = (value) => {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canon(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
};

/** The identity of HOW a retrieval was scoped. SHA-256 over the canonical descriptor, 16 hex — this project's short-digest convention. */
export async function retrievalId(frame) {
  const bytes = new TextEncoder().encode(canon(frame ?? null));
  const buf = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

/**
 * declare(frame) — what this retrieval stands on.
 *
 * `asking` and `conclusion` are required, because they are the two a
 * retrieval cannot be honest without: what was asked, and what the answer had
 * to make a difference to. A frame missing either is not a frame with a hole
 * in it — it is a view from nowhere, and it is refused HERE (unlike an absent
 * frame, which is merely reported) because a caller that got as far as
 * declaring has no excuse for declaring nothing.
 */
export function declare({ asking, conclusion, atSeq = null, organs = null, priors = null, absent = null } = {}) {
  if (typeof asking !== "string" || !asking.trim()) throw new TypeError("retrieval frame: `asking` is the question in the person's own words — a retrieval that cannot say what was asked is a view from nowhere");
  if (typeof conclusion !== "string" || !conclusion.trim()) throw new TypeError("retrieval frame: `conclusion` is what a difference must make a difference TO — without it a reach or a relevance is a number about nothing");
  return Object.freeze({
    schema: "RetrievalFrame@1",
    asking: asking.trim(),
    conclusion: conclusion.trim(),
    // null is a DECLARED whole-reading cursor, not a missing one; `undefined`
    // never reaches here because the default is explicit.
    atSeq,
    organs: organs == null ? null : Object.freeze([...organs]),
    priors: priors == null ? null : Object.freeze([...priors]),
    // What was deliberately NOT in play. notes.js records this for readers
    // and it matters more on the way out: an answer that had no access to a
    // source should say so rather than let its silence read as absence.
    absent: absent == null ? null : Object.freeze([...absent]),
  });
}

/**
 * frameOf(result) — whose retrieval was this?
 *
 * Reports the gap by name and never invents one. `undeclared` is the honest
 * answer for a retrieval that did not say where it stood, and a caller that
 * reads this and prints a number anyway has been told.
 */
export function frameOf(result) {
  const f = result?.frame;
  if (!f || f.schema !== "RetrievalFrame@1") {
    return { gap: "undeclared_retrieval", detail: "this retrieval did not declare what was asked or what conclusion it was scoped to — its numbers are not about anything in particular" };
  }
  return { declared: f, cursor: f.atSeq, scoped: true };
}

/**
 * carry(result, frame) — attach the frame to what is handed back.
 *
 * Additive by construction: a result that already carries a frame keeps it
 * (a later hand cannot restate an earlier standing), and a result handed no
 * frame is returned unchanged rather than given an invented one.
 */
export function carry(result, frame) {
  if (!frame) return result;
  if (result?.frame) return result;
  return { ...result, frame };
}

/**
 * A number without its frame is not a finding. `say` renders a measured
 * quantity together with what it is a measurement OF, so a reach cannot be
 * quoted as a property of the thing it was measured on.
 */
export function say(value, result) {
  const f = frameOf(result);
  if (f.gap) return `${value} — ${f.gap}: ${f.detail}`;
  const at = f.declared.atSeq == null ? "the whole reading" : `cursor ${f.declared.atSeq}`;
  return `${value}, for "${f.declared.asking}", scoped to ${JSON.stringify(f.declared.conclusion)}, at ${at}`;
}
