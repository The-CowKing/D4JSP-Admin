# Batch Log

The append-only ledger of user asks, what shipped, and how to roll back. **Read the "Live now" block at the top before starting any work.** New entries go above the divider, newest first.

## How to use
- New ask from user → add an entry with status `open`. Number sequentially from the highest existing.
- Each commit that addresses an ask → append the SHA + commit subject under the entry's `Commits`.
- Feature done + verified working + doc-debt cleared → flip status `closed`, write the `Verification (checklist)`, write `Rollback`.
- Roll back something → execute the rollback, mark status `reverted`, append the revert SHA(s).
- Update the **Live now** block at the top whenever you open, close, or revert an entry.

## Live now

- **#58 — FG package placeholder artwork (queued)** — Adam: "the FG package used to have proper images for alot of them. at some point placeholders were put in." Hint: "probably on supabase in bucket." Blocked behind #57. Restore proper per-package artwork — likely the Supabase Storage URLs in `fg_packages.image_url` were overwritten with placeholder paths; real images still in the bucket.
- **#57 — Stripe payment flow broken since KVM 4 migration (queued)** — Adam: subscribe button shows in-page modal that doesn't redirect to Stripe Checkout; Buy FG returns "Invalid package". Likely root causes: webhook URL still points at old cloud host, env vars missing on KVM 4, or stale `stripe_price_id` values. Blocked: blocks revenue flow, top priority after #56 ships and verifies.
- **#56 — Remove redundant in-thread troll banner + restore HIT visibility (deployed, awaiting verify)** — `D4JSP/57b9c53` deployed to KVM 4 (PM2 reload `[d4jsp](0) ✓`, status `online`, HTTP 200 on `/`, `/api/forum-trolls` returns valid JSON). ThreadDetailView's "A Forum Troll has appeared" body banner + its #53 thread-scoped sub + state removed entirely — the AppShell global banner (filtered by `selectedThreadId`) is now the single source of UI for troll state in any view. AppShell `handleTrollHit` surfaces a visible toast on every failure path (auth/4xx/5xx/network) instead of failing silently. Cowork to run the spot-check checklist below — Adam should now see either HP decrement OR a diagnostic toast on every HIT click.
- **#55 — Tooltip + user-info clipping on desktop only (deployed, awaiting verify)** — `D4JSP/bd66237` deployed to KVM 4 (PM2 online, HTTP 200, JS bundle confirmed contains the new `white-space:normal!important;overflow-wrap:anywhere!important;max-width:300px!important` rules on tooltip tables/cells + `overflow-wrap:anywhere!important;word-break:break-word!important` on `.whtt-scroll` descendants). Mirrored to `D4JSP-Admin/1534a7f`, `D4JSP-Build-Planner/96e5685`, `D4JSP-Map/d8f49b7`. Mirrors the mobile-only wrap-override globally so desktop also wraps tooltip tables/cells/text within the locked 300px width. Username `wordBreak:'break-word'` → `overflowWrap:'anywhere'; hyphens:'auto'` for hard-break fallback. Cowork to run the 9-item verification checklist.
- **#53 — Live troll render in post view (superseded by #56)** — `D4JSP/536c6a7` pushed but never deployed. The in-thread banner that #53 hardened was removed in #56 because Adam decided he wants only one banner globally. The thread-scoped sub is gone; the AppShell global sub already drives the (single, top-of-screen) banner including for users on the affected thread.
- **#54 — Tooltip bottom-fixed pushed below frame on long-content preview (deployed, awaiting verify)** — `D4JSP/2c72c98` deployed to KVM 4 (PM2 online, HTTP 200, JS bundle confirmed contains `.whtt-container{...height:520px!important}` + `.whtt-scroll{flex:1 1 0!important;min-height:0!important;max-height:420px!important...}`). Mirrored to `D4JSP-Admin/111e402`, `D4JSP-Build-Planner/84c1334`, `D4JSP-Map/93a27e9`. Container locked at 520px; scroll-area uses `flex:1 1 0` to deterministically fill 420 within it; bottom-fixed structurally anchored at bottom 100. Cowork to run the 8-item verification checklist below.
- **#52 — Troll spawn pool capped to top-page (closed)** — Config-only, no code change, no deploy. Set `quests.config.spawn_limit = 10` on the `Summon forum troll` quest (was unset → fell back to default 20). Matches `HomeView.js:402 PAGE_SIZE = 10` so trolls can only land on threads a hunter sees on page 1 of Latest Trades. Verified via service-role REST PATCH; quest row `8e715845-1caf-4cc3-bc7b-a11f8029d90d` now has `config: {"spawn_limit": 10}`.
- **#51 — Banner + gem stuck on after killing one troll while others still alive (closed)** — `D4JSP/0204f6e` deployed to KVM 4. Root cause: rapid gem-clicks had spawned 4 alive trolls in `forum_trolls`; killing ONE left 3 alive, so banner + gem state (driven by global `activeTrolls.length > 0`) stayed on. Fix: server-side concurrent-alive cap on spawn via new `triggers.config.max_alive_concurrent` (default 1), 429 with `blocked: 'concurrent_limit'`. DB cleanup: 4 stuck rows (`24f5a5cd`, `b05033f1`, `e9fe34b1`, `ce5fb43f`) set `killed_at=NOW(), hp=0` via service-role REST. `/api/forum-trolls` now returns `{"trolls":[]}`.
- **#50 — Tooltip + outer card sizing fix (Option A+) (deployed, awaiting verify)** — `D4JSP/3b631a5` deployed to KVM 4 (PM2 online, HTTP 200, JS bundle confirmed contains `min-height:380px!important;max-height:420px!important` + `.feed-thumb …whtt-scroll{overflow:hidden!important}`). Mirrored to `D4JSP-Admin/dd99c21`, `D4JSP-Build-Planner/1d6f8ec`, `D4JSP-Map/228628c`. Restores the locked-size contract from `03235db` (uniform-tooltip-height-flex-spacer-before-flavor) that `b0a8bea` deleted on 2026-04-17. Cowork to run the 16-item verification checklist below.
- **#49 — Gem stops responding after trade cards mount (closed)** — `D4JSP/00013a0` deployed to KVM 4. Two issues: (1) gemPos was stuck on a 0-height measurement when the goblin image decoded after the 500ms setTimeout (slow mobile) — fixed via `<img onLoad>` re-measure; (2) gem zIndex 107 had only 1 step over cards-section z=106 — bumped to 109 (still below header z=110). Spot-check checklist below.
- **#48 — Pre-tooltip-fix backup tag (closed)** — Tag `backup/2026-04-26-pre-tooltip` pushed to all 4 repos at current HEAD. Rollback target if tooltip work regresses anything. (Note: #48 was previously used as a placeholder slot for tooltip diagnosis read-only — superseded by this backup-tag entry; diagnosis work folded into #50.)
- **#47 — Gem stuck on after kill / despawn (closed)** — `D4JSP/3b4ebdf` deployed. Release path robust against realtime delivery semantics + passive despawn TTL.
- **#46 — Banner-only announcement, drop legacy spawn toast, weekly limit (closed)** — `D4JSP/642c6ab` deployed. Three independent visual elements: click-anim (local), gem-on (realtime), banner (realtime). Bottom-right spawn toast removed. Weekly spawn limit added on `triggers.config.max_per_week`.
- **#45 — `/api/forum-trolls` cache + click-flash perception (closed)** — `D4JSP/bb200ce` deployed. Cache-Control: no-store, click-flash extended 180→320ms with snap-fast filter. Persistent glow now flips within ~1s of spawn instead of after 20s cache window.
- **#44 — Gem moved off hero illustration (closed)** — `D4JSP/7e1febf` deployed. Reverts zIndex 9999→107 from #42; gem returns to anchor on goblin's gem in Latest Trades banner.
- **#43 — Wiki + memory architecture build (closed)** — `D4JSP/8767582` + `D4JSP-Admin/c43ac83` + `D4JSP-Build-Planner/4c0e85b` + `D4JSP-Map/976c0c9`. All 4 repos verified clean.
- **#42 — Gem button regression fix (closed)** — `D4JSP/00ec198`. Click-flash restored after `c5d83c8` regression.

---

