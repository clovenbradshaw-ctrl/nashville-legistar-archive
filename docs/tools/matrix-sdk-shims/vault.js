// Build-time stand-in for eodb's src/vault.js (password-derived at-rest encryption of an
// OPFS media mirror). The Holodeck has no password to derive from; the mirror is unused.
const sealed = () => { throw new Error('the local media mirror is not available in the Holodeck'); };
export const vault = { isUnlocked: () => false, encrypt: sealed, decrypt: sealed, encryptBytes: sealed, decryptBytes: sealed, key: () => null };
