// organs/girard.js — MIMETIC PRIOR. Handle: René Girard — mimetic desire:
// "man is the creature who does not know what to desire, and he turns to
// others in order to make up his mind." A design choice asked for in a
// vacuum, with nothing real to imitate, is not creative freedom — it is
// exactly the failure mode measured live in this session: an isolated
// "make this stand out" ask returned an arbitrary red against an
// established Spotify-green accent, well-formed and genuinely different
// (it cleared its own contract) and tasteless anyway, because nothing was
// ever handed a MODEL to imitate.
//
// THIS ORGAN NEVER FETCHES A LIVE REFERENCE (by direct instruction: "we
// need this all done with local hardware"). Its evidence is extracted
// from REAL, ALREADY-BUILT design systems sitting on this machine's own
// disk — the-fold's own shared accent tokens (explore/explore.css,
// index.html) and heimdall's own, independently designed ones
// (src/style.css) — never a description of taste, always a real hex value
// read out of real committed CSS.
//
// THE MEASURED PATTERN, n=2 (disclosed exactly as that, not oversold as a
// law): both real, independently-built local systems vary their accent's
// EMPHASIS/DIM state by LIGHTNESS alone, staying within a few degrees of
// hue of the base accent —
//   the-fold:  --accent #6d28d9 -> --accent-soft #f3eeff, hue distance 5.7°
//   heimdall:  --accent #63d9a8 -> --accent-dim  #2a7a5e, hue distance 3.9°
// — never a second, unrelated hue. The model's own red departed the
// podcast app's established #1DB954 green by 141.2° of hue — nowhere near
// either real reference's own tolerance.
//
// PURE. No network, no filesystem access here — extraction from real CSS
// text is a pure function; a caller reads the files.

// A received closed class (W3C CSS Color Module Level 3's own keyword
// table), NOT invented here — the same "a received number is used
// verbatim" discipline priors.js already holds for every closed class.
// Deliberately a SMALL, disclosed subset (the keywords a small model
// plausibly produces), never claimed as the full 148-entry table.
export const NAMED_COLOR_HEX = Object.freeze({
  red: "#ff0000", orange: "#ffa500", yellow: "#ffff00", gold: "#ffd700",
  green: "#008000", lime: "#00ff00", teal: "#008080", cyan: "#00ffff",
  blue: "#0000ff", navy: "#000080", indigo: "#4b0082", purple: "#800080",
  violet: "#ee82ee", magenta: "#ff00ff", pink: "#ffc0cb", brown: "#a52a2a",
  black: "#000000", white: "#ffffff", gray: "#808080", grey: "#808080",
  silver: "#c0c0c0", crimson: "#dc143c", coral: "#ff7f50", salmon: "#fa8072",
  tomato: "#ff6347", chocolate: "#d2691e", tan: "#d2b48c", olive: "#808000",
});

/**
 * resolveToHex(value) -> "#rrggbb" or null. Handles a literal hex, an
 * rgb()/rgba() function, or a keyword from NAMED_COLOR_HEX above. A value
 * this cannot resolve (a CSS variable, an unknown keyword, a gradient)
 * returns null — a typed gap, never a guessed color.
 */
export function resolveToHex(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join("")}`;
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
  if (rgb) return `#${rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
  if (v in NAMED_COLOR_HEX) return NAMED_COLOR_HEX[v];
  return null;
}

/** hexToHsl("#rrggbb") -> { h (0-360), s, l }, standard conversion. */
export function hexToHsl(hex) {
  const clean = String(hex ?? "").replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) throw new TypeError(`girard: not a 6-digit hex color: ${JSON.stringify(hex)}`);
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

