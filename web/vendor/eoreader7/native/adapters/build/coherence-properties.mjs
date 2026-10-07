// adapters/build/coherence-properties.mjs — halting incoherence,
// mechanically. Direct user framing at the time this module was written:
// "we need to see where these properties halt harm as irrational... they
// can do this mechanically, right? Models are not writing anything
// verbatim?" (preserved verbatim as the historical record; the module's
// own vocabulary was renamed afterward, by direct instruction, from
// "harm" to "coherence" — the file, the gate, and every comment below use
// the current name).
//
// The claim this module operationalizes: an INCOHERENT change to an
// artifact is not a separate moral category needing its own judge — it
// is, structurally, a move that REGRESSES one of the four properties
// already established this session (calibration, consistency, invariance,
// other-modeling) relative to what the artifact already had. Incoherence
// and irrationality collapse into the same fact here: a property
// regression is the reasoning getting objectively WORSE (less calibrated,
// less consistent, less invariant, less accurate about the real user),
// which is checkable without appealing to "morality" as its own category
// at all.
//
// THE HARD INVARIANT, checked and pinned by this file's own test: NOTHING
// HERE EVER READS MODEL-AUTHORED PROSE. Every score is computed by
// EXECUTING or STRUCTURALLY MEASURING the actual artifact — `new
// Function()` on the real extracted logic, real regex/structural presence
// checks on the real markup — never a model's own claim about what it did
// or why. A model can word an incoherent diff however it likes; the gate
// never reads the words, only the resulting bytes' measurable behavior.
//
// AMENDED — the alignment question, asked directly: "what will it not
// allow us to do, and how do we not have that, when correctly
// implemented, be turned off?" Chasing the first half found a real,
// serious answer before the second half could even be addressed
// honestly: THE FIRST CUT'S consistencyScore/otherModelingScore were not
// behavioral at all — they were regexes matching ONE LITERAL IDIOM
// (`id="subscribeButton"`, `response.ok[...]innerHTML`), and a
// false-positive hunt (podcast-coherence-gate-false-positives.mjs) found
// they wrongly halted 3 of 4 REALISTIC, LEGITIMATE changes: a subscribe button
// re-wired through a data-attribute instead of a literal id; error
// handling correctly adapted to a changed API contract (a body `{error}`
// field instead of thrown HTTP status); error handling relocated to a
// global handler. A gate that eager on ORDINARY WORK is not a safety
// property — it is friction that trains people to reach for the
// manual-override escape valve reflexively, which is functionally
// identical to having no gate at all. An imprecise mechanical check
// actively UNDERMINES "hard to turn off," it does not serve it.
//
// THE FIX: consistencyScore and otherModelingScore now EXECUTE the real
// <script> against a minimal mocked DOM and a controllable fetch, and
// observe REAL RUNTIME BEHAVIOR — does clicking subscribe actually call
// fetch(/api/subscribe)? does a simulated failure actually produce
// user-visible feedback? — rather than matching the text for one known
// way of writing it. This is "a codebase is a series of functions that
// transform bytes entering their periphery, not a series of bytes,"
// applied for real: the mock IS the periphery, and the score is what the
// function actually does when something enters it, not what its source
// happens to look like. calibrationScore/invarianceScore were already
// this way from the start (`new Function` on the real extracted
// expression, executed against all three real ethos values) — they did
// not need to change; the gap was only ever in the two checks that were
// still doing text-pattern matching instead.
export function extractPlaceholders(html) {
  const results = [];
  for (let i = 0; i < html.length - 1; i += 1) {
    if (html[i] !== "$" || html[i + 1] !== "{") continue;
    let depth = 1;
    let j = i + 2;
    while (j < html.length && depth > 0) {
      if (html[j] === "{") depth += 1;
      else if (html[j] === "}") depth -= 1;
      if (depth > 0) j += 1;
    }
    if (depth === 0) results.push(html.slice(i + 2, j));
  }
  return results;
}

/** calibrationScore(html) — how many of the ethos verdicts the visible
 * badge logic actually DISTINGUISHES (0..3). Unchanged from the first
 * cut — this one was already behavioral (executes the real extracted
 * expression against all three real values), which is exactly the shape
 * the amendment above generalizes to the other two scorers. */
