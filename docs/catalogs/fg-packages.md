# Catalog: fg_packages

Buy-FG store packages. Stripe charges → user `fg_balance` increments via `increment_user_fg` RPC.

## Schema

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | e.g. `fg_500` |
| `name` | text | display |
| `image_url` | text | |
| `price_usd` | int | cents |
| `fg_amount` | int | FG to credit |
| `popular` | boolean | "Best Value" flag |
| `color` | text | UI color |
| `skills` | uuid[] | bonus skills granted on purchase |
| `permissions` | jsonb | bonus permissions |
| `rewards` | jsonb | extra rewards |
| `sort_order` | int | |

## Endpoints

- **Public read:** `GET /api/store`.
- **Admin write:** `POST /api/admin/fg-packages` (correct path). AdminView ALSO writes via anon client at lines 3607/3623/3629 — finding H-8, must be migrated to the API route.
- **Purchase intent:** `POST /api/create-payment-intent { type: 'fg', packageId }` — see [`../endpoints/stripe.md`](../endpoints/stripe.md).
- **Webhook credit:** `payment_intent.succeeded` → `transactions` insert (idempotent on `stripe_payment_id`) → `increment_user_fg` RPC.

## Related

- [`./subscription-tiers.md`](./subscription-tiers.md)
- [`../endpoints/stripe.md`](../endpoints/stripe.md)
- [`../integrations/stripe.md`](../integrations/stripe.md)
- [`../data-model/transactions.md`](../data-model/transactions.md)
