// organs/screen-style.js — a screenshot as a STYLE REFERENCE for generation.
//
// "What the page looks like is not the engine's to invent by hand" (organs/part-source.js). Until now the
// page build's look came from a snipped classless stylesheet or the engine's fallback. A screenshot the
// person handed in is a better reference than either — it is the look they asked for — and the sidecar
// (adapters/image/screen-sidecar.js) has already measured it: colours, radii, type, spacing.
//
// THE PATH, all of it measured, none of it generated:
//
//   sidecars -> reference-fit      each screenshot is one signed REFERENCE (INS); its measured colours are SIG'd
//                                  per property; SYN composes them — DERIVED when references agree, CONTESTED
//                                  when they do not. A contested colour is REFUSED, never averaged into a value
//                                  nobody measured (reference-fit's own rule, and Girard's: imitate a real model,
//                                  do not invent).
//   numbers -> median              lengths are the median of each reference's own median, pooled, with how many
//                                  observations stand behind it, and are written in ems of the measured body text:
//                                  a screenshot's pixel density is a guess, its proportions are not.
//   -> CSS                         a stylesheet for the elements belief-page.js actually emits, where every value
//                                  is a measured token and every token that was not measured (or rests on a
//                                  single observation) is OMITTED and named in `refused` — never defaulted.
//
// A SINGLE OBSERVATION CANNOT CORROBORATE ITSELF. MIN_WITNESSES is the structural floor binding.js already
// holds ("one arrival has no co-arrival to test"): a heading size read off one OCR fragment, an accent read
// off one fill, is a witness, not a convention. The measured case that put this here: Pocket Casts' screenshot
// yields an "h1" of 228 px from a single fragment and an accent (#ec0000) from one image region; both are
// refused, and the page is styled from what stands on two or more.
//
// Pure. The caller supplies sidecars and (optionally) the log; nothing here reads a file or calls a model.

import { createTaskLog } from "../kernel/task-log.js";
import { proposeReference, signMeasurement, bindCorrespondence, synthesizeCandidate } from "./reference-fit.js";
import { contrastRatio } from "./contrast.js";
import { RENDERED_ELEMENTS } from "../adapters/build/belief-page.js";

export const SCREEN_STYLE_SCHEMA = "ScreenStyle@1";
/** The fewest observations a token may rest on to style anything. */
export const MIN_WITNESSES = { value: 2, giver: "structural, the same floor binding.js holds: one arrival has no co-arrival to test", basis: "a measurement made once is one witness; it cannot agree with itself, so it is reported and not applied" };

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = (v) => Math.round(v * 10) / 10;
const refName = (sc) => `screen:${sc.source.sha256.slice(0, 12)}`;

/** Sign one sidecar into a reference-fit log as a reference, with each colour it measured as a SIG and a CON binding.
 *  The measured token's own observation count is carried on the reference's giver line, not invented. */
export function feedReferenceFit(log, sidecar) {
  const reference = refName(sidecar), t = sidecar.tokens;
  log = proposeReference(log, { name: reference, giver: `screenshot "${sidecar.source.name}" sha256:${sidecar.source.sha256.slice(0, 12)}, measured by adapters/image/screen-read.js (core ${sidecar.core})` });
  const colours = { background: t.background?.hex, surface: t.surface?.hex, ink: t.ink?.hex, accent: t.accent?.hex };
  for (const [property, hex] of Object.entries(colours)) {
    if (!hex) continue;
    log = signMeasurement(log, { property, reference, hex });
    log = bindCorrespondence(log, { property, reference });
  }
  return log;
}

/** What one token rests on, across every sidecar: [{ value, n }] for the named path. */
const gather = (sidecars, pick) => sidecars.map(pick).filter((x) => x && x.value != null && x.n > 0);
const pooled = (obs) => obs.length ? { value: r1(median(obs.map((o) => o.value))), n: obs.reduce((s, o) => s + o.n, 0), references: obs.length } : null;

/** styleFromScreens(sidecars) -> { css, comment, provenance, tokens, refused, log } | null (no sidecars).
 *  `provenance` has the shape renderBeliefMapped reads from a snipped stylesheet (package, version, path, license). */
