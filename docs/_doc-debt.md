# Doc Debt

Append-only list of documentation owed by recent code changes. **Empty this file before declaring any feature done.** If this file is non-empty at the start of a session, clearing it is the first task.

## Format

One line per item:
```
<SHA> · <surface area> · <what changed> · <doc to update>
```

## Current debt

*(empty)*

## Future cleanup (deferred — tracked here so they're not lost)

These are known cleanups that are NOT blocking any current feature. Promote to active debt when the area is being worked on.

- **Persistent gem-glow not actually persistent** (split off from #44 by Adam). Root cause: [`../../pages/api/forum-trolls.js`](../../pages/api/forum-trolls.js) GET sets `Cache-Control: public, s-maxage=20, stale-while-revalidate=10`. Hostinger/nginx caches the empty list for 20s. When a user clicks the gem and a `forum_trolls` row is INSERTed, the realtime event fires AppShell's `refetch('realtime:INSERT')` → GET `/api/forum-trolls` returns the stale cached empty response → `activeTrolls.length` stays 0 → `trollActive` stays false → `gem-pressed` class never applies. Fix: change `Cache-Control` to `no-store` on the GET. The 2-min idle poll on a single-row select is cheap, no need to cache. ~1-line change. Verification: spawn a troll, gem should enter persistent-glow within ~1s of the INSERT (realtime delivery time), not after 20s. (The fix is already prepared in the local working tree; awaiting separate commit per Adam's single-purpose direction.)
- **Add visual-regression snapshot for the Latest Trades gem position** (per #44 verification checklist). Capture mobile (375 px) + desktop (1440 px) Playwright screenshots of the gem's screen position, fail CI if it shifts. Prevents another z-index bump from re-detaching the gem.
- **Rename `/api/paddle-ocr` → `/api/ocr`.** Engine is RapidOCR; route name is legacy. Frontend `AppShell.js _doOcrFetch` URL needs to update with the route. Behavior change requiring a deploy. See [`./features/sell-pipeline.md`](./features/sell-pipeline.md) "Future cleanup".
- **Remove `.bak` files from `/opt/d4jsp-ocr/`** on KVM 2 — `ocr_server.py.paddle_bak`, `ocr_server.py.bak.pre-cluster.*`, `ocr_server.py.bak.pre-port-fix`. Historical, not used at runtime.
- **Re-establish D4JSP-Admin GitHub repo** as source of truth (currently edited in-place on KVM 2). See finding CS-2 in [`./audits/2026-04-26.md`](./audits/2026-04-26.md).

---

## How to use

1. **During active work / debugging**: hack fast, don't touch docs. Don't edit this file mid-iteration.
2. **When a commit changes architecture / API / UI / DB schema / infra / lib spine**: append a one-liner to this file describing what's owed.
3. **Before declaring a feature done**: clear this file by writing/updating the relevant docs. One batched commit, message format: `docs: update <area> after <feature>`.
4. **Don't end a session with this file non-empty.** Doc debt is a blocker for moving forward, not for moving fast.

## What counts as doc-relevant

Globs that trigger debt:
- `pages/**` (routes, page components) → likely debt on `docs/sitemap.md` + a `docs/features/*` page
- `pages/api/**` → debt on a `docs/endpoints/*` page
- `components/**` of consequence (AppShell, HomeView, AdminView, ProfileView, ThreadDetailView, AuthScreen) → debt on a `docs/features/*` page
- `migrations/**` → debt on `docs/data-model/migrations.md` and any affected `docs/catalogs/*` or `docs/data-model/*`
- `lib/triggerEngine.js`, `lib/sysConfig.js`, `lib/rankEngine.js`, `lib/auth-context.js`, `lib/supabase.js`, `lib/supabase-admin.js` → debt on `docs/modular-system/*` or `docs/auth/*`
- `next.config.js`, `server.js`, `ecosystem.config.js`, `.bat` deploy files → debt on `docs/infra/*`
- `package.json` dependency changes that matter → debt on `docs/conventions.md`

What does NOT count: typo fixes, comment-only changes, formatting, log-level tweaks, dependency bumps that don't change behavior.
