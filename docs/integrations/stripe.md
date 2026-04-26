# Integrations: Stripe

Payments. FG packages and memberships. Test mode today (`sk_test_*`); live keys deferred until billing test passes.

## Touchpoints

- [`../../pages/api/create-payment-intent.js`](../../pages/api/create-payment-intent.js) — builds `payment_intent` for `fg` / `membership` / `event_ticket`.
- [`../../pages/api/webhook.js`](../../pages/api/webhook.js) — receives `payment_intent.succeeded` + `customer.subscription.deleted`.
- [`../../pages/api/confirm-membership.js`](../../pages/api/confirm-membership.js) — confirm-side helper.
- [`../../components/ShopView.js:25`](../../components/ShopView.js) — `loadStripe()` for client-side card collection.

## Env

- `STRIPE_SECRET_KEY` (server, KVM 4 prod env)
- `STRIPE_WEBHOOK_SECRET` (server)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client)

## Webhook URL

`https://trade.d4jsp.org/api/webhook`. Configured in Stripe dashboard → Webhooks.

## Idempotency

`transactions.stripe_payment_id` UNIQUE. Duplicate webhook → PG 23505 → handler returns 200 → Stripe stops retrying.

## Pricing

`FG_PACKAGES` and `MEMBERSHIP_PACKAGES` maps in [`../../pages/api/create-payment-intent.js`](../../pages/api/create-payment-intent.js) hold prices in cents. **Diverges from `fg_packages` and `subscription_tiers` DB tables** (prior audit). Fix: source from DB.

## Replay window gap (finding M-7)

`webhook.js:39` validates signature but not `event.created`. Add `if (Math.abs(Date.now()/1000 - event.created) > 300) return 400`.

## Membership tier mapping

`webhook.js:21-26` `MEMBERSHIP_BADGES` is hardcoded. Should source from `subscription_tiers.badges`.

## Related

- [`../endpoints/stripe.md`](../endpoints/stripe.md)
- [`../catalogs/fg-packages.md`](../catalogs/fg-packages.md)
- [`../catalogs/subscription-tiers.md`](../catalogs/subscription-tiers.md)
- [`../data-model/transactions.md`](../data-model/transactions.md)
- [`../infra/credential-rotation.md`](../infra/credential-rotation.md)
