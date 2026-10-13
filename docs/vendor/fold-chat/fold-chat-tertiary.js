// fold-chat-tertiary.js — which hosts are POINTERS, never citations. Pure; no imports, so any module (attribution, strand, the sources panel) may ask.
//
// Declared, not measured (Constitution II.11). Giver: the user, 2026-10-06 — "wikipedia should not be cited, it should be a pointer to original
// sources that should be fetched, with the path there tracked" (fold-chat-origin.js does the fetching and the tracking). Add a host here and the
// whole chat treats it the same way.
export const TERTIARY = Object.freeze([
  Object.freeze({ id: "wikipedia", host: /(^|\.)wikipedia\.org$/i }),
]);

const hostOf = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return ""; } };

/** The declared pointer-host a URL belongs to, or null. */
export const tertiaryOf = (url) => { const h = hostOf(url); return (h && TERTIARY.find((t) => t.host.test(h))) || null; };
export const isTertiary = (url) => !!tertiaryOf(url);
