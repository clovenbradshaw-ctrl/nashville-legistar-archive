// cli-store.mjs — the gate's one file: encrypted with AES-256-GCM, written atomically with mode 0600.
import fs from 'node:fs';
import crypto from 'node:crypto';

export function fileStore(path, key) {
  return {
    async load() {
      let buf;
      try { buf = fs.readFileSync(path); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
      const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), data = buf.subarray(28);
      const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
      return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8'));
    },
    async save(obj) {
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
      const tmp = path + '.tmp';
      fs.writeFileSync(tmp, Buffer.concat([iv, c.getAuthTag(), data]), { mode: 0o600 });
      fs.renameSync(tmp, path);
    },
  };
}
