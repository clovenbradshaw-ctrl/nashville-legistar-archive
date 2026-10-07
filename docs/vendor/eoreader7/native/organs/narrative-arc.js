// Handle: Odysseus — THE BEING. Not the Odyssey as an example of a story:
// Odysseus is the one referent the telling follows, the same man at every
// point of it, so that at any point one can ask "where is Odysseus now?" and
// be answered. He leaves the void (Ithaca, and what is missing there), is
// carried through everything, and arrives back at the void (Gebser) — the
// same island, the same house — and is not the same man. The journey's
// referent is changed on coming home; home is where the change can be seen.
//
// narrative-arc.js — the NESTED ARCS of a long work and the BEING who walks
// them, held by the engine, never by the mouth. A small model cannot hold an
// arc across two hundred scenes, nor remember where its hero is; the record
// can. The arc is the helix itself, walked by the being:
//
//   NUL  the void it opens on — home, and what is missing there
//   SIG  something calls
//   INS  the setting out
//   SEG  the crossing into what home is not
//   CON  the people met, for and against
//   SYN  everything gathered comes together
//   DEF  what the journey means comes clear
//   EVA  the test, won or lost
//   REC  the being is changed
//   NUL  the arrival back at the void (Gebser) — home again, the absence
//        answered, the same being come home changed
//
// NESTED: the book walks the whole helix across its chapters; each chapter
// walks a smaller arc of its own across its scenes — its own opening lack,
// its turn, its own landing — inside the role the book gives it. Roles are
// the engine's words, placed by position, and each reaches the mouth only as
// a plain fact ("In chapter 3, Alice sets out, leaving the cottage behind.").
//
// THE BEING, read from the text (trajectory): in each part, is the being
// there (named), and where — at home (the part places them with home said)
// or away — and changed yet (what the record says they become, said of
// them). whereIs answers "where is the being at part k?" with the line that
// placed them, the role the part plays, and whether they have left, come
// back, or changed.
//
// THE CHECKS (EVA), read from the trajectory:
//   Gebser    the being leaves home and the last place they are seen is home
//             again; the void they left (what was missing) is answered there
//   the being what they lacked is said at the start; at the arrival they are
//             what the record says they become; they are never lost from the
//             telling for long
//   the role  the chapter of the change says the change
// A failed check licenses the part to be written again with its role in
// hand (the book editor's pathos pass). No regular expressions.

export const NARRATIVE_ARC_SCHEMA = "NarrativeArc@1";

/** The book's arc: the helix, walked out and back — set by hand 2026-09-28
 *  (user: "Gebser is the arrival back at the void, Odyssey is the referent of
 *  the journey changed on returning home"). Each role is an operator's cell;
 *  `fact` is a clause the engine places after "In chapter k, ", with {p} the
 *  protagonist, {home} where they start, {lack} what is missing there,
 *  {becomes} what they come home as. */
export const BOOK_ARC = Object.freeze([
  { role: "the void", op: "NUL", grain: "Ground", fact: "{p} is at {home}, missing {lack}" },
  { role: "the call", op: "SIG", grain: "Figure", fact: "something calls {p} away from {home}" },
  { role: "the setting out", op: "INS", grain: "Figure", fact: "{p} sets out, leaving {home} behind" },
  { role: "the crossing", op: "SEG", grain: "Ground", fact: "{p} is far from {home}, among strangers" },
  { role: "the meetings", op: "CON", grain: "Figure", fact: "{p} meets people who help and people who stand in the way" },
  { role: "the gathering", op: "SYN", grain: "Pattern", fact: "everything {p} has found comes together" },
  { role: "the meaning", op: "DEF", grain: "Pattern", fact: "{p} begins to understand what the journey is for" },
  { role: "the test", op: "EVA", grain: "Figure", fact: "{p} is tested, and everything is at stake" },
  { role: "the change", op: "REC", grain: "Figure", fact: "{p} becomes {becomes}" },
  { role: "the arrival", op: "NUL", grain: "Pattern", fact: "{p} comes home to {home}, no longer missing {lack}, {becomes} now" },
]);

/** A chapter's own arc across its scenes — set by hand 2026-09-28: its
 *  opening lack, its turn, its own arrival. A clause after "In scene j of
 *  chapter k, ". */
