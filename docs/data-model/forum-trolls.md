# Data Model: forum_trolls

Live forum-troll spawn rows. Drives the gem-pressed UI state.

## Schema

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `spawned_by` | uuid FK → users | who clicked the gem |
| `quest_id` | uuid FK → quests | which quest spawned it |
| `hp` | int | current HP |
| `max_hp` | int | initial HP from `quest.config.clicks_to_kill` |
| `despawn_at` | timestamptz | from `quest.config.despawn_minutes` |
| `thread_id` | uuid FK → threads | the chosen attached thread |
| `created_at` | timestamptz | |

## Realtime

In `supabase_realtime` publication (added by [`../../migrations/038_forum_trolls_realtime.sql`](../../migrations/038_forum_trolls_realtime.sql)). [`../../components/AppShell.js:671-682`](../../components/AppShell.js) subscribes; INSERT/UPDATE/DELETE all trigger a refetch.

## Lifecycle

INSERT (spawn) → UPDATE (HP decrement on hits via `POST /api/forum-trolls { action: 'hit' }`) → DELETE (HP=0 or despawn_at passed).

When HP=0, `forum_troll_slain` trigger fires → specials grants (e.g. "First Blood" badge).

## Related

- [`../features/forum-troll-gem.md`](../features/forum-troll-gem.md)
- [`../features/realtime.md`](../features/realtime.md)
- [`../endpoints/quests-triggers.md`](../endpoints/quests-triggers.md)
