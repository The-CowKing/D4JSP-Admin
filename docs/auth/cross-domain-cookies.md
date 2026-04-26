# Auth: Cross-domain cookies

`.d4jsp.org` cookie chain ties together the trade app, admin app, Build Planner, and 8 WordPress sites.

## Cookies set

| Cookie | Set by | Purpose |
|---|---|---|
| `sb-isjkdbmfxpxuuloqosib-auth-token` (chunked `.0`/`.1`/`.n`) | [`../../lib/supabase.js`](../../lib/supabase.js) `crossDomainStorage` | Supabase session JSON (JWT + user metadata) |
| `d4jsp_auth=<accessToken>` | [`../../lib/auth-context.js:syncAuthCookie`](../../lib/auth-context.js) | Standalone JWT for WP plugin to read |
| `bnet_nonce` | [`../../pages/api/auth/battlenet.js`](../../pages/api/auth/battlenet.js) | OAuth state CSRF, httpOnly, 10-min TTL |

## Cookie attributes

- **`Domain=.d4jsp.org`** when current host ends with `.d4jsp.org`. Otherwise no domain attr (origin-scoped).
- `Path=/`, `SameSite=Lax`, `Secure` (when HTTPS detected).
- `Max-Age=365 days`.

## Chunking

Supabase JWT can exceed 4096-byte cookie limit. `lib/supabase.js:38-90` implements `.0/.1/…/.n` chunking with `<base>.n` count cookie.

## Federation logic

- Trade app (`trade.d4jsp.org`) writes cookie at `.d4jsp.org`.
- Admin app (`trade.d4jsp.org/admin-panel`) reads same cookie (same origin under nginx).
- WordPress (`d4jsp.org`, `diablo4mods.com`, etc.) reads `d4jsp_auth` via `d4jsp-supabase-auth` plugin.
- Cross-`.com` sites (e.g. `diablo4marketplace.com`) get cookies via Mercator domain mapping.

## Sign-out propagation

`auth-context.js:logOut` redirects to `https://d4jsp.org/d4jsp-logout`. The WP plugin's logout handler:
1. Clears `d4jsp_auth` cookie at `.d4jsp.org`.
2. Clears all 5 `sb-*` chunked cookies.
3. Bounces back to gate.

Without that handler being called, sub-sites still think the user is signed in for up to 365 days.

## Gotchas

- Chrome cookie sync replays cross-device refreshes. The `expectedUserIdRef` defense in `auth-context.js:49-55` prevents one device's refresh from overwriting another's signed-in session.
- Cookie chunk limit: `CHUNK_SIZE=2800` ([`../../lib/supabase.js:18`](../../lib/supabase.js)). Leaves room for cookie name + attributes within 4096-byte budget.
- Touching cookie storage in `lib/supabase.js` requires a synchronized update across trade, admin, and Build Planner repos (each has its own `lib/supabase.js`).

## Related

- [`./overview.md`](./overview.md)
- [`./providers.md`](./providers.md)
- [`../infra/cloud.md`](../infra/cloud.md) — WP plugin
- [`../infra/connected-systems.md`](../infra/connected-systems.md)
