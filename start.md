# D4JSP — start.md

This file is the front door. Read it top-to-bottom on a fresh session, then follow the links into `docs/` for anything you need to touch. **The wiki IS the audit — every push keeps it current via the doc-debt protocol below.** If a fact in here disagrees with the code, the code is right and the doc is a bug — fix it.

This file is identical across all 4 trade-system repos. Only the **You are in** block at the top differs.

---

## You are in: `D4JSP` — Main Core / Trade Backend

**The backend for everything.** Every API route in the trade system lives here; every other app calls back to these routes.

- **Path:** `C:\Users\Owner\D4JSP`
- **Stack:** Next.js 15.3.3 + custom `server.js`, Supabase JS 2.100, ~22k LOC components, **92 API routes**
- **Deployed:** KVM 4 `/opt/d4jsp`, PM2 `d4jsp` cluster, port 3000 → `https://trade.d4jsp.org`
- **Key entry files:** [`components/AppShell.js`](./components/AppShell.js) · [`components/HomeView.js`](./components/HomeView.js) · [`lib/supabase.js`](./lib/supabase.js) · [`lib/auth-context.js`](./lib/auth-context.js) · [`lib/triggerEngine.js`](./lib/triggerEngine.js) · [`lib/sysConfig.js`](./lib/sysConfig.js)
- **Sister repos** (each has identical start.md with their own "You are in" block): `C:\Users\Owner\D4JSP-Admin` (admin console), `C:\Users\Owner\D4JSP-Build-Planner` (`/builder`), `C:\Users\Owner\D4JSP-Map` (iframed in profile).
- **NOT in scope:** WordPress federation at `C:\Users\Owner\D4JSP-WP` — *touch it only when you need to.*

---

# § Protocols (read these first — they're the rules of engagement)

## ⚠ HARD RULE: Verified-working flip workflow — NEVER auto-flip

The "verified working" / "wired" / "green-lit" / "confirmed" switch on any catalog row (quests, triggers, specials, skills, badges, subscription tiers, fg_packages, etc.) is **flipped ONLY AFTER Adam confirms the feature works in production**.

- Bots NEVER flip this switch based on internal/programmatic verification alone — DB rows reading correctly, RPC firing, logs looking clean are all NECESSARY but NOT SUFFICIENT. The flip waits for Adam.
- This applies to ALL catalogs that have any verified / wired / connected / green-light / confirmed state. The existing badges in admin (the "NOT WIRED" / connected dots / verified flags shown in screenshots) are the SAME flag — there is exactly one source of truth per catalog row, do not invent new ones.
- The static `wired: 'red'/'yellow'/'green'` constants in `components/AdminView.js` (`QUEST_WIRED`, `REQUIREMENT_TYPES`, `REWARD_TYPES`, etc.) describe codebase capabilities — those follow the same rule: do not flip from red to green just because you shipped a fix. Wait for Adam to confirm the feature works in prod, then flip.

**Workflow:**
1. Bot ships fix → bot deploys to KVM 4 → bot reports "wired correctly per DB inspection; awaiting prod confirmation."
2. Adam tests in prod.
3. Adam confirms ("the spawn quest pays out FG now" / "kill quest works" / "reward landed").
4. **THEN** bot flips the switch — small separate commit (`verify(<scope>): flip switch on <id> after Adam's prod confirmation`). Push.

**Never bundle the flip with the fix.** Two commits — fix first, flip after confirmation. The audit trail must show that the flip was a deliberate post-confirmation action, not an automatic side-effect.

If you reach a verification step and are tempted to flip without explicit Adam confirmation, STOP and report instead. Adam: "I'll confirm it u flip em once we get to testing."

## Style + communication

- **Concise.** No walls of text. No fluff. No emoji. State the thing and move on.
- **Direct prose.** "X is Y", not "X might be considered Y." If you don't know, find out — don't hedge.
- **Plain English.** Talk like a peer engineer.
- **Single-purpose work.** One commit, one fix. Don't bundle.
- **Push when ready.** No permission asks for fixes. **Report SHA after every push.**
- **No yak-shaving.** Don't refactor adjacent code. Don't add features beyond ask. Don't write tests unless asked.
- **Auto mode is on.** Adam has authorized continuous, autonomous execution this session. Run, don't checkpoint.

## Batch protocols (when to bundle vs split)

