# Integrations: Wowhead (item tooltips)

D4 item names + tooltip HTML come from Wowhead via DOM scrape on KVM 2 (Puppeteer).

## Touchpoints

- KVM 2 service `/opt/d4jsp-tooltip` (PM2 `d4jsp-tooltip`, port 3100) — Puppeteer worker.
- `POST /api/tooltip-snapshot` ([`../../pages/api/tooltip-snapshot.js`](../../pages/api/tooltip-snapshot.js)) — proxies to KVM 2.
- [`../../lib/tooltips.js`](../../lib/tooltips.js) — server-side fetch helper.
- [`../../lib/wowhead.js`](../../lib/wowhead.js) — Wowhead URL/slug helpers.
- `wowhead_tooltips` table — cache of scraped HTML by item name + wowhead_id.

## Pipeline

1. Trade app needs a tooltip → `POST /api/tooltip-snapshot { wowheadUrl }`.
2. KVM 2 Puppeteer navigates Wowhead, waits for `document.fonts.ready`, screenshots the tooltip frame.
3. Returns PNG, uploaded to `tooltip-snapshots` Storage bucket.
4. HTML form cached in `wowhead_tooltips.tooltip_html`.

## Gotchas

- Don't block `font` resource in Puppeteer — fonts must load for proper rendering.
- `await document.fonts.ready` before screenshot; otherwise text renders in fallback fonts.
- D4 item slugs are inconsistent — lookup table at `data/item-slugs.json`.

## Related

- [`../features/sell-pipeline.md`](../features/sell-pipeline.md) — OCR resolves to a wowhead_id which drives tooltip lookup
- [`../endpoints/ocr.md`](../endpoints/ocr.md) — `/api/tooltip-snapshot`, `/api/fetch-item-template`
- [`../infra/kvm-2.md`](../infra/kvm-2.md)
