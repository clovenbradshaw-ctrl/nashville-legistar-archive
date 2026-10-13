# People, invitations, and the login gate

Invite people to a Holodeck workspace with a **magic link**. They choose their **own** sign-in name and password and
set up their **own** authenticator app. Every sign-in afterwards needs the password **and** the six digits. You never
see or hold any of it, so the link you send cannot be used to sign in as them.

## What the person sees

1. You open **People**, type a name per line, press **Make invitations**, and send each person their link any way you
   like (nothing is emailed by the app).
2. They open the link. The page shows a QR code. They scan it with an authenticator app, choose a sign-in name and a
   password (12+ characters), type the six digits the app shows, and press **Create account and join**.
3. Your Holodeck (open in any browser signed in as you) checks, asks the gate that the account really enrolled, and
   lets that account into the workspace's existing rooms. They appear under the name you typed, with what they are
   reading.

## What it is made of

| piece | where | does |
|---|---|---|
| `tools/login-gate/` | beside your homeserver | checks the six digits before the password reaches the homeserver; enrols an authenticator when an account is created; holds the secrets, encrypted |
| `holodeck-invites.js` | the page | makes the invitation (a signing key: private half in the link, public half in room state), lets an enrolled account in, names, presence — all of it sealed |
| `holodeck-vault.js` | the page | seals content on the device (AES-256-GCM) with a workspace key the server never has; the keyring; rotation |
| `holodeck-rest-matrix.js` | the page | plain Matrix REST; account creation and sign-in through the gate |
| `holodeck-people-panel.js` | the page | the one screen |
| `holodeck-invite-core.js` | both | TOTP (RFC 6238), proof, paste parsing, presence |
| `holodeck-qr.js` | the page | the QR code |

## Sealed on your device

Everything private the Holodeck writes to Matrix is **sealed in the browser before it is sent** (`holodeck-vault.js`):
your private work (pins, drafts, filters, reading history), the names you typed, the invitation registry, and who is
viewing what. The homeserver stores `{ kid, iv, ct }` and cannot open it. (Matrix never encrypts state events, and a
plain REST client cannot do Megolm, so the content itself is sealed here rather than relying on the room.)

* **The key** is a random 256-bit workspace key on member devices, in the browser's `localStorage`, scoped to the
  signed-in **account** and the workspace — a second person on the same browser does not inherit it. It is never sent
  to the homeserver, put in a URL, or logged.
* **A new member gets it** inside their invitation's *grant*, sealed under a key derived (HKDF) from the link's own
  secret. The link format did not change; the server sees a ciphertext only the person holding the link can open. The
  owner's device must be open to admit someone (as before), because only it can seal the grant.
* **Your other devices** need the key too. In the panel, under *What this does and does not protect*, **Copy a link to
  use this workspace on another device**: open it on the other browser, signed in as you. Treat it like a password.
  Until then that browser is **locked**: it reads no names, writes nothing sealed, and does not start a key of its own
  (two keys for one workspace would each be unreadable to the other).
* **Removing someone rotates the key.** After the person is banned from the rooms, the next key is posted in the
  private room sealed under the key the remaining members hold; only the owner's (or a moderator's) rotation is
  believed, and every key id is re-derived and checked.
* **There is no plaintext fallback.** A device without the key neither reads nor writes sealed content; a device with
  the key ignores plaintext where sealed content belongs (a forged "registry" could otherwise admit someone).
