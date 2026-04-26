# Infra: KVM 2 (admin + OCR + tooltip host)

Hostinger VPS. Runs the admin app and two helper services consumed by the trade app.

## Identity

- **IP:** `187.124.239.213` (`srv1517775`)
- **OS:** AlmaLinux
- **SSH:** `ssh -i C:/Users/Owner/Desktop/keyz/d4jsp_kvm2_claude root@187.124.239.213`
- **Auth:** dedicated key only (`d4jsp_kvm2_claude`); shared key removed.

## Services

### `/opt/d4jsp-admin` — admin Next.js app
- PM2 `d4jsp-admin`, port 3001, bound to `127.0.0.1` per [`../../ecosystem.config.js`](../../ecosystem.config.js).
- basePath `/admin-panel`; reached via KVM 4 nginx proxy at `https://trade.d4jsp.org/admin-panel/*`.
- **Code is edited in-place on this box** — the [`D4JSP-Admin`](https://github.com/The-CowKing/D4JSP-Admin) GitHub repo is STALE (finding A-1 / CS-2). No version control.
- Deploy: `cd /opt/d4jsp-admin && npm run build && pm2 restart d4jsp-admin`.

### `/opt/d4jsp-ocr` — RapidOCR FastAPI
- Port 9000. uvicorn 3 workers.
- Consumed by trade app via `PADDLE_OCR_URL` env (`/api/paddle-ocr` proxies here).
- ONNX Runtime inference — offloaded to ThreadPoolExecutor so the asyncio event loop stays unblocked.

### `/opt/d4jsp-tooltip` — Puppeteer Wowhead screenshot
- PM2 `d4jsp-tooltip`, port 3100.
- Consumed by trade app via `VPS_TOOLTIP_URL`. Generates tooltip PNGs into `tooltip-snapshots` Storage bucket.
- Don't block `font` resource in Puppeteer — `await document.fonts.ready` before screenshot.

## Env

`/opt/d4jsp-{ocr,tooltip,admin}/.env` per service. `SUPABASE_SERVICE_ROLE_KEY` (or legacy alias `SUPABASE_SERVICE_KEY` for OCR/tooltip), `SITE_CSS_URL`, `SITE_ORIGIN`. See [`./credentials.md`](./credentials.md).

## Deploy

Per service:
```bash
# Admin
cd /opt/d4jsp-admin && npm run build && pm2 restart d4jsp-admin

# OCR
cd /opt/d4jsp-ocr && systemctl restart d4jsp-ocr  # if systemd-managed
# or pm2 restart d4jsp-ocr

# Tooltip
cd /opt/d4jsp-tooltip && pm2 restart d4jsp-tooltip
```

## Logs

`pm2 logs d4jsp-admin`, `pm2 logs d4jsp-tooltip`. OCR logs depend on its supervisor.

## Related

- [`./kvm-4.md`](./kvm-4.md)
- [`./deploy.md`](./deploy.md)
- [`../features/sell-pipeline.md`](../features/sell-pipeline.md)
- [`../endpoints/ocr.md`](../endpoints/ocr.md)
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) finding A-1
