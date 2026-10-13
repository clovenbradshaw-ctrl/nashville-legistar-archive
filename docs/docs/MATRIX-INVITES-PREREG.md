# Matrix invites — pre-registered falsification record

Written and committed **before any test of this feature was run**. Predictions
below are never edited after the fact; results are appended in "Results" at the
end, each against the prediction it answers. A control is an implementation
deliberately broken in the way the claim says cannot happen — a probe that does
not catch its control is not evidence.

Two tiers, because one is faithful to the contract and the other is faithful to
Matrix:

* **unit** — pure modules against `holodeck-fake-matrix.js` (a fake homeserver
  and clients whose "encryption" is real AES-GCM with per-room sessions and key
  delivery only to devices the owner confirmed). Runs in `node --test`; no network.
* **live** — the real matrix-js-sdk (Rust crypto, Megolm) against a local
  Synapse on 127.0.0.1 with federation off. Not part of `node --test`; run with
  `node tests/matrix-invites.live.mjs`. Accounts are registered **only** on that
  local server; nothing here registers on a public homeserver.

The unit tier proves the *decisions* (order of operations, what gets sent
where, what the fold accepts). It does **not** prove Megolm. Only live does.

## What would embarrass the design

### F1 — a plaintext event reaches the transport
* **Claim at risk:** every event the page emits is `m.room.encrypted`; no
  content-bearing state event is written.
* **Probe:** a unique canary string is placed in a source's text, a statement,
  an attachment body, and a ledger note. After a full flow, scan everything the
  server received. unit: the fake server's request log. live: the Synapse
  sqlite database file, the media store directory, and `/rooms/…/messages`
  as an outside member sees it.
* **Controls (must be caught):** (a) a transport that skips the seal; (b) a
  room created without `m.room.encryption`; (c) the legacy `savePrivate`
  state-event path.
* **Prediction:** canary count **0** on the real path in both tiers; **>0** for
  all three controls. Specifically (c) is a positive control for the scanner
  itself: the legacy private room **will** be found leaking the canary in
  plaintext in the live tier. If (c) shows 0, the scanner is blind and F1 is void.

### F2 — an invitee decrypts before the owner confirms
* **Claim at risk:** nothing is readable by an invitee between redeem and the
  owner's "these match".
* **Probe:** invitee redeems (joins the door, sends its request). The owner
  writes canary events to all three stores. The invitee's client is asked to
  read each store room and the door.
* **Control:** an owner flow with confirm-before-check (invites to the store
  rooms and marks the device verified as soon as the request arrives).
* **Prediction:** invitee reads **0 of N** canaries; has no membership in any
  store room; has not received the grant. Control: invitee reads **N of N**.
  After confirm: invitee reads the canaries written *after* the confirm; reads
  the earlier ones iff `history.can` is true (computed, reported, not assumed).

### F3 — a revoked member decrypts events written after revocation
* **Claim at risk:** removal stops new events reaching the removed device.
* **Probe:** member reads canary-A; owner removes them; owner and an editor
  write canary-B; the removed account's still-running client tries both.
* **Control:** removal that updates the ledger but does not kick or rotate.
* **Prediction:** removed member reads **A** (the disclosure is true: removal
  does not undo it) and **not B**. Control: reads B. If the removed member
  *cannot* read A the UI's disclosure is wrong and must be changed, not the test.

### F4 — a read-only member's write operator is accepted by the fold
* **Claim at risk:** the fold, not only the UI or the server, refuses it.
* **Probe:** raw events (bypassing UI and server power levels) from a reader
  sender: INS/DEF/CON; from a former editor after demotion; from a stranger not in
  the ledger; a role-grant event forged by an editor (sender ≠ log creator);
  an event from an editor *before* demotion.
* **Control:** `foldRepo` replaced by a bare `fold` (gate off).
* **Prediction:** all post-demotion/reader/stranger/forged operators absent from
  folded state and listed as typed refusals; the pre-demotion editor event
  **present**; control state contains the reader's entity.

