# D4JSP-Admin

Admin console for the D4JSP trade system. Security-isolated — runs on KVM 2 :3001 (bound to localhost), surfaced at `https://trade.d4jsp.org/admin-panel/*` via the D4JSP nginx proxy.

**Read [`start.md`](./start.md) first.** Everything else is reachable from there.

This repo has zero of its own API routes — every admin mutation calls back to the D4JSP backend via `next.config.js` rewrites.

## See also

- [`start.md`](./start.md) — single front door
- [`docs/`](./docs/) — full wiki (identical structure to D4JSP)
- [`docs/admin/overview.md`](./docs/admin/overview.md) — this app's architecture
