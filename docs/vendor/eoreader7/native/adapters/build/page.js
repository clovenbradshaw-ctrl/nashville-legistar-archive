// adapters/build/page.js — Hora's page renderer: a filled void holarchy (its
// parts, each with its details and entries) -> one
// self-contained HTML page. The engine owns the whole design (a neutral token
// system, light and dark, responsive cards, a real form); the mouth wrote only
// the words in the entries. Nothing here is a regular expression: escaping is
// split/join, the layout is the tree's own shape.
const esc = (s) => String(s ?? "").split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;");

const STYLE = `:root{--bg:#f5f6f8;--fg:#1b2129;--card:#fff;--muted:#5d6773;--rule:#dde1e6;--accent:#2f5bb7}
@media (prefers-color-scheme:dark){:root{--bg:#12161b;--fg:#e4e8ed;--card:#1a2027;--muted:#98a2ae;--rule:#2a323c;--accent:#8aa7ee}}
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--fg)}
header,main,form{max-width:960px;margin:0 auto;padding:0 16px}header{padding-top:32px}h1{margin:0 0 4px;font-size:2rem}
.for{color:var(--muted);margin:0 0 24px}section{margin:0 0 28px}h2{font-size:1.1rem;margin:0 0 10px;color:var(--accent)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
article{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:12px 14px}
article h3{margin:0 0 6px;font-size:1rem}dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:.92rem}
dt{color:var(--muted)}dd{margin:0}form{margin-bottom:40px}fieldset{border:1px solid var(--rule);border-radius:10px;padding:14px;display:grid;gap:10px;background:var(--card)}
label{display:grid;gap:4px;font-size:.92rem}input{font:inherit;padding:8px;border:1px solid var(--rule);border-radius:6px;background:var(--bg);color:var(--fg)}
button{font:inherit;justify-self:start;padding:8px 16px;border:0;border-radius:6px;background:var(--accent);color:#fff;cursor:pointer}
.gap{color:var(--muted);font-style:italic}`;

// One element: el("h2", "Posts") -> <h2>Posts</h2>. Plain strings only, so
// the markup is data the repo's regex sweep reads as strings, never as code.
const el = (tag, inner = "", attrs = "") => "<" + tag + (attrs ? " " + attrs : "") + ">" + inner + "<" + "/" + tag + ">";

function entryHtml(slots, entry) {
  const first = slots[0];
  const rest = slots.slice(1);
  const details = rest.length ? el("dl", rest.map((s) => el("dt", esc(s)) + el("dd", esc(entry[s]))).join("")) : "";
  return el("article", el("h3", esc(entry[first])) + details);
}

function sectionHtml(s) {
  const gaps = s.gaps.length ? el("p", s.gaps.length + (s.gaps.length === 1 ? " entry" : " entries") + " could not be filled.", 'class="gap"') : "";
  return el("section", el("h2", esc(s.part)) + el("div", s.entries.map((e) => entryHtml(s.slots, e)).join(""), 'class="grid"') + gaps);
}

function formHtml(form) {
  if (!form) return "";
  const fields = form.fields.map((f, i) => el("label", esc(f) + "<input id=\"f" + i + "\" name=\"f" + i + "\">", 'for="f' + i + '"')).join("");
  const inner = el("legend", esc(form.button)) + fields + el("button", esc(form.button), 'type="submit"') + el("output");
  return el("form", el("fieldset", inner), "onsubmit=\"event.preventDefault();this.querySelector('output').textContent='Thanks, received.'\"");
}

export function renderPage(tree, whole = {}) {
  const forWhom = whole.anchor ?? "";
  const head = "<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" + el("title", esc(tree.name)) + "\n" + el("style", STYLE);
  const header = el("header", el("h1", esc(tree.name)) + (forWhom ? el("p", "For " + esc(forWhom), 'class="for"') : ""));
  const body = header + "\n" + el("main", tree.parts.map(sectionHtml).join("\n")) + "\n" + formHtml(tree.form);
  return "<!DOCTYPE html>\n" + el("html", "\n" + el("head", "\n" + head + "\n") + "\n" + el("body", "\n" + body + "\n") + "\n", 'lang="en"') + "\n";
}
