# Catalog: subscription_tiers

Subscription levels: `free`, `verified`, `basic`, `premium`, `legendary`. Each tier carries a price, a skills array, a permissions JSON map, and badges to grant.

## Schema

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | tier id |
| `name` | text | display |
| `color` | text | UI color |
| `image_url` | text | tier badge art |
| `blurb` | text | shop card text |
| `price_monthly` | int | cents |
| `perm_perks` | jsonb | display perks |
| `skills` | uuid[] | granted skills (ref `skills.id`) |
| `permissions` | jsonb | id→value map (ref `admin_permissions.id`) |
| `rewards` | jsonb | reward grants |
| `skills_config` | jsonb | per-skill overrides |
| `sort_order` | int | |

## Endpoints

- **Public read:** `GET /api/store` — returns tiers + packages.
- **Admin write:** AdminView writes via anon client at lines 3607/3623/3629 of [`../../components/AdminView.js`](../../components/AdminView.js) — finding H-8. Should route through a server endpoint (none exists yet for tiers; for fg_packages there is `/api/admin/fg-packages`).

## Reconciliation

When a user's tier changes, `pages/api/admin/reconcile.js` rebuilds `user_skills` from `subscription_tiers.skills` for the new tier. Manual grants stay; old tier's grants are revoked unless still covered by rank.

## Related

- [`./skills.md`](./skills.md)
- [`./permissions.md`](./permissions.md)
- [`./fg-packages.md`](./fg-packages.md)
- [`../endpoints/stripe.md`](../endpoints/stripe.md) — Stripe webhook upgrades tiers
- [`../admin/subscriptions-tab.md`](../admin/subscriptions-tab.md)
