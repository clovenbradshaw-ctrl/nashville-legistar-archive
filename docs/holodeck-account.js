// holodeck-account.js — the site an invite link points at, derived, never typed.
//
// Account is a variable. The one declaration (fold-workspace.json: `account`,
// `derivations.pages`) names where published pages live; nothing in this repo's
// feature code carries an account or org literal. The default link base is the
// page the invite was minted from (its own origin and path) — which needs no
// declaration at all. A "published site" base is derived from the declaration
// when asked for (a link minted on localhost is no use to anyone else).
//
// PURE: `here` and `declaration` are injected; nothing is fetched.

export function derivePages(declaration, name) {
  const tpl = declaration && declaration.derivations && declaration.derivations.pages;
  const account = declaration && declaration.account;
  if (typeof tpl !== 'string' || typeof account !== 'string' || !account) return null;
  return tpl.replace('{account}', account).replace('{name}', name).replace(/\/+$/, '') + '/';
}

/**
 * Where an invite link points.
 *   here        { origin, pathname } of the running page
 *   declaration the parsed fold-workspace.json (or null)
 *   name        this surface's repo name in the declaration
 *   published   true to prefer the derived published site
 *   override    an explicit base the person typed (wins)
 * returns { base, source: 'override' | 'declared' | 'page', gap? }
 */
export function linkBase({ here, declaration, name = 'holodeck', published = false, override = '' } = {}) {
  const o = String(override || '').trim();
  if (o) {
    try { const u = new URL(o); u.hash = ''; u.search = ''; return { base: u.toString(), source: 'override' }; }
    catch { return { base: '', source: 'override', gap: { kind: 'bad-override', why: 'that is not a web address' } }; }
  }
  if (published) {
    const d = derivePages(declaration, name);
    if (d) return { base: d, source: 'declared' };
    return fromPage(here, { kind: 'no-declaration', why: 'no account declaration was readable, so the link points at this page instead of the published site' });
  }
  return fromPage(here);
}

function fromPage(here, gap) {
  if (!here || !here.origin || here.origin === 'null') {
    return { base: '', source: 'page', gap: gap || { kind: 'no-origin', why: 'this page has no web address of its own (it was opened from a file), so there is nothing to link to' } };
  }
  const path = here.pathname || '/';
  return { base: here.origin + path.replace(/index\.html$/, ''), source: 'page', ...(gap ? { gap } : {}) };
}
