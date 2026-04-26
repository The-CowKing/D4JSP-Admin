# Endpoints: admin

Every `/api/admin/*` route. Admin gate is `requireAdmin(req)` — Bearer JWT → `users.role='admin'` check. Caller's `id` becomes `admin_id` for audit.

## Per-user mutations

| Route | Method | Notes |
|---|---|---|
| `/api/admin/user-detail` | GET / POST | **Use this.** Per-user actions: `grantFg`, `grantBadge`, `removeBadge`, `setRole`, `banUser`, `unbanUser`, `setMembership`, `setRank`, `awardXp`, `setDisplayName`, `setAdminNotes`, `setTradingLocked`, `setMonitored`. Writes `admin_action_log` + `fg_ledger`. ([`../../pages/api/admin/user-detail.js`](../../pages/api/admin/user-detail.js)) |
| `/api/admin/action` | POST | **LEGACY (finding H-4).** Same actions, no audit log, no ledger. Migrate AdminView callers to `user-detail.js`. ([`../../pages/api/admin/action.js`](../../pages/api/admin/action.js)) |
| `/api/admin/grant-fg` | POST | Duplicate of admin grantFg (finding H-7). Delete or wire to user-detail.js. |

## Catalog CRUD

| Route | Catalog |
|---|---|
| `/api/admin/quests` | `quests` |
| `/api/admin/specials` | `specials` + `special_rules` |
| `/api/admin/skills` | `skills` |
| `/api/admin/badges` | `badges` |
| `/api/admin/permissions` | `permissions` + `admin_permissions` |
| `/api/admin/ranks` | `ranks` + `rank_grants` |
| `/api/admin/fg-packages` | `fg_packages` (correct path; AdminView still bypasses to anon — finding H-8) |
| `/api/admin/xp-rules` | `xp_rules` |
| `/api/admin/tabs` | featured tabs/categories |

## System config

| Route | Purpose |
|---|---|
| `/api/admin/config` | get/set/reset on `system_config`. Writes audit log. ([`../../pages/api/admin/config.js`](../../pages/api/admin/config.js)) |
| `/api/admin/config-fields` | edit `config_fields` (schema-of-keys for the admin UI). |
| `/api/admin/trigger-config` | edit `triggers.config` jsonb. |
| `/api/admin/trigger-expiry-check` | scan for expired triggers, fire/deactivate. |
| `/api/admin/triggers/emit` | debug: fire any trigger as any user. |

## Reconciliation + grants

| Route | Purpose |
|---|---|
| `/api/admin/reconcile` | Rebuild user_skills from subscription + rank. Body `{ action: 'reconcile_one'\|'reconcile_many'\|'reconcile_all', user_id\|user_ids }`. **Has divergent RANK_XP[] (finding C-3).** |
| `/api/admin/grants` | Grant a skill to a user (manual source). |
| `/api/admin/data` | Generic dashboard reads. |

## Bots

| Route | Purpose |
|---|---|
| `/api/admin/bots` | CRUD on `bot_configs`, run_activity, set_global, seed_threads. ([`../../pages/api/admin/bots.js`](../../pages/api/admin/bots.js)) |
| `/api/admin/seed-bot-threads` | **NO AUTH (finding C-1).** Wipes + reseeds GoblinBot threads. ([`../../pages/api/admin/seed-bot-threads.js`](../../pages/api/admin/seed-bot-threads.js)) |
| `/api/admin/seed-rewards-once` | **Token-only auth (finding C-2).** Token in source. |
| `/api/admin/seed-items` | 410 stub (Gemini removed). Safe. |

## Other

| Route | Purpose |
|---|---|
| `/api/admin/upload` | Multipart image upload to Supabase Storage. Hand-written parser. |
| `/api/admin/test-email` | Resend smoke test. |
| `/api/admin/training`, `/api/admin/training-crossref`, `/api/admin/tooltip-audit`, `/api/admin/tooltip-training`, `/api/admin/tooltip-training-init` | OCR training pipeline. |
| `/api/admin/gamble`, `/api/admin/ai-usage`, `/api/admin/approve-user` | Misc admin. |

## Related

- [`../admin/overview.md`](../admin/overview.md)
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) — findings C-1, C-2, H-4, H-7, H-8
