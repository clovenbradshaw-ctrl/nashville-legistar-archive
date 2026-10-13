// fold-chat-tipview.js — the ONE "Tip the creator" control, used by the recipe card, the Sources-only strand and the
// facing page's source rows (fold-chat-tip.js is the logic and the kind's definition is fold-chat-support-routes.json;
// this is only the hand).
//
// A click looks for how the creator's OWN site says to support or reach them, in this order, then:
//   tip   -> opens the creator's own tip page (Ko-fi, Patreon, GitHub Sponsors, their own donate page…) in a NEW tab
//            (noopener, noreferrer). One shared control: that page is the primary action; if the site also publishes an
//            email, a quiet secondary "Or email them" link opens the draft ONLY when pressed (never both at once).
//   email -> opens the person's own email app with a draft (a mailto: link; nothing is sent until they send it),
//   form  -> copies the draft and opens the creator's own contact page in a new tab,
//   none  -> says plainly there is no way to tip them directly and offers THEIR OWN PAGES: their website and the social
//            profiles the page publishes, each opening in a new tab only when pressed.
// When a tip or email exists, the website and profiles are quiet secondary links below it.
// The Fold pays nothing, sends nothing, takes nothing, prefills no amount, never visits a profile, never posts or follows.
// Nothing happens without a click. textContent only; a page's words never become markup.
import { findContact, tipDraft, TIP_SAY, TIP_LABELS, isPlatformSite, looksLikeHandle } from "./fold-chat-tip.js";
import { readText as webReadText } from "./fold-chat-web.js";

