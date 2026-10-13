// fold-chat-exchange.js — the discourse summary the model is told, built from the EXCHANGE and nothing else. Pure: no DOM, no IO, no model.
//
// "It doesn't get swamped by the research; it's about the communication between the user and the system." (user, 2026-10-06)
// What the model hears about the conversation so far is what the PERSON asked and what the FOLD SAID (the spoken text, after the Pivot read it) —
// not what the web returned. A retrieved page title, a cited-source count or a page's own sentence never enters it. When the fold said nothing of
// its own (it showed the sources' words, it could not answer, it was stopped, a fixed line) the summary records that ACT, never the page's text.
//
//   exchangesOf(messages)            → [{ n, ask, act, said }]     act: answered | showed-sources | no-answer | stopped | failed | fixed-line
//   exchangeFlow(exchanges, opts)    → one plain line: "so far, in order — they asked "…" and I said "…"; …" (bounded; older ones counted)
//   exchangeTopic(exchanges)         → what the conversation is ABOUT: the latest ask the fold answered, as the person wrote it (bounded)
//   usedRefs({ pivot, record })      → the source refs a SPOKEN sentence was actually witnessed by (the only pages that may name a referent)
//   foldAnswer({ text, strand })     → the answer string the fold line records: the spoken text, or the ACT when the words were not the fold's
//   applyExchange(summary, session)  → the summary with topic/flow replaced by the exchange's (entities/context/records left as they are)
//
// DECLARED, not measured (Constitution II.11): the bounds. Giver: the author, 2026-10-06; sized so the whole line stays under ~700 characters.

export const EXCHANGE = Object.freeze({ giver: "the author, 2026-10-06; declared, not measured (II.11)", maxExchanges: 6, askChars: 90, saidChars: 90 });

const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const firstSentence = (s) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); const m = /^(.+?[.!?。！？])(?:\s|$)/u.exec(t); return m ? m[1] : t; };

/** The act a stored assistant message performed. Only `answered` carries the fold's own words. */
export function actOf(m) {
  const text = String(m?.content ?? "").trim();
  if (m?.authored === "sources") return "showed-sources";
  const kinds = (m?.notices || []).map((n) => n && n.kind);
  if (!text && kinds.includes("stopped")) return "stopped";
  if (!text && kinds.some((k) => k === "error" || k === "declined")) return "failed";
  if (!text && kinds.some((k) => k === "alone" || k === "no-sources")) return "fixed-line";
  if (!text) return "no-answer";
  return "answered";
}

/** Each ask the person made that the fold has replied to, in order. Attachments and bare "Continue." turns are not exchanges. */
export function exchangesOf(messages) {
  const out = []; let ask = null;
  for (const m of messages || []) {
    if (m?.role === "user") ask = m.attachment || /^continue\.?$/i.test(String(m.content || "").trim()) ? null : m;
    else if (m?.role === "assistant" && ask) {
      const act = actOf(m);
      out.push({ n: out.length + 1, ask: String(ask.content || "").trim(), act, said: act === "answered" ? firstSentence(m.content) : "" });
      ask = null;
    }
  }
  return out;
}

const ACT_WORDS = Object.freeze({ "showed-sources": "I showed the sources' own words", "no-answer": "I could not answer", stopped: "I was stopped before answering", failed: "I could not answer (the turn failed)", "fixed-line": "I replied with a fixed line" });
const said = (e, o) => (e.act === "answered" ? `I said "${clip(e.said, o.saidChars)}"` : ACT_WORDS[e.act]);

export function exchangeFlow(exchanges, opts = {}) {
  const o = { ...EXCHANGE, ...opts };
  const list = Array.isArray(exchanges) ? exchanges : [];
  if (!list.length) return null;
  const recent = list.slice(-o.maxExchanges), older = list.length - recent.length;
  const parts = recent.map((e) => `they asked "${clip(e.ask, o.askChars)}" and ${said(e, o)}`);
  const head = older > 0 ? `${older} earlier exchange${older === 1 ? "" : "s"} (the first opened on "${clip(list[0].ask, 60)}"); then ` : "";
  return `So far, in order: ${head}${parts.join("; ")}.`;
}

/** What the conversation is ABOUT: the latest ask the fold actually answered (a tangent that got a fixed line, a gap or only a page's words does not move it), else the latest ask. */
export const exchangeTopic = (exchanges) => {
  const l = Array.isArray(exchanges) ? exchanges : [];
  if (!l.length) return null;
  const answered = [...l].reverse().find((x) => x.act === "answered");
  return clip((answered || l[l.length - 1]).ask, 120);
};

/** The refs of the sources a spoken sentence was witnessed by: the Pivot's own `support` addresses (`<ref>#<from>-<to>`), else the record's. */
export function usedRefs({ pivot = null, record = null } = {}) {
  const refs = new Set();
  for (const u of pivot?.units || []) if (u?.support) refs.add(String(u.support).split("#")[0]);
  if (!refs.size && !pivot) for (const r of record?.sources || []) if (r?.address) refs.add(String(r.address).split("#")[0]);
  return refs;
}

/** What the fold line records as the fold's answer: its spoken words, or the ACT when the words on screen were a page's (a strand) or absent. */
export function foldAnswer({ text = "", strand = null } = {}) {
  if (strand) return "(showed the sources' own words)";
  return String(text ?? "").trim() ? String(text) : "(no answer)";
}

/** Replace the summary's topic and flow with the exchange's. Entities, context, records and folds are the caller's and are left alone. */
export function applyExchange(summary, session, opts = {}) {
  if (!summary) return summary;
  const ex = exchangesOf(session?.messages);
  if (!ex.length) return summary;
  return { ...summary, topic: exchangeTopic(ex) || summary.topic, flow: exchangeFlow(ex, opts) || summary.flow };
}
