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

### `/opt/d4jsp-ocr` — RapidOCR FastAPI cluster
- **Engine:** RapidOCR (`rapidocr_onnxruntime`). NOT PaddleOCR despite the trade-app route name `/api/paddle-ocr` (legacy from a prior PaddleOCR install — `ocr_server.py.paddle_bak` is on the box).
- **Public port:** 9000 (nginx proxy block in `/etc/nginx/conf.d/d4jsp-ocr.conf`).
- **Internal port:** 8000 (uvicorn bind).
- **Supervisor:** **systemd**, NOT PM2. Unit file: `/etc/systemd/system/d4jsp-ocr.service`.
- **Cluster:** uvicorn `--workers 3`. Each worker is its own Python process (via `multiprocessing.spawn`) and loads its own RapidOCR instance for true CPU parallelism. ~150 MB RSS per worker for the ONNX model.
- **Resource limits:** `MemoryMax=4G MemoryHigh=3.5G CPUQuota=180%`.
- **Restart policy:** `Restart=always RestartSec=10`. systemd auto-restarts on OOM kill.
- **Health probe:** `curl http://localhost:9000/health` → `{"status":"ok","engine":"rapidocr"}`.
- **Manage:** `systemctl {status,restart,reload} d4jsp-ocr`. Logs: `journalctl -u d4jsp-ocr [-f]`.
- **Source:** `/opt/d4jsp-ocr/ocr_server.py`. Python venv at `/opt/d4jsp-ocr/venv/`. Backups: `ocr_server.py.bak.pre-cluster.<unix-ts>`, `ocr_server.py.bak.pre-port-fix`, `ocr_server.py.paddle_bak`.
- **Inference:** ONNX Runtime offloaded to a `ThreadPoolExecutor` so the asyncio event loop stays unblocked. Earlier sync `engine(img)` blocked the loop and queued requests for 1–10 s each.
- **CORS:** `allow_origins=["*"]` in `ocr_server.py`. Wide open; relies on the upstream `/api/paddle-ocr` proxy gating.

### `/opt/d4jsp-tooltip` — Puppeteer Wowhead screenshot
- PM2 `d4jsp-tooltip`, **fork mode** (single instance, NOT cluster). Port 3100.
- Consumed by trade app via `VPS_TOOLTIP_URL`. Generates tooltip PNGs into `tooltip-snapshots` Storage bucket.
- Env (legacy alias): `SUPABASE_SERVICE_KEY` (older form of `SUPABASE_SERVICE_ROLE_KEY`), `SITE_CSS_URL`, `SITE_ORIGIN`.
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
