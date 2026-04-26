# Data Model: fg_ledger

The canonical FG transaction history. Append-only.

## Schema

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `from_uid` | uuid nullable | NULL = vault (issuance) |
| `to_uid` | uuid nullable | NULL = vault (burn) |
| `amount` | int | always positive |
| `reason` | text | `purchase` / `transfer` / `grant` / `escrow_hold` / `escrow_release` / `escrow_refund` / `burn` / `signup_grant` / `account_deleted_return_to_vault` / etc. |
| `ref_id` | text | escrow.id, special_claims.id, stripe payment_id, etc. |
| `admin_id` | uuid nullable | when reason involves admin action |
| `created_at` | timestamptz | |

## Indexes

- `idx_fg_ledger_from` on `from_uid WHERE from_uid IS NOT NULL`
- `idx_fg_ledger_to` on `to_uid WHERE to_uid IS NOT NULL`

## RLS

User can SELECT rows where they are `from_uid` or `to_uid`. No client INSERT.

## Authoritative writers

- `pages/api/admin/user-detail.js` (`grantFg` action) — admin grants
- `lib/deleteUser.js` — `account_deleted_return_to_vault`
- *(planned)* `transfer_fg` SECURITY DEFINER RPC — to replace current non-atomic `transfer-fg.js`

## Currently bypassing fg_ledger (need fix)

- `pages/api/transfer-fg.js` writes `fg_transfers` (legacy) instead.
- `pages/api/quest-trigger.js` `_grantQuestRewards()` updates `users.fg_balance` inline (finding M-2).
- `pages/api/grant-fg.js` legacy admin grant (finding H-7).
- `pages/api/admin/action.js` `setGold` (finding H-6).

All should funnel into `fg_ledger`.

## Vault invariant

`fg_vault.in_circulation + sum(escrow.fg_amount where status=held) = sum(users.fg_balance)`. Periodic reconciliation job to verify is not yet built (see [`../infra/scheduled-jobs.md`](../infra/scheduled-jobs.md)).

## Related

- [`./transactions.md`](./transactions.md) — Stripe-purchase ledger
- [`./escrow.md`](./escrow.md)
- [`../endpoints/fg.md`](../endpoints/fg.md)
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) finding M-4 (two ledgers)
