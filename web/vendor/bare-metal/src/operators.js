// operators.js — LOCAL SHIM for bare-metal-eo-matrix-app/src/operators.js.
// Upstream's module emits operators to a Matrix room (client.js + outbox.js).
// Holodeck folds a log it builds in the tab and sends nothing, so only the
// pure half is kept here, byte-for-byte in behaviour: OP, eventType,
// parseEventType, the namespace, cyrb53. fold.js imports this unchanged.
let NS = 'io.holodeck';
export function setNamespace(namespace) { NS = namespace; }
export function getNamespace() { return NS; }
export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
export const OP = {
  NUL: { key: 'nul', glyph: '∅', triad: 'existence', order: 0, stored: false },
  SIG: { key: 'sig', glyph: '○', triad: 'existence', order: 1, stored: false },
  INS: { key: 'ins', glyph: '●', triad: 'existence', order: 2, stored: true },
  SEG: { key: 'seg', glyph: '｜', triad: 'structure', order: 3, stored: true },
  CON: { key: 'con', glyph: '⋈', triad: 'structure', order: 4, stored: true },
  SYN: { key: 'syn', glyph: '△', triad: 'structure', order: 5, stored: true },
  DEF: { key: 'def', glyph: '⊢', triad: 'significance', order: 6, stored: true },
  EVA: { key: 'eva', glyph: '⊨', triad: 'significance', order: 7, stored: true },
  REC: { key: 'rec', glyph: '◉', triad: 'significance', order: 8, stored: true },
};
export function eventType(op) { return `${NS}.${op.key}`; }
export function parseEventType(type) {
  if (typeof type !== 'string' || !type.startsWith(NS + '.')) return null;
  const suffix = type.slice(NS.length + 1);
  return Object.values(OP).find(op => op.key === suffix) || null;
}
