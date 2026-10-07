// organs/ledger-revision.js — one bounded, injected-call rewrite attempt per
// sentence whose own drafted claim matches a note this ledger already
// carries a LIVE DISPUTE against.
//
// The pure half of this question (does a claim match a disputed note at
// all) is kernel/notes.js::claimContestedByLedger, medium-agnostic and
// model-free. This organ is the layer up: given sentences, their own
// claims, the ledger's folded notes, and an injected `call`, it asks the
// mouth to rewrite EXACTLY the contested sentences — never more — and
// accepts a candidate only if the caller's own injected `accept()` says so.
// No notion of "grounded enough" lives here: that is genuinely caller-
// specific (a text consumer with its own multi-tier grounding ladder is one
// such caller; a different consumer could inject a simpler test). Mirrors
// witness-sentences.js's own conventions exactly: injected call, a
// caller-declared ask budget (P9, never a default), typed per-sentence
// rows, sequential asks never a fan-out.
//
// The specimen this closes (2026-09-22, user direction: "if the model says
// something that contradicts what the holograph knows that needs to spawn
// a revision"): a note disputed BEFORE a turn ever drafted anything (a
// pre-dispatch dispute, or an earlier turn's own contest) has no "later
// reading" for a caller's own revision machinery to compare against — this
// organ checks the CURRENT ledger state directly, once per sentence, so
// that class of case is caught without needing one.
import { claimContestedByLedger } from "../kernel/notes.js";

const defaultPromptFor = (sentence, { because }) =>
  `This sentence was written, and the record already shows otherwise: "${sentence}"\nWhat the record shows: ${because}.\nRewrite only that sentence so it says what the record establishes, in the same voice; one sentence.`;

/**
 * reviseAgainstLedger(sentences, { claims, notes, call, systemPrompt,
 * promptFor, accept, asks }) → { replacements, revisions, asksSpent }
 *
 * `claims`: every claim this text made, each `{end1/subject, label/verb,
 * end2/object, sentence, verdict?}` — the same shape hyperlexicon.js's SVO
 * face and this kernel's own end1/label/end2 both already speak.
 * `notes`: this ledger's own fold() (or foldWithStanding()) output.
 * `call(messages, opts)`: the injected model call.
 * `accept(candidate, {sentence, disputedBy})`: the caller's own gate on
 * whether a candidate is acceptable — required; there is no default,
 * because "acceptable" is exactly the question this organ refuses to
 * answer on the caller's behalf.
 * `asks`: the caller's own declared budget (P9) — required, a finite
 * number, never defaulted.
 */
export async function reviseAgainstLedger(sentences, { claims = [], notes = [], call, systemPrompt = "", promptFor = defaultPromptFor, accept, asks } = {}) {
  if (!Number.isFinite(asks)) throw new TypeError("reviseAgainstLedger: asks is declared by the caller (P9)");
  if (typeof accept !== "function") throw new TypeError("reviseAgainstLedger: accept(candidate, {...}) is declared by the caller — this organ has no notion of 'grounded enough' of its own");
  const replacements = new Map();
  const revisions = [];
  let spent = 0;
  for (const sentence of sentences ?? []) {
    const own = (claims ?? []).filter((c) => c?.sentence === sentence);
    const found = own.map((c) => claimContestedByLedger(c, notes)).find((r) => r.contested);
    if (!found) continue;
    if (spent >= asks) { revisions.push({ sentence, kind: "revise-refused", because: "revision ask budget spent" }); continue; }
    spent += 1;
    let candidate = "";
    try {
      candidate = String((await call([
        { role: "system", content: systemPrompt },
        { role: "user", content: promptFor(sentence, found) },
      ], { maxTokens: 160 })) ?? "").trim().split("\n")[0].trim();
    } catch { candidate = ""; }
    const cand = candidate.replace(/^["“]|["”]$/g, "");
    let ok = false;
    if (cand) { try { ok = Boolean(await accept(cand, { sentence, disputedBy: found.disputedBy })); } catch { ok = false; } }
    if (cand && ok) {
      replacements.set(sentence, cand);
      revisions.push({ sentence, kind: "revise", to: cand, because: found.because });
    } else {
      revisions.push({ sentence, kind: "revise-refused", candidate: cand || null, because: cand ? "the rewrite did not clear the caller's own acceptance gate" : "no rewrite came back" });
    }
  }
  return { replacements, revisions, asksSpent: spent };
}
