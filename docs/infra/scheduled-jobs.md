# Infra: Scheduled jobs

What runs on a timer, where, and how often.

## Currently scheduled

| Job | Where | Schedule | Purpose |
|---|---|---|---|
| `loot-scraper.py` | KVM 4 `/opt/d4jsp/loot-scraper.py` | Sundays 03:00 UTC (cron) | Scrape boss/dungeon loot tables |
| `build-scraper.py` | KVM 4 `/opt/d4jsp/build-scraper.py` | Sundays 06:00 UTC (cron) | Build/aspect/skill/dungeon JSON dumps to `/opt/d4jsp/data/` |
| Supabase auto-backup | Supabase Pro | daily | DB snapshot |
| certbot renew | KVM 4 + KVM 2 | systemd timer | TLS cert renewal |
| Hostinger snapshots | Hostinger panel | configurable | VPS-level snapshots |

## Should be scheduled but isn't

| Job | Status | Action |
|---|---|---|
| `/api/admin/trigger-expiry-check` | **Manual only** | Set up an external scheduler or systemd timer that POSTs with admin JWT. Or add a Supabase Edge Function on cron. |
| FG ledger reconciliation | not built | Periodic walk of `fg_ledger` to verify supply invariant (`vault + sum(users.fg_balance) + sum(escrow.fg_amount where status=held) = total_supply`). Future. |
| Audit-log compaction | not built | Once `admin_action_log` and `system_config_log` get large, compact older entries to summary rows. |

## Cron locations (KVM 4)

```bash
ssh ... root@177.7.32.128 "crontab -l"
```
Currently: scrapers above, plus standard system jobs.

## Adding a new scheduled job

For trade-app-side work:
1. Create an admin endpoint that does the work.
2. Add a cron entry on KVM 4 invoking `curl -H "Authorization: Bearer <admin JWT>" -X POST https://trade.d4jsp.org/api/<endpoint>`.
3. Document here.
4. Consider Supabase Edge Functions for DB-only work — they have native cron.

## Related

- [`./kvm-4.md`](./kvm-4.md)
- [`../endpoints/quests-triggers.md`](../endpoints/quests-triggers.md) — `trigger-expiry-check`
- [`../catalogs/triggers.md`](../catalogs/triggers.md)
