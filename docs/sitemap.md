# Sitemap

Every URL the system serves. Pages first, then API routes (grouped by area), then realtime channels.

## Pages

| Route | What it is | File |
|---|---|---|
| `/` | Home — Latest Trades feed, gem button, troll banner | [`../pages/index.js`](../pages/index.js) → [`../components/AppShell.js`](../components/AppShell.js) → [`../components/HomeView.js`](../components/HomeView.js) |
| `/widget/latest-trades` | Public iframe widget for WP hub | [`../pages/widget/latest-trades.js`](../pages/widget/latest-trades.js) |
| `/admin-panel/*` | Admin console (proxied to KVM 2:3001 via nginx) | proxy in [`../next.config.js`](../next.config.js) |
| `/builder/*` | Build Planner static export, mounted from D4JSP-Build-Planner | external static |
| `/invite/[referrerId]` | Referral capture page (sets localStorage) | [`../pages/invite/[referrerId].js`](../pages/invite/) |
| `/tooltip-preview` | Wowhead tooltip preview | [`../pages/tooltip-preview.js`](../pages/tooltip-preview.js) |

Inside `/` (the SPA shell, [`../components/AppShell.js`](../components/AppShell.js)) — view switcher renders one of:
- `home` — [`../components/HomeView.js`](../components/HomeView.js) — trade feed
- `thread` — [`../components/ThreadDetailView.js`](../components/ThreadDetailView.js) — single thread + escrow UI
- `messages` — [`../components/MessagesView.js`](../components/MessagesView.js) — DMs
- `profile` — [`../components/ProfileView.js`](../components/ProfileView.js) — profile + character + map iframe
- `shop` — [`../components/ShopView.js`](../components/ShopView.js) — tiers + FG packages
- `categories` — [`../components/CategoriesView.js`](../components/CategoriesView.js)
- `creators` — [`../components/CreatorsView.js`](../components/CreatorsView.js)
- `tooltips` — [`../components/TooltipsView.js`](../components/TooltipsView.js)
- `settings` — [`../components/SettingsView.js`](../components/SettingsView.js)
- `rules` — [`../components/RulesView.js`](../components/RulesView.js)
- `gamble` / `exchange` — [`../components/GambleView.js`](../components/GambleView.js), [`../components/ExchangeView.js`](../components/ExchangeView.js)
- `admin` — [`../components/AdminView.js`](../components/AdminView.js) (legacy in-app admin; canonical is the separate admin app)
- `buy`, `sell` — sell-pipeline overlay states
- `auth` — [`../components/AuthScreen.js`](../components/AuthScreen.js)

## API routes — auth

| Route | Method | See |
|---|---|---|
| `/api/auth/setup-user` | POST | [`./endpoints/auth.md`](./endpoints/auth.md) |
| `/api/auth/promote-admin` | POST | [`./endpoints/auth.md`](./endpoints/auth.md) |
| `/api/auth/expire-membership` | POST | [`./endpoints/auth.md`](./endpoints/auth.md) |
| `/api/auth/battlenet?mode=login\|link` | GET | [`./endpoints/auth.md`](./endpoints/auth.md) |
| `/api/auth/callback/google` | GET | [`./endpoints/auth.md`](./endpoints/auth.md) |
| `/api/auth/callback/battlenet` | GET | [`./endpoints/auth.md`](./endpoints/auth.md) |

## API routes — threads / replies / builds

`/api/threads`, `/api/thread`, `/api/create-thread`, `/api/create-reply`, `/api/cancel-listing`, `/api/save-build`, `/api/glow`, `/api/check-trade-limit`. See [`./endpoints/threads.md`](./endpoints/threads.md).

## API routes — escrow

`/api/initiate-escrow`, `/api/confirm-trade`, `/api/dispute-trade`. See [`./endpoints/escrow.md`](./endpoints/escrow.md).

## API routes — FG / transactions

`/api/transfer-fg`, `/api/grant-fg`, `/api/get-vault-stats`. See [`./endpoints/fg.md`](./endpoints/fg.md).

## API routes — quests / triggers / forum_trolls

`/api/quest-trigger`, `/api/forum-trolls`, `/api/quest-catalog`, `/api/my-quests`, `/api/my-skills`, `/api/admin/triggers/emit`, `/api/admin/trigger-config`, `/api/admin/trigger-expiry-check`, `/api/admin/quests`, `/api/admin/specials`. See [`./endpoints/quests-triggers.md`](./endpoints/quests-triggers.md).

## API routes — Stripe

`/api/create-payment-intent`, `/api/webhook`, `/api/confirm-membership`, `/api/events/enter`. See [`./endpoints/stripe.md`](./endpoints/stripe.md).

## API routes — OCR / sell pipeline

`/api/paddle-ocr`, `/api/item-search`, `/api/item-lookup`, `/api/identify-item`, `/api/fetch-item-template`, `/api/tooltip-snapshot`. See [`./endpoints/ocr.md`](./endpoints/ocr.md).

## API routes — admin (`/api/admin/*`)

32 routes. Full inventory: [`./endpoints/admin.md`](./endpoints/admin.md).

## API routes — widgets (public)

`/api/widget/latest-trades`. See [`./endpoints/widgets.md`](./endpoints/widgets.md).

## API routes — misc / telemetry

`/api/health`, `/api/boss-timer`, `/api/notification-count`, `/api/push-subscribe`, `/api/award-xp`, `/api/claim-referral`, `/api/generate-referral`, `/api/review`/`reviews`/`submit-review`/`respond-review`, `/api/quest-catalog`, `/api/skill-catalog`, `/api/store`, `/api/test-gemini` (410 stub), `/api/client-error`, `/api/block-user`, `/api/friends/*`, `/api/bots/activity`. See [`./endpoints/misc.md`](./endpoints/misc.md).

## Realtime channels

| Channel | Tables | Subscriber |
|---|---|---|
| `forum-trolls-global` | `forum_trolls` | [`../components/AppShell.js:671`](../components/AppShell.js) — drives gem-pressed UI |

(More channels can be added — see [`./features/realtime.md`](./features/realtime.md).)

## Cron / scheduled

| Job | Where | Cadence |
|---|---|---|
| `loot-scraper.py` | KVM 4 cron | Sundays 03:00 UTC |
| `build-scraper.py` | KVM 4 cron | Sundays 06:00 UTC |
| Supabase auto-backup | Supabase Pro | daily |
| certbot renew | KVM 4/2 systemd | timer |

(`/api/admin/trigger-expiry-check` should be scheduled but isn't — see [`./infra/scheduled-jobs.md`](./infra/scheduled-jobs.md).)

## Related

- [`./endpoints/`](./endpoints/) — per-area endpoint detail
- [`./features/`](./features/) — feature-level docs
- [`./infra/connected-systems.md`](./infra/connected-systems.md)
