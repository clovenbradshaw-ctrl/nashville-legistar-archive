// event-arrangements.js — floor 2 for non-text media (Tier 4 #14's named
// remainder): ARRANGEMENTS ({end1, label, end2}) from an event stream,
// with addresses in the stream's own coordinates.
//
// The omnimodal work (music, video, turbulence, spatial) reached floor 1:
// event streams, discovered kinds, corroboration of kind-membership. What
// no non-text medium had was floor 2 — the earned-arrangement shape text's
// extractor produces, so a non-text observation could enter the
// hyperlexicon as an ordinary note and be witnessed like one. This is
// that adapter, and ONLY that: the mechanism is recurrence-gated
// adjacency, the label is the medium's own relation word DECLARED by the
// caller (a music caller says "precedes"; a caller with richer physics
// may say more — the label is a declaration, never derived here), and
// every arrangement carries SPANS in the stream's own coordinate space,
// self-verified (P5.2: the span's events, re-read, must BE the pair).
//
// COORDINATE SPACE, DECLARED NEVER MIXED (the b0/c0 law): addresses are
// `<ref>#e<i>-e<j>` — EVENT ORDINALS in the stream as given, not bytes,
// not seconds. A consumer converting to its medium's clock does so at its
// own boundary, exactly like byteCharIndex.
//
// PURE; floors declared (P4); the recurrence floor's giver is
// FORM_MIN_ARRIVALS' own structural argument (one arrival has no
// co-arrival to test — binding.js), reused not re-derived.

export const REFUSALS = Object.freeze({
  undeclared: "label and minRecurrence are the caller's (P4) — a relation word is a declaration about the medium, never derived from adjacency itself",
  no_events: "the stream carries no events",
});

/**
 * arrangementsFrom(stream, { ref, label, minRecurrence })
 * `stream` — [{text}] phrases (the omnimodal drivers' own shape) or one
 * flat array of event tokens.
 * Returns { arrangements, pairsSeen } — each arrangement
 * { end1, label, end2, count, spans: [{at, pair}] } with every span
 * self-verified against the stream before it ships.
 */
export function arrangementsFrom(stream, { ref = "stream", label, minRecurrence } = {}) {
  if (typeof label !== "string" || !label.length || !Number.isInteger(minRecurrence) || minRecurrence < 1)
    return { refused: "undeclared", detail: REFUSALS.undeclared };
  const phrases = Array.isArray(stream) && typeof stream[0] === "string"
    ? [{ text: stream.join(" ") }]
    : (stream ?? []);
  // one flat ordinal space across phrases, so a span survives re-slicing
  const events = [];
  const phraseBreaks = new Set();
  for (const p of phrases) {
    for (const tok of String(p?.text ?? p ?? "").split(/\s+/).filter(Boolean)) events.push(tok);
    phraseBreaks.add(events.length); // adjacency never crosses a phrase break
  }
  if (!events.length) return { refused: "no_events", detail: REFUSALS.no_events };

  const byPair = new Map();
  for (let i = 0; i + 1 < events.length; i++) {
    if (phraseBreaks.has(i + 1)) continue;
    const key = `${events[i]} ${events[i + 1]}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(i);
  }

  const arrangements = [];
  for (const [key, at] of byPair) {
    if (at.length < minRecurrence) continue;
    const [end1, end2] = key.split(" ");
    const spans = at.map((i) => {
      const address = `${ref}#e${i}-e${i + 2}`;
      // P5.2 — mandatory self-verification: the address, re-read, IS the pair
      const readBack = events.slice(i, i + 2);
      if (readBack[0] !== end1 || readBack[1] !== end2)
        throw new Error(`arrangementsFrom: span ${address} does not read back as its own pair — a broken address must never ship`);
      return { at: address, pair: readBack.join(" ") };
    });
    arrangements.push({ end1, label, end2, count: at.length, spans });
  }
  arrangements.sort((a, b) => b.count - a.count || a.end1.localeCompare(b.end1));
  return { arrangements, pairsSeen: byPair.size, events: events.length, coordinateSpace: "event-ordinals" };
}

/** Project arrangements into hyperlexicon-hearable assertions — the same
 *  shape kindNotes already lands, witness carrying the instrument (~recipe,
 *  P68) so two decoders of one performance stay one reading. */
export function arrangementNotes(arrangements, { witness, recipe } = {}) {
  if (!witness || !recipe) throw new Error("arrangementNotes: witness AND recipe are named — a non-text arrangement exists only through its decoder (the shared-instrument law)");
  return (arrangements ?? []).map((a) => ({
    subject: a.end1,
    verb: a.label,
    object: a.end2,
    witness: `${witness}~${recipe}`,
    spans: a.spans.map((s) => ({ at: s.at })), // hear() unions span OBJECTS by .at — bare strings are dropped silently (found by the e2e, not by review)
    because: `${a.label} at ${a.count} recurrence(s) in ${witness}`,
  }));
}
