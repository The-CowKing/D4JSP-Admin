# Endpoints: widgets (public)

Anonymous, CSP-allowed for embedding from `d4jsp.org` and `*.d4jsp.org`.

## Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/widget/latest-trades` | GET | List recent threads. Query: `cat`, `realm`, `limit` (1–50). Defaults from `system_config` keys `widget.public_latest_trades_category`/`...realm`. Whitelist response — no `author_id`, no FG balance. ([`../../pages/api/widget/latest-trades.js`](../../pages/api/widget/latest-trades.js)) |

## Page route

`/widget/latest-trades` ([`../../pages/widget/latest-trades.js`](../../pages/widget/latest-trades.js)) — SSR'd shell, polls API every 20s.

## Headers

`next.config.js:75-93` adds `Content-Security-Policy: frame-ancestors 'self' https://d4jsp.org https://*.d4jsp.org` to both `/widget/*` and `/api/widget/*`. `Cache-Control: public, max-age=30, s-maxage=30, stale-while-revalidate=60`.

## Related

- [`../features/widgets.md`](../features/widgets.md)
- [`../catalogs/system-config.md`](../catalogs/system-config.md)
- [`../infra/cloud.md`](../infra/cloud.md) — WP hub embeds these
