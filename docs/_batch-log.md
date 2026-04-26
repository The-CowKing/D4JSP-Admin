# Batch Log

The append-only ledger of user asks, what shipped, and how to roll back. **Read the "Live now" block at the top before starting any work.** New entries go above the divider, newest first.

## How to use
- New ask from user → add an entry with status `open`. Number sequentially from the highest existing.
- Each commit that addresses an ask → append the SHA + commit subject under the entry's `Commits`.
- Feature done + verified working + doc-debt cleared → flip status `closed`, write the `Verification (checklist)`, write `Rollback`.
- Roll back something → execute the rollback, mark status `reverted`, append the revert SHA(s).
- Update the **Live now** block at the top whenever you open, close, or revert an entry.

## Live now

- **#43 — Wiki + memory architecture build (in-progress)** — D4JSP wiki being built; mirror to siblings pending. Doc-debt may be open during work.
- **#42 — Gem button regression fix (closed)** — `D4JSP/00ec198` deployed to KVM 4. Verification checklist below — Adam to spot-check on prod.

---

## #43 — Wiki + memory architecture build
- **Status:** in-progress (2026-04-26)
- **Asked:** "make sure during work the old mds and old redundant information is removed... start.md is where index for all mds... a proper memory architecture of everything... protocols should be priority on the index too... batch protocols pushing etc... goal is never have to do a full audit again cause it should be constantly updated every push or save"
- **Scope:** Replace ad-hoc docs with a single cross-linked wiki rooted at `start.md`. Identical structure across D4JSP, D4JSP-Admin, D4JSP-Build-Planner, D4JSP-Map. Self-maintaining via batched `_doc-debt.md` protocol + verify-docs script + GH Action.
- **Commits:** *(append SHAs as they land)*
- **Verification (checklist, fill in on close):**
  - [ ] `npm run docs:verify` passes 0 errors in D4JSP
  - [ ] `npm run docs:verify` passes 0 errors in D4JSP-Admin
  - [ ] `npm run docs:verify` passes 0 errors in D4JSP-Build-Planner
  - [ ] `npm run docs:verify` passes 0 errors in D4JSP-Map
  - [ ] start.md in each repo opens with the correct "You are in" block
  - [ ] `_batch-log.md` exists in each repo with this entry mirrored
  - [ ] All legacy MDs removed in each repo (no `LOG.md`, `MEMORY.md`, `QUEUE.md`, `STATUS.md`, ad-hoc `docs/*` from before this build)
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
