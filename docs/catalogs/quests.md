# Catalog: quests

Objectives bound to triggers. When a trigger fires, all matching active quests advance their `quest_progress` row for the user. On completion, awards `fg_reward` + `xp_reward`.

## Schema

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | display label |
| `type` | text | `one_time` / `daily` / `weekly` |
| `trigger_id` | text FK → `triggers.id` | which event advances this quest |
| `xp_reward` | int | XP on completion |
| `fg_reward` | int | FG on completion |
| `requirements` | jsonb | `{ threshold: N }` — clicks/events to complete |
| `rewards` | jsonb | parallel reward map |
| `completion_text` | text | toast on completion |
| `active` | boolean | gate |
| `config` | jsonb | quest-owned params |

### config jsonb (quest-owned params)
- `clicks_to_kill` — for `forum_troll_spawned`: troll HP
- `despawn_minutes` — for trolls
- `spawn_location` — `any` / `ladder` / `eternal` / `d4` / `d2r` / `d3`
- `spawn_limit` — only consider the N most recent threads in the chosen category

## quest_progress (per-user state)

| Column | Type |
|---|---|
| `user_id` | uuid FK |
| `quest_id` | uuid FK |
| `progress` | int |
| `completed` | bool |
| `completed_at` | timestamptz |
| `reset_at` | timestamptz |

## Endpoints

- **Public read:** `GET /api/quest-catalog`.
- **Per-user read:** `GET /api/my-quests`.
- **Admin write:** `POST /api/admin/quests`.
- **Trigger ingest:** `POST /api/quest-trigger { trigger_id }` — advances all quests for the trigger; on completion calls `_grantQuestRewards()` (inline, bypasses `fg_ledger` — finding M-2). Threshold currently hardcoded to 1 at [`../../pages/api/quest-trigger.js:138`](../../pages/api/quest-trigger.js) — finding M-3.

## Related

- [`./triggers.md`](./triggers.md)
- [`./specials.md`](./specials.md)
- [`../features/forum-troll-gem.md`](../features/forum-troll-gem.md)
- [`../endpoints/quests-triggers.md`](../endpoints/quests-triggers.md)
- [`../admin/quests-tab.md`](../admin/quests-tab.md)
