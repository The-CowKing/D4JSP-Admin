# Glossary

Vocabulary used consistently across this wiki. If a term in code disagrees with a term here, prefer the term here when writing prose; use the code's literal name when citing identifiers.

## Currency + economy
- **FG (Forum Gold)** — platform currency. Stored as `users.fg_balance` (int). Earned through XP, quests, referrals, special grants; purchased via Stripe in fixed packages. Ledger of every movement is `fg_ledger`.
- **`fg_ledger`** — canonical FG transaction history. Append-only. Columns: `from_uid`, `to_uid`, `amount`, `reason`, `ref_id`, `admin_id`, `created_at`. See [`./data-model/fg-ledger.md`](./data-model/fg-ledger.md).
- **`fg_transfers`** — legacy ledger written by [`/api/transfer-fg`](../pages/api/transfer-fg.js). Being deprecated in favor of `fg_ledger`.
- **`fg_vault`** — singleton row tracking platform supply (`in_circulation`, `total_burned`, `total_supply`).
- **`transactions`** — Stripe-purchase ledger. UNIQUE(`stripe_payment_id`) gives webhook idempotency.
- **Escrow** — FG held by the platform between buyer accept and seller deliver. Auto-completes 24h after creation if no dispute. See [`./features/escrow.md`](./features/escrow.md).

## The modular spine
- **Catalog** — Postgres table where features are *defined*. Examples: `triggers`, `quests`, `specials`, `skills`, `badges`, `subscription_tiers`, `fg_packages`, `permissions`, `ranks`, `system_config`, `xp_rules`. Index in [`./catalogs/`](./catalogs/).
- **Endpoint** — API route that *reads* a catalog and acts on it. Index in [`./endpoints/`](./endpoints/).
- **Config** — JSON sub-document on a catalog row OR a row in `system_config`. Trigger config = *when it fires*. Quest config = *what happens*. Operational tunables = `system_config` only, accessed via [`../lib/sysConfig.js`](../lib/sysConfig.js).
- **Trigger** — registered event id (e.g. `forum_troll_spawned`). Fired by frontend (gem click) or system (signup). Dispatched via the `process_trigger` PL/pgSQL function. See [`./catalogs/triggers.md`](./catalogs/triggers.md).
- **Special** — reward grant attached to a trigger. When the trigger fires, all enabled specials with that `trigger_id` award FG/badges/XP. Append-only history in `special_claims`. See [`./catalogs/specials.md`](./catalogs/specials.md).
- **Quest** — objective bound to a trigger. `one_time` / `daily` / `weekly`. Awards `fg_reward` + `xp_reward` when threshold met. See [`./catalogs/quests.md`](./catalogs/quests.md).
- **Skill** — grantable ability (e.g. "FG Bonus", "Extra Posts/day", "XP Boost", "Raffle Tickets/mo"). Granted via subscription tier, rank, or admin manual. Per-user state in `user_skills`. See [`./catalogs/skills.md`](./catalogs/skills.md).
- **Permission** — capability gate (e.g. `d4_build_slots: 3`). Tier-mapped JSON value. Catalog `admin_permissions` is canonical. See [`./catalogs/permissions.md`](./catalogs/permissions.md).
- **Rank** — XP-thresholded level (Scavenger → Godslayer, 50 levels). Defined in [`../lib/rankEngine.js`](../lib/rankEngine.js); per-rank skill grants in `rank_grants` table.
- **Tier** — subscription level: `free`, `verified`, `basic`, `premium`, `legendary`. Defined in `subscription_tiers` catalog. Drives skill/permission grants via `pages/api/admin/reconcile.js`.
- **`process_trigger`** — PL/pgSQL function in Supabase. Reads `specials` matching a trigger id, applies `special_rules`, awards FG/badges/XP, writes `special_claims`. Lives only in the Supabase console (gap H-10).
- **`emitTrigger(triggerId, userId)`** — Node helper in [`../lib/triggerEngine.js`](../lib/triggerEngine.js) that calls `process_trigger` via RPC.

## UI features
- **Latest Trades** — main feed at `/`. UI: [`../components/AppShell.js`](../components/AppShell.js) + [`../components/HomeView.js`](../components/HomeView.js).
- **Gem** — clickable header gem on Latest Trades. Multiple clicks accumulate in `gemClicks`; once `gemTarget` is met, `forum_troll_spawned` trigger fires and a troll is created. See [`./features/forum-troll-gem.md`](./features/forum-troll-gem.md).
- **Troll** — `forum_trolls` row. Has HP, despawn timer, attached to a randomly-selected thread. Killed by repeated user clicks on its thread card. Realtime-published.
- **EventTicker** — scrolling marquee at top of feed. WAAPI animation. Currently being refactored.
- **OCR sell pipeline** — user uploads in-game screenshot → resize → POST to KVM 2 RapidOCR (`/api/paddle-ocr`) → parse item name → DB match in `wowhead_tooltips` / `d4_equipment` → BuyView pre-filled. See [`./features/sell-pipeline.md`](./features/sell-pipeline.md).
- **Tooltip** — Wowhead-rendered item card. Cached as `tooltipHtml` on `threads.item_data`. PNG fallback in `tooltip-snapshots` Storage bucket.

## Auth + sessions
- **Cross-domain auth cookie** — `.d4jsp.org` chunked Supabase session + `d4jsp_auth` JWT cookie. Federation glue across 4 trade apps + 8 WordPress sites. See [`./auth/cross-domain-cookies.md`](./auth/cross-domain-cookies.md).
- **`adminDb`** — `lib/supabase-admin.js` service-role client. Bypasses RLS. **Server-side only.** Throws if `SUPABASE_SERVICE_ROLE_KEY` is missing.
- **`supabase`** — anon-key client from [`../lib/supabase.js`](../lib/supabase.js). Subject to RLS.
- **`supabaseAuthed(token)`** — one-shot client factory from `lib/supabase.js`. Pass user JWT for write operations that need user-scoped RLS.

## Infrastructure
- **KVM 4** — Hostinger VPS at `177.7.32.128`. Runs the trade app at `/opt/d4jsp`, PM2 process `d4jsp`, port 3000. Public via nginx → `https://trade.d4jsp.org`.
- **KVM 2** — Hostinger VPS at `187.124.239.213`. Runs admin (`:3001`), OCR (`:9000`), tooltip (`:3100`).
- **Cloud** — Hostinger Cloud Pro plan at `82.29.193.20:65002`. Runs WordPress multisite (`d4jsp.org` + 7 satellites). LiteSpeed cache.
- **Realtime publication** — `supabase_realtime`. Subscribed-to tables: `forum_trolls` (added by `migrations/038`). Add others with `ALTER PUBLICATION supabase_realtime ADD TABLE <name>`.

## People + roles
- **Adam** — Adam Lewis (`adam87lewis@gmail.com`). Owner. Hardcoded admin email.
- **Cowork** — Adam's Claude desktop with Claude in Chrome MCP. Drives the browser. Does NOT edit code.
- **Claude Code** — this agent. Edits code, runs deploys. Does NOT drive Chrome.

## Common acronyms
- **FG** — Forum Gold (the currency)
- **OCR** — Optical Character Recognition (the sell pipeline)
- **WAAPI** — Web Animations API
- **RLS** — Row-Level Security (Supabase Postgres feature)
- **PAT** — Personal Access Token (GitHub auth)
- **CSP** — Content Security Policy (HTTP header)
- **SSO** — Single Sign-On (the cross-domain cookie scheme)

## See also
- [`../start.md`](../start.md) — short glossary (subset of this one)
- [`./conventions.md`](./conventions.md) — agent operating manual
