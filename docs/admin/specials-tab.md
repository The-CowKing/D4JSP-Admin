# Admin: Specials tab

CRUD on `specials` + `special_rules`. Reward grants attached to triggers.

## Endpoint
`POST /api/admin/specials`

## Workflow
1. Pick a trigger (`forum_troll_spawned`, `forum_troll_slain`, `battlenet_link`, etc.).
2. Add a special row: `{ name, icon, fg_grant, badge_id }`.
3. Add `special_rules` rows for conditions ("first time only", date range, tier-gated).
4. Toggle `enabled` to activate.

When the trigger fires, `process_trigger` reads matching specials, applies rules, awards FG/badges, writes `special_claims`.

## Related

- [`../catalogs/specials.md`](../catalogs/specials.md)
- [`../catalogs/triggers.md`](../catalogs/triggers.md)
- [`../endpoints/admin.md`](../endpoints/admin.md)
