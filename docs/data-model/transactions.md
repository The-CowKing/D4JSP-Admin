# Data Model: transactions

Stripe-purchase ledger. `UNIQUE(stripe_payment_id)` gives webhook idempotency.

## Schema

| Column | Type | Notes |
|---|---|---|
| `uid` | uuid FK → users | |
| `type` | text | `fg_purchase` / `membership_purchase` |
| `package_id` | text | from `fg_packages.id` or membership tier id |
| `fg` | int nullable | FG credited (for fg_purchase) |
| `amount` | int | Stripe amount in cents |
| `stripe_payment_id` | text UNIQUE | Stripe `payment_intent.id` — drives idempotency |
| `created_at` | timestamptz | |

## Idempotency

Insert first; if PG error 23505 (UNIQUE violation), webhook handler returns 200 immediately (no double-credit). See [`../../pages/api/webhook.js:65-82`](../../pages/api/webhook.js).

## Side effect

After insert, `adminDb.rpc('increment_user_fg', {user_id, amount})` updates `users.fg_balance` atomically (single UPDATE, no read-then-write race).

For memberships, a separate UPDATE applies the new tier + badges + expiry; on `customer.subscription.deleted`, downgrades to free.

## Webhook timestamp validation gap (finding M-7)

Add `if (Math.abs(Date.now()/1000 - event.created) > 300) return 400` to enforce Stripe's recommended ±5-minute replay window.

## Related

- [`./fg-ledger.md`](./fg-ledger.md)
- [`../endpoints/stripe.md`](../endpoints/stripe.md)
- [`../integrations/stripe.md`](../integrations/stripe.md)
- [`../catalogs/fg-packages.md`](../catalogs/fg-packages.md)
- [`../catalogs/subscription-tiers.md`](../catalogs/subscription-tiers.md)