export function styleFromScreens(sidecars, { log = createTaskLog() } = {}) {
  if (!sidecars?.length) return null;
  const refused = [];
  for (const sc of sidecars) log = feedReferenceFit(log, sc);

  // colours: reference-fit decides (derived / contested), the witness floor decides whether one value is enough
  const colour = {};
  for (const property of ["background", "surface", "ink", "accent"]) {
    // the background is witnessed by the area it covers (it is the page's largest flat region), not by a count of things
    const witnesses = sidecars.reduce((s, sc) => s + (sc.tokens[property]?.hex ? (property === "background" ? MIN_WITNESSES.value : sc.tokens[property].n ?? 1) : 0), 0);
    const have = sidecars.filter((sc) => sc.tokens[property]?.hex);
    if (!have.length) { refused.push({ token: property, because: "not measured on any screenshot" }); continue; }
    let syn;
    try { ({ log, ...syn } = synthesizeCandidate(log, { property })); } catch (e) { refused.push({ token: property, because: e.message }); continue; }
    if (syn.contested) { refused.push({ token: property, because: `the ${syn.n} references disagree by ${syn.spread}/255 per channel — contested, not averaged`, samples: syn.samples }); continue; }
    if (witnesses < MIN_WITNESSES.value) { refused.push({ token: property, because: `rests on ${witnesses} observation; ${MIN_WITNESSES.basis}` }); continue; }
    colour[property] = { hex: syn.candidateHex, n: witnesses, references: syn.n, spread: syn.spread };
  }

  // lengths: pooled medians, each needing the witness floor
  const len = (name, pick) => { const p = pooled(gather(sidecars, pick)); if (!p) { refused.push({ token: name, because: "not measured on any screenshot" }); return null; } if (p.n < MIN_WITNESSES.value) { refused.push({ token: name, because: `rests on ${p.n} observation; ${MIN_WITNESSES.basis}`, value: p.value }); return null; } return p; };
  const num = {
    body: len("type.body", (sc) => sc.tokens.type?.body && { value: sc.tokens.type.body.px, n: sc.tokens.type.body.n }),
    h1: len("type.h1", (sc) => sc.tokens.type?.h1 && { value: sc.tokens.type.h1.px, n: sc.tokens.type.h1.n }),
    h2: len("type.h2", (sc) => sc.tokens.type?.h2 && { value: sc.tokens.type.h2.px, n: sc.tokens.type.h2.n }),
    h3: len("type.h3", (sc) => sc.tokens.type?.h3 && { value: sc.tokens.type.h3.px, n: sc.tokens.type.h3.n }),
    lineHeight: len("type.lineHeight", (sc) => sc.tokens.type?.lineHeight && { value: sc.tokens.type.lineHeight.ratio, n: sc.tokens.type.lineHeight.n }),
    radiusBox: len("radius.box", (sc) => sc.tokens.radius?.box?.px != null && { value: sc.tokens.radius.box.px, n: sc.tokens.radius.box.n }),
    radiusButton: len("radius.button", (sc) => sc.tokens.radius?.button?.px != null && { value: sc.tokens.radius.button.px, n: sc.tokens.radius.button.n }),
    gap: len("spacing.vertical", (sc) => sc.tokens.spacing?.vertical && { value: sc.tokens.spacing.vertical.px, n: sc.tokens.spacing.vertical.n }),
    padX: len("spacing.padX", (sc) => sc.tokens.spacing?.padX && { value: sc.tokens.spacing.padX.px, n: sc.tokens.spacing.padX.n }),
    padY: len("spacing.padY", (sc) => sc.tokens.spacing?.padY && { value: sc.tokens.spacing.padY.px, n: sc.tokens.spacing.padY.n }),
    border: len("border", (sc) => sc.tokens.border && { value: sc.tokens.border.px, n: sc.tokens.border.n }),
    buttonX: len("button.padding.x", (sc) => sc.tokens.buttonPadding && { value: sc.tokens.buttonPadding.x, n: sc.tokens.buttonPadding.n }),
    buttonY: len("button.padding.y", (sc) => sc.tokens.buttonPadding && { value: sc.tokens.buttonPadding.y, n: sc.tokens.buttonPadding.n }),
  };
  // headings must descend: h1 > h2 > h3 > body, for the ones that stand. A scale read off noise does not; the heading that breaks it is not applied.
  const steps = ["h1", "h2", "h3", "body"].filter((k) => num[k]);
  for (let i = 1; i < steps.length; i++) {
    const big = steps[i - 1], small = steps[i];
    if (!num[big] || !num[small] || num[small].value < num[big].value) continue;
    refused.push({ token: `type.${big}/${small}`, because: `${big} ${num[big].value}px is not larger than ${small} ${num[small].value}px — a scale that does not descend is noise` });
    num[big] = null;
    if (small !== "body") num[small] = null;
  }
  // LENGTHS ARE IN EMS OF THE MEASURED BODY TEXT. A screenshot's pixel density is a guess (screen-read.js reads it off the width), and a phone
  // capture read as 1x doubles or triples every pixel size; proportions survive that, pixels do not. With no body size, no length is applied.
  const bodyPx = num.body?.value ?? null;
  const em = (v) => `${Math.round((v / bodyPx) * 100) / 100}em`;
  if (!bodyPx) for (const k of ["h1", "h2", "h3", "radiusBox", "radiusButton", "gap", "padX", "padY", "border", "buttonX", "buttonY"]) if (num[k]) { refused.push({ token: k, because: "no body text size was measured on two or more observations, so there is nothing to express this length against" }); num[k] = null; }

  // the ink ON the accent: the button text the screenshot showed, else the better of white and black by WCAG contrast (a received standard)
  let accentInk = null;
  if (colour.accent) {
    const shown = sidecars.map((sc) => sc.tokens.accent?.ink).find(Boolean);
    accentInk = shown ?? (contrastRatio([255, 255, 255], rgb(colour.accent.hex)) >= contrastRatio([0, 0, 0], rgb(colour.accent.hex)) ? "#ffffff" : "#000000");
  }

  // LITERAL VALUES, NOT CUSTOM PROPERTIES: this sheet is layered over whatever base the build has (a snipped classless
  // stylesheet, the engine's fallback), and each of those names its own variables. A declaration that sets the property
  // directly overrides any of them.
  const borderHex = sidecars.map((sc) => sc.tokens.border?.hex).find(Boolean);
  const rules = [];
  const body = [];
  if (colour.background) body.push(`background:${colour.background.hex}`);
  if (colour.ink) body.push(`color:${colour.ink.hex}`);
  if (num.lineHeight) body.push(`line-height:${num.lineHeight.value}`);
  if (body.length) rules.push(`body{${body.join(";")}}`);
  for (const h of ["h1", "h2", "h3"]) if (num[h]) rules.push(`${h}{font-size:${em(num[h].value)}}`);
  const card = [];
  if (colour.surface) card.push(`background:${colour.surface.hex}`);
  if (num.border && borderHex) card.push(`border:${em(num.border.value)} solid ${borderHex}`);
  if (num.radiusBox) card.push(`border-radius:${em(num.radiusBox.value)}`);
  if (num.padY && num.padX) card.push(`padding:${em(num.padY.value)} ${em(num.padX.value)}`);
  if (card.length) rules.push(`article{${card.join(";")}}`);
  const btn = [];
  if (colour.accent) btn.push(`background:${colour.accent.hex}`, `color:${accentInk}`, "border:0");
  if (num.radiusButton) btn.push(`border-radius:${em(num.radiusButton.value)}`);
  if (num.buttonX && num.buttonY) btn.push(`padding:${em(num.buttonY.value)} ${em(num.buttonX.value)}`);
  if (btn.length) rules.push(`button{${btn.join(";")}}`);
  if (colour.accent) rules.push(`a{color:${colour.accent.hex}}`);
  // belief-page.js lays its sections out with a .grid class (the engine's base sheet defines it; classless snipped sheets do not). The gap is
  // the one thing measured for it, so it is the only thing set: the grid's own widths are the base's, not invented here.
  if (num.gap) rules.push(`.grid{gap:${em(num.gap.value)}}`);

  const names = sidecars.map((sc) => sc.source.name);
  const tokens = { colour, ...Object.fromEntries(Object.entries(num).filter(([, v]) => v)) };
  const comment = `/*! measured, not written: ${sidecars.length} screenshot(s) — ${names.map((n) => n.replace(/\*\//g, "* /")).join(", ")}\n   instrument adapters/image/screen-read.js core ${sidecars[0].core}; every value below was measured off the pixels; values that were not, or that rest on one observation, are omitted\n   colours synthesised by organs/reference-fit.js (contested ones refused); lengths are pooled medians, in ems of the measured body text (density-independent)\n   applied: ${Object.keys(tokens.colour).concat(Object.keys(tokens).filter((k) => k !== "colour")).join(", ") || "nothing"} */`;
  return {
    schema: SCREEN_STYLE_SCHEMA,
    css: rules.join("\n"),
    comment,
    provenance: { package: "screenshot", version: sidecars.map((sc) => sc.source.sha256.slice(0, 8)).join("+"), path: `/${names.join("+")}`, license: "measured facts only (colours, sizes); no pixels and no text are carried", reached: RENDERED_ELEMENTS.filter((e) => rules.some((r) => new RegExp(`(^|[,}{ ])${e}[{,: ]`).test(r))) },
    tokens, refused, log,
  };
}

/** Layer a measured style over a base (a snipped classless stylesheet, the engine's FALLBACK_STYLE, or nothing): the base gives every element its
 *  plain layout, the screenshot's measured values override it. Returns the shape renderBeliefMapped takes as `style`. */
export function layerStyle(base, screen) {
  if (!screen?.css) return base ?? null;
  if (!base?.css) return { css: screen.css, comment: screen.comment, provenance: screen.provenance, screens: screen };
  return { css: `${base.css}\n${screen.css}`, comment: `${base.comment ?? ""}\n${screen.comment}`, provenance: base.provenance ?? screen.provenance, screens: screen };
}
