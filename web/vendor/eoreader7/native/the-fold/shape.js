// shape.js — STAGE 4: SHAPE-MATCH. LEARN THE FORM'S SHAPE FROM SEVERAL
// SOURCES, THEN GATE ON IT (2026-09-22).
//
// The user: "we need to know what the shape is of things that we think would
// satisfy" — and "we dont want a set of shapes pre-set". So no table says a
// sonnet has fourteen lines. The surfed sources say it, or nothing does:
// each source's claims about the form are read off its text — a COUNT and a
// UNIT ("fourteen lines", "3 quatrains", "2,500 words", "five paragraphs")
// — and a claim is the form's shape only when MORE FETCHED HOSTS THAN NOT
// state it (the majority rule the subject anchor already lives by: a being
// named in more parts than not). Below that it is a candidate with its
// support shown, never a shape. The units are a closed grammar of measure
// (line, stanza, paragraph, word, page …) — the ruler, not the shape; the
// shape is whatever the sources agree the ruler reads.
//
// Measured on the live surf of 2026-09-22 before this was written:
//   sonnet      litcharts, literarydevices, wikipedia — all three: 14 lines;
//               two of three: 8 lines (the octave), one each: 6, 4, 3 quatrains
//   white paper wikipedia, maglr, visme, purdue — no count claim in the
//               first 4,000 chars; the form is named by its PARTS
// so a shape also carries the parts the sources name in their HEADINGS —
// the words a majority of hosts put in a heading — since a form with no
// counted extent may still have named parts (abstract, conclusion …).
//
// matchShape then asks of any text — a candidate, a skeleton, the piece —
// whether it reads the agreed count on the units this engine can measure
// (lines, words, sentences, paragraphs), and says [unmeasured] for the rest.
// NO → the caller goes back to SURF (surfForShape does one more round with
// queries that ask for the form's structure, then stops: bounded).

import { surf, surfQueries } from "./surf.js";
import { isFunctionWord } from "./pos-prior.js";
import { draftWords } from "./eot-draft.js";

export const SHAPE_SCHEMA = "EOShape@1";

const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000 };
const UNITS = ["line", "stanza", "quatrain", "tercet", "couplet", "sestet", "octave", "syllable", "foot", "feet", "paragraph", "section", "part", "page", "word", "sentence", "chapter", "verse", "act", "scene", "beat", "movement", "slide", "step", "item", "point", "minute"];
const UNIT_RE = new RegExp(`\\b(\\d[\\d,]*|${Object.keys(NUM).join("|")})[\\s-]+(${UNITS.join("|")})s?\\b`, "gi");
const norm = (u) => (u === "feet" ? "foot" : u.toLowerCase());
const toN = (w) => (/^\d/.test(w) ? Number(w.replace(/,/g, "")) : NUM[w.toLowerCase()]);

/** Every (count, unit) claim in a text, in order, with its exact words. */
export function shapeClaims(text) {
  const out = [];
  for (const m of String(text ?? "").matchAll(UNIT_RE)) {
    const n = toN(m[1]);
    if (!Number.isFinite(n) || n <= 0) continue;
    out.push({ n, unit: norm(m[2]), said: m[0] });
  }
  return out;
}

/** INSTANCES, not descriptions: a page about sonnets often holds a sonnet.
 *  extractReadable keeps line breaks (measured 2026-09-22: Wikipedia's
 *  Sonnet 18 came back as fourteen consecutive lines), and prose comes back
 *  one paragraph per line — so a block of two or more consecutive lines
 *  between blank lines is verse (or a list, which its markers give away).
 *  Each such block is one instance; its shape is its line count. */
export function instanceShapes(text) {
  const out = [];
  for (const block of String(text ?? "").split(/\n\s*\n/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    if (lines.some((l) => /^([-•*]|\d+[.)])\s/.test(l))) continue;
    if (lines.every((l) => l.split(/\s+/).length <= 2)) continue;
    if (!lines.every((l) => /[a-z]/.test(l))) continue; // label rows ("Q1 Q2 Q3 C") are not verse
    out.push({ lines: lines.length, first: lines[0].slice(0, 60) });
  }
  return out;
}

/** Heading content words, per source (lowercased, function words out). */
const headingWords = (src) => new Set((src.headings ?? []).flatMap((h) => draftWords(h)).filter((w) => !isFunctionWord(w) && w.length > 2));

/**
 * learnShape(sources) → EOShape@1
 * sources: [{ host, text, headings }] (fetched ones; others are ignored).
 * Per unit: each distinct count with the hosts stating it; `agreed` are the
 * counts stated by more hosts than not; `top` the agreed count with the most
 * support (ties: the larger — a whole is at least its parts).
 */
