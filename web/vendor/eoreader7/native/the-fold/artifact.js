// artifact.js — an answer is not always prose.
//
// When a turn produces a table, a block of code, or a page, printing it as a
// run of characters makes the reader do the rendering in their head. This
// module reads the shape off the text — mechanically, the same way retrieval
// reads relevance off the question — and hands back typed segments the page
// can render as what they are.
//
// Nothing here asks a model what format its output was in. The model already
// said, in the only way that can be checked: it wrote a fence, or it wrote a
// row of pipes.
//
// Pure: no DOM, no IO. `parseSegments` is the whole surface.

const FENCE = /^[ \t]*(?:```|~~~)[ \t]*([\w+-]*)[ \t]*$/;

/**
 * Split an answer into a list of segments:
 *   {type:"prose", text}
 *   {type:"code", lang, code}
 *   {type:"table", head:[…], rows:[[…]]}
 *
 * A fence that never closes is still a code segment — a truncated answer is
 * exactly when you most want to see the code as code.
 */
export function parseSegments(answer) {
  const lines = String(answer ?? "").split("\n");
  const out = [];
  let prose = [];

  const flushProse = () => {
    const text = prose.join("\n").trim();
    if (text) out.push({ type: "prose", text });
    prose = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].match(FENCE);
    if (fence) {
      flushProse();
      const lang = (fence[1] || "").toLowerCase();
      const body = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      out.push({ type: "code", lang, code: body.join("\n") });
      continue;
    }

    const table = readTable(lines, i);
    if (table) {
      flushProse();
      out.push(table.segment);
      i = table.end;
      continue;
    }

    prose.push(lines[i]);
  }
  flushProse();
  return out;
}

const SCRIPTABLE = new Set(["javascript", "js"]);

/**
 * A model asked for one html widget routinely answers with the markup as one
 * fence and "you'll need to add some JavaScript" as prose before a SEPARATE
 * fence — one artifact in the model's own head, two segments on the page.
 * Left alone, widget.js's kind match (html ≠ javascript) forks them into two
 * builds, and the javascript one auto-runs standalone with no DOM at all
 * (term.js's sandbox is a bare Worker) — a guaranteed ReferenceError, and a
 * counter whose buttons do nothing because the code that would wire them
 * never reaches the markup it names by id.
 *
 * The merge is deliberately narrow — exactly one html segment and exactly
 * one javascript/js segment, html first — because that is the one shape
 * unambiguous enough to act on mechanically: which script belongs to which
 * markup is a guess the moment either count is more than one, and a guess is
 * what this repo's own doctrine refuses elsewhere (widget.js's routing, the
 * skill slot-filler). `toDocument` drops html code into a bare `<!doctype>`
 * shell with no head/body requirement, so appending the script tag at the
 * end is sufficient — the browser completes the fragment either way.
 */
export function mergeHtmlScript(segments) {
  const isHtml = (s) => s.type === "code" && s.lang === "html";
  const isJs = (s) => s.type === "code" && SCRIPTABLE.has(s.lang);
  const htmlIdx = segments.reduce((a, s, i) => (isHtml(s) ? [...a, i] : a), []);
  const jsIdx = segments.reduce((a, s, i) => (isJs(s) ? [...a, i] : a), []);
  if (htmlIdx.length !== 1 || jsIdx.length !== 1 || htmlIdx[0] > jsIdx[0]) return segments;
  const [hi] = htmlIdx;
  const [ji] = jsIdx;
  const merged = segments.slice();
  merged[hi] = { ...merged[hi], code: `${merged[hi].code}\n<script>\n${merged[ji].code}\n</script>` };
  merged.splice(ji, 1);
  return merged;
}

/**
 * A pipe table is a header row, a delimiter row of dashes, and rows until the
 * pipes stop. The delimiter row is what distinguishes a table from a sentence
 * that happens to contain a pipe, so it is required.
 */
function readTable(lines, start) {
  const head = splitRow(lines[start]);
  if (!head) return null;
  const delim = splitRow(lines[start + 1]);
  if (!delim || !delim.length || !delim.every((c) => /^:?-{1,}:?$/.test(c.trim())))
    return null;
  if (delim.length !== head.length) return null;

  const rows = [];
  let i = start + 2;
  for (; i < lines.length; i++) {
    const row = splitRow(lines[i]);
    if (!row) break;
    // Ragged rows are kept, padded or trimmed to the header — a model that
    // drops a trailing cell should still produce a readable table.
    rows.push(
      Array.from({ length: head.length }, (_, c) => (row[c] ?? "").trim()),
    );
  }
  if (!rows.length) return null;
  return { segment: { type: "table", head: head.map((h) => h.trim()), rows }, end: i - 1 };
}

function splitRow(line) {
  if (typeof line !== "string") return null;
  const t = line.trim();
  if (!t.includes("|")) return null;
  // A row wrapped in pipes is a row even with one column; without the outer
  // pipes it needs at least two cells, so a lone pipe mid-sentence is prose.
  // Either way the delimiter row is what finally decides.
  const wrapped = t.length > 1 && t.startsWith("|") && t.endsWith("|");
  // Split on unescaped pipes only, then unescape. A cell is allowed to contain
  // a pipe — a fold line or a gist can hold anything — and without this a
  // single pipe in a value silently shifts every column after it.
  const cells = t
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.replace(/\\\|/g, "|"));
  return wrapped || cells.length > 1 ? cells : null;
}

/**
 * Build a table segment from data the caller already holds — the same shape
 * `parseSegments` produces from text, so both paths render identically.
 *
 * This is the half that does not go through a model at all. Retrieval results,
 * records, sources: these are rows before anything is said about them, and
 * asking a model to format rows it was handed is a round trip that can only
 * lose. `columns` is a list of {label, get}; every cell is coerced to a string
 * here so the renderer never has to think about types.
 */
export function tableFrom(items, columns) {
  const rows = [...items].map((item, i) =>
    columns.map((c) => {
      const v = c.get(item, i);
      return v == null ? "" : String(v);
    }),
  );
  return { type: "table", head: columns.map((c) => c.label), rows };
}

/**
 * Build a bar-chart segment from data the caller already holds — tableFrom's
 * discipline, one rung up: a chart of loaded rows is a projection of bytes
 * the app can already address, so no model ever types a figure into one.
 * The output is a code segment (lang "svg") — the same shape parseSegments
 * yields for model-fenced SVG — so it rides every downstream organ
 * unchanged: publishBuild deposits it, toDocument walls it, and it renders
 * in the sandbox with no scripts and no run-consent needed.
 *
 * `spec` is {x:{label,get}, y:{label,get}, title}. y values coerce with
 * Number(); a row whose y is not finite is dropped and counted in the
 * returned `dropped` — a gap is a result, never a silent omission. All
 * geometry below is presentation (like toDocument's centering style), not
 * thresholds: nothing here decides what the data says.
 */
export function chartFrom(items, spec) {
  const rows = [];
  let dropped = 0;
  [...items].forEach((item, i) => {
    const y = Number(spec.y.get(item, i));
    const x = spec.x.get(item, i);
    if (!Number.isFinite(y)) return void dropped++;
    rows.push({ x: x == null ? "" : String(x), y });
  });
  if (!rows.length)
    return { type: "code", lang: "svg", code: "", rows: 0, dropped };

  const W = 720, H = 400, PAD = { top: 44, right: 12, bottom: 64, left: 12 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const max = Math.max(...rows.map((r) => r.y));
  const slot = plotW / rows.length;
  const barW = Math.max(1, slot * 0.72);

  const bars = rows
    .map((r, i) => {
      // An all-zero series still draws its baseline — height 0, never NaN.
      const h = max > 0 ? (r.y / max) * plotH : 0;
      const bx = PAD.left + i * slot + (slot - barW) / 2;
      const by = PAD.top + plotH - h;
      const cx = PAD.left + i * slot + slot / 2;
      return (
        `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="var(--accent)" opacity="0.85"/>` +
        `<text x="${cx.toFixed(1)}" y="${(by - 6).toFixed(1)}" text-anchor="middle" font-size="12" fill="var(--ink)">${esc(r.y)}</text>` +
        `<text x="${cx.toFixed(1)}" y="${(PAD.top + plotH + 16).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--muted)" transform="rotate(40 ${cx.toFixed(1)} ${(PAD.top + plotH + 16).toFixed(1)})">${esc(r.x)}</text>`
      );
    })
    .join("\n");

  const code =
    // width/height ride along with the viewBox: an SVG with only a viewBox
    // has a ratio but no intrinsic size, and toDocument's max-width/max-height
    // wrapper has nothing to constrain — measured live, the frame rendered
    // nothing. Explicit size makes the artifact whole in any container.
    `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(spec.title ?? "")}">\n` +
    // Its own ground and its own theme: the artifact is downloadable and
    // renders inside a sandboxed frame that cannot read the page's variables,
    // so it carries the whole palette and paints its own background.
    `<style>${themeCss()}</style>\n` +
    `<rect width="${W}" height="${H}" fill="var(--bg)"/>\n` +
    (spec.title ? `<text x="${W / 2}" y="24" text-anchor="middle" font-size="16" font-weight="600" fill="var(--ink)">${esc(spec.title)}</text>\n` : "") +
    `<line x1="${PAD.left}" y1="${PAD.top + plotH}" x2="${W - PAD.right}" y2="${PAD.top + plotH}" stroke="var(--line)"/>\n` +
    bars +
    `\n</svg>`;
  return { type: "code", lang: "svg", code, rows: rows.length, dropped };
}