### F5 — a secret appears in a URL, a log line, or localStorage
* **Secrets, enumerated:** access token, password, megolm session keys, recovery
  key, six-digit pairing code, user ids and device ids/fingerprints.
  The invite alias code is the single permitted payload of a link, as a fragment,
  because it is a locator (possession lets you ask, never receive).
* **Probe:** instrument link builders, the panel's log sink, and a recording
  localStorage; run the whole flow; exact-substring scan for every secret.
  Link shape is asserted exactly: no `?`, fragment exactly `join=<code>` over the
  alias alphabet.
* **Controls:** (a) link builder that appends the user id; (b) logger that
  prints the token; (c) code that stores the recovery key in localStorage.
* **Prediction:** new code: **0** hits; all three controls caught. **Known
  exception, stated in advance:** the page's pre-existing `fold-matrix-session`
  localStorage entry holds an access token (written by `fold-net.js`, not by
  this feature). The whole-page localStorage scan in the live/browser tier
  **will find it**; the claim is scoped to keys this feature writes, and the
  legacy token is reported as a finding, not hidden.

### F6 — an unencrypted room is written to
* **Probe:** attempt a send to (a) a legacy unencrypted workspace room, (b) a
  store room whose encryption state has not synced yet (the create→sync race),
  (c) a store room whose `m.room.encryption` is absent in state, (d) a
  content-bearing state write into an encrypted room.
* **Control:** the seal bypassed.
* **Prediction:** four typed refusals (`RoomNotEncrypted` ×3, `ContentInState`)
  each carrying a reason; **zero** transport calls; control: transport receives
  all four.

## Secondary predictions

* **F7 — roles at the server:** a reader's `sendEvent` is refused by Synapse
  (power level 0 < `events_default` 50). Live only.
* **F8 — history honesty:** `history.can === true` only when the owner device is
  cross-signed and the invitee device is cross-signed and visibility is
  `shared`. Control: a build that claims "yes" unconditionally. Live: with
  cross-signing bootstrapped on both accounts the invitee reads pre-join events
  **iff** the bundle path actually succeeded; where it cannot, the typed gap is
  reported and the invite said "no". I do **not** predict the bundle path works
  against Synapse 1.143 on the first try; the prediction is that the *claim
  matches the observation*.
* **F9 — door hygiene:** after confirm/reject/revoke/expiry the alias no longer
  resolves; a second redeem of a consumed code is refused.
* **F10 — no regressions:** every test that passed before this branch passes
  after, by test **name** diff (not count).
* **F11 — account rule:** zero occurrences of either account literal in the
  diff.

## What is not established (declared up front)

Federation (every test is one homeserver; alias resolution and joins across
servers; role-at-timestamp ordering under clock skew); multi-device (a second
device of owner or invitee, device-list changes mid-flight); key backup and
recovery (nothing here sets up secret storage or restores from backup); large
rooms (members counted in single digits; no 1M-record room); homeservers other
than Synapse and SDK versions other than the one tested; cross-signing
bootstrap on an account that already has keys (needs password UIA — typed gap,
not exercised); a hostile homeserver (withholding or reordering events); a
compromised invitee; the 20-bit pairing code against an eavesdropper on the
out-of-band channel; the fake's fidelity to real Megolm; browser IndexedDB
persistence across a real reload for the crypto store.

## Results

(appended below this line; nothing above is edited)

### Run of 2026-10-12 — unit tier (`node --test holodeck-share.test.mjs`) and live tier

