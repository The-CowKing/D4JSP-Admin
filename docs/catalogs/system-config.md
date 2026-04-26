# Catalog: system_config + system_config_log + config_fields

Operational tunables. Every business constant belongs here; nothing should be hardcoded inline (finding M-1).

## system_config schema

| Column | Type | Notes |
|---|---|---|
| `key` | text PK | e.g. `escrow.lock_hours` |
| `value` | jsonb | active value |
| `ship_default` | jsonb | rollback target |
| `category` | text | `escrow`, `trade`, `account`, `currency`, `raffle`, `xp`, `rate_limit`, `widget` |
| `label` | text | |
| `description` | text | |
| `value_type` | text | `number` / `string` / `boolean` / `json` |
| `enabled` | boolean | |
| `updated_by` | uuid | |
| `updated_at` | timestamptz | |
| `created_at` | timestamptz | |

## system_config_log

Append-only audit. `key`, `old_value`, `new_value`, `changed_by`, `changed_at`, `note`.

## config_fields

Schema-of-keys for the admin UI. `key`, `label`, `type`, `default_val`, `nullable`, `nullable_label`, `sort_order`.

## Helper API — lib/sysConfig.js

Server-side only.

| Function | Purpose |
|---|---|
| `getConfig(key, fallback)` | Read with 60s in-memory cache. |
| `setConfig(key, val, adminUid, note)` | Write + audit log. Busts cache. |
| `resetConfig(key, adminUid)` | Reset to `ship_default`. |
| `getAllConfig()` | Bypass cache; admin panel. |
| `getConfigByCategory(cat)` | Bypass cache; per-category list. |

## Endpoints

- **Admin:** `GET/POST /api/admin/config` ([`../../pages/api/admin/config.js`](../../pages/api/admin/config.js)) — get all, set, reset.
- **Admin field types:** `POST /api/admin/config-fields` ([`../../pages/api/admin/config-fields.js`](../../pages/api/admin/config-fields.js)).

## Constants currently bypassing this catalog (finding M-1)

See [`../modular-system/overview.md`](../modular-system/overview.md) for the full inventory. Examples: escrow hours, FG transfer cap, signup FG, glow cooldowns, notification daily caps, rank fgReward.

## Related

- [`../modular-system/overview.md`](../modular-system/overview.md)
- [`../admin/system-config-tab.md`](../admin/system-config-tab.md)
- [`../endpoints/admin.md`](../endpoints/admin.md)
