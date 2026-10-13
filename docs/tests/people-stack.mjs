// tests/people-stack.mjs — a homeserver with the login gate in front of it, as a reverse proxy would arrange.
//
//   login, register and /gate/*  -> the gate        everything else -> the homeserver
//
// For the REST tests and the browser demo (node tests/people-stack.mjs [port]). The homeserver is the in-test double,
// not Synapse; the gate is the real one.
import http from 'node:http';
import { homeserver } from './fake-homeserver.mjs';
import { createGate } from '../tools/login-gate/gate.mjs';

export async function startStack({ name = 'stack.test', port = 0, gateConfig = {}, now = null, log = null } = {}) {
  const hs = await homeserver({ name });
  let store = null; const mem = { load: async () => (store ? JSON.parse(store) : null), save: async (o) => { store = JSON.stringify(o); } };
  const gate = createGate({ upstream: hs.base, serverName: name, admins: [], ...gateConfig }, { store: mem, ...(now ? { now } : {}), ...(log ? { log } : {}) });
  const gated = (p) => /^\/_matrix\/client\/(v3|r0)\/(login|register)$/.test(p) || p.startsWith('/gate/');
  const router = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (req.method !== 'OPTIONS' && gated(p)) return gate.handle(req, res);
    if (req.method === 'OPTIONS' && gated(p)) return gate.handle(req, res);
    const up = new URL(hs.base);
    const pr = http.request({ host: up.hostname, port: up.port, method: req.method, path: req.url, headers: { ...req.headers, host: up.host } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    pr.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(pr);
  });
  await new Promise((ok) => router.listen(port, '127.0.0.1', ok));
  const base = 'http://127.0.0.1:' + router.address().port;
  return {
    base, name, hs, gate,
    close: async () => { router.closeAllConnections?.(); await new Promise((r) => router.close(r)); await hs.close(); },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || 8874);
  const nm = `127.0.0.1:${port}`;
  const s = await startStack({ name: nm, port, gateConfig: { admins: ['@owner:' + nm] }, log: (l) => console.log(l) });
  console.log('homeserver + gate on', s.base, 'as', s.name);
}
