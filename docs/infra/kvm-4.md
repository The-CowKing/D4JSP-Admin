# Infra: KVM 4 (trade frontend host)

Hostinger VPS. Runs the trade app — the single backend for the entire D4JSP system.

## Identity

- **Hostname / IP:** `trade.d4jsp.org` / `177.7.32.128` (`srv1619582`)
- **OS:** Ubuntu 24.04
- **SSH:** `ssh -i C:/Users/Owner/Desktop/keyz/d4jsp_kvm4_claude root@177.7.32.128`
- **Auth:** dedicated key only (`d4jsp_kvm4_claude`); shared `hostinger_ssh` removed.
- **Backups:** authorized_keys backup at `~/.ssh/authorized_keys.bak.<unix-ts>` (mode 600). Hostinger snapshot capability in hPanel.

## Services

### `/opt/d4jsp` — main trade app
- Repo: [github.com/The-CowKing/D4JSP](https://github.com/The-CowKing/D4JSP).
- PM2 process `d4jsp` cluster mode, single instance.
- Port 3000, custom [`../../server.js`](../../server.js) wrapper.
- Public via nginx → `https://trade.d4jsp.org/*`.
- Logs: `pm2 logs d4jsp`, files at `./logs/{out,err}.log`.

### Other apps (mounted as static)
- `d4jsp-build-planner` static export at `/builder` (mounted under nginx).
- `d4jsp-map` static at `/map` or iframe URL.

## Nginx

- Fronts `https://trade.d4jsp.org`.
- Proxies `/admin-panel/*` → `http://187.124.239.213:3001` (KVM 2). Configured via [`../../next.config.js`](../../next.config.js) rewrites at the Next.js level; nginx layer is a thin SSL terminator.
- Serves `/widget/*` from the trade app (no special config needed).

## Env

- `/opt/d4jsp/.env` — production env (NOT in git). Real values for `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, etc.
- Local snapshot in repo root: `.env.production.kvm4` (untracked, off-disk-only fallback).
- See [`./credentials.md`](./credentials.md) for the full env matrix.

## Deploy

```bash
ssh -i C:/Users/Owner/Desktop/keyz/d4jsp_kvm4_claude root@177.7.32.128 \
  "cd /opt/d4jsp && git fetch origin main && git reset --hard origin/main && \
   npm run build && pm2 reload d4jsp"
```

Verify: `pm2 status d4jsp` shows `online`, `curl -I https://trade.d4jsp.org/` returns 200. See [`./deploy.md`](./deploy.md).

## TLS

Certbot-managed Let's Encrypt cert. Auto-renew via systemd timer. See [`./dns-tls.md`](./dns-tls.md).

## Cron

No cron jobs as of 2026-04-26. `trigger-expiry-check` is admin-gated and not yet wired. See [`./scheduled-jobs.md`](./scheduled-jobs.md).

## Pending hardening (post-migration security pass)

- Disable `PasswordAuthentication` in `/etc/ssh/sshd_config`.
- Verify fail2ban active.
- Audit open ports.
- Verify `/opt/d4jsp` permissions.
- Confirm unattended-upgrades enabled.

## Related

- [`./kvm-2.md`](./kvm-2.md)
- [`./cloud.md`](./cloud.md)
- [`./deploy.md`](./deploy.md)
- [`./credentials.md`](./credentials.md)
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) findings H-1, H-2, M-6
