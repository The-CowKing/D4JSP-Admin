# D4JSP-Admin — Admin Panel architecture + 2026-04-27 updates

> **Read this in conjunction with [`./admin/overview.md`](./admin/overview.md).** This doc captures the launch-day rescue session deltas and is the entrypoint for next-bot ramp on the admin app.

> **Master entrypoint** is the main `D4JSP` repo's [`../start.md`](../start.md) (or via the wiki this doc lives in). Everything cross-app starts there.

## Where the admin app lives

- **Repo:** `C:\Users\Owner\D4JSP-Admin`. GitHub repo path: `github.com/The-CowKing/D4JSP-Admin`. **GitHub repo may be stale** — code has historically been edited in-place on KVM 2.
- **Stack:** Next.js 15.3.3, 2 pages (`pages/_app.js`, `pages/index.js`), lazy-loaded `AdminView`. No own API routes — every fetch proxies back to the main D4JSP repo via `next.config.js` rewrites.
- **Surfaced URL:** `https://trade.d4jsp.org/admin-panel/*`.
- **Deploy:**
  - **KVM 2:** Hostinger VPS `187.124.239.213`. Process: PM2 `d4jsp-admin` cluster, port `3001` (bound to localhost; surfaced via KVM 4 nginx).
  - **KVM 2 SSH key:** `~/Desktop/keyz/d4jsp_kvm2_claude`.
  - **In-place build:** `ssh ... "cd /opt/d4jsp-admin && npm run build && pm2 restart d4jsp-admin"`.
  - **basePath = `/admin-panel`** (added in `next.config.js` per #88) so the proxied app routes correctly.

## Routing surface map

`/admin-panel/*` routes proxied to KVM 2:3001 by KVM 4 nginx. The admin app uses `basePath: '/admin-panel'` in `next.config.js`. All API calls from the admin client side are proxied via `next.config.js` rewrites back to `https://trade.d4jsp.org/api/*`. Admin endpoints there (`/api/admin/*`) check `users.role === 'admin'` after bearer verify.

## Modular catalog admin surfaces (2026-04-27 state)

Each tab edits one (or more) catalog tables — service-role writes via `adminDb`. The admin app NEVER writes to the DB directly using the anon client.

- **Users tab** — `users.role` / `banned` / `monitored` / `trading_locked` / strikes / FG balance reads. Endpoint: `/api/admin/user-detail`.
- **Quests tab** — `quests` + `triggers` catalogs. CRUD on quest definitions, attached triggers, reward shape (rewards jsonb array).
- **Specials tab** — `specials` + `special_rules` + `special_claims`.
- **Skills tab** — `skills` catalog CRUD. Includes `skills.config.default_duration_minutes` per type (set by migration 057). Edit AMOUNT per rank but NOT per-binding duration. Per-binding duration field stripped from rank-bindings UI in #143.
- **Subscriptions tab** — `subscription_tiers` rows. Edit `skills[]` array (uuid array — which skills the tier grants on purchase) and `skills_config` jsonb (per-skill amount overrides, default 20).
- **Permissions tab** — `permissions` catalog (capability gates).
- **Ranks tab** — `rank_rewards` table (created migration 053, seeded 059). Save Rank uses `getSession()` per call (no "Session invalid" cause that previously broke save — root cause was a stale cached session in the admin client, not a permission issue).
- **System Config tab** — `system_config` rows. `category` is CHECK-constrained (includes `ai`, `escrow`, etc — full list in main repo's `docs/conventions.md`). `value_type` must be `boolean|number|string|json` (NOT `bool`). `ship_default jsonb` is NOT NULL.
- **Bots tab** — `users.is_bot` markers.
- **Training tab** — admin-only training data.
- **Promo Codes tab** — CRUD on `promo_codes` + redemption list per code (created migration 062, `D4JSP-Clan1` seeded). See main repo's [`features/promo-codes.md`](../../D4JSP/docs/features/promo-codes.md).
- **AI Identifications tab** — review queue for OCR auto-absorbed `wowhead_tooltips` rows (when `system_config.ai.auto_absorb_unknown_items=true`; default OFF).

## Save Rank "Session invalid" fix

**Symptom:** clicking Save Rank in `/admin-panel → Ranks` returned "Session invalid" toast.

**Root cause:** the admin client cached the initial-mount session and the cached token had expired by the time Adam clicked Save Rank. The endpoint validated the token, found it expired, returned 401.

**Fix:** call `supabase.auth.getSession()` per save call — gets the freshest session token, including any auto-refreshed token. Then send the bearer header on the API call.

```js
async function saveRank() {
  const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !session) {
    toast.error('Session invalid — please re-login');
    return;
  }
  await fetch('/api/admin/rank-rewards', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify({ rank_level, rewards }),
  });
}
```

The endpoint side uses service-role `adminDb` after bearer verify.

## Pending Migrations panel

`AdminView.js` has a "Pending Migrations" panel — Adam clicks Apply per migration. The endpoint `/api/admin/apply-migration.js` has an ALLOWED set of migration numbers to gate which can run. Bumped during the 2026-04-27 session to include `'047'`, `'048'`, `'051'`, etc as those landed.

The bot SHOULD apply migrations directly via Supabase MCP (`apply_migration` tool) per the main directive — the panel exists as a fallback for cases where the MCP path is blocked. Don't tell Adam "click apply" unless the MCP path actually fails.

## DO NOT BREAK (admin-specific)

1. **Verified-flip discipline.** NEVER flip any `verified` switch in admin based on internal/programmatic verification alone. Adam confirms in prod first. Then a separate small commit flips. See main repo `docs/conventions.md`.
2. **`AdminView.js` is large (~7506 LOC) and mirrored** between this repo and the main D4JSP `components/` — drift risk. When editing, edit BOTH OR confirm KVM 2 in-place edit is the source of truth for that file.
3. **`role='admin'` check on every endpoint.** Don't expose admin endpoints behind only the bearer verify; require `users.role='admin'` after.
4. **Service-role for writes.** Admin endpoints use `adminDb` — never the authenticated client.
5. **No anon-client writes for `fg_packages` / `subscription_tiers`.** Finding H-8 — should route through admin API.

## Related

- [`./security.md`](./security.md) — admin security model
- [`./admin/overview.md`](./admin/overview.md) — original architecture doc (pre-2026-04-27)
- [`./admin/users-tab.md`](./admin/users-tab.md), [`./admin/ranks-tab.md`](./admin/ranks-tab.md), [`./admin/skills-tab.md`](./admin/skills-tab.md) — per-tab references
- [`./catalogs/system-config.md`](./catalogs/system-config.md) — knob reference
- Main D4JSP repo:
  - [`features/skills.md`](../../D4JSP/docs/features/skills.md) — modular skills system
  - [`features/escrow-protection.md`](../../D4JSP/docs/features/escrow-protection.md) — Phase 1 escrow knobs
  - [`features/promo-codes.md`](../../D4JSP/docs/features/promo-codes.md)
  - [`security/rls-and-identity.md`](../../D4JSP/docs/security/rls-and-identity.md)
  - [`integrations/stripe.md`](../../D4JSP/docs/integrations/stripe.md)
  - [`numbered-fg-vault.md`](../../D4JSP/docs/numbered-fg-vault.md)