export const CHAPTER_ARC = Object.freeze([
  { role: "the opening", op: "NUL", grain: "Figure", fact: "the chapter opens on what {p} does not yet have" },
  { role: "the turn", op: "EVA", grain: "Figure", fact: "something turns for {p}" },
  { role: "the landing", op: "REC", grain: "Figure", fact: "the chapter ends somewhere new for {p}" },
]);

/** Which role of `arc` the k-th of n parts plays: the first opens, the last
 *  arrives, the ones between walk the middle in order. */
export function roleAt(arc, k, n) {
  if (n <= 1) return arc.at(-1);
  if (k === 0) return arc[0];
  if (k >= n - 1) return arc.at(-1);
  const middle = arc.slice(1, -1);
  // each middle part takes the role at its own centre: a lone middle chapter
  // is the middle of the journey, not its first step
  return middle[Math.min(middle.length - 1, Math.floor(((k - 0.5) * middle.length) / Math.max(1, n - 2)))];
}

/** The clause a role reaches the mouth as, filled from the record's own frame. */
export function roleFact(role, frame) {
  let s = role.fact;
  for (const [k, v] of Object.entries({ p: frame.p ?? "the hero", home: frame.home ?? "home", lack: frame.lack ?? "something", becomes: frame.becomes ?? "someone new" })) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** The frame of the arc, read from the record: the first person named is the
 *  one who sets out; what the record says of them — their home, what they
 *  lack, what they become — anchors the arc. `premises` are the notes it
 *  stands on. */
export function arcFrame(cast) {
  const p = cast[0];
  if (!p?.name) return { p: null, premises: [] };
  const prop = (label) => p.props.find((q) => q.label === label && !q.superseded) ?? null;
  const [home, lack, becomes] = [prop("home"), prop("lacks"), prop("becomes")];
  return { p: p.name, id: p.id, home: home?.value ?? null, lack: lack?.value ?? null, becomes: becomes?.value ?? null, premises: [p.nameNote, home?.note, lack?.note, becomes?.note].filter(Boolean) };
}

/**
 * arcRole({ belief, parentId, kind, index, n, cast }) -> { roles, facts, premises } | null
 * The place of the index-th of n parts of `kind` under `parentId` in the
 * nested arcs: a part of the whole walks the book's arc; a part of a part
 * walks its own chapter's arc inside the role its parent plays in the book.
 * Facts are sentences the engine says, never the mouth's.
 */
export function arcRole({ belief, parentId, kind, index, n, cast }) {
  const frame = arcFrame(cast);
  // an arc stands on its whole frame: a being with no home on the record has
  // no void to leave or come back to, and the parts are asked without roles
  if (!frame.p || !frame.home || !frame.lack || !frame.becomes) return null;
  const byId = new Map(belief.map((t) => [t.id, t]));
  const parent = byId.get(parentId) ?? null;
  const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  if (!parent || !parent.parent) {
    const r = roleAt(BOOK_ARC, index, n);
    return { roles: [r.role], facts: [`In ${kind} ${index + 1}, ${roleFact(r, frame)}.`], premises: frame.premises };
  }
  const grand = byId.get(parent.parent);
  const sibs = (grand?.children ?? []).map((id) => byId.get(id)).filter((t) => t && t.kind === parent.kind).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const k = Math.max(0, sibs.indexOf(parent));
  const book = roleAt(BOOK_ARC, k, sibs.length), own = roleAt(CHAPTER_ARC, index, n);
  // the arrival chapter's own landing is home, not "somewhere new" (arc1: the
  // last scene's landing fact pulled the being away again after the homecoming)
  const ownFact = book.role === "the arrival" && own.role === "the landing" ? `the chapter ends with ${frame.p} at ${frame.home}` : roleFact(own, frame);
  return { roles: [book.role, own.role], facts: [`In ${parent.kind} ${k + 1}, ${roleFact(book, frame)}.`, upper(`in ${kind} ${index + 1} of ${parent.kind} ${k + 1}, ${ownFact}.`)], premises: frame.premises };
}

// the content words of a phrase: what a text must say to have said it
const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for", "with", "is", "are", "was", "were", "be", "her", "his", "their", "its", "she", "he", "they", "it", "that", "this", "no", "not", "who", "what", "has", "have", "had", "from", "by", "as", "into", "more", "most", "very", "own"]);
const wordsOf = (t) => String(t ?? "").toLowerCase().split(" ").map((w) => [...w].filter((ch) => ch.toLowerCase() !== ch.toUpperCase()).join("")).filter((w) => w.length > 2 && !STOP.has(w));
/** Most letters a word's ending may add or drop and still be the word
 *  ("mother" / "mothers", "keep" / "keeper") — set by hand 2026-09-28: not
 *  "light" / "lighthouse". */
const INFLECTION = 3;
const sameWord = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && Math.abs(a.length - b.length) <= INFLECTION && (a.startsWith(b) || b.startsWith(a)));
/** Does `text` say `phrase`: more than `share` of the phrase's content words
 *  (half by default; 0.8 reads a phrase said back nearly whole). */
