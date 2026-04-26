# Catalog: ranks + rank_grants

50-rank XP-thresholded ladder. Scavenger → Godslayer. Each rank carries an FG reward and may attach skills via `rank_grants`.

## Source of truth

[`../../lib/rankEngine.js:1-52`](../../lib/rankEngine.js) defines the canonical 50-row table:
- `id` (1–50)
- `name` (Scavenger, Wanderer, Initiate, ..., Godslayer)
- `xp` (XP threshold to qualify)
- `fgReward` (FG awarded on rank-up)
- `special` (`'glowing_avatar'` only on rank 50)

`XP_REWARDS` map at lines 55-62: `{ signup: 50, post: 10, sale: 100, referral: 200, daily_quest: 35, weekly_quest: 150 }`.

## ranks DB table

May exist for admin-editable metadata; not load-bearing today (rank logic uses the JS file). Schema discoverable via `information_schema.columns WHERE table_name='ranks'`.

## rank_grants schema

| Column | Type |
|---|---|
| `rank_id` | int FK → `ranks.id` |
| `skill_id` | uuid FK → `skills.id` |
| `config` | jsonb |
| PRIMARY KEY (`rank_id`, `skill_id`) |

Read by [`../../pages/api/admin/reconcile.js`](../../pages/api/admin/reconcile.js) at line 78-85 to derive rank-tied user_skills.

## Finding C-3 (CRITICAL)

`pages/api/admin/reconcile.js:40` has an inline `RANK_XP[]` of 40 entries that diverges from `lib/rankEngine.js` past rank 30 (286,700 vs 286,600). Fix: `import { RANKS } from '../../../lib/rankEngine'; const RANK_XP = RANKS.map(r => r.xp);`. Until fixed, users past rank 29 receive wrong rank-tied skill grants.

## Endpoints

- **Admin:** `POST /api/admin/ranks` — edit ranks/rank_grants.
- **XP awards:** [`../../lib/awardXp.js`](../../lib/awardXp.js) `awardXp(userId, action)` — adds XP, checks rank-up via `calculateRank`, fires grant email.

## Related

- [`./skills.md`](./skills.md)
- [`./xp-rules.md`](./xp-rules.md)
- [`../endpoints/admin.md`](../endpoints/admin.md)
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) finding C-3
