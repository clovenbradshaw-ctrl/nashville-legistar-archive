// fold-blocks-make.js — the fold's READING of an ask. There is no template and no
// menu of kinds. The model induces what the ask is (WHAT / SATISFY / NEEDS); the
// monologue shows that reading; the app checks the ONE thing it must refuse — an
// ask that needs a live source the fold does not have — and everything else is a
// thing to BUILD: ONE self-contained page, run, and corrected until it holds
// (the loop lives in fold-chat-folds.js: SYN → EVA(observe) → REC → NUL).
//
// The makers that poured asks into fixed shapes — the website plan (nav/hero/
// cards/form/footer), the widget plan (inputs + a catalog formula), the document
// plan (title + three sections) — are gone. A shape chosen from a menu is a
// template; the ask is the spec.

/** monologue(ask, reading) — the fold's INTERNAL THINKING, made visible. The
 *  reading is the model's own INDUCTION of what the ask is. The app checks only
 *  whether what it needs is a live source this fold does not have (then a typed
 *  gap). Everything else is a thing to build. Pure; returns
 *  { satisfiable, code, why, lines:[{say, why, bad}] }. */
export function monologue(ask, reading = null) {
  const q = String(ask || "").toLowerCase();
  const lines = [];
  lines.push({ say: `Reading the ask: “${String(ask).trim()}”.`, why: null });
  if (reading && (reading.what || reading.satisfy)) {
    if (reading.what) lines.push({ say: `I induce what it is: ${reading.what}`, why: null });
    if (reading.satisfy) lines.push({ say: `What would satisfy it: ${reading.satisfy}`, why: null });
    if (reading.needs) lines.push({ say: `What it needs: ${reading.needs}`, why: null });
  } else {
    lines.push({ say: `(no reading came back — I will build the most direct thing the words name.)`, why: null });
  }
  // THE GATE IS THE APP'S, NOT THE MOUTH'S. A small model over-claims its needs
  // ("a website about dolphins" -> "needs live data feeds, images, videos"), so
  // the reading's NEEDS is shown but never gates. The void opens only when the
  // ASK ITSELF is a request to SHOW external, live data this fold has no source for.
  const needsSource = /\b(show|shows|display|displays|list|lists|live|current|today'?s|latest)\b[^.]*\b(prices?|news|headlines|weather|scores?|schedule|stocks?|rates?|forecast|times?|hours|availability)\b/i.test(q);
  if (needsSource) {
    lines.push({ say: `This needs a live source this fold does not have. I will not fake it.`, bad: true });
    return { satisfiable: false, code: false, why: "it needs a live data source this fold does not have", lines };
  }
  lines.push({ say: `I will build ONE self-contained page for exactly what the words name, run it, and correct it until it holds — no template, no menu.`, why: null });
  return { satisfiable: true, code: true, why: null, lines };
}

export default { monologue };
