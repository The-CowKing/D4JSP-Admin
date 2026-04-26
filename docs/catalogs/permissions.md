# Catalog: permissions + admin_permissions

Capability gates: `d4_build_slots: 3`, `d4_map_access: 1`, etc. Tier-mapped JSON values in `subscription_tiers.permissions`. Catalog of available permissions in `admin_permissions`.

## admin_permissions schema (canonical)

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | e.g. `d4_build_slots` |
| `name` | text | |
| `description` | text | |
| `group_id` | text | grouping for admin UI |
| `group_label` | text | |
| `group_color` | text | |
| `has_value` | bool | true = numeric value, false = boolean |
| `value_label` | text | e.g. "slots" |
| `defaults` | jsonb | tier id → default value, e.g. `{"free":"1","premium":"3"}` |
| `sort_order` | int | |

## Tier mapping

`subscription_tiers.permissions` is a `{permission_id: value}` JSON map. Reconciliation copies into `user_active_grants` on the user record.

## Endpoints

- **Read:** `/api/admin/permissions` (admin only).
- **Write:** `POST /api/admin/permissions`.
- **Read public:** present on user via `users.user_active_grants` (computed by `reconcile.js`).

## Reference implementation

[`../../../D4JSP-Build-Planner/migrations/002_build_planner_permissions.sql`](../../../D4JSP-Build-Planner/migrations/002_build_planner_permissions.sql) is the canonical pattern: catalog row → tier-mapped JSON → endpoint reads via `admin_permissions`. **Copy this when adding a new permission.**

## Related

- [`./subscription-tiers.md`](./subscription-tiers.md)
- [`./skills.md`](./skills.md)
- [`../admin/permissions-tab.md`](../admin/permissions-tab.md)
