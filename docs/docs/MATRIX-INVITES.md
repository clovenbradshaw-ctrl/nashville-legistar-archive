# Inviting people to an encrypted Holodeck repo — design note

Branch `holodeck-matrix-invites`. Written before the code; the pre-registered
falsification record is `MATRIX-INVITES-PREREG.md` (predictions are never edited
after the fact — results are appended below them).

## 0. Decision: what "repo" means here

**A repo is a Holodeck workspace** — the unit the page calls a corpus
(`corpusId()` / `corpusName()`): the sources a person added, the names,
statements, ties (relations), figures and dates read off them, the person's own
declarations and pins, and the append-only operator log those are folded from
(`holodeck-records.js`: INS / DEF / CON … ; "state is never stored, it is
fold(events)"). Evidence: README "Everything you add lives in a browser-local
'Your content' workspace … split into its own workspace with Fork"; the
workspace is the only thing in the codebase that already has a Matrix room pair
(`wsRooms()` → `priv`, `pub`) and a chain (`fold-net.js` hash-chained blocks).

Other readings, **not built** (open questions, §9):

* *The code repository* (`fold-workspace.json` → `repos`): inviting people to a
  GitHub repo is collaborator access on a code host; it has no Matrix, no
  encrypted data store, and nothing in the request points at it.
* *The existing public room* (`wsRooms().pub`): deliberately world-readable
  "source custody". It is a publication, not a private store; it stays public
  and the Share panel says so.

## 1. What is private, and what is not (the sentence the UI must be able to say)

Content — source text and bytes, names, statements, figures, ties, the
workspace's own title and notes — is end-to-end encrypted: it is written only to
Megolm (`m.megolm.v1.aes-sha2`) rooms, and every event the page emits is
`m.room.encrypted` on the wire.

The homeserver **can still see**: that these rooms exist and how many there are,
their names (opaque ids — never the workspace title), who is a member and when
they joined or left, when each event was sent and how large it is, which
accounts and devices are involved, and the invite door's short alias. It cannot
read content. "Private" is never claimed without that qualifier.

**Matrix state events are never encrypted.** The current "private room"
(`savePrivate` → state event `social.hyphae.fold.private`) therefore stores
pins/filters/drafts/reading history *in the clear on the server* even though the
UI says "Only people you invite can see it". That is the single most important
thing this feature finds; it is why legacy detection and an explicit migration
exist (§7) and why the encryption layer also refuses content-bearing state
writes (§3).

## 2. Architecture

```
holodeck-account.js   resolve the site from the one declaration (no account literal)
holodeck-roles.js     roles <-> power levels; role ledger; the gate in front of the fold
holodeck-seal.js      encryption assertions: a store room is encrypted or nothing is written
holodeck-share.js     the invite state machine + stores/rooms + removal + leave (pure)
holodeck-legacy.js    detect unencrypted workspaces; plan the migration (pure)
holodeck-matrix.js    the one crossing: matrix-js-sdk behind the interface share.js injects
vendor-eodb.mjs       byte-identical copy of eodb's attachment envelope (media.js) + hash record
holodeck-share-panel.js   "Share this repo" panel (DOM; a thin client of share.js)
holodeck-fake-matrix.js   faithful fake homeserver+client for tests and the simulated demo
tools/vendor-matrix-sdk.mjs   reproducible, hash-recorded SDK bundle (same-origin, never a CDN)
```

Pure modules take every crossing as an argument; the page is a thin client. The
only index.html change is one Settings button and one dynamic import.

### 2.1 Stores → rooms

One encrypted room per store, three stores. The mapping from record family to
store is data (`STORE_OF` in `holodeck-share.js`), not code:

| store | holds | operator families |
|---|---|---|
| `sources` | documents, their text and bytes (large bodies as encrypted attachments) | `Sources` |
| `records` | what was read off them and what people said about it | `Names`, `Statements`, `Figures`, `Dates`, `Referents`, `Bonds`, `FilterFrames`, tables, ties (`CON`), declarations, pins |
| `log` | the owner-authored role ledger, epochs, invites minted/confirmed/revoked, the hash-chained blocks | `io.holodeck.share.*`, chain blocks |

Why three and not one-per-family: Megolm gives no per-family key separation worth
a room per family (every member needs every family), and every extra room is
another invite, join, bundle and rotation that can half-fail. The mapping table
lets the split change without touching the invite code.

### 2.2 The door

The short alias code does **not** resolve to a data room (heimdall's fleet room
holds nothing, so a joinable alias is harmless there; ours would put ciphertext
in front of anyone who guessed five characters). It resolves to a per-invite
**door**: an encrypted room holding only the handshake. Single-use (the heimdall
precedent: `consumeCode` drops the code on first use), 7-day TTL
(`INVITE_TTL`), revocable. The door is deleted (alias freed, creator leaves) the
moment the invite is confirmed, rejected, revoked or expired.

### 2.3 Roles

| role | power | what the server enforces | what the fold enforces |
|---|---|---|---|
| owner | 100 (room creator) | invite, kick, ban, state, power levels | everything; owns the role ledger |
| editor | 50 | send events | stored operators on data anchors |
| reader | 0 | read only (`events_default` = 50) | nothing stored |

The fold does not trust the server's power levels. `holodeck-roles.js` derives
each person's role history from the owner-authored role ledger (sender must be
the creator of the `log` room, read from `m.room.create`, never from content) and
`gate()` refuses any stored operator whose sender was not an editor at that
event's `origin_server_ts`. The vendored fold is permissive by design ("violations
are flagged, never blocked"), so the gate sits in front of it and
`foldRepo()` is the only path to state.