## #53 — Live troll render in post view (thread-scoped realtime hardening)
- **Status:** pushed (2026-04-26) — deploy step blocked by sandbox; awaiting Cowork SSH deploy.
- **Asked:** "make sure users can see the forum troll popup live if they are in the post when it spawns too so they don't get fucked over and would have to back out and in again"
- **Scope:** A user already viewing a thread when a troll spawns ON that thread must see the in-thread "A Forum Troll has appeared" banner appear LIVE — no reload, no navigate-away-and-back. Same release path on kill/despawn.
- **Diagnosis:** [`../../components/ThreadDetailView.js`](../../components/ThreadDetailView.js) already had a thread-scoped `forum_trolls` realtime sub filtered on `thread_id=eq.${threadId}` for INSERT/UPDATE/DELETE. Spawn-render path was *technically* working but had two release-path bugs identical to the AppShell #47 pattern that, combined with the `forum_trolls` server-UPDATE-only-on-kill (no DELETE), would leave the in-thread banner stuck on:
  1. **UPDATE handler didn't release on kill.** It merged the new row into `prev` but never re-checked aliveness — so `killed_at` getting set via UPDATE just updated `activeTroll` instead of clearing it.
  2. **No passive despawn handling.** TTL expiry (`despawn_at`) produces no DB row change → no realtime event → banner stuck until next page load.
  3. **`huntTroll` only optimistically released on `data.killed === true`.** A 400 "already slain" response never cleared local state.
- **Fix:** Mirror AppShell's #47 contract in ThreadDetailView:
  1. New `_isTrollAlive(t) = !t.killed_at && (!t.despawn_at || new Date(t.despawn_at) > now())` defensive helper.
  2. `loadActiveTroll` filters through `_isTrollAlive` before `setActiveTroll`.
  3. INSERT handler only sets state if the new row is alive.
  4. UPDATE handler merges, then re-runs `_isTrollAlive(merged)` — if no-longer-alive, sets to `null`. This is the kill release path (server kills via UPDATE, never DELETE).
  5. New passive despawn `setTimeout` at `despawn_at + 250ms` clears the local state and calls `refetchTrollRef.current?.()` as a safety net.
  6. `huntTroll` always calls `refetchTrollRef.current?.()` after the server response regardless of `data.killed`/`data.ok` shape.
  7. Channel cleanup nulls `refetchTrollRef.current` to avoid post-unmount fires.
- **Commits:**
  - `D4JSP/536c6a7` — `feat(troll): live-render troll spawn in post view via thread-scoped realtime sub (#53)`
- **Deployed:** **NOT YET.** SSH write to KVM 4 blocked by sandbox. Cowork to run:
  ```bash
  ssh -i C:/Users/Owner/Desktop/keyz/d4jsp_kvm4_claude root@177.7.32.128 \
    "cd /opt/d4jsp && git fetch origin main && git reset --hard origin/main && \
     npm run build && pm2 reload d4jsp"
  ```
