# Infra: Deploy

Hostinger does NOT auto-deploy from main. All deploys are manual SSH.

## Trade app (KVM 4)

```bash
# 1. Push to main
PAT=$(cat "C:/Users/Owner/Desktop/keyz/github-pat.txt" | tr -d '\r\n')
ORIGIN=$(git remote get-url origin)
git push "https://x-access-token:${PAT}@${ORIGIN#https://}" HEAD:main
unset PAT

# 2. SSH + pull + build + reload
ssh -i C:/Users/Owner/Desktop/keyz/d4jsp_kvm4_claude root@177.7.32.128 \
  "cd /opt/d4jsp && git fetch origin main && git reset --hard origin/main && \
   npm run build && pm2 reload d4jsp"

# 3. Verify
ssh ... "pm2 status d4jsp && curl -s -o /dev/null -w '%{http_code}' https://trade.d4jsp.org/"
# expect: status 'online' AND HTTP '200'
```

## Admin app (KVM 2)

Code is currently edited in-place on KVM 2 (`D4JSP-Admin` GitHub repo is stale). To push from local repo + redeploy:

```bash
# Mirror local to KVM 2 (scp or rsync)
scp -i .../d4jsp_kvm2_claude -r ./components ./pages ./lib root@187.124.239.213:/opt/d4jsp-admin/

# Build + restart
ssh -i .../d4jsp_kvm2_claude root@187.124.239.213 \
  "cd /opt/d4jsp-admin && npm run build && pm2 restart d4jsp-admin"
```

To re-establish the GitHub repo as source of truth: see CS-2 in [`../audits/2026-04-26.md`](../audits/2026-04-26.md).

## Build Planner (static export)

```bash
cd C:/Users/Owner/D4JSP-Build-Planner
npm run build  # produces out/
scp -r -i .../d4jsp_kvm4_claude out/* root@177.7.32.128:/var/www/builder/
```

## Map app (static)

```bash
cd C:/Users/Owner/D4JSP-Map
npm run build  # produces dist/
scp -r -i .../d4jsp_kvm4_claude dist/* root@177.7.32.128:/var/www/map/
```

## WP edits (Cloud)

In-place. NOT in git. After every PHP edit:
- Backup: `cp <file> <file>.bak.$(date +%s)`.
- `touch <file>` to bump OPcache mtime.
- `wp litespeed-purge all --url=<site>`.
- Curl-verify with cache-bust: `curl -H 'Cache-Control: no-cache' https://<domain>/`.

## Sandbox SSH gotcha

If running from a network-restricted dispatch sandbox (Cowork's environment), use the [`./deploy-bat-pattern.md`](./deploy-bat-pattern.md) workaround. From this Claude Code session on Adam's host, direct SSH works (keys mounted in `keyz/`).

## Verify deploy landed

| Check | Command |
|---|---|
| PM2 status | `pm2 status` (KVM 4) |
| HTTP 200 | `curl -I https://trade.d4jsp.org/` |
| Latest SHA | `ssh ... "cd /opt/d4jsp && git rev-parse HEAD"` should match `git log -1 --format=%H` locally |
| Build version | `curl https://trade.d4jsp.org/api/health` shows `git_sha` (currently `unknown` — finding L-10) |

## Related

- [`./deploy-bat-pattern.md`](./deploy-bat-pattern.md)
- [`./credentials.md`](./credentials.md)
- [`./kvm-4.md`](./kvm-4.md)
- [`./kvm-2.md`](./kvm-2.md)
- [`./cloud.md`](./cloud.md)
