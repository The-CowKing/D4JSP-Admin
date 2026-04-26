# Admin: Permissions tab

CRUD on `admin_permissions` catalog. Permission ids + per-tier defaults.

## Endpoint
`POST /api/admin/permissions`

## Workflow
1. Add a permission id (`d4_build_slots`, `d4_map_access`, etc.).
2. Set group, label, color, has_value flag.
3. Set tier-mapped defaults: `{"free":"1","verified":"1","basic":"2","premium":"3","legendary":"5"}`.
4. Reference from `subscription_tiers.permissions` JSON map.

## Reference implementation
[`../../../D4JSP-Build-Planner/migrations/002_build_planner_permissions.sql`](../../../D4JSP-Build-Planner/migrations/002_build_planner_permissions.sql) — copy this pattern when adding new permissions.

## Related

- [`../catalogs/permissions.md`](../catalogs/permissions.md)
- [`../catalogs/subscription-tiers.md`](../catalogs/subscription-tiers.md)
