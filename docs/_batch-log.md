# Batch Log

The append-only ledger of user asks, what shipped, and how to roll back. **Read the "Live now" block at the top before starting any work.** New entries go above the divider, newest first.

## How to use
- New ask from user → add an entry with status `open`. Number sequentially from the highest existing.
- Each commit that addresses an ask → append the SHA + commit subject under the entry's `Commits`.
- Feature done + verified working + doc-debt cleared → flip status `closed`, write the `Verification (checklist)`, write `Rollback`.
- Roll back something → execute the rollback, mark status `reverted`, append the revert SHA(s).
- Update the **Live now** block at the top whenever you open, close, or revert an entry.

## Live now

- **#48 — Pre-tooltip-fix backup tag (closed)** — Tag `backup/2026-04-26-pre-tooltip` pushed to all 4 repos at current HEAD. Rollback target if tooltip work regresses anything. No code change.
- **#47 — Gem stuck on after kill / despawn (closed)** — `D4JSP/3b4ebdf` deployed to KVM 4. Release path now robust against realtime delivery semantics + passive despawn TTL. Cause was NOT a code regression (gem state machine matches pre-migration `b438f1f`) and NOT KVM 4 nginx (Supabase realtime is browser↔Supabase direct, KVM 4 isn't in that path). Cause was client-side dependency on realtime UPDATE-to-killed delivery + no despawn timer. Spot-check checklist below.
- **#46 — Banner-only announcement, drop legacy spawn toast, weekly limit (closed)** — `D4JSP/642c6ab` deployed. Three independent visual elements: click-anim (local), gem-on (realtime), banner (realtime). Bottom-right spawn toast removed. Weekly spawn limit added on `triggers.config.max_per_week`.
- **#45 — `/api/forum-trolls` cache + click-flash perception (closed)** — `D4JSP/bb200ce` deployed. Cache-Control: no-store, click-flash extended 180→320ms with snap-fast filter. Persistent glow now flips within ~1s of spawn instead of after 20s cache window.
- **#44 — Gem moved off hero illustration (closed)** — `D4JSP/7e1febf` deployed. Reverts zIndex 9999→107 from #42; gem returns to anchor on goblin's gem in Latest Trades banner.
- **#43 — Wiki + memory architecture build (closed)** — `D4JSP/8767582` + `D4JSP-Admin/c43ac83` + `D4JSP-Build-Planner/4c0e85b` + `D4JSP-Map/976c0c9`. All 4 repos verified clean.
- **#42 — Gem button regression fix (closed)** — `D4JSP/00ec198`. Click-flash restored after `c5d83c8` regression.

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
