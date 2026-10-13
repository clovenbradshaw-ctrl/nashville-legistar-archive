// cli.mjs — run the gate, and the operator's few commands. The only file in this folder that touches the disk.
//
//   node cli.mjs keygen                          print a fresh store key (put it in GATE_KEY, keep it out of the config file)
//   node cli.mjs serve  <config.json>            run the gate
//   node cli.mjs enroll <config.json> @you:host  enrol an account that already exists (yours): prints the QR URI and key
//   node cli.mjs list   <config.json>            who is enrolled
//   node cli.mjs remove <config.json> @them:host un-enrol (they can sign in with the password alone again, unless enforce is "all")
//
// The store is one file, encrypted with AES-256-GCM under GATE_KEY, written atomically with mode 0600. The gate
// refuses to start without a key: there is no plaintext mode.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createGate } from './gate.mjs';
import { fileStore } from './cli-store.mjs';

const [cmd, file, arg] = process.argv.slice(2);

function keyFromEnv() {
  const raw = process.env.GATE_KEY || '';
  const k = Buffer.from(raw, 'base64');
  if (k.length !== 32) { console.error('GATE_KEY must be 32 bytes, base64 (node cli.mjs keygen).'); process.exit(2); }
  return k;
}
if (cmd === 'keygen') { console.log(crypto.randomBytes(32).toString('base64')); process.exit(0); }
if (!['serve', 'enroll', 'list', 'remove'].includes(cmd) || !file) { console.error('usage: node cli.mjs keygen | serve|enroll|list|remove <config.json> [@user:host]'); process.exit(2); }

const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
const store = fileStore(cfg.storePath || './gate-store.bin', keyFromEnv());
const gate = createGate(cfg, { store, log: (l) => console.log(new Date().toISOString(), l) });

if (cmd === 'serve') {
  const port = Number(cfg.port || 8788), host = cfg.host || '127.0.0.1';
  gate.server.listen(port, host, () => console.log(`login gate on http://${host}:${port}  (upstream ${cfg.upstream})`));
} else if (cmd === 'enroll') {
  const r = await gate.operator.enroll(arg);
  console.log('Add this to an authenticator app (scan it as a QR code, or type the key):');
  console.log('  ' + r.otpauth);
  console.log('  key: ' + r.secret);
} else if (cmd === 'list') {
  for (const u of await gate.operator.list()) console.log(u.user, new Date(u.enrolledAt).toISOString());
} else if (cmd === 'remove') {
  console.log((await gate.operator.remove(arg)) ? 'removed' : 'not enrolled');
}
