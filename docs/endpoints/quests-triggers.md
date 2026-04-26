# Endpoints: quests + triggers + forum_trolls

The trigger ingest path. Frontend calls `quest-trigger` when a trigger condition fires; server orchestrates quest progression + special grants + troll spawn.

## Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/quest-trigger` | POST | Bearer JWT | Frontend fires a trigger. Body `{ trigger_id }`. Advances `quest_progress`, on completion calls `_grantQuestRewards()` + `_spawnForumTroll()` if applicable + `emitTrigger()` for specials. ([`../../pages/api/quest-trigger.js`](../../pages/api/quest-trigger.js)) |
| `/api/forum-trolls` | GET | none | List active trolls. |
| `/api/forum-trolls` | POST | Bearer JWT | Body `{ action: 'hit', troll_id }`. Decrement HP. On HP=0: remove row, fire `forum_troll_slain`. |
| `/api/admin/triggers/emit` | POST | Admin | Debug: fire any trigger as any user. Audit-logged in `request_logs`. ([`../../pages/api/admin/triggers/emit.js`](../../pages/api/admin/triggers/emit.js)) |
| `/api/admin/trigger-config` | GET/POST | Admin | Read/edit `triggers.config`. ([`../../pages/api/admin/trigger-config.js`](../../pages/api/admin/trigger-config.js)) |
| `/api/admin/trigger-expiry-check` | POST | Admin | Periodic sweep — fire `auto_fire` triggers, deactivate or reset cycles. **No real cron yet.** ([`../../pages/api/admin/trigger-expiry-check.js`](../../pages/api/admin/trigger-expiry-check.js)) |
| `/api/admin/quests` | POST | Admin | CRUD on `quests`. |
| `/api/admin/specials` | POST | Admin | CRUD on `specials` + `special_rules`. |
| `/api/quest-catalog` | GET | none | Active quests for users. |
| `/api/my-quests` | GET | Bearer JWT | User's progress. |
| `/api/my-skills` | GET | Bearer JWT | User's effective skill grants. |

## Quest threshold gotcha (finding M-3)

`quest-trigger.js:138` hardcodes `threshold = 1`. Every quest auto-completes on first trigger event. To use `quests.requirements.threshold`, replace with `const threshold = quest.requirements?.threshold ?? 1`.

## Reward payout split (finding M-2)

`_grantQuestRewards()` adds FG/XP via inline `UPDATE users` (line 192-208). Bypasses `fg_ledger` and `awardXp.js` rank-up flow. Specials fire alongside via `emitTrigger() → process_trigger`. Two parallel paths, not transactional. Unify.

## Related

- [`../features/forum-troll-gem.md`](../features/forum-troll-gem.md)
- [`../catalogs/triggers.md`](../catalogs/triggers.md)
- [`../catalogs/quests.md`](../catalogs/quests.md)
- [`../catalogs/specials.md`](../catalogs/specials.md)
- [`../modular-system/overview.md`](../modular-system/overview.md)
