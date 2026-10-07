// Handle: Lewis — David Lewis, who read every counterfactual in the closest
// world where its antecedent holds, and held that each world is as real to
// those in it as ours is to us. Which world a sentence is said in decides
// what makes it true.
//
// universe.js — what type of universe a build is in, declared before anything
// is said in it, because it decides how every claim in it is KNOWN
// (docs/THE-WAYS-OF-KNOWING.md) and so what grounds it, what checks it, and
// what a change to it is. The types are the project's own:
//
//   world           referents that exist apart from the telling; a claim is
//                   known from a licensed source (a page about dolphins)
//   counterfactual  a world with ONE of its facts replaced by a stipulated
//                   value known to be false; everything else runs forward
//                   from the source (the-fold/fiction-admission.js)
//   hypothetical    the same, with the stipulated value's truth left open
//   stipulated      referents that exist only in the telling (a story with
//                   no source): a claim is known because the telling says so —
//                   the person's word first, the mouth's within it
//   workspace       code: a claim is known by the tests it passes
//   score           music: a claim is known by the licensed score it was cut from
//
// The type is the frame's `universe` coordinate (kernel/for-whom.js) and is
// declared on the ledger at birth (notes frame, DEF·Ground). What it decides:
//
//   ground      what the archons read a piece against: the sources, or — in a
//               stipulated universe — the telling's own record (its outline
//               lines, its people and their details), so an editor can tell a
//               sentence the story stands on from one it does not
//   lookups     whether a referent is looked up in the world (never a
//               stipulated person: Lily is not on Wikipedia)
//   revision    what a person's change is: in a told universe their word
//               replaces the old one (a concession); in the world, a change
//               against a source is a dispute between two witnesses
//
// No regular expressions.
export const UNIVERSE_SCHEMA = "Universe@1";

export const UNIVERSE_KINDS = Object.freeze({
  world: Object.freeze({ knowing: "source", ground: "sources", lookups: true, revision: "dispute" }),
  counterfactual: Object.freeze({ knowing: "stipulation over a source", ground: "sources", lookups: true, revision: "stipulate" }),
  hypothetical: Object.freeze({ knowing: "stipulation over a source, truth open", ground: "sources", lookups: true, revision: "stipulate" }),
  stipulated: Object.freeze({ knowing: "the telling", ground: "record", lookups: false, revision: "stipulate" }),
  workspace: Object.freeze({ knowing: "test", ground: "workspace", lookups: false, revision: "stipulate" }),
  score: Object.freeze({ knowing: "snip", ground: "sources", lookups: false, revision: "dispute" }),
});

/**
 * universeOf({ medium, sources, stipulations }) -> { schema, kind, ...UNIVERSE_KINDS[kind], basis }
 *   medium        the build's medium (its kind: page, prose, music, code)
 *   sources       licensed sources the build stands on ([] when none was found)
 *   stipulations  facts the telling replaces: [{ fact, value, truth: "false" | "open" }]
 */
export function universeOf({ medium, sources = [], stipulations = [] } = {}) {
  const kind = (() => {
    if (medium?.kind === "music") return "score";
    if (medium?.kind === "code") return "workspace";
    if (medium?.kind === "prose") {
      if (!sources.length) return "stipulated";
      if (!stipulations.length) return "world";
      return stipulations.every((s) => s.truth === "false") ? "counterfactual" : "hypothetical";
    }
    return "world";
  })();
  const basis = kind === "stipulated" ? "a telling with no source: its referents exist only in it"
    : kind === "counterfactual" || kind === "hypothetical" ? `${stipulations.length} stipulated fact(s) over ${sources.length} source(s)`
    : kind === "world" ? `${sources.length} source(s) the referents are known from`
    : `the ${medium?.kind} medium`;
  return Object.freeze({ schema: UNIVERSE_SCHEMA, kind, ...UNIVERSE_KINDS[kind], sources: Object.freeze([...sources]), stipulations: Object.freeze([...stipulations]), basis });
}

/**
 * groundOfRecord({ outline, castDetails }) -> { text, parts: [partId] }
 * A stipulated universe's ground: the telling's own record, one block per
 * leaf part, in order — the lines for the part and the parts it sits in, and
 * the details of the people those lines name, as plain sentences. Block k is
 * part k, so a draft built on this text has the book's parts as its parts.
 */
export function groundOfRecord({ outline, castDetails = [] }) {
  const said = (t) => t.props.find((p) => p.label === "says")?.value ?? null;
  const sentence = (v) => { const s = String(v).trim(); return [".", "!", "?"].includes(s.at(-1)) ? s : `${s}.`; };
  const hasName = (text, name) => { let i = text.indexOf(name); const w = (ch) => !!ch && ch.toLowerCase() !== ch.toUpperCase(); while (i >= 0) { if (!w(text[i - 1]) && !w(text[i + name.length])) return true; i = text.indexOf(name, i + 1); } return false; };
  const blocks = [], parts = [];
  for (const leaf of outline.leaves) {
    const lines = [...leaf.within, leaf.part].map(said).filter(Boolean).map(sentence);
    const here = outline.cast.filter((c) => lines.some((l) => hasName(l, c.name)));
    const facts = here.flatMap((c) => castDetails.map((d) => c.props.find((p) => p.label === d)).filter(Boolean).map((p) => `${c.name}'s ${p.label} is ${p.value}.`));
    blocks.push([...lines, ...facts].join(" "));
    parts.push(leaf.part.id);
  }
  return { text: blocks.join("\n\n"), parts };
}
