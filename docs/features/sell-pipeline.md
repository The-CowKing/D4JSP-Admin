# Feature: Sell Pipeline (OCR-driven)

User taps "Sell Item" → file picker → screenshot → OCR (KVM 2 RapidOCR) → DB match → BuyView pre-filled. Designed to take ~3 seconds end-to-end on the happy path.

## UI

- **Entry point:** "Sell Item" FAB in [`../../components/AppShell.js`](../../components/AppShell.js).
- **Handler:** `handleSellFileChange` in AppShell.js. Sets `sellOcrLoading=true`, opens an overlay spinner.
- **Overlay states:** loading / sell (BuyView pre-filled) / error.
- **Wall-clock safety net:** 90s `setTimeout` flips to error state if pipeline hangs. Acceptable per CLAUDE.md hard rule #2 (last-resort UI safety net only).

## Pipeline stages

```
1. _resizeImageForOCR()       Canvas resize ≤1200px wide, ~0.5s
2. _doOcrFetch()              POST to /api/paddle-ocr (20s timeout)
3. paddleRes.json()           Body parse (30s race guard)
4. _extractItemName()         Regex parse OCR text → name string (<1ms)
5. _findItemInDB()            Supabase queries on wowhead_tooltips / d4_equipment
6. setSellPrefillItem(...)
7. setSellMode('sell')        BuyView opens
```

## OCR service

KVM 2, port 9000. FastAPI + RapidOCR + ONNX Runtime. 3 uvicorn workers. The OCR call itself is offloaded to a `ThreadPoolExecutor` so the asyncio event loop stays unblocked during ONNX inference. See [`../infra/kvm-2.md`](../infra/kvm-2.md).

## Server-side proxy

`pages/api/paddle-ocr.js` proxies the base64 image to KVM 2:9000. **No auth check** (finding M-9). 55s server-side `AbortController` timeout. Logs every call to `request_logs`.

## DB match

`_findItemInDB()` queries:
1. **Step 1 (fast path):** exact `ILIKE` on `wowhead_tooltips.name` and `d4_equipment.name`. <50ms.
2. **Step 2:** contains match.
3. **Step 3:** prefix match.
4. **Step 4 (fulltext, last resort):** broad ILIKE — slow without trigram indexes.
5. **Step 5:** fuzzy Levenshtein.

Order matters. Reordering broke the pipeline once (commit `3212b67`); fast path must come first.

## RLS gotcha

`d4_items`, `d4_tooltips`, `d4_search_index` have permissive RLS (anyone authenticated can write). **Don't tighten** without re-testing the entire OCR pipeline — see [`../audits/2026-04-26.md`](../audits/2026-04-26.md) findings W-10/11/12.

## Stat injection

When an item is matched, `userStats` (rank, XP, FG, sales) is grafted onto `itemData` for D4Tooltip rendering. The tooltip shows the seller's live stats overlaid on the item card.

## Recent fixes

- `3212b67` — reorder `_findItemInDB`: exact-match step 1, fulltext last. Fixes the upload-hang bug. Detail in `docs/audits/2026-04-26.md` historical Section 1.
- `5f30ffd` — `sellCancelledRef` guard prevents error→sell mode flip when wall-clock fires.
- `ocr_server.py run_in_executor` — ONNX inference offloaded to thread pool to keep event loop unblocked.
- `4bb24ad` — SKIP_PAT regex preserved across OCR + AppShell.

## Related

- [`../infra/kvm-2.md`](../infra/kvm-2.md) — OCR service deploy + tuning
- [`../endpoints/ocr.md`](../endpoints/ocr.md) — `/api/paddle-ocr`, `/api/item-search`, `/api/item-lookup`
- [`../integrations/wowhead.md`](../integrations/wowhead.md) — tooltip scrape
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) findings W-10/11/12, M-9
