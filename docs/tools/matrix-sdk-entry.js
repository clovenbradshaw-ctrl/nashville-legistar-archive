// The Matrix library surface the Holodeck uses, and nothing else. Built by
// tools/vendor-matrix-sdk.mjs into vendor/matrix-sdk/matrix-sdk.js.
export { createClient, ClientEvent, MatrixEvent, RoomEvent } from 'matrix-js-sdk';
export { logger } from 'matrix-js-sdk/lib/logger.js';
// eodb's encrypted-attachment envelope, vendored byte-identical (vendor-eodb.mjs)
export { encryptAttachment, decryptAttachment } from '../vendor/eodb/src/media.js';