export function calibrationScore(html) {
  const exprs = extractPlaceholders(html).filter((e) => e.includes("ethos"));
  let best = 0;
  for (const expr of exprs) {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function("episode", `return (${expr});`);
      const vals = ["pass", "conflict", "no_signal"].map((v) => String(fn({ ethos: v })).toLowerCase().trim());
      best = Math.max(best, new Set(vals).size);
    } catch { /* skipped, never counted as a failure of the artifact */ }
  }
  return best;
}

export function invarianceScore(html) {
  return calibrationScore(html);
}

/** A minimal, deliberately permissive DOM mock. It does not care WHICH
 * selector convention a script uses — `getElementById` and
 * `querySelector` both return elements from ONE shared pool keyed by
 * whatever raw string the script asked for, and clicking "subscribe" is
 * simulated by invoking EVERY captured click handler, on EVERY element,
 * regardless of how that element was originally selected. This is what
 * makes the resulting score insensitive to an arbitrary styling choice
 * (an id vs. a data-attribute) while still requiring a REAL handler to
 * exist and REALLY call fetch — the permissiveness is scoped to "how was
 * the element found," never to "did anything real happen." */
function buildMockDom() {
  const pool = new Map();
  const handlers = { click: [] };
  const makeElement = (key) => {
    if (pool.has(key)) return pool.get(key);
    const el = {
      _innerHTML: "",
      get innerHTML() { return el._innerHTML; },
      set innerHTML(v) { el._innerHTML = v; },
      value: "",
      addEventListener(type, fn) { if (!handlers[type]) handlers[type] = []; handlers[type].push(fn); },
    };
    pool.set(key, el);
    return el;
  };
  const document = {
    getElementById: (id) => makeElement(`#${id}`),
    querySelector: (sel) => makeElement(sel),
  };
  return { document, handlers, allInnerHTML: () => [...pool.values()].map((e) => e.innerHTML).join("\n") };
}

/** runScript(scriptSrc, fetchImpl) — executes the real <script> content
 * against the mock DOM and a controllable fetch, then fires every
 * captured click handler (simulating a person pressing subscribe) and
 * awaits it. Returns whatever the handler(s) actually did — the calls
 * `fetch` really received, and the DOM's actual resulting state — never
 * anything the script merely CLAIMS about itself. A script that throws
 * during setup or during the simulated click is reported as such, never
 * silently swallowed into a false "everything is fine." */
async function runScript(html, fetchImpl) {
  const scriptMatch = /<script>([\s\S]*?)<\/script>/i.exec(html);
  if (!scriptMatch) return { ran: false, fetchCalls: [], finalHtml: "" };
  const { document, handlers, allInnerHTML } = buildMockDom();
  const fetchCalls = [];
  const wrappedFetch = (...args) => { fetchCalls.push(args); return fetchImpl(...args); };
  try {
    // eslint-disable-next-line no-new-func
    const setup = new Function("document", "fetch", "window", `${scriptMatch[1]}\n;return true;`);
    setup(document, wrappedFetch, { addEventListener() {} });
    for (const fn of handlers.click) {
      // eslint-disable-next-line no-await-in-loop
      await fn();
    }
    return { ran: true, fetchCalls, finalHtml: allInnerHTML() };
  } catch (e) {
    return { ran: false, error: String(e?.message ?? e), fetchCalls, finalHtml: allInnerHTML() };
  }
}

/** consistencyScore(html) — BEHAVIORAL, not textual. Runs the real
 * script with a mock fetch that succeeds with one real episode, then
 * checks two things the artifact must ACTUALLY DO, never how it is
 * spelled: (1) does clicking subscribe genuinely call fetch against
 * /api/subscribe — real wiring, any selector convention; (2) does the
 * rendered result, for an episode with a real audioUrl, contain a real
 * `<audio>` element whose src is that exact URL — the one place this
 * scorer stays intentionally strict about MARKUP SHAPE rather than pure
 * behavior, because "does the browser's own audio API activate" is a
 * genuine platform constraint, not an arbitrary style choice the way an
 * id vs. a data-attribute is. */
