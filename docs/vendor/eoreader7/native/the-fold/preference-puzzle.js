// preference-puzzle.js — a SECOND, unrelated puzzle kind, proving
// reasoning-core.js is a general engine and not something built to fit
// knights-and-knaves alone. No truth-tellers, no self-referential
// statements, no boolean domain — a plain attribute-assignment puzzle
// (the zebra-puzzle family): N people, each assigned one value from an
// N-sized domain, one value per person and no value repeated (a bijection
// — the puzzle's own "each prefers a DIFFERENT one of N drinks" shape),
// pinned down by direct/negative/disjunctive/relational clues.
//
// Built 2026-09-16 specifically to be handed a puzzle this instrument had
// never seen, of a different kind entirely, live — the same "computed, not
// generated" posture as logic-puzzle.js, sharing its solving core
// (reasoning-core.js::solveCSP) and changing NOTHING there. Only the
// parsing here is puzzle-specific, exactly as designed.
import { finiteDomain, declareVariable, declareConstraint, makeCSP, solveCSP } from "../organs/reasoning-core.js";

const splitList = (s) =>
  String(s ?? "")
    .split(/\s*,\s*|\s+and\s+/i)
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * parsePreferencePuzzle(text) — the closed input shape: three labeled
 * blocks, `people:`, `domain:`, `clues:`. Narrow on purpose, the same
 * discipline `logic-puzzle.js`'s own "A: '...'" format already holds —
 * this is not a general-English parser. Returns null when the three
 * blocks aren't all present, or fewer than two people/domain values.
 */
export function parsePreferencePuzzle(text) {
  const q = String(text ?? "");
  const peopleM = /people:\s*([^\n]+)/i.exec(q);
  const domainM = /domain:\s*([^\n]+)/i.exec(q);
  const cluesM = /clues:\s*([\s\S]*)$/i.exec(q);
  if (!peopleM || !domainM || !cluesM) return null;
  const people = splitList(peopleM[1]);
  const domain = splitList(domainM[1]).map((d) => d.toLowerCase());
  if (people.length < 2 || domain.length < 2) return null;
  const clueLines = cluesM[1].split("\n").map((l) => l.trim()).filter(Boolean);
  if (!clueLines.length) return null;
  return { people, domain, clueLines };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * One clue line, parsed into a typed node — a closed grammar (direct,
 * negative, disjunctive "or", relational same/different) — or
 * `{type:"unparsed", raw}`, named rather than guessed at, exactly the
 * discipline `logic-puzzle.js::parseStatement` already holds.
 */
export function parseClue(raw, people, domain) {
  const s = String(raw ?? "").trim();
  const P = people.map(escapeRegex).join("|");
  const D = domain.map(escapeRegex).join("|");
  let m;
  if ((m = new RegExp(`^(${P})\\s+does\\s+not\\s+prefer\\s+(${D})\\.?$`, "i").exec(s))) {
    return { type: "negative", who: m[1], value: m[2].toLowerCase() };
  }
  if ((m = new RegExp(`^(${P})\\s+prefers\\s+(${D})\\s+or\\s+(${D})\\.?$`, "i").exec(s))) {
    return { type: "or", who: m[1], values: [m[2].toLowerCase(), m[3].toLowerCase()] };
  }
  if ((m = new RegExp(`^(${P})\\s+prefers\\s+(${D})\\.?$`, "i").exec(s))) {
    return { type: "direct", who: m[1], value: m[2].toLowerCase() };
  }
  if ((m = new RegExp(`^(${P})\\s+and\\s+(${P})\\s+prefer\\s+different\\b.*\\.?$`, "i").exec(s))) {
    return { type: "diff", a: m[1], b: m[2] };
  }
  if ((m = new RegExp(`^(${P})\\s+and\\s+(${P})\\s+prefer\\s+the\\s+same\\b.*\\.?$`, "i").exec(s))) {
    return { type: "same", a: m[1], b: m[2] };
  }
  return { type: "unparsed", raw: s };
}

/** A clue node's truth under one candidate assignment — `null` for an
 * unparsed node, never silently true or false. */
export function evaluateClue(node, assignment) {
  switch (node.type) {
    case "direct": return assignment[node.who] === node.value;
    case "negative": return assignment[node.who] !== node.value;
    case "or": return node.values.includes(assignment[node.who]);
    case "diff": return assignment[node.a] !== assignment[node.b];
    case "same": return assignment[node.a] === assignment[node.b];
    default: return null;
  }
}

/**
 * Declares the puzzle as a general finite-domain CSP and hands it to
 * `reasoning-core.js::solveCSP` — the identical solver `logic-puzzle.js`
 * now uses, sharing every line of the search itself. When people and
 * domain are the same size (this puzzle family's own standard shape —
 * "each prefers a DIFFERENT one of N drinks"), a bijection is declared
 * too: every pair of people must differ. That is stated here, not
 * assumed silently, because it is a real, disclosed reading of the
 * puzzle's own header, not a fact `reasoning-core.js` knows.
 */
export function solvePreferencePuzzle({ people, domain, clueLines }) {
  const external = [];
  const constraints = [];
  for (const raw of clueLines) {
    const node = parseClue(raw, people, domain);
    if (node.type === "unparsed") { external.push({ raw: node.raw }); continue; }
    const vars = node.type === "diff" || node.type === "same" ? [node.a, node.b] : [node.who];
    constraints.push(declareConstraint(raw, vars, (a) => evaluateClue(node, a) === true));
  }
  const bijection = people.length === domain.length;
  if (bijection) {
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        constraints.push(declareConstraint(`${people[i]}≠${people[j]} (each prefers a different one)`, [people[i], people[j]], (a) => a[people[i]] !== a[people[j]]));
      }
    }
  }
  const variables = people.map((who) => declareVariable(who, finiteDomain(domain)));
  const { solutions } = solveCSP(makeCSP(variables, constraints));
  return { people, domain, valid: solutions, external, bijection, totalTried: domain.length ** people.length };
}

export function detectPreferencePuzzle(question) {
  const parsed = parsePreferencePuzzle(question);
  if (!parsed) return null;
  const anyParseable = parsed.clueLines.some((raw) => parseClue(raw, parsed.people, parsed.domain).type !== "unparsed");
  if (!anyParseable) return null;
  return { kind: "preference-puzzle", ...parsed };
}

export function checkPreferencePuzzle(question) {
  const found = detectPreferencePuzzle(question);
  if (!found) return null;
  const solved = solvePreferencePuzzle(found);
  const { people, domain, valid, external, totalTried } = solved;
  let display;
  if (valid.length === 1) {
    const roles = people.map((who) => `${who}: ${valid[0][who]}`).join(" · ");
    display = `Checked ${totalTried} possible assignments of {${domain.join(", ")}} to ${people.join(", ")}${solved.bijection ? " (each used exactly once)" : ""}; exactly one satisfies every clue:\n${roles}\n— computed by exhaustive check, not narrated.`;
  } else if (valid.length === 0) {
    display = `Checked ${totalTried} possible assignments; none satisfies every clue — as parsed, this puzzle has no solution.`;
  } else {
    const options = valid.map((a) => people.map((who) => `${who}:${a[who]}`).join(" ")).join("  |  ");
    display = `Checked ${totalTried} possible assignments; ${valid.length} satisfy every clue (the puzzle as parsed underdetermines it): ${options}`;
  }
  if (external.length) {
    display += `\n${external.length} clue(s) this door could not parse into the closed grammar and did not use: ${external.map((e) => `"${e.raw}"`).join(" · ")}.`;
  }
  return { ...found, valid, external, totalTried, display, tex: null };
}