export function learnShape(sources, { formWord = null } = {}) {
  const fetched = (sources ?? []).filter((s) => s.text && s.host);
  const hosts = [...new Set(fetched.map((s) => s.host))];
  const H = hosts.length;
  const majority = (k) => k * 2 > H;
  // counts by unit: unit → n → Set(host)
  const byUnit = new Map();
  for (const s of fetched) for (const c of shapeClaims(s.text)) {
    const u = byUnit.get(c.unit) ?? byUnit.set(c.unit, new Map()).get(c.unit);
    (u.get(c.n) ?? u.set(c.n, new Set()).get(c.n)).add(s.host);
  }
  const units = {};
  for (const [unit, m] of byUnit) {
    const claims = [...m].map(([n, hs]) => ({ n, hosts: [...hs], support: hs.size })).sort((a, b) => b.support - a.support || b.n - a.n);
    // Every agreed claim stands (a haiku's 17 syllables AND its 5 — the whole
    // and a part, measured live 2026-09-22: 3/5 and 4/5 hosts); `top` is the
    // largest agreed count, since a whole is at least its parts.
    const agreed = claims.filter((c) => majority(c.support)).sort((a, b) => b.n - a.n);
    units[unit] = { claims, agreed, top: agreed[0] ?? null };
  }
  // name: the words a majority of hosts put in their page TITLE — what the
  // sources themselves call the form. Measured live 2026-09-22: the garbled
  // ask "whiteppr" surfed to five pages titled "white paper", so the name
  // resolves from the sources, not from any table. Those words are the
  // form's name, not its parts, and are kept out of the parts below.
  const tw = new Map();
  for (const s of fetched) for (const w of new Set(draftWords(s.pageTitle || s.title || "").filter((x) => !isFunctionWord(x) && x.length > 2))) (tw.get(w) ?? tw.set(w, new Set()).get(w)).add(s.host);
  const name = [...tw].map(([w, hs]) => ({ word: w, support: hs.size })).filter((p) => majority(p.support)).sort((a, b) => b.support - a.support || a.word.localeCompare(b.word));
  // parts: heading words a majority of hosts use
  const hw = new Map();
  for (const s of fetched) for (const w of headingWords(s)) (hw.get(w) ?? hw.set(w, new Set()).get(w)).add(s.host);
  const skip = new Set([formWord, formWord ? `${formWord}s` : null, ...name.map((n) => n.word)].filter(Boolean));
  const parts = [...hw].map(([w, hs]) => ({ word: w, support: hs.size })).filter((p) => majority(p.support) && !skip.has(p.word)).sort((a, b) => b.support - a.support || a.word.localeCompare(b.word));
  // instances: the line counts of verse blocks the pages themselves hold,
  // by host support — the same majority rule as the stated claims. A count
  // the instances agree on is a measurement of the form, not a report of it.
  const inst = new Map();
  for (const s of fetched) for (const b of new Set(instanceShapes(s.text).map((x) => x.lines))) (inst.get(b) ?? inst.set(b, new Set()).get(b)).add(s.host);
  const instanceClaims = [...inst].map(([n, hs]) => ({ n, hosts: [...hs], support: hs.size })).sort((a, b) => b.support - a.support || b.n - a.n);
  const instances = { claims: instanceClaims, agreed: instanceClaims.filter((c) => majority(c.support)).sort((a, b) => b.n - a.n), blocks: fetched.reduce((k, s) => k + instanceShapes(s.text).length, 0) };
  instances.top = instances.agreed[0] ?? null;
  const agreedUnits = Object.entries(units).filter(([, u]) => u.top).map(([unit, u]) => ({ unit, n: u.top.n, support: u.top.support, by: "stated" }));
  if (instances.top && !agreedUnits.some((a) => a.unit === "line")) agreedUnits.push({ unit: "line", n: instances.top.n, support: instances.top.support, by: "instances" });
  const learned = agreedUnits.length > 0 || parts.length > 0;
  return {
    schema: SHAPE_SCHEMA, formWord, hosts: H,
    name, units, parts, instances, agreedUnits, learned,
    basis: H === 0
      ? "no fetched source: nothing to learn a shape from"
      : !learned
        ? `${H} host(s), no count-and-unit claim and no heading word stated by more hosts than not — the shape is not learned (an honest gap, not a default)`
        : `${H} host(s)${name.length ? `, which call it "${name.map((n) => n.word).join(" ")}"` : ""}: ${agreedUnits.map((a) => `${a.n} ${a.unit}${a.n === 1 ? "" : "s"} (${a.support}/${H}${a.by === "instances" ? ", measured on the pages' own verse blocks" : ""})`).join(", ") || "no agreed count"}${instances.top && agreedUnits.some((a) => a.unit === "line" && a.by === "stated") ? `; the pages' own verse blocks: ${instances.top.n} lines (${instances.top.support}/${H})` : ""}${parts.length ? `; named parts: ${parts.slice(0, 8).map((p) => `${p.word} (${p.support}/${H})`).join(", ")}` : ""} — a claim counts only when more fetched hosts than not state it`,
  };
}

