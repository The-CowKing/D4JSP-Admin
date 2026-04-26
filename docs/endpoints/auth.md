# Endpoints: auth

Routes under `/api/auth/`. Login, OAuth, profile setup, role promotion.

## Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/setup-user` | POST | Bearer JWT | Create `public.users` row on first sign-in. Server-side determines role (admin vs user) by email match. Idempotent. ([`../../pages/api/auth/setup-user.js`](../../pages/api/auth/setup-user.js)) |
| `/api/auth/promote-admin` | POST | Bearer JWT, email-gated | Set `role='admin'` only when caller's email matches `ADMIN_EMAIL`. Verified server-side. ([`../../pages/api/auth/promote-admin.js`](../../pages/api/auth/promote-admin.js)) |
| `/api/auth/expire-membership` | POST | Bearer JWT | Bump expired memberships back to `free`. Re-verifies expiry server-side. ([`../../pages/api/auth/expire-membership.js`](../../pages/api/auth/expire-membership.js)) |
| `/api/auth/battlenet?mode=login\|link&uid=` | GET | none (state-CSRF cookie) | Initiate Battle.net OAuth. 32-byte nonce in httpOnly cookie. ([`../../pages/api/auth/battlenet.js`](../../pages/api/auth/battlenet.js)) |
| `/api/auth/callback/google` | GET | OAuth callback | Google OAuth callback (handled by Supabase GoTrue). |
| `/api/auth/callback/battlenet` | GET | OAuth callback | Battle.net token exchange + link to user record. |

## Hardcoded admin email (finding M-12)

`ADMIN_EMAIL` falls back to `adam87lewis@gmail.com` in 3 files: [`../../lib/auth-context.js:7`](../../lib/auth-context.js), `setup-user.js:19`, `promote-admin.js:11`. Centralize in a shared constant or require env-only.

## Related

- [`../auth/overview.md`](../auth/overview.md)
- [`../auth/cross-domain-cookies.md`](../auth/cross-domain-cookies.md)
- [`../auth/providers.md`](../auth/providers.md)
- [`../data-model/users.md`](../data-model/users.md)