/** Languages whose artifact is the thing itself, rendered. */
export const RENDERABLE = new Set(["html", "svg"]);

/**
 * The palette, written twice, and the theme block every built artifact
 * carries. A rendered segment lives in a sandboxed frame that cannot read
 * index.html's custom properties, so an artifact that borrowed `var(--accent)`
 * from the page would draw invisibly on its own — and a downloaded one would
 * have no colors at all. Each artifact therefore carries the whole palette and
 * its own three-state switch: system by default, an explicit `data-theme`
 * winning in both directions, exactly as the page does one document up.
 */
export const PALETTE = Object.freeze({
  light: Object.freeze({
    bg: "#ffffff", panel: "#ffffff", ink: "#111113", muted: "#5f5f68",
    line: "#dcdce3", accent: "#6d28d9", accentSoft: "#f3eeff", warn: "#b42318",
  }),
  dark: Object.freeze({
    bg: "#0f0f12", panel: "#15151a", ink: "#ecebf0", muted: "#9b9aa5",
    line: "#2b2b34", accent: "#a78bfa", accentSoft: "#1e1932", warn: "#f0857a",
  }),
});

export const SANS = `-apple-system, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", Roboto, sans-serif`;
export const MONO = `ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace`;

export function themeCss(extra = "") {
  const vars = (p) =>
    Object.entries(p)
      .map(([k, v]) => `--${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}:${v}`)
      .join(";");
  return (
    `:root{${vars(PALETTE.light)};--sans:${SANS};--mono:${MONO}}` +
    `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${vars(PALETTE.dark)}}}` +
    `:root[data-theme="dark"]{${vars(PALETTE.dark)}}` +
    `text{font-family:var(--sans)}` +
    extra
  );
}

