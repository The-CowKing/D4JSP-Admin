# Catalog: triggers

Event registry. Every event the system reacts to (gem click, signup, troll spawn) is a row here. Catalogs `quests` and `specials` reference `triggers.id` to attach behavior.

## Schema

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | name, e.g. `forum_troll_spawned` |
| `name` | text | display label |
| `description` | text | |
| `enabled` | boolean | gate; disabled triggers no-op |
| `config` | jsonb | see below |
| `created_at` | timestamptz | |

### config jsonb fields
- `expires_after` (int days) — disable or auto-fire after this many days from `cycle_start`
- `cycle_start` (iso datetime) — used by recurring triggers; reset on every fire
- `recurring` (bool) — if true, `cycle_start` resets after expiry; if false, trigger gets `enabled=false`
- `on_expiry` — `auto_fire` (re-fire and reset) or `deactivate` (default)
- `allowed_subscriptions` (string[]) — tier ids allowed to trigger; empty array = all
- `max_per_week` (int) — **forum_troll_spawned only** (today). Caps GLOBAL spawns across all users in the trailing 7 days. Server enforces in [`../../pages/api/quest-trigger.js`](../../pages/api/quest-trigger.js); on cap returns 429 with `blocked: 'weekly_limit'`. Unset = unlimited. Added in #46 / `642c6ab`.
- Per-trigger params (e.g. `min`/`max` click target on `forum_troll_spawned`)

## Known trigger ids in code

Grep'd from `pages/`, `lib/`, `components/`:
- `forum_troll_spawned` — gem click chain hits target → spawn troll
- `forum_troll_slain` — troll HP hits 0
- `battlenet_link` — user links Battle.net OAuth

The list is dynamic. To enumerate the live set: `SELECT id, name, enabled FROM triggers ORDER BY id`.

## Endpoints

- **Admin debug:** `POST /api/admin/triggers/emit` — fire any trigger as any user. Audit-logged. See [`../endpoints/admin.md`](../endpoints/admin.md).
- **Admin write:** `POST /api/admin/trigger-config` — edit `enabled` + `config` for a trigger.
- **Periodic:** `POST /api/admin/trigger-expiry-check` — scans for expired triggers, fires `auto_fire` or deactivates. No real cron yet — invoked manually or via external scheduler.
- **Frontend ingest:** `POST /api/quest-trigger` — fires a trigger for the authenticated user. See [`../endpoints/quests-triggers.md`](../endpoints/quests-triggers.md).

## Dispatch flow

`emitTrigger(id, userId)` in [`../../lib/triggerEngine.js`](../../lib/triggerEngine.js) calls `adminDb.rpc('process_trigger', {p_trigger_id, p_user_id})`. Returns `[{special_id, fg_granted}]`. The PL/pgSQL function reads `specials WHERE trigger_id=...`, applies `special_rules`, awards FG/badges/XP, writes `special_claims`. **`process_trigger` source SQL is not in repo** — finding H-10 in [`../audits/2026-04-26.md`](../audits/2026-04-26.md).

## Related

- [`./quests.md`](./quests.md)
- [`./specials.md`](./specials.md)
- [`../features/forum-troll-gem.md`](../features/forum-troll-gem.md)
- [`../modular-system/overview.md`](../modular-system/overview.md)
