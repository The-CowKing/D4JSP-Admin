# Numbered FG Vault — Production State

**Status:** Aggregate ledger model in production. Per-coin numbering is admin-UI cosmetic only — `numbered_fg_vault` table does NOT exist.

This doc is the SINGLE SOURCE OF TRUTH for the entire FG (Forum Gold) money system. Every code path that touches FG must follow the contracts here. **FG is real money** (Stripe-paired) — direct `users.fg_balance` UPDATEs are FORBIDDEN per the #69 + #73 hard rules.

## What's actually in the DB

### `fg_vault` (single row, aggregate counters)

| Column | Type | Meaning | Production value (2026-04-26) |
|---|---|---|---|
| `id` | uuid PK | single row id | `0b36c5b1-003e-4aa6-8d7c-655020350aaa` |
| `total_supply` | bigint | hard cap, never changes | `100000000000` (100B) |
| `circulating` | bigint | sum of all `users.fg_balance` | should equal `SUM(users.fg_balance)` |
| `burned` | bigint | permanently destroyed | `0` (no burns yet) |
| `reserved` | bigint | held in escrow / reward pools | tied to `escrow.held_fg` (currently uncomputed) |
| `fg_per_usd` | numeric | exchange rate for Stripe | `1000.0` |
| `fg_per_cad` | numeric | exchange rate for Stripe | `1350.0` |

**Reconciliation invariant (the law):**
```
total_supply ≥ circulating + reserved + burned    (always)
in_vault = total_supply - circulating - reserved - burned    (derived)
```

If `circulating + reserved + burned > total_supply`, that's a real-money data integrity bug — alert immediately.

### `fg_ledger` (append-only audit)

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `tx_type` | text | CHECK constraint: `'mint'`, `'transfer'`, `'burn'`. Vault → user uses `'transfer'`. |
| `from_entity` | text | `'vault'` / `'user:<uuid>'` / `'escrow:<uuid>'` / `'genesis'` |
| `to_entity` | text | same shape |
| `amount` | int | always positive |
| `serial_start`, `serial_end` | bigint nullable | unused except for genesis row |
| `memo` | text | `'<source>:<ref_id>'` for human audit |
| `metadata` | jsonb | `{user_id, source, ref_id, quest_id, admin_id, ...}` |
| `tx_hash` | text nullable | reserved (future) |
| `created_at` | timestamptz | |

### `users.fg_balance` (denormalized cache)

`int` column on `users`. Source of truth for what the user sees in their wallet. Must equal the user's net `fg_ledger` rows. Admin "User Detail" tab reads this directly.

### `users.xp` (no vault accounting)

XP isn't real money. Direct UPDATE is acceptable; no ledger requirement. `lib/grantFg.js` exposes `grantXp({userId, amount})` for consistency.

### What does NOT exist

- `numbered_fg_vault` table — the per-coin design from `.claude/worktrees/*/docs/numbered-fg-vault.md` (status: "Design doc — not yet built"; "Decision: Skip numbered units. Use ledger-only approach."). The admin panel showing "SERIALS: FG-1 → FG-100B" is decorative; no per-coin storage exists.
- `users.id = '00000000-0000-0000-0000-000000000001'` synthetic vault user — also not in the live DB.

The "vault" in production = the single `fg_vault` row's aggregate counters. Mint = `circulating` goes up. Burn back = `circulating` goes down. Escrow lock = `reserved` goes up. Escrow release to buyer = `reserved` goes down + `circulating` net stays the same.

## Lifecycle of an FG unit

```
[unminted: total_supply - everything-else]
       │
       │ Stripe purchase (webhook) │ Quest grant │ Admin grant │ Gamble payout │ Signup grant
       ▼
[circulating: in users.fg_balance]
       │
       │ Trade initiate / escrow lock                     │
       ├──────────────────────────────────────────────────┤ ─── escrow release (back to seller)
       ▼                                                  │
[reserved: held in escrow.held_fg]                        │
       │                                                  │
       │ Trade complete                                    │
       ▼                                                  │
[circulating: in BUYER's users.fg_balance] ◄──────────────┘
       │
       │ Burn (if exists) │ Account deletion (return to vault — back to unminted)
       ▼
[burned] / [unminted]
```

## Canonical helpers — every grant goes through `lib/grantFg.js`

```js
import { grantFgFromVault, chargeFgToVault, grantXp } from '../../lib/grantFg';

// Vault → user (positive direction). Use for: quest_complete, special_claim,
// rank_up, gamble_event_win, admin_grant, stripe_purchase, subscription_grant,
// signup_grant, referral_bonus.
await grantFgFromVault({
  userId, amount, source: 'quest_complete', refId: quest.id,
  metadata: { quest_id: quest.id, ... },
});

// User → vault (negative direction). Use for: burn, entry fees.
await chargeFgToVault({ userId, amount, source: 'burn', refId, metadata });

// XP only (no vault).
await grantXp({ userId, amount });
```

