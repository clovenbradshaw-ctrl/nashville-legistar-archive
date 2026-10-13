// fold-chat-originwire.js — the PASSAGE-level half of "an encyclopedia is a pointer, never a citation" (fold-chat-origin.js follows ONE claim;
// this follows every encyclopedia page a turn read). No DOM, no model; the network arrives as `fetchImpl`.
//
//   originatePassages(passages, question, { fetchImpl, memo, signal, read, boxMs }) → { trails }
//
// For each encyclopedia passage the turn read, the sentences the Sources-only strand WOULD quote from it (`snipsOf`, the question's own cut) are
// followed to the pages the article's footnotes name (or to a page the turn already read that says the same, by the project's identity — see
// fold-chat-origin.js). MUTATES `passages` in place (so every later step, indexed by position, sees one list):
//   * a footnote's page that carries the claim is APPENDED as a passage { origin: true, holons: [{ start, end, address, via }], foundVia } — the
//     holon is the sentence of that page the claim rests on, identified by its address;
//   * the encyclopedia passage is marked `tertiary: true` with `origins` (the pages read), `pointers` (the pages it points at that were not
//     read or did not carry the claim) and `trails` (the path to each, slim). It stays in the list, so what the model reads and the record keeps
//     is unchanged — but it is never cited: strand.js shows its originals (or marks what it shows a pointer), the chips and the attribution
//     check treat it as a pointer.
import { followClaim, slimTrail, pageKey, isTertiary, readFrame, ORIGIN } from "./fold-chat-origin.js";
import { snipsOf } from "./fold-chat-strand.js";
import { splitSentences } from "./fold-chat-ground.js";
import { readText } from "./fold-chat-web.js";

const asArr = (a) => (Array.isArray(a) ? a : []);
const urlOf = (p) => (p && (p.url || (/^https?:/i.test(String(p.source || "")) ? p.source : ""))) || "";
const aWhile = (p, ms, fallback) => new Promise((resolve) => { const t = setTimeout(() => resolve(fallback), ms); p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback); }); });
export const MAX_CLAIMS = 3;      // sentences followed per encyclopedia passage (declared, not measured: a lead's first sentences are what the strand quotes)

/** The claims of an encyclopedia passage: the SENTENCES of what the strand would show from it for this question (a lead is several sentences, and each has its
 *  own footnotes and its own page — a multi-sentence "claim" could never be the same as one page sentence). At most MAX_CLAIMS, in the strand's order. */
function claimsOf(p, question) {
  try {
    const snips = snipsOf([{ ...p, tertiary: false, origins: undefined }], question).snips.filter((s) => s.kind === "lead" || s.kind === "passage");
    const out = [];
    for (const sn of snips) for (const sent of splitSentences(String(sn.text))) {
      if (sent.trim().split(/\s+/).length < 5 || out.includes(sent)) continue;   // a heading or a fragment is no claim
      out.push(sent); if (out.length >= MAX_CLAIMS) return out;
    }
    return out;
  } catch { return []; }
}

export async function originatePassages(passages, question, { fetchImpl = globalThis.fetch, memo = null, signal = null, read = readText, boxMs = ORIGIN.turnBoxMs, reading, meaning = null } = {}) {
  const list = Array.isArray(passages) ? passages : null;
  if (!list) return { trails: [] };
  const wiki = list.map((p, i) => ({ p, i })).filter(({ p }) => p && typeof p.text === "string" && p.text.trim() && !p.snippetOnly && !p.tertiary && isTertiary(urlOf(p)));
  if (!wiki.length) return { trails: [] };
  const frameRead = reading !== undefined ? reading : await aWhile(readFrame(question, { fetchImpl }), 4000, null);   // the asker's frame: the cut the claims are compared under
  const alongside = list.filter((p) => p && !isTertiary(urlOf(p)));
  const jobs = [];
  for (const { p } of wiki) for (const claim of claimsOf(p, question)) jobs.push({ p, claim });
  const fallback = (p) => ({ status: "unread", found: { kind: "wikipedia", title: p.title || "", url: urlOf(p), edition: null }, refs: [], path: [], tried: [], origin: null });
  const results = await Promise.all(jobs.map(async (j) => ({ ...j, trail: await aWhile(followClaim({ sentence: j.claim, passage: { url: urlOf(j.p), title: j.p.title, ref: j.p.ref, text: j.p.text }, fetchImpl, memo, read, signal, alongside, forWhom: question, reading: frameRead, meaning }), boxMs, fallback(j.p)) })));
  for (const { p } of wiki) { p.tertiary = true; p.origins = []; p.pointers = []; p.trails = []; }
  const trails = [];
  for (const { p, claim, trail } of results) {
    const slim = slimTrail(trail);
    p.trails.push({ claim, ...slim });
    trails.push({ url: urlOf(p), claim, trail: slim });
    if (trail.status === "origin" && trail.origin && trail.origin.address) {
      const o = trail.origin;
      let op = list.find((x) => x && !isTertiary(urlOf(x)) && pageKey(urlOf(x)) === pageKey(o.url));
      if (!op) { op = { ref: `${o.host} — ${o.title || o.host}`, title: o.title || o.host, url: o.url, source: o.url, text: String(o.passage && o.passage.text || ""), via: o.via || null, origin: true, foundVia: slim }; list.push(op); }
      const m = /#(\d+)-(\d+)$/.exec(o.address);
      (op.holons ||= []);
      if (m && !op.holons.some((h) => h.address === o.address)) op.holons.push({ start: Number(m[1]), end: Number(m[2]), address: o.address, via: slim });
      if (!p.origins.some((x) => pageKey(x.url) === pageKey(o.url))) p.origins.push({ url: o.url, title: o.title || o.host, host: o.host });
    } else {
      for (const r of asArr(trail.refs)) if ((r.url || r.archived) && !p.pointers.some((x) => pageKey(x.url) === pageKey(r.url || r.archived))) p.pointers.push({ url: r.url || r.archived, label: r.label || r.host || r.url, n: r.n });
    }
  }
  return { trails };
}
