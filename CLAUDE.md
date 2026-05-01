# CLAUDE.md — D4JSP-Admin load-bearing rules

Sibling repo to `D4JSP` (trade core), `D4JSP-Map`, `D4JSP-Build-Planner`. The full project rules live in `C:\Users\Owner\D4JSP\CLAUDE.md` and the deep memory in `agent/memory/d4jsp_session_2026-04-27_learnings.md`. Read those first.

**Stack:** Next.js 15 (pages router) on port 3001. Admin app is its own bundle, deployed to `/opt/d4jsp-admin` on KVM 2 as pm2 process `d4jsp-admin`. Trade core proxies `/admin-panel/**` → KVM 2:3001 via `next.config.js` rewrites (with `Cache-Control: no-store` on the proxy to prevent LiteSpeed from caching empty bodies during VPS restarts).

`basePath: '/admin-panel'` is set in `next.config.js` so the admin app's `/_next/...` assets don't collide with the main app's build.

Admin app's `next.config.js` rewrites `/api/admin/*` BACK to the main trade app — admin endpoints (e.g. `pages/api/admin/*`) live in the trade-core repo, not here.

---

## CORE DIRECTIVES (NEVER VIOLATE)

### 1. `start.md` lives at repo root, never moves
### 2. `CLAUDE.md` (this file) lives at repo root, never moves
### 3. Push-via-temp-branch — direct `main` push is denied
Same as the other repos. Use `<sha>:deploy/<feature-branch>`.

### 4. Verified-flip discipline
NEVER flip any `verified` switch in admin. Adam confirms in prod first. Same rule across all repos but worth re-pinning HERE because admin UI is where the flip actually lives.

### 5. Service-role usage
All admin endpoints use `adminDb` (Supabase service_role client) via `lib/supabaseAdmin.js`. Never anon/authenticated client for INSERT/UPDATE on RLS-enabled tables.

### 6. Admin role check
`users.role='admin'` flag gates admin actions. The proxied `/admin-panel/**` URL is non-discoverable but NOT a security boundary — every action must re-check the role server-side.

### 7. Don't collapse admin panel into trade core
9d5c480 (2026-04-16) extracted admin into its own bundle to remove ~800KB JS from every public visit. Don't undo that.

---

## DON'T DO LIST

- **Don't open admin tabs to the public internet.** Admin reaches the user via reverse-proxy through trade.d4jsp.org. Direct public exposure is a security regression.
- **Don't enable `system_config.ai.auto_absorb_unknown_items`** without Adam's go-ahead. The OCR auto-absorb gate is OFF by default. Approval criteria in the memory file.
- **Don't execute the 90B FG burn** (migration 054 staged but unapplied). Adam's "burn time" call required.
- **Don't write `system_config` rows without `ship_default` AND a valid `value_type`** (`boolean|number|string|json` — NOT `bool`!). The CHECK constraint will reject. Categories: `account|ai|auction|auction_fines|automod|currency|dispute(s)|escrow|fee(s)|item_rules|maintenance|moderation|notification|penalt(y|ies)|raffle|rate_limit(s)|trade|trade_limits|trust|widget`.

---

## Recurring failure modes (from the memory file)

When admin loads white/stuck:
1. PM2 `d4jsp-admin` process down or crash-looping → SSH KVM 2, `pm2 list`, `pm2 restart d4jsp-admin`.
2. Stale build on KVM 2 (D4JSP-Admin repo and `/opt/d4jsp-admin` can drift).
3. LiteSpeed cached empty body — should be self-healing now that `Cache-Control: no-store` is set on the proxy.

---

## Quick reference

- **Project bible:** `C:\Users\Owner\D4JSP\CLAUDE.md`
- **Memory:** `agent/memory/d4jsp_session_2026-04-27_learnings.md`
- **Schema reference:** memory file LIVE SCHEMA section + `docs/data-model/migrations.md` in trade core
