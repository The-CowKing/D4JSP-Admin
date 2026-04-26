# Data Model: escrow

FG held by the platform between buyer accept and seller deliver.

## Schema

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `thread_id` | uuid FK → threads | |
| `buyer_id` | uuid FK → users | |
| `seller_id` | uuid FK → users | |
| `fg_amount` | int | held FG |
| `status` | text | `held` / `released` / `refunded` / `disputed` |
| `auto_complete_at` | timestamptz | default 24h after creation; auto-release if no dispute |
| `dispute_reason` | text | when status=disputed |
| `created_at` | timestamptz | |

## RLS

Buyer or seller can SELECT their own row. Writes via `adminDb` only.

## Status lifecycle

`held` → (buyer confirms or 24h auto-timer fires) → `released` (FG to seller). `held` → (either party flags) → `disputed` (admin reviews). `held` → (seller cancels in free-removal window) → `refunded` (FG back to buyer).

## Atomicity gap (finding H-3)

`pages/api/initiate-escrow.js` deducts buyer FG and inserts the escrow row in two separate operations. Wrap in a transaction or use the `transfer_fg` SECURITY DEFINER RPC pattern.

## Related

- [`../features/escrow.md`](../features/escrow.md)
- [`../endpoints/escrow.md`](../endpoints/escrow.md)
- [`./fg-ledger.md`](./fg-ledger.md)
