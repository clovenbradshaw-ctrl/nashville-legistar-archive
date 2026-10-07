// Handle: Bateson — Gregory Bateson, for whom a difference is only a
// difference against a ground, and the ground is what the last difference
// left behind. A part of a book is read against the ground the parts before
// it made; if nothing carries that ground forward, every part begins from
// nothing.
//
// carried-ground.js — THE GROUND ROW, filled (ONE-PIPELINE.md, "The missing
// elements", family A). Before this, the only thing carried from one part to
// the next was the last two sentences. Each fact below is the engine's, read
// from the bodies already set down (organs/read-back.js), and reaches the
// mouth as a plain sentence in the working note:
//
//   CON·Ground (Field · Tending)        who was there when the last part
//                                       ended, and where the being is —
//                                       carried, appended, never judged
//   REC·Ground (Atmosphere · Cultivating) story time: each next-day phrase in
//                                       the prose advances the day, and the
//                                       note says which day it is
//   SYN·Ground (Field · Cultivating)    the book so far: strangers the prose
//                                       made recur (cleared, NUL·Figure) are
//                                       compiled into the ground as people
//                                       also in the story
//   EVA·Ground (Atmosphere · Tending)   the gate: what is carried is what the
//                                       recent ground still holds — a
//                                       particular unseen for LOOKBACK parts
//                                       is dropped, and the field never
//                                       exceeds FIELD_FACTS sentences
//
// The falsification control is the same field computed for ANOTHER part
// (mode "shuffled"): the same machinery in the wrong place. No regular
// expressions.
import { readBack, clearance, hasName } from "./read-back.js";
import { arcFrame, trajectory } from "./narrative-arc.js";

export const CARRIED_GROUND_SCHEMA = "CarriedGround@1";
/** The field's size bound, in sentences — set by hand 2026-09-28: the
 *  working note's facts about the people already run to four or five. */
export const FIELD_FACTS = 4;
/** A particular unseen for this many parts has left the ground — set by
 *  hand 2026-09-28: two chapters of four scenes. */
export const LOOKBACK = 8;
/** Sentences at a part's end read as its close — set by hand 2026-09-28,
 *  long-form's own TAIL_SENTENCES count plus one. */
export const CLOSE_SENTENCES = 3;
/** Phrases that move the story to a later day — set by hand 2026-09-28
 *  (English; each advances the day by one). */
export const NEXT_DAY = Object.freeze(["the next morning", "the next day", "the following day", "the following morning", "next morning", "the morning after", "days later", "a week later", "weeks later", "the day after"]);

const lower = (s) => String(s).toLowerCase();
// the longest phrase first, and a phrase counted once ("the next morning" is
// not also "next morning")
const BY_LENGTH = [...NEXT_DAY].sort((a, b) => b.length - a.length);
const nextDays = (text) => { const t = lower(text); let n = 0, i = 0; while (i < t.length) { const p = BY_LENGTH.find((x) => t.startsWith(x, i) && (i === 0 || t[i - 1] === " ")); if (p) { n++; i += p.length; } else i++; } return n; };
const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0]);
const ordinal = (n) => ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"][n - 1] ?? `${n}th`;

/**
 * groundAt({ parts, k, cast, sentences, known }) -> { facts, day, present, strangers }
 *   parts  [{ id, chapter, lines: [{ text, addr }] }] — the bodies set down so far, in order
 *   k      the index of the part about to be written (parts.slice(0, k) are read)
 *   cast   the outline's cast things (with props), in order
 */
export function groundAt({ parts, k, cast, sentences, known = [], only = null }) {
  // only: a set of the elements to carry ("con", "rec", "syn") — the
  // ablation carries one at a time; null carries all
  const before = parts.slice(0, k).filter((p) => p.lines.length);
  if (!before.length) return { facts: [], day: 1, present: [], strangers: [] };
  const people = cast.map((c) => ({ id: c.id, name: c.name }));
  const read = readBack({ parts: before, cast: people, sentences, known });
  const facts = [];
  const on = (e) => !only || only.has(e);
  // CON·Ground — who was there at the close of the last part
  const last = before.at(-1);
  const closing = last.lines.flatMap((l) => sentences(l.text).map((s) => s.text)).slice(-CLOSE_SENTENCES);
  const present = people.filter((c) => closing.some((t) => hasName(t, c.name))).map((c) => c.name);
  if (on("con") && present.length) facts.push(`When the part before ended, ${list(present)} ${present.length > 1 ? "were" : "was"} there.`);
  // CON·Ground — where the being is (the Odysseus question, carried)
  const frame = arcFrame(cast);
  if (on("con") && frame.p && frame.home) {
    const path = trajectory({ parts: before, frame });
    const seen = [...path].reverse().find((x) => x.seen);
    if (seen?.at === "home") facts.push(`${frame.p} is at ${frame.home}.`);
    else if (seen?.at === "away") facts.push(`${frame.p} is away from ${frame.home}.`);
  }
  // REC·Ground — story time, advanced by the prose's own next-day phrases
  const day = 1 + before.reduce((a, p) => a + nextDays(p.lines.map((l) => l.text).join(" ")), 0);
  if (on("rec")) facts.push(`It is the ${ordinal(day)} day of the story.`);
  // SYN·Ground, gated by EVA·Ground — strangers the prose made recur,
  // compiled into the ground while the recent parts still hold them
  const cleared = clearance(read).established;
  const recent = cleared.filter((e) => read.parts.slice(-LOOKBACK).some((p) => p.strangers[e.name])).map((e) => e.name);
  if (on("syn") && recent.length) facts.push(`${list(recent.slice(0, 3))} ${recent.length > 1 ? "are" : "is"} also in the story.`);
  return { facts: facts.slice(0, FIELD_FACTS), day, present, strangers: recent };
}
