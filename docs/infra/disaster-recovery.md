# Infra: Disaster Recovery

Restore runbook for the trade system. Pre-launch — refine after first incident.

## Code

Git is canonical. Push to `main` = backed up. To restore from a wipe:
1. `git clone https://github.com/The-CowKing/D4JSP.git /opt/d4jsp`
2. Restore `.env` from 1Password / `keyz/` snapshot.
3. `npm install && npm run build && pm2 start ecosystem.config.js --env production`.

For sibling repos (admin, build planner, map): same pattern, but admin code is currently edited in-place on KVM 2 and the GitHub repo is stale (CS-2). Mirror `/opt/d4jsp-admin` to D4JSP-Admin GitHub before relying on git for restore.

## Database (Supabase)

- **Daily backups:** automatic on Pro plan. Restore via Supabase dashboard → Database → Backups.
- **Point-in-time restore:** dashboard supports rolling back to any point in the last 7 days.
- **Schema as code:** [`../../migrations/`](../../migrations/) is incomplete (9 missing files — finding H-9). Until baseline dump lands, treat the dashboard as canonical.
- **Restore procedure:**
  1. Dashboard → Backups → choose restore point.
  2. Apply (warning: overwrites current data).
  3. Verify with `SELECT * FROM users LIMIT 5` etc.

## Storage

`avatars`, `assets`, `tooltip-snapshots`, `tooltip-training` buckets. Not reproducible from code. If lost:
1. `tooltip-snapshots` rebuilds from KVM 2 Puppeteer service when threads are viewed.
2. `avatars` users re-upload on next profile edit.
3. `assets` (item images) rebuild from `wowhead_tooltips` cache + KVM 2.
4. `tooltip-training` is OCR training set; small, manually re-collectible.

## Secrets

- **1Password** is canonical.
- **`keyz/`** is the local plaintext mirror.
- If both are lost: re-issue every secret from each provider. SSH keys can be regenerated and reauthorized via Hostinger panel browser SSH terminal.

## VPS state

- **KVM 4 / KVM 2:** Hostinger snapshot capability in hPanel. Take snapshots before risky changes.
- **`authorized_keys` backup** — every rotation leaves `~/.ssh/authorized_keys.bak.<unix-ts>` (mode 600).

## Cloud (WordPress)

- WP edits are NOT in git. Backups must come from Hostinger Cloud snapshots OR `wp db export` runs.
- `.bak.<unix-ts>` files alongside every PHP edit on production.
- For full restore: Hostinger panel → Backups → restore.

## Stripe / Resend / Battle.net

- API keys at provider; can't be retrieved, only re-issued.
- `transactions` table is the FG-purchase ledger; even if Stripe history is lost, our DB has the record.

## Re-deploy from scratch

If KVM 4 is wiped:
1. Provision new VPS (Hostinger panel).
2. Restore SSH key authorization.
3. Install Node.js LTS, PM2, nginx.
4. `git clone D4JSP /opt/d4jsp`.
5. Set `/opt/d4jsp/.env` from 1Password / `keyz/`.
6. `npm install && npm run build`.
7. `pm2 start ecosystem.config.js --env production`.
8. Configure nginx (TLS, `/admin-panel/*` → KVM 2:3001).
9. Update DNS A record at GoDaddy → new IP.

## Related

- [`./kvm-4.md`](./kvm-4.md) · [`./kvm-2.md`](./kvm-2.md) · [`./cloud.md`](./cloud.md)
- [`./credentials.md`](./credentials.md) · [`./credential-rotation.md`](./credential-rotation.md)
- [`./supabase.md`](./supabase.md)
