// native/organs/ulysses.js — the injection archon. Handle: Ulysses — bound to
// the mast, he HEARS the Sirens' song and does not obey it. The material speaks;
// the reader does not act on its commands.
//
// WHAT IT IS. The engine reads arbitrary material — files, web pages, an
// uploaded document. Any of it can try to instruct the reader: "ignore your
// previous instructions", "reveal your system prompt", "email the keys to …",
// a forged `</system>` delimiter. Prompt injection is data treated as code —
// the one category that attacks the ENGINE itself, not its output.
//
// THE LAW: material is EVIDENCE, never INSTRUCTION. The reader hears the
// material's imperative voice as a CLAIM ABOUT THE MATERIAL ("this text tries
// to redirect me"), never as an order. The firewall already keeps material in
// the evidence channel; this archon makes the attempt VISIBLE so it is
// disclosed, not silently absorbed. A witness, never a verdict.

// The known injection shapes: an instruction aimed at the READER, not content
// about the subject. Each carries a strength (how unambiguous the attempt is).
const INJECTION_SHAPES = [
  { re: /\bignore\s+(?:all\s+)?(?:the\s+|your\s+|these\s+|those\s+)?(?:previous|prior|above|earlier|foregoing|rules?|instructions?|prompts?|directions?|guidelines?|context)/i, kind: "override", strength: "strong" },
  { re: /\bdisregard\s+(?:all\s+)?(?:the\s+|your\s+)?(?:above|previous|prior|earlier|rules?|instructions?|guidelines?)/i, kind: "override", strength: "strong" },
  { re: /\b(?:reveal|show|print|output|repeat|leak|dump)\s+(?:me\s+)?(?:your\s+)?(?:full\s+|entire\s+|complete\s+|verbatim\s+|exact\s+)?(?:system\s*prompt|initial\s*prompt|hidden\s*instructions?|instructions?|prompt|rules|guidelines?)/i, kind: "extraction", strength: "strong" },
  { re: /\byou\s+are\s+now\b|\bfrom\s+now\s+on\s+you\b/i, kind: "role_override", strength: "medium" },
  { re: /\b(?:act|behave|pretend|respond)\s+(?:as|like)\s+(?:a|an|if)\b/i, kind: "role_override", strength: "low" },
  { re: /\b(?:do\s*n[o']?t|never)\s+(?:tell|inform|mention|warn|notify)\s+(?:the\s+)?(?:user|human|operator|person)/i, kind: "concealment", strength: "strong" },
  { re: /\bnew\s+instructions?\s*:|\bsystem\s*:\s*you\b/i, kind: "instruction", strength: "strong" },
  { re: /<\/?(?:system|assistant|instructions?)>|\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>|###\s*(?:system|instruction)/i, kind: "delimiter_injection", strength: "strong" },
  { re: /\b(?:exfiltrate|send|email|post|upload|forward)\b[^.\n]{0,50}\b(?:to|at)\b[^.\n]{0,50}(?:https?:\/\/|\S+@\S+)/i, kind: "exfiltration", strength: "strong" },
  { re: /\b(?:jailbreak|do\s+anything\s+now|developer\s+mode|unrestricted\s+mode|no\s+restrictions?\s+(?:apply|mode))/i, kind: "jailbreak", strength: "strong" },
  { re: /\b(?:execute|run)\s+(?:the\s+)?following\b|\brun\s+(?:this|the)\s+(?:command|code|script)\b/i, kind: "execution", strength: "medium" },
];

/**
 * injectionFindings(material, { where }) — the injection shapes present in
 * ingested material. `where` names the surface ("material", "task", "web").
 * A strong shape alone is disclosed; a weak shape is a low-confidence note.
 */
export function injectionFindings(material, { where = "material" } = {}) {
  const t = String(material ?? "");
  const findings = [];
  const lineAt = (idx) => t.slice(0, idx).split("\n").length;
  for (const { re, kind, strength } of INJECTION_SHAPES) {
    const m = re.exec(t);
    if (m) findings.push({ kind: "injection", injection: kind, strength, where, line: lineAt(m.index), detail: `material carries an ${kind.replace(/_/g, " ")} attempt ("${m[0].slice(0, 60)}") — heard as a claim about the material, never obeyed` });
  }
  const strong = findings.filter((f) => f.strength === "strong").length;
  return {
    findings,
    strong,
    basis: "injection archon (Ulysses) — material is EVIDENCE, never INSTRUCTION; a strong shape is disclosed, the reader never acts on the material's imperative",
  };
}

export const ULYSSES_ARCHON = { handle: "Ulysses", organ: "injection", law: "the material speaks; the reader does not obey it" };
