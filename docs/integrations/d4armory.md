# Integrations: d4armory.io

Boss + world-event timer aggregator. Unofficial Blizzard-data scraper.

## Touchpoints

- `GET /api/boss-timer` ([`../../pages/api/boss-timer.js`](../../pages/api/boss-timer.js)) proxies `https://d4armory.io/api/events/recent` with 60s server cache.
- `EventTicker.js` (or similar component) consumes this for the marquee on Latest Trades.

## Caveats

- Unofficial scrape of Blizzard armory pages. Fragile — breaks when Blizzard ships UI changes.
- ToS unclear (community-tolerated, not endorsed).
- No SLA. Backed by stale-cache fallback when upstream is down.

## Hardcoded cache TTL

[`../../pages/api/boss-timer.js:7`](../../pages/api/boss-timer.js): `60_000` ms. Should move to `system_config.cache.boss_timer_ttl_ms` (finding M-1).

## Related

- [`../endpoints/misc.md`](../endpoints/misc.md) — `/api/boss-timer`
