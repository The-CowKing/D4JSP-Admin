# Integrations: Web Push (VAPID)

Browser notifications. Per-tier daily caps.

## Touchpoints

- [`../../components/AppShell.js`](../../components/AppShell.js) — line ~259, registers browser subscription with `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- `POST /api/push-subscribe` — saves `users.push_subscription` jsonb.
- `web-push` npm package sends from server; called by notification routes.
- [`../../lib/notificationLimits.js`](../../lib/notificationLimits.js) — per-tier daily caps (free=1, verified=5, premium=20, legendary=Infinity). **Hardcoded — finding M-1.**

## Env

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client; in `.env.production` — public, safe)
- `VAPID_PRIVATE_KEY` (server; **currently committed in `.env.production` — finding H-1**)

## Rotation

`npx web-push generate-vapid-keys`. After rotate, all existing subscriptions invalidate; users re-subscribe on next page visit. See [`../infra/credential-rotation.md`](../infra/credential-rotation.md).

## Hardening (finding H-1)

Move VAPID values out of tracked `.env.production`:
1. Add `.env*` to `.gitignore`.
2. `git rm --cached .env.production`.
3. Generate new pair, paste into Hostinger Node.js env.
4. Old subscriptions die; users re-subscribe.

## Related

- [`../data-model/notifications.md`](../data-model/notifications.md)
- [`../infra/credential-rotation.md`](../infra/credential-rotation.md)