**`grantFgFromVault` does in this order:**
1. INSERT `fg_ledger` row (entity-based: `tx_type='transfer'`, `from_entity='vault'`, `to_entity='user:<uuid>'`).
2. Atomic balance + vault update via `increment_user_fg` SECURITY DEFINER RPC (migration 039), OR — until that migration ships — JS fallback that updates `users.fg_balance` AND `fg_vault.circulating` in lockstep.
3. Throw on any failure so caller's dependent state writes don't run.

Idempotency is held UPSTREAM by each caller's natural unique state (quest_progress.completed gate, transactions.stripe_payment_id UNIQUE, etc.). The helper does NOT dedupe; a duplicate insert is a real bug at the caller.

## Mint flow: Stripe purchase

```
Buy Now (350 FG / $1.99)
  → ShopView.startCheckout('fg', pkg)
  → POST /api/create-payment-intent { type: 'fg', packageId }
  → server reads fg_packages.price (#57: was 'price_usd' broken)
  → returns { clientSecret }
  → in-page Stripe Elements modal → user enters card
  → stripe.confirmPayment('inline') → succeeded
  → POST /api/confirm-membership { paymentIntentId }
  → server-side:
     - INSERT transactions row (UNIQUE stripe_payment_id) — idempotency gate
     - grantFgFromVault({ source: 'stripe_purchase', refId: payment_intent.id, metadata: { stripe_payment_id, package_id, amount_cents } })
       └─ fg_ledger row + balance + vault.circulating
  → also Stripe webhook /api/webhook fires the same grantFgFromVault path (transactions row has UNIQUE constraint so duplicate is no-op)
  → users live realtime sub (#72) pushes new fg_balance into header / character / shop displays
```

## Quest grant flow

```
Click gem (forum_troll_spawned)
  → handleGemClick increments gemClicks; on threshold:
  → POST /api/quest-trigger { trigger_id: 'forum_troll_spawned' }
  → quest-trigger.js:
     - Loads quest row (active, trigger_id match)
     - SELECT existing quest_progress row (user_id, quest_id)
     - Subscription / weekly / concurrent gates per #46/#51
     - _parseQuestRewards reads quests.rewards array (modern) or scalars (legacy)
     - if nowCompleted (false→true transition for this user-quest):
        grantFgFromVault({ source: 'quest_complete', refId: quest.id, metadata: { quest_id } })
        grantXp({ userId, amount })
        if forum_troll_spawned: _spawnForumTroll inserts forum_trolls row
     - explicit UPDATE-or-INSERT into quest_progress (#71: was upsert with no UNIQUE constraint)
  → emitTrigger fires specials engine (process_trigger PL/pgSQL — separate path, audit H-10)
```

## Trade / escrow flow (currently bypasses vault — audit follow-up)

```
Initiate escrow:
  → POST /api/initiate-escrow { threadId }
  → server creates escrow row, sets users.fg_balance -= price (BUYER's balance)
  → SHOULD also: chargeFgToVault({ userId: buyer, amount: price, source: 'escrow_hold', refId: escrow.id })
  → SHOULD also: bump fg_vault.reserved += price
  → Currently does NEITHER — direct UPDATE bypasses vault. #73-A follow-up.

Confirm trade (release to seller):
  → POST /api/confirm-trade
  → server transitions escrow → completed, sets users.fg_balance += price (SELLER)
  → SHOULD also: grantFgFromVault({ userId: seller, amount, source: 'escrow_release', refId: escrow.id })
  → SHOULD also: bump fg_vault.reserved -= price
  → Currently does NEITHER. #73-B follow-up.

Cancel/refund:
  → escrow back → buyer; vault.reserved -= price.
```

## User-to-user transfer (legacy, not yet vault-aware)

`pages/api/transfer-fg.js` writes `fg_transfers` (legacy table per audit M-4), NOT `fg_ledger`. Pre-vault discipline. To converge:
1. Migrate `fg_transfers` rows → `fg_ledger` with `tx_type='transfer'`, `from_entity='user:<sender>'`, `to_entity='user:<recipient>'`.
2. Update transfer-fg.js to use a new `transferFgUserToUser` helper (not yet built — audit follow-up).
3. Drop `fg_transfers` table after backfill verified.

## Admin operations

| Action | Endpoint | What it should do |
|---|---|---|
| Grant FG (admin) | `pages/api/admin/user-detail.js` `grantFg` | `grantFgFromVault({source:'admin_grant', refId:adminId, adminId})` — currently uses uid-based broken shape (audit follow-up) |
| Revoke FG (admin) | same | `chargeFgToVault({source:'admin_revoke', refId, adminId})` — not yet implemented |
| Burn (admin) | not built | `chargeFgToVault({source:'burn'})` would route. + bump `fg_vault.burned`. |