const deps = { readText: (u, o) => webReadText(u, o), pause: undefined, humans: false };
/** The app wires its audited, memoised page reader here once (fold-chat.js); tests may pass their own. */
export function configureTip(o = {}) { Object.assign(deps, o); }

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const siteOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
// a popup opened after a long search may be blocked by the browser (the click's permission lapses): then the visible link is the way
const FRESH_MS = 3500;
const safeUrl = (u) => { try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
const outLink = (cls, label, href, aria) => { const a = el("a", cls, label); a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; if (aria) a.setAttribute("aria-label", aria); return a; };

/**
 * @param src   { url, title, creator?, site?, contact? }   contact: what the page offered when read (see contactOfPassage)
 * @param opts  { toast?, quiet? }   quiet: the text-style button for a source row (the card uses the bordered one)
 * @returns the control: a span holding the button, a polite status line, and (after a click) a visible way to retry.
 */
export function tipControl(src, { toast = null, quiet = false } = {}) {
  const url = String(src.url || "");
  // a contributor credited by handle on a marketplace/UGC platform is not who the site's address reaches
  const contributor = isPlatformSite(url) || (!!src.creator && looksLikeHandle(src.creator));
  const who = (contributor ? "" : src.creator) || src.site || siteOf(url) || "the creator";
  const wrap = el("span", "tip" + (quiet ? " tip-quiet" : ""));
  const btn = el("button", "tip-btn" + (quiet ? "" : " snip-tip"), "Tip the creator"); btn.type = "button";
  btn.dataset.tip = "";
  btn.setAttribute("aria-label", "Tip the creator" + (src.title ? " of " + src.title : ""));
  const say = el("span", "tip-say"); say.setAttribute("role", "status"); say.setAttribute("aria-live", "polite"); say.hidden = true;
  const area = el("span", "tip-area"); area.hidden = true;
  wrap.append(btn, say, area);

  const tell = (msg) => { say.textContent = msg; say.hidden = !msg; };
  const done = (msg) => { tell(msg); if (typeof toast === "function") toast(msg); };
  let busy = false;

  // their own pages: the website and the profiles the page published. Quiet secondary links under a tip / email / form; the
  // main answer (chips) when nothing can be tipped. Each opens a new tab only when pressed; the Fold visits none of them.
  const ownPages = (r, chips) => {
    const row = el("span", "tip-more");
    if (r.website && safeUrl(r.website.url)) {
      const a = outLink(chips ? "tip-chip tip-site" : "tip-link tip-site", chips ? "Open their website" : "Their website", safeUrl(r.website.url), `${chips ? "Open their website" : "Their website"} (${r.website.host}), opens in a new tab`);
      a.dataset.host = r.website.host; a.append(" ", el("span", "tip-host", r.website.host)); row.append(a);
    }
    for (const sc of (r.socials || [])) {
      const href = safeUrl(sc.url); if (!href) continue;
      const a = outLink(chips ? "tip-chip tip-social" : "tip-link tip-social", sc.platformName, href, `${sc.platformName} (${sc.host}), opens in a new tab`);
      a.dataset.platform = sc.platform; a.dataset.host = sc.host; a.append(" ", el("span", "tip-host", sc.host)); row.append(a);
    }
    if (!row.childElementCount) return null;
    if (!chips) { const lab = el("span", "tip-morelab", "Their own pages:"); row.prepend(lab); }
    return row;
  };

  btn.addEventListener("click", async () => {
    if (busy) return;
    busy = true; btn.setAttribute("aria-busy", "true"); area.replaceChildren(); area.hidden = true;
    for (const k of ["mailto", "form", "tipUrl"]) delete btn.dataset[k];
    tell(TIP_SAY.looking(who));
    const t0 = Date.now();
    let r;
    try { r = await findContact({ url, contact: src.contact }, { readText: deps.readText, humans: !!deps.humans, ...(deps.pause ? { pause: deps.pause } : {}) }); } catch { r = { kind: "none" }; }
    const greeting = contributor ? "" : (src.creator || r.name || "");
    try {
      if (r.kind === "tip" && safeUrl(r.tip.url)) {
        const href = safeUrl(r.tip.url), name = r.tip.platformName, host = r.tip.host;
        btn.dataset.tipUrl = href;
        const open = outLink("tip-link tip-open", TIP_LABELS.open(name, host), href, `${TIP_LABELS.open(name, host)}, opens in a new tab`);
        open.dataset.tipUrl = href; area.append(open);
        for (const alt of (r.alternates || [])) { const h = safeUrl(alt.url); if (h) area.append(outLink("tip-link tip-also", TIP_LABELS.also(alt.platformName, alt.host), h)); }
        if (r.email) {
          const d = tipDraft({ to: r.email.address, creator: greeting, title: src.title, url });
          const m = el("a", "tip-link tip-alt", TIP_LABELS.emailAlt); m.href = d.mailto; m.dataset.mailto = d.mailto; area.append(m);   // opens the draft ONLY when pressed
        }
        const more = ownPages(r, false); if (more) area.append(more);
        area.hidden = false;
        const fresh = Date.now() - t0 < FRESH_MS;
        if (fresh) { try { window.open(href, "_blank", "noopener,noreferrer"); } catch { /* the visible link above is the way */ } }
        else open.focus();
        done((fresh ? TIP_SAY.tip(name, host, r.tip.where) : TIP_SAY.tipFound(name, host, r.tip.where)) + (r.email ? TIP_SAY.alsoEmail : ""));
      } else if (r.kind === "email") {
        const d = tipDraft({ to: r.address, creator: greeting, title: src.title, url });
        const a = el("a", "tip-link", "Open the email draft again");
        a.href = d.mailto; a.dataset.mailto = d.mailto; btn.dataset.mailto = d.mailto;
        area.append(a);
        const more = ownPages(r, false); if (more) area.append(more);
        area.hidden = false;
        a.click();                                  // the person's own mail app; nothing is sent until they send it
        done(TIP_SAY.email(r.address, r.where) + (contributor ? TIP_SAY.siteContact : ""));
      } else if (r.kind === "form") {
        const d = tipDraft({ creator: greeting, title: src.title, url });
        btn.dataset.form = r.url;
        const link = el("a", "tip-link", "Open their contact page"); link.href = r.url; link.target = "_blank"; link.rel = "noopener noreferrer";
        area.append(link);
        const more = ownPages(r, false); if (more) area.append(more);
        area.hidden = false;
        let copied = false;
        try { await navigator.clipboard.writeText(d.body); copied = true; } catch { copied = false; }
        try { window.open(r.url, "_blank", "noopener,noreferrer"); } catch { /* the visible link above is the way */ }
        if (!copied) {
          const ta = el("textarea", "tip-copy"); ta.readOnly = true; ta.value = d.body; ta.rows = 6;
          ta.setAttribute("aria-label", "Your message, to copy"); area.append(ta); ta.focus(); ta.select();
        }
        done(copied ? TIP_SAY.form : TIP_SAY.formNoCopy);
      } else {
        const pages = ownPages(r, true);
        if (pages) { area.append(pages); area.hidden = false; done(TIP_SAY.noneHere); }       // no tip, no email, no form: their own pages, never a dead end
        else done(TIP_SAY.none);
      }
    } catch { done(TIP_SAY.none); }
    busy = false; btn.removeAttribute("aria-busy");
  });
  return wrap;
}
