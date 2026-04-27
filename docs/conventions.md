# Conventions

Long-form version of the protocols section in [`../start.md`](../start.md). Both stay in sync; if they drift, start.md wins for the rules and this doc gets the rationale.

## ⚠ MAIN DIRECTIVE — Bot owns the database. Code + migration atomic.

Adam (verbatim): *"u always do supa base ur in charge of back end"* · *"u update the db when the update that requires it goes thru"* · *"make it main directive"* · *"no wonder nothing ever fucking works"* (re: deferring migrations to Adam).

### The rule

When a code commit requires a schema change, the bot APPLIES the migration directly. Code and DB ship together; never deploy code that depends on un-applied migrations.

### Workflow for any schema-touching commit

1. Write `migrations/NNN_description.sql`.
2. Apply it to production Supabase. Acceptable mechanisms:
   - `psql "<DATABASE_URL>"` if the DB password is available in `keyz/` or env.
   - `pg` Node client from KVM 4 with the DB password.
   - Supabase Management API (`api.supabase.com/v1/projects/<ref>/database/query`) with a personal-access token.
   - `exec_sql` SECURITY DEFINER RPC if installed.
3. Verify it landed: `pg_proc.proname` for functions, `pg_indexes.indexname` for indexes, `pg_publication_tables` for realtime publications, `information_schema.columns` for columns/constraints.
4. Then deploy the code to KVM 4.

### Hard prohibitions

- **NEVER** ship code that depends on un-applied migrations.
- **NEVER** defer migration application to Adam.
- *"Adam, please apply this in Supabase SQL editor"* is **FORBIDDEN**.

### When you are genuinely blocked (credentials missing)

If the bot literally cannot execute the SQL (no DB password, no Management PAT, no usable RPC), the bot must:

1. HALT the code deploy — do not push the dependent code change to KVM 4.
2. Report the blocker explicitly: which migration, which credential is needed, where the bot looked, what failed.
3. Wait for Adam to provide the missing credential (or to apply the SQL via the Supabase web SQL editor as a last-resort manual override).

This is the ONLY exception. Document the blocker in `_batch-log.md` so the next session can pick up.

### Why this rule exists

Adam: *"no wonder nothing ever fucking works"*. Migrations deferred to a human are migrations that don't get applied. Code deployments that depend on those migrations break in production with cryptic errors (PGRST202, undefined columns, missing RLS policies). The whole session degrades into "tell Adam to do step N" loops. Bot owns end-to-end or doesn't ship.

## ⚠ HARD RULE: Fixed-supply FG vault — NEVER create new gold

The 100,000,000,000 FG total supply is **fixed and immutable**. Every distribution comes from transitioning the existing pool between states; no path may ever push `circulating + reserved + burned > total_supply`.

Adam (verbatim): *"yeah shouldnt be able to create new gold.."*

**The four states:**
- **IN VAULT** (unminted) — derived: `total_supply − circulating − reserved − burned`. The bulk inventory pre-launch.
- **CIRCULATING** — held by users (sum of `users.fg_balance`).
- **RESERVED** — held in active escrow (`fg_vault.reserved`).
- **BURNED** — permanently destroyed (`fg_vault.burned`).

**Reconciliation invariant:** `total_supply = in_vault + circulating + reserved + burned`. Always.

### Allowed transitions
- **unminted → circulating** (Stripe purchase, signup grant, admin grant, quest grant)
- **unminted → reserved** (admin pre-allocates reward pool)
- **reserved → circulating** (escrow release to buyer; quest grant from pre-allocated pool)
- **circulating → reserved** (escrow lock when trade initiates)
- **reserved → unminted** (escrow refund to vault)
- **circulating → circulating** (user-to-user transfer; owner change only, total unchanged)
- **circulating → burned** / **reserved → burned** (admin burn, permanent)

