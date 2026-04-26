# Modular System: Overview

D4JSP runs a GamiPress-style spine. **Every feature is a row in a CATALOG table that gets consumed by an ENDPOINT.** Nothing about gamification, currency, or tier-gating is hardcoded. New features must plug into existing catalogs — never invent a parallel system.

## The contract

```
┌──────────────┐  register     ┌────────────┐  reference     ┌────────────┐
│   ADMIN UI   │──────────────▶│  CATALOG   │◀──────────────│  ENDPOINT  │
│ /admin-panel │  via /api/    │ (DB table) │  via lib/* +  │ (API route │
└──────────────┘  admin/<x>    └────────────┘    SQL RPC    │  / worker) │
                                                             └────────────┘
                                                                    │
                                                                    ▼
                                                          ┌──────────────────┐
                                                          │ AUDIT + LEDGER   │
                                                          └──────────────────┘
```

## Vocabulary

- **Catalog** — Postgres table where features are *defined*. Index in [`../catalogs/`](../catalogs/).
- **Endpoint** — API route that *reads* a catalog and acts. Index in [`../endpoints/`](../endpoints/).
- **Config** — JSON sub-document on a catalog row OR a row in `system_config`. Trigger config = *when it fires*. Quest config = *what happens*. Operational config = `system_config` only.
- **Dispatcher** — [`../../lib/triggerEngine.js`](../../lib/triggerEngine.js) `emitTrigger(triggerId, userId)` calls the `process_trigger` PL/pgSQL function via `adminDb.rpc()`.

## The catalogs

| Catalog | Schema doc | Admin endpoint |
|---|---|---|
| `triggers` | [`../catalogs/triggers.md`](../catalogs/triggers.md) | `/api/admin/trigger-config` |
| `quests` | [`../catalogs/quests.md`](../catalogs/quests.md) | `/api/admin/quests` |
| `specials` + `special_rules` + `special_claims` | [`../catalogs/specials.md`](../catalogs/specials.md) | `/api/admin/specials` |
| `skills` + `user_skills` | [`../catalogs/skills.md`](../catalogs/skills.md) | `/api/admin/skills`, `/api/admin/grants`, `/api/admin/reconcile` |
| `badges` + `user_badges` | [`../catalogs/badges.md`](../catalogs/badges.md) | `/api/admin/badges` |
| `subscription_tiers` | [`../catalogs/subscription-tiers.md`](../catalogs/subscription-tiers.md) | (anon-client writes from AdminView — finding H-8) |
| `fg_packages` | [`../catalogs/fg-packages.md`](../catalogs/fg-packages.md) | `/api/admin/fg-packages` (also bypassed — H-8) |
| `permissions` + `admin_permissions` | [`../catalogs/permissions.md`](../catalogs/permissions.md) | `/api/admin/permissions` |
| `ranks` + `rank_grants` | [`../catalogs/ranks.md`](../catalogs/ranks.md) | `/api/admin/ranks` |
| `system_config` + `system_config_log` + `config_fields` | [`../catalogs/system-config.md`](../catalogs/system-config.md) | `/api/admin/config`, `/api/admin/config-fields` |
| `xp_rules` | [`../catalogs/xp-rules.md`](../catalogs/xp-rules.md) | `/api/admin/xp-rules` |

## The traced example: forum troll quest

End-to-end. Every step has a file:line citation.

1. **Admin defines the quest.** `/admin-panel` Quests tab → `POST /api/admin/quests` ([`../../pages/api/admin/quests.js`](../../pages/api/admin/quests.js)) → `INSERT INTO quests {trigger_id: 'forum_troll_spawned', type: 'one_time', xp_reward: 35, fg_reward: 50, config: {clicks_to_kill: 3, despawn_minutes: 30, spawn_location: 'any'}}`.
2. **Trigger row pre-exists.** `triggers.id='forum_troll_spawned', config: {recurring: true, expires_after: 7, on_expiry: 'auto_fire', allowed_subscriptions: ['premium','legendary']}`. Edit via `/api/admin/trigger-config`.
3. **Specials attached.** Rows in `specials` where `trigger_id='forum_troll_spawned'` define FG/badge grants; `special_rules` rows add per-user conditions ("first time only").
4. **User clicks the gem.** [`AppShell.js`](../../components/AppShell.js) gem click handler → `POST /api/quest-trigger { trigger_id: 'forum_troll_spawned' }`.
5. **`pages/api/quest-trigger.js:22-188`** verifies JWT, checks trigger gating, finds matching quests, upserts `quest_progress`, marks completion when `progress >= threshold` (line 138 hardcoded `1` — finding M-3), calls `_grantQuestRewards()` (inline FG/XP add — bypasses `fg_ledger`, finding M-2), then `_spawnForumTroll()` inserts a row into `forum_trolls` with HP/despawn/thread from `quest.config`.
6. **`emitTrigger('forum_troll_spawned', user.id)`** ([`../../lib/triggerEngine.js:22`](../../lib/triggerEngine.js)) → `adminDb.rpc('process_trigger', ...)` → fires every `specials` matching the trigger, writes `special_claims`. `_sendSpecialEmails()` fires grant emails async via Resend.
7. **Realtime fan-out.** `forum_trolls` is in the `supabase_realtime` publication ([`../../migrations/038_forum_trolls_realtime.sql`](../../migrations/038_forum_trolls_realtime.sql)). All clients get a `postgres_changes` INSERT; banner appears, gem stays pressed via `.gem-pressed` class on [`HomeView.js:850`](../../components/HomeView.js).
8. **Cycle reset.** If `triggers.config.recurring`, `quest-trigger.js:177-181` updates `cycle_start`. `pages/api/admin/trigger-expiry-check.js` is the cron-style scanner (no real cron yet — manual or external scheduler).

## Inline business constants that bypass the catalog (HIDDEN CONFIG VIOLATIONS)

Each below should move to `system_config` and be read via `getConfig()`.

| Constant | File:Line | Current | Target |
|---|---|---|---|
| Escrow lock period | `pages/api/initiate-escrow.js:67` | 2h | `escrow.lock_hours` |
| Escrow auto-complete | `pages/api/initiate-escrow.js:78` | 24h | `escrow.auto_complete_hours` |
| FG transfer max | `pages/api/transfer-fg.js:23` | 1,000,000 | `currency.transfer_max` |
| Signup FG | `pages/api/auth/setup-user.js:20` | 1000 | `currency.new_user_fg` |
| Quest threshold | `pages/api/quest-trigger.js:138` | 1 | `quests.requirements.threshold` |
| Membership badges | `pages/api/webhook.js:21-26` | inline map | `subscription_tiers.badges` |
| Notification daily caps | `lib/notificationLimits.js:1-43` | per-tier | `notification.<tier>_daily_cap` |
| Glow cooldowns | `lib/trade-limits.js:5-6` | 1h/24h | `trade.glow_cooldown_*_hours` |
| Bot fallback IDs | `pages/api/admin/bots.js:11-22` | 10 UUIDs | source from `bot_configs` only |
| Rank `fgReward` | `lib/rankEngine.js:1-52` | inline | `ranks.fg_reward` column |

## Related

- [`../../start.md`](../../start.md) — TOC
- [`../catalogs/`](../catalogs/) — all catalog schemas
- [`../endpoints/`](../endpoints/) — all API routes
- [`../features/forum-troll-gem.md`](../features/forum-troll-gem.md) — the gem-spawn UI side of the trace
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) §2 — original audit's modular system map
