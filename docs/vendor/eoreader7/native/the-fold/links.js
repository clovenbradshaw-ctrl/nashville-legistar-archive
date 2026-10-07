// links.js — a cited URL is checked before it is asserted, never taken on
// its own word.
//
// The class of fabrication this organ exists for mirrors quotes.js exactly,
// one register over: a URL in an answer is the strongest kind of claim
// about the WORLD an answer can make — "this address is real, go look" —
// and the one claim local material containment cannot judge by itself (P11
// can confirm a URL's BYTES appear in what was read; it cannot confirm the
// address exists). Verdicts, mirroring quotes.js's own shape:
//
//   in-material — the literal address is in the loaded material's own
//                 bytes: the model is citing something a source already
//                 printed, not asserting a new address on its own word. No
//                 network needed; this ground is free.
//   resolved    — fetched through the ONE recorded egress (P13) and read
//                 exactly as any other page is (`looksLikeChallenge`,
//                 `extractReadable`, in explore-server.mjs): a real,
//                 non-shell page answered.
//   unreachable — the fetch failed, answered outside 2xx, or held nothing
//                 readable. The address does not deliver what citing it as
//                 a source implies — a fabricated citation, mechanically
//                 caught. `stripDeadLinks` below never lets it ship as a
//                 plain, working-looking link.
//   challenge   — the host is real but answered a bot-challenge page; the
//                 address is not confirmed fabricated, but its content
//                 could not be confirmed either — disclosure only, the same
//                 posture web.js already gives a challenge page elsewhere.
//   unexamined  — no check ran (the standing web consent is off, or the
//                 turn's link budget was already spent). A gap, never
//                 silently treated as verified.
//
// THIS MODULE OWNS NO NETWORK — the web.js/proof.js discipline exactly:
// the caller fetches (through the one sanctioned egress) and hands the
// result in; this module only folds it into a verdict. Pure: no DOM, no
// IO, no model.