Environment, stated plainly: Synapse 1.143.0 from PyPI in a throwaway venv, one
process, sqlite, bound to 127.0.0.1:18008, federation off, registration open **on
that server only**; matrix-js-sdk 41.5.0 (Rust crypto 18.3.0) from the sibling
eodb checkout; Node 24. Browser run: the Browser pane, two origins
(`127.0.0.1` owner, `localhost` invitee), the real SDK bundle. No public
homeserver was contacted. Attachments in the live Node tier used a WebCrypto
stand-in with eodb's envelope shape (`media.js` does not import under Node:
`window is not defined`); the vendored `media.js` itself was exercised in the
browser bundle (round trip + tamper detection, no IDBFactory patch).

| ID | Prediction | Result |
|---|---|---|
| F1 | canary 0 on the real path in both tiers; >0 for all controls; the legacy private room leaks in the live tier | **Held.** unit: 0 in everything the fake server holds; controls (a) unencrypted room, (b) legacy state write: >0. live: canary 0 in 3 sqlite files (db, wal, shm) + 0 media files; workspace title 0; **positive control: 1 hit** (legacy `savePrivate`-style state event is readable in the server database). Every non-state timeline event of all three stores is `m.room.encrypted`; every state event is structural. |
| F2 | invitee reads 0/N before confirm; control reads N/N | **Held.** unit and live: 0 events fetchable by the invitee (403), no grant; live control (owner trusts + invites on request): invitee decrypts. |
| F3 | removed member reads A, not B; control reads B | **Held, with one correction to the predicted control.** live: reads A, cannot decrypt B. The first control I wrote (ledger-only removal) did **not** let them read B: every client withdraws trust from a ledger-revoked person's devices, so a ledger entry alone already cuts key flow. I kept that as its own test (defence in depth) and made the control a removal attempted by a non-owner. |
| F4 | gate refuses reader/stranger/demoted/forged; control accepts | **Held.** unit; plus the server refuses the reader's raw send (live, `M_FORBIDDEN` power level 0 < 50). |
| F5 | new code 0 hits; legacy token found by whole-page localStorage scan | **Prediction partly wrong.** New modules: 0 hits in links, log lines and a recording localStorage; share modules reference no localStorage/sessionStorage/cookie (grep). Whole-page scan in the browser: **no access token, password or recovery key** — the panel keeps its session in IndexedDB, so the legacy `fold-matrix-session` entry did not exist in this run (it would, for a page already signed in the old way). What it **did** find that I did not predict: the SDK itself writes `mxjssdk_memory_filter_FILTER_SYNC_<user id>` to localStorage (a user id in a key name, written by the library), and the crypto IndexedDB is named with user id and device id. Neither is a secret; both are personal identifiers in browser storage. Reported, not claimed away. |
| F6 | four typed refusals, zero transport calls; control passes all | **Held** (unit). The create→sync race was real in the browser: the first adapter read room state from the local sync cache and saw "no encryption yet" — the seal refused, correctly; the adapter now reads state from the server and asks the crypto layer separately. |
| F7 | reader refused by server | **Held** (live). |
| F8 | claim == observation | **Held**, and better than hedged: with both accounts cross-signed on Synapse 1.143 + SDK 41.5 the MSC4268 bundle was delivered (claimed yes, observed yes); `history = no` invites read nothing earlier (6 undecryptable counted); owner/invitee not cross-signed → typed gap and observed no. In the browser the invitee was not cross-signed, the invite said so after confirm, and the invitee was told "2 items were written before you joined". |
| F9 | door closes; second redeem refused; expiry | **Held** (unit; live alias 404 after confirm). |
| F10 | no regressions by name | **Held.** 38 baseline results (4 test files already failing before this branch: falsify-battery, inquiry-integration, inquiry, release-gate) all present with identical status; +42 new, all ok. |
| F11 | no account literal | **Held** — see the report's grep. |

### Defects the live and browser runs found that the unit tier could not