export function says(text, phrase, share = 0.5) {
  const want = [...new Set(wordsOf(phrase))];
  if (!want.length) return false;
  const have = [...new Set(wordsOf(text))];
  const hits = want.filter((w) => have.some((h) => sameWord(h, w)));
  return hits.length > want.length * share;
}

const hasName = (text, name) => { const w = (ch) => !!ch && ch.toLowerCase() !== ch.toUpperCase(); let i = text.indexOf(name); while (i >= 0) { if (!w(text[i - 1]) && !w(text[i + name.length])) return true; i = text.indexOf(name, i + 1); } return false; };

/**
 * trajectory({ parts, frame }) -> [{ id, chapter, seen, at, changed, lacking, line }]
 *   parts  [{ id, chapter, lines: [{ text, addr }] }] in the book's order
 *   frame  arcFrame(cast)
 * Where the being is in each part, read from its words alone: `seen` when a
 * line names them; `at` "home" when the part names them and says their home,
 * "away" when it names them and does not, null when they are not there;
 * `changed` when the part says what they become; `line` the line that placed
 * them (the one saying home, else the last naming them).
 */
export function trajectory({ parts, frame }) {
  return parts.map((pt) => {
    const lines = pt.lines ?? [];
    const text = lines.map((l) => l.text).join(" ");
    const naming = frame.p ? lines.filter((l) => hasName(l.text, frame.p)) : [];
    const seen = naming.length > 0;
    const home = seen && !!frame.home && says(text, frame.home);
    const line = !seen ? null : (home ? lines.find((l) => says(l.text, frame.home)) : null) ?? naming.at(-1);
    return { id: pt.id, chapter: pt.chapter, seen, at: !seen ? null : home ? "home" : frame.home ? "away" : "there", changed: !!frame.becomes && seen && says(text, frame.becomes), lacking: !!frame.lack && says(text, frame.lack), line: line ? { addr: line.addr ?? null, text: line.text } : null };
  });
}

/**
 * whereIs({ path, frame, k }) -> { being, part, at, line, role, left, back, changed, answer }
 * "Where is the being at part k?" — the latest place the telling put them at
 * or before k, and what has happened to them by then, said in plain words
 * with the part and line it was read from.
 */
export function whereIs({ path, frame, k, chapters = null }) {
  const upTo = path.slice(0, k + 1);
  const last = [...upTo].reverse().find((x) => x.seen) ?? null;
  const left = upTo.findIndex((x) => x.at === "away");
  const back = left >= 0 ? upTo.findIndex((x, j) => j > left && x.at === "home") : -1;
  const changed = upTo.findIndex((x) => x.changed);
  const nCh = chapters ?? (path.length ? Math.max(...path.map((x) => x.chapter ?? 0)) + 1 : 0);
  const role = path[k] ? roleAt(BOOK_ARC, path[k].chapter ?? 0, nCh).role : null;
  const where = !last ? "not yet in the telling" : last.at === "home" ? `at ${frame.home}` : last.at === "away" ? `away from ${frame.home}` : "in the telling, with no home on the record to be away from";
  const answer = !frame.p ? "the telling follows no one yet" : `At part ${k + 1} (${role}), ${frame.p} is ${where}${last && last.id !== path[k]?.id ? `, last seen in part ${path.indexOf(last) + 1}` : ""}${last?.line ? ` — "${last.line.text}"` : ""}. ${!frame.home ? "" : left < 0 ? `${frame.p} has not left home yet.` : back >= 0 ? `${frame.p} left in part ${left + 1} and came back in part ${back + 1}.` : `${frame.p} left in part ${left + 1} and has not come back.`} ${changed >= 0 ? `${frame.p} is ${frame.becomes} by part ${changed + 1}.` : frame.becomes ? `${frame.p} is not yet ${frame.becomes}.` : ""}`.trim();
  return { being: frame.p, part: path[k]?.id ?? null, at: last?.at ?? null, line: last?.line ?? null, role, left: left >= 0 ? left : null, back: back >= 0 ? back : null, changed: changed >= 0 ? changed : null, answer };
}