// ")" is deliberately NOT excluded here — Wikipedia's own disambiguation
// URLs carry one ("…Something_(disambiguation)"), and excluding it would
// truncate a real address into a different, nonexistent one before it was
// ever checked. trimUrlPunctuation (below) decides, by counting, whether a
// trailing ")" closes the URL's own path or the sentence's wrapping paren.
export const URL_RE = /\bhttps?:\/\/[^\s<>"'\]]+/g;

/** Per-part budget: automatic egress the instrument itself decides to make
 * (not a click the reader made) is bounded and the bound stays visible —
 * the same duty PROOF_TARGETS_PER_TURN names for proof-seeking (proof.js),
 * declared separately here because a part's own citations are a distinct
 * crossing with a distinct caller. */
export const LINK_CHECKS_PER_PART = 4;

/**
 * Trailing punctuation a sentence wraps around a URL is the sentence's,
 * never the address's — "see https://x.org/a." at a sentence's end, or a
 * parenthetical "(https://x.org/a)". A balanced paren pair the URL's own
 * path opened (Wikipedia URLs routinely carry one) is kept.
 */
export function trimUrlPunctuation(url) {
  let u = String(url ?? "");
  while (u.length) {
    const last = u[u.length - 1];
    if (last === ")") {
      const opens = (u.match(/\(/g) ?? []).length;
      const closes = (u.match(/\)/g) ?? []).length;
      if (closes <= opens) break;
      u = u.slice(0, -1);
      continue;
    }
    if (/[.,;:!?\]'"]/.test(last)) {
      u = u.slice(0, -1);
      continue;
    }
    break;
  }
  return u;
}

/** URL-shaped spans in `text`, offsets into the ORIGINAL string, trailing
 * sentence punctuation excluded from the token itself. */
export function extractLinkAtoms(text, absoluteStart = 0) {
  const atoms = [];
  const src = String(text ?? "");
  URL_RE.lastIndex = 0;
  let m;
  while ((m = URL_RE.exec(src)) !== null) {
    const trimmed = trimUrlPunctuation(m[0]);
    if (!trimmed) continue;
    atoms.push({ text: trimmed, start: absoluteStart + m.index, end: absoluteStart + m.index + trimmed.length });
  }
  return atoms;
}

/** Does any loaded passage's own bytes contain this literal address? Exact
 * containment — a URL is not natural language, so unlike wordSet/hasWord
 * there is no stemming and no fold beyond what the caller already passed
 * in as passage text. */
export function urlInMaterial(url, passages) {
  const needle = String(url ?? "");
  if (!needle) return false;
  return (passages ?? []).some((p) => typeof p?.text === "string" && p.text.includes(needle));
}

/**
 * One URL's verdict, from what was actually checked. `fetched` is the
 * ALREADY-FETCHED result the impure caller obtained through P13's egress —
 * `{ ok, status, textChars, title, challenge }` for a crossing that
 * completed, or `{ gap: { silence, detail } }` for one that failed outright
 * (network error, timeout, byte cap). `attempted` distinguishes "checked
 * and the fetch itself errored" from "never checked" — a URL this function
 * was not asked about is `unexamined`, never silently folded into
 * "unreachable".
 */
export function foldLinkVerdict({ inMaterial = false, attempted = false, fetched = null } = {}) {
  if (inMaterial) return { verdict: "in-material" };
  if (!attempted) return { verdict: "unexamined" };
  if (fetched?.gap) return { verdict: "unreachable", detail: fetched.gap.detail ?? fetched.gap.silence ?? "the fetch failed" };
  if (!fetched?.ok) return { verdict: "unreachable", detail: `answered ${fetched?.status ?? "no response"}` };
  if (fetched.challenge) return { verdict: "challenge", detail: "the host answered a bot-challenge page, not the article" };
  if (!(fetched.textChars > 0)) return { verdict: "unreachable", detail: "no readable text came back" };
  return { verdict: "resolved", title: fetched.title ?? null };
}

/**
 * Every URL in `text` folded to a verdict. `checked` is a Map<url, fetched>
 * the caller populates by fetching through the recorded egress BEFORE
 * calling this (the proof.js `foldProof` pattern) — a URL absent from the
 * map and not found in material is `unexamined`, never assumed checked.
 */
export function verifyLinks(text, passages, checked = new Map()) {
  const atoms = extractLinkAtoms(text);
  const links = atoms.map((a) => {
    const inMaterial = urlInMaterial(a.text, passages);
    const attempted = !inMaterial && checked.has(a.text);
    return { ...a, ...foldLinkVerdict({ inMaterial, attempted, fetched: attempted ? checked.get(a.text) : null }) };
  });
  return { examined: links.length > 0, links };
}

/** The findings for a record's unsupported list: cited URLs proven, by an
 * actual fetch through the recorded egress, not to deliver what citing them
 * implied — the fake-citation case. `challenge` and `unexamined` links are
 * NOT findings: neither one is evidence of fabrication, only of a check
 * that could not complete (P4: the instrument's own limits are disclosed,
 * never judged as if they were the answer's fault). */
export function linkFindings(report) {
  return (report?.links ?? [])
    .filter((l) => l.verdict === "unreachable")
    .map((l) => `cited link does not resolve: ${l.text} (${l.detail})`);
}

/**
 * Replace every unreachable link's text with a typed, visible marker,
 * right to left so earlier offsets stay valid. Idempotent by construction
 * (quotes.js's own requirement for a repair): the marker holds no bare URL,
 * so a second pass over the repaired text finds nothing left to strip. Only
 * `unreachable` is repaired — `challenge` and `unexamined` links are left
 * exactly as written, because leaving them is honest and stripping them
 * would assert a fabrication the check never established.
 */
export function stripDeadLinks(text, report) {
  let out = String(text ?? "");
  const removed = [];
  const dead = (report?.links ?? []).filter((l) => l.verdict === "unreachable").sort((a, b) => b.start - a.start);
  for (const l of dead) {
    const marker = `[link removed — did not resolve: ${l.text}]`;
    out = out.slice(0, l.start) + marker + out.slice(l.end);
    removed.push({ url: l.text, detail: l.detail });
  }
  return { text: out, removed };
}
