# Infra: Connected Systems

How the 4 trade-system apps + Supabase + Stripe + KVM 2 helper services + WordPress federation talk to each other.

## ASCII map

```
                                                 ┌──────────────────────┐
                                                 │ Supabase             │
                                                 │  isjkdbmfxpxuuloqosib│
                                                 │  Postgres + Auth +   │
                                                 │  Realtime + Storage  │
                                                 └─────────┬────────────┘
                                                           │
                                                           │ all 4 apps
                                                           │
   ┌────────────────────┐   nginx /admin-panel/* proxy   │
   │ TRADE APP (D4JSP)  │ ──────────▶ ┌─────────────────┐│       ┌─────────────────────┐
   │ Next.js 15.3.3     │             │ ADMIN APP       ││       │ MAP APP             │
   │ KVM 4 :3000        │ ◀─/api/*─── │ D4JSP-Admin     │┘       │ D4JSP-Map           │
   │ THE BACKEND        │  rewrite    │ Next.js 15      │        │ Vite + Leaflet      │
   │ for ALL admin/     │  (admin     │ KVM 2 :3001     │        │ no auth, localStore │
   │ builder/map writes │  app has    │ basePath        │        │ iframed in Profile  │
   └─┬───────────┬──────┘  0 own API  │ /admin-panel    │        └─────────────────────┘
     │           │         routes)   └─────────────────┘
     │           │
     │           │   ┌──────────────────┐
     │           └──▶│ BUILD PLANNER    │ uses /api/save-build on TRADE
     │               │ D4JSP-Build-     │ Tier-gated via
     │               │  Planner         │ admin_permissions catalog
     │               │ Next.js 14       │
     │               │ static export    │
     │               │ basePath /builder│
     │               └──────────────────┘
     │
     │  ┌──────────────────┐
     └─▶│ KVM 2 OCR :9000  │ /api/paddle-ocr proxy
        │ + Tooltip :3100  │ /api/tooltip-snapshot proxy
        └──────────────────┘

WordPress federation (Cloud) — d4jsp-supabase-auth WP plugin reads .d4jsp.org
cookie. Embeds /widget/latest-trades via iframe. NOT YET INDEXED.
```

## Edge contracts

| Edge | Mechanism | What crosses |
|---|---|---|
| Trade ↔ Supabase | `@supabase/supabase-js` 2.100, anon (client), service-role (server) | All catalogs, users, threads, ledger, realtime |
| Trade ↔ KVM 2 OCR | HTTP fetch (`PADDLE_OCR_URL`) | Base64 image → OCR text array |
| Trade ↔ KVM 2 Tooltip | HTTP fetch (`VPS_TOOLTIP_URL`) | Wowhead URL → screenshot PNG → Storage |
| Trade ↔ Admin app | nginx → KVM 2:3001 (rewrites in [`../../next.config.js`](../../next.config.js)) | HTML pages + assets at `/admin-panel/*` |
| Admin ↔ Trade | Reverse rewrites (`D4JSP-Admin/next.config.js`): `/api/*` → `${TRADE_URL}/api/*` | All admin API calls go BACK to trade app |
| Admin ↔ Supabase | Anon-client login + JWT only | Auth session |
| Build Planner ↔ Supabase | Anon-client + `supabaseAuthed(token)` | Reads `wowhead_tooltips`, writes `user_builds` via trade app |
| Build Planner ↔ Trade | Embedded at `/builder` (static export). Tier-gated. | Permission via `admin_permissions.d4_build_slots` |
| Map ↔ * | None (static + localStorage) | None |
| Trade cookie ↔ Admin cookie ↔ WP plugin | `.d4jsp.org` + `d4jsp_auth` | Single sign-on |

## Rules of engagement

1. All 4 apps point at one Supabase project. Don't fork.
2. Auth is the cross-domain cookie chain. Touching `lib/supabase.js` cookie storage needs synchronized updates across trade, admin, and Build Planner.
3. Admin code is currently edited in-place on KVM 2 (GitHub repo stale). Mirror back when re-establishing.
4. Build Planner is the model citizen for catalog protocol. Copy [`../../../D4JSP-Build-Planner/migrations/002_build_planner_permissions.sql`](../../../D4JSP-Build-Planner/migrations/002_build_planner_permissions.sql) when adding new permissions.
5. Map is iframed. Don't add Supabase calls; if you need persistence, fetch the trade app.

## Related

- [`./kvm-4.md`](./kvm-4.md) · [`./kvm-2.md`](./kvm-2.md) · [`./cloud.md`](./cloud.md) · [`./supabase.md`](./supabase.md)
- [`../auth/cross-domain-cookies.md`](../auth/cross-domain-cookies.md)