- **Verification (checklist — to run AFTER deploy):**
  - [ ] Open a thread that's in the top-10 spawn pool. Stay on it.
  - [ ] In a separate tab/device, click the gem until a troll spawns. Confirm the spawn lands on this thread (or repeat until it does — top-10 makes it ~10% per spawn).
  - [ ] Original tab: "A Forum Troll has appeared" banner appears WITHOUT refresh / navigate-away.
  - [ ] HP percentage updates live as the troll is hit (from this tab or any other).
  - [ ] Kill the troll → banner disappears within ~1s without refresh.
  - [ ] Refresh the same thread post-kill → banner stays gone.
  - [ ] Spawn a troll, set a short `despawn_minutes`, wait for despawn → banner clears at TTL (within 250ms grace).
  - [ ] Replies still render live (the existing `replies` channel handler must not be regressed).
  - [ ] Tooltip rendering and reply submission unaffected (#50 / #54 contracts intact).
  - [ ] Mobile + desktop both verified.
- **Docs touched:** [`./features/forum-troll-gem.md`](./features/forum-troll-gem.md) — new "Post-view live render (#53)" section pinning the dual-sub architecture (global + thread-scoped) and the AppShell-mirroring contract as DO-NOT-BREAK invariants. This batch-log entry.
- **Rollback:** `git revert 536c6a7` then re-deploy KVM 4. Reverts to the pre-#53 ThreadDetailView with the latent UPDATE-to-killed and passive-despawn release bugs (the in-thread banner can stick on until next page load — same class of bug as the AppShell #47 issue but scoped to the thread view).
- **Why two subs (one global, one thread-scoped):** the global sub in AppShell drives `trollActive` for the gem-on glow + EventTicker banner across the whole app. The thread-scoped sub is filtered server-side on the realtime publication so a post-viewer doesn't pay for receiving every spawn event globally — only events for the thread they're on. They serve different UI elements; they're not redundant.

---

## #55 — Tooltip right-edge + user-info clipping on desktop
- **Status:** deployed (2026-04-26) — awaiting Cowork verification on `https://trade.d4jsp.org/`
- **Asked:** "this is the closest it's ever been but the right hand side of the tool tip is clipping only on pc phone is absolutely perfect" + "the user Info is clipping too now on computer"
- **Symptom (desktop only, mobile perfect):**
  - Tooltip flavor text and other text inside the tooltip clipping mid-word at the right edge ("Treat carefully on the plains of Hell, for each step sunders the soul and shatters the m...").
  - Seller-column username "THE COW KING" → "THE COW..." truncated instead of wrapping to 2 lines.
- **Root cause (#1 — tooltip text clip):** Wowhead's base CSS at [`../../public/css/wowhead-tooltip.css`](../../public/css/wowhead-tooltip.css) forces `white-space: normal !important` on tooltip tables/cells via a `@media (max-width: 599px)` rule. Mobile gets the override; desktop inherits default white-space behavior. Combined with `.wowhead-tooltip td { max-width: 500px }` from the same base CSS, table cells on desktop can render up to 500px wide — exceeding the locked 300px tooltip width — when content has long unbreakable runs. With our `feed-thumb { overflow: hidden }` (#50), the overflowing right edge gets visually clipped on preview cards. The same clip happens in post view but is less obvious because the post is a single tooltip, not a card grid.
- **Root cause (#2 — username clip):** Seller column is `width: 68px; padding-left: 8px` → 60px content area. Username at `fontSize: 9; font-family: Cinzel; text-transform: uppercase` with `wordBreak: 'break-word'`. `break-word` only kicks in for unbreakable single tokens; for "THE COW KING" it tries to break at spaces first. At desktop's font-rendering precision, "THE COW " can render ~62-65px (over the 60px), forcing wrap point earlier than expected — but the WebkitLineClamp:2 + overflow:hidden combo can show the truncated single line with ellipsis instead of a clean 2-line wrap. The `wordBreak: 'break-word'` doesn't help because the issue isn't an unbreakable word, it's a precision-of-fit issue.
- **Fix (#1):** Mirror the mobile wrap rule globally in `_injectBgOverride()`. New rules added:
  ```css
  .wowhead-tooltip[data-game="d4"] table,
  .wowhead-tooltip[data-game="d4"] th,
  .wowhead-tooltip[data-game="d4"] td {
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    max-width: 300px !important;  /* clamp at tooltip's locked width */
  }
  .wowhead-tooltip[data-game="d4"] .whtt-scroll * {
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
  }
  ```
- **Fix (#2):** Username `wordBreak: 'break-word'` → adds `overflowWrap: 'anywhere'` and `hyphens: 'auto'`. `overflow-wrap: anywhere` allows breaking at ANY character if no other break point makes content fit — guarantees the username will wrap rather than overflow at desktop precision.
- **Files touched:**
  - `components/D4Tooltip.js` — 2 new CSS rules + comment in `_injectBgOverride()`.
  - `components/HomeView.js` — 1 line update to the username `<span>` style.
  - `docs/features/tooltip.md` — #55 history entry, new "Desktop layout — DO NOT NARROW" subsection, DO NOT BREAK list bumped to 9 items.
- **Commits:**
  - `D4JSP/bd66237` — `fix(tooltip): preview-card right-edge clipping on desktop (#55)`
  - `D4JSP-Admin/1534a7f` — `docs: sync tooltip wiki #55 (mirrors D4JSP bd66237)`
  - `D4JSP-Build-Planner/96e5685` — `docs: sync tooltip wiki #55 (mirrors D4JSP bd66237)`
  - `D4JSP-Map/d8f49b7` — `docs: sync tooltip wiki #55 (mirrors D4JSP bd66237)`
- **Deployed:** KVM 4 via SSH. PM2 online, HTTP 200. JS bundle (`/.next/static/chunks/pages/index-*.js`) verified contains both new CSS rules.
- **Verification (checklist — to run via Cowork after deploy):**
  - [ ] Desktop preview card with long content (Mortacrux): all text visible inside locked frame, NO right-edge clipping. Flavor text wraps at the 300px boundary.
  - [ ] Desktop preview card with short content (Rakanoth): same, no clipping.
  - [ ] Desktop preview card right column: username "THE COW KING" visible (or wrapped to 2 lines), avatar + rank + replies + coin all visible.
  - [ ] Desktop post detail view: tooltip text wraps within 300px, no horizontal overflow.
  - [ ] Mobile: unchanged (still absolutely perfect).
  - [ ] All cards uniform height — #50/#54 wins must hold.
  - [ ] Bottom-fixed Buy Now / price / footer still anchored at bottom — #54 win must hold.
  - [ ] Card-resize slider behavior unchanged.
  - [ ] Hover-zoom popup, long-press popup unchanged.
- **Docs touched:**
  - updated: [`./features/tooltip.md`](./features/tooltip.md) — #55 history entry, new "Desktop layout — DO NOT NARROW the left panel" subsection, DO NOT BREAK item #9 added (desktop wrap rules).
  - mirror: tooltip.md to D4JSP-Admin / D4JSP-Build-Planner / D4JSP-Map.
- **Rollback:** `git revert <SHA>` then re-deploy KVM 4. Reintroduces desktop right-edge clip + username truncation.

---

## #58 — FG package placeholder artwork (queued)
- **Status:** queued (2026-04-26) — blocked behind #57.
- **Asked:** "also the FG package used to have proper images for alot of them. at some point placeholders were put in"; "probably on supabase in bucket."
- **Symptom:** FG package cards (350 / 660 / 1,380 / "NEW PACKAGE") all show generic D4JSP gold-coin placeholder art. Used to differ per-tier (small pouch / sack / treasure chest matching the tier names).
- **Likely cause:** the proper images live in a Supabase Storage bucket on the same project (`isjkdbmfxpxuuloqosib`) that both old and new hosts use. The `fg_packages.image_url` column rows likely got overwritten with placeholder paths during some admin edit / migration — the bucket files themselves should still exist.
- **Diagnosis steps (when work begins):**
  - `SELECT id, name, image_url FROM fg_packages` — current image_url values: are they `https://*.supabase.co/storage/...` URLs (resolution issue) or local paths like `/coins/default.png` (placeholder swap)?
  - `supabase.storage.listBuckets()` via service-role REST — find the bucket (`fg-packages` / `package-images` / `assets` / `images`).
  - List bucket contents — identify per-tier files.
  - For each package, build the public URL pattern: `https://isjkdbmfxpxuuloqosib.supabase.co/storage/v1/object/public/<bucket>/<file>`.
  - Verify each URL returns 200 + valid image bytes.
- **Fix path:** PATCH `fg_packages.image_url` per row to point at the real Storage objects. If files are missing entirely, flag for Adam to provide replacements.
- **Verification (planned):**
  - [ ] Each FG package card shows its unique artwork (visually different per tier).
  - [ ] Mobile + desktop both render correctly.
  - [ ] DB `image_url` values resolve to actual Storage objects (not placeholders, not 404).
- **Docs to touch:** `docs/admin/fg-packages-tab.md` (or wherever Buy FG admin lives) — clarify image_url field + Storage path. DO-NOT-BREAK: when adding a new FG package, image must be a real artwork file, not a placeholder.

---

## #57 — Stripe payment flow broken since KVM 4 migration (queued)
- **Status:** queued (2026-04-26) — top priority after #56 ships.
- **Asked:** "the forum gold payment doesn't do nothin.. and subscribe is now broken too.. it used to take us through our proper payment gate"; "not sure when it broke probably migration"; "maybe need to change stuff at stripe?"
- **Symptoms:**
  1. **Subscribe regression.** Click SUBSCRIBE on a tier → an in-page modal appears ("VERIFIED — Secure payment via Stripe", CANCEL / PAY NOW buttons). Clicking PAY NOW does nothing. Used to redirect to `https://checkout.stripe.com/...`.
  2. **Buy FG broken.** Clicking BUY NOW on the placeholder "NEW PACKAGE / $0" returns "Invalid package" (expected — placeholder). Other valid packages also fail to redirect to Stripe Checkout per Adam ("doesn't do nothin").
- **Likely root causes (KVM 4 migration suspect list, ranked):**
  1. **Stripe webhook endpoint URL still pointing at the old cloud host.** Stripe Dashboard → Developers → Webhooks. Endpoint should be `https://trade.d4jsp.org/api/stripe-webhook` (or whatever the current path is). If it's still the cloud-host URL, signature verification fails post-payment, payments don't complete back to our DB.
  2. **Stripe env vars missing or wrong on KVM 4.** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` (`NEXT_PUBLIC_*` if exposed), `STRIPE_WEBHOOK_SECRET`. Hostinger snapshot of `.env.production` may not have included these.
  3. **`fg_packages.stripe_price_id` and `subscription_tiers.stripe_price_id` reference stale price IDs.** If the Stripe account / mode (test vs live) changed, the old `price_*` ids return 400 from Checkout session creation.
  4. **`pages/api/create-checkout-session.js` (or equivalent) silently erroring** — client may be falling back to the in-page modal because the Checkout session URL returned empty/error.
- **Diagnosis steps (when work begins):**
  - SSH KVM 4 → `cat /opt/d4jsp/.env.production | grep -E '^STRIPE_' | awk -F= '{print $1}'` — list env var NAMES (don't print values).
  - Stripe Dashboard → Developers → Webhooks → confirm endpoint URL.
  - Stripe Dashboard → Developers → Logs → check for failed events on Adam's recent test attempts.
  - `curl -X POST https://trade.d4jsp.org/api/<checkout-endpoint> ...` with valid auth → inspect response.
  - Pull `fg_packages` and `subscription_tiers`, confirm `stripe_price_id` columns are populated and look like valid `price_*` ids.
- **Fix path:** likely combination of (a) fix webhook URL in Stripe Dashboard, (b) verify/restore env vars on KVM 4 from 1Password, (c) restore client-side Checkout redirect if the in-page modal is a code regression, (d) sync `stripe_price_id` if stale.
- **Verification (planned):**
  - [ ] Click SUBSCRIBE → redirects to `checkout.stripe.com/...` (not in-page modal).
  - [ ] Test-mode subscription completes → user `subscription_tiers` row updated, webhook delivery succeeds.
  - [ ] Click BUY NOW on a real package → redirects to Stripe Checkout.
  - [ ] Test purchase completes → FG balance increments via webhook, ledger row inserted.
  - [ ] "NEW PACKAGE / $0" still shows "Invalid package" (placeholder, expected).
  - [ ] Stripe Dashboard webhook log shows successful deliveries.
- **Docs to touch:** create `docs/integrations/stripe.md` (webhook URL, env var names, price-id sync procedure). Add to `docs/infra/kvm-4.md` an "After-migration checklist" section: Stripe webhook URL, OAuth redirect URIs, env vars — things to verify when moving the app between hosts.

---

## #56 — Remove redundant in-thread troll banner + restore HIT visibility
- **Status:** deployed (2026-04-26) — awaiting Cowork verification on `https://trade.d4jsp.org/`.
- **Asked:**
  - "different problem arose. can't kill the forum troll for some reason .. also we don't need the second troll thing that's right above the card.. just the top one"
  - "clicking hit doesn't do anything. m was working before"
- **Scope:** Two fixes in one pass.
  1. **Single global banner.** Remove the in-thread "A Forum Troll has appeared" banner from `ThreadDetailView` body. The AppShell-rendered "FORUM TROLL SIGHTED!" banner (top of screen, filtered by `selectedThreadId`) is the single source of troll-state UI in every view from now on.
  2. **HIT visible feedback.** Adam reported HIT clicks doing nothing. Diagnosis showed the API path and click handler are structurally unchanged from the working baseline (`b438f1f`); the most likely silent failure mode is a 4xx/5xx with a no-op response branch. Hardened `handleTrollHit` so EVERY failure path now produces a visible toast — auth missing, 401, 400 already-slain, 400 despawned, 404, 500, network error. This both restores user feedback AND gives a diagnostic surface on production so the actual regression cause is visible to Adam on next click.
- **Files touched:**
  1. [`../../components/ThreadDetailView.js`](../../components/ThreadDetailView.js) — removed `activeTroll` state, `_isTrollAlive`, `loadActiveTroll`, `huntTroll`, `refetchTrollRef`, `despawnTimerRef`, the thread-scoped `forum_trolls` realtime sub (INSERT/UPDATE/DELETE handlers), the despawn-timer `useEffect`, and the in-body banner JSX. Kept the `replies` realtime sub (separate concern). Net: ~110 lines removed. Pinned a comment at the JSX site explaining "do NOT add a per-thread banner back here" with pointer to docs.
  2. [`../../components/AppShell.js`](../../components/AppShell.js) — `handleTrollHit` now early-exits with a toast if `getToken()` returns falsy; reads the response with `.json().catch(() => ({}))` so a non-JSON 4xx/5xx body doesn't blow up; checks `r.ok && data?.ok` before optimistic updates; surfaces server `data.error` (or `Hit failed (HTTP <status>)` fallback) on any non-ok path; surfaces `err.message` on network error. Net: +14 lines, behavior-preserving on success path.
- **Why supersedes #53:** #53 hardened the in-thread banner's release path. #56 deletes the in-thread banner entirely. #53's value is preserved through the AppShell global sub (which already had its own #47 release-path contract; the global banner filtered by `selectedThreadId` updates live in this view from that sub).
- **Commits:**
  - `D4JSP/57b9c53` — `fix(troll): single global banner + visible HIT failure toasts (#56)`
  - `D4JSP-Admin/c9a35f4` + `D4JSP-Build-Planner/b92e57b` — doc mirrors.
- **Deployed:** KVM 4 via SSH `git fetch origin main && git reset --hard origin/main && npm run build && pm2 reload d4jsp`. PM2 reload `[d4jsp](0) ✓`, status `online`, uptime stable, HTTP 200 on `/`. `/api/forum-trolls` GET returns valid JSON (verified active troll row served).
- **Verification (checklist — to run AFTER deploy):**
  - [ ] Open a thread that has an active troll → ONLY the top "FORUM TROLL SIGHTED!" banner appears. No second "A FORUM TROLL HAS APPEARED" anywhere in the post body.
  - [ ] Click the HIT button on the top banner → either HP decrements visibly OR a toast appears with the failure reason. NEVER nothing.
  - [ ] If HP decrements: repeat clicks → 0 HP → troll dies → top banner clears → gem releases.
  - [ ] If a toast appears: read the message and report back — that's the smoking gun for the actual HIT regression.
  - [ ] Reply submission on the thread still works (we kept the `replies` sub).
  - [ ] Reply realtime delivery still works (post a reply from another tab → see it appear here).
  - [ ] Refresh during an active troll → top banner persists; refresh after kill → banner gone.
  - [ ] Mobile + desktop both verified.
- **Docs touched:** [`./features/forum-troll-gem.md`](./features/forum-troll-gem.md) — "Behavior — DO NOT BREAK" gains "Banners — single global banner only" subsection pinning the AppShell-only rule + #53 superseded; "Release-path contract" gains note that ThreadDetailView no longer participates. This batch-log entry. Removed the now-obsolete "Post-view live render (#53)" subsection (#53 was superseded before its docs SHA reached production).
- **Rollback:** `git revert <#56 SHA>` then re-deploy. Brings back BOTH the redundant in-thread banner AND the silent-failure HIT path. No DB schema changes.
- **If HIT still fails after deploy:** the visible toast should now make the cause obvious. Likely diagnostics it'll surface:
  - `Session expired — please sign in again` → `getToken()` returning null mid-session (auth-context regression).
  - `Hit failed (HTTP 401)` → token is being sent but server rejects — backend auth issue.
  - `Hit failed (HTTP 404)` → troll row gone (already despawned/killed by another user, race).
  - `Hit failed (HTTP 500)` + server error → backend regression in `/api/forum-trolls` POST hit handler.
  - `Hit network error: <message>` → connectivity / nginx / PM2 issue.

---

## #54 — Tooltip bottom-fixed pushed below frame on long-content preview
- **Status:** deployed (2026-04-26) — awaiting Cowork verification on `https://trade.d4jsp.org/`
- **Asked:** "instead of just hiding the stats flavour text or whatever can't fit to resize it's pushing the bottom of the tooltip out my but botton and stuff that's embedded in tooltip on preview"
- **Symptom:** On preview cards, items with long content (e.g. Mortacrux with multiple drop sources + flavor text + extra stats) clipped the WRONG end. The `.d4-bottom-fixed` area (Buy Now button, price, "X AGO • Y VIEWS • LADDER" footer) was getting pushed BELOW the visible 156px frame at preview scale 0.3, while the stats area at top filled all available visible space. Buy button invisible. Adam expected: stats clip if they exceed; bottom-fixed always visible at the bottom of the locked frame.
- **Root cause:** Layout shape from #50 used `.whtt-container { height: auto }` + `.whtt-scroll { flex: 1 0 auto; min-height: 380; max-height: 420 }`. With `height: auto`, the container size is the SUM of children's flex-resolved sizes. With `flex: 1 0 auto` (flex-shrink: 0) and `overflow: hidden` on the scroll-area in preview, flex's basis-resolution rules let the scroll-area's hypothetical size be content-driven (e.g. 500px for long items) under some conditions, making `max-height: 420px` ineffective at clamping. The container's auto-height absorbed the oversized scroll-area, total > 520, then `D4Tooltip.writeLayout` measured `inner.scrollHeight` past the locked target. Wrapper height exceeded `feed-thumb`'s 156px. The bottom-fixed sat below the visible 156, clipped by the parent's `overflow: hidden`. Post view didn't show this because `overflow-y: auto` (not hidden) interacts with flex's min-height-auto cascade differently — content > 420 simply scrolls inside the 420 box without expanding it.
- **Fix:** Restructure the height lock to be deterministic regardless of overflow setting:
  1. `.whtt-container` — change `height: auto !important` → `height: 520px !important`. Container size is now FIXED.
  2. `.whtt-scroll` — change `flex: 1 0 auto !important; min-height: 380px !important; max-height: 420px !important` → `flex: 1 1 0 !important; min-height: 0 !important; max-height: 420px !important`. With flex-basis: 0, hypothetical size is 0; with flex-grow: 1, scroll-area grows to fill container minus bottom-fixed (= 420). max-height: 420 is now consistent with the available space.
  3. Bottom-fixed (`.d4-bottom-fixed { flex-shrink: 0 }`) is unchanged — it sits at the bottom of the 520-tall container and can't be displaced. STRUCTURALLY anchored.
  4. Spacer system unchanged — `.whtt-spacer { flex: 1 1 auto }` inside `.whtt-scroll` continues to fill empty space below flavor for short content.
- **Files touched:** `components/D4Tooltip.js` (3 lines in `_injectBgOverride()`), `docs/features/tooltip.md` (contract section + DO NOT BREAK list updated for #54).
- **HomeView wrapper chain:** unchanged — `cardH = round(520 * scale) + 12`, `innerH = round(520 * scale)`, `feed-thumb height = round(520 * scale)`. The math already targeted 520; previously the tooltip was overshooting it. Now the tooltip stays exactly at 520, matching the wrappers.
- **Commits:**
  - `D4JSP/2c72c98` — `fix(tooltip): anchor bottom-fixed (Buy Now/price/footer) at bottom of locked frame (#54)`
  - `D4JSP-Admin/111e402` — `docs: sync tooltip wiki #54 (mirrors D4JSP 2c72c98)`
  - `D4JSP-Build-Planner/84c1334` — `docs: sync tooltip wiki #54 (mirrors D4JSP 2c72c98)`
  - `D4JSP-Map/93a27e9` — `docs: sync tooltip wiki #54 (mirrors D4JSP 2c72c98)`
- **Deployed:** KVM 4 via SSH `git fetch origin main && git reset --hard origin/main && npm run build && pm2 reload d4jsp`. Verified: PM2 online, HTTP 200, deployed JS bundle (`/.next/static/chunks/pages/index-*.js`) contains both new CSS rules.
- **Verification (checklist — to run via Cowork after deploy):**
  - [ ] Preview card with long content (Mortacrux) → Buy Now button + price + FG icon + "X AGO • VIEWS • LADDER" footer visible at the bottom of the frame. Stats / flavor / drop-sources may be clipped at the bottom of the SCROLL AREA above the bottom-fixed.
  - [ ] Preview card with short content (Rakanoth) → spacer fills middle of scroll area, Buy Now / price / footer at bottom of frame, all uniform card height with other cards.
  - [ ] Post detail view long content → unchanged (scrolls internally), bottom-fixed always visible at bottom of frame.
  - [ ] Post detail view short content → unchanged.
  - [ ] All cards uniform height — #50's win must hold.
  - [ ] Card-resize slider — cohesive resize unchanged.
  - [ ] Tooltip's visual appearance pixel-identical (colors, fonts, OCR injection, drop sources, gold/blue/gray colored span treatment).
  - [ ] Hover-zoom popup, long-press popup, click-to-thread, gem position — all unchanged.
- **Docs touched:**
  - updated: [`./features/tooltip.md`](./features/tooltip.md) — Locked-size contract section restructured to document `.whtt-container { height: 520px }` as THE single load-bearing rule; new "Bottom-fixed area — DO NOT clip" subsection; DO NOT BREAK list updated; #54 history entry.
  - mirror: tooltip.md to D4JSP-Admin / D4JSP-Build-Planner / D4JSP-Map.
- **Rollback:** `git revert <SHA>` then re-deploy KVM 4. Reintroduces the bottom-fixed-pushed-below regression on long-content preview cards.

---

## #52 — Troll spawn pool capped to top-page (10)
- **Status:** closed (2026-04-26)
- **Asked:** "change the setting for forum troll to only appear in one of the top page of posts.. 10 or whatever it is.." Then: "think it's set to latest 20 posts or sumtin now"
- **Scope:** Constrain spawn pool to the threads a hunter actually sees on page 1 of Latest Trades. Match `HomeView.js:402 PAGE_SIZE = 10`. Pure config change, no code, no deploy.
- **Diagnosis:** The field already exists. [`../../pages/api/quest-trigger.js:316-338`](../../pages/api/quest-trigger.js) `_pickRandomThread(spawnLocation, spawnLimit)` orders threads `created_at DESC` and `LIMIT spawnLimit`. `spawnLimit` is read from `quests.config.spawn_limit` with a fallback default of `20` ([`pages/api/quest-trigger.js:293`](../../pages/api/quest-trigger.js)). The `Summon forum troll` quest row had `config: {}` — empty — so it was using the legacy 20-default. Setting `spawn_limit: 10` on the quest row matches front-page size.
- **Fix (data-only):** Service-role PATCH on quest `8e715845-1caf-4cc3-bc7b-a11f8029d90d`:
  ```sql
  UPDATE quests
     SET config = jsonb_set(coalesce(config,'{}'::jsonb), '{spawn_limit}', '10', true)
   WHERE id = '8e715845-1caf-4cc3-bc7b-a11f8029d90d';
  ```
  (Performed via Supabase REST PATCH; result row confirmed `config: {"spawn_limit": 10}`.)
- **Commits:**
  - None (config-only — no code change required, the spine already supports this field).
  - `D4JSP/<docs SHA>` for batch-log + quests.md + quests-tab.md updates (this entry).
- **Deployed:** N/A — server reads `quests.config` per-request, takes effect immediately. Verified via REST GET that `Summon forum troll` row reflects the new value.
- **Verification (checklist):**
  - [x] `quests.config.spawn_limit = 10` confirmed in Supabase.
  - [x] Front-page size matches: `HomeView.js:402 PAGE_SIZE = 10`.
  - [ ] Spawn a forum troll → confirm `forum_trolls.thread_id` is one of the 10 most-recent thread ids (sample top-10 was logged in batch verify; spot-check after next spawn).
  - [ ] Older threads (page 2+) never receive a spawn.
  - [ ] To tune: admin Quests tab → `Summon forum troll` quest config → edit `spawn_limit`. No redeploy needed.
- **Docs touched:** [`./catalogs/quests.md`](./catalogs/quests.md) (`spawn_limit` description now pins the lock-step relationship with `PAGE_SIZE`). [`./admin/quests-tab.md`](./admin/quests-tab.md) (admin instructions for tuning the spawn pool size). This batch-log entry.
- **Rollback:** Service-role PATCH back to 20 (or unset → falls back to default 20):
  ```sql
  UPDATE quests SET config = config - 'spawn_limit'
   WHERE id = '8e715845-1caf-4cc3-bc7b-a11f8029d90d';
  ```
- **Why no code change:** the modular spine already exposes `spawn_limit` as a tunable. Adding "top_n" or "spawn_thread_pool" would have been duplicate config surface area for the same primitive. Keep the spine clean.

---

## #51 — Banner + gem stuck on after killing one troll while others alive
- **Status:** closed (2026-04-26)
- **Asked:** "nope fresh reload still stuck" / "even killed troll didn't reset" / "still says forum troll alive in banner too.. did that get stuck or sumtin and not even work?" → "just fix the fuckin thing already please" with explicit authorization for DB writes + push + deploy.
- **Scope:** Make the banner/gem-on state correctly track WHATEVER number of trolls are alive — not just "I killed one, why is everything still on?". Prevent it from happening again at spawn time.
- **Root cause:** Two problems, one underlying. When Adam clicked the gem rapidly during the #47/#49 iteration cycle, each click that hit the `gemTarget` chain successfully fired `forum_troll_spawned`. There was no concurrent-alive cap — only a `max_per_week` cap, which Adam hadn't hit yet. So **four** trolls ended up alive simultaneously in `forum_trolls` (rows `24f5a5cd…`, `b05033f1…`, `e9fe34b1…`, `ce5fb43f…`, all HP=3/3, `killed_at=null`, `despawn_at` in the future).
  - Killing ONE of them on its thread/ticker correctly set `killed_at` on that row, but `activeTrolls` (driven by `GET /api/forum-trolls` returning ALL alive rows) still had length 3, so `trollActive` (`activeTrolls.length > 0`) stayed `true`. Banner + gem stuck on. The release-path fix from #47 was working correctly — there were just other trolls still alive.
  - Underlying: at the modular-spine level, the `forum_troll_spawned` trigger config had no concept of "max simultaneously alive", only "max in 7 days". For a one-at-a-time troll experience, the spine needed a new config field.
- **Fix (code, server-authoritative):** [`../../pages/api/quest-trigger.js`](../../pages/api/quest-trigger.js) — between the subscription gate and the existing `max_per_week` weekly check, added a new gate that runs only for `trigger_id === 'forum_troll_spawned'`:
  - Reads `cfg.max_alive_concurrent` (defaults to `1` if unset).
  - Counts `forum_trolls` rows where `killed_at IS NULL AND despawn_at > NOW()`.
  - If `count >= max_alive_concurrent`, returns HTTP 429 with `{ blocked: 'concurrent_limit', limit, current, message }`.
  - Client side ([`../../components/AppShell.js`](../../components/AppShell.js) `handleGemClick`): existing `weekly_limit` toast handler extended to also handle `concurrent_limit` — surfaces the server's message ("Forum Troll already lurking. Hunt him down before summoning another." for the default cap of 1).
- **Fix (data, one-time cleanup):** Service-role PATCH on the 4 stuck alive rows in `forum_trolls`, setting `killed_at = NOW()` and `hp = 0`. Verified `GET /api/forum-trolls` then returned `{"trolls":[]}`. No structural DB change — those rows still exist for history, just no longer alive per the API filter.
- **Commits:**
  - `D4JSP/0204f6e` — `fix(troll-spawn): cap concurrent alive trolls (default 1) to prevent banner/gem stuck-on (#51)`
- **Deployed:** KVM 4 via SSH `git pull && npm run build && pm2 reload d4jsp`. Background task `bn9bcjc5n` confirmed PM2 online, build complete, HTTP 200.
- **Verification (checklist):**
  - [ ] Fresh page load with no troll alive — banner absent, gem in normal state.
  - [ ] Click gem repeatedly (try to spawn many trolls in a row) — first chain that hits `gemTarget` spawns ONE troll, banner appears, gem locks glow. Subsequent gem clicks while alive return 429 with `concurrent_limit` toast: "Forum Troll already lurking. Hunt him down before summoning another."
  - [ ] Kill the troll on its thread/ticker until HP=0 — banner gone, gem returns to normal within ~1s. Gem becomes clickable again.
  - [ ] Click gem after kill — fresh spawn allowed.
  - [ ] Refresh page during alive state — banner + gem-on persisted (server-driven). Refresh after kill — both gone.
  - [ ] Admin: edit `triggers` row for `forum_troll_spawned`, set `config.max_alive_concurrent = 3`, redeploy not needed (read each request). Spawn 3 trolls in a row → all succeed. 4th spawn → 429.
  - [ ] Admin: set `config.max_alive_concurrent = 0` or remove the field → falls back to default 1 (NOT unlimited — this is a stricter default than `max_per_week` because banner/gem UX assumes one-at-a-time).
  - [ ] Mobile + desktop both verified.
- **Docs touched:** [`./catalogs/triggers.md`](./catalogs/triggers.md) — `max_alive_concurrent` config field added to the `forum_troll_spawned`-only block. [`./admin/quests-tab.md`](./admin/quests-tab.md) — admin editing instructions added. This batch-log entry.
- **Rollback (code):** `git revert 0204f6e` then re-deploy. Brings back unlimited concurrent spawns. Existing `max_per_week` cap unaffected.
- **Rollback (data):** N/A — the 4 cleanup PATCHes can't be undone meaningfully (those troll instances were ghosts, not real gameplay state). If a row ever needs revival: `UPDATE forum_trolls SET killed_at = NULL, hp = 3 WHERE id = '<uuid>'` via SQL editor.
- **Why `max_alive_concurrent` defaults to 1, not unset/unlimited:** The banner + gem visual state is a global "is any troll alive" boolean (`activeTrolls.length > 0`). Multiple alive trolls are valid in the data layer but the UI is not built for it. Defaulting to 1 keeps UX coherent without requiring config to be set. Bumping to N is allowed if/when multi-troll UI ships.

---

## #49 — Gem stops responding after trade cards mount
- **Status:** closed (2026-04-26)
- **Asked:** "I just tried it when the page was loading trade cards wernt loseed it was working pushing up and down. maybe trade cards are blocking it.. cause they have push down hover animations too"
- **Scope:** Restore gem responsiveness during AND after card-list mount. Symptom: gem worked during initial paint (cards not yet rendered, "pushing up and down" visible), froze after cards loaded.
- **Root cause:** Two stacked issues, both fixed in one commit:
  1. **gemPos staleness on slow networks.** [`../../components/HomeView.js:438-461`](../../components/HomeView.js) `measure()` runs on mount + window resize + a 500ms `setTimeout`. None of those fire when the goblin banner image actually finishes decoding. On slow mobile / throttled network the image can paint AFTER the 500ms timeout, leaving `gemPos` stuck on a measurement against a 0-height image. The clickable gem then renders at a near-zero coordinate, far from the artwork's gem.
  2. **z-index headroom.** Gem at `zIndex: 107`, cards-section at `zIndex: 106` — only 1 step margin. Cards' framer-motion `whileHover` (translateY -1) and `whileTap` (scale 0.97) create per-card transform stacking contexts; combined with `marginTop: -48` pulling cards UP into the banner's vertical space, this margin was too tight. Cards mounting could occlude the gem visually or capture clicks at the boundary.
- **Fix:**
  1. Store `measure()` in `measureRef`; call it from the goblin `<img onLoad>` handler. Gem re-pins immediately when the image actually paints, regardless of network speed.
  2. Bump gem `zIndex` 107 → 109. Three steps above cards, one step below the header (`zIndex: 110` — do NOT cross, that's the #44 regression).
- **Commits:**
  - `D4JSP/00013a0` — `fix(troll-gem): re-measure on goblin image onLoad + z-index 107->109 (#49)`
- **Deployed:** KVM 4 via SSH `git pull && npm run build && pm2 reload d4jsp`. PM2 online, HTTP 200.
- **Verification (checklist):**
  - [ ] Fresh page load (cards not yet rendered) — gem clickable, click animation visible.
  - [ ] After cards mount — gem still clickable, click animation still visible (the regression Adam reported).
  - [ ] Throttle network to Slow 3G in dev tools, hard reload — gem still positioned correctly on goblin's gem (image-load late race).
  - [ ] Hover a trade card (whileHover translateY) — gem position unaffected, still clickable.
  - [ ] Tap a trade card (whileTap scale) — gem position unaffected, still clickable.
  - [ ] Mobile (~375 px) and desktop (~1440 px) both verified.
- **Docs touched:** [`./features/forum-troll-gem.md`](./features/forum-troll-gem.md) — new "Stacking context contract" subsection pinning the z=109 ceiling and the goblin onLoad re-measure as DO-NOT-BREAK invariants.
- **Rollback:** `git revert 00013a0` then re-deploy. Brings back z=107 + no onLoad re-measure (re-introduces #49 root causes on slow networks). The `backup/2026-04-26-pre-tooltip` tag is one commit behind 00013a0; rolling back to the tag drops this fix too.

---

## #48 — Pre-tooltip-fix backup tag
- **Status:** closed (2026-04-26)
- **Asked:** "make a backup state"
- **Scope:** Cheap rollback insurance before tooltip work begins. Git tag at current HEAD on all 4 repos, pushed to origin. No code change.
- **Tag:** `backup/2026-04-26-pre-tooltip`
- **Tag commits:**
  - `D4JSP/ac51586` (`docs: close #47; pin release-path contract + realtime-not-via-kvm-4 note`)
  - `D4JSP-Admin/956ea8a` (`docs: sync — close #47 + pin release-path + realtime-direct note`)
  - `D4JSP-Build-Planner/eae10b3` (`docs: sync — close #47 + pin release-path + realtime-direct note`)
  - `D4JSP-Map/29bd2ec` (`docs: sync — close #47 + pin release-path + realtime-direct note`)
- **Verification (checklist):**
  - [x] `git rev-parse backup/2026-04-26-pre-tooltip^{}` MATCH HEAD on all 4 repos
  - [x] Tag pushed to all 4 origins (visible in GitHub Releases / Tags)
- **Rollback procedure (use if tooltip work breaks something):**
  ```bash
  cd <repo>
  git fetch --tags
  git reset --hard backup/2026-04-26-pre-tooltip
  PAT=$(cat "C:/Users/Owner/Desktop/keyz/github-pat.txt" | tr -d '\r\n')
  git push --force "https://x-access-token:${PAT}@github.com/The-CowKing/<repo>.git" HEAD:main
  unset PAT
  # Then on KVM 4 for trade app:
  ssh -i .../d4jsp_kvm4_claude root@177.7.32.128 \
    "cd /opt/d4jsp && git fetch --tags origin && \
     git reset --hard backup/2026-04-26-pre-tooltip && \
     npm run build && pm2 reload d4jsp"
  ```
  Force-push warning: only safe because Adam authorized the rollback explicitly. Any commits made after the tag would be lost.

---

## #50 — Tooltip + outer card sizing fix (Option A+)
- **Status:** deployed (2026-04-26) — awaiting Cowork verification on `https://trade.d4jsp.org/`
- **Asked:** "push it see if we can fix it once and for all", "this isn't rocket science." Plus the full pinned contract from #48 diagnosis: tooltip outer dimensions locked, preview clips overflow, post scrolls overflow, short content shows empty space below flavor via the `whtt-spacer` system, all Latest Trades cards identical outer height.
- **Scope:**
  1. `components/D4Tooltip.js` — restore `min-height: 380px !important` (with `!important` on `max-height: 420px` for cascade safety) on `.wowhead-tooltip[data-game="d4"] .whtt-scroll`. Adds context-aware overflow rule `.feed-thumb .wowhead-tooltip[data-game="d4"] .whtt-scroll { overflow: hidden !important }` so preview cards clip while post view scrolls. Tooltip-only view mode (no `.feed-thumb` ancestor) defaults to scrollable per Adam's "yes that can be scrollable".
  2. `components/HomeView.js` — re-lock the preview-card wrapper chain. `feed-thumb` gets `height: 520*scale, overflow: 'hidden'`; card outer gets `height: cardH = 520*scale + 12`; content wrapper gets `height: 520*scale`; left panel gets `height: 520*scale, overflow: 'hidden'` (the `overflow:hidden` here also fixes the desktop title-behind-tooltip stacking — left panel's `zIndex:2` was bleeding past `leftPanelW` over the right panel's title at `zIndex:1`).
  3. `docs/features/tooltip.md` — new wiki page pinning the locked-size contract + spacer system + context-aware overflow + DO NOT BREAK subsection citing `03235db` (added) and `b0a8bea` (broke). Cross-linked from `start.md` and `forum-troll-gem.md`.
- **Defaults confirmed by Adam:**
  - Tooltip-only view mode (slider-resized) → scrollable.
  - Preview card → clipped, shows whatever fits the locked dimensions.
  - Bare-tip mode (slider ≥ 0.60) → still inside `.feed-thumb` → clipped (consistent with other preview behaviors).
- **Commits:**
  - `D4JSP/3b631a5` — `fix(tooltip): restore uniform-height contract + context-aware overflow (A+)`
  - `D4JSP-Admin/dd99c21` — `docs: sync tooltip wiki addition (mirrors D4JSP 3b631a5)`
  - `D4JSP-Build-Planner/1d6f8ec` — `docs: sync tooltip wiki addition (mirrors D4JSP 3b631a5)`
  - `D4JSP-Map/228628c` — `docs: sync tooltip wiki addition (mirrors D4JSP 3b631a5)`
- **Deployed:** KVM 4 via SSH `git fetch origin main && git reset --hard origin/main && npm run build && pm2 reload d4jsp`. Verified: PM2 online, HTTP 200, deployed JS bundle (`/.next/static/chunks/pages/index-*.js`) contains both new CSS rules.
- **Verification (checklist — to run via Cowork after deploy):**
  - [ ] DevTools → inspect any tooltip's `.whtt-scroll` → Computed shows `min-height: 380px` AND `max-height: 420px` AND `flex: 1 0 auto`.
  - [ ] Post detail view, long-content thread (Mortacrux): outer tooltip frame at locked max. Stats area scrolls internally. Outer frame does NOT exceed max.
  - [ ] Post detail view, short-content thread: outer frame at the same locked dimensions. Spacer-filled empty space pushes flavor / drop sources / footer to bottom. No scrollbar.
  - [ ] Preview card on Latest Trades, long-content item (Mortacrux): outer tooltip at locked dimensions. Content beyond the frame clipped (flavor / drop sources hidden). NO scrollbar visible. Scrolling inside the tooltip area does NOT work.
  - [ ] Preview card on Latest Trades, short-content item (Rakanoth): outer tooltip at locked dimensions. Content fits at top. Empty space below within locked frame. Card extends to locked card height.
  - [ ] All Latest Trades cards on the page render at pixel-identical outer height.
  - [ ] All tooltips inside those cards render at pixel-identical outer dimensions.
  - [ ] Drag the slider through full range — ALL cards on the page resize together cohesively.
  - [ ] Bare-tip mode (slider ≥ 0.60) — bare tooltip at the same locked dimensions.
  - [ ] Hover-zoom on a preview card (desktop) — unchanged.
  - [ ] Long-press on a preview card (mobile) — unchanged.
  - [ ] Card click → opens thread. Unchanged.
  - [ ] Tooltip's visual appearance pixel-identical to current (colors, fonts, borders, OCR injection, drop sources, price + buy-now button, gold/blue/gray colored span treatment).
  - [ ] Forum troll gem still anchored on the goblin's gem in the banner.
  - [ ] Desktop — title text on every card fully visible (no clipping by tooltip).
  - [ ] Mobile — tooltip on left, card info on right, all clean.
  - [ ] No console errors, no `ResizeObserver loop completed with undelivered notifications` regressions.
- **Docs touched:**
  - new: [`./features/tooltip.md`](./features/tooltip.md)
  - updated: [`../start.md`](../start.md) (Features TOC)
  - updated: [`./features/forum-troll-gem.md`](./features/forum-troll-gem.md) (Related cross-link)
  - mirror: tooltip.md to D4JSP-Admin / D4JSP-Build-Planner / D4JSP-Map per cross-repo wiki protocol.
- **Rollback:** `git revert <SHA>` then re-deploy KVM 4. Brings back per-card height variance + desktop title-behind-tooltip stacking. No DB or infra changes.

---

## #47 — Gem stuck on after troll kill or despawn
- **Status:** closed (2026-04-26)
- **Asked:** "I even killed the forum troll to see if it would release it didnt." Plus: "it used to be on the cloud hosting that's when it worked" (timeline correlation, not the actual mechanism).
- **Scope:** Make the gem release reliably on kill (server UPDATE sets `killed_at`) and on passive despawn (TTL expiry of `despawn_at`).
- **Root cause:** Pre-edit diagnosis confirmed two negatives:
  - Code (gem state machine in [`../../components/AppShell.js`](../../components/AppShell.js)) is structurally identical to the pre-migration good baseline `b438f1f`. No code revert needed.
  - KVM 4 infra is fine for realtime: Supabase realtime is **browser ↔ `wss://isjkdbmfxpxuuloqosib.supabase.co/realtime/v1/websocket` direct**, KVM 4's nginx is NOT in that path. KVM 4's local WS proxy headers + PM2 cluster mode don't affect troll-state realtime delivery. The cloud→KVM 4 timeline correlation isn't a causal mechanism here.

  Actual cause was client-side fragility:
  1. `handleTrollHit` only optimistically removed the troll on `data.killed === true`. On a 400 response (server says "already slain" or "despawned") or any other non-killed outcome, no client state update fired — gem stayed glow-stuck until the next refetch.
  2. Realtime UPDATE-to-killed delivery to anon clients depends on `forum_trolls` RLS policies that aren't in tracked migrations. If RLS filters the killed row out of anon's view post-update, the channel may receive no event (or a delete-from-view) and the existing handler relied on refetch firing only when an event arrived.
  3. Passive despawn (`despawn_at` expiry) has no DB row change at all — realtime stays silent. The 2-min poll catches it eventually but the user isn't waiting 2 min.
- **Commits:**
  - `D4JSP/3b4ebdf` — `fix(troll-gem): release path robust against realtime delivery + passive despawn (#47)`
- **Deployed:** KVM 4 via `git pull && npm run build && pm2 reload d4jsp`. PM2 online, HTTP 200, `/api/forum-trolls` still `Cache-Control: no-store`.
- **Verification (checklist):**
  - [ ] Fresh page load with no troll alive → gem clickable, normal state.
  - [ ] Click gem → spawn fires → banner appears → gem enters glow within ~1s.
  - [ ] Hit troll on its thread/ticker until HP=0 → gem releases within ~1s of the kill.
  - [ ] Set a short `despawn_minutes` on the quest config, spawn a troll, wait for despawn → gem releases when TTL expires (not 2 min later).
  - [ ] Refresh page after kill → gem stays off.
  - [ ] Multiple spawn/kill cycles in a row → no leftover state.
  - [ ] Mobile + desktop both verified.
- **Docs touched:** [`./features/forum-troll-gem.md`](./features/forum-troll-gem.md) "Behavior — DO NOT BREAK" gains a Release-path subsection. [`./infra/kvm-4.md`](./infra/kvm-4.md) gains a "Realtime path is browser↔Supabase direct" note so future bots don't chase nginx WS headers when troll state misbehaves.
- **Rollback:** `git revert 3b4ebdf` then re-deploy. Brings back the old fragile release path.

---

## #46 — Banner-only announcement, drop legacy spawn toast, weekly spawn limit
- **Status:** closed (2026-04-26)
- **Asked:** "the only announcement should be the banner saying he is lurking going forward.. too much call out bull shit right hand lower corner doesn't need... it's config should have how many times he can spawn a week too." Then revised: "the gem should have its usual click animation and just stay on when he's alive then back to normal when he's dead. pretty fuckin simple."
- **Scope:** Three independent visual elements going forward — click-anim (local), gem-on (realtime), banner (realtime). Drop the legacy bottom-right "Forum Troll summoned!" toast. Add admin-editable weekly spawn limit per the modular spine (no hardcoded values).
- **Commits:**
  - `D4JSP/642c6ab` — `feat(troll): banner-only announcement, drop legacy spawn toast, weekly spawn limit`
- **Deployed:** KVM 4 via `git pull && npm run build && pm2 reload d4jsp`. PM2 online, HTTP 200.
- **Verification (checklist):**
  - [ ] Click gem — usual click animation visible (the boost from #45 is intact).
  - [ ] Within ~1s of clicks reaching `gemTarget` — banner appears: "The Forum Troll is Lurking..." (or current copy).
  - [ ] Within ~1s — gem enters glow state (supplementary cue).
  - [ ] Bottom-right corner shows NO toast/shout-out for the spawn.
  - [ ] Refresh page while alive — banner still showing, gem still glowing.
  - [ ] Troll killed/despawned — banner gone, gem returns to normal.
  - [ ] Try to spawn past weekly limit — blocked with clear toast: "Forum Troll already spawned N time(s) this week (limit: M)."
  - [ ] Mobile and desktop both verified.
- **Docs touched:** [`./features/forum-troll-gem.md`](./features/forum-troll-gem.md) "Behavior — DO NOT BREAK" section pinning the three independent visuals + the new weekly limit. [`./catalogs/triggers.md`](./catalogs/triggers.md) — `max_per_week` config field. [`./admin/quests-tab.md`](./admin/quests-tab.md) — how admin edits the limit.
- **Rollback:** `git revert 642c6ab` then re-deploy. Brings back the spawn toast and removes the weekly limit. No DB schema changes (config is jsonb on existing `triggers` row).
- **Configuring the weekly limit:** admin UI → Quests tab → edit `forum_troll_spawned` trigger config → set `max_per_week` to an integer. Unset/null = no limit. Counts global spawns in the trailing 7 days across all users.

---

## #45 — `/api/forum-trolls` cache hides spawns + click-flash sub-perceptible
- **Status:** closed (2026-04-26)
- **Asked:** "the bottom shout out said spawned 0 animation 0 glow"
- **Scope:** (1) Drop the 20s cache on the forum-trolls API so realtime spawns aren't masked. (2) Make the click-flash actually perceptible on a small mobile gem.
- **Root cause:** `Cache-Control: public, s-maxage=20, stale-while-revalidate=10` on the GET response meant Hostinger/nginx returned the pre-spawn empty list for 20s after a spawn. Realtime fired AppShell's refetch, but the cached response stayed empty, so `activeTrolls.length` stayed 0 and `trollActive` never flipped. Separately, click-flash held for only 180ms with a 0.18s filter transition — brightness barely peaked before flipping back, sub-perceptible on mobile.
- **Commits:**
  - `D4JSP/bb200ce` — `fix(troll-gem): drop forum-trolls API cache + extend click-flash for mobile perception`
- **Deployed:** KVM 4. Verified `/api/forum-trolls` returns `Cache-Control: no-store`.
- **Verification (checklist):**
  - [ ] Click gem — flash visible (320ms hold, 0.06s transition).
  - [ ] Within ~1s of spawn — gem enters persistent glow.
  - [ ] No 20s delay between spawn and glow.
  - [ ] Mobile + desktop both verified.
- **Docs touched:** [`./features/forum-troll-gem.md`](./features/forum-troll-gem.md). [`./_doc-debt.md`](./_doc-debt.md) — persistent-glow item cleared.
- **Rollback:** `git revert bb200ce` then re-deploy. Restores the cache header (re-introduces #45 root cause).

---

## #44 — Gem moved off hero illustration (regression from #42)
- **Status:** closed (2026-04-26)
- **Asked:** "the gem is completely moved from on top on the hero.. get it back to its place!!!! it's anchored on the identical gem on the hero picture (latest trades) put it back to where it fuckin was"
- **Scope:** Restore the Latest Trades gem button to its overlaid position on top of the goblin's illustrated gem. Position is responsive (65.7% across, 81% down, 11% wide of the banner image's rendered dimensions, recomputed on resize) — already correct before #42; just got the layering wrong. Hard-won across mobile + desktop, preserve the math.
- **Root cause:** [`7e1febf`](https://github.com/The-CowKing/D4JSP/commit/7e1febf) reverts `zIndex: 9999` (introduced in #42) back to `zIndex: 107`. With z=9999 the gem rendered ABOVE the header (z=110), making it visually float up in the header bar. At z=107 it sits above cards (z=106) and the frame (z=105) but below the header — the header's screen area doesn't overlap the gem's computed position, so visual ordering is correct.
- **Commits:**
  - `D4JSP/7e1febf` — `fix(troll-gem): restore gem anchor on Latest Trades hero illustration (regression from 00ec198)`
- **Deployed:** KVM 4 via SSH `git reset --hard origin/main && npm run build && pm2 reload d4jsp`. Verified: PM2 online, `curl https://trade.d4jsp.org/` returns 200.
- **Verification (checklist):**
  - [ ] Open `https://trade.d4jsp.org/` on mobile (~375 px width). Gem visually overlays the goblin's illustrated gem in the Latest Trades banner (pixel-aligned with the artwork).
  - [ ] Open on desktop (~1440 px width). Gem still pixel-aligned with the goblin's gem.
  - [ ] Resize browser between widths — gem stays locked on the artwork, no jump.
  - [ ] Click gem — click-flash (bright purple glow + scale-down) fires.
  - [ ] Gem is NOT floating in the top header bar.
- **Docs touched:** [`./features/forum-troll-gem.md`](./features/forum-troll-gem.md) Layout subsection pinning the z-index ceiling + responsive anchor strategy. [`./_doc-debt.md`](./_doc-debt.md) follow-ups: persistent-glow cache fix + visual-regression snapshot.
- **Rollback:** `git revert 7e1febf` then re-deploy. Brings back z=9999 (gem floats in header). No DB or infra changes.
- **Out of scope (split into follow-up):** Persistent-glow-while-troll-alive does not actually persist — root cause is `Cache-Control: s-maxage=20` on `/api/forum-trolls` GET preventing realtime-driven refetch from seeing fresh INSERT. Fix is to set `Cache-Control: no-store` on that endpoint. Logged in [`./_doc-debt.md`](./_doc-debt.md).

---

## #43 — Wiki + memory architecture build
- **Status:** closed (2026-04-26)
- **Asked:** "make sure during work the old mds and old redundant information is removed... start.md is where index for all mds... a proper memory architecture of everything... protocols should be priority on the index too... batch protocols pushing etc... goal is never have to do a full audit again cause it should be constantly updated every push or save"
- **Scope:** Replace ad-hoc docs with a single cross-linked wiki rooted at `start.md`. Identical structure across D4JSP, D4JSP-Admin, D4JSP-Build-Planner, D4JSP-Map. Self-maintaining via batched `_doc-debt.md` protocol + verify-docs script + GH Action.
- **Commits:**
  - `D4JSP/cb6a995` — initial wiki rebuild (78 docs + verify-docs + workflow)
  - `D4JSP/52a99fe` — relax verify-docs file-ref check for cross-repo mirrors
  - `D4JSP/8767582` — accurate OCR cluster details (RapidOCR systemd cluster, NOT PaddleOCR/PM2) + Infra at-a-glance block in start.md
  - `D4JSP-Admin/0ec932e` + `D4JSP-Admin/c43ac83`
  - `D4JSP-Build-Planner/2023212` + `D4JSP-Build-Planner/caf7882` + `D4JSP-Build-Planner/4c0e85b`
  - `D4JSP-Map/61db359` + `D4JSP-Map/976c0c9`
- **Verification (checklist):**
  - [x] `npm run docs:verify` 0 hard fails in D4JSP (0 warnings)
  - [x] `npm run docs:verify` 0 hard fails in D4JSP-Admin (137 warnings expected — cross-repo refs)
  - [x] `npm run docs:verify` 0 hard fails in D4JSP-Build-Planner (147 warnings expected)
  - [x] `npm run docs:verify` 0 hard fails in D4JSP-Map (158 warnings expected)
  - [ ] start.md in each repo opens with the correct "You are in" block — Adam to spot-check
  - [ ] All legacy MDs removed in each repo — Adam to spot-check
- **Docs touched:** entire `docs/` tree across 4 repos (this is the doc-debt clear in itself)
- **Rollback:** `git revert <wiki commit SHA>` per repo. No migrations, no infra changes. Old docs are gone (intentional); restore from `git show HEAD~1:<path>` if anything is needed.

---

## #42 — Gem button regression fix
- **Status:** closed (2026-04-26)
- **Asked:** "last bot fucked up the gem button on latest trades... should stay pushed in for the duration to let players know he is alive... now the button is totally frozen still calls the troll but doesn't animate correctly"
- **Scope:** Restore the click-flash + persistent-pressed-glow visuals on the Latest Trades gem button.
- **Commits:**
  - `D4JSP/00ec198` — `fix(troll): restore gem click-flash + persistent-pressed glow`
- **Deployed:** KVM 4 via SSH `git pull && npm run build && pm2 reload d4jsp`. Confirmed `pm2 reload` returned `✓`.
- **Verification (checklist):**
  - [ ] Open `https://trade.d4jsp.org/`. Click the gem button at top of Latest Trades.
  - [ ] Confirm the click triggers a brief bright purple flash (`brightness(2.5)` + purple glow drop-shadow).
  - [ ] Wait until troll spawns (multiple clicks may be needed depending on gem target). Confirm the gem locks into a dim pressed state with subtle purple glow once a troll is alive.
  - [ ] Open another browser tab on the same site. Confirm the gem there also shows the pressed-glow state (realtime fan-out via `forum_trolls` publication).
  - [ ] Kill the troll (click on its thread card until HP=0) or wait for despawn. Confirm the gem releases (returns to normal unpressed state) within a few seconds.
- **Docs touched:** [`docs/features/forum-troll-gem.md`](./features/forum-troll-gem.md)
- **Rollback:** `git revert 00ec198` then re-deploy. No migrations, no infra changes. The previous version's bug (frozen gem) returns. Safe.

---

## Earlier history (folded from former PATCHES.md)

The numbered patches that landed earlier on 2026-04-26. Detail in [`docs/audits/2026-04-26.md`](./audits/2026-04-26.md) Recent state section.

| Patch | SHA(s) | Subject |
|---|---|---|
| 7 | (in flight) | Light/dark toggle in top menu |
| 6 | (Cloud, not in git) | Sub-site forums — bbPress rewrite flush + Forums menu entries |
| 5 | `D4JSP/758b2aa` | Gem-pressed CSS + widget route + cross-domain logout + AppShell/HomeView EOF |
| 4 | (Cloud, not in git) | WP hub batch — gate cache-bypass, logout cookie clear, logos, hero, tabs, exploits remove, latest-trades iframe |
| 3 | `D4JSP/c5849ae`, `D4JSP-Admin/65e8269` | Admin OAuth `redirectTo` uses `window.location.origin + pathname` |
| 2 | `D4JSP/b438f1f` | Gem v1 + ticker WAAPI + realtime sub on `forum_trolls` |
| 1 | (SQL, not in git) | `ALTER PUBLICATION supabase_realtime ADD TABLE forum_trolls` + `system_config` widget category |
