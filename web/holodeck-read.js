// holodeck-read.js — reading every kind of source the way the OHS corpus read its own.
//
// The former OHS surface read its captures with attribution taken from the page's own
// metadata (author, published date, publisher), the article's own text rather than the
// page chrome, meeting captions as time-addressed segments, and scanned pages through OCR.
// That reading was OHS-specific. This module is the same reading, generalised: any HTML
// page, transcript, email, table, scanned PDF or image a person adds is read to the same
// depth, and what was measured or machine-read says so.
//
// Nothing here calls a model and nothing is relayed: it is DOM parsing, byte decoding and
// (when a source has no text at all) a local WASM OCR engine loaded on demand.

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MON = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const ST = {
  H1: "font:500 30px/1.25 'Newsreader',serif;margin:26px 0 12px",
  H2: "font:500 25px/1.3 'Newsreader',serif;margin:30px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)",
  H3: "font:600 18px/1.35 'Hanken Grotesk',sans-serif;margin:22px 0 8px",
  P: 'margin:0 0 14px',
  BY: "font:500 15px 'Hanken Grotesk',sans-serif;color:var(--mut);margin:0 0 18px",
  TABLE: "border-collapse:collapse;margin:0 0 18px;font:400 14px/1.45 'Hanken Grotesk',sans-serif;max-width:100%",
  TH: 'border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top;background:var(--s2);font-weight:600',
  TD: 'border:1px solid var(--line);padding:6px 8px;vertical-align:top',
  PRE: "font:400 13px/1.5 'JetBrains Mono',monospace;background:var(--s2);padding:12px;border-radius:8px;white-space:pre-wrap;margin:0 0 14px",
  BLOCKQUOTE: 'margin:0 0 14px;padding:4px 16px;border-left:3px solid var(--line2);color:var(--ink2)',
  UL: 'margin:0 0 14px;padding-left:24px', LI: 'margin:4px 0',
  META: "font:400 13px/1.5 'Hanken Grotesk',sans-serif;color:var(--mut);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:8px 0;margin:0 0 18px",
};
const el = (t, style, inner) => '<' + t + (style ? ' style="' + style + '"' : '') + '>' + inner + '</' + t + '>';
const para = lines => lines.filter(Boolean).map(l => el('p', ST.P, esc(l))).join('\n');
const words = s => (String(s || '').trim().match(/\S+/g) || []).length;

