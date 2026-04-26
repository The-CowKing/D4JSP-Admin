# Endpoints: OCR sell pipeline

Routes that proxy to KVM 2 OCR + match items in the local DB.

## Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/paddle-ocr` | POST | **none (finding M-9)** | Proxies base64 image to KVM 2:9000 RapidOCR. 55s server abort. 10MB body limit. Logs to `request_logs`. ([`../../pages/api/paddle-ocr.js`](../../pages/api/paddle-ocr.js)) |
| `/api/item-search` | GET/POST | Bearer JWT | Searches `d4_search_index`. Fuzzy match. |
| `/api/item-lookup` | POST | Bearer JWT | Detailed item lookup, populates `d4_items` + `d4_search_index` on cache miss. |
| `/api/identify-item` | POST | Bearer JWT | Alternative item-name resolver (gemini-style; currently unused — see history). |
| `/api/fetch-item-template` | POST | none | Fetches Wowhead template, populates `d4_items` + `d4_tooltips`. |
| `/api/tooltip-snapshot` | POST | none | Triggers Puppeteer screenshot of a Wowhead tooltip on KVM 2:3100. |

## Authentication gap

`/api/paddle-ocr` has no auth. Anyone can POST arbitrary 10 MB images and force real OCR work on KVM 2 (3-worker uvicorn). Fix: require Bearer token.

## Related

- [`../features/sell-pipeline.md`](../features/sell-pipeline.md)
- [`../infra/kvm-2.md`](../infra/kvm-2.md)
- [`../integrations/wowhead.md`](../integrations/wowhead.md)
