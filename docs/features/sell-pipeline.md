# Feature: Sell Pipeline (OCR → item match → BuyView pre-fill)

User taps "Sell Item" → file picker → screenshot → OCR on KVM 2 → DB match in `wowhead_tooltips` / `d4_equipment` → BuyView pre-filled with item + Wowhead tooltip → user submits → `threads` row created. Designed for ~3 seconds end-to-end on the happy path.

**Engine note:** the OCR engine is **RapidOCR** (`rapidocr_onnxruntime`). The trade-app route name `/api/paddle-ocr` is legacy from a prior PaddleOCR install; the route forwards to RapidOCR today. The leftover backup file on KVM 2 is `/opt/d4jsp-ocr/ocr_server.py.paddle_bak`. Renaming the route to `/api/ocr` is a future cleanup — flagged in [`../_doc-debt.md`](../_doc-debt.md).

## Service inventory

| Service | Where | Public port | Internal port | Supervisor | Workers | Role |
|---|---|---|---|---|---|---|
| `paddle-ocr` API proxy | Trade app on KVM 4 | n/a (Next.js route) | n/a | inside `d4jsp` PM2 | n/a | Receives base64 image from client, forwards to KVM 2 via `PADDLE_OCR_URL`, logs to `request_logs` |
| RapidOCR | KVM 2 `/opt/d4jsp-ocr/` | **9000** (nginx proxy) | **8000** (uvicorn bind) | **systemd** `d4jsp-ocr.service` | **uvicorn `--workers 3`**, each loads its own RapidOCR instance for true parallelism | OCR text extraction |
| Tooltip service | KVM 2 `/opt/d4jsp-tooltip/` | 3100 | 3100 | PM2 `d4jsp-tooltip` (fork mode, single instance) | n/a | Puppeteer + Wowhead → tooltip PNG into `tooltip-snapshots` Storage bucket |
| `wowhead_tooltips` table | Supabase | n/a | n/a | n/a | n/a | Cache of scraped Wowhead HTML keyed by `wowhead_id` and `name` |
| `d4_equipment` table | Supabase | n/a | n/a | n/a | n/a | Game item catalog (~3,393 items). Backs the OCR match step |

## OCR cluster details (KVM 2)

```
[ Client ] → trade.d4jsp.org/api/paddle-ocr (KVM 4)
                                           │ HTTP fetch, base64 image
                                           ▼
                       http://187.124.239.213:9000/ocr (KVM 2)
                                           │ nginx (`d4jsp-ocr` server block, /etc/nginx/conf.d/d4jsp-ocr.conf)
                                           ▼
                              uvicorn 0.0.0.0:8000  ← systemd-managed
                              ├── worker 1  (own RapidOCR instance, ~150 MB RSS)
                              ├── worker 2  (own RapidOCR instance, ~150 MB RSS)
                              └── worker 3  (own RapidOCR instance, ~150 MB RSS)
```

- **systemd unit:** `/etc/systemd/system/d4jsp-ocr.service`. `Restart=always RestartSec=10`. `MemoryMax=4G MemoryHigh=3.5G CPUQuota=180%`.
- **Manage:** `systemctl status d4jsp-ocr`, `systemctl restart d4jsp-ocr`, `journalctl -u d4jsp-ocr -f`.
- **Health probe:** `curl http://localhost:9000/health` returns `{"status":"ok","engine":"rapidocr"}`.
- **CORS:** `allow_origins=["*"]` (wide open in `ocr_server.py`). Acceptable since the public port is admin-IP-blocked at nginx (verify) and the route requires no auth today.
- **Backups on box:** `ocr_server.py.bak.pre-cluster.<unix-ts>` (pre-cluster setup), `ocr_server.py.bak.pre-port-fix`, `ocr_server.py.paddle_bak` (PaddleOCR-era).

## Pipeline trace (file:line refs)

### 1. Frontend trigger — Sell Item button
[`../../components/AppShell.js`](../../components/AppShell.js) Sell Item FAB. On click → `sellFileInputRef.current.click()` opens the OS file picker.

### 2. Capture path — file upload only
[`../../components/AppShell.js`](../../components/AppShell.js) `handleSellFileChange(e)`. Reads `File`, sets `sellOcrLoading=true`, opens the overlay spinner, calls `_resizeImageForOCR()`. No clipboard / paste flow today.

### 3. `_resizeImageForOCR()` (canvas resize)
Downscales to ≤1200 px wide via canvas. ~50–500 ms. 3-second canvas-fallback timeout for huge images.

### 4. `_doOcrFetch()` (POST to `/api/paddle-ocr`)
- Body: `{ image: <base64>, confidence_threshold: 0.5 }`.
- Client: 20s `Promise.race` + 22s `AbortController`. Reduced from 60s once the server-side blocking issue was fixed (see "Recent fixes" below).
- AbortError handling: explicit retry exclusion so a 20s abort doesn't silently double-wait to 40s.