## 3. Encryption is asserted, not hoped for

* Rooms are created with `m.room.encryption` in `initial_state`, join rule
  `invite`, `history_visibility: shared`, and a power-levels event that makes
  encryption, join rules and visibility owner-only.
* **Refuse, don't warn.** `holodeck-seal.js` wraps the transport: before a send
  it requires that the room is a known store room *and* that the crypto layer
  reports encryption enabled *and* that the room's state carries
  `m.room.encryption` with the Megolm algorithm. Anything else throws a typed
  `RoomNotEncrypted` refusal naming the room and the reason. State writes are
  allow-listed to structural types; a content-bearing state write throws
  `ContentInState` — the exact bug in the legacy private room.
* Large bodies go through encrypted upload (eodb's attachment envelope: AES-CTR
  per blob, key in the Megolm-encrypted event, `__media: 2`). Many operators are
  written as sealed batch events (`io.holodeck.batch`); the fold sees them as the
  individual operators they are, each gated by its real sender.

## 4. The invite flow

```
owner                         door room (encrypted)                invitee
mint (role, history) ──► creates door + alias #code
link:  <site>#join=<code>   (the code is the whole link)
                                                          open link / type code
                                                          redeem: resolve alias, join door,
                                                          send REQUEST {device fingerprint code, name}
 ◄── "waiting for you to confirm their device"
read the invitee's 6-digit code      ◄── out of band: they read it aloud ──►
owner sees fingerprint (full, in groups) and the six digits; "These match" = CONFIRM
confirm: mark device verified (local trust), invite to store rooms,
         power level per role, ledger entry (role granted),
         GRANT {rooms, role, history, epoch} in the door ──►  join the three rooms
                                                              (acceptSharedHistory per grant)
door closed
```

* The 6-digit pairing code is heimdall's `codeFromPublicKey` applied to the
  invitee's **Matrix device** ed25519 key (the key Megolm sessions are actually
  shared with), not a separate keypair. It is a short comparison aid; the
  confirm screen also shows the full fingerprint. 20 bits is not collision
  resistant against an attacker who already holds the out-of-band channel — that
  is in the README's "not established" list, not hidden.
* The invitee is shown the owner's user id and the owner's own code before
  sending anything (mutual: the keys flow to the invitee, so impersonating the
  owner matters too).
* The link is `<site>#join=<code>` — the fragment is never sent to the static
  host or in a Referer. It is a *locator*: possession lets someone ask, never
  receive. No token, key, user id or pairing code is ever in a URL.
* Redeem never joins a data room by itself. The invitee joins only rooms named
  in a grant that arrived from the door's creator.

## 5. The hard Matrix facts, and what this build does about each

**(a) History.** A new member cannot decrypt events sent before they joined
unless keys are shared. The installed SDK (matrix-js-sdk 41.5.0 in eodb, 42.4.0
in heimdall) implements MSC4268 room-key-bundle sharing: `invite()` calls
`shareRoomHistoryWithUser` when the room's history visibility is `shared`, and
`joinRoom(room, { acceptSharedHistory: true })` receives it. It needs the
inviter's device verified by its own cross-signing identity and the invitee's
device cross-signed. So the invite carries **"can read past: yes / no"**, computed
and typed — `history: { want, can, gap? }` with gaps
`owner-device-not-cross-signed`, `invitee-device-not-cross-signed`,
`history-not-shared`, `sdk-without-history-sharing`. When it cannot be done the
invitee reads from the epoch they joined; earlier events show as "written before
you joined" (the fold already counts them as `_undecryptable`). The alternative
considered — exporting megolm sessions to the confirmed device by to-device —
is not used: `exportRoomKeys` exports every room's sessions on the device and
the filter is ours to get wrong.

