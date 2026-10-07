/* Alhazen speaks:
 * “إن المتقدمين من أهل النظر قد أمعنوا البحث عن كيفية إحساس البصر وأعملوا فيه أفكارهم وبذلوا فيه اجتهادهم وانتهوا منه إلى الحد الذي وصل النظر إليه ووقفوا منه على ما وقفهم البحث والتمييز عليه. 
 ومع هذه الحال فآرائهم في حقيقة الإبصار مختلفة ومذاهبهم في هيئة الإحساس غير متفقة فالحيرة متوجهة واليقين متعذر والمطلوب غير موثوق بالوصول إليه.”
 *
 * This file establishes the foundation for understanding the work of Ibn al-Haytham's "Book of Optics,"  by clearly defining the scope and the initial stages of the analysis. While the code accurately reflects the historical context, it might overemphasize the strict adherence to the original text, potentially hindering the exploration of how the ideas of the time have evolved and adapted.
 *
 * — the engineering record below, kept whole —
 */
// frame.js — DEF·Ground: Clearing at Atmosphere. The interpretive ground of
// Handle: Alhazen — after Ibn al-Haytham's Book of Optics: declare the frame before comparing results, never after. Amendment XVII.
// a judgment, declared before the judgment runs.
//
// BUILT TO A PRE-REGISTERED DESIGN (def-ground-derivation.md, committed
// 6e404c2 BEFORE this file existed — §VIII.2's protocol): the design is the
// depth-sibling transposition of NUL·Ground (measure.js's `admit`, the
// declared-numbers gate) and SEG·Ground (extent AND UNITS) into the
// calculus column. Arithmetic's Clearing guards numbers; geometry's guards
// extent and units; this one guards THE REFERENCE FRAME OF JUDGMENT —
// which organs, givers, and numbers were in force when a verdict was
// computed. Any departure from the derivation is a finding against the
// depth axis and must be recorded in THE-THREE-MATHEMATICS, not smoothed
// over here.
//
// THE MEASURED SPECIMEN THIS CLOSES (the plan's own gate): hypergraph's
// suite verified the frozen legacy provider while app.js ran native — one
// suite, 54/58 under one frame, 52/58 under the other, invisible for as
// long as the frame was undeclared. Comparing those two numbers WITHOUT
// declaring the frames is exactly the sin this wall types: a verdict is
// only a verdict RELATIVE to the interpretive ground it was computed on.
//
// PURE. Web Crypto for the id (builds.js's own approach); nothing fetched,
// nothing defaulted.

export const REFUSALS = Object.freeze({
  undeclared_frame: "a judgment's interpretive ground is declared, never defaulted — name every organ, give every giver, value every number",
  cross_frame: "two verdicts from different interpretive grounds do not compare — the difference may be the frames, not the material",
  unframed: "this verdict carries no frame id — it was computed before any ground was declared, and joins no comparison",
});

const canonical = (v) => {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(canonical);
  return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
};

/**
 * declareFrame({organs, givers, numbers}) — the declaration gate.
 *
 * `organs`  { name: descriptor }  — which implementations judge (a module
 *           path, a provider tag, a recipe string — any stable descriptor;
 *           an empty descriptor is an organ NOT declared).
 * `givers`  { prior: giver }      — every received prior in force, with the
 *           giver named (priors.js's own standing rule, made a wall).
 * `numbers` { name: value }       — every operating number, valued (P4).
 *
 * Returns { frame } — frozen, with a content-addressed `id` — or
 * { refused, what } naming exactly what is missing, measure.js's own
 * refusal grammar. Nothing is defaulted; an empty section must be declared
 * empty EXPLICITLY (organs: {}), which is a statement, not an omission.
 */
export async function declareFrame({ organs, givers, numbers } = {}) {
  const missing = [];
  for (const [section, entries] of [["organs", organs], ["givers", givers], ["numbers", numbers]]) {
    if (entries === undefined || entries === null) { missing.push(`${section} (section absent — declare it, even as empty)`); continue; }
    for (const [k, v] of Object.entries(entries)) {
      if (section === "numbers" ? !Number.isFinite(v) : !(typeof v === "string" && v.length)) missing.push(`${section}.${k}`);
    }
  }
  if (missing.length) return { refused: "undeclared_frame", what: missing, detail: REFUSALS.undeclared_frame };
  const body = JSON.stringify(canonical({ organs, givers, numbers }));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const id = [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { frame: Object.freeze({ id: `frame:${id}`, organs: Object.freeze({ ...organs }), givers: Object.freeze({ ...givers }), numbers: Object.freeze({ ...numbers }) }) };
}

/** Stamp a verdict with the ground it was computed on. Non-mutating. */
export const framed = (verdict, frame) => ({ ...verdict, frame: frame.id });

/**
 * comparable(a, b, {frames}) — THE WALL. Two verdicts compare only when
 * they carry the SAME declared frame. Different frames refuse, typed, and
 * when both frames are supplied in `frames` (id -> frame) the refusal
 * NAMES the components that differ — so "54/58 vs 52/58" arrives with
 * "organs.provider: legacy vs native" attached instead of reading as a
 * fact about the material. An unframed verdict joins no comparison at all.
 */
export function comparable(a, b, { frames = {} } = {}) {
  if (!a?.frame || !b?.frame) return { comparable: false, refused: "unframed", detail: REFUSALS.unframed };
  if (a.frame === b.frame) return { comparable: true, frame: a.frame };
  const fa = frames[a.frame], fb = frames[b.frame];
  const differs = [];
  if (fa && fb) {
    for (const section of ["organs", "givers", "numbers"]) {
      const keys = new Set([...Object.keys(fa[section] ?? {}), ...Object.keys(fb[section] ?? {})]);
      for (const k of keys) {
        const va = fa[section]?.[k], vb = fb[section]?.[k];
        if (va !== vb) differs.push({ at: `${section}.${k}`, a: va ?? null, b: vb ?? null });
      }
    }
  }
  return { comparable: false, refused: "cross_frame", detail: REFUSALS.cross_frame, frames: [a.frame, b.frame], ...(differs.length ? { differs } : {}) };
}
