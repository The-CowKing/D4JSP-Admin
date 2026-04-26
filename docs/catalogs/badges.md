# Catalog: badges + user_badges

Visual badges shown on user profiles and trade cards. Granted via specials, admin manual, or signup.

## badges schema

| Column | Type |
|---|---|
| `id` | uuid PK |
| `name` | text |
| `description` | text |
| `icon_url` | text |
| `color` | text |
| `category` | text |

## user_badges schema

| Column | Type |
|---|---|
| `user_id` | uuid FK |
| `badge_id` | uuid FK |
| `source` | text — `admin_manual`, `special`, `signup` |
| `source_ref` | text |
| `earned_at` | timestamptz |

## Endpoints

- **Admin:** `POST /api/admin/badges` — CRUD. `POST /api/admin/user-detail { action: 'grantBadge', badgeId }` — grant to user.

## Related

- [`./specials.md`](./specials.md) — specials can grant badges
- [`../admin/users-tab.md`](../admin/users-tab.md)
