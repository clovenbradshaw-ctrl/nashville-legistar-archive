// tests/fake-homeserver.mjs — a small in-memory implementation of the Matrix client API over HTTP, for tests and
// for driving the People panel in a browser. It is NOT Synapse. It is written to be faithful on the points where an
// adapter usually goes wrong: state events appear in /messages; a redacted event keeps its type and loses its
// content; history visibility "joined" hides what was sent before you joined; an unknown alias is a 404 with
// M_NOT_FOUND; the room creator is the sender of m.room.create; tokens are bearer headers. CORS is open (it is a
// loopback test double, never a deployment).
import http from 'node:http';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' };
export function homeserver({ name = 'rest.local', registration = 'dummy', port = 0 } = {}) {
  let n = 1, ts = Date.now();
  const tick = () => (ts = Math.max(ts + 1, Date.now()));       // a homeserver stamps with the real clock, strictly increasing
  const tokens = new Map();            // token -> user
  const passwords = new Map();         // user -> password (a test double: a real server keeps a hash)
  const openids = new Map();           // openid token -> user
  const rooms = new Map();             // id -> { state: Map(type|key -> event), timeline: [], members: Map }
  const aliases = new Map();
  const seen = [];                     // every request: { method, path, auth, body }
  const sid = (p) => p + (n++).toString(36);
  const mkUser = (local) => { const u = `@${local}:${name}`; const t = 'tok_' + sid('t'); tokens.set(t, u); return { user: u, token: t }; };
  const stateEv = (r, type, key, content, sender) => { const e = { type, state_key: key, content, sender, event_id: '$' + sid('s'), origin_server_ts: tick() }; r.state.set(type + '|' + key, e); r.timeline.push(e); return e; };
  const level = (r, user, what, dflt) => { const pl = (r.state.get('m.room.power_levels|') || { content: {} }).content; const mine = (pl.users || {})[user] ?? pl.users_default ?? 0; return { mine, need: what === 'state' ? (pl.state_default ?? 50) : what === 'events' ? (pl.events_default ?? 0) : (pl[what] ?? dflt) }; };

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    const u = new URL(req.url, 'http://x');
    const raw = await new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => ok(b)); });
    let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { /* none */ }
    const auth = String(req.headers.authorization || '').replace(/^Bearer /, '');
    seen.push({ method: req.method, path: u.pathname + u.search, auth, body, xff: req.headers['x-forwarded-for'] || null });
    const out = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json', ...CORS }); res.end(JSON.stringify(obj)); };
    const err = (code, errcode, error) => out(code, { errcode, error });
    const p = decodeURIComponent(u.pathname);

    if (p === '/.well-known/matrix/client') return err(404, 'M_NOT_FOUND', 'none');
    if (p === '/_matrix/client/v3/register' && req.method === 'POST') {
      if (registration === 'closed') return err(403, 'M_FORBIDDEN', 'Registration has been disabled');
      if (registration === 'token' && !(body.auth && body.auth.type === 'm.login.registration_token')) return out(401, { session: 's1', flows: [{ stages: ['m.login.registration_token'] }] });
      if (!body.auth) return out(401, { session: 's1', flows: [{ stages: ['m.login.dummy'] }] });
      if (passwords.has(`@${String(body.username).toLowerCase()}:${name}`)) return err(400, 'M_USER_IN_USE', 'User ID already taken.');
      const { user, token } = mkUser(String(body.username).toLowerCase());
      if (typeof body.password === 'string') passwords.set(user, body.password);
      return out(200, { user_id: user, access_token: token, device_id: sid('D') });
    }
    if (/^\/_matrix\/client\/(v3|r0|unstable|api\/v1)\/login$/.test(p) && req.method === 'GET') return out(200, { flows: [{ type: 'm.login.password' }, { type: 'm.login.application_service' }] });
    if (/^\/_matrix\/client\/(v3|r0|unstable|api\/v1)\/login$/.test(p) && req.method === 'POST') {
      if (body.type === 'm.login.application_service') return out(200, { user_id: '@bot:' + name, access_token: 'as_' + sid('t'), device_id: sid('D') });
      if (body.type === 'm.login.token') return out(200, { user_id: '@someone:' + name, access_token: 'tok_' + sid('t'), device_id: sid('D') });
      if (body.type !== 'm.login.password') return err(400, 'M_UNKNOWN', 'Unsupported login type');
      const idu = (body.identifier && body.identifier.user) || body.user || '';
      const full = String(idu).startsWith('@') ? String(idu).toLowerCase() : `@${String(idu).toLowerCase()}:${name}`;
      if (!passwords.has(full) || passwords.get(full) !== body.password) return err(403, 'M_FORBIDDEN', 'Invalid username or password');
      const t = 'tok_' + sid('t'); tokens.set(t, full);
      return out(200, { user_id: full, access_token: t, device_id: sid('D') });
    }
    if (p === '/_matrix/federation/v1/openid/userinfo' && req.method === 'GET') {
      const who = openids.get(u.searchParams.get('access_token'));
      return who ? out(200, { sub: who }) : err(401, 'M_UNKNOWN_TOKEN', 'unknown');
    }
    const user = tokens.get(auth);
    if (!user) return err(401, 'M_UNKNOWN_TOKEN', 'Unrecognised access token');
    const m = (re) => p.match(re);
    let x;

    if (p === '/_matrix/client/v3/createRoom' && req.method === 'POST') {
      const id = '!' + sid('r') + ':' + name;
      const r = { state: new Map(), timeline: [], members: new Map() };
      if (body.room_alias_name) { const al = `#${body.room_alias_name}:${name}`; if (aliases.has(al)) return err(400, 'M_ROOM_IN_USE', 'Room alias already taken'); aliases.set(al, id); }
      rooms.set(id, r);
      stateEv(r, 'm.room.create', '', { room_version: '11' }, user);
      r.members.set(user, 'join'); stateEv(r, 'm.room.member', user, { membership: 'join' }, user);
      const preset = body.preset || 'private_chat';
      stateEv(r, 'm.room.power_levels', '', { users: { [user]: 100 }, users_default: 0, events_default: 0, state_default: 50, invite: preset === 'public_chat' ? 0 : 0, kick: 50, ban: 50, redact: 50, ...(body.power_level_content_override || {}) }, user);
      stateEv(r, 'm.room.join_rules', '', { join_rule: preset === 'public_chat' ? 'public' : 'invite' }, user);
      stateEv(r, 'm.room.history_visibility', '', { history_visibility: 'shared' }, user);
      if (body.name) stateEv(r, 'm.room.name', '', { name: body.name }, user);
      for (const s of body.initial_state || []) stateEv(r, s.type, s.state_key || '', s.content, user);
      return out(200, { room_id: id });
    }
    if ((x = m(/^\/_matrix\/client\/v3\/directory\/room\/(.+)$/))) {
      const al = x[1];
      if (req.method === 'GET') return aliases.has(al) ? out(200, { room_id: aliases.get(al), servers: [name] }) : err(404, 'M_NOT_FOUND', 'Room alias not found.');
      if (req.method === 'DELETE') {
        const id = aliases.get(al); if (!id) return err(404, 'M_NOT_FOUND', 'no such alias');
        const r = rooms.get(id); const l = level(r, user, 'state'); if (l.mine < l.need) return err(403, 'M_FORBIDDEN', 'You do not have permission to remove this alias');
        aliases.delete(al); return out(200, {});
      }
    }
    if ((x = m(/^\/_matrix\/client\/v3\/join\/(.+)$/)) && req.method === 'POST') {
      const id = x[1]; const r = rooms.get(id); if (!r) return err(404, 'M_NOT_FOUND', 'unknown room');
      const jr = (r.state.get('m.room.join_rules|') || { content: {} }).content.join_rule;
      const cur = r.members.get(user);
      if (cur === 'ban') return err(403, 'M_FORBIDDEN', 'You are banned');
      if (cur !== 'invite' && jr !== 'public') return err(403, 'M_FORBIDDEN', 'You are not invited to this room');
      r.members.set(user, 'join'); stateEv(r, 'm.room.member', user, { membership: 'join' }, user);
      return out(200, { room_id: id });
    }
    if ((x = m(/^\/_matrix\/client\/v3\/user\/([^/]+)\/openid\/request_token$/))) {
      if (x[1] !== user) return err(403, 'M_FORBIDDEN', 'not you');
      const oid = 'oidc_' + sid('o') + globalThis.crypto.randomUUID().replace(/-/g, '');   // a real homeserver's tokens are long and random
      openids.set(oid, user);
      return out(200, { access_token: oid, token_type: 'Bearer', matrix_server_name: name, expires_in: 3600 });
    }
    if ((x = m(/^\/_matrix\/client\/v3\/rooms\/([^/]+)\/(.+)$/))) {
      const id = x[1], rest = x[2], r = rooms.get(id);
      if (!r) return err(404, 'M_NOT_FOUND', 'unknown room');
      const me = r.members.get(user);
      const jr = (r.state.get('m.room.join_rules|') || { content: {} }).content.join_rule;
      const inRoom = me === 'join';
      if (rest === 'state' && req.method === 'GET') {
        if (!inRoom && !(me === 'invite') && jr !== 'public') return err(403, 'M_FORBIDDEN', 'not in room');
        return out(200, [...r.state.values()]);
      }
      let y;
      if ((y = rest.match(/^state\/([^/]+)\/(.*)$/))) {
        const type = y[1], key = y[2];
        if (req.method === 'GET') { if (!inRoom && !(me === 'invite') && jr !== 'public') return err(403, 'M_FORBIDDEN', 'not in room'); const e = r.state.get(type + '|' + key); return e ? out(200, e.content) : err(404, 'M_NOT_FOUND', 'State event not found'); }
        if (req.method === 'PUT') { if (!inRoom) return err(403, 'M_FORBIDDEN', 'not in room'); const l = level(r, user, 'state'); if (l.mine < l.need) return err(403, 'M_FORBIDDEN', `power level ${l.mine} < ${l.need}`); return out(200, { event_id: stateEv(r, type, key, body, user).event_id }); }
      }
      if ((y = rest.match(/^send\/([^/]+)\/([^/]+)$/)) && req.method === 'PUT') {
        if (!inRoom) return err(403, 'M_FORBIDDEN', 'not in room');
        const l = level(r, user, 'events'); if (l.mine < l.need) return err(403, 'M_FORBIDDEN', 'power level too low');
        const e = { type: y[1], content: body, sender: user, event_id: '$' + sid('e'), origin_server_ts: tick() };
        r.timeline.push(e); return out(200, { event_id: e.event_id });
      }
      if ((y = rest.match(/^redact\/([^/]+)\/([^/]+)$/)) && req.method === 'PUT') {
        const t = r.timeline.find((e) => e.event_id === y[1]); if (!t) return err(404, 'M_NOT_FOUND', 'no event');
        if (t.sender !== user) { const l = level(r, user, 'redact', 50); if (l.mine < l.need) return err(403, 'M_FORBIDDEN', 'cannot redact others'); }
        t.content = {}; t.unsigned = { redacted_because: { type: 'm.room.redaction', sender: user } };
        r.timeline.push({ type: 'm.room.redaction', content: {}, redacts: t.event_id, sender: user, event_id: '$' + sid('x'), origin_server_ts: tick() });
        return out(200, { event_id: '$' + sid('x') });
      }
      if (rest === 'messages' && req.method === 'GET') {
        if (!inRoom) return err(403, 'M_FORBIDDEN', 'not in room');
        const hv = (r.state.get('m.room.history_visibility|') || { content: {} }).content.history_visibility;
        const joinedTs = (r.timeline.find((e) => e.type === 'm.room.member' && e.state_key === user && e.content.membership === 'join') || {}).origin_server_ts || 0;
        let list = r.timeline.filter((e) => hv !== 'joined' || e.origin_server_ts >= joinedTs);
        const filter = u.searchParams.get('filter'); if (filter) { const f = JSON.parse(filter); if (f.types) list = list.filter((e) => f.types.includes(e.type) || e.type === 'm.room.redaction'); }
        const dirB = u.searchParams.get('dir') === 'b'; const limit = Number(u.searchParams.get('limit') || 10);
        const from = Number(u.searchParams.get('from') || 0);
        const ordered = dirB ? [...list].reverse() : list;
        const chunk = ordered.slice(from, from + limit);
        return out(200, { chunk, start: String(from), end: from + limit < ordered.length ? String(from + limit) : undefined });
      }
      if (rest === 'aliases' && req.method === 'GET') return out(200, { aliases: [...aliases].filter(([, v]) => v === id).map(([k]) => k) });
      if (rest === 'forget' && req.method === 'POST') return out(200, {});
      if (rest === 'leave' && req.method === 'POST') { r.members.set(user, 'leave'); stateEv(r, 'm.room.member', user, { membership: 'leave' }, user); return out(200, {}); }
      for (const verb of ['invite', 'kick', 'ban']) {
        if (rest === verb && req.method === 'POST') {
          if (!inRoom) return err(403, 'M_FORBIDDEN', 'not in room');
          const l = level(r, user, verb, 0); if (l.mine < l.need) return err(403, 'M_FORBIDDEN', `power level ${l.mine} < ${l.need} to ${verb}`);
          const target = body.user_id;
          const mem = verb === 'invite' ? 'invite' : verb === 'kick' ? 'leave' : 'ban';
          if (verb === 'invite' && r.members.get(target) === 'ban') return err(403, 'M_FORBIDDEN', 'banned');
          r.members.set(target, mem); stateEv(r, 'm.room.member', target, { membership: mem }, user);
          return out(200, {});
        }
      }
    }
    return err(404, 'M_UNRECOGNIZED', 'Unrecognized request ' + req.method + ' ' + p);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({
    base: 'http://127.0.0.1:' + server.address().port, name, seen, user: mkUser, rooms, aliases, passwords,
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
  })));
}


// node tests/fake-homeserver.mjs [port] [name]   — then point a page at http://127.0.0.1:<port>
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || 8874);
  const hs = await homeserver({ name: process.argv[3] || `127.0.0.1:${port}`, port });
  console.log('fake homeserver on', hs.base, 'as', process.argv[3] || `127.0.0.1:${port}`);
  // /__mkuser?name=owner -> { user, token }  (a test affordance, absent from the Matrix API)
}
