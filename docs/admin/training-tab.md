# Admin: Training tab

OCR training corpus + tooltip QA.

## Endpoints
- `POST /api/admin/training` — label OCR sample
- `POST /api/admin/training-crossref` — Wowhead/OCR cross-reference
- `POST /api/admin/tooltip-audit` — Wowhead tooltip QA pass
- `POST /api/admin/tooltip-training` — sample CRUD
- `POST /api/admin/tooltip-training-init` — one-time bootstrap

## Storage

`tooltip-training` Supabase Storage bucket (private). Schema seeded by [`../../migrations/025_tooltip_training.sql`](../../migrations/025_tooltip_training.sql).

## Workflow

User uploads sell-pipeline screenshots when training mode is on; admin reviews, labels correct item names, builds the training corpus for future model fine-tuning.

## Related

- [`../features/sell-pipeline.md`](../features/sell-pipeline.md)
- [`../endpoints/ocr.md`](../endpoints/ocr.md)
- [`../infra/kvm-2.md`](../infra/kvm-2.md)
