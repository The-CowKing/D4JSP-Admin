# Infra: Cloud (WordPress hub + 7 satellites)

Hostinger Cloud Pro plan. Runs WordPress multisite. **Not yet indexed in detail — touch when needed.**

## Identity

- **IP:** `82.29.193.20` port `65002` (SSH)
- **User:** `u704061244`
- **OS:** AlmaLinux + CageFS
- **SSH:** `ssh -i C:/Users/Owner/Desktop/keyz/d4jsp_cloud_claude -p 65002 u704061244@82.29.193.20`

## WordPress install

Path: `~/domains/d4jsp.org/public_html/`. Theme: `wp-content/themes/d4jsp-dark/`.

### Custom plugins (in-place, not in trade-app repo)
- `d4jsp-supabase-auth` — reads `.d4jsp.org` cookie chain, verifies Supabase JWT, gates page access. The federation glue.
- `d4jsp-crossforum-nav` — cross-network navigation.
- Plus stock: `bbpress`, `mercator` (domain mapping), `litespeed-cache`.

## Sites

| Domain | Role |
|---|---|
| `d4jsp.org` | Hub — landing, identity, latest-trades iframe |
| `diablo4marketplace.com` | Marketplace satellite |
| `diablo4mods.com` | Mods satellite |
| `diablo4clans.com` | Clans satellite |
| `diablo4calculator.com` | Calculator satellite |
| `diablo4guides.com` | Guides satellite |
| `diablo4tools.com` | Tools satellite |

(Exploits site removed per Patch 4.)

## LiteSpeed cache

Aggressive on Cloud. Bypassed for gate paths via plugin headers (`DONOTCACHEPAGE`). After PHP edits: `touch <file>` (bumps OPcache mtime), then `wp litespeed-purge all`. If still stale, curl-trigger `opcache_reset()` via a one-shot PHP file.

## Deploy

In-place. WP edits NOT in git. Procedure:
1. SSH in, `vi` or `scp` the file.
2. Backup first: `cp <file> <file>.bak.$(date +%s)`.
3. After edit: `touch <file>`, `wp litespeed-purge all --url=<site>`.
4. Verify: `curl -s -H 'Cache-Control: no-cache' -o /dev/null -w '%{http_code}' https://<domain>/`.

## Auth gate

WP plugin reads cookie `d4jsp_auth` (Supabase JWT) on `.d4jsp.org`. If missing or expired, redirects to gate. `d4jsp_auth_mode` option controls per-site behavior (`full_gate`, `public_read`, unset=disabled).

## Related

- [`../features/widgets.md`](../features/widgets.md) — trade app provides the latest-trades iframe
- [`../auth/cross-domain-cookies.md`](../auth/cross-domain-cookies.md)
- [`./connected-systems.md`](./connected-systems.md)
