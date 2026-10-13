// fold-chat-require.js — THE ASK, FOLDED; THE PRODUCT, JOINED.
//
// EVA is a join, not a comprehension. Neither the ask nor the product is ever
// held whole by the model:
//
//   THE ASK folds into bounded SPANS (askSpans), each read LOCALLY into ATOMS
//   (atomsFrom). An atom carries the span it came from and is kept ONLY if it is
//   verbatim in that span — the anti-invention control is the machine checking
//   the model's atom against the address, not the model against its memory. So
//   the reading stays honest even when the ask is longer than the window.
//
//   THE PRODUCT is the build log's UNITS (createBuild/materialize) plus its
//   OBSERVABLE (the rendered control labels + text the sandbox reports).
//
//   THE JOIN is mechanical: a required atom the product does not show is a
//   finding; a span that yielded no atom is a NAMED GAP — the fold's own
//   ignorance, stated, never a silent pass.
//
// PURE: no clock, no random, no IO.

/** askSpans(ask, { max }) — the ask cut into bounded, ADDRESSABLE spans. A span
 *  is a sentence; a sentence longer than `max` is hard-wrapped so no single read
 *  can exceed a small window. Each span carries its byte offsets into the ask.
 *  Pure. */
export function askSpans(ask, { max = 400 } = {}) {
  const t = String(ask ?? "");
  const out = [];
  const re = /[^.!?\n]+[.!?]?/g;
  let m;
  while ((m = re.exec(t))) {
    const text = m[0];
    if (!text.trim()) continue;
    if (text.length <= max) { out.push({ text, start: m.index, end: m.index + text.length }); continue; }
    for (let i = 0; i < text.length; i += max) {
      const piece = text.slice(i, i + max);
      out.push({ text: piece, start: m.index + i, end: m.index + Math.min(i + max, text.length) });
    }
  }
  return out;
}

/** atomsFrom(out, span) — the atoms the model read out of ONE span, kept only if
 *  each is verbatim within that span (case-insensitive). One atom per line, or
 *  ';'-separated; "NONE"/"nothing" means the span requires nothing. Each atom is
 *  addressed to its span. Pure. */
export function atomsFrom(out, span) {
  const s = span || {};
  const hay = String(s.text ?? "").toLowerCase();
  const raw = String(out ?? "").split(/\r?\n|;/).map((x) => x.trim().replace(/^[-*•\s]+|["']$/g, "").trim());
  const atoms = [];
  for (const a of raw) {
    if (!a || /^(none|nothing)\b/i.test(a)) continue;
    if (!hay.includes(a.toLowerCase())) continue;                 // invented: not in the span
    if (atoms.some((x) => x.text.toLowerCase() === a.toLowerCase())) continue;
    atoms.push({ text: a, span: { start: s.start ?? null, end: s.end ?? null } });
  }
  return atoms;
}

/** missingAtoms(atoms, observation) — required atoms the product does NOT show:
 *  not in the rendered control labels and not in the rendered text. Pure. */
export function missingAtoms(atoms, observation) {
  const hay = [((observation && observation.labels) || []).join(" "), String((observation && observation.text) ?? "")].join(" ").toLowerCase();
  return (atoms || []).filter((a) => a && a.text && !hay.includes(String(a.text).toLowerCase()));
}

/** unreadSpans(spans, atoms) — spans that yielded NO atom: what the fold did not
 *  turn into a requirement. A NAMED GAP, never a silent pass. Pure. */
export function unreadSpans(spans, atoms) {
  const read = new Set((atoms || []).map((a) => `${a.span ? a.span.start : ""}:${a.span ? a.span.end : ""}`));
  return (spans || []).filter((s) => !read.has(`${s.start}:${s.end}`));
}

/** atomLine(atoms, { limit }) — a bounded list of the atoms, for a finding or a
 *  prompt. The JOIN never needs a whole document, only this handful. Pure. */
export function atomLine(atoms, { limit = 12 } = {}) {
  const list = (atoms || []).map((a) => a.text).slice(0, limit);
  return list.join(", ");
}

export default { askSpans, atomsFrom, missingAtoms, unreadSpans, atomLine };
