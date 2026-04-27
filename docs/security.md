# D4JSP-Admin — Security model

> Mirror of [`../../D4JSP/docs/security/rls-and-identity.md`](../../D4JSP/docs/security/rls-and-identity.md), specialized for admin-app concerns. Read the main repo's doc for full RLS posture and identity gate hierarchy.

## Admin role gate

The admin app is gated at three levels:

1. **Network level:** the admin app runs on KVM 2 :3001 bound to `127.0.0.1`. NOT publicly reachable. Surface is via KVM 4 nginx proxy at `https://trade.d4jsp.org/admin-panel/*`.
2. **Auth level:** Cross-domain cookie SSO — login on any `.d4jsp.org` subdomain propagates here. The admin app reads `useAuth().isAdmin`, non-admins see "Access Denied" panel.
3. **Endpoint level:** every API call from this app proxies back to the main D4JSP repo's `/api/admin/*` routes. Each endpoint server-side verifies `users.role === 'admin'` after bearer auth. Admin role is the authoritative check — don't trust client-side `isAdmin` for actual permissions.

## Service-role writes

All `INSERT` / `UPDATE` / `DELETE` mutations go through `adminDb` (Supabase service-role client) on the server side. Never use anon/authenticated client for admin mutations — RLS would block, and even if it didn't, the audit trail would be broken (no admin attribution).

The pattern, from main repo:

```js
// /api/admin/<action>.js (in main D4JSP repo)
import { adminDb } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
  // 1. Bearer verify
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'NO_AUTH' });
  const token = auth.slice(7);
  const { data: { user }, error } = await adminDb.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'INVALID_TOKEN' });

  // 2. Admin role check
  const { data: u } = await adminDb.from('users').select('role').eq('id', user.id).single();
  if (u?.role !== 'admin') return res.status(403).json({ error: 'NOT_ADMIN' });

  // 3. Mutation via adminDb
  await adminDb.from('rank_rewards').insert(...);
  return res.status(200).json({ ok: true });
}
```

## RLS posture for admin-touched tables

These tables are RLS-locked to service-role only for writes (and most reads). The admin app touches them via the main repo's API routes:

- `users` — admin can flip `role`, `banned`, `monitored`, `trading_locked`, `strike_count`, `approved`, etc.
- `rank_rewards` — service-role only.
- `promo_codes` / `promo_code_redemptions` — service-role only.
- `stripe_events_processed` — service-role only.
- `transactions` — service-role only.
- `escrow` — admin can review disputed rows, change status, etc.
- `fg_serial_ranges` / `fg_ledger` / `fg_vault` — server-only. Admin Vault panel READS aggregate counters via the main repo's API.
- `user_skills` — admin can grant manually (`source='manual'`, `granted_by=$admin_uid`).
- `subscription_tiers` — service-role for writes.
- `system_config` — service-role for writes.
- `wowhead_tooltips` — admin reviews `reviewed=false` rows, flips to `reviewed=true`.

## Permissions table

The `permissions` catalog defines capability gates per tier (e.g. `d4_build_slots: 3`). Admin tab edits this. Permissions feed into `subscription_tiers.permissions jsonb` per-tier. Endpoints check via `lib/sysConfig.js` or per-feature gates.

## Save Rank session refresh — the auth lesson

The 2026-04-27 "Session invalid" bug on `/admin-panel → Ranks` was an auth-token freshness issue, not a permission issue. The fix was to call `supabase.auth.getSession()` per save call rather than relying on initial-mount session. See [`./admin-panel.md`](./admin-panel.md) for details. Lesson: any admin click that mutates state should grab a fresh session before sending the bearer.

## Webhook signature verification (mirrors main repo)

For completeness — the admin app doesn't host the webhook (lives in main D4JSP repo's `pages/api/webhook.js`). Stripe signature is verified with `STRIPE_WEBHOOK_SECRET` (currently TEST mode `whsec_mn1Qehgi7gdgJMdq32mbKjYH9E7bXewC`). The `stripe_events_processed` insert is the FIRST step before any mint logic — see main repo `integrations/stripe.md`.

## DO NOT BREAK

1. **Admin role check on every admin endpoint.** Don't trust the network-level isolation alone.
2. **Service-role keys NEVER in the admin client bundle.** All mutations go server-side.
3. **Cross-domain cookies on `.d4jsp.org`.** Don't change scope to per-subdomain — breaks SSO.
4. **Verified-flip discipline.** Admin "verified" switches NEVER auto-flip. Adam confirms first.
5. **No anon-client writes.** Even from admin-only UIs. Always proxy through API.

## Related

- Main repo:
  - [`security/rls-and-identity.md`](../../D4JSP/docs/security/rls-and-identity.md) — full doc
  - [`auth/rls.md`](../../D4JSP/docs/auth/rls.md) — per-table RLS
  - [`auth/cross-domain-cookies.md`](../../D4JSP/docs/auth/cross-domain-cookies.md) — chunked cookie scheme
- This repo:
  - [`./admin-panel.md`](./admin-panel.md) — admin app architecture
  - [`./auth/rls.md`](./auth/rls.md) — per-table RLS in this repo's wiki
