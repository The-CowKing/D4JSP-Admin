# Data Model: admin_action_log

Per-user audit trail. Service-role-only access.

## Schema (migration 022)

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `admin_id` | uuid FK → users | actor |
| `target_id` | uuid FK → users | subject |
| `action` | text | e.g. `grantFg`, `banUser`, `setRole`, `awardXp`, `setMembership`, `grantBadge`, `removeBadge`, `setDisplayName`, `setAdminNotes`, `setTradingLocked`, `setMonitored`, `banByIp`, `unbanUser`, `setRank`, `config_set`, `config_reset` |
| `details` | jsonb | per-action context |
| `created_at` | timestamptz | |

## Indexes

- `aal_target_idx` on `(target_id, created_at DESC)` — Admin Actions tab on user detail
- `aal_admin_idx` on `(admin_id, created_at DESC)` — actions performed by admin

## RLS

`ENABLE ROW LEVEL SECURITY` with NO SELECT policy. Service-role only. Anon and authenticated cannot read.

## Authoritative writer

[`../../pages/api/admin/user-detail.js:34-47`](../../pages/api/admin/user-detail.js) `logAction(adminId, targetId, action, details)`. Wraps every per-user mutation.

`pages/api/admin/config.js` ALSO writes here for `config_set` and `config_reset` actions.

## NOT writing here (gap)

`pages/api/admin/action.js` (legacy admin endpoint, finding H-4) doesn't call `logAction`. Migrate AdminView callers off `action.js` to close the audit gap.

## Read endpoint

`GET /api/admin/user-detail?type=admin-log&userId=` — returns the user's audit trail with admin display names enriched.

## Related

- [`../endpoints/admin.md`](../endpoints/admin.md)
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) finding H-4
