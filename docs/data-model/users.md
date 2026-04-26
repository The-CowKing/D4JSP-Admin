# Data Model: users

The user record. Lives in `public.users`, NOT `auth.users` metadata. Every user-facing flow reads from here.

## Schema (key columns)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | matches `auth.users.id` |
| `email` | text | nullable for bot-fake users |
| `display_name` | text | |
| `photo_url` | text | from `avatars` Storage bucket |
| `fg_balance` | int | FG currency |
| `xp` | int | accumulated XP |
| `rank_level` | int | derived from xp; cached for fast reads |
| `rank_name` | text | derived from `rankEngine.RANKS` |
| `role` | text | `user` / `admin` / `system` |
| `membership` | text | `free` / `verified` / `basic` / `premium` / `legendary` |
| `membership_expiry` | timestamptz | |
| `badges` | jsonb (text[]) | active badges |
| `banned` | bool | |
| `ip_address` | text | for ban-by-IP collateral logic (finding H-5) |
| `battlenet_account_id` | text | from Battle.net OAuth |
| `battletag` | text | |
| `stripe_customer_id` | text | for subscription.deleted webhook |
| `character_names` | jsonb | per-game character list |
| `active_character` | text | |
| `notification_prefs` | jsonb | |
| `push_subscription` | jsonb | web-push endpoint |
| `user_active_grants` | jsonb | summary written by `reconcile.js` (computed_at, tier, rank_id, skill_ids[]) |
| `admin_notes` | text | admin-only annotations |
| `trading_locked` | bool | admin-imposed trade pause |
| `monitored` | bool | admin watch flag |
| `approved` | bool | admin-pre-approved (admins) or waitlist gate (users) |
| `deleted_at` | timestamptz | soft-delete sentinel |
| `deletion_reason`, `deleted_by` | text/uuid | |
| `created_at`, `updated_at` | timestamptz | |

## RLS

`migrations/019_users_rls_column_guard.sql` adds `WITH CHECK` on UPDATE blocking changes to: `role`, `fg_balance`, `membership`, `membership_expiry`, `banned`, `badges`. Sensitive columns are immutable via the anon client. Server-side only via `adminDb`.

INSERT policy was removed. New rows only via `/api/auth/setup-user` (server-side).

## Authoritative writers

- `pages/api/auth/setup-user.js` — INSERT.
- `pages/api/auth/promote-admin.js` — `role`.
- `pages/api/auth/expire-membership.js` — `membership`, `membership_expiry`.
- `pages/api/admin/user-detail.js` — every admin mutation (correct path, audit-logged).
- `pages/api/admin/action.js` — legacy duplicate (no audit, finding H-4).
- `pages/api/admin/reconcile.js` — `user_active_grants` summary.
- `pages/api/webhook.js` — Stripe → membership upgrade/downgrade.
- `lib/awardXp.js` — XP + rank-up.
- Client-side anon writes (safe per WITH CHECK): `display_name`, `photo_url`, `notification_prefs`, `character_names`, `active_character`, `battlenet_account_id`, `battletag`, `updated_at`.

## Related

- [`./rls.md`](./rls.md)
- [`../auth/overview.md`](../auth/overview.md)
- [`../endpoints/auth.md`](../endpoints/auth.md)
- [`../catalogs/ranks.md`](../catalogs/ranks.md)
