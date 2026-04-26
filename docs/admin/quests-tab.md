# Admin: Quests tab

CRUD on `quests` catalog and `triggers.config`. Drives every quest in the system.

## Endpoints
- `POST /api/admin/quests` — `quests` CRUD
- `POST /api/admin/trigger-config` — `triggers.config` jsonb edit
- `POST /api/admin/triggers/emit` — debug fire any trigger as any user
- `POST /api/admin/trigger-expiry-check` — periodic sweep (manual today)

## Editing forum_troll_spawned

To change troll behavior:
- HP / despawn: edit `quests.config` (`clicks_to_kill`, `despawn_minutes`, `spawn_location`, `spawn_limit`).
- Click chain target: edit `triggers.config.min` / `max`.
- Tier gate: edit `triggers.config.allowed_subscriptions`.
- Lifecycle: edit `triggers.config` (`expires_after`, `recurring`, `on_expiry`).
- **Weekly spawn limit (global): edit `triggers.config.max_per_week`** to an integer. Counts spawns across all users in the trailing 7 days. Hitting the cap returns HTTP 429 to the user with a clear message. Unset/null = no limit. Added in #46.
- **Concurrent-alive limit (global): edit `triggers.config.max_alive_concurrent`** to an integer. Counts trolls currently alive (`killed_at IS NULL AND despawn_at > NOW()`). Hitting the cap returns HTTP 429 with `blocked: 'concurrent_limit'`. **Defaults to `1` if unset/null** (NOT unlimited — UX assumes one-at-a-time banner/gem visuals). Bump only if multi-troll UI ships. Added in #51.

## Related

- [`../catalogs/triggers.md`](../catalogs/triggers.md)
- [`../catalogs/quests.md`](../catalogs/quests.md)
- [`../features/forum-troll-gem.md`](../features/forum-troll-gem.md)
- [`../endpoints/admin.md`](../endpoints/admin.md)
