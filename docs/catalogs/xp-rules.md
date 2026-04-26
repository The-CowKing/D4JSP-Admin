# Catalog: xp_rules

Action → XP point map. Used by `lib/awardXp.js` to grant XP on signup, post, sale, referral, quest completion.

## Schema

| Column | Type |
|---|---|
| `id` | uuid PK |
| `action` | text — `signup`, `post`, `sale`, `referral`, `daily_quest`, `weekly_quest` |
| `xp` | int |
| `enabled` | boolean |

## Hardcoded fallback

[`../../lib/rankEngine.js:55-62`](../../lib/rankEngine.js) `XP_REWARDS` map provides the in-code defaults. The DB catalog should override; the inline values are the rollback target.

## Endpoints

- **Admin:** `POST /api/admin/xp-rules`.
- **Award fire:** `POST /api/award-xp { action, userId }` — see [`../../pages/api/award-xp.js`](../../pages/api/award-xp.js) and [`../../lib/awardXp.js`](../../lib/awardXp.js).

## Rank-up side effect

`awardXp` calls `calculateRank({ xp })` from `rankEngine.js`. If the user's rank advanced, applies `xpUpdate.rank_level`, `rank_name`, and `fg_balance += newRank.fgReward`. Sends a `rank_up` grant email via Resend.

## Related

- [`./ranks.md`](./ranks.md)
- [`./skills.md`](./skills.md)
