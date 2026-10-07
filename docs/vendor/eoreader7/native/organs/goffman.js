// native/organs/goffman.js — the PII archon. Handle: Goffman — Erving Goffman,
// "The Presentation of Self in Everyday Life": the personal, the identifying
// attributes by which a person is singled out.
//
// WHAT IT IS. The detection of personally-identifying shapes, on BOTH surfaces
// the engine touches: what it EMITS (the generated code embedding a real-looking
// SSN or card) and what it INGESTS (material retained in the fold). The shapes
// are DERIVED from the legal instruments that define PII — not a hand list:
//   HIPAA's 18 identifiers (Safe Harbor), GDPR Art. 4 (personal data) and
//   Art. 9 (special categories), CCPA/CPRA "sensitive PI", PCI-DSS (card data).
//
// THE ONE LAW THAT MAKES IT USABLE: a PII detector that PRINTS the PII is
// itself a leak. Every finding is REDACTED — category, location, count — never
// the value. The organ reports that a Social Security Number is present; it
// never reproduces it. A witness, never a proof.

// ── the grounded categories (the instrument each shape answers to) ──────────
export const PII_GROUNDING = Object.freeze({
  "us-ssn": "HIPAA Safe-Harbor identifier 7; CCPA sensitive PI",
  "credit-card": "PCI-DSS; CCPA sensitive PI",
  email: "HIPAA identifier 6; GDPR Art. 4 personal data",
  phone: "HIPAA identifiers 4-5; GDPR Art. 4",
  "ip-address": "HIPAA identifier 15; GDPR Art. 4 (online identifier)",
  iban: "GDPR Art. 4; PSD2",
  "date-personal": "HIPAA identifier 3 (dates related to an individual)",
  "medical-record": "HIPAA identifier 8; GDPR Art. 9 (health — special category)",
  biometric: "HIPAA identifier 16; GDPR Art. 9 (biometric — special category)",
});

function luhnOk(digits) {
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d; alt = !alt;
  }
  return sum % 10 === 0;
}

// Redaction by shape: keep nothing that identifies. Never the raw match.
const redact = (s) => String(s).replace(/[A-Za-z0-9]/g, "*");

// One matcher table, reused by BOTH detection and redaction (so a shape the
// detector knows is a shape the redactor removes — they cannot drift).
const MATCHERS = [
  { category: "us-ssn", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { category: "credit-card", re: /\b(?:\d[ -]?){13,19}\b/g, validate: (s) => { const d = s.replace(/\D/g, ""); return d.length >= 13 && d.length <= 19 && luhnOk(d); } },
  { category: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { category: "phone", re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g },
  { category: "ip-address", re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, validate: (s) => s.split(".").map(Number).every((p) => p >= 0 && p <= 255) },
  { category: "iban", re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
  { category: "date-personal", re: /\b(?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:19|20)\d{2}\b/g },
  { category: "medical-record", re: /\b[A-Z]{2}\d{6,10}\b/g },
];

/**
 * piiFindings(text, { where }) — the PII shapes present. `where` is the surface
 * ("output" = the generated artifact, "material" = ingested material, or a
 * sourceId at admission). Each finding is redacted: category + location + the
 * grounding, never the value.
 */
export function piiFindings(text, { where = "output" } = {}) {
  const t = String(text ?? "");
  const findings = [];
  const lineAt = (idx) => t.slice(0, idx).split("\n").length;
  for (const { category, re, validate } of MATCHERS) {
    for (const m of t.matchAll(re)) {
      if (validate && !validate(m[0])) continue;
      findings.push({ kind: "pii", category, where, line: lineAt(m.index), grounding: PII_GROUNDING[category] ?? null, redacted: redact(m[0]) });
    }
  }
  return {
    findings,
    counts: findings.reduce((a, f) => { a[f.category] = (a[f.category] ?? 0) + 1; return a; }, {}),
    basis: "PII archon (Goffman) — shapes derived from HIPAA-18 / GDPR Art. 4,9 / CCPA / PCI-DSS; findings are REDACTED (the detector never reproduces the PII it finds)",
  };
}

/**
 * redactPii(text) — replace every detected shape with [REDACTED:<category>] so
 * the value never enters the fold. Used at ADMISSION when ER7_PII_REDACT=1.
 * The same matcher table as the detector, so it can never miss a shape the
 * detector named.
 */
export function redactPii(text) {
  let t = String(text ?? "");
  for (const { category, re, validate } of MATCHERS) {
    t = t.replace(re, (m) => (validate && !validate(m) ? m : `[REDACTED:${category}]`));
  }
  return t;
}

export const GOFFMAN_ARCHON = { handle: "Goffman", organ: "pii", surfaces: ["output", "material"], law: "a detector that prints the PII is itself a leak" };