/** A run of parts longer than this with the being unnamed is the being lost
 *  from the telling — set by hand 2026-09-28: a chapter of four scenes. */
export const LOST_RUN = 4;

/**
 * arcChecks({ parts, frame }) -> { findings, path }
 *   parts  [{ id, chapter, lines: [{ text, addr }] }] in order
 *   frame  arcFrame(cast)
 * Findings carry the part whose writing again would answer them, and its role.
 */
export function arcChecks({ parts, frame }) {
  const out = [];
  if (!parts.length || !frame.p) return { findings: out, path: [] };
  const path = trajectory({ parts, frame });
  const nCh = Math.max(...parts.map((p) => p.chapter ?? 0)) + 1;
  const chapter = (c) => path.filter((x) => x.chapter === c);
  const textOf = (c) => parts.filter((p) => p.chapter === c).flatMap((p) => p.lines.map((l) => l.text)).join(" ");
  const firstPart = path[0], lastPart = path.at(-1);
  const lastSeen = [...path].reverse().find((x) => x.seen) ?? null;
  const arrival = BOOK_ARC.at(-1);
  // GEBSER — out from the void and back to it
  if (!path.some((x) => x.at === "away")) out.push({ kind: "never_left", editor: "Jean Gebser", part: path[Math.min(path.length - 1, chapter(0).length)]?.id ?? firstPart.id, role: BOOK_ARC[2], detail: `${frame.p} is never away from ${frame.home ?? "home"}: there is no journey to come back from`, licenses: null });
  if (frame.home && lastSeen?.at !== "home") out.push({ kind: "no_arrival", editor: "Jean Gebser", part: lastPart.id, role: arrival, detail: `the last place ${frame.p} is seen is not ${frame.home}${lastSeen?.line ? ` ("${lastSeen.line.text}")` : ""}: the being never arrives back at the void`, licenses: "regenerate", wants: frame.home });
  if (frame.lack && !says(textOf(nCh - 1), frame.lack) && !says(textOf(nCh - 1), frame.becomes ?? "")) out.push({ kind: "void_unanswered", editor: "Jean Gebser", part: lastPart.id, role: arrival, detail: `the last chapter never answers what was missing (${frame.lack})`, licenses: "regenerate", wants: frame.lack });
  // THE BEING — the same referent, lacking at the start, changed on coming home
  if (frame.lack && !says(textOf(0), frame.lack)) out.push({ kind: "lack_unsaid", editor: "Odysseus (the being)", part: firstPart.id, role: BOOK_ARC[0], detail: `the first chapter never says what ${frame.p} is missing (${frame.lack})`, licenses: "regenerate", wants: frame.lack });
  if (frame.becomes && !chapter(nCh - 1).some((x) => x.changed)) out.push({ kind: "unchanged_return", editor: "Odysseus (the being)", part: lastPart.id, role: arrival, detail: `${frame.p} comes home unchanged: the last chapter never says ${frame.p} is ${frame.becomes}`, licenses: "regenerate", wants: frame.becomes });
  let run = 0;
  for (const x of path) { run = x.seen ? 0 : run + 1; if (run === LOST_RUN + 1) out.push({ kind: "being_lost", editor: "Odysseus (the being)", part: x.id, role: null, detail: `${frame.p} goes unnamed for more than ${LOST_RUN} parts running: the telling has lost the one it follows`, licenses: null }); }
  // THE ROLE — the chapter of the change says the change
  const changeAt = [...Array(nCh).keys()].find((c) => roleAt(BOOK_ARC, c, nCh).role === "the change");
  if (changeAt != null && changeAt > 0 && frame.becomes && !chapter(changeAt).some((x) => x.changed)) out.push({ kind: "role_unplayed", editor: "Odysseus (the being)", part: chapter(changeAt).at(-1).id, role: BOOK_ARC.find((r) => r.role === "the change"), detail: `the chapter of the change never says ${frame.p} is ${frame.becomes}`, licenses: "regenerate", wants: frame.becomes });
  return { findings: out, path };
}