/** hslToHex(h, s, l) -> "#rrggbb", the inverse of hexToHsl. h in degrees, s/l in 0..1. */
export function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHexArr([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}
function toHexArr(arr) { return "#" + arr.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join(""); }

/**
 * stepLightness(hex, deltaPercent) -> a hex color with the SAME hue and
 * saturation, lightness shifted by `deltaPercent` (on HSL's own 0..100
 * scale). The mechanical half of the "elevation" convention: a real
 * surface color, one measured step lighter than a real background — see
 * ELEVATION_STEP below for the measurement this repair loop actually uses.
 */
export function stepLightness(hex, deltaPercent) {
  const { h, s, l } = hexToHsl(hex);
  const newL = Math.max(0, Math.min(1, l + deltaPercent / 100));
  return hslToHex(h, s, newL);
}

// MEASURED, n=2, exact agreement: both real, independently-built local
// design systems step their FIRST surface elevation above the page
// background by +2.7 points of HSL lightness (0-100 scale), same hue —
//   the-fold:  --bg #0f0f12 (L 6.5%) -> --panel #15151a (L 9.2%), +2.7
//   heimdall:  --bg #0b0e14 (L 6.1%) -> --bg-2  #10141d (L 8.8%), +2.7
// Disclosed as a literal citation (not a generalized extractor — a
// background/surface PAIR is a :root-block-level relationship, not a
// flat property scan the way accent/border-radius tokens are; building a
// real paired-token extractor is named, real, unattempted future work).
export const ELEVATION_STEP = { value: 2.7, giver: "organs/girard.js — the-fold (--bg/--panel) and heimdall (--bg/--bg-2), both measured at exactly +2.7 points of HSL lightness", basis: "an exact agreement between two independently-built local systems on the FIRST elevation step above the page background — the real convention a flat rectangle sitting on the page background is missing" };

/**
 * elevationRelationship(bgHex, surfaceHex, { relativeLuminance,
 * sameHueThreshold, achromaticThreshold }) -> { luminanceDelta,
 * readsBrighter, hueComparable, hueDistance, sameHue }. The paired-token
 * measurement this file's own ELEVATION_STEP comment names as unattempted.
 *
 * TWO REAL BUGS in an earlier draft of this function, caught by testing it
 * against real data rather than trusted from the math — kept here so the
 * next reader does not repeat either:
 *
 * (1) HSL "lightness" is NOT perceived brightness. Measured live:
 * #303030 (pure gray) and #402020 (a warm maroon) have IDENTICAL HSL
 * lightness (18.8% each — L is (max+min)/2, and 48 happens to equal
 * (64+32)/2) while their real WCAG relative luminance differs — #402020
 * reads DARKER (0.022 vs 0.030). A caller asking "does this surface look
 * elevated" must ask relative luminance (contrast.js's own already-
 * standing tool, injected here — cast.js's discipline, never a second
 * copy of that formula), never HSL L, or it will happily report a surface
 * that is measurably darker as "brighter."
 *
 * (2) An achromatic color's "hue" is a convention, not a measurement.
 * hexToHsl returns h=0 for any color with s=0 (pure gray) — the SAME
 * value red genuinely has. So #303030 (gray, s=0) and #402020 (real red,
 * s>0) compared BY HUE ALONE both read "0°, same hue" — a false positive
 * from comparing a real hue to an arbitrary placeholder. `hueComparable`
 * is false whenever either side's saturation sits at or below
 * `achromaticThreshold`; only when both sides are genuinely chromatic
 * does `sameHue` mean anything.
 */
export function elevationRelationship(bgHex, surfaceHex, { relativeLuminance, sameHueThreshold = 10, achromaticThreshold = 5 } = {}) {
  if (typeof relativeLuminance !== "function") throw new TypeError("elevationRelationship requires the injected relativeLuminance organ (contrast.js) — never a second luminance formula");
  const toRgb = (hex) => { const h = hex.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const bgHsl = hexToHsl(bgHex);
  const surfaceHsl = hexToHsl(surfaceHex);
  const luminanceDelta = Math.round((relativeLuminance(toRgb(surfaceHex)) - relativeLuminance(toRgb(bgHex))) * 10000) / 10000;
  const hueComparable = bgHsl.s * 100 > achromaticThreshold && surfaceHsl.s * 100 > achromaticThreshold;
  const hueDist = hueDistance(bgHex, surfaceHex);
  return {
    luminanceDelta,
    readsBrighter: luminanceDelta > 0,
    hueComparable,
    hueDistance: hueComparable ? Math.round(hueDist * 10) / 10 : null,
    sameHue: hueComparable ? hueDist <= sameHueThreshold : null,
  };
}

/** hueDistance(hexA, hexB) -> degrees, 0..180, the shorter way round the wheel. */
export function hueDistance(hexA, hexB) {
  const a = hexToHsl(hexA).h;
  const b = hexToHsl(hexB).h;
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * extractAccentTokens(cssText) -> [{ name, hex }] — every `--accent`-family
 * CSS custom property declared in real CSS text (accent, accent-soft,
 * accent-dim, accent2, ... — anything starting "--accent" and holding a
 * hex value). Pure text extraction; the caller supplies real file
 * contents, never a path or a network read.
 */
export function extractAccentTokens(cssText) {
  const out = [];
  const re = /--(accent[\w-]*)\s*:\s*(#[0-9a-fA-F]{6})\b/g;
  let m;
  while ((m = re.exec(String(cssText ?? "")))) out.push({ name: m[1], hex: m[2] });
  return out;
}

/**
 * mimeticFinding(references) -> a real, measured finding over real local
 * design systems. `references`: [{ giver, cssText }] — giver names the
 * real file/system (e.g. "the-fold/explore/explore.css"), cssText its
 * real committed CSS. For each reference with 2+ accent-family tokens,
 * measures the hue distance between the BASE accent and every other
 * accent-family token (its own emphasis/dim/soft variants). Reports the
 * measured maximum across all references — never invents a threshold; a
 * caller wanting a dial reads THIS number and states its own giver/basis
 * when declaring one (see checkMimicry).
 */
export function mimeticFinding(references) {
  const perReference = [];
  for (const { giver, cssText } of references ?? []) {
    const tokens = extractAccentTokens(cssText);
    const base = tokens.find((t) => t.name === "accent");
    if (!base || tokens.length < 2) { perReference.push({ giver, measured: false, detail: "fewer than 2 accent-family tokens found — nothing to measure" }); continue; }
    const distances = tokens.filter((t) => t.hex !== base.hex).map((t) => ({ name: t.name, hueDistance: Math.round(hueDistance(base.hex, t.hex) * 10) / 10 }));
    perReference.push({ giver, measured: true, base: base.hex, variants: distances, maxHueDistance: distances.length ? Math.max(...distances.map((d) => d.hueDistance)) : 0 });
  }
  const measuredRefs = perReference.filter((r) => r.measured);
  const maxAcrossAll = measuredRefs.length ? Math.max(...measuredRefs.map((r) => r.maxHueDistance)) : null;
  return {
    schema: "EOMimeticFinding@1",
    n: measuredRefs.length,
    perReference,
    maxHueDistanceObserved: maxAcrossAll,
    detail: measuredRefs.length
      ? `${measuredRefs.length} real local design system(s) measured — each varies its accent's emphasis/dim state by lightness alone, within ${maxAcrossAll}° of hue`
      : "no reference had 2+ accent-family tokens to measure",
  };
}

/**
 * extractNumericPxTokens(cssText, property, { excludeAtOrAbove }) -> [px,
 * ...] — every plain `property: Npx` value in real CSS text. A pill/
 * circle value (border-radius: 999px, 50%) is a DIFFERENT convention
 * ("fully rounded") from a card's corner radius, so `excludeAtOrAbove`
 * (default 50) drops it rather than letting one outlier drag a median
 * measured for rectangular cards toward "everything is a pill."
 */
export function extractNumericPxTokens(cssText, property, { excludeAtOrAbove = 50 } = {}) {
  const re = new RegExp(`(?<![\\w-])${property}\\s*:\\s*(\\d+(?:\\.\\d+)?)px\\b`, "g");
  const out = [];
  let m;
  while ((m = re.exec(String(cssText ?? "")))) {
    const v = Number(m[1]);
    if (v < excludeAtOrAbove) out.push(v);
  }
  return out;
}

/**
 * dominantConvention(references, property, opts) -> a real, measured
 * numeric convention (the MEDIAN observed value) for a CSS property
 * across real, already-built local design systems. `references`:
 * [{ giver, cssText }]. Never a threshold invented here — the caller
 * states its own giver/basis, typically citing this function's own
 * result (see mimeticFinding's own disclosure discipline).
 */
export function dominantConvention(references, property, opts) {
  const values = [];
  const perReference = [];
  for (const { giver, cssText } of references ?? []) {
    const vs = extractNumericPxTokens(cssText, property, opts);
    perReference.push({ giver, n: vs.length });
    values.push(...vs);
  }
  values.sort((a, b) => a - b);
  const n = values.length;
  const median = n ? (n % 2 ? values[(n - 1) / 2] : (values[n / 2 - 1] + values[n / 2]) / 2) : null;
  return {
    schema: "EODominantConvention@1",
    property,
    n,
    perReference,
    median,
    detail: n ? `${n} real declaration(s) of "${property}" across ${perReference.length} local design system(s) — median ${median}px` : `no real "${property}" declarations found`,
  };
}

/**
 * checkMimicry(proposedHex, establishedAccentHex, threshold) — the
 * computable contract THE-THEORY-OF-PATHOS.md's own "differentiate"
 * strategy was missing: a proposed emphasis color is MIMETIC (imitates a
 * real model — same hue family as the established accent) or ARBITRARY
 * (an unrelated hue, invented from nothing, exactly what produced the
 * tasteless red). `threshold` is a REGIME DIAL (organs/regime-dial.js
 * shape), never invented here — a caller states its own giver/basis,
 * typically citing mimeticFinding's own measured maxHueDistanceObserved.
 */
export function checkMimicry(proposedHex, establishedAccentHex, threshold) {
  if (!threshold || typeof threshold !== "object" || threshold.value === undefined || typeof threshold.giver !== "string" || !threshold.giver.trim() || typeof threshold.basis !== "string" || !threshold.basis.trim()) {
    throw new TypeError('girard: checkMimicry requires a regime dial { value, giver, basis } — a hue-distance floor with no giver and no stated basis is an invented rule, the same "practitioner heuristic, no empirical support" class this whole team refuses to manufacture');
  }
  const distance = Math.round(hueDistance(proposedHex, establishedAccentHex) * 10) / 10;
  const mimetic = distance <= threshold.value;
  return {
    schema: "EOMimicryCheck@1",
    proposed: proposedHex,
    establishedAccent: establishedAccentHex,
    hueDistance: distance,
    thresholdGiver: threshold.giver,
    thresholdBasis: threshold.basis,
    mimetic,
    detail: mimetic
      ? `imitates the established accent — ${distance}° of hue, within the declared ${threshold.value}° floor`
      : `arbitrary — ${distance}° of hue from the established accent, invented from nothing rather than imitating it (declared floor: ${threshold.value}°)`,
  };
}