// ---------- date labels (a page says "Jan 2019" or "12 March 2019"; keep it readable) ----------
export function dateLabel(v) {
  const m = String(v || '').match(/((?:19|20)\d\d)-(\d\d)(?:-(\d\d))?/);
  if (m) return (m[3] ? +m[3] + ' ' : '') + MON[+m[2] - 1] + ' ' + m[1];
  const t = Date.parse(v);
  if (!isNaN(t)) { const d = new Date(t); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  return '';
}
const isoOf = v => { const m = String(v || '').match(/((?:19|20)\d\d)(?:-(\d\d))?(?:-(\d\d))?/); return m ? m[1] + (m[2] ? '-' + m[2] : '') + (m[3] ? '-' + m[3] : '') : ''; };

// ---------- attribution: the page's own account of who wrote it, when, and where ----------
// A giver test reading (constitution II.1): the author and publisher are *received* from the
// document, never inferred; an absent one is left absent rather than filled in.
export function metaOf(root) {
  const pick = sel => { for (const q of String(sel).split('|')) { let e = null; try { e = root.querySelector(q); } catch (x) {} if (!e) continue; const v = (e.getAttribute && (e.getAttribute('content') || e.getAttribute('datetime') || e.getAttribute('value'))) || e.textContent; if (v && String(v).trim()) return String(v).trim(); } return ''; };
  const ld = [];
  try { root.querySelectorAll('script[type="application/ld+json"]').forEach(sc => { try { const j = JSON.parse(sc.textContent); (Array.isArray(j) ? j : j['@graph'] || [j]).forEach(x => ld.push(x)); } catch (e) {} }); } catch (e) {}
  const art = ld.find(x => /Article|Posting|Report|NewsArticle|WebPage|BlogPosting/.test([].concat(x && x['@type'] || []).join(' ')) && (x.author || x.datePublished)) || {};
  let authors = [];
  const pushA = v => { if (!v) return; if (Array.isArray(v)) return v.forEach(pushA); if (typeof v === 'object') return pushA(v.name); String(v).replace(/^\s*by\s+/i, '').split(/\s*(?:,|\band\b|&|\||;)\s*/).forEach(x => { x = x.replace(/\s+/g, ' ').trim(); if (x && x.length < 60 && !/^https?:|@|\d{3}/.test(x) && /[A-Za-z\u00C0-\u024F]/.test(x) && x.split(' ').length <= 6) authors.push(x); }); };
  pushA(art.author);
  if (!authors.length) pushA(pick('meta[name="author"]|meta[name="parsely-author"]|meta[name="sailthru.author"]|meta[property="article:author"]|meta[name="byl"]|meta[name="dc.creator"]|meta[itemprop="author"]'));
  if (!authors.length) { let e = null; try { e = root.querySelector('[rel="author"], [itemprop="author"] [itemprop="name"], [itemprop="author"], .byline a, .byline__name, .author-name, .c-byline__author, .tnt-byline, [class*="byline"] [class*="author"], [class*="byline"]'); } catch (x) {} if (e) pushA(e.textContent); }
  authors = [...new Set(authors)].filter(a => !/^(staff|admin|editor|news|the|unknown|guest)$/i.test(a));
  const published = art.datePublished || pick('meta[property="article:published_time"]|meta[name="pubdate"]|meta[name="publish-date"]|meta[name="parsely-pub-date"]|meta[itemprop="datePublished"]|meta[name="dc.date"]|meta[name="dc.date.issued"]|meta[name="date"]|time[pubdate]|time[datetime]');
  const publisher = (pick('meta[property="og:site_name"]|meta[name="application-name"]|meta[name="publisher"]|meta[name="dc.publisher"]') || (art.publisher && art.publisher.name) || '').replace(/\s+/g, ' ').trim();
  const title = (pick('meta[property="og:title"]|meta[name="twitter:title"]') || '').replace(/\s+/g, ' ').trim();
  return { title, authors, published: published || '', pubLabel: dateLabel(published), publisher, iso: isoOf(published) };
}

const JUNK = 'script,style,noscript,template,svg,iframe,object,embed,form,input,button,select,textarea,nav,header,footer,aside,figure figcaption,[role=navigation],[role=banner],[role=contentinfo],[role=dialog],[aria-hidden=true],.share,.social,.newsletter,.related,.advertisement,.ad,.promo,#comments,[class^="ad-"],[class*=" ad-"],[id^="ad-"],[class*=advert],[class*=sponsor],[id*=sponsor],[id*=cookie],[class*=cookie]';
const BLOCK = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,td,th,dt,dd,label,span[id]';

// The article's own text, not the page chrome: score paragraph weight against its ancestors,
// pick the densest readable region, then emit only the blocks it holds. This is the OHS
// reader's own main-content pass, unchanged in spirit.
export function htmlReading(raw, url) {
  const d = new DOMParser().parseFromString(raw || '', 'text/html');
  const meta = metaOf(d);
  const docTitle = (meta.title || (d.querySelector('h1') && d.querySelector('h1').textContent) || d.title || '').replace(/\s+/g, ' ').trim();
  d.querySelectorAll(JUNK).forEach(n => n.remove());
  const score = new Map();
  d.querySelectorAll('p').forEach(p => { const n = p.textContent.replace(/\s+/g, ' ').trim().length; if (n < 40) return; let e = p.parentElement, w = 1; for (let i = 0; e && i < 3; i++, e = e.parentElement, w /= 2) score.set(e, (score.get(e) || 0) + n * w); });
  let root = null, best = 0; score.forEach((v, e) => { if (v > best) { best = v; root = e; } });
  if (root) { let r = root; while (r.parentElement && r.parentElement !== d.body) { const h = r.parentElement.querySelector('h1'); if (h && !r.contains(h) && r.parentElement.textContent.length < r.textContent.length * 1.6) { r = r.parentElement; break; } if (r.parentElement.textContent.length > r.textContent.length * 1.25) break; r = r.parentElement; } root = r; }
  const collect = r => { const seen = new Set(), out = []; let inList = false;
    if (!r) return out;
    r.querySelectorAll(BLOCK).forEach(e => { if (e.querySelector(BLOCK)) return; const t = e.textContent.replace(/\s+/g, ' ').trim(); if (!t || seen.has(t)) return; const tg = e.tagName, isH = /^H[1-6]$/.test(tg); if (!isH && t.split(' ').length < 3) return; seen.add(t);
      const tag = isH ? tg : tg === 'LI' ? 'LI' : tg === 'BLOCKQUOTE' ? 'BLOCKQUOTE' : tg === 'PRE' ? 'PRE' : 'P';
      if (tag === 'LI' && !inList) { out.push('<ul style="' + ST.UL + '">'); inList = true; } if (tag !== 'LI' && inList) { out.push('</ul>'); inList = false; }
      const style = tag === 'P' ? ST.P : tag === 'LI' ? ST.LI : tag === 'BLOCKQUOTE' ? ST.BLOCKQUOTE : tag === 'PRE' ? ST.PRE : (ST[tag] || '');
      out.push(el(tag.toLowerCase(), style, esc(t))); });
    if (inList) out.push('</ul>'); return out; };
  let parts = root && best > 400 ? collect(root) : [];
  if (parts.join('').length < 500) parts = collect(d.body || d.documentElement);
  let body = parts.join('\n');
  const by = [meta.authors.length ? 'By ' + meta.authors.join(', ') : '', meta.pubLabel ? 'Published ' + meta.pubLabel : '', meta.publisher || ''].filter(Boolean).join(' · ');
  if (docTitle && !/<h1[ >]/.test(body)) body = el('h1', ST.H1, esc(docTitle)) + '\n' + body;
  if (by) { const line = el('p', ST.BY, esc(by) + '.'); body = /<\/h1>/.test(body) ? body.replace(/<\/h1>/, '</h1>\n' + line) : line + '\n' + body; }
  return { html: body, title: docTitle, authors: meta.authors, published: meta.published, pubLabel: meta.pubLabel, publisher: meta.publisher, iso: meta.iso };
}

// ---------- timed transcripts: captions and segment JSON become time-addressed paragraphs ----------
const clock = v => { const m = String(v || '').trim().match(/(\d+):(\d{1,2})(?::(\d{1,2}))?[.,]?(\d{0,3})?/); if (!m) return null; const a = +m[1], b = +m[2], c = m[3] != null ? +m[3] : 0; return (m[3] != null ? a * 3600 + b * 60 + c : a * 60 + b) + (m[4] ? +('0.' + m[4]) : 0); };
export function timedSegments(ext, raw) {
  const out = []; const text = (raw || '').replace(/\r/g, '');
  if (/^(vtt|srt|sbv)$/i.test(ext)) {
    const blocks = text.split(/\n\s*\n/);
    for (const b of blocks) {
      const lines = b.split('\n').map(l => l.replace(/^\uFEFF/, ''));
      const cue = lines.find(l => /-->/.test(l)); if (!cue) continue;
      const [a, c] = cue.split(/-->/).map(s => s.trim().split(/\s+/)[0]);
      const start = clock(a), end = clock(c); if (start == null) continue;
      const say = lines.filter(l => !/-->/.test(l) && !/^\d+$/.test(l.trim()) && !/^(WEBVTT|NOTE|STYLE|REGION)/i.test(l.trim())).join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (say) out.push({ start, end: end != null ? end : start, text: say });
    }
    return out;
  }
  try { const j = JSON.parse(raw); const arr = Array.isArray(j) ? j : (j.segments || j.captions || j.items || []); arr.forEach(g => { const start = g.start != null ? g.start : (g.offset != null ? g.offset / 1000 : clock(g.startTime)); const end = g.end != null ? g.end : (g.duration != null && start != null ? start + g.duration : clock(g.endTime)); const say = (g.text || g.content || '').trim(); if (say && start != null) out.push({ start, end: end != null ? end : start, text: say }); }); } catch (e) {}
  return out;
}
export function segmentsHtml(segs, title) {
  const paras = []; let cur = null;
  (segs || []).forEach(g => { const t = (g.text || '').trim(); if (!t) return; const gap = cur ? g.start - cur.end : 0;
    if (!cur || gap > 1.5 || cur.txt.length > 520) { cur = { t: g.start, end: g.end, txt: t }; paras.push(cur); } else { cur.txt += ' ' + t; cur.end = g.end; } });
  return el('h1', ST.H1, esc(title)) + '\n' + paras.map(p => '<p data-t="' + Math.floor(p.t) + '"' + (ST.P ? ' style="' + ST.P + '"' : '') + '>' + esc(p.txt) + '</p>').join('\n');
}
// A single transcript/segment JSON object (one speaker turn per item) reads like prose too.
export function transcriptText(segs) { return (segs || []).map(s => s.text).join(' ').replace(/\s+/g, ' ').trim(); }

// ---------- email: headers are received facts, the body is the message ----------
export function emailDoc(raw) {
  const s = (raw || '').replace(/\r/g, '');
  const cut = s.search(/\n\s*\n/);
  const head = cut >= 0 ? s.slice(0, cut) : s, bodyRaw = cut >= 0 ? s.slice(cut + 1) : '';
  const H = {}; let key = '';
  head.split('\n').forEach(l => { const m = l.match(/^([A-Za-z-]+):\s*(.*)$/); if (m) { key = m[1].toLowerCase(); H[key] = H[key] ? H[key] + ' ' + m[2].trim() : m[2].trim(); } else if (key && /^\s/.test(l)) H[key] += ' ' + l.trim(); });
  const decodeQp = t => { t = t.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))); try { return decodeURIComponent(escape(t)); } catch (e) { return t; } };
  let body = bodyRaw;
  if (/quoted-printable/i.test(H['content-transfer-encoding'] || '')) body = decodeQp(body);
  else if (/base64/i.test(H['content-transfer-encoding'] || '')) { try { body = decodeURIComponent(escape(atob(body.replace(/\s+/g, '')))); } catch (e) {} }
  else { try { body = decodeURIComponent(escape(body)); } catch (e) {} }
  const unMime = t => { const m = String(t || '').match(/=\?[^?]+\?[BbQq]\?([^?]+)\?=/g); if (!m) return t; return m.reduce((acc, enc) => { const p = enc.match(/=\?[^?]+\?([BbQq])\?([^?]+)\?=/); const dec = p[1].toLowerCase() === 'b' ? (() => { try { return decodeURIComponent(escape(atob(p[2]))); } catch (e) { return p[2]; } })() : decodeQp(p[2].replace(/_/g, ' ')); return acc.replace(enc, dec); }, String(t)); };
  const from = unMime(H.from || ''), to = unMime(H.to || ''), subject = unMime(H.subject || '');
  const nameOf = t => { const m = String(t).match(/^\s*"?([^"<]*?)"?\s*<[^>]*>\s*$/); if (m && m[1].trim()) return m[1].trim(); const a = String(t).match(/^\s*"?([^"<>@]+?)"?\s*@/); if (a) return a[1].trim(); return String(t).replace(/[<>]/g, '').trim(); };
  const authors = from ? [...new Set(String(from).split(/\s*,\s*/).map(nameOf).filter(x => x && x.length < 80))] : [];
  const domain = (String(from).match(/@([A-Za-z0-9.-]+)/) || [])[1] || '';
  const published = H.date || '';
  const rows = [['From', from], ['To', to], ['Cc', unMime(H.cc || '')], ['Date', H.date || ''], ['Subject', subject]].filter(r => r[1]);
  const headers = rows.map(r => '<b>' + esc(r[0]) + '</b> ' + esc(r[1])).join(' · ');
  const bodyHtml = el('p', ST.P, esc(subject)).replace(/<\/p>/, '') ; // subject shown first
  const html = (subject ? el('h1', ST.H1, esc(subject)) : '') + '<p style="' + ST.META + '">' + headers + '</p>' + para(body.split(/\n\s*\n/).map(x => x.replace(/\s+/g, ' ').trim()));
  return { html, meta: { authors, published, pubLabel: dateLabel(published), publisher: domain, title: subject } };
}

