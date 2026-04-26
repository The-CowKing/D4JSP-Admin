# Catalog: specials + special_rules + special_claims

Reward grants attached to triggers. When `emitTrigger` fires, `process_trigger` (PL/pgSQL) reads `specials WHERE trigger_id=... AND enabled=true`, applies `special_rules`, awards FG/badges/XP, writes `special_claims`.

## specials schema

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `icon` | text | emoji or path |
| `trigger_id` | text FK → `triggers.id` | |
| `fg_grant` | int | |
| `badge_id` | uuid nullable FK → `badges.id` | |
| `enabled` | boolean | |
| `deleted_at` | timestamptz nullable | soft-delete |

## special_rules

Per-special conditions. "First time only", "max N per user", "active during date range." Schema in Supabase; query `information_schema.columns WHERE table_name='special_rules'` for ground truth.

## special_claims

Append-only ledger. One row per fire. Read by [`../../pages/api/admin/user-detail.js`](../../pages/api/admin/user-detail.js) for the user's Activity tab.

## Endpoints

- **Admin write:** `POST /api/admin/specials` — CRUD on specials and special_rules.
- **Trigger fire:** `emitTrigger(id, userId)` in [`../../lib/triggerEngine.js`](../../lib/triggerEngine.js) → `process_trigger` SQL.

## Email side effect

After `emitTrigger` returns granted specials, `_sendSpecialEmails()` fires grant emails async via [`../../lib/sendGrantEmail.js`](../../lib/sendGrantEmail.js) for any special with `fg_granted > 0`. Dedup refId is `<userId>:<special_id>`.

## Related

- [`./triggers.md`](./triggers.md)
- [`./quests.md`](./quests.md)
- [`./badges.md`](./badges.md)
- [`../modular-system/overview.md`](../modular-system/overview.md)
- [`../admin/specials-tab.md`](../admin/specials-tab.md)
