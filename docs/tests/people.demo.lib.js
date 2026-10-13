// tests/people.demo.lib.js — the demo's wiring: one module instance of the panel per person.
import { enrollStart, signUp, signIn, baseFor } from '../holodeck-rest-matrix.js';
import { totpCode } from '../holodeck-invite-core.js';

const PORT = new URLSearchParams(location.search).get('hs') || '8874';
const NAME = '127.0.0.1:' + PORT;
const people = {};      // who -> { mod, session, rooms, panel, view }

export async function instance(who, session, extra = {}) {
  const mod = await import('../holodeck-people-panel.js?as=' + who);
  const p = { mod, session, rooms: {}, panel: null, view: null };
  const ctx = {
    session: () => p.session, corpusName: () => 'Case file', wsRooms: () => p.rooms, setWsRooms: (r) => { p.rooms = { ...p.rooms, ...r }; },
    linkBase: () => location.origin + location.pathname.replace(/[^/]*$/, '') + 'people.demo.html', defaultServer: () => NAME,
    onSession: (s) => { p.session = s; }, onJoined: () => {},
    viewing: () => p.view || { viewing: 'doc:lease', title: 'Lease 2024.pdf' },
    ...extra,
  };
  const before = new Set(document.querySelectorAll('aside#hd-people'));
  mod.openPeoplePanel(ctx);
  p.panel = [...document.querySelectorAll('aside#hd-people')].find((n) => !before.has(n));
  p.ctx = ctx; people[who] = p;
  show(who);
  return p;
}
export function show(who) {
  for (const [k, p] of Object.entries(people)) if (p.panel) p.panel.style.display = k === who ? '' : 'none';
  const box = document.getElementById('who');
  box.replaceChildren(...Object.keys(people).map((k) => { const b = document.createElement('button'); b.textContent = k; b.dataset.who = k; b.onclick = () => show(k); return b; }));
}
export async function registerAccount() {
  // the owner is a person like any other: enrol an authenticator, choose a password, create the account — through the gate;
  // on a reload they sign in again with password AND the six digits from the authenticator they saved
  const { host, base } = await baseFor(NAME);
  const password = 'owner chose a long password';
  let session = null, secret = null;
  const saved = JSON.parse(localStorage.getItem('demo:owner:' + NAME) || 'null');
  if (saved) {
    secret = saved.secret;
    for (let i = 0; i < 8 && !session; i++) {                       // a code can be used once: wait out the step if it was just used
      try { session = await signIn({ host, base, user: 'owner', password, code: await totpCode(secret, Date.now()) }); }
      catch (e) { if (e.kind !== 'refused') break; await new Promise((r) => setTimeout(r, 5000)); }
    }
    if (!session) localStorage.removeItem('demo:owner:' + NAME);
  }
  if (!session) {
    const e = await enrollStart({ base, account: 'owner' });
    secret = e.secret;
    session = await signUp({ host, base, username: 'owner', password, ticket: e.ticket, code: await totpCode(e.secret, Date.now()) });
    localStorage.setItem('demo:owner:' + NAME, JSON.stringify({ secret }));
  }
  window.__demo = { people, instance, show, NAME, ownerSecret: secret, codeFor: (sec) => totpCode(sec, Date.now()) };
  await instance('owner', session);
}
