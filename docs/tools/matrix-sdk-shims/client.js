// Build-time stand-in for eodb's src/client.js, which the vendored media.js imports.
// The real one patches the global IDBFactory on import and assumes a password vault;
// neither belongs in the Holodeck page. media.js's encrypt/decrypt do not call it.
export const getClient = () => null;
