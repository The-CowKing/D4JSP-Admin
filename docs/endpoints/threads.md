# Endpoints: threads + replies + builds

Trade listings (`threads`), per-thread replies, and saved builds.

## Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/threads` | GET | none | List listings. Query: `game`, `realm`, `sort` (`time-asc`, `price-desc`, `price-asc`, default `time-desc`), `type`, `limit` (no clamp — finding L2). ([`../../pages/api/threads.js`](../../pages/api/threads.js)) |
| `/api/thread?id=` | GET | none | Single thread. Bypasses RLS via `adminDb`. ([`../../pages/api/thread.js`](../../pages/api/thread.js)) |
| `/api/create-thread` | POST | Bearer JWT | Create listing. ([`../../pages/api/create-thread.js`](../../pages/api/create-thread.js)) |
| `/api/create-reply` | POST | Bearer JWT | Reply to a thread. |
| `/api/cancel-listing` | POST | Bearer JWT (author or admin) | Soft-cancel before escrow lock. |
| `/api/save-build` | POST | Bearer JWT | Build Planner write. RLS by `user_builds` policy. |
| `/api/glow` | POST | Bearer JWT (premium+) | Add glow effect to own listing. |
| `/api/check-trade-limit` | GET | Bearer JWT | Per-tier post limit check. |

## Schema notes

`threads` columns: `id, title, price, category, mode, image_url, item_data (jsonb), author_*, created_at, is_glowing, glow_tier, views, replies, action_type, status, locked_until, free_removal_at, accepted_price, buyer_id, escrow_enabled`.

## Limit clamp gap

`/api/threads:23` `limit` is `parseInt(lim) || 20` with no upper bound. Adding `Math.min(parseInt(lim) || 20, 100)` would close finding L2.

## Related

- [`../features/escrow.md`](../features/escrow.md)
- [`../data-model/threads.md`](../data-model/threads.md)
- [`./escrow.md`](./escrow.md)
- [`./widgets.md`](./widgets.md) — public widget reads same table
