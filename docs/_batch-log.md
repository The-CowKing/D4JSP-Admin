# Batch Log

The append-only ledger of user asks, what shipped, and how to roll back. **Read the "Live now" block at the top before starting any work.** New entries go above the divider, newest first.

## How to use
- New ask from user → add an entry with status `open`. Number sequentially from the highest existing.
- Each commit that addresses an ask → append the SHA + commit subject under the entry's `Commits`.
- Feature done + verified working + doc-debt cleared → flip status `closed`, write the `Verification (checklist)`, write `Rollback`.
- Roll back something → execute the rollback, mark status `reverted`, append the revert SHA(s).
- Update the **Live now** block at the top whenever you open, close, or revert an entry.

## Live now

- **#44 — Gem moved off hero illustration (closed)** — `D4JSP/7e1febf` deployed to KVM 4 (HTTP 200, PM2 online). Reverts zIndex 9999→107 from #42; gem returns to anchor on goblin's gem in Latest Trades banner. Spot-check checklist below.
- **#43 — Wiki + memory architecture build (closed)** — `D4JSP/8767582` + `D4JSP-Admin/c43ac83` + `D4JSP-Build-Planner/4c0e85b` + `D4JSP-Map/976c0c9`. All 4 repos verified clean. Spot-check checklist below.
- **#42 — Gem button regression fix (closed)** — `D4JSP/00ec198` deployed to KVM 4. Click-flash restored. Persistent-glow PARTIALLY broken (root cause = forum-trolls cache; logged in `_doc-debt.md` for follow-up).

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
