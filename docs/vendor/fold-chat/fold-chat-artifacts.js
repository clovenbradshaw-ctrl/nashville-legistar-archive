// fold-chat-artifacts.js — the LibreChat-style artifact affordance, pure.
//
// An artifact is generative output rendered as a thing, not a paragraph: an
// interactive HTML preview, a Mermaid diagram, a runnable-looking code block,
// a table. The parser turns an assistant reply into prose + artifact blocks
// so the chat surface can present them like LibreChat does. Pure and
// node-testable; rendering lives in fold-chat.js.
//
// Detection is deterministic, never the model's word: fenced code blocks are
// the contract, plus an explicit artifact declaration when the model wants a
// titled artifact (a JSON block beginning `{"schema":"fold.artifact",...}`).

export const ARTIFACT_LANGS = Object.freeze({
  html: "html",
  htmx: "html",
  mermaid: "mermaid",
  js: "code",
  javascript: "code",
  ts: "code",
  tsx: "code",
  jsx: "code",
  py: "code",
  python: "code",
  sql: "code",
  json: "code",
  css: "code",
  sh: "code",
  bash: "code",
  text: "text",
});

/** True when an assistant message contains at least one artifact. */
export function hasArtifacts(text) {
  return /```/.test(String(text ?? ""));
}

/** Parse an assistant reply into blocks. Returns
 *  [{ kind: 'prose'|'artifact', text, artifact? }] where artifact is
 *  { kind: 'html'|'mermaid'|'code'|'text', lang, title, code }. The prose is
 *  everything between artifacts, so rendering can present artifacts as cards
 *  and keep the surrounding words as words. */
export function artifactsOf(text) {
  const src = String(text ?? "");
  if (!src) return [{ kind: "prose", text: "" }];
  const out = [];
  const re = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m;
  let codeIndex = 0;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push({ kind: "prose", text: src.slice(last, m.index) });
    const lang = (m[1] || "").toLowerCase().trim();
    const code = m[2].replace(/\n$/, "");
    const art = artifactOf(lang, code, ++codeIndex);
    out.push({ kind: "artifact", text: m[0], artifact: art });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ kind: "prose", text: src.slice(last) });
  return out.length ? out : [{ kind: "prose", text: src }];
}

/** One fenced block -> an artifact spec, or null when the fence is not an
 *  artifact (no known lang, empty code). */
export function artifactOf(lang, code, n = 1) {
  const trimmed = String(code ?? "").trim();
  if (!trimmed) return null;
  const mapped = ARTIFACT_LANGS[lang];
  if (!mapped) return null;
  // An explicit artifact declaration: { "schema":"fold.artifact", "kind":…,
  // "title":… } inside the code — the model names the artifact, the code
  // after the declaration is its body.
  let title = null;
  let kind = mapped;
  let body = trimmed;
  if (lang === "json") {
    try {
      const j = JSON.parse(trimmed);
      if (j && j.schema === "fold.artifact") {
        kind = j.kind || "code";
        title = j.title || null;
        body = String(j.body ?? "");
        if (!body) body = String(j.code ?? "");
      }
    } catch {}
  }
  return { kind, lang: lang || "text", title: title || titleOf(kind, lang, n), code: body };
}

function titleOf(kind, lang, n) {
  const base = { html: "Preview", mermaid: "Diagram", code: "Code", text: "Text" }[kind] || "Artifact";
  return lang ? `${base} · ${lang}` : base;
}

/** The safest artifact kinds render as interactive previews in an isolated
 *  iframe; the rest render as code cards with copy. */
export function previewable(kind) {
  return kind === "html";
}

/** For the artifact list UI: a one-line description of each artifact. */
export function artifactSummary(text) {
  return artifactsOf(text).filter((b) => b.kind === "artifact").map((b) => ({
    title: b.artifact.title,
    kind: b.artifact.kind,
    lang: b.artifact.lang,
  }));
}