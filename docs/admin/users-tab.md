# Admin: Users tab

Per-user view + actions. Drives [`/api/admin/user-detail`](../endpoints/admin.md) (correct path) for all mutations.

## Sub-tabs (GET ?type=)
- `profile` — main user row + listing/trade/review counts
- `activity` — chronological feed across `fg_ledger`, `special_claims`, `event_entries`, `user_badges`, `threads`
- `escrow` — open/closed escrows
- `disputes` — disputed threads
- `listings` — author's listings
- `transactions` — `fg_ledger` view
- `grants` — current badges + skills + rank
- `notifications` — `notification_log` view
- `admin-log` — `admin_action_log` for this user (audit trail)

## Actions (POST)
`grantFg`, `grantBadge`, `removeBadge`, `setRole`, `banUser` (with `byIp` flag — finding H-5), `unbanUser`, `setMembership`, `setRank`, `awardXp`, `setDisplayName`, `setAdminNotes`, `setTradingLocked`, `setMonitored`. Each writes `admin_action_log` entry.

## Don't use the legacy `/api/admin/action.js`

Same actions, no audit log, no fg_ledger entry. Migrate AdminView callers (finding H-4).

## Related

- [`../endpoints/admin.md`](../endpoints/admin.md)
- [`../data-model/users.md`](../data-model/users.md)
- [`../data-model/admin-action-log.md`](../data-model/admin-action-log.md)
- [`../data-model/fg-ledger.md`](../data-model/fg-ledger.md)