## Display contracts (where balance shows)

**Live-updating** (subscribes to `users` realtime per #72):
- Header / nav avatar pill
- `/character` profile page balance + history
- Shop / Buy FG screen
- Escrow flows (initiate / confirm / dispute)

**Static / cached** (does NOT subscribe — performance):
- Latest Trades cards (read seller balance from props snapshotted at fetch)
- Admin User-list table (refreshes on tab open, not realtime)

**Admin Vault panel** (`AdminView.js` Currency tab):
- Reads `fg_vault.circulating` / `.burned` / `.reserved` aggregate counters directly.
- Computes "In Vault" as `total_supply - circulating - burned - reserved`.
- Currently shows "NaN — Unminted" if any column reads as `undefined` — fixed in #73 by COALESCE-ing each component.

## Reconciliation

Run periodically (admin tool, not yet built):
```sql
SELECT
  v.circulating AS vault_circulating,
  (SELECT COALESCE(SUM(fg_balance), 0) FROM users) AS sum_user_balances,
  v.circulating - (SELECT COALESCE(SUM(fg_balance), 0) FROM users) AS drift
FROM fg_vault v;
```
Drift should be 0. If not, an audit row is missing or a write happened outside `grantFg.js`.

The 2026-04-26 reconciliation set `circulating = 3400` to match the live `SUM(fg_balance)` (was `0`, drift had accumulated since the table was created).

## Migrations needed (NOT YET APPLIED)

| File | Purpose | Status |
|---|---|---|
| `migrations/039_increment_user_fg_rpc.sql` | SECURITY DEFINER RPC for atomic balance + vault update | Pending Adam apply |
| `migrations/040_quest_progress_unique.sql` | UNIQUE(user_id, quest_id) constraint for upsert | Pending Adam apply |
| `migrations/041_users_realtime.sql` | Add `users` to `supabase_realtime` publication for live balance | Pending Adam apply |

Until 039 ships, `lib/grantFg.js` JS fallback handles the lockstep updates manually. Until 040 ships, `quest-trigger.js` uses explicit UPDATE-or-INSERT pattern. Until 041 ships, `refreshUserData()` is the fallback for balance refresh.

## DO NOT BREAK

1. **Every FG-credit code path MUST use the canonical helpers in `lib/grantFg.js`.** Direct `UPDATE users SET fg_balance = ...` is FORBIDDEN — it bypasses the vault and creates phantom gold. Audit failures.
2. **`fg_vault.circulating` MUST equal `SUM(users.fg_balance)` at all times** (modulo in-flight transactions). If they drift, that's a real-money data integrity bug.
3. **`fg_ledger` is append-only.** Never UPDATE or DELETE rows. Reversal = a new compensating row.
4. **`tx_type` is CHECK-constrained** to `'mint' / 'transfer' / 'burn'`. Use `'transfer'` for vault↔user. (#68 root cause: `'grant'` was rejected.)
5. **Idempotency is the caller's job, not the helper's.** Use natural unique state (quest_progress.completed gate, transactions UNIQUE, etc.). Duplicate inserts are bugs.
6. **Verified-flip workflow applies** — bot ships fix → deploys → reports → Adam tests in prod → Adam confirms → THEN bot flips the wire-dot in admin (per [`./conventions.md`](./conventions.md)).

## Cross-references

- [`./data-model/fg-ledger.md`](./data-model/fg-ledger.md) — full ledger schema + grant pattern
- [`./modular-system/overview.md`](./modular-system/overview.md) — Reward grant chain contract
- [`./features/forum-troll-gem.md`](./features/forum-troll-gem.md) — Quest reward chain (spawn + kill)
- [`./_batch-log.md`](./_batch-log.md) — #57 / #61 / #66 / #68 / #69 / #71 / #73 entries

## Audit follow-ups (tracked in `_batch-log.md`)

- `lib/awardXp.js` rank-up FG bonus — direct balance UPDATE, no ledger
- `pages/api/admin/user-detail.js` admin grant — uid-based broken shape
- `pages/api/admin/gamble.js` — fixed in #69 ✓
- `pages/api/transfer-fg.js` — uses legacy `fg_transfers` table
- `pages/api/grant-fg.js` — legacy admin grant path
- `pages/api/initiate-escrow.js` / `confirm-trade.js` — escrow flow doesn't update `fg_vault.reserved`
- `process_trigger` PL/pgSQL specials — bypasses ledger (audit H-10)
- Periodic reconciliation cron — not yet built
