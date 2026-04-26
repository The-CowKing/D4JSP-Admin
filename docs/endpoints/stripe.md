# Endpoints: Stripe

Two purchase types: FG packages (single-charge) and memberships (subscription).

## Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/create-payment-intent` | POST | Bearer JWT | Build a Stripe payment intent. Body `{ type: 'fg' \| 'membership' \| 'event_ticket', packageId }`. Server looks up price from hardcoded `FG_PACKAGES`/`MEMBERSHIP_PACKAGES` (NOT from DB — finding from prior audit; price drifts when admin edits tier in DB). ([`../../pages/api/create-payment-intent.js`](../../pages/api/create-payment-intent.js)) |
| `/api/webhook` | POST | Stripe signature | `payment_intent.succeeded` + `customer.subscription.deleted` handlers. Idempotency via `transactions.stripe_payment_id` UNIQUE. ([`../../pages/api/webhook.js`](../../pages/api/webhook.js)) |
| `/api/confirm-membership` | POST | Bearer JWT | Confirm-side helper. |
| `/api/events/enter` | POST | Bearer JWT | Event-ticket purchase intent / FG entry. |

## Webhook idempotency

UNIQUE constraint on `transactions.stripe_payment_id`. Duplicate webhooks fail with PG 23505 → handler returns 200 (Stripe stops retrying).

## Webhook timestamp validation gap (finding M-7)

`webhook.js:39` validates the signature but NOT `event.created`. Add `if (Math.abs(Date.now()/1000 - event.created) > 300) return 400;` to enforce Stripe's recommended ±5-min replay window.

## Related

- [`../integrations/stripe.md`](../integrations/stripe.md)
- [`../catalogs/fg-packages.md`](../catalogs/fg-packages.md)
- [`../catalogs/subscription-tiers.md`](../catalogs/subscription-tiers.md)
- [`../data-model/transactions.md`](../data-model/transactions.md)
