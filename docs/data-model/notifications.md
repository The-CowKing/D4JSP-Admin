# Data Model: notifications + notification_log

In-app notifications and email send dedup.

## notifications

In-app feed. Read by [`../../components/AppShell.js`](../../components/AppShell.js) bell icon.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | recipient |
| `type` | text | `trade` / `system` / `social` / etc. |
| `title` | text | |
| `message` | text | |
| `read` | bool | |
| `created_at` | timestamptz | |

RLS: user can SELECT their own.

## notification_log (migration 021)

Email send dedup by `(user_id, event_key)`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `event_key` | text | typically `<type>:<refId>` |
| `email_to` | text | denormalized address sent to |
| `sent_at` | timestamptz | |

## Per-tier daily caps (finding M-1)

Hardcoded in [`../../lib/notificationLimits.js:1-43`](../../lib/notificationLimits.js): free=1, verified=5, premium=20, legendary=Infinity. Should move to `system_config` keys `notification.<tier>_daily_cap`.

## Related

- [`../endpoints/misc.md`](../endpoints/misc.md) — `/api/notification-count`, `/api/push-subscribe`
- [`../integrations/resend.md`](../integrations/resend.md)
- [`../integrations/web-push.md`](../integrations/web-push.md)
