# Admin: Subscriptions tab

CRUD on `subscription_tiers` and `fg_packages`. Drives the `/store` shop view.

## Endpoint
- `POST /api/admin/fg-packages` — `fg_packages` CRUD (correct path)
- `subscription_tiers` writes currently bypass the admin API — finding H-8 (AdminView.js writes via anon client)

## Tier definition
Each tier has `name`, `color`, `image_url`, `price_monthly` (cents), `skills` uuid[], `permissions` JSON map, `rewards`, `badges`, `sort_order`. Linked by `users.membership = tier.id`.

## After editing
- If `skills` or `permissions` change: run `POST /api/admin/reconcile { action: 'reconcile_all' }` to repropagate to existing users' `user_skills` and `users.user_active_grants`.
- If pricing changes: NOTE that [`../../pages/api/create-payment-intent.js`](../../pages/api/create-payment-intent.js) currently uses hardcoded `MEMBERSHIP_PACKAGES` and won't pick up DB changes until that's fixed.

## Related

- [`../catalogs/subscription-tiers.md`](../catalogs/subscription-tiers.md)
- [`../catalogs/fg-packages.md`](../catalogs/fg-packages.md)
- [`../endpoints/stripe.md`](../endpoints/stripe.md)
