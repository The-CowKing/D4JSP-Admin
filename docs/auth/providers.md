# Auth: Providers

Three configured.

## Google OAuth

- Cloud Console project: `d4jsp-491120` (renaming to `d4jsp.org`).
- Authorized redirect URI: `https://isjkdbmfxpxuuloqosib.supabase.co/auth/v1/callback`.
- Configured in **Supabase Dashboard → Authentication → Providers → Google**. NOT in this repo's env.
- Client secret: `keyz/google_oauth_secret.txt` + 1Password.
- Code touchpoints (no credential): [`../../lib/auth-context.js:246-265`](../../lib/auth-context.js) (`signInWithOAuth({ provider: 'google' })`), [`../../components/AuthScreen.js`](../../components/AuthScreen.js).
- Smoke test: sign in with Google on the live site; confirm new user row appears in `public.users`.

## Battle.net (custom OAuth)

- App registered at develop.battle.net.
- Endpoints (manually configured in Supabase OR Next.js routes):
  - Authorization: `https://oauth.battle.net/authorize`
  - Token: `https://oauth.battle.net/token`
  - Userinfo: `https://oauth.battle.net/userinfo`
- Scope: `openid` (BattleTag + account ID; no email).
- Env vars: `BATTLENET_CLIENT_ID`, `BATTLENET_CLIENT_SECRET`, `BATTLENET_REDIRECT_URI=https://trade.d4jsp.org/api/auth/callback/battlenet`.
- Routes: [`../../pages/api/auth/battlenet.js`](../../pages/api/auth/battlenet.js) (init), `pages/api/auth/callback/battlenet.js` (callback — token exchange + link user record).
- 32-byte cryptographic nonce in httpOnly cookie (10-min TTL) for CSRF.
- Stores `battlenet_account_id` + `battletag` on `public.users`.

## Email + password

- Stock Supabase GoTrue.
- HIBP password check: NOT enabled today (advisor warning W-01). Toggle in Dashboard → Authentication → Providers → Email → "Check against Have I Been Pwned".

## Related

- [`./overview.md`](./overview.md)
- [`./cross-domain-cookies.md`](./cross-domain-cookies.md)
- [`../endpoints/auth.md`](../endpoints/auth.md)
- [`../infra/credentials.md`](../infra/credentials.md)