/** One escape, used by every builder that puts data into markup. */
export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A page built from a code segment, for rendering inside a sandboxed frame.
 * SVG is wrapped so it fills the frame; HTML is passed through as authored.
 */
/**
 * The no-network wall, injected into every rendered document. When a build
 * earns scripts (the operator's run consent, below in app.js), what it earns
 * is COMPUTE — canvas, animation, interaction — never the network: no
 * connect-src, no external scripts, styles, images, or frames. This is the
 * local-only rule (P1) applied to model-authored pages by physics rather
 * than trust, and it holds whether or not the sandbox grants scripts. A CSP
 * meta governs everything parsed after it, which is why it is prepended
 * before the model's own markup.
 */
const CSP_META =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:;">`;

/**
 * `dark` is the parent's own resolved theme (app.js's isDarkNow — this
 * module stays pure, no DOM, so it never reads it itself), for the html
 * branch only. A model's own markup carries none of this app's theme
 * awareness — it never saw index.html's CSS variables and was never asked
 * to write code that adapts (the house rule: never instruct a model to
 * mimic a property in language, compute it mechanically outside it). A
 * color-inversion filter is that mechanical adaptation: it never asks the
 * model to redraw itself for the occasion, and it costs nothing when a
 * segment happens to already look fine — an unstyled or transparent widget
 * inverts to itself. Media (an embedded photo or video) is re-inverted back
 * to normal, so a picture never renders as its own negative; only the flat
 * UI color a model actually chose gets flipped.
 *
 * Left alone on purpose: the svg branch. This app's own mechanically-built
 * charts (artifact.js's chartFrom) already carry a real theme block
 * (themeCss/PALETTE, var(--bg) etc.) rather than hardcoded colors, and
 * inverting on top of that would un-invert an already-correct dark
 * rendering. A model-authored raw SVG with hardcoded colors has the same
 * gap this closes for HTML; scoped out for now rather than guessing which
 * kind of svg a given segment is.
 */
export function toDocument(seg, { dark = false } = {}) {
  if (seg.lang === "svg")
    return `<!doctype html><meta charset="utf-8">${CSP_META}<style>html,body{margin:0;height:100%;display:grid;place-items:center;background:transparent}svg{max-width:100%;max-height:100%}</style>${seg.code}`;
  const darkCss = dark
    ? `<style>html{filter:invert(1) hue-rotate(180deg)}img,video,picture,canvas{filter:invert(1) hue-rotate(180deg)}</style>`
    : "";
  return `<!doctype html>${CSP_META}${darkCss}${seg.code}`;
}
