# Feature: Sanctuary Map (iframe)

Static Leaflet + Vite map of Sanctuary. Lives in the `D4JSP-Map` repo. Embedded as iframe inside the trade app's Profile tab (commit `520ab1b`).

## Stack

- Vite 5, Leaflet 1.9.4, Fuse.js 7.0.0
- No framework, no Supabase, no auth
- Tile data from SanctuaryMaps (`./tiles/Sanctuary/{z}/{x}/{y}.png`)

## Persistence

`localStorage` only. Build rotations persist per-device under key `d4jsp_builds`. **Not synced to Supabase.** Clearing browser data = builds lost. See [`../audits/2026-04-26.md`](../audits/2026-04-26.md) finding CS-5 — promote to `user_builds` table for parity with Build Planner.

## Files

[`../../../D4JSP-Map/src/main.js`](../../../D4JSP-Map/src/main.js) (entry), `layers.js`, `planner.js` (build rotation modal), `search.js`, `icons.js`.

## Deploy

`vite build` produces static output. Copied to KVM 4 nginx root. Iframed from trade app Profile tab — see [`../../components/ProfileView.js`](../../components/ProfileView.js).

## Related

- [`./build-planner.md`](./build-planner.md) — sibling app with similar permission gating (`d4_map_access`)
- [`../infra/connected-systems.md`](../infra/connected-systems.md)