- **Bundle:** when 5–10 small bugs land at once and they cluster by system (gem + ticker + WP gate = three patches not one). Track as numbered `Patch N` entries in [§ Recent state](#-recent-state).
- **Don't bundle:** bug fix + refactor, gem fix + audit, audit + doc consolidation. Each gets its own commit.
- **Don't change UI** unless the ask says UI. Preserve all existing visuals.

## Push / deploy protocols

- **Always push to `main`.** Worktree branches are invisible to deploy. After push: `git log -1 --format='%H'` → report.
- **Inline-PAT push pattern** (PAT never persisted to git config):
  ```bash
  PAT=$(cat "C:/Users/Owner/Desktop/keyz/github-pat.txt" | tr -d '\r\n')
  ORIGIN=$(git remote get-url origin)
  git push "https://x-access-token:${PAT}@${ORIGIN#https://}" HEAD:main
  unset PAT
  ```
- **Deploying the trade app to KVM 4** — Hostinger does NOT auto-deploy:
  ```bash
  ssh -i C:/Users/Owner/Desktop/keyz/d4jsp_kvm4_claude root@177.7.32.128 \
    "cd /opt/d4jsp && git fetch origin main && git reset --hard origin/main && \
     npm run build && pm2 reload d4jsp"
  ```
- **Verify deploy landed:** `ssh ... "pm2 status d4jsp && curl -s -o /dev/null -w '%{http_code}' https://trade.d4jsp.org/"`. Expect status `online` and HTTP `200`.
- **Deploying the admin app to KVM 2** — code is currently edited **in-place** on KVM 2 (`D4JSP-Admin` GitHub repo is stale). For now: `ssh ... "cd /opt/d4jsp-admin && npm run build && pm2 restart d4jsp-admin"`. To re-establish the repo as source of truth, see [`docs/infra/deploy.md`](./docs/infra/deploy.md).
- **WP edits (Cloud)** — edited in-place. After every PHP edit: `touch <file>` (bumps OPcache mtime), `wp litespeed-purge all`. See [`docs/infra/cloud.md`](./docs/infra/cloud.md).
- **`.bat` fire-and-forget pattern** for sandbox sessions that can't egress to VPSes — see [`docs/infra/deploy-bat-pattern.md`](./docs/infra/deploy-bat-pattern.md).

## Backup procedures

- **Code:** git is canonical. Push to `main` = backed up. Hostinger PAT lasts 30 days; rotate per `keyz/`.
- **DB (Supabase):** Pro plan auto-backups daily. Manual point-in-time-restore via dashboard. Schema export procedure in [`docs/infra/supabase.md`](./docs/infra/supabase.md). The `process_trigger` SQL function and 9 missing migrations live ONLY in the dashboard right now — fix that with a baseline dump (audit finding H-9/H-10).
- **Secrets:** 1Password is canonical. `keyz/` is the plaintext mirror for automation. Both kept in sync; if one drifts, fix from 1Password.
- **VPS state:** authorized_keys backups left as `~/.ssh/authorized_keys.bak.<unix-ts>` after rotations. Hostinger snapshots configurable in hPanel.
- **Restore runbook:** [`docs/infra/disaster-recovery.md`](./docs/infra/disaster-recovery.md).

## Keys / secrets / credentials

The full lookup is in [`docs/infra/credentials.md`](./docs/infra/credentials.md). Quick map:

| Need | Where | How |
|---|---|---|
| GitHub PAT | `op://Personal/GitHub PAT - D4JSP/credential` or `C:/Users/Owner/Desktop/keyz/github-pat.txt` | `op read` or `cat`; never persist in URL |
| KVM 4 SSH | `keyz/d4jsp_kvm4_claude` | `ssh -i ...` |
| KVM 2 SSH | `keyz/d4jsp_kvm2_claude` | `ssh -i ...` |
| Cloud SSH | `keyz/d4jsp_cloud_claude` | `ssh -i ... -p 65002 u704061244@82.29.193.20` |
| Supabase service role | KVM 4/KVM 2 prod env (`SUPABASE_SERVICE_ROLE_KEY`) | server-only; `lib/supabase-admin.js` throws if missing |
| Supabase anon | hardcoded in `lib/supabase.js:4` (legacy 64yr JWT) + `next.config.js:47` (new `sb_publishable_uCx4...`) | client-safe |
| Stripe secret | KVM 4 prod env (`STRIPE_SECRET_KEY`) | server-only |
| Stripe webhook | KVM 4 prod env (`STRIPE_WEBHOOK_SECRET`) | server-only |
| Resend | KVM 4 prod env (`RESEND_API_KEY`) | server-only |
| VAPID private | KVM 4 prod env + **committed (problem)** in `.env.production:15` | rotate, untrack |
| Battle.net client secret | KVM 4 prod env (`BATTLENET_CLIENT_SECRET`) | server-only |

**Hard rules:**
- NEVER echo passwords/PATs/private keys into transcripts or commit messages.
- NEVER commit anything from `keyz/`.
- NEVER push to remote with PAT persisted in URL.
- See [`docs/infra/credential-rotation.md`](./docs/infra/credential-rotation.md) for per-secret rotation procedure.

## Migrations / DDL protocol

- **Schema/data changes** that need service-role go in `migrations/NNN_description.sql`.
- Numbering is sequential — never reuse an N. Pick the next free.
- Adam runs them in the Supabase SQL editor: <https://supabase.com/dashboard/project/isjkdbmfxpxuuloqosib/sql/new>.
- **Don't apply migrations directly in the dashboard without committing the SQL.** That's how 9 migrations went missing (H-9). The repo must be able to rebuild the DB.
- Note the migration in [`docs/data-model/migrations.md`](./docs/data-model/migrations.md) and bump any affected catalog page in [`docs/catalogs/`](./docs/catalogs/).

## Doc updates (local-wiki-authoritative, push-opportunistic)

- **Local wiki is the source of truth.** Update `docs/` pages immediately when architecture changes. Don't defer.
- **Doc debt is a working-tree concept.** Append to `docs/_doc-debt.md` when an architectural change happens; clear it in the working tree before declaring a feature done.
- **Git push for docs happens when convenient** — explicit ask, session-wrap, or alongside related code commits. Code pushes are still immediate (deploy depends on them); docs are decoupled.
- **Read the working tree, not git** when you need wiki context. Uncommitted doc changes are fine; that's the truth.
- **CI verify-docs** runs on whatever is pushed to main. Between pushes, local can be in any state.

Full procedure: [`docs/conventions.md`](./docs/conventions.md) "Doc updates".

## Hard rules / never-do list

1. **No `--no-verify`**, no signing bypass, no skipping hooks unless explicitly authorized.
2. **No destructive git** (`reset --hard`, `push --force`, branch `-D`) without confirmation.
3. **Never use timeouts/aborts to mask root causes.** Diagnose why; only use timeouts as last-resort 90s wall-clock user safety nets.
4. **No UI changes unprompted.** Preserve existing visuals.
5. **No hidden configs.** Operational tunables go in the `system_config` catalog, accessed via `lib/sysConfig.js`. Never inline business constants. Full list of current violations in the audit.
6. **No new features outside the modular spine.** Plug into existing catalogs. If a feature needs a new tunable with no admin surface, defer + flag.
7. **No browser opening from this Claude Code session.** Browser testing is Cowork's lane (Claude in Chrome MCP).
8. **No async-process polling on mobile dispatch** — never `start_process` / `read_process_output` / `desktop-commander.start_process`. Synchronous bash + `.bat` fire-and-forget only.
9. **Never commit `.env*`.** `.gitignore` should catch `.env*`; if `.env.production` is currently tracked, `git rm --cached` it.
10. **Never amend published commits.** New commits only.
11. **Always preserve existing catalog rows.** When editing a catalog, edit/upsert — don't drop and recreate.

## Verbal commands (recognized verbatim)

These are hard-stop keywords. Honor them identically across orchestrator and executor sessions.

- **"inbox" / "inbox this" / "park it"** → append to [`docs/_inbox.md`](./docs/_inbox.md) with timestamp, reply `Inboxed. <count> waiting.`, do NOT execute. If mid-task: pause, append, say "Inboxed. Resuming current task.", continue.
- **"ship the inbox" / "batch the inbox" / "do the admin batch"** → read inbox, group by area, propose groupings, await confirmation, then ship as a single `_batch-log.md` entry per grouping.

Full rules: [`docs/conventions.md`](./docs/conventions.md) "Verbal commands".

## Workflow protocols

**Session start:**
1. Read this file.
2. Read [`docs/_doc-debt.md`](./docs/_doc-debt.md) — if it has entries, those are the FIRST job before anything else (unless the user's ask is itself an emergency).
3. Read the user's ask. Map it to a feature/route/catalog → jump to the relevant page in `docs/`.

**Doing work:**
1. **Hack fast during debugging.** Make as many commits as needed to pin down the bug. **Do NOT update docs in those iteration commits.**
2. When the surface area you touched (UI / API / DB schema / infra / lib spine) is one of the doc-relevant ones (see globs in [`docs/conventions.md`](./docs/conventions.md)), append a one-liner to `docs/_doc-debt.md`: `<sha> · <surface> · <what changed> · <docs to update>`.
3. Before declaring the feature done, **clear `_doc-debt.md`** by writing/updating the relevant docs in one batch commit with message `docs: update <area> after <feature>`.
4. **Doc debt is a blocker for moving forward, not for moving fast.** Never start a new feature with debt outstanding. Never end a session with debt outstanding.

**CI verification:** every push runs `npm run docs:verify` (or the GH Action equivalent). It checks `file.ext:line` references resolve, internal cross-doc links resolve, and named DB tables / API routes mentioned in docs still exist in the codebase. Cheap to run, catches accidental drift.

**Reporting progress:**
- Don't narrate every tool call to the user.
- Do report SHA after each push.
- Do report a one-line summary when a feature is done + doc-debt cleared.
- Do report the result of `verify-docs` if it failed.

## "This wiki IS the audit"

Historical full audits are kept under [`docs/audits/`](./docs/audits/) for reference. The current source of truth is the wiki itself — every doc in `docs/` describes the live state. Never run another full one-shot audit; instead, when something drifts, fix the doc as part of the commit that touched the underlying code.

The audit at [`docs/audits/2026-04-26.md`](./docs/audits/2026-04-26.md) is a snapshot from the day this wiki was bootstrapped. Use it for a wide overview of pre-launch findings; use the live wiki for everything else.

---

# § Glossary

- **FG** — Forum Gold. Platform currency. `users.fg_balance`. Tracked in `fg_ledger`.
- **Catalog** — Postgres table where features are *defined* (`triggers`, `quests`, `specials`, `skills`, `badges`, `subscription_tiers`, `fg_packages`, `permissions`, `ranks`, `system_config`, `xp_rules`).
- **Endpoint** — API route that *reads* a catalog and acts. See [`docs/endpoints/`](./docs/endpoints/).
- **Config** — JSON sub-document on a catalog row OR a row in `system_config`. Trigger config = *when it fires*. Quest config = *what happens*. Operational config = `system_config` only.
- **Trigger** — registered event id (e.g. `forum_troll_spawned`). Fired by frontend or system, dispatched via `process_trigger` SQL function.
- **Special** — reward grant attached to a trigger. Awards FG/badges/XP. See [`docs/catalogs/specials.md`](./docs/catalogs/specials.md).
- **Special claim** — append-only ledger row when a special fires for a user.
- **Quest** — objective bound to a trigger. One-time/daily/weekly. See [`docs/catalogs/quests.md`](./docs/catalogs/quests.md).
- **Skill** — grantable ability (e.g. "FG Bonus", "Extra Posts/day"). Granted via subscription tier, rank, or admin manual.
- **Permission** — capability gate (e.g. `d4_build_slots: 3`). Tier-mapped JSON.
- **Rank** — XP-thresholded level (Scavenger → Godslayer, 50 levels). Defined in [`lib/rankEngine.js`](./lib/rankEngine.js).
- **Tier** — subscription level (`free` | `verified` | `basic` | `premium` | `legendary`).
- **Gem** — clickable header gem on Latest Trades. Multiple clicks → `forum_troll_spawned` trigger fires. See [`docs/features/forum-troll-gem.md`](./docs/features/forum-troll-gem.md).
- **Troll** — `forum_trolls` row. Spawned by gem clicks. HP, despawn timer, attached to a random thread.
- **OCR sell pipeline** — user uploads in-game screenshot → KVM 2 RapidOCR → DB match → BuyView pre-filled. See [`docs/features/sell-pipeline.md`](./docs/features/sell-pipeline.md).
- **Escrow** — FG held by the platform between buyer accept and seller deliver. See [`docs/features/escrow.md`](./docs/features/escrow.md).
- **Cross-domain auth cookie** — `.d4jsp.org` chunked Supabase session + `d4jsp_auth` JWT cookie. Federation glue across 4 apps + 8 WP sites.
- **adminDb** — `lib/supabase-admin.js` service-role client. Bypasses RLS. **Server-side only.**
- **Cowork** — Adam's Claude desktop with Claude in Chrome MCP. Drives the browser. NOT this agent.
- **Claude Code** — this agent. Edits code, runs deploys. Does not drive Chrome.
- **KVM 4 / KVM 2 / Cloud** — Hostinger servers. KVM 4 = trade frontend. KVM 2 = admin/OCR/tooltip. Cloud = WP.

---

# § Project overview

**D4JSP** is a Diablo 4 item trading platform with a gamified economy on top. Users sell/buy in-game items for FG (earned + Stripe-purchased), with escrow holding FG between accept and deliver. Around the marketplace sits a forum, build planner, interactive map, ranks/XP, badges, raffles, and a real-time troll-spawning event. Auth is Google or Battle.net OAuth via Supabase, single sign-on across 4 sibling apps and 8 WordPress satellites via a shared `.d4jsp.org` cookie chain. Pre-production. Going live tonight (2026-04-26).

---

# § Apps inventory

| Repo | Role | Stack | Deploy | URL |
|---|---|---|---|---|
| **`D4JSP`** *(this repo)* | Main trade site + backend for everything | Next.js 15.3.3, custom `server.js`, 92 API routes | KVM 4 `/opt/d4jsp` PM2 `:3000` | `https://trade.d4jsp.org/*` |
| `D4JSP-Admin` | Admin console — proxies all API calls back to D4JSP | Next.js 15.3.3, 2 pages, lazy AdminView | KVM 2 `/opt/d4jsp-admin` PM2 `:3001` | `https://trade.d4jsp.org/admin-panel/*` |
| `D4JSP-Build-Planner` | Damage calc + paper-doll, tier-gated build slots | Next.js 14, static export, basePath `/builder` | static, mounted on KVM 4 nginx | `https://trade.d4jsp.org/builder/*` |
| `D4JSP-Map` | Sanctuary tile map + dungeon planner | Vite + Leaflet, no auth, no Supabase | static, iframed | inside trade Profile tab |

WordPress federation (`d4jsp.org` hub + 7 satellites) is on Cloud — *not yet indexed; touch when needed.*

For the connected-systems integration map (every edge labeled), see [`docs/infra/connected-systems.md`](./docs/infra/connected-systems.md).

---

# § Infrastructure at a glance

| Surface | Where | Ports | Supervisor | Doc |
|---|---|---|---|---|
| **KVM 4** — Trade Core | Hostinger VPS `177.7.32.128` | 3000 (Next.js, public via nginx) | PM2 `d4jsp` (cluster) | [`docs/infra/kvm-4.md`](./docs/infra/kvm-4.md) |
| **KVM 2** — Admin app | Hostinger VPS `187.124.239.213` | 3001 (bound to localhost; surfaced at `trade.d4jsp.org/admin-panel/*` via KVM 4 nginx) | PM2 `d4jsp-admin` (cluster) | [`docs/infra/kvm-2.md`](./docs/infra/kvm-2.md) |
| **KVM 2** — RapidOCR | same VPS | **9000** public via nginx → **8000** uvicorn | **systemd** `d4jsp-ocr.service`, uvicorn 3 workers | [`docs/infra/kvm-2.md`](./docs/infra/kvm-2.md) |
| **KVM 2** — Tooltip | same VPS | 3100 | PM2 `d4jsp-tooltip` (fork) | [`docs/infra/kvm-2.md`](./docs/infra/kvm-2.md) |
| **Cloud** — WordPress federation | Hostinger Cloud `82.29.193.20:65002` | n/a | LiteSpeed + cPanel | [`docs/infra/cloud.md`](./docs/infra/cloud.md) |
| **Supabase** — Postgres + Auth + Realtime + Storage | `isjkdbmfxpxuuloqosib.supabase.co`, Pro plan | n/a | provider-managed | [`docs/infra/supabase.md`](./docs/infra/supabase.md) |
| **Stripe** — payments | dashboard | n/a | provider-managed | [`docs/integrations/stripe.md`](./docs/integrations/stripe.md) |
| **Resend** — transactional email | dashboard | n/a | provider-managed | [`docs/integrations/resend.md`](./docs/integrations/resend.md) |
| **VAPID Web Push** — browser notifications | `web-push` server-side | n/a | provider-managed | [`docs/integrations/web-push.md`](./docs/integrations/web-push.md) |
| **OAuth providers** — Google + Battle.net | Cloud Console `d4jsp-491120` + develop.battle.net | n/a | provider-managed | [`docs/auth/providers.md`](./docs/auth/providers.md) |
| **DNS** — domain registrar | GoDaddy (19 domains) | n/a | provider-managed | [`docs/infra/dns-tls.md`](./docs/infra/dns-tls.md) |
| **TLS** — Let's Encrypt | KVM 4/2 certbot, Hostinger-managed for Cloud | n/a | systemd timer (KVM) / provider | [`docs/infra/dns-tls.md`](./docs/infra/dns-tls.md) |
| **Static** — Build Planner | nginx on KVM 4 at `/builder` | n/a | static export, no runtime | [`docs/infra/kvm-4.md`](./docs/infra/kvm-4.md), [`docs/features/build-planner.md`](./docs/features/build-planner.md) |
| **Static** — Map | nginx on KVM 4 (iframed in Profile) | n/a | static, no runtime | [`docs/features/map-iframe.md`](./docs/features/map-iframe.md) |

For the integration map (every edge labeled): [`docs/infra/connected-systems.md`](./docs/infra/connected-systems.md).

For credentials lookup: [`docs/infra/credentials.md`](./docs/infra/credentials.md).

For deploy procedures: [`docs/infra/deploy.md`](./docs/infra/deploy.md) and (for sandbox-restricted sessions) [`docs/infra/deploy-bat-pattern.md`](./docs/infra/deploy-bat-pattern.md).

---

# § Site map (every URL/route)

Full per-route inventory: [`docs/sitemap.md`](./docs/sitemap.md).

Quick top-level:
- `/` — home, Latest Trades feed, gem button, troll banner. UI in [`components/AppShell.js`](./components/AppShell.js) + [`components/HomeView.js`](./components/HomeView.js).
- `/widget/latest-trades` — public iframe widget for WP hub. No auth. See [`docs/features/widgets.md`](./docs/features/widgets.md).
- `/admin-panel/*` — admin console (proxied to KVM 2:3001).
- `/builder/*` — Build Planner static export.
- `/invite/[referrerId]` — referral capture page.
- `/tooltip-preview` — Wowhead tooltip preview.
- `/api/*` — 92 routes; full inventory in [`docs/endpoints/`](./docs/endpoints/).

---

# § Infrastructure (TOC)

- [`docs/infra/connected-systems.md`](./docs/infra/connected-systems.md) — full integration map: trade ↔ admin ↔ builder ↔ map ↔ WP ↔ Supabase ↔ Stripe ↔ KVM 2 services
- [`docs/infra/kvm-4.md`](./docs/infra/kvm-4.md) — trade-app server, PM2, nginx, env layout
- [`docs/infra/kvm-2.md`](./docs/infra/kvm-2.md) — admin app, OCR (`:9000`), tooltip (`:3100`)
- [`docs/infra/cloud.md`](./docs/infra/cloud.md) — WordPress multisite, LiteSpeed, OPcache caveats
- [`docs/infra/supabase.md`](./docs/infra/supabase.md) — project, RLS posture, realtime publication, storage buckets, missing migrations
- [`docs/infra/deploy.md`](./docs/infra/deploy.md) — push → SSH → build → reload, per app
- [`docs/infra/deploy-bat-pattern.md`](./docs/infra/deploy-bat-pattern.md) — sandbox-bash workaround for SSH-restricted environments
- [`docs/infra/credentials.md`](./docs/infra/credentials.md) — full credential lookup
- [`docs/infra/credential-rotation.md`](./docs/infra/credential-rotation.md) — per-secret rotation procedure
- [`docs/infra/disaster-recovery.md`](./docs/infra/disaster-recovery.md) — restore runbook
- [`docs/infra/dns-tls.md`](./docs/infra/dns-tls.md) — GoDaddy DNS, Hostinger TLS
- [`docs/infra/scheduled-jobs.md`](./docs/infra/scheduled-jobs.md) — cron-style work (currently mostly manual)

---

# § Modular system (catalogs → endpoints → configs)

Adam's GamiPress-style spine. Read [`docs/modular-system/overview.md`](./docs/modular-system/overview.md) first; it has the canonical traced example (forum troll quest end-to-end).

**Catalogs** (Postgres tables — definitions):
- [`docs/catalogs/triggers.md`](./docs/catalogs/triggers.md) — event registry
- [`docs/catalogs/quests.md`](./docs/catalogs/quests.md) — objectives bound to triggers
- [`docs/catalogs/specials.md`](./docs/catalogs/specials.md) — reward grants
- [`docs/catalogs/skills.md`](./docs/catalogs/skills.md) — grantable abilities
- [`docs/catalogs/badges.md`](./docs/catalogs/badges.md) — visual badges
- [`docs/catalogs/subscription-tiers.md`](./docs/catalogs/subscription-tiers.md) — tier definitions
- [`docs/catalogs/fg-packages.md`](./docs/catalogs/fg-packages.md) — store packages
- [`docs/catalogs/permissions.md`](./docs/catalogs/permissions.md) — capability gates
- [`docs/catalogs/ranks.md`](./docs/catalogs/ranks.md) — XP-thresholded levels (hardcoded in code, sourced from `lib/rankEngine.js`)
- [`docs/catalogs/system-config.md`](./docs/catalogs/system-config.md) — operational tunables
- [`docs/catalogs/xp-rules.md`](./docs/catalogs/xp-rules.md) — per-action XP map

**Endpoints** (API routes — actions):
- [`docs/endpoints/auth.md`](./docs/endpoints/auth.md) — login, OAuth, setup-user, promote-admin
- [`docs/endpoints/threads.md`](./docs/endpoints/threads.md) — list, read, create
- [`docs/endpoints/escrow.md`](./docs/endpoints/escrow.md) — initiate, confirm, dispute, cancel
- [`docs/endpoints/fg.md`](./docs/endpoints/fg.md) — transfer, grant
- [`docs/endpoints/quests-triggers.md`](./docs/endpoints/quests-triggers.md) — `quest-trigger`, `trigger-expiry-check`, `triggers/emit`
- [`docs/endpoints/ocr.md`](./docs/endpoints/ocr.md) — paddle-ocr proxy, item-search, item-lookup
- [`docs/endpoints/stripe.md`](./docs/endpoints/stripe.md) — create-payment-intent, webhook
- [`docs/endpoints/admin.md`](./docs/endpoints/admin.md) — every `/api/admin/*` route
- [`docs/endpoints/widgets.md`](./docs/endpoints/widgets.md) — public widget API + page
- [`docs/endpoints/misc.md`](./docs/endpoints/misc.md) — boss-timer, health, push-subscribe, etc.

**Features** (cross-page concepts):
- [`docs/features/forum-troll-gem.md`](./docs/features/forum-troll-gem.md) — the gem button + troll lifecycle
- [`docs/features/tooltip.md`](./docs/features/tooltip.md) — D4 item tooltip locked-size contract + context-aware overflow
- [`docs/features/escrow.md`](./docs/features/escrow.md) — buyer→seller FG hold
- [`docs/features/sell-pipeline.md`](./docs/features/sell-pipeline.md) — OCR sell flow
- [`docs/features/widgets.md`](./docs/features/widgets.md) — public widgets (WP-embed)
- [`docs/features/build-planner.md`](./docs/features/build-planner.md) — `/builder` integration
- [`docs/features/map-iframe.md`](./docs/features/map-iframe.md) — Profile tab map embed
- [`docs/features/realtime.md`](./docs/features/realtime.md) — Supabase realtime channels

---

# § Admin (TOC)

Admin app is its own repo (`D4JSP-Admin`), but every admin tab edits a catalog that lives here.

- [`docs/admin/overview.md`](./docs/admin/overview.md) — admin app architecture, proxy mechanics, security
- [`docs/admin/users-tab.md`](./docs/admin/users-tab.md) — `/api/admin/user-detail` (correct) vs `/api/admin/action` (legacy)
- [`docs/admin/quests-tab.md`](./docs/admin/quests-tab.md) — `quests` + `triggers` catalogs
- [`docs/admin/specials-tab.md`](./docs/admin/specials-tab.md) — `specials` + `special_rules` + `special_claims`
- [`docs/admin/skills-tab.md`](./docs/admin/skills-tab.md)
- [`docs/admin/subscriptions-tab.md`](./docs/admin/subscriptions-tab.md)
- [`docs/admin/permissions-tab.md`](./docs/admin/permissions-tab.md)
- [`docs/admin/ranks-tab.md`](./docs/admin/ranks-tab.md)
- [`docs/admin/system-config-tab.md`](./docs/admin/system-config-tab.md)
- [`docs/admin/bots-tab.md`](./docs/admin/bots-tab.md)
- [`docs/admin/training-tab.md`](./docs/admin/training-tab.md)

---

# § Data model (TOC)

- [`docs/data-model/users.md`](./docs/data-model/users.md) — schema, RLS, sensitive-column guard
- [`docs/data-model/threads.md`](./docs/data-model/threads.md) — listings + escrow fields
- [`docs/data-model/escrow.md`](./docs/data-model/escrow.md)
- [`docs/data-model/fg-ledger.md`](./docs/data-model/fg-ledger.md) — canonical ledger
- [`docs/data-model/transactions.md`](./docs/data-model/transactions.md) — Stripe ledger, idempotency
- [`docs/data-model/forum-trolls.md`](./docs/data-model/forum-trolls.md) — realtime-published
- [`docs/data-model/admin-action-log.md`](./docs/data-model/admin-action-log.md)
- [`docs/data-model/notifications.md`](./docs/data-model/notifications.md) — `notifications` + `notification_log`
- [`docs/data-model/migrations.md`](./docs/data-model/migrations.md) — tracked + missing
- [`docs/data-model/rls.md`](./docs/data-model/rls.md) — RLS posture per table

---

# § Auth + integrations (TOC)

- [`docs/auth/overview.md`](./docs/auth/overview.md) — providers, session lifecycle, admin gate
- [`docs/auth/cross-domain-cookies.md`](./docs/auth/cross-domain-cookies.md) — `.d4jsp.org` chunked cookie scheme
- [`docs/auth/providers.md`](./docs/auth/providers.md) — Google, Battle.net config
- [`docs/auth/rls.md`](./docs/auth/rls.md) — what's protected, what's not
- [`docs/integrations/stripe.md`](./docs/integrations/stripe.md)
- [`docs/integrations/resend.md`](./docs/integrations/resend.md)
- [`docs/integrations/web-push.md`](./docs/integrations/web-push.md)
- [`docs/integrations/wowhead.md`](./docs/integrations/wowhead.md) — tooltip scrape
- [`docs/integrations/d4armory.md`](./docs/integrations/d4armory.md) — boss-timer

---

# § Recent state

The append-only stream of what's shipped. New entries at top.

### `00ec198` — `fix(troll): restore gem click-flash + persistent-pressed glow` — 2026-04-26 — DEPLOYED to KVM 4
- `c5d83c8` had layered `.gem-pressed` (with `!important`) on BOTH `gemFlash` and `trollActive` states. The class's `!important` filter beat the inline click-flash brightness, so every click silently snapped the gem into the dim pressed state with no visible flash. User saw the button as "frozen."
- Fix: apply `.gem-pressed` only on `trollActive`. Click flash uses inline style alone. Bumped gem zIndex 107 → 9999 (header is z=110, was clipping).
- File: [`components/HomeView.js:850, 856`](./components/HomeView.js).
- Doc: [`docs/features/forum-troll-gem.md`](./docs/features/forum-troll-gem.md) updated.

### Patch 7 — light/dark toggle in top menu — IN FLIGHT

### Patch 6 — sub-site forums — SHIPPED (Cloud)
- bbPress rewrite flush per site, Forums menu entries on every subsite, calculator forum created. LiteSpeed purged.

### Patch 5 — `758b2aa` — gem-pressed CSS + widget route + cross-domain logout
- AppShell.js + HomeView.js EOF restoration (fixed `c5d83c8` truncation). Gem-pressed class. Public widget route `/widget/latest-trades`. `logOut()` redirect to `https://d4jsp.org/d4jsp-logout`.

### Patch 4 — WP hub batch — SHIPPED (Cloud)
- Auth-plugin cache-bypass. Logout cookie clear. Logo overrides. Hero padding. 9-tab grid. Latest Trades iframe. Per-site Primary menus.

### Patch 3 — `c5849ae` (main) + `65e8269` (admin) — admin OAuth redirect
- `redirectTo` uses `window.location.origin + pathname` so basePath-mounted apps stay where they started.

### Patch 2 — `b438f1f` — gem v1 + ticker WAAPI
- AppShell.js: realtime sub on `forum_trolls`, hydrate-on-mount, 2-min poll. EventTicker.js: WAAPI animation with `currentTime` preservation.

### Patch 1 — Supabase realtime + WP migration foundations
- `ALTER PUBLICATION supabase_realtime ADD TABLE forum_trolls`. `system_config` widget category seeded.

For the historical full audit snapshot: [`docs/audits/2026-04-26.md`](./docs/audits/2026-04-26.md).

---

# § Conventions / agent reference

- [`docs/conventions.md`](./docs/conventions.md) — full set of rules, doc-debt protocol details, doc-relevant globs
- [`docs/glossary.md`](./docs/glossary.md) — extended glossary (this file's glossary is the short version)
- [`CLAUDE.md`](./CLAUDE.md) — auto-loaded by Claude Code on session start; trimmed pointer back to this file

---

*This file is the front door. Everything else is reachable from here. If you create a new doc, link it from here. If you delete a doc, delete the link too. The wiki is only useful if it stays consistent.*