Each is now a regression test or a typed behaviour:
1. Room state read from the local sync cache looked unencrypted for a moment after create/join → state is read from the server.
2. An alias is `#code:<server name>`; the server name is the user id's domain, not the URL host.
3. A member who joined after earlier role entries were written could not decrypt them, so *their own fold* refused everyone's writes and a different person saw different state → the owner's ledger travels in the grant (authenticated by its sender); every viewer folds the same ledger.
4. Device trust is per client in Matrix. "Keys only to devices the owner confirmed" worked for two people and silently broke at three (an editor's client withheld keys from a reader the owner had confirmed, not they) → every client applies the owner's confirmations from the owner-authored ledger, and withdraws a removed person's.
5. The invitee's writes were withheld from the owner (the invitee had not trusted the owner's device) → mutual code: the invitee types the owner's digits; joining waits for them.
6. `client.getAccountDataFromServer()` answers from the local store after the first sync and returned nothing after a reload → account data is read from the server directly.
7. `client.invite()` always shares history in this SDK (the option is a deprecated no-op) → a "no history" invite uses the raw invite request.
8. A selector built from a room id (`!…:server`) threw in the panel; the confirm click did nothing → `getElementById`.
9. After a reload a new instance did not know the door rooms were its own → refusals as `unknown-room`; now adopted from the account's own registry; a half-failed confirm is idempotent.
10. A prefilled invite was overwritten by the redraw's "keep what was typed" restore.

### Not established (final list)

Federation (one homeserver; role-at-timestamp ordering under clock skew;
cross-server alias resolution); multi-device beyond one extra device of one
member in the live tier; key backup and recovery (none set up, none
restored — a person who clears site data loses their keys and must be
re-confirmed as a new device); large rooms and 1M-record workspaces (single-digit
members; the batch path was tested at 120 operators); homeservers other than
Synapse and SDK versions other than 41.5.0; cross-signing on an account that
already has keys (needs the password — typed gap, not exercised); a hostile
homeserver (withholding or reordering); a compromised invitee; the 20-bit pairing
code against an eavesdropper on the out-of-band channel (the full fingerprint is
shown for comparison, the typed six digits are the gate); the reader flow in the
browser pane (covered unit + live, not driven in the pane); history bundle
delivery in the browser (the invitee there was not cross-signed — the typed gap
path was what ran); attachments through the vendored `media.js` against a real
server (exercised against the fake and in the bundle in isolation; the live Node
tier used a stand-in); persistence of the crypto store across a reload was seen to
work (the same device re-opened its store and decrypted a request received before
the reload) but not exercised across a browser restart; mobile width was seen
once at 800 px wide, not systematically.

---

# Part II — password and authenticator at every sign-in (the gate), and an invitation that is only an invitation

Written 2026-10-13. Two earlier drafts of this record (an email-invitation design on the encrypted stores, then an
email-code design) were abandoned before any result was recorded; the code and tests for them were removed and they
are not published here. Nothing below depends on them. This Part states predictions of the **gate**
(`tools/login-gate/`) and of the rewritten `holodeck-invites.js`, **before any new-module test was run**. (The gate's
own tests had been run when this was appended — they are listed under "Written after the gate's first run".)

## What each party knows (the claim the owner asked for)

