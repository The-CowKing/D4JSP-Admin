# Data Model: RLS posture

Row-level-security state per table. Lives in Supabase; repo only has `019_users_rls_column_guard.sql` as the tracked policy.

## Verified (in tracked migrations)

| Table | Policy | Notes |
|---|---|---|
| `users` | UPDATE policy with `WITH CHECK` blocking changes to `role`, `fg_balance`, `membership`, `membership_expiry`, `banned`, `badges` | migration 019. INSERT policy removed (server-side `setup-user.js` only). |

## Verified-by-runtime-behavior (in dashboard, not yet in repo)

| Table | Behavior |
|---|---|
| `escrow` | Buyer or seller can SELECT own row |
| `fg_ledger` | User can SELECT rows where they are `from_uid` or `to_uid`. No client INSERT. |
| `notifications` | User reads own only |
| `admin_action_log` | RLS ON, no SELECT policy → service-role-only |
| `system_config` | Public SELECT (used by widget endpoint) |
| `system_config_log` | Admin-only SELECT |

## Permissive (intentional — DON'T touch without re-testing OCR pipeline)

| Table | State |
|---|---|
| `d4_items` | INSERT/UPDATE permissive WITH CHECK (true) — used by OCR sell pipeline (findings W-10/11/12) |
| `d4_tooltips` | same |
| `d4_search_index` | same |

Tightening these without verifying every OCR write path will break sell flow.

## Unverified (TODO: dump + commit)

`threads` (UPDATE missing WITH CHECK on `author_id` — finding W-04), `replies`, `friendships`, `forum_trolls`, `quests`, `triggers`, `specials`, `special_rules`, `special_claims`, `subscription_tiers`, `fg_packages`, `permissions`, `admin_permissions`, `ranks`, `rank_grants`, `xp_rules`, `transactions`, `event_entries`, `gamble_events`, `bot_configs`, `bot_activity_log`, `site_config`, `wowhead_tooltips`, `d4_equipment`, `d4_affixes`.

## Storage

| Bucket | Public? | RLS |
|---|---|---|
| `avatars` | yes | `<uid>.jpg` upload constrained to authenticated user |
| `assets` | yes | `item-images/<threadId>.<ext>` — needs ownership check (finding W-06) |
| `tooltip-snapshots` | yes | client DELETE in [`HomeView.js:784`](../../components/HomeView.js); needs admin-only DELETE policy (W-05) |
| `tooltip-training` | private | service-role only |

## Action

`pg_dump --schema-only` from production → commit as `migrations/000_baseline.sql`. Then audit each table's RLS against these notes and tighten where unverified.

## Related

- [`./users.md`](./users.md)
- [`./migrations.md`](./migrations.md)
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) — findings H-9, W-04..W-12, M-11