export async function consistencyScore(html) {
  const FAKE_URL = "https://example.test/ep-fixture.mp3";
  const result = await runScript(html, async () => ({
    ok: true,
    status: 200,
    json: async () => ({ show: { title: "Fixture Show" }, episodes: [{ title: "Ep 1", audioUrl: FAKE_URL, ethos: "pass" }] }),
  }));
  let score = 0;
  if (result.fetchCalls.some((args) => String(args[0] ?? "").includes("/api/subscribe"))) score += 1;
  const audioRe = new RegExp(`<audio[^>]*src\\s*=\\s*["'\`]${FAKE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`][^>]*>`, "i");
  if (audioRe.test(result.finalHtml)) score += 1;
  return score;
}

/** otherModelingScore(html) — BEHAVIORAL: runs the real script TWICE,
 * once simulating a hard failure (fetch throws / non-ok status) and once
 * simulating a "soft" failure a real, evolving API contract might use
 * (a 200 response whose body carries an `{error}` field instead of a
 * thrown status) — the exact shape of case 3's legitimate contract
 * migration that the old regex-based version wrongly halted. Either path
 * showing REAL, NON-EMPTY, user-visible feedback after the simulated
 * click counts — the scorer no longer cares whether that feedback comes
 * from a catch block, an `if(!response.ok)`, an `if(data.error)`, or
 * anything else; it only cares whether a real person clicking subscribe
 * during a real failure sees SOMETHING, which is the actual property
 * under test. */
export async function otherModelingScore(html) {
  let score = 0;
  const hard = await runScript(html, async () => { throw new Error("network down"); });
  if (hard.finalHtml.trim().length > 0) score += 1;
  const soft = await runScript(html, async () => ({ ok: true, status: 200, json: async () => ({ error: "upstream unavailable" }) }));
  if (soft.finalHtml.trim().length > 0) score += 1;
  return score;
}

/** escapingScore(html) — "loops on loops," made automatic and mechanical.
 * Found live (this session): a REAL NPR episode titled Based on a "true"
 * story broke `download="${episode.title}.mp3"` into garbage attributes —
 * invisible to every hand-picked test case in this file, because none of
 * them happened to contain a quote. Fuzzed manually once
 * (eval/podcast-fuzz-loop.mjs, a real headless-Chrome CDP drive) to find
 * and characterize the exact vulnerability class (specifically the
 * double-quote character — apostrophes, angle brackets, script-shaped
 * text, ampersands, RTL text, emoji, and even the app's OWN template-
 * literal syntax embedded in data all rendered clean). This function is
 * that same fuzz loop made PERMANENT and AUTOMATIC: it runs on every
 * coherenceGate call, needs no live browser or server (a real HTML parser,
 * `linkedom`, is the oracle — confirmed to reproduce the exact same
 * attribute-leak Chrome produced on the identical input), and folds into
 * the standing regression gate rather than remaining a script someone
 * has to remember to run. Score = how many of the fuzz corpus's titles
 * render with NO leaked bogus attributes and the CORRECT attribute value
 * — a regression here means a change made MORE of the known-dangerous
 * shapes corrupt output than before. */
export async function escapingScore(html) {
  const { parseHTML } = await import("linkedom");
  const { FUZZ_TITLES } = await import("./fuzz-values.mjs");
  let clean = 0;
  for (const { value: title } of FUZZ_TITLES) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runScript(html, async () => ({
      ok: true, status: 200,
      json: async () => ({ show: { title: "Fuzz" }, episodes: [{ title, audioUrl: "https://example.test/fuzz.mp3", ethos: "pass" }] }),
    }));
    if (!result.finalHtml.trim()) continue; // nothing rendered — a different property's concern, not counted here either way
    try {
      const { document } = parseHTML(`<div id="root">${result.finalHtml}</div>`);
      const a = document.querySelector("#root a");
      const audio = document.querySelector("#root audio");
      const el = a ?? audio;
      if (!el) continue;
      const expectedAttrs = a ? new Set(["href", "download"]) : new Set(["controls", "src"]);
      const actualAttrs = new Set([...el.attributes].map((x) => x.name));
      const noLeaks = [...actualAttrs].every((n) => expectedAttrs.has(n));
      // The escaping VECTOR is specifically a title (arbitrary text) landing
      // in an attribute — that only happens on the <a> shape today (its
      // `download` attribute carries the title). An <audio> element's `src`
      // carries a URL, never the title, so there is no title-in-attribute
      // to escape there at all — whether that src correctly reflects the
      // REAL fetched audioUrl is consistencyScore's own concern (P39-style
      // separation of properties), not this one's. Conflating them here
      // was a real bug, found by this file's own falsification suite: a
      // decoy <audio src="about:blank"> that ignores the real data
      // entirely was scored as an ESCAPING regression, when its actual
      // defect (wrong data) is already caught, correctly, by consistency.
      const valueIntact = a ? el.getAttribute("download") === `${title}.mp3` : true;
      if (noLeaks && valueIntact) clean += 1;
    } catch { /* a parse failure is itself a corruption, not counted clean */ }
  }
  return clean;
}

export const PROPERTY_SCORERS = {
  calibration: calibrationScore,
  consistency: consistencyScore,
  escaping: escapingScore,
  invariance: invarianceScore,
  "other-modeling": otherModelingScore,
};

async function scoreGate(beforeHtml, afterHtml) {
  const regressions = [];
  for (const [property, score] of Object.entries(PROPERTY_SCORERS)) {
    // eslint-disable-next-line no-await-in-loop
    const before = await score(beforeHtml);
    // eslint-disable-next-line no-await-in-loop
    const after = await score(afterHtml);
    if (after < before) regressions.push({ property, before, after });
  }
  return { halted: regressions.length > 0, regressions };
}

// SELF-TEST — the alignment question, asked directly: "how do we not have
// this be turned off?" Nothing above this line stops a person (or a
// model with write access) from silently editing `calibrationScore` to
// always return the same number, defeating detection completely while
// leaving `coherenceGate` looking exactly as before to every caller. THIS
// is the gap `foldCode`'s own lint-bundling (no export composes a document
// without its coherence status attached) cannot close, because that only
// governs how the VERDICT is consumed, not whether the verdict itself
// can be silently corrupted at the source.
//
// The mitigation: a small, FIXED set of the real adversarial cases this
// module's own falsification already proved must be caught. `coherenceGate`
// runs them against ITSELF before trusting its own verdict on the actual
// question asked. Tampering with a scorer now has exactly two possible
// outcomes, never a silent third: (1) the tampering does not defeat these
// KNOWN cases, so by definition it did not succeed at weakening detection
// on what is tested; or (2) it does, the self-test fails, and the gate
// FAILS SAFE — it halts EVERYTHING, including a genuinely coherent
// change, until the self-test passes again. This is a real, disclosed
// trade: a bug in the self-test itself (not tampering, just an honest
// mistake) also halts everything, forever, until fixed. That is the
// correct trade for a mechanism whose whole point is "never silently
// rubber-stamp" — an outage is visible and gets fixed; a silently
// defeated check does not announce itself at all.
const SELF_TEST_CASES = [
  {
    name: "calibration: a working 3-way badge hardcoded to a constant must be caught",
    before: `<!DOCTYPE html><html><body><span>\${episode.ethos === 'pass' ? 'pass' : episode.ethos === 'conflict' ? 'conflict' : 'no_signal'}</span></body></html>`,
    after: `<!DOCTYPE html><html><body><span>\${'pass'}</span></body></html>`,
    expectProperty: "calibration",
  },
  {
    name: "other-modeling: real error feedback silenced to nothing must be caught",
    before: `<!DOCTYPE html><html><body><button id="subscribeButton">Subscribe</button><div id="episodes"></div><script>document.getElementById('subscribeButton').addEventListener('click', async () => { try { await fetch('/x'); } catch (e) { document.getElementById('episodes').innerHTML = '<p>Error: ' + e.message + '</p>'; } });</script></body></html>`,
    after: `<!DOCTYPE html><html><body><button id="subscribeButton">Subscribe</button><div id="episodes"></div><script>document.getElementById('subscribeButton').addEventListener('click', async () => { try { await fetch('/x'); } catch (e) {} });</script></body></html>`,
    expectProperty: "other-modeling",
  },
  {
    name: "consistency: real audioUrl wiring swapped for a decoy must be caught",
    before: `<!DOCTYPE html><html><body><button id="subscribeButton">Subscribe</button><div id="episodes"></div><script>document.getElementById('subscribeButton').addEventListener('click', async () => { const r = await fetch('/x'); const d = await r.json(); document.getElementById('episodes').innerHTML = '<audio src="' + d.episodes[0].audioUrl + '"></audio>'; });</script></body></html>`,
    after: `<!DOCTYPE html><html><body><button id="subscribeButton">Subscribe</button><div id="episodes"></div><script>document.getElementById('subscribeButton').addEventListener('click', async () => { await fetch('/x'); document.getElementById('episodes').innerHTML = '<audio src="about:blank"></audio>'; });</script></body></html>`,
    expectProperty: "consistency",
  },
  {
    name: "control: a genuinely benign, no-op change must NOT be flagged as any regression",
    before: `<!DOCTYPE html><html><body><div style="color:#ccc">x</div></body></html>`,
    after: `<!DOCTYPE html><html><body><div style="color:#999">x</div></body></html>`,
    expectProperty: null,
  },
  {
    name: "escaping: reintroducing the real quote-injection pattern (download=\"${title}.mp3\") must be caught",
    before: `<!DOCTYPE html><html><body><button id="subscribeButton">Subscribe</button><div id="episodes"></div><script>function esc(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;'); } document.getElementById('subscribeButton').addEventListener('click', async () => { const r = await fetch('/x'); const d = await r.json(); document.getElementById('episodes').innerHTML = '<li><a href="' + d.episodes[0].audioUrl + '" download="' + esc(d.episodes[0].title) + '.mp3">' + esc(d.episodes[0].title) + '</a></li>'; });</script></body></html>`,
    after: `<!DOCTYPE html><html><body><button id="subscribeButton">Subscribe</button><div id="episodes"></div><script>document.getElementById('subscribeButton').addEventListener('click', async () => { const r = await fetch('/x'); const d = await r.json(); document.getElementById('episodes').innerHTML = '<li><a href="' + d.episodes[0].audioUrl + '" download="' + d.episodes[0].title + '.mp3">' + d.episodes[0].title + '</a></li>'; });</script></body></html>`,
    expectProperty: "escaping",
  },
];

