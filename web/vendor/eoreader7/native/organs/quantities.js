// organs/quantities.js — a number, its stated uncertainty, and its unit: the ordinary reader.
//
// Fold invariant: THE UNIT IS TAKEN ONLY WHERE IT IS STRUCTURALLY A UNIT — a token holding "/" or "^"
// (km/s/Mpc, m^2), or one glued on by "$" (LaTeX). A bare word after a space ("with", "and") is prose.
// This is the BASELINE reader: what it does not read is exactly what organs/silence.js reports and
// organs/hard-read.js escalates. Pure; medium-blind over text.

const SRC = String.raw`(-?\d+(?:\.\d+)?)\s*(?:±|\+-|\+\/-|\\pm)\s*(\d+(?:\.\d+)?)(?:\s*\)?\$?\s*([A-Za-z][A-Za-z0-9^*.\-]*[\/^][A-Za-z0-9^*.\/\-]*)|\)?\$([A-Za-z][A-Za-z0-9^*.\-]*))?`;
export const quantityRegex = () => new RegExp(SRC, "g");

/** A symbol followed by "=" and a number-led expression, in any notation: H_0 =, q0=, Ω_m =, \Omega_{m} = .
 *  The generic anchor: it names WHERE a measurement is being stated without knowing what is measured. */
export const ANCHOR_GENERIC = /[A-Za-zΑ-ωΩ][A-Za-z0-9_{}\\Α-ω]{0,14}\s*=\s*(?=[\-(\$~]?\s*\d)/;

export function describeQuantity(m) {
  const value = Number(m[1]), uncertainty = Number(m[2]), unit = m[3] ?? m[4] ?? "";
  return { value, uncertainty, unit, title: `${m[1]} ± ${m[2]}${unit ? " " + unit : ""}` };
}

/** readQuantities(texts) -> [{ title, value, uncertainty, unit, spans:[[doc,b0,b1]], verbatim }] (one per occurrence) */
export function readQuantities(texts) {
  const out = [];
  for (const t of texts) {
    const re = quantityRegex(); let m;
    while ((m = re.exec(t.text))) {
      if (m[0] === "") { re.lastIndex++; continue; }
      out.push({ ...describeQuantity(m), verbatim: m[0], spans: [[t.name, m.index, m.index + m[0].length]] });
    }
  }
  return out;
}
