# Feature: Escrow

Buyer hits "Buy Now" on a thread → platform deducts FG from buyer + locks the thread + creates an `escrow` row with status `held`. Seller delivers in-game item, buyer confirms → FG released to seller. Auto-completes after 24h if no dispute. Dispute holds for admin review.

## UI

- **Buyer side:** Buy Now button on each trade card in [`../../components/HomeView.js`](../../components/HomeView.js) and on the thread detail in [`../../components/ThreadDetailView.js`](../../components/ThreadDetailView.js).
- **Seller side:** Confirm/Cancel buttons on the locked thread.
- **Dispute side:** Both buyer and seller can flag dispute.

## Endpoints

- `POST /api/initiate-escrow` ([`../../pages/api/initiate-escrow.js`](../../pages/api/initiate-escrow.js)) — buyer initiates. Validates balance, deducts buyer's FG, locks thread, creates escrow row, fires notifications.
- `POST /api/confirm-trade` — seller (or auto-timer) releases held FG to seller.
- `POST /api/dispute-trade` — either party flags status `disputed`.
- `POST /api/cancel-listing` — pre-escrow cancel.

## Schema

`escrow` table:

| Column | Type |
|---|---|
| `id` | uuid PK |
| `thread_id` | uuid FK → `threads.id` |
| `buyer_id` | uuid FK → `users.id` |
| `seller_id` | uuid FK → `users.id` |
| `fg_amount` | int |
| `status` | text — `held` / `released` / `refunded` / `disputed` |
| `auto_complete_at` | timestamptz |
| `dispute_reason` | text |
| `created_at` | timestamptz |

`threads` adds: `status` (`active` / `locked`), `buyer_id`, `accepted_price`, `locked_until`, `free_removal_at`.

## Hardcoded values (finding M-1)

- Lock period: 2h ([`../../pages/api/initiate-escrow.js:67`](../../pages/api/initiate-escrow.js))
- Auto-complete: 24h (line 78)
- Free removal window: 24h (line 68)

Should move to `system_config`: `escrow.lock_hours`, `escrow.auto_complete_hours`, `escrow.free_removal_hours`.

## Atomicity gap (finding H-3)

`initiate-escrow.js` deducts buyer FG with one UPDATE then inserts the escrow row. Not in a transaction. If the insert fails, FG is debited without an escrow record. Need: wrap in `transfer_fg` RPC pattern from [`../audits/2026-04-26.md`](../audits/2026-04-26.md) §3 numbered-fg-vault design.

## RLS

`escrow` table has RLS: buyer or seller can SELECT their own rows. All writes go through `adminDb` (service role).

## Related

- [`./forum-troll-gem.md`](./forum-troll-gem.md) — sibling Latest Trades feature
- [`../endpoints/escrow.md`](../endpoints/escrow.md)
- [`../data-model/escrow.md`](../data-model/escrow.md)
- [`../data-model/fg-ledger.md`](../data-model/fg-ledger.md)
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) findings H-3, M-1