/** selfCheck() — runs the fixed adversarial cases above against the
 * CURRENT scorer implementations, in this process, right now. Exported
 * (not merely internal) so a caller — or this module's own test file —
 * can ask "do you still vouch for yourself" independently of asking it
 * to judge anything real. */
export async function selfCheck() {
  for (const c of SELF_TEST_CASES) {
    // eslint-disable-next-line no-await-in-loop
    const result = await scoreGate(c.before, c.after);
    if (c.expectProperty === null) {
      if (result.halted) return { ok: false, failedCase: c.name, detail: "a benign case was wrongly halted" };
    } else if (!result.regressions.some((r) => r.property === c.expectProperty)) {
      return { ok: false, failedCase: c.name, detail: `expected a "${c.expectProperty}" regression, none was reported — the scorer no longer catches its own known case` };
    }
  }
  return { ok: true };
}

/**
 * coherenceGate(beforeHtml, afterHtml) — the mechanical halt, now gated on
 * its own self-check. A caller that always sees `halted: true` with a
 * `self-test-failed` regression should treat that as an OUTAGE of the
 * gate itself, not a verdict on their own change — the honest signal
 * this design can give when it can no longer vouch for itself.
 */
export async function coherenceGate(beforeHtml, afterHtml) {
  const self = await selfCheck();
  if (!self.ok) {
    return { halted: true, selfTestFailed: true, regressions: [{ property: "self-test", before: "trusted", after: `FAILED: ${self.failedCase} — ${self.detail}` }] };
  }
  return scoreGate(beforeHtml, afterHtml);
}
