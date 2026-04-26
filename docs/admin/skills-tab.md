# Admin: Skills tab

CRUD on `skills` catalog. Skills are grantable abilities attached to subscription tiers, ranks, or admin-manual grants.

## Endpoint
`POST /api/admin/skills`

## Granting skills to users
- Via subscription tier: edit `subscription_tiers.skills` (uuid[]). Run `/api/admin/reconcile { action: 'reconcile_all' }` to propagate.
- Via rank: edit `rank_grants` rows. Same reconcile.
- Manual: `POST /api/admin/grants { user_id, skill_id, source_detail, expires_at? }`.

## Related

- [`../catalogs/skills.md`](../catalogs/skills.md)
- [`../catalogs/subscription-tiers.md`](../catalogs/subscription-tiers.md)
- [`../catalogs/ranks.md`](../catalogs/ranks.md)
