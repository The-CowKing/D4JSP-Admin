# Data Model: threads

Trade listings. The marketplace's primary entity.

## Schema (key columns)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `title` | text | |
| `content` | text | description |
| `price` | int | FG asking price |
| `category` | text | game id, e.g. `Diablo 4` / `Diablo 2 Resurrected` |
| `mode` | text | realm, e.g. `Eternal Softcore` / `Ladder Softcore` |
| `image_url` | text | trade thread image (`assets` bucket) |
| `item_data` | jsonb | full item info: `name, type, rarity, stats[], affixes[], uniquePower, flavorText, tooltipHtml, userStats` |
| `author_id` | uuid FK → users | seller; nullable for bot threads |
| `author_name`, `author_photo_url`, `author_fg`, `author_badges`, `author_role` | denormalized | snapshot for display |
| `action_type` | text | `Sell` / `Buy` / `Trade` |
| `tags` | text[] | |
| `status` | text | `active` / `locked` (escrow-held) / `sold` / `cancelled` / `archived` / `disputed` |
| `is_glowing` | bool | premium glow effect |
| `glow_tier` | text | |
| `views`, `replies` | int | counters |
| `escrow_enabled` | bool | |
| `buyer_id` | uuid FK → users | set during escrow lock |
| `accepted_price` | int | locked-in price |
| `locked_until` | timestamptz | escrow lock window |
| `free_removal_at` | timestamptz | seller cancellation grace |
| `seller_id` | uuid alias of author_id (in some queries) | |
| `archived_reason` | text | |
| `created_at` | timestamptz | |

## RLS

UPDATE policy lacks `WITH CHECK` on `author_id` (finding W-04). Authors can theoretically transfer ownership of their listing. No active exploit today since no UI does that.

## Realtime

Not in `supabase_realtime` publication. Adding it would let trade cards live-update prices/views.

## Related

- [`./escrow.md`](./escrow.md)
- [`./forum-trolls.md`](./forum-trolls.md) — trolls attach to threads
- [`../features/escrow.md`](../features/escrow.md)
- [`../endpoints/threads.md`](../endpoints/threads.md)
