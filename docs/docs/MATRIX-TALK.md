# Comments, the inbox, and group conversation — design note

Branch `holodeck-comments`, on top of `holodeck-matrix-invites`. This note says what was decided and what
was *not* shown; the unit tier is `holodeck-talk.test.mjs`. Everything below rides the encrypted repo stores
of `MATRIX-INVITES.md`; read §1–§3 there first.

## 1. What it is

* **A comment is tied to a place in the content.** An anchor is one of: a whole *source*, a *text* span (offsets
  plus the words plus a little context), a *statement*, a *name*, a *moment* in a recording, or the *room*
  itself (the group conversation). Anchors name the source by its record anchor (`src:<id>`), the same string
  the records store uses, so every member means the same source.
* **Threads.** A comment can have replies; a thread can be resolved and reopened by anyone in the repo.
* **The inbox** is a view over the threads of the whole repo: newest activity first, unread, open, resolved,
  mentions, "I took part", one source at a time. It is a fold, not a second store.
* **The conversation** is the same stream with the `room` anchor: a flat group chat for everyone in the repo.
* **Unread** is per person and per thread (a `read` event each person writes about themselves).

## 2. Where it lives, and why a fourth store

`talk` is a fourth encrypted Matrix room per repo, next to `sources`, `records`, `log`.

| | sources / records | talk |
|---|---|---|
| who can send | editors and the owner (`events_default` 50) | every member (`events_default` 0) |
| what the fold does with it | folds it into the evidence | nothing: it is never folded into names, statements, ties |
| state events | owner only | owner only |

Reasons: a reader must be able to say something (the data stores are read-only for readers, by design), and a
comment is not evidence — putting it in `records` would make every "I think this is wrong" an operator in the
fold. The cost is one more room to invite, join and rotate, which is exactly what the invites design avoided
for per-family rooms; it is paid once, for a different power level, not per kind of event.

**Events** (all `io.holodeck.talk.*`, all sealed): `comment`, `edit`, `delete`, `resolve`, `read`; and `room`,
which the owner writes into the `log` store to announce the room (a member learns the room from the owner's
announcement, never from content).

## 3. What is private, and what is not

Same sentence as the repo: content is Megolm-encrypted end to end; the homeserver can see that the room
exists, who is in it and when they joined, when each event was sent and how large it is. It cannot read a
comment, a quote, a chat line, a mention, or who a comment is about.

Things this feature does **not** change and the page says so:
* A removed member keeps everything their device already decrypted; they receive nothing written afterwards
  (kick, ban, discard the outbound session — the same removal as the data stores).
* The text a text-anchor quotes travels inside the sealed comment; it is as private as the comment.
* A mention is a user id typed into the body. It is content, so the server never sees it.
* Notifications are in-page only. There is no push, because a push provider would have to be told that
  something happened to whom.

## 4. Who may do what — judged twice

1. The server: power levels (members send, only the owner changes rules, kicks, bans).
2. The fold (`foldTalk`), because the server's word is not trusted for authorship:
   * a sender must have held a role in the repo's owner-authored ledger **at the event's timestamp** (never
     invited, or removed since → dropped and counted in `dropped`, never silently shown);
   * only the author edits a comment; only the author **or the owner** deletes one;
   * a comment needs a valid anchor, a non-empty body, and at most 8000 characters;
   * an event nobody can decrypt is counted as `undecryptable`, not shown and not hidden.

Readers can comment and talk. That is a product decision, and the one place this design widens what a reader
may do: they still cannot write to `sources` or `records` (the data-store gate is unchanged).

## 5. The crossing

`makeTalk({ share })` takes only the public API of `holodeck-share.js`. Every write goes through
`share.sealed.sendEvent`, which asserts the room is a known store room and that the crypto layer confirms
encryption before anything is sent (`holodeck-seal.js`); this module adds no path around that seal. It never
sets state with content.

* `ensure(repo)` — owner. Creates the encrypted room if there is none, announces it in the sealed log, records
  it in the account's repo registry, and reconciles membership: invites every confirmed member who is not in
  the room, kicks and bans anyone the log says is gone. Safe to run again. The owner's client runs it on a
  timer, so a person confirmed *after* the room exists is invited the next time the owner's client is open.
* `adopt(repo)` — member. Joins the announced room (idempotent).
* `send / edit / del / resolve / markRead / state`.

## 6. Falsifiers (pre-registered with the code, each paired with a control)

| id | claim that would be false | test |
|---|---|---|
| T1 | the server holds a comment, quote or chat line | `T1 — nothing the server holds…` + `T1 control` (an unencrypted talk room leaks and is refused with zero writes) |
| T3 | a non-member's event is shown | `T3 — a sender who held no role…` (control: fold without the ledger admits it) |
| T4 | a removed member keeps receiving, or their later events are shown | `T4` (two tests: fold, and transport) |
| T5 | someone edits or deletes another person's comment | `T5` (control: a naive fold applies the edit) |
| T6 | the inbox misses, misorders, or mis-counts across sources; unread is shared between people | `T6` |
| T7 | a text anchor points at the wrong words after the text changes | `T7` (control: recorded offsets alone mis-point) |
| F11 | an account literal or a stored secret appears in a new file | `F11` |

## 7. Not shown, stated

* **Live tier.** Nothing here has run against a real homeserver with real Megolm. The unit tier uses the same
  fake homeserver as the invites work; the live tier (`tests/matrix-invites.live.mjs`) needs a local Synapse and
  has not been extended to the talk room. Until it is, "encrypted" here means: the room is created with
  `m.room.encryption`, the seal refuses any send otherwise, and the crypto layer's own `isEncryptionReady`
  must agree — the same three assertions as the data stores.
* **The page was driven only against the simulated server** and the signed-out path. A signed-in run against a
  homeserver is the next check.
* **History for late members.** A member invited after messages exist reads them only if history sharing is
  really deliverable (the same `historyCapability` rule as the invites); otherwise they start from when they
  joined and earlier messages count as undecryptable.
* **Existing repos.** The conversation is created on demand by the owner ("Start the conversation"), never
  silently.

## 8. Open questions

1. Should readers be able to resolve threads? (Built: yes. Easy to narrow in `foldTalk`.)
2. Per-thread member lists (a thread visible to some members only) would need a room per thread; not built.
3. Attachments in comments would go through `sealAttachment`; not built.
4. Edit history: edits replace the body in the fold; the earlier text is still in the room.
