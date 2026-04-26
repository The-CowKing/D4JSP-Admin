# Integrations: Resend

Transactional email — welcome, grant notifications, rank-up, special claims, membership upgrades.

## Touchpoints

- [`../../lib/sendGrantEmail.js`](../../lib/sendGrantEmail.js) — central send helper. Reads `RESEND_API_KEY` env, dedups via `notification_log` (idempotency by `(user_id, event_key)`).
- Callers: [`../../pages/api/auth/setup-user.js`](../../pages/api/auth/setup-user.js) (welcome), [`../../pages/api/admin/user-detail.js`](../../pages/api/admin/user-detail.js) (grantFg, grantBadge, setMembership, awardXp rank-up), [`../../lib/triggerEngine.js`](../../lib/triggerEngine.js) (special grants).

## Env

- `RESEND_API_KEY` (server, KVM 4 prod env)

## Smoke test

`POST /api/admin/test-email` ([`../../pages/api/admin/test-email.js`](../../pages/api/admin/test-email.js)) — admin-only. Fires a sample `rank_up` email to the admin's own address. Returns `{ ok, emailTo, error?, note }`. If `error: 'no_api_key'`, RESEND_API_KEY is unset.

## Templates

`sendGrantEmail.js` renders inline based on `type`: `welcome`, `fg_grant`, `badge_grant`, `rank_up`, `membership_upgrade`, `special`. Templates inlined in the lib file.

## Skip rules

- Skip if email ends with `@auth.d4jsp.local` (bot accounts).
- Skip if `RESEND_API_KEY` not set (logs `no_api_key`, returns ok=false).
- Skip if duplicate `event_key` for the same user (idempotency via `notification_log`).

## Related

- [`../data-model/notifications.md`](../data-model/notifications.md)
- [`../endpoints/admin.md`](../endpoints/admin.md) — `/api/admin/test-email`
- [`../infra/credential-rotation.md`](../infra/credential-rotation.md)
