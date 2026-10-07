// native/organs/lang-levers.js — the mechanical levers the four research
// reports converged on (2026-09-21), each using the language's own toolchain,
// none instructing the model in language to mimic a property.
//
//   extractCode        which fenced block of a reply is THE code, deterministically
//   definesName        does the source define the spec's function? (toolchain probe)
//   nameDiagnostic     one templated sentence when it does not — never an alias
//   pickBest           best-of-k selection on the VISIBLE cases only
//   RepairLedger       early stop + keep-the-best across repair rounds, so a
//                      refinement can never overwrite a better candidate
//
// Honesty: an alias (`const sum_evens = sumEvens`) would make a test pass while
// the code ignores its spec and would hide the naming class from the ledger, so
// nothing here ever rewrites a name.
import { canonLanguage, validateLanguage, runWithHarness } from "./lang-validators.js";

// A stub that only REFERENCES the name — it carries no test arguments, so the
// probe cannot leak a held-out case.
const PROBE = {
  javascript: (n) => `console.log(typeof ${n} === "function" ? "yes" : "no");`,
  typescript: (n) => `console.log(typeof ${n} === "function" ? "yes" : "no");`,
  python: (n) => `print("yes" if callable(globals().get(${JSON.stringify(n)})) else "no")`,
  ruby: (n) => `puts(respond_to?(:${n}, true) ? "yes" : "no")`,
};

export async function definesName(language, source, name) {
  const lang = canonLanguage(language);
  const probe = PROBE[lang];
  if (!probe) return { known: false };
  const r = await runWithHarness(lang, source, probe(name));
  if (!r.ran) return { known: false };
  return { known: true, defined: r.code === 0 && r.out.trim().split("\n").pop() === "yes" };
}

// Every fenced block, in order; a reply with no fence is one candidate.
function candidateBlocks(reply) {
  const text = String(reply ?? "");
  const blocks = [...text.matchAll(/```[^\n`]*\n([\s\S]*?)```/g)].map((m) => m[1].trim()).filter(Boolean);
  return blocks.length ? blocks : [text.trim()].filter(Boolean);
}

// Keep the blocks that pass the language floor AND define the spec name; take the
// LAST (a usage snippet usually precedes the implementation in prose replies, but
// a trailing usage snippet does not define the name, so it is dropped by the probe).
// null when no block qualifies — an honest "no block defines it".
export async function extractCode(reply, language, name) {
  const keep = [];
  for (const b of candidateBlocks(reply)) {
    const floor = await validateLanguage(language, b);
    if (!floor.ok) continue;
    const d = await definesName(language, b, name);
    if (d.known && !d.defined) continue;
    keep.push(b);
  }
  return keep.length ? keep[keep.length - 1] : null;
}

// When nothing qualifies, fall back to the first floor-clean block (or the whole
// reply) so the drawn text still reaches the scorer and shows its real failure.
export async function extractOrFallback(reply, language, name) {
  return (await extractCode(reply, language, name)) ?? candidateBlocks(reply)[0] ?? "";
}

export const nameDiagnostic = (name) => `The code does not define a function called ${name}, which is the name the task asks for.`;

// Best-of-k: highest count of VISIBLE cases passed; ties go to the earliest draw.
export function pickBest(candidates, visibleIdx) {
  let best = null, bestScore = -1;
  candidates.forEach((c) => {
    const score = !c.sc.floorOk ? -0.5 : visibleIdx.filter((i) => c.sc.cases?.[i]).length;
    if (score > bestScore) { best = c; bestScore = score; }
  });
  return { best, score: bestScore };
}

// Early stop + keep-the-best. `offer` a scored candidate each round; it is kept
// only if it is not worse on the visible cases than what is held, so a repair
// that breaks working code is discarded and the held candidate stands.
export class RepairLedger {
  constructor(visibleIdx) { this.visibleIdx = visibleIdx; this.best = null; this.bestScore = -1; this.offers = 0; this.regressions = 0; }
  score(sc) { return !sc.floorOk ? -0.5 : this.visibleIdx.filter((i) => sc.cases?.[i]).length; }
  offer(candidate) {
    this.offers++;
    const s = this.score(candidate.sc);
    if (this.best && s < this.bestScore) { this.regressions++; return false; }
    this.best = candidate; this.bestScore = s; return true;
  }
  get done() { return this.best != null && this.bestScore >= this.visibleIdx.length; }
}
