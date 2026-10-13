// fold-chat-render.js — markdown → safe HTML for chat bodies, pure.
//
// The fold's answers are rendered, never dumped: headings, bold/italic/code,
// links, lists (nested), blockquotes, tables, rules, and fenced code become
// real markup so a written answer reads like a written answer. Everything the
// model wrote is escaped FIRST; only the tags this module itself emits
// survive, so a reply can never smuggle in a script or a javascript: href
// (links are restricted to http/https/mailto and relative/fragment targets).
// The fenced html/mermaid/code artifact cards stay handled by
// fold-chat-artifacts.js — this module renders the prose around them.
//
// Pure and node-testable; fold-chat.js calls mdHtml(text) and inserts the
// result as innerHTML.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** Links may only point at http/https/mailto, a fragment, or a relative path.
 *  Anything else (javascript:, data:, vbscript:) is refused outright. */
function safeUrl(href) {
  const h = String(href ?? "").trim();
  if (!h || h.startsWith("javascript:") || h.startsWith("data:") || h.startsWith("vbscript:")) return null;
  if (/^https?:|^mailto:|^#|^\//i.test(h)) return h;
  if (/^\.{1,2}\//.test(h)) return h;
  return null;
}

/** The inline pass — runs on already-escaped text, so the markers below are
 *  matched on clean source and every emitted attribute stays escaped. */
function inline(t) {
  const src = String(t ?? "");
  return esc(src)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/&lt;(https?:\/\/[^&<>\s]+)&gt;/g, '<a href="$1" rel="noopener noreferrer" target="_blank">$1</a>')
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, srcUrl) => {
      const u = safeUrl(srcUrl);
      return u ? `<img src="${u}" alt="${alt}" loading="lazy">` : `!${alt}`;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
      const u = safeUrl(href);
      return u ? `<a href="${u}" rel="noopener noreferrer" target="_blank">${label}</a>` : label;
    })
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^\w*])\*([^*\n]+)\*(?=$|[^\w*])/g, "$1<em>$2</em>")
    .replace(/(^|[^\w_])_([^_\n]+)_(?=$|[^\w_])/g, "$1<em>$2</em>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
    .replace(/\n/g, "<br>");
}

/* ---------------- lists (nested, via indentation) ---------------- */

const isListLine = (line) => /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
const listTypeOf = (line) => (/^\s*[-*+]/.test(line) ? "ul" : "ol");
const listIndent = (line) => line.replace(/\t/g, "    ").length - line.trim().length;
const listContent = (line) => line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "");

/** Parse one contiguous list region, recursing on deeper indents, and return
 *  { html, next } so the caller can continue past the block. */
function parseList(lines, start) {
  const base = listIndent(lines[start]);
  const type = listTypeOf(lines[start]);
  let html = "<" + type + ">";
  let i = start;
  let openLi = false;
  let blankSeen = false;
  const closeLi = () => { if (openLi) { html += "</li>"; openLi = false; } };
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { blankSeen = true; i++; continue; }
    if (!isListLine(line)) {
      if (blankSeen || !openLi) { closeLi(); html += "</" + type + ">"; return { html, next: i }; }
      html += "<br>" + inline(line.trim()); i++; continue;
    }
    const d = listIndent(line);
    if (d === base) {
      if (blankSeen && openLi) { closeLi(); html += "<li>" + inline(listContent(line)); }
      else { closeLi(); html += "<li>" + inline(listContent(line)); }
      openLi = true; blankSeen = false; i++;
    } else if (d > base) {
      if (!openLi) { html += "<li>"; openLi = true; }
      const sub = parseList(lines, i);
      html += sub.html; closeLi();
      i = sub.next; blankSeen = false;
    } else {
      closeLi(); html += "</" + type + ">"; return { html, next: i };
    }
  }
  closeLi();
  html += "</" + type + ">";
  return { html, next: i };
}

/* ---------------- tables ---------------- */

const isTableSep = (line) => line.includes("-") && /^\s*\|?[\s:|-]*-+[\s:|-]*(\|[\s:|-]*-+[\s:|-]*)*\|?\s*$/.test(line);
const tableCells = (line) => String(line).trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function tableHtml(rows) {
  const cells = rows.map(tableCells);
  const head = cells[0] || [];
  const body = cells.slice(2);
  let h = '<div class="md-table"><table><thead><tr>' + head.map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>";
  h += body.map((r) => "<tr>" + r.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("");
  h += "</tbody></table></div>";
  return h;
}

/** The inline pass alone — markdown (bold/italic/code/links) without block
 *  wrapping. The facing page renders the answer sentence by sentence (each with
 *  its citation chip), so its formatting must survive without gaining <p>. */
export function mdInline(src) {
  return inline(esc(String(src ?? "")));
}

/** Markdown → safe HTML. The one entry point the chat surface uses. */
export function mdHtml(src) {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  const paras = [];
  const flush = () => {
    if (paras.length) { out.push("<p>" + paras.map(inline).join("<br>") + "</p>"); paras.length = 0; }
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^ {0,3}(```|~~~)\s*([\w+#.-]*)\s*$/.exec(line);
    if (fence) {
      flush();
      const close = fence[1];
      const lang = esc(fence[2]);
      const buf = [];
      i++;
      while (i < lines.length && !new RegExp("^ {0,3}" + close + "\\s*$").test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre class="md-code"><code${lang ? ` class="lang-${lang}"` : ""}>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = /^ {0,3}(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const lvl = heading[1].length;
      out.push(`<h${lvl}>${inline(heading[2])}</h${lvl}>`);
      i++;
      continue;
    }
    if (/^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push("<hr>"); i++; continue; }
    if (/^ {0,3}> ?/.test(line)) {
      flush();
      const q = [];
      while (i < lines.length && /^ {0,3}> ?/.test(lines[i])) { q.push(lines[i].replace(/^ {0,3}> ?/, "")); i++; }
      out.push("<blockquote>" + mdHtml(q.join("\n")) + "</blockquote>");
      continue;
    }
    if (i + 1 < lines.length && line.includes("|") && isTableSep(lines[i + 1])) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].includes("|")) { rows.push(lines[i]); i++; }
      out.push(tableHtml(rows));
      continue;
    }
    if (isListLine(line)) {
      flush();
      const r = parseList(lines, i);
      out.push(r.html);
      i = r.next;
      continue;
    }
    if (line.trim() === "") { flush(); i++; continue; }
    paras.push(line);
    i++;
  }
  flush();
  return out.join("");
}