// ---------- tables: every row is also a sentence, so cells reach the fold as statements ----------
function parseCsv(raw, sep) {
  const rows = []; let row = [], cell = '', q = false;
  const s = String(raw || '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) { const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c; }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}
export function csvReading(raw, title) {
  const s = String(raw || ''); const sep = (s.split('\n')[0] || '').includes('\t') ? '\t' : ',';
  const rows = parseCsv(s, sep); if (!rows.length) return { html: '', statements: '' };
  const [h, ...body] = rows; const head = h.map(x => x.trim());
  const table = '<table style="' + ST.TABLE + '"><thead><tr>' + head.map(c => '<th style="' + ST.TH + '">' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' +
    body.slice(0, 2000).map(r => '<tr>' + head.map((_, j) => '<td style="' + ST.TD + '">' + esc(r[j] == null ? '' : r[j]) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  // each data row also becomes a sentence, so names and figures in cells reach the holograph
  const statements = body.slice(0, 500).map(r => { const rest = head.map((k, j) => j && r[j] !== '' && r[j] != null ? String(k || 'column ' + (j + 1)).toLowerCase() + ' ' + r[j] : '').filter(Boolean); const lead = String(r[0] || '').trim(); return lead ? lead + ' has ' + (rest.length ? rest.join(', ') : 'no other values') + '.' : ''; }).filter(Boolean);
  return { html: table + para(statements), statements: statements.join('\n') };
}

// ---------- OCR: for a source that is only pixels — a scan, a screenshot, a photo of a page ----------
// Loaded on demand (a WASM engine from a CDN, no relay of the source); the recognized text is
// marked as machine-read, never as the document's own words.
let _tessP = null;
function loadTess(base) {
  if (_tessP) return _tessP;
  _tessP = new Promise((res, rej) => {
    if (window.Tesseract) return res(window.Tesseract);
    const src = (base || 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
    const s = document.createElement('script'); s.src = src; s.onload = () => window.Tesseract ? res(window.Tesseract) : rej(new Error('OCR engine loaded but Tesseract is absent')); s.onerror = () => rej(new Error('OCR engine could not load')); document.head.appendChild(s);
  });
  return _tessP;
}
export async function ocrImage(image, onProgress) {
  const base = (() => { try { return localStorage.getItem('hd:tess') || null; } catch (e) { return null; } })();
  const T = await loadTess(base);
  const r = await T.recognize(image, 'eng', { logger: m => { if (onProgress && m && m.status) onProgress(m); } });
  return (r && r.data && r.data.text || '').replace(/\s+\n/g, '\n').trim();
}
// A scanned PDF: render each page to a canvas, then read it. Bounded, and it stops early once
// pages come back blank so a 300-page scan is not read in full for nothing.
export async function ocrPdf(pdf, opts) {
  opts = opts || {}; const maxPages = opts.maxPages || 20, scale = opts.scale || 2, onProgress = opts.onProgress;
  const n = Math.min(pdf.numPages || 0, maxPages); const out = []; let blanks = 0;
  for (let i = 1; i <= n; i++) {
    if (onProgress) onProgress({ page: i, of: n });
    const page = await pdf.getPage(i); const vp = page.getViewport({ scale }); const cv = document.createElement('canvas');
    cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height); const ctx = cv.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const t = await ocrImage(cv, null); if (t && t.trim()) { out.push(t.trim()); blanks = 0; } else if (++blanks >= 2) break;
  }
  return { text: out.join('\n\n'), pages: out.length, read: n };
}
export const _internal = { parseCsv };
