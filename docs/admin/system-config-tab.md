# Admin: System Config tab

Edit operational tunables in `system_config`. Every business constant should live here.

## Endpoints
- `GET /api/admin/config` — list all keys
- `POST /api/admin/config { action: 'set', key, value, note }` — set + audit
- `POST /api/admin/config { action: 'reset', key }` — reset to `ship_default`
- `POST /api/admin/config-fields` — manage field type schema (label, type, default, nullable)

## Categories

`escrow`, `trade`, `account`, `currency`, `raffle`, `xp`, `rate_limit`, `widget`.

## Currently-bypassed constants

11 inline business constants need to be migrated to this catalog (finding M-1). Inventory in [`../catalogs/system-config.md`](../catalogs/system-config.md).

## After editing

`getConfig()` in [`../../lib/sysConfig.js`](../../lib/sysConfig.js) caches for 60s. Set via this admin endpoint busts the cache so the change takes effect within a few seconds.

## Audit

Every `set`/`reset` writes a `system_config_log` row + an `admin_action_log` row.

## Related

- [`../catalogs/system-config.md`](../catalogs/system-config.md)
- [`../endpoints/admin.md`](../endpoints/admin.md)
- [`../modular-system/overview.md`](../modular-system/overview.md)