| | knows | does not know |
|---|---|---|
| the person | their sign-in name, their password, their authenticator | — |
| the owner | that an invitation exists for a name; the link they sent | the person's password, authenticator secret, or any way to sign in as them |
| the homeserver | the password (as any homeserver does), room contents | the authenticator secret |
| the gate | the authenticator secret, the password **in transit** (it is on the homeserver's side of the trust line) | — |

"The email from me is useless because I don't have their password" is made precise as: **an invitation link does
not let anyone sign in as anyone; it only lets an account that has already enrolled ask to be let into the rooms.**

## Falsifiers — the gate

* **G1 — the gate is a password oracle.** A wrong, missing or malformed code is refused **without the homeserver
  being asked**. Probe: count homeserver `/login` requests across three refusals. Prediction: 0. Control: a
  right-code/wrong-password attempt does reach the homeserver (count +1) and ends in the same words.
* **G2 — a captured code works twice.** The same code within its step, and an earlier step's, are refused;
  the next step's works. Prediction: refused, homeserver not asked on the replay.
* **G3 — unlimited guessing.** After the configured failures a lock refuses even the **right** code, without
  reaching the homeserver, and lifts after its time. An account that never enrolled signs in as before under
  `enforce: "enrolled"`; under `"all"` it is refused unless allow-listed.
* **G4 — a bypass.** `m.login.token`, an address login and a body with no usable user id are refused. A body with
  the six digits after the password is accepted and the digits are stripped (so an ordinary Matrix app works).
* **G5 — enrolment.** An account cannot be created without a ticket and a right code; the secret is shown once;
  a ticket is single use; the homeserver never sees the ticket or the code.
* **G6 — secrets at rest and in logs.** The store file holds no secret and no user id in the clear, is mode 0600,
  and a tampered store is refused. No log line contains a secret, password, code, ticket or account name. The
  gate module imports no filesystem.
* **G7 — who may ask.** "Is this account enrolled?" answers only for an OpenID-verified admin; an access token,
  an unknown token and a verified non-admin are refused.

## Falsifiers — the invitation

* **I1 — a link signs someone in.** Using only the link's secret, no account can be authenticated; the link is
  not accepted by the gate or the homeserver as a credential. And the owner's own stored records contain no
  password and no authenticator secret (scan the owner's store and everything the server holds).
* **I2 — admission without enrolment.** When the gate says the account is not enrolled, nobody is admitted and the
  invitation stays open; when it says enrolled, the account is let into the workspace's own rooms. A gate that is
  unreachable admits nobody (fail closed).
* **I3 — a proof for another account or door.** Refused. Control: a proof of the link half alone verifies for all.
* **I4 — a door not made by the inviter named in the link.** Refused before anything is sent. Control: a client
  that does not check sends the hello into the attacker's door.
* **I5 — the server holds the link's half.** Scan: 0. The name is expected in room state (and found, so the scan
  is not blind).
* **I6 — presence.** As before: names from room state by authenticated sender, never heartbeat content; removed,
  stale and spoofed not shown; a viewer's wrong clock does not hide people; heartbeats replace each other.
* **I7 — end to end.** Three people each enrol through the gate, join by link, and appear online under the names
  typed at invite time; a fourth with the link but no enrolment never appears.

## Not established in advance

The gate against a real Synapse behind a real reverse proxy (the tests use an in-test homeserver); that Synapse
accepts the extra `totp` field on `/login` and `/register` (it ignores unknown keys, but this was not run
here); whether a given authenticator app accepts the otpauth URI's parameters (the codes themselves are checked
against RFC 6238 vectors); behaviour behind a proxy that rewrites the client address; clock skew greater than
one step between the person's phone and the server; and a person who loses their phone (there is no recovery:
the operator un-enrols them with the CLI and they enrol again).

## Written after the gate's first run (kept apart from the predictions above)

The gate's eight tests had been written and run before the section above was appended. First run: 7 of 8 passed;
the failure was G7 and it was the test double, not the gate — the in-test homeserver issued OpenID tokens shorter
than the gate's sanity floor, so the gate correctly refused them; the double was changed to issue realistic
tokens. Nothing in the gate was changed to make it pass. G1–G7 are therefore *not* held-out predictions; I1–I7
are, and no test of the rewritten invitation module had been run when this was appended.

## Part II results

Run 2026-10-13 against the in-test homeserver (not Synapse), plus a browser run of the real panels against that
homeserver fronted by the real gate.