### 5. `/api/paddle-ocr` (server-side proxy)
[`../../pages/api/paddle-ocr.js`](../../pages/api/paddle-ocr.js).
- **No auth check** ([finding M-9](../audits/2026-04-26.md)). Anonymous client can POST and force OCR work on KVM 2. Add Bearer-token check.
- Body limit: 10 MB.
- Forwards to `${PADDLE_OCR_URL}=http://187.124.239.213:9000/ocr` with a 55s server-side `AbortController` safety net.
- Logs to `request_logs` (route, status, duration_ms, error_message).

### 6. KVM 2 RapidOCR (port 9000 → 8000)
- nginx receives at `:9000`, proxies to uvicorn at `127.0.0.1:8000`.
- uvicorn 3 workers (each is its own Python process via `multiprocessing.spawn`). Each worker loads its own RapidOCR instance at start (about 150 MB RSS per worker for the ONNX model).
- ONNX Runtime inference is offloaded to a `ThreadPoolExecutor` so the asyncio event loop stays unblocked. Earlier versions ran sync `engine(img)` inside `async def` and blocked the loop, queueing all subsequent requests for 1–10 s each. Fix: `loop.run_in_executor(_ocr_executor, engine, img)` + `asyncio.wait_for(timeout=30.0)`.
- Per-call latency: 500 ms – 2 s on KVM 2 CPU (no GPU).
- Returns: `{ result: [...lines + bounding boxes...], elapse: <seconds>, full_lines: [...] }`. Confidence-filtered to ≥0.5.

### 7. `paddleRes.json()` body parse
30 s `Promise.race` body-read guard in `_doOcrFetch`. Closes the gap where a TCP-frozen response would otherwise hang the whole pipeline.

### 8. `_extractItemName()` (name parse)
Sync regex parse of OCR text array → item name string. <1 ms. Joins lines, applies `SKIP_PAT` (regex preserved across both AppShell and D4Tooltip — `legendary\b`, `unique\b`, etc.) to drop power lines that aren't names.

### 9. `_findItemInDB()` (Supabase match)
**Query order matters** (commit `3212b67` reordered for the upload-hang fix):
| Step | Tables queried | Strategy | Latency |
|---|---|---|---|
| 1 | `wowhead_tooltips`, `d4_equipment` | `ILIKE name=<rawName>` (exact) | <50 ms |
| 2 | same | `ILIKE name LIKE %<part>%` (contains) | ~100 ms |
| 3 | same | `ILIKE name LIKE <part>%` (prefix) | ~100 ms |
| 4 (last resort) | same | up to 20 sequential `%word%` queries (fulltext) | 0.5–2 s per query |
| 5 | same | fuzzy Levenshtein | last fallback |

Step 1 hits 99% of items. Step 4 fulltext was step 0 originally — running it first caused the 10–40 s upload-hang bug (one full-table scan per word). DON'T reorder without re-testing.

Returns `{ id, name, wowhead_id, item_type, rarity, stats, affixes, tooltipHtml, ... }`.

### 10. Tooltip rendering
- If `wowhead_tooltips.tooltip_html` is cached → use directly.
- If missing → trigger `POST /api/tooltip-snapshot { wowheadUrl }` ([`../../pages/api/tooltip-snapshot.js`](../../pages/api/tooltip-snapshot.js)) → KVM 2 `:3100` Puppeteer renders Wowhead, screenshots the tooltip frame, uploads PNG to `tooltip-snapshots` Storage bucket.
- HTML cached in `wowhead_tooltips.tooltip_html` for next time.

### 11. User-stat injection
Before opening BuyView, `userStats = { xp, rank, tier, sales, ... }` is grafted onto `itemData`. The D4Tooltip component overlays the seller's live stats (rank, XP, FG balance, sales count) on the tooltip card.

### 12. `setSellPrefillItem(itemData)` + `setSellMode('sell')`
BuyView opens with the matched item pre-populated. Fields filled from OCR/DB:
- `title`, `category`, `mode` (realm), `action_type`
- `item_data.name`, `item_data.tooltipHtml`, `item_data.stats[]`, `item_data.affixes[]`, `item_data.uniquePower`, `item_data.rarity`, `item_data.itemLevel`, `item_data.userStats`
- `image_url` (uploaded screenshot)

User fills `price`, optionally edits stats, hits Submit → `POST /api/create-thread` → `threads` row created. See [`./escrow.md`](./escrow.md) for what happens when a buyer accepts.

## Failure modes

