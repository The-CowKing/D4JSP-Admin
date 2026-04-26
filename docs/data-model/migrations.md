# Data Model: migrations

The DDL/data-change record. Sequentially numbered SQL files.

## Convention

- Path: [`../../migrations/`](../../migrations/) (D4JSP repo) plus [`../../../D4JSP-Build-Planner/migrations/`](../../../D4JSP-Build-Planner/migrations/) (build planner specific). Recommended: unify into single `db/migrations/` (finding CS-1).
- Naming: `NNN_description.sql`. Sequential, never reuse N.
- Apply: Adam runs in Supabase SQL editor: <https://supabase.com/dashboard/project/isjkdbmfxpxuuloqosib/sql/new>.
- Don't apply console-only changes that bypass the repo. The repo must be able to rebuild the DB.

## Tracked migrations (D4JSP)

| File | Purpose |
|---|---|
| `019_users_rls_column_guard.sql` | P0 privesc fix — WITH CHECK on sensitive `users` columns |
| `021_email_notifications.sql` | `notification_log` for email dedup |
| `022_admin_action_log.sql` | Per-user audit trail table |
| `024_user_admin_columns.sql` | `admin_notes`, `trading_locked`, `monitored` cols |
| `025_tooltip_training.sql` | OCR training Storage bucket + table |
| `026_bot_configs.sql` | `bot_configs` table |
| `030_waitlist.sql` | Pre-launch waitlist |
| `032_ui_presets.sql` | Per-user UI presets |
| `033_friendships.sql` | Social system |
| `034_replies_author_columns.sql` | Denormalize author cols on `replies` |
| `035_user_builds.sql` | Build Planner persistence |
| `036_d4_items_seed.sql` | D4 item catalog seed |
| `038_forum_trolls_realtime.sql` | `ALTER PUBLICATION supabase_realtime ADD TABLE forum_trolls` |

## Tracked migrations (Build Planner)

| File | Purpose |
|---|---|
| `001_d4_cosmetic_appearances.sql` | Cosmetic items |
| `002_build_planner_permissions.sql` | **Canonical example of the catalog protocol.** Adds `d4_build_slots`, `d4_build_notify_trade`, `d4_map_access` to `admin_permissions` with tier-mapped JSON values. |

## Missing from repo (applied dashboard-only)

015, 016, 017, 018, 020, 023, 027, 028, 029, 031, 037. Includes:
- Original RLS pass on most tables
- `process_trigger` PL/pgSQL function (load-bearing)
- `forum_trolls` table creation (only the publication add is in 038)
- `system_config` + `system_config_log` table creation
- `admin_permissions` table creation
- `quest-system-wiring` (quests, triggers, specials, special_rules, special_claims tables)

**Fix (finding H-9, H-10):** `pg_dump --schema-only` from production into `migrations/000_baseline.sql` and commit. Then the repo can rebuild the DB end-to-end.

## Related

- [`./rls.md`](./rls.md)
- [`../infra/supabase.md`](../infra/supabase.md)
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) findings H-9, H-10, CS-1