### Forbidden
- **NEVER `UPDATE users SET fg_balance = ...` directly.** Bypasses vault accounting → phantom gold (#73 root cause).
- **NEVER INSERT a new row into `fg_vault` or any per-coin vault table.** The single aggregate row exists; never create more.
- **NEVER mint past `total_supply`.** `lib/grantFg.js` enforces the cap and throws on attempts.

### Implementation
All FG-credit code paths MUST use the canonical helpers in [`../lib/grantFg.js`](../lib/grantFg.js) — `grantFgFromVault`, `chargeFgToVault`, `grantXp`. The helper:
1. Inserts an `fg_ledger` audit row.
2. Updates `users.fg_balance` (with floor at 0).
3. Updates `fg_vault.circulating` in lockstep.
4. Refuses to mint past `total_supply`.

Full lifecycle, schemas, mint/grant/trade/burn flows, and audit follow-ups are documented in [`./numbered-fg-vault.md`](./numbered-fg-vault.md). That doc is the single source of truth for the FG money system; treat it as the contract.

Real money. Bugs here are fraud-vector territory. Move with rigor.

## ⚠ HARD RULE: Verified-working flip workflow — NEVER auto-flip

The "verified working" / "wired" / "green-lit" / "confirmed" switch on any catalog row (quests, triggers, specials, skills, badges, subscription tiers, fg_packages, ranks, etc.) is **flipped ONLY AFTER Adam confirms the feature works in production**.

Adam (verbatim): *"basically u just flip the switch once u know that quest is confirmed need to end working"*, *"I'll confirm it u flip em once we get to testing"*, *"this should all be noted in docs too . I've explained this so many times.."*. Pin in three places: this doc, [`../start.md`](../start.md), and the per-tab admin docs.

### What counts as a "verified" switch
- The wire-dot status (red/yellow/green) shown next to quest/requirement/reward rows in the admin Quests tab.
- The "NOT WIRED" / "WIRED" / connected badge on catalog rows.
- Any boolean column that conveys "this works in prod" — `verified_working`, `confirmed`, `is_wired`, `verified`, etc.
- Static `wired: 'red'/'green'` constants in `components/AdminView.js` (`QUEST_WIRED`, `REQUIREMENT_TYPES`, `REWARD_TYPES`).

### Why the rule exists
- FG is real money. A green light on the admin panel signals "this is paying out for real users." Auto-flipping based on bot internal verification (DB looks right, RPC fires) creates a false positive that hides actual prod regressions. Adam needs to TEST in prod and CONFIRM before the catalog reflects "verified."
- Adam has been burned by previous bots silently flipping these flags after their own internal "checks." This rule blocks the recurrence.

### Workflow
1. Bot diagnoses + ships fix + deploys to KVM 4.
2. Bot reports: "wired correctly per DB inspection; awaiting Adam's prod confirmation."
3. Adam tests in prod.
4. Adam confirms ("the spawn quest pays out FG now" / "kill quest works" / "reward landed in my balance").
5. **THEN** bot flips the switch — separate commit titled `verify(<scope>): flip switch on <id> after Adam's prod confirmation`.

### Hard prohibitions
- **Never bundle the flip with the fix.** Two commits — fix first, flip after confirmation.
- **Never flip on programmatic verification alone.** "DB rows look right" / "RPC fires without error" / "logs are clean" are NECESSARY but NOT SUFFICIENT.
- **Never change a static `wired` constant from red → green** without Adam's explicit confirmation that the feature works in prod.
- **Don't build new verified-working schema or admin UI.** The existing badges/columns are it. Adam: *"don't build new shit either the green lights and stuff are already there just needs to work correctly"*.

### When you're tempted to flip
Stop. Report status. Ask. Adam will tell you when to flip.

## Style

- **Concise.** Prefer "X is Y" to "X is generally Y in most cases."
- **No fluff.** No marketing language. No emoji.
- **Plain English.** Talk like a peer engineer, not a manual.
- **Real names always.** Don't say "imagine a feature called Foo" — use the actual feature.
- **Cite code with `path:line`.** Claims about behavior should point to the file that implements it.

## Commits

- **Single-purpose.** One commit per logical change. Don't mix bug fix + refactor + docs.
- **WHY not what.** "Restore gem click-flash glow that was masked by !important" beats "Update HomeView.js."
- **Co-authored trailers** OK. Always sign as `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` when this agent is the author.
- **No `--no-verify`.** Fix the hook failure. If a hook is wrong, fix the hook.
- **Never amend published commits.** New commits only.
- **Push to `main` only.** Worktree branches are invisible to deploy.

## Batching

- 5–10 small bugs that cluster by system → one numbered `Patch N` entry in [`./_batch-log.md`](./_batch-log.md).
- Bug fix + UI polish + a stale-doc cleanup → three commits, three entries.
- One refactor that touches 12 files but is one idea → one commit.

## Push / deploy

See [`./infra/deploy.md`](./infra/deploy.md) for full per-app deploy procedures. Headlines:
- Hostinger does NOT auto-deploy. Push to `main` then SSH + pull + build + reload.
- Use the inline-PAT push pattern from [`./infra/credentials.md`](./infra/credentials.md). Never persist PAT in git config.
- Verify deploy by checking `pm2 status` and a 200 response from the public URL.
- For sandbox sessions that can't egress to VPSes, use the `.bat` fire-and-forget pattern: [`./infra/deploy-bat-pattern.md`](./infra/deploy-bat-pattern.md).

## Doc updates (local wiki authoritative, git push opportunistic)

The wiki on disk is authoritative; git push for docs is opportunistic.

1. **Local wiki always current.** Update the relevant `docs/` page in the working tree as part of architectural changes. Don't defer.
2. **Doc debt is a working-tree concept.** Append to [`./_doc-debt.md`](./_doc-debt.md) when an architectural change is made; clear it in the working tree before declaring a feature done. The clear may or may not have a corresponding git commit yet.
3. **Doc commits to git happen when convenient.** Triggers:
   - Adam says to push (explicit ask).
   - End of a work session — bundle accumulated doc changes into one wrap-up commit.
   - Alongside the code commit they pertain to, if they're already staged.
   - NOT on every keystroke. NOT as a hard gate on feature-done.
4. **Reading wiki state — read the working tree, not git.** If you need fresh wiki context and there are uncommitted doc changes, that's correct. The local file IS the truth. `git show HEAD:<path>` is for archaeology only.
5. **Code-commit cadence is unchanged.** Code commits push to `main` immediately because deploy depends on it. Docs are decoupled — less stress on cadence.

The verify-docs script ([`../scripts/verify-docs.js`](../scripts/verify-docs.js)) runs in CI on every push to main. It checks file:line refs resolve, internal links resolve, named tables/routes/ports still exist in code. It runs against whatever is in the pushed bundle. Between pushes, local can be in any state.

## Hard never-do list

1. No `--no-verify`, no signing bypass, no skipping hooks unless explicitly authorized.
2. No destructive git (`reset --hard`, `push --force`, `branch -D`) without confirmation.
3. No timeouts/aborts as a root-cause fix. Diagnose why; only use timeouts as 90s wall-clock user safety nets.
4. No UI changes unprompted.
5. No hidden configs. Operational tunables go in `system_config` catalog, accessed via [`../lib/sysConfig.js`](../lib/sysConfig.js).
6. No new features outside the modular spine. Plug into existing catalogs.
7. No browser opening from this Claude Code session. Browser testing is Cowork's lane (Claude in Chrome MCP).
8. No async-process polling on mobile dispatch (`start_process`, `read_process_output`, `desktop-commander.start_process`). Synchronous bash + `.bat` fire-and-forget only.
9. No `.env*` commits. `.gitignore` should catch `.env*`.
10. Never amend published commits.
11. Never echo passwords/PATs/private keys into transcripts or commit messages.

## Workflow at session start

1. Read [`../start.md`](../start.md).
2. Read the **Live now** block at the top of [`./_batch-log.md`](./_batch-log.md).
3. Read [`./_doc-debt.md`](./_doc-debt.md). If non-empty, clearing it is the first task unless the user's ask is an emergency.
4. Map the user's ask to a feature/route/catalog → jump to the relevant page in `docs/`.

## Workflow at session end

1. All commits pushed to `main`.
2. SHAs reported.
3. `_doc-debt.md` is empty (or contains only items the user explicitly deferred).
4. `_batch-log.md` has a closed entry for what was done, with a Verification checklist for Adam.

## Reporting back to Adam

Standard close-out format includes the verification checklist inline. Cheap (~30 tokens) and saves Adam from digging:

```
Closed #42 (gem fix). Pushed 00ec198. Spot-check (2 min):
- [ ] /trades — click gem, click-flash visible
- [ ] After enough clicks, troll spawns and gem locks into pressed-glow state
- [ ] Banner appears on selected thread
- [ ] Wait/kill troll → gem releases
- [ ] forum_trolls row removed; quest_progress advanced
```

If multiple SHAs landed, list each. If `_doc-debt.md` is non-empty for a deliberate reason, say so.

## Verbal commands (recognized verbatim, not paraphrased)

These are hard-stop keywords. ANY bot in ANY session honors them the same way.

### "inbox" / "inbox this" / "inbox it" / "park it"

Adam wants the ask logged but NOT executed.

1. Append a one-liner to [`./_inbox.md`](./_inbox.md): `- YYYY-MM-DD HH:MM — [adam] <verbatim ask>` (use repo-local time).
2. Reply with: `Inboxed. <inbox count> waiting.`
3. DO NOT execute the ask.
4. DO NOT open a `_batch-log.md` entry — entries get created when work starts.
5. DO NOT propose batching unless the threshold (3+ related items in same area) AND Adam asks "what's in the queue?" or asks to ship a batch.

If a code session is mid-task and Adam fires "inbox X" mid-stream, the bot pauses just long enough to append the line, says "Inboxed. Resuming current task." and continues. Doesn't lose its place.

### "ship the inbox" / "batch the inbox" / "do the admin batch" / similar

Adam wants the queue processed.

1. Read [`./_inbox.md`](./_inbox.md). Group by area (UI page, catalog, endpoint, infra surface).
2. Propose one or more patches with items grouped: `Inbox has N items. Suggested groupings: ...`.
3. After Adam confirms a grouping, pull those items off `_inbox.md` (delete the lines), open one `_batch-log.md` entry covering them all, prime one executor, ship.

## Inbox processing (`_inbox.md`)

Adam fires fly-by asks when he notices something but isn't ready to commission a fix. They go to [`./_inbox.md`](./_inbox.md) as one-line entries. The orchestrator's job:

1. **Capture immediately:** when Adam pings about a small thing mid-feature, append to `_inbox.md` with timestamp + verbatim. Don't context-switch.
2. **Triage at session boundaries** or when the inbox crosses a threshold:
   - Single ask that fits one feature/endpoint → open a `_batch-log.md` entry, prime an executor, ship. Drop the inbox line.
   - 3+ related items in the same area → propose to Adam: "Inbox has N <area> fixes. Batch them?" On yes, drop all from inbox, open one `_batch-log.md` entry, prime one executor with all of them.
3. **Grouping heuristic:** same UI page/component, same catalog/endpoint family, same infra surface. Otherwise default to one-ask-per-patch.

## Unconfirmed-fix reminder

On every return-to-conversation, the orchestrator does a tiny pass:
1. Read top of `_batch-log.md`.
2. Find entries with status `closed` where the Verification checklist has unticked boxes AND `closed_at` was more than 12 hours ago.
3. If any, surface ONCE per session: `Heads up: N fixes still unverified — #X (<area>), #Y (<area>). Spot-check when you can.`

That's it. No polling. No nagging. One file read, ~50 tokens of summary. If Adam ticks the boxes (in `_batch-log.md` directly), the entry no longer surfaces.

## Orchestrator context discipline (priming protocol)

The orchestrator is responsible for context. Two rules.

**1. Reuse what's already loaded.** Anything the orchestrator has already read in this session — wiki pages, code files, recent batch-log entries, audit findings — stays in context. Do not re-Read or re-Grep it. Refer to existing memory first; reach for fresh reads only when:
- the info isn't in context yet
- the info might have changed since it was read (a commit landed, a fix shipped)
- a file:line cite is needed that wasn't captured earlier

Re-fetching information you already have wastes tokens and time.

**2. Executors start cold.** Sub-agents and spawned code tasks do NOT inherit orchestrator context. When you spawn one, inline the relevant context into its prompt: ask verbatim, relevant doc excerpts (or pointers with line ranges), affected files with current line refs, constraints, expected deliverable shape, verification checklist. A thin prompt = a fumbling executor.

**3. When session memory degrades** (long sessions, context compression starting), use the wiki + `_batch-log.md` as external memory. They exist for this — orchestrator's reference, not just new-bot onboarding. Read the relevant doc page fresh; stop trying to recall.

**Anti-pattern:** spawning an executor with "go figure out the gem button thing" and expecting good output. The orchestrator who does that has failed.

## How orchestrator-executor split works

D4JSP work runs in two tiers. Use this pattern for any non-trivial change.

**Tier 1 — Orchestrator** (chat-side Claude that Adam talks to):
1. Capture the ask. Open a `_batch-log.md` entry with status `open`.
2. Read context FIRST. start.md → relevant `docs/features/*`, `docs/endpoints/*`, `docs/catalogs/*` for the affected surface. Recent `_batch-log.md` entries. Recent commits via `git log --oneline -20 -- <path>`.
3. Build a primed prompt for the executor that contains: the ask verbatim, the relevant doc excerpts (or precise pointers with line ranges), the affected files with current line refs, the constraints (protocols, modular spine compliance, doc-debt rules), the expected deliverable shape, the Verification checklist.
4. Spawn the executor sub-agent with that prompt.
5. Receive result. Run the Verification checklist. Update `_batch-log.md`, clear `_doc-debt.md`, push, report SHA.

**Tier 2 — Executor** (focused sub-agent):
1. Read the primed prompt — assume the orchestrator already loaded the project context.
2. Execute the specific task. Don't reverse-engineer the project; trust the prompt.
3. Return a clean result: SHAs, files changed, anything left for the orchestrator to verify.

**Hard rule:** never spawn an executor with a thin prompt. If the executor has to grep around to find what catalog a feature uses, the orchestrator failed to prime it. The wiki exists exactly so the orchestrator can compose primed prompts in seconds.

### Worked example — gem button fix (`#42` in `_batch-log.md`)

- **Adam's symptom report (chat):** "last bot fucked up the gem button on latest trades... should stay pushed in for the duration to let players know he is alive... now the button is totally frozen."
- **Orchestrator did:** added entry #42 to `_batch-log.md`; read `docs/features/forum-troll-gem.md` and recent commits touching `components/AppShell.js` + `components/HomeView.js`; identified `c5d83c8` as the regression commit (`gem-pressed` class layered on `gemFlash || trollActive`); read the diff between `b438f1f` (last working) and HEAD; pinned the bug at `HomeView.js:850`.
- **Orchestrator's primed prompt to executor included:** the symptom verbatim, the diff between commit `b438f1f` and HEAD on `HomeView.js`, the `_batch-log.md` entry, file:line of the `className` ternary, the rule "no UI changes unprompted, single-purpose commit, push to main, report SHA," the Verification checklist (5 items).
- **Executor delivered:** committed `00ec198` flipping the className condition + zIndex bump, deployed via SSH to KVM 4, confirmed PM2 reload OK.
- **Total wall-clock:** under 10 minutes. No fumbling, no scope creep.

Without the wiki, that flow takes 30+ minutes per loop because the executor re-learns the project. With the wiki, the orchestrator hands over a focused prompt and the executor walks in already knowing what to do.

## See also
- [`../start.md`](../start.md) — front door, all TOCs
- [`./_batch-log.md`](./_batch-log.md) — the active QA checklist
- [`./_doc-debt.md`](./_doc-debt.md) — debt to clear before declaring done
- [`./glossary.md`](./glossary.md) — vocabulary
