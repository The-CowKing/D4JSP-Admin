# Admin: Overview

The admin console is its own Next.js app (`D4JSP-Admin` repo) running on KVM 2 :3001, surfaced at `https://trade.d4jsp.org/admin-panel/*` via nginx rewrites.

## Architecture

- **Repo:** `C:\Users\Owner\D4JSP-Admin`. **GitHub repo is STALE** — code is currently edited in-place on KVM 2 (CS-2).
- **Stack:** Next.js 15.3.3, 2 pages (`pages/_app.js`, `pages/index.js`), lazy-loaded `AdminView`. **No own API routes** — every fetch proxies back to D4JSP via `next.config.js` rewrites.
- **Auth:** Google OAuth via shared `.d4jsp.org` Supabase cookie. `pages/index.js` checks `useAuth().isAdmin`; non-admins see "Access Denied" panel.
- **Deploy:** edited in-place on KVM 2 → `npm run build && pm2 restart d4jsp-admin`. See [`../infra/deploy.md`](../infra/deploy.md).

## Why isolated

Security. Admin app runs on a different VPS, on `127.0.0.1:3001` (not publicly reachable). nginx on KVM 4 proxies authenticated requests through. Without the trade app's nginx layer, the admin app is invisible.

## Tabs

Each tab edits one or more catalogs. See:
- [`./users-tab.md`](./users-tab.md)
- [`./quests-tab.md`](./quests-tab.md)
- [`./specials-tab.md`](./specials-tab.md)
- [`./skills-tab.md`](./skills-tab.md)
- [`./subscriptions-tab.md`](./subscriptions-tab.md)
- [`./permissions-tab.md`](./permissions-tab.md)
- [`./ranks-tab.md`](./ranks-tab.md)
- [`./system-config-tab.md`](./system-config-tab.md)
- [`./bots-tab.md`](./bots-tab.md)
- [`./training-tab.md`](./training-tab.md)

## Fragile points

- **`AdminView.js` is 7,506 LOC** in the trade app's `components/`. The same file is mirrored into the admin repo. Drift risk.
- **Anon-client writes** for `fg_packages` and `subscription_tiers` (lines 3607/3623/3629 — finding H-8). Should route through admin API.
- **Two parallel mutation endpoints** (`/api/admin/action.js` legacy vs `/api/admin/user-detail.js` correct). Migrate AdminView calls to user-detail.

## Related

- [`../endpoints/admin.md`](../endpoints/admin.md)
- [`../infra/kvm-2.md`](../infra/kvm-2.md)
- [`../infra/connected-systems.md`](../infra/connected-systems.md)
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) — Section 7.3 A — admin app per-app summary