* **What the server still sees:** who is a member and when they joined, room names, when anyone was active, the
  event types and state keys, that invitations exist and when they were made (and the door rooms' aliases), and the
  *size* of each value to within a bucket. The door room holds only a signature and room ids.
* **What it cannot do:** give freshness — a malicious homeserver can replay an older sealed value; stop a removed
  member keeping every key they held and everything they already read; or protect a device that is compromised
  (the key is in `localStorage`, like the session token). Anything written in plaintext *before* this existed stays in
  the server's history; the next save seals what is current, not what was.
* **Public by design:** the workspace's public room (source custody, watches) is a publication and is not sealed.

Not tied to one browser, as it was: **any** signed-in browser can still make an invitation and verify a signature
(the public key and expiry are in the registry), but only a browser that holds the workspace key can read the
registry or seal a grant. That is what *Copy a link to use this workspace on another device* is for.

## Deploying the gate (this is yours to do; the app cannot)

The gate sees passwords in transit exactly as the homeserver does, so it runs **on the homeserver's machine or
private network** and nowhere less trusted. Your reverse proxy sends it only the login, register and `/gate/` paths;
everything else goes to the homeserver as before. The files to copy are `tools/login-gate/*.mjs` and
`holodeck-invite-core.js` (it imports it by relative path), plus `deploy/holodeck-gate.service` and
`deploy/nginx-locations.conf`.

```bash
# as root on the homeserver's machine
useradd --system --home /opt/holodeck-gate --shell /usr/sbin/nologin holodeck-gate
install -d /opt/holodeck-gate/tools/login-gate /etc/holodeck-gate
# copy tools/login-gate/{gate,cli,cli-store}.mjs -> /opt/holodeck-gate/tools/login-gate/
# copy holodeck-invite-core.js                    -> /opt/holodeck-gate/
cp login-gate.example.json /etc/holodeck-gate/gate.json     # edit: upstream, serverName, admins, port
echo "GATE_KEY=$(node /opt/holodeck-gate/tools/login-gate/cli.mjs keygen)" > /etc/holodeck-gate/key.env
chmod 600 /etc/holodeck-gate/key.env
cp deploy/holodeck-gate.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now holodeck-gate
# add deploy/nginx-locations.conf inside the homeserver's server block, then:  nginx -t && systemctl reload nginx
```

Choose `registration` for the kind of server this is:

* `"optional"` (use this on a shared or already-running homeserver): a sign-up that asks to enrol is enrolled; one that
  does not is passed through unchanged, so an existing sign-up page, a guest fallback, a bot or an old link keeps
  working. People let into a workspace are required to have enrolled, which the owner's device checks with the gate.
* `"enroll"`: no account can be made without an authenticator. Stricter, and it breaks any client that has never
  heard of the gate.

`allowOtherLoginTypes` is a list of login types the gate forwards untouched (bots and bridges use
`m.login.application_service`). Anything not named is refused, because a token login would otherwise walk around the code.

Then, and only then, consider `"enforce": "all"` (refuse accounts that never enrolled, except `allowUnenrolled`).

**Things that bypass the gate, and what to do about each**

* The homeserver's own port reachable from outside: firewall it so login and register can only arrive through the proxy.
* SSO / OIDC login or `m.login.token`: the gate refuses `m.login.token` on the paths it is routed, but an SSO
  callback is a different path. Disable SSO, or accept that it is outside this protection.
* Matrix accounts made some other way (admin API, shared-secret registration): they are not enrolled. With
  `enforce: "enrolled"` they sign in with a password alone; with `"all"` they are refused.
* Federation is untouched.

**Other Matrix apps (Element, etc.)** can sign in to an enrolled account: type the six digits straight after the
password in the password field.

**Losing a phone:** there is no self-service recovery. Run `node cli.mjs remove gate.json @them:host`; they enrol again.

## What this does and does not protect

* **Protects:** a stolen or guessed password alone; a link, an email, or the owner's own mailbox; the owner (or an
  invited person's session) being used to sign in as someone else.
* **Does not protect:** someone who already holds a session token (the browser's); a fake page that relays the six
  digits in real time (TOTP is not phishing-resistant — passkeys are, and are a follow-up); *who* is in the workspace
  and when, from whoever runs the homeserver (see "Sealed on your device" for exactly what it can and cannot see); a
  person whose invitation link is opened first by someone else who also enrols (the link is a bearer invitation until
  used: send it as you would a key, and watch the list).
* **The gate adds a trade:** someone can lock a person out for five minutes by failing on purpose. That is the lesser harm.

## Tests

`node --test holodeck-vault.test.mjs holodeck-vault-store.test.mjs holodeck-invite-core.test.mjs holodeck-invites.test.mjs holodeck-rest-matrix.test.mjs holodeck-qr.test.mjs tools/login-gate/gate.test.mjs`

The homeserver in those tests is a small in-test HTTP double (`tests/fake-homeserver.mjs`), **not Synapse**. See
`MATRIX-INVITES-PREREG.md`, Part II, for what was predicted and what was found.

A browser demo of the real panels against that double and the real gate: `node tests/people-stack.mjs 8874`, then open
`tests/people.demo.html` from any static server.
