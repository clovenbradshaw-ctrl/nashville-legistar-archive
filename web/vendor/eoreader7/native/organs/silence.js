// organs/silence.js — THE SILENCE REPORT: what a reader saw and did not read.
//
// Fold invariant: AN ADAPTER THAT SILENTLY SKIPS IS INDISTINGUISHABLE FROM A SOURCE THAT SAYS NOTHING.
// This is what tells them apart, and it is the TRIGGER for hard reading (organs/hard-read.js): nothing
// is escalated unless something was seen and not read. Pure; medium-blind over text.

/** unreadMentions({ texts, anchor, items, window }) -> [{ doc, at, quote }]
 *  THE SILENCE REPORT. `anchor` is a regex the person writes for what they are
 *  looking for (e.g. the symbol of a quantity). Every place it occurs with NO
 *  extracted item starting within `window` characters after it is returned:
 *  seen, not read. An adapter that silently skips is indistinguishable from a
 *  source that says nothing — this is what tells them apart. */
export function unreadMentions({ texts, anchor, items = [], window = 80 }) {
  const spans = items.flatMap((i) => i.spans ?? []);
  const out = [];
  for (const t of texts) {
    const re = new RegExp(anchor.source, anchor.flags.includes("g") ? anchor.flags : anchor.flags + "g");
    const hits = [];
    let m;
    while ((m = re.exec(t.text))) { if (m[0] === "") { re.lastIndex++; continue; } hits.push([m.index, m.index + m[0].length]); }
    hits.forEach(([b0, b1], k) => {
      // an item reads THIS mention only if it starts before the next mention —
      // otherwise a later value in the same sentence would be credited to it
      const limit = Math.min(b1 + window, hits[k + 1]?.[0] ?? Infinity);
      const read = spans.some(([doc, s0]) => doc === t.name && s0 >= b0 - 1 && s0 < limit);
      if (!read) out.push({ doc: t.name, at: [b0, b1], quote: t.text.slice(b0, Math.min(t.text.length, b1 + window)) });
    });
  }
  return out;
}
