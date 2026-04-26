# Endpoints: escrow

Buyer initiates → seller delivers → buyer confirms (or auto-completes) → FG transferred. Disputes hold for admin review.

## Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/initiate-escrow` | POST | Bearer JWT | Buyer hits Buy. Validates balance, deducts buyer FG, locks thread, creates `escrow` row. ([`../../pages/api/initiate-escrow.js`](../../pages/api/initiate-escrow.js)) |
| `/api/confirm-trade` | POST | Bearer JWT (buyer or auto-timer) | Release held FG to seller. Mark escrow `released`. |
| `/api/dispute-trade` | POST | Bearer JWT | Either party flags `disputed`. Admin reviews. |
| `/api/cancel-listing` | POST | Bearer JWT | Pre-escrow cancel. |

## Atomicity gap (finding H-3)

`initiate-escrow.js` deducts buyer FG with one UPDATE (no transaction wrap). The escrow insert may then fail. Implement `transfer_fg` SECURITY DEFINER RPC per [`../audits/2026-04-26.md`](../audits/2026-04-26.md) numbered-fg-vault design and call it via `adminDb.rpc('transfer_fg', ...)`.

## Hardcoded values (finding M-1)

`initiate-escrow.js:67-78` has lock=2h, free-removal=24h, auto-complete=24h hardcoded. Move to `system_config` keys `escrow.lock_hours` / `escrow.free_removal_hours` / `escrow.auto_complete_hours`.

## Related

- [`../features/escrow.md`](../features/escrow.md)
- [`../data-model/escrow.md`](../data-model/escrow.md)
- [`../data-model/fg-ledger.md`](../data-model/fg-ledger.md)
