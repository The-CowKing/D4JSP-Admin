# Auth: Overview

Supabase GoTrue handles authentication. Three providers configured: email/password, Google OAuth, Battle.net OAuth (custom).

## Sign-in flow

1. User picks provider in [`../../components/AuthScreen.js`](../../components/AuthScreen.js).
2. [`../../lib/auth-context.js:signInGoogle`](../../lib/auth-context.js) (or `signInWithBattleNet`) → `supabase.auth.signInWithOAuth(...)`. Battle.net redirects to `/api/auth/battlenet` first.
3. OAuth callback → Supabase issues access + refresh tokens.
4. `auth-context.js` `onAuthStateChange` catches `SIGNED_IN` → calls `ensureUserDoc(supabaseUser)`:
   - If row exists → check admin promotion + membership expiry.
   - If row doesn't exist → POST `/api/auth/setup-user` (server-side INSERT, sets role from email match).
5. `syncAuthCookie(accessToken)` writes `d4jsp_auth=<JWT>` on `.d4jsp.org` for WP federation.
6. Profile cached in localStorage for fast subsequent renders.

## JWT shape

- Access token: 1h default (Supabase default).
- Refresh token: 7d, auto-refreshed by SDK + `onAuthStateChange`.
- Cookie max-age: 365d (cookie persists; JWT inside refreshes).

## Cross-account refresh defense

`auth-context.js:49-55` tracks `expectedUserIdRef`. If `TOKEN_REFRESHED` fires with a different `user.id` (Chrome cookie sync replaying another account's refresh token), the event is dropped (line 199-201).

## Admin authorization

Server-side check pattern (every admin route):
```js
const { data: { user } } = await supabase.auth.getUser(token);
const { data: caller } = await adminDb.from('users').select('role').eq('id', user.id).single();
if (caller?.role !== 'admin') throw 403;
```

Role comes from DB, NEVER a JWT claim. Email-match for admin auto-promotion (`adam87lewis@gmail.com`) is server-side only.

## Sign-out

[`../../lib/auth-context.js:logOut`](../../lib/auth-context.js) → `supabase.auth.signOut()` → redirect to `https://d4jsp.org/d4jsp-logout` (WP plugin clears `.d4jsp.org` cookies → bounce back to gate).

## Related

- [`./cross-domain-cookies.md`](./cross-domain-cookies.md)
- [`./providers.md`](./providers.md)
- [`./rls.md`](./rls.md)
- [`../endpoints/auth.md`](../endpoints/auth.md)
- [`../data-model/users.md`](../data-model/users.md)
