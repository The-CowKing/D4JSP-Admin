# Inbox

Unprocessed asks Adam fires off when he notices something but isn't ready to commission a fix yet. Append-only. The orchestrator triages from here into `_batch-log.md` (single asks) or batched patches (3+ related items).

## Format

One line per ask:
```
- YYYY-MM-DD HH:MM — [who] verbatim ask or short paraphrase
```

Keep it terse. Anything that needs more context goes straight into `_batch-log.md` instead.

## Inbox (unprocessed)

*(empty)*

## How the orchestrator processes the inbox

- **Single ask** that fits one feature/endpoint → open a `_batch-log.md` entry, prime an executor, ship. Drop the inbox line.
- **3+ related items** in the same area (UI page, catalog, infra surface) → propose to Adam: "Inbox has N <area> fixes. Batch them?" On confirmation, drop all from inbox, open one `_batch-log.md` entry for the patch, prime one executor with all of them.
- **Heuristic for grouping** (also in [`./conventions.md`](./conventions.md)):
  - Same UI page or component
  - Same catalog or endpoint family
  - Same infra surface
  - Otherwise default to one-ask-per-patch
- **Stale inbox items** (>3 days, no follow-up) → move to a dated section at the bottom and re-surface to Adam before deleting.

## See also

- [`./_batch-log.md`](./_batch-log.md) — the active QA + commit ledger
- [`./_doc-debt.md`](./_doc-debt.md) — debt to clear before declaring done
- [`./conventions.md`](./conventions.md) — full protocols
