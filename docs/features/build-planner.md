# Feature: Build Planner

Damage-calc + paper-doll + tier-gated build slots. Lives in the `D4JSP-Build-Planner` repo, served as a static export at `/builder` of the trade app.

## UI

Embedded inside the trade-app build (lazy-loaded). The standalone repo's `pages/index.js` renders [`../../../D4JSP-Build-Planner/components/BuildPlanner.js`](../../../D4JSP-Build-Planner/components/BuildPlanner.js).

## Persistence

Builds saved to `user_builds` table via `POST /api/save-build` on the trade app. Build Planner's `lib/supabase.js` uses `supabaseAuthed(token)` to pass the user JWT for RLS-gated writes.

## Tier gating

Permission `d4_build_slots` (catalog `admin_permissions`, mapped per tier in `subscription_tiers.permissions`) caps the user's saved builds. Default mapping: free=1, verified=1, basic=2, premium=3, legendary=5. Defined in [`../../../D4JSP-Build-Planner/migrations/002_build_planner_permissions.sql`](../../../D4JSP-Build-Planner/migrations/002_build_planner_permissions.sql) — **canonical example** of the catalog protocol.

## Other gated features

- `d4_build_notify_trade` — opt-in trade notifications when build items appear in listings (basic+).
- `d4_map_access` — gates the boss-farming map (basic+).

## Deploy

`next build` produces static `out/`, copied to KVM 4 nginx root under `/builder`. No runtime backend in the planner repo itself.

## Stack drift

Build Planner is on Next.js 14; trade app is on 15. Will silently break the day they need to share a server-side dep. See [`../audits/2026-04-26.md`](../audits/2026-04-26.md) finding BP-1.

## Related

- [`../catalogs/permissions.md`](../catalogs/permissions.md) — `d4_build_slots`
- [`../catalogs/subscription-tiers.md`](../catalogs/subscription-tiers.md) — tier permission mapping
- [`../endpoints/threads.md`](../endpoints/threads.md) — `/api/save-build` lives here
- [`../infra/connected-systems.md`](../infra/connected-systems.md) — build planner integration
