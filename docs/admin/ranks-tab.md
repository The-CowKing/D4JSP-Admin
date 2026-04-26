# Admin: Ranks tab

Edit ranks + `rank_grants` (skills attached per rank).

## Endpoint
`POST /api/admin/ranks`

## Editing ranks
Rank XP thresholds + names + fgReward live in [`../../lib/rankEngine.js:1-52`](../../lib/rankEngine.js) — **hardcoded by design** (leaderboard integrity). The DB `ranks` table can hold metadata but the JS file is canonical for ladder logic.

## Editing rank_grants
`rank_grants(rank_id, skill_id, config)` — skills granted at each rank level. After edit, run `/api/admin/reconcile { action: 'reconcile_all' }`.

## Finding C-3
[`../../pages/api/admin/reconcile.js:40`](../../pages/api/admin/reconcile.js) has an inline `RANK_XP[]` that diverges from `rankEngine.js` past rank 30. Fix by importing `RANKS` from rankEngine. Until fixed, rank-tied skill grants are wrong for users past rank 29.

## Related

- [`../catalogs/ranks.md`](../catalogs/ranks.md)
- [`../catalogs/skills.md`](../catalogs/skills.md)
- [`../catalogs/xp-rules.md`](../catalogs/xp-rules.md)
