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
- `pages/api/admin/gamble.js` — `gamble_event_win` (raffle / event payouts)
- `pages/api/quest-trigger.js` `_grantQuestRewards()` — `quest_complete` (added #61)
- `pages/api/forum-trolls.js` `_grantKillQuestRewards()` — `quest_complete` for kill (added #61)
- *(planned)* `transfer_fg` SECURITY DEFINER RPC — to replace current non-atomic `transfer-fg.js`

## Grant pattern (#61 contract — DO NOT BREAK)

Every FG grant from internal sources (quest, special, gamble, admin grant) MUST:

1. **Insert `fg_ledger` row FIRST.** `from_uid: null` (vault issuance), `to_uid: <user>`, `amount` positive, `reason` = a stable string keyed to the source (`quest_complete`, `special_claim`, `gamble_event_win`, `admin_grant`, etc.), `ref_id` = the source row id (quest.id, special_claims.id, gamble_event.id, etc.).
2. **THEN** call `increment_user_fg(user_id, amount)` SECURITY DEFINER RPC for the atomic balance + vault accounting update.
3. **Throw on any failure** so the caller's progress / state mutation does NOT proceed and a retry can pick up cleanly. Ledger-first means a balance update without an audit row is structurally impossible.

Idempotency for quest grants is held UPSTREAM by the `quest_progress.completed` gate — only the false→true transition for a `(user, quest)` row reaches the grant code. Daily quests reset the gate per-day; one_time quests hold permanently. See [`../../pages/api/quest-trigger.js`](../../pages/api/quest-trigger.js) `_grantQuestRewards`.

## Currently bypassing fg_ledger (need fix)

- `pages/api/transfer-fg.js` writes `fg_transfers` (legacy) instead.
- `pages/api/grant-fg.js` legacy admin grant (finding H-7).
- `pages/api/admin/action.js` `setGold` (finding H-6).
- `process_trigger` PL/pgSQL specials grant (audit H-10) — function is Supabase-only, not in tracked migrations; may bypass ledger for FG portion of specials. Verify when restoring to repo.

All should funnel into `fg_ledger`.

## Vault invariant

`fg_vault.in_circulation + sum(escrow.fg_amount where status=held) = sum(users.fg_balance)`. Periodic reconciliation job to verify is not yet built (see [`../infra/scheduled-jobs.md`](../infra/scheduled-jobs.md)).

## Related

- [`./transactions.md`](./transactions.md) — Stripe-purchase ledger
- [`./escrow.md`](./escrow.md)
- [`../endpoints/fg.md`](../endpoints/fg.md)
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) finding M-4 (two ledgers)
