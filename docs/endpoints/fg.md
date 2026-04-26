# Endpoints: FG transactions

Direct FG movement outside Stripe and escrow.

## Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/transfer-fg` | POST | Bearer JWT | User-to-user FG transfer. **Non-atomic** (finding H-3) — debit + credit are two separate UPDATEs. Replace with `transfer_fg` RPC. Cap: 1,000,000 hardcoded (finding M-1, target `currency.transfer_max`). ([`../../pages/api/transfer-fg.js`](../../pages/api/transfer-fg.js)) |
| `/api/grant-fg` | POST | Admin Bearer JWT | Admin grant. **Duplicate of `/api/admin/user-detail { action: 'grantFg' }`** (finding H-7). Doesn't write to `fg_ledger`. Migrate AdminView callers to `user-detail.js`. ([`../../pages/api/grant-fg.js`](../../pages/api/grant-fg.js)) |
| `/api/get-vault-stats` | GET | none | Returns `fg_vault` summary (in_circulation, total_burned). |

## Canonical pattern

For new FG movements, write through `adminDb.rpc('transfer_fg', {...})` and append a `fg_ledger` row. Don't UPDATE `users.fg_balance` directly without a ledger entry — invisible to admin Activity tab and forensics.

## Related

- [`../data-model/fg-ledger.md`](../data-model/fg-ledger.md)
- [`../data-model/transactions.md`](../data-model/transactions.md)
- [`./stripe.md`](./stripe.md)
- [`./escrow.md`](./escrow.md)