const MEASURE = {
  line: (t) => t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length,
  paragraph: (t) => t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).length,
  word: (t) => t.split(/\s+/).filter(Boolean).length,
  sentence: (t) => (t.match(/[.!?]+(\s|$)/g) ?? []).length,
};

/**
 * matchShape(shape, text, { tolerance }) → { ok, checks, basis }
 * Every agreed unit this engine can measure is measured; a miss is NO. Units
 * it cannot measure (syllables, quatrains) are stated [unmeasured], and do
 * not fail the gate — nor pass it: a shape with only unmeasurable units is
 * "unmeasured", not "ok".
 * `tolerance` is a fraction for the soft units (words); lines/paragraphs/
 * sentences are exact — a sonnet is fourteen lines, not about fourteen.
 */
export function matchShape(shape, text, { tolerance = 0.2 } = {}) {
  const checks = [];
  for (const a of shape?.agreedUnits ?? []) {
    const f = MEASURE[a.unit];
    if (!f) { checks.push({ unit: a.unit, want: a.n, got: null, basis: "unmeasured: no measure for this unit yet" }); continue; }
    const got = f(String(text ?? ""));
    const soft = a.unit === "word";
    const ok = soft ? Math.abs(got - a.n) <= tolerance * a.n : got === a.n;
    checks.push({ unit: a.unit, want: a.n, got, ok, basis: soft ? `within ${Math.round(tolerance * 100)}% of ${a.n}` : `exactly ${a.n}` });
  }
  const measured = checks.filter((c) => c.got != null);
  const ok = measured.length ? measured.every((c) => c.ok) : null;
  return { ok, checks, basis: !checks.length ? "no agreed shape to match" : !measured.length ? "every agreed unit is unmeasured: not matched, not failed" : `${measured.filter((c) => c.ok).length}/${measured.length} measured unit(s) match: ${measured.map((c) => `${c.unit} ${c.got}${c.ok ? " =" : " ≠"} ${c.want}`).join(", ")}` };
}

/**
 * surfForShape({ spec, web, rounds }) → { surfed, shape, rounds }
 * SURF → learn; if nothing is learned and a round remains, SURF again with
 * queries that ask for the form's structure (declared templates), merge the
 * sources, learn again. Bounded by `rounds`, never by "until it works".
 */
export async function surfForShape({ spec, web, rounds = 2, perQuery = 6, maxSources = 6 } = {}) {
  const token = spec?.form?.token ?? null;
  let surfed = await surf({ spec, search: web.search, fetch: web.fetch, perQuery, maxSources });
  let shape = learnShape(surfed.sources, { formWord: token });
  let round = 1;
  while (!shape.learned && round < rounds && token) {
    round++;
    const extra = { ...spec, form: { ...spec.form }, topic: null };
    const more = await surf({ spec: extra, search: web.search, fetch: web.fetch, perQuery, maxSources, queries: [
      { hunt: "exemplars", q: `${token} structure how many parts`, basis: `round ${round}: the form's structure, asked directly` },
      { hunt: "exemplars", q: `${token} format rules length`, basis: `round ${round}: the form's format and length` },
    ] });
    const seen = new Set(surfed.sources.map((s) => s.url));
    surfed = { ...surfed, queries: [...surfed.queries, ...more.queries], sources: [...surfed.sources, ...more.sources.filter((s) => !seen.has(s.url))], basis: `${surfed.basis}; round ${round}: ${more.basis}` };
    surfed.fetched = surfed.sources.filter((s) => s.status === "fetched" && s.chars > 0).length;
    surfed.hosts = [...new Set(surfed.sources.filter((s) => s.status === "fetched" && s.chars > 0).map((s) => s.host))];
    surfed.multiple = surfed.hosts.length >= 2;
    shape = learnShape(surfed.sources, { formWord: token });
  }
  return { surfed, shape, rounds: round };
}

export function shapeLines(shape) {
  const out = [];
  for (const [unit, u] of Object.entries(shape.units ?? {})) out.push(`${unit.padEnd(10)} ${u.claims.map((c) => `${c.n} (${c.support}/${shape.hosts}${u.agreed.includes(c) ? " ✓" : ""})`).join("  ")}`);
  if (shape.instances?.claims?.length) out.push(`instances  ${shape.instances.claims.slice(0, 10).map((c) => `${c.n} lines (${c.support}/${shape.hosts}${shape.instances.agreed.includes(c) ? " ✓" : ""})`).join("  ")}  · ${shape.instances.blocks} verse block(s)`);
  if (shape.name?.length) out.push(`name       ${shape.name.map((p) => `${p.word} (${p.support}/${shape.hosts})`).join("  ")}`);
  if (shape.parts?.length) out.push(`parts      ${shape.parts.slice(0, 12).map((p) => `${p.word} (${p.support}/${shape.hosts})`).join("  ")}`);
  return out;
}
