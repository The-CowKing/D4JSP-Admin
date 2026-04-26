# Feature: Public Widgets

Public iframe widgets for the WordPress hub at `d4jsp.org`. No auth gate. CSP `frame-ancestors` allows embedding from `d4jsp.org` and `*.d4jsp.org`.

## Latest Trades widget

- **Page route:** `/widget/latest-trades` ([`../../pages/widget/latest-trades.js`](../../pages/widget/latest-trades.js)).
- **API:** `GET /api/widget/latest-trades` ([`../../pages/api/widget/latest-trades.js`](../../pages/api/widget/latest-trades.js)).
- **Behavior:** SSR'd shell, polls API every 20 seconds. Lists 25 (max 50) most recent threads matching `cat`/`realm` filters. Sanitized whitelist of fields only — no `author_id`, no FG balance.
- **Cache:** `Cache-Control: public, max-age=30, s-maxage=30, stale-while-revalidate=60`. LiteSpeed-friendly.
- **Defaults:** `cat=trades`, `realm=eternal-softcore`. Override via `?cat=...&realm=...` (read from `system_config` keys `widget.public_latest_trades_category`/`...realm`).
- **Hide realm column:** `?hideRealm=1`.

## Server config

`adminDb` is used so RLS doesn't block. Whitelist fields: `id`, `title`, `price`, `category`, `mode`, `author_name`, `author_photo_url`, `created_at`.

## CSP / framing

Both `/widget` and `/api/widget/*` get `Content-Security-Policy: frame-ancestors 'self' https://d4jsp.org https://*.d4jsp.org` from `next.config.js:75-93`. `X-Frame-Options` is explicitly NOT set (CSP supersedes; X-Frame-Options has no "allow these specific origins" mode).

## WP integration

WP hub renders the widget in an `<iframe src="https://trade.d4jsp.org/widget/latest-trades?...">` tag. See WordPress federation docs (not yet indexed).

## Related

- [`../endpoints/widgets.md`](../endpoints/widgets.md)
- [`../catalogs/system-config.md`](../catalogs/system-config.md) — `widget.*` keys
- [`../infra/cloud.md`](../infra/cloud.md) — WP hub