| Symptom | Cause | What user sees |
|---|---|---|
| OCR returns no text | Bad screenshot quality, occluded item card | Error overlay: "Couldn't read item. Type the name?" Fallback to manual typing flow. |
| OCR returns text but no DB match | Item not in `wowhead_tooltips`/`d4_equipment`; new patch added affixes | Type Manually fallback. Adam later re-runs `validate-ocr-names.js` to find missing items + adds via `/api/admin/training`. |
| KVM 2 `:9000` returns 5xx | nginx down OR uvicorn cluster crashed | 502 from `/api/paddle-ocr`. User sees error overlay after ~22 s. SSH KVM 2 → `systemctl status d4jsp-ocr` + `journalctl -u d4jsp-ocr -n 50`. |
| RapidOCR worker OOM | Image too large pre-resize OR memory limit hit (`MemoryMax=4G`) | systemd auto-restarts (`Restart=always`, 10s delay). Single user-facing failure during the restart window. |
| KVM 2 unreachable | KVM 2 down, network blip | Same as above (502). |
| Image too large (>10 MB body) | Phone screenshot full-res, resize step skipped | `/api/paddle-ocr` returns 413 / parse fail. Hard fail. |
| Wrong format (not image/*) | User picked a PDF / video | Browser file-picker `accept="image/*"` filters. If something slips: canvas resize fails, error overlay. |
| 90 s wall-clock fires | Anything stuck after retries | `sellMode='error'` set. `sellCancelledRef` guard prevents stale `setSellMode('sell')` from overwriting after the wall-clock fires. Acceptable per CLAUDE.md hard rule #2 (last-resort UI safety net). |

## Operational

### Where things run
- `paddle-ocr` API route: trade app on KVM 4. Logs via `pm2 logs d4jsp`.
- RapidOCR on KVM 2: systemd unit `d4jsp-ocr.service`. Logs: `journalctl -u d4jsp-ocr [-f]`. Manage: `systemctl {status,restart,reload} d4jsp-ocr`.
- Tooltip service on KVM 2: PM2 `d4jsp-tooltip` (fork mode). Logs: `pm2 logs d4jsp-tooltip`. Don't block `font` resource in Puppeteer; `await document.fonts.ready` before screenshot.

### Env vars (trade app side)
- `PADDLE_OCR_URL=http://187.124.239.213:9000/ocr`
- `VPS_TOOLTIP_URL=http://187.124.239.213:3100`

### Updating the matching corpus when a new D4 patch ships
1. New item names / affixes from Blizzard.
2. Run `scripts/validate-ocr-names.js` against a sample set; flags items that fail to match.
3. Manually populate via Wowhead → `/api/fetch-item-template` to write `d4_equipment` + `d4_tooltips` + `d4_search_index`.
4. Or seed via `/api/admin/training` for OCR labels.

### RLS gotcha
`d4_items`, `d4_tooltips`, `d4_search_index` have **permissive RLS** (anyone authenticated can write). Intentional — the OCR pipeline writes from API routes that need it. **Don't tighten** without re-testing every OCR write path. See findings W-10/W-11/W-12 in [`../audits/2026-04-26.md`](../audits/2026-04-26.md).

### Rate limiting
**None today on `/api/paddle-ocr`** ([finding M-9](../audits/2026-04-26.md)). Anyone can DoS the KVM 2 OCR by spamming 10 MB images. Add Bearer-token auth + per-user-per-minute quota.

## Recent fixes

- `3212b67` — reorder `_findItemInDB`: exact-match step 1, fulltext last. Fixes the 10–40 s upload-hang.
- `5f30ffd` — `sellCancelledRef` guard prevents error→sell mode flip when the 90 s wall-clock fires.
- `4bb24ad` — SKIP_PAT regex preserved across OCR + AppShell + D4Tooltip.
- `ocr_server.py run_in_executor` + `asyncio.wait_for(30s)` — moves ONNX inference off the event loop.
- `_doOcrFetch` AbortError retry fix — explicit `err.name === 'AbortError'` check excludes timeouts from retry, prevents 20 s → 40 s doubling.
- Cluster setup (`pre-cluster.bak`) — moved from a single uvicorn worker to 3 systemd-managed workers for true parallelism on multi-core KVM 2.

## Future cleanup

- Rename `/api/paddle-ocr` → `/api/ocr` to match the actual engine. Frontend (`AppShell.js _doOcrFetch`) needs an updated URL too. Logged in [`../_doc-debt.md`](../_doc-debt.md) under "future renames".
- Remove `ocr_server.py.paddle_bak` and other `.bak` files from `/opt/d4jsp-ocr/` (preserved historically; not needed for runtime).

## Related

- [`../endpoints/ocr.md`](../endpoints/ocr.md) — full route inventory
- [`../infra/kvm-2.md`](../infra/kvm-2.md) — RapidOCR + Tooltip deploy details
- [`../integrations/wowhead.md`](../integrations/wowhead.md) — tooltip scrape pipeline
- [`../data-model/threads.md`](../data-model/threads.md) — what fields get filled from OCR
- [`../sitemap.md`](../sitemap.md) — UI flows
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) — findings M-9 (no auth on paddle-ocr), W-10/11/12 (permissive RLS on d4_*)
