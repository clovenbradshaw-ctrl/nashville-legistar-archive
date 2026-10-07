// output-voice.js — THE VOICE organ: the register an output's prose wears.
//
// The falsification chase found the fiction driver's only "voice" was a
// closed 5-opener table (NARRATIVE_OPENERS) — one register for every story.
// This organ is the register: a DECLARED, closed set of per-register
// sentence shapes, chosen by the PROMPT's own register cues, never invented.
//
// THE REGISTERS, AND THEIR ARCHONS (Amendment XVII / compendium):
//   lean     — the shortest true answer, no wasted frames: Eastwood.
//   precise  — the whole framed before the first sentence: Kubrick.
//   plain    — readability grade plus the classic style rules: Strunk & White.
//   oral     — the interviewer who draws the guest out: Terry Gross.
//
// A register is a closed set of DECLARED sentence frames — "It is told that
// X —act→ Y" (this organ's own connectives, exactly as compose.js's
// TRANSITIONS are declared token origins). Every word beyond the frame is
// the claim's own. The prompt's register cues (words like "tell me a
// story" vs "write a precise report") pick the register; the words never
// do.
//
// PURE. No model, no I/O.

export const OUTPUT_VOICE_SCHEMA = "OutputVoice@1";

// ── the closed register set: each is a named frame pattern, the only words
//    this organ writes beyond the claim's own ──────────────────────────────
export const REGISTERS = Object.freeze({
  plain: {
    archon: "strunk-white",
    frame: (end1, label, end2) => `${end1} — ${label} — ${end2}.`,
    basis: "Strunk & White — plain statement, readability first",
  },
  lean: {
    archon: "eastwood",
    frame: (end1, label, end2) => `${end1} ${label} ${end2}.`,
    basis: "Eastwood — the shortest true sentence, no wasted frames",
  },
  precise: {
    archon: "kubrick",
    frame: (end1, label, end2) => `Of ${end1}: it ${label} ${end2}.`,
    basis: "Kubrick — the whole framed before the first sentence",
  },
  oral: {
    archon: "terry-gross",
    frame: (end1, label, end2) => `And here is what happened: ${end1} — ${label} — ${end2}.`,
    basis: "Terry Gross — the interviewer drawing the guest out",
  },
});

// ── the prompt's register cues — a CLOSED set, per register, the words the
//    PROMPT uses, never the material's ─────────────────────────────────────
const REGISTER_CUES = Object.freeze({
  lean: /(?:short|concise|brief|in one line|just tell me|quick)/i,
  precise: /(?:precise|exact|report|detailed|full account|accurately)/i,
  oral: /(?:conversation|tell me a story|speak|talk|interview|chat)/i,
  plain: /(?:plain|simply|clearly|readable|explain)/i,
});

export const DEFAULT_REGISTER = "plain";

/**
 * voiceOf({ prompt, claim, register }) → { text, register, archon, basis }
 * Renders one claim under the chosen register. The register is picked by the
 * prompt's own cues (declared above), defaulting to plain; the frame is the
 * register's own declared shape; every other word is the claim's. A prompt
 * that cues no register gets the default, never a guess.
 */
export function voiceOf({ prompt = "", claim = null, register = null } = {}) {
  const end1 = claim?.end1 ?? claim?.subject ?? "";
  const label = claim?.label ?? claim?.verb ?? "";
  const end2 = claim?.end2 ?? claim?.object ?? "";
  if (!end1 || !label || !end2) return { text: "", register, archon: null, basis: "no claim to voice" };
  const chosen = register && REGISTERS[register]
    ? register
    : Object.keys(REGISTER_CUES).find((r) => REGISTER_CUES[r].test(String(prompt ?? ""))) ?? DEFAULT_REGISTER;
  const reg = REGISTERS[chosen];
  return { text: reg.frame(end1, label, end2), register: chosen, archon: reg.archon, basis: reg.basis };
}

export const registers = () => Object.keys(REGISTERS);