| ID | Prediction | Result |
|---|---|---|
| G1 | a wrong/missing code never reaches the homeserver; right code + wrong password does, in the same words | **Held.** 3 refusals → 0 homeserver `/login` requests; right-code/wrong-password → +1 request and the identical error text. |
| G2 | a code works once | **Held.** the same code refused, homeserver not asked; next step's works. |
| G3 | lockout refuses even the right code, lifts after its time; unenrolled accounts per `enforce` | **Held.** |
| G4 | `m.login.token`, address login, no user id refused; digits after the password accepted and stripped | **Held.** (`m.login.token` and the address login are refused *when routed to the gate*; see "bypass" in the deployment notes.) |
| G5 | no account without ticket+code; secret once; ticket single use; homeserver never sees ticket/code | **Held.** The `totp` field is absent from what the homeserver received. |
| G6 | store encrypted, 0600, tampering refused; no secrets in logs; no fs import | **Held.** |
| G7 | only an OpenID-verified admin may ask who is enrolled | **Held** — after the double was fixed (see "Written after the gate's first run"). |
| I1 | a link is not a credential; the owner's store and the server hold no password/authenticator material | **Held.** Plus, through the real gate: the owner's own password and the link's half both fail to sign in as the person. |
| I2 | not enrolled ⇒ not admitted and the invitation stays open; gate unreachable ⇒ nobody admitted | **Held** (unit and through the gate). |
| I3 | proof not replayable across account or door; first valid proof wins | **Held**, with the control (a proof of the half alone verifies for everyone) caught. |
| I4 | a door not made by the named inviter is refused before anything is sent | **Held**, control caught. |
| I5 | server holds no link half | **Held**; the name *is* found, so the scan is not blind. |
| I6 | presence: names from state by authenticated sender, etc. | **Held**, including a viewer 1 h fast and 1 day slow. |
| I7 | three enrolled people join and appear under the typed names; a fourth with the link and no enrolment never does | **Held** (unit; and in the browser one person end to end: enrol → create account → join → "Here now · 2" with the typed name and what they were reading). |

### Defects found by running it, that the earlier tiers could not have found

1. **Names leaked to the server** through `ledgerSeed` kept in account data (found by a canary scan in an earlier
   design that was later dropped; the lesson stood: names are content and the registry is server-readable).
2. **A closed invitation looked identical to "still waiting"** to the person (both `no-grant-yet`); it now has its
   own code, so they are told it is closed.
3. **Presence judged against the viewer's wall clock** hid everyone for a laptop whose clock was off; it is now
   judged in server time, calibrated from the viewer's own heartbeats. A first fix (using their last heartbeat as
   "now") defeated staleness and was caught by the stale-person test.
4. **The QR encoder copied in from a sibling project was broken in five independent ways**: the format word was
   written transposed, the data was padded to the payload count rather than the codeword count, the Reed–Solomon
   remainder was nearly all zeros, multi-block symbols were not interleaved, and the zig-zag direction flipped wrongly
   after the timing column; it also chose a version from characters, not bytes. The platform's own barcode decoder
   found the finder patterns and returned an **empty payload for every input**, which is what exposed it. The
   encoder's header claimed a passing round-trip test that is not on disk. The core was rewritten to the standard and
   is now checked by (a) an independent decoder written from ISO/IEC 18004 that verifies format bits, both copies,
   every block's Reed–Solomon syndromes and the byte-mode payload at 5+ versions, with a control that a flipped module
   breaks a syndrome, and (b) the platform decoder in the browser, which now returns the otpauth URI, a Unicode
   string and a 190-character string identically. (The project it was copied from still carries the original.)
5. **A test double's token was shorter than the gate's floor**, and a test faked time on the wrong side of the gate;
   both were the doubles, not the code, and are recorded as such.

### Not established

The gate behind a real reverse proxy in front of a real Synapse (that Synapse ignores the extra `totp` field on
`/login` and `/register` is expected, not run); that every authenticator app accepts the otpauth URI's parameters
(the codes themselves match RFC 6238; the URI follows the de-facto key-URI format and the platform decoder reads it
back byte for byte); a phone whose clock is off by more than one 30-second step; behaviour under a proxy that
rewrites client addresses; real-device camera scanning of the QR (decoded by software, not by a phone); the page's own
sign-in modal with an enrolled account (the six-digits-after-the-password path is tested at the gate; the modal text
was changed and parses, not driven in the pane); `index.html` merged with main, which has moved (see the hand-off);
any end-to-end encryption claim (there is none: these are ordinary rooms).