**(b) Removal.** Removing someone kicks and bans them from every store room,
revokes their ledger entry, bumps the epoch, and discards the outbound Megolm
session of each room so the next event is sent under a fresh session that no
removed device receives. In plain words, in the UI: *they stop receiving
anything written from now on; they keep everything their device already
holds — everything they could read before — and nothing here can take that
back.* The server also keeps the old events.

**(c) Unverified devices.** Policy `confirmed-only`: keys are shared only to
devices the owner confirmed by fingerprint (`setDeviceVerified`), enforced with
`room.setBlacklistUnverifiedDevices(true)` on every store room in every Holodeck
client. Trust is per client in Matrix, so for more than two people the owner's
confirmations travel in the owner-authored ledger (each role entry and each
`share.device` event names the confirmed device and its key) and every client
applies them locally, withdrawing a removed person's. The invitee in turn types
the owner's six digits, so the owner's device is trusted on their side and what
they write reaches the owner. A person's *new* device is unconfirmed and gets
nothing until the owner confirms it (surfaced in the people list). Limit, stated:
another Matrix client in these rooms follows its own policy; the setting is
per-client, not per-room-on-server.

**(c′) The ledger a late joiner can read.** A member who joins after earlier role
entries were written cannot decrypt them. The grant therefore carries the owner's
ledger as of the grant (authenticated by its sender, the door's creator), and
every viewer folds seed + whatever their device can decrypt — one ledger for
everyone, or people would see different repos.

**(d) Metadata.** See §1; it is in the panel, the README, and the invite.

**(e) Local keys.** The SDK's persistent Rust crypto store (IndexedDB, one store
per account via `cryptoDatabasePrefix`). No recovery key is ever written to the
DOM or localStorage; secrets are never logged (the panel's log passes through a
redactor and a test greps it). The store is not passphrase-encrypted — keys are
protected by the browser profile, as with other Matrix web clients; said so.

**(f) Where the SDK comes from.** Cryptography is loaded same-origin from a
bundle built by `tools/vendor-matrix-sdk.mjs` and hash-recorded — never from a
CDN (a CDN that can serve the crypto code can serve code that exfiltrates the
keys). eodb's `client.js` is **not** imported into the page: it patches the
global `IDBFactory` at import time and assumes a password-vault session; the
Holodeck uses a token session. Only eodb's pure attachment envelope is reused.

## 6. Account is a variable

No GitHub account or org literal appears in any new file. The link base is the
page's own origin and path; a "published site" option is derived from
`fold-workspace.json` (`derivations.pages`, `account`) at runtime
(`holodeck-account.js`). `holodeck-heimdall.js` hard-codes `HEIMDALL_SITE`
(line 18); it is the rewriter's literal and is left alone — not copied.

## 7. Existing, unencrypted workspaces

Detected, reported, never silently migrated. `holodeck-legacy.js` reads the
workspace's `priv`/`pub` rooms' state and reports for each: encrypted or not;
which content-bearing state types it holds; what the server can read. The
migration is a typed plan with three operator-confirmed steps — **copy** into
the encrypted stores (read-back verified by hash), **blank** the plaintext state
event, **rollback** from the local backup — and states what it cannot do: the
server already saw the plaintext and keeps room history.

## 8. Legacy invitation paths (found, not changed)

`fx-share` links put a throwaway account's password in the URL hash
(`fold-net.js` `shareLink`), and the email door mints disposable accounts. They
do not grant access to encrypted stores and carry a secret in a URL, which this
feature forbids. They are left in place (minimal index.html hunks, and another
branch is in that file); the Share panel labels them and recommends not using
them for an encrypted repo.

## 9. Open questions

1. Is "repo" the workspace (built) or the code repository (not built)?
2. Commit the built SDK bundle (~7 MB with wasm) or build it in CI/at release?
   Today: recipe and hashes are committed, artifact is not.
3. Ownership transfer / more than one owner (the fold roots trust in the `log`
   room's creator).
4. Counted invites (N uses) — single-use chosen on the heimdall precedent.
5. Passphrase-encrypted crypto store.
6. Remove `fx-share` and the email door for encrypted repos.

## 10. What was verified, and where

See the results section of `MATRIX-INVITES-PREREG.md`: unit tier (42 tests, a
control per falsifier), live tier (34 checks, real Megolm against a local
Synapse), and one end-to-end run in the browser pane (create → invite → typed
confirm → role-limited write → read through the gate → removal with disclosure).
Ten defects were found by running it that the pure tier could not find; they are
listed there with the test that now holds each.
