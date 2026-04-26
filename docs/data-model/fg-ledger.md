# Data Model: fg_ledger

The canonical FG transaction history. Append-only.

## ⚠ Schema reality vs. plan (#66)

The production schema is **entity-based** (the original genesis-mint shape). The uid-based shape originally documented here describes a planned migration that has not been applied. Writing to `from_uid`/`to_uid`/`reason`/`ref_id` columns produces `code: '42703' "column fg_ledger.<col> does not exist"` errors that bubble through every API route that calls them. #66 root cause was exactly this — the spawn quest reward grant threw on `from_uid` and broke gem clicks entirely.

Authoritative writers MUST use the actual schema below until the uid migration is shipped + verified in prod.

## Actual production schema

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `tx_type` | text | `'mint'` (genesis), `'grant'` (vault → user from quest/gamble/admin), `'transfer'`, `'burn'`, `'purchase'`, `'escrow_hold'`/`'escrow_release'`/`'escrow_refund'`, etc. |
| `from_entity` | text | `'vault'`, `'user:<uuid>'`, `'escrow:<uuid>'`, `'genesis'`. Free-form text. |
| `to_entity` | text | same shape as `from_entity`. |
| `amount` | int | always positive |
| `serial_start` | bigint nullable | for genesis mint; not used for grants |
| `serial_end` | bigint nullable | same |
| `memo` | text | human-readable description, often `'<reason>:<ref_id>'` (e.g., `'quest_complete:<quest_uuid>'`). |
| `tx_hash` | text nullable | reserved |
| `metadata` | jsonb | `{ user_id, quest_id, source, ... }` — reconciliation joins go here. |
| `created_at` | timestamptz | |

## Reconciliation

User balance reconciliation joins on `metadata->>'user_id'` (jsonb extraction) since there's no native uid column. Sum:
```sql
SELECT
  metadata->>'user_id' AS uid,
  SUM(CASE WHEN to_entity = 'user:' || (metadata->>'user_id') THEN amount ELSE 0 END) AS credited,
  SUM(CASE WHEN from_entity = 'user:' || (metadata->>'user_id') THEN amount ELSE 0 END) AS debited
FROM fg_ledger
WHERE metadata->>'user_id' IS NOT NULL
GROUP BY metadata->>'user_id';
```

## Planned uid migration (NOT YET APPLIED)

The doc previously listed `from_uid uuid`, `to_uid uuid`, `reason text`, `ref_id text`, `admin_id uuid` — that's the target schema for cleaner querying, but the migration that adds those columns has never been run on production. Don't reference them in code until the migration ships AND is verified by Adam.

## RLS

User can SELECT rows where `to_entity = 'user:' || auth.uid()::text` or `from_entity = 'user:' || auth.uid()::text`. No client INSERT.

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