### Design change after the first run of the invitation tests (recorded, not edited into the predictions)

The first version of `holodeck-invites.js` proved possession of the link with `HMAC(secret half | door | account)`.
Its tests (I1–I7, 12 of 12) passed on the first run. Reading the result against the owner's earlier question — "is
this tied solely to a device?" — the answer was *yes, for pending invitations*: the secret half was kept only in the
IndexedDB of the browser that made them, so clearing site data or using another browser silently orphaned every
pending invitation. The proof was therefore changed to an **Ed25519 signature** over (door, account): the link
carries the private key, room state carries the public key, and no secret is stored by the owner. The tests were
rewritten in the same shape, with these differences: I3's control is now "a signature that omits the account is
genuine under the same key, so only binding the account stops replay"; the offline-guessing probe (a 10⁶ search
over six digits) was removed because the six digits are no longer part of the proof at all (they are the gate's);
and a test was added that **a second device with an empty store admits the person**. All 13 pass; the REST test that
exercises the real gate passes unchanged apart from passing `rooms` to `sweep`/`outstanding`. The earlier results
table above is the first design's; I1–I7 now describe the second, and the claim "nothing secret is stored on the
owner's side" is checked directly (the owner's store holds no key once the person is in; the server holds the public
key and not the link's private key).

---

# Part III — sealing: private content leaves the device encrypted, and the key never goes to the server

Written 2026-10-13, after the owner asked that all subsequent Holodeck content be encrypted and chose "key in the
invite link" over Matrix-native Megolm. **Order of events, stated plainly:** the module (`holodeck-vault.js`) and its
unit tests were drafted together, and the predictions below were fixed against that draft before the integrated tests
(`holodeck-vault-store.test.mjs`, the updated `holodeck-invites.test.mjs` and `holodeck-rest-matrix.test.mjs`) were
run or the existing ones changed. They are not pre-registered in the strong sense Parts I–II are: the unit tier saw the
code first. The integrated tier and the browser run did not.

## What each party can read after this

| | can read | cannot read |
|---|---|---|
| a member holding the key | names, the registry, private work, who is viewing what | — |
| the homeserver / its operator | membership, room names, event types and state keys, timing, value *size* to a bucket, the door aliases | names, titles, pins, drafts, the registry, any key |
| a device with no key | membership and room names (what any member's client shows) | everything sealed — and it writes none of it |
| a removed member | everything they held a key for before removal | anything sealed under a key issued after |

## Falsifiers

* **V1** — a sealed value contains no word of its plaintext, in the event or the raw ciphertext; a probe is shown to see
  the plaintext when it is there (control).
* **V2** — a sealed value moved to another room, event type, state key or sender does not open; any changed bit of the
  ciphertext, nonce, key id or compression flag is refused; a device without the key is told it is *locked*, never given
  a guess.
* **V3** — values of different small sizes seal to the same length (control: a value in the next bucket does not).
* **V4** — a large compressible value fits under Matrix's 64 KiB event (control: unsealed it does not); a value that
  inflates past the limit is refused.
* **V5** — the first key is made once and kept; a key the browser cannot keep is never used to seal; a device link
  carries the keyring, scoped to its workspace, and a damaged or foreign one is refused; the keyring is per account.
* **V6** — a rotation reaches a member holding the old key, through several rotations and out of order; one from an
  untrusted sender, with a forged key id or sealed for another room, is ignored (control: the real one is taken).
* **V7** — both ends derive the same grant key from the link's seed and alias; another seed or alias cannot open it.
* **V8** — private work is sent and stored sealed (every request body the server received, and everything it stores),
  and reads back exactly; an older unsealed snapshot is read until a key exists and the next save seals it.
* **V9** — a device without the key is locked and does not start a key beside the first device's; only the owner starts
  a key; a member with the key from her grant reads what the owner saved.
* **V10** — with a key held, a plaintext snapshot is refused (a forged one cannot be slipped in); sealed content moved
  to another key does not open; a rotation is believed from the owner and not from a member, even with a higher epoch.
* **S1 (invites)** — through the REST stack with the real gate: no request body the server received and nothing it
  stores contains the typed name, the page title, the workspace key or the link's seed.

## Not established in advance

A real Synapse (all runs are against the in-test HTTP double); the page driven end to end by a person rather than the
demo harness; two browsers on two machines; the 64 KiB limit with a *real* user's read log (a synthetic one near the
cap was used); clock and `localStorage` quota behaviour in private windows (the keyring refuses to seal when it cannot
keep the key, tested with stores that refuse or forget).

## Part III results (run 2026-10-13)

Unit tier, `holodeck-vault.test.mjs`: **15 of 15** pass. First run **13 of 14**: V3's *control* was wrong, not the module
(300 repeated characters compress to nothing and land in the same bucket); the control now uses incompressible bytes.
`holodeck-vault-store.test.mjs`: **6 of 6** (first run 5 of 6 — the failing test assumed a plain member can write the
private snapshot; in the `private_chat` preset only moderators can set state, which is the room's own rule and was true
before sealing; the test now asserts what a member can do: read). `holodeck-invites.test.mjs` 13 and
`holodeck-rest-matrix.test.mjs` 5 pass after being changed, below. Whole set (`holodeck-vault`, `-vault-store`,
`-invite-core`, `-invites`, `-rest-matrix`, `-qr`, `gate`): **58 of 58**. `index.html`'s two inline scripts parse. The
demo (real panels, real gate, in-test homeserver) was driven in the browser pane: the server held `{v, vault, kid, z, iv,
ct}` for the registry and two presence beats and no occurrence of the typed name, the page title or id, the workspace key
or the link's seed; the invitee received the key in the grant and read her name; the owner's second device showed the
locked notice with the invite box hidden.

### Defects found by running it (that the design alone did not show)

1. **The keyring was per workspace, not per account.** A second account on the same browser would have inherited the
   key. The existing test of the invitation copy ("per account") caught the shape of this. The key is now stored under
   the account as well, and a unit test pins it.
2. **Rotating before sending the rotation event** could strand a device on a key nobody else has. Rotation is now
   planned, the event is sent, and only then is the key adopted locally.
3. **Two devices could each start a key.** A device with no key now looks at every sealed slot (`SEALED_SLOTS`: the
   registry, the names, the private snapshot) before it starts one, and only the workspace's creator may.
4. **Existing tests encoded the old assumption** (reading the registry and beats in the clear, a second device with an
   empty store admitting someone). They were changed to assert the new truth, and the second-device test now shows
   *locked*, then *ready after the device link*. This is a deliberate loss of a property the owner liked ("not tied to
   one device") and is documented under "Sealed on your device".

### Changed behaviour the owner should know

* An owner's **second browser is locked** until they open the device link from the first. Clearing site data on the only
  device that holds the key **loses the sealed content**: there is no server copy of the key, by design.
* Invitations made **before** this change cannot carry the key; the panel says to cancel and re-make them.
* Guests who joined a workspace by the older disposable-account path hold no key and cannot save private work until the
  owner invites them again.
* The workspace's own `social.hyphae.fold.private` history on the server still holds anything written before sealing.

### Not established

Everything under "Not established in advance", and: that no *other* part of the page writes private content to Matrix in
the clear (the audited writers are the private snapshot, the invitation registry, the names and presence; the public
room and its blocks are public by design; attachments for private rooms were not audited); that a user who loses the
only key-holding device has a recovery path (there is none).

