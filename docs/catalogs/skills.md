# Catalog: skills + user_skills

Grantable abilities ("FG Bonus", "XP Boost", "Extra Posts/day", "Raffle Tickets/mo", "Free Name Change"). Granted via subscription tier, rank, or admin manual. Per-user state in `user_skills`.

## skills schema

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `type` | text | `fg_gift`, `gems`, `gift`, `fg_bonus`, `xp_boost`, `extra_posts`, `raffle_ticket`, `name_change`, ... |
| `description` | text | |
| `icon_url` | text | |
| `config` | jsonb | per-skill params |
| `source` | text | `manual` or system |
| `active` | boolean | |

## user_skills schema

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid FK | |
| `skill_id` | uuid FK | |
| `source` | text | `subscription` / `rank` / `manual` |
| `source_detail` | text | tier id or rank id |
| `granted_at` | timestamptz | |
| `granted_by` | uuid nullable | admin who granted (manual) |
| `active` | boolean | |
| `expires_at` | timestamptz nullable | |
| `config` | jsonb | per-user overrides |

## How tier+rank assignments propagate

[`../../pages/api/admin/reconcile.js`](../../pages/api/admin/reconcile.js) reads `subscription_tiers.skills` for the user's tier, `rank_grants` for the user's rank, then upserts subscription/rank rows in `user_skills` and revokes any rows no longer in the current tier/rank. Manual grants (`source='manual'`) are never touched.

**Finding C-3:** `reconcile.js:40` has an inline `RANK_XP[]` array that diverges from [`../../lib/rankEngine.js`](../../lib/rankEngine.js) past rank 30. Until fixed, rank-tied skill grants are wrong for users past rank 29.

## Endpoints

- **Public:** `GET /api/skill-catalog`.
- **Per-user:** `GET /api/my-skills`.
- **Admin:** `POST /api/admin/skills`, `POST /api/admin/grants`, `POST /api/admin/reconcile`.

## Related

- [`./subscription-tiers.md`](./subscription-tiers.md)
- [`./ranks.md`](./ranks.md)
- [`./permissions.md`](./permissions.md)
- [`../endpoints/admin.md`](../endpoints/admin.md)
