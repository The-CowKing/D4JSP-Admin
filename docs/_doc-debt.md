# Doc Debt

Append-only list of documentation owed by recent code changes. **Empty this file before declaring any feature done.** If this file is non-empty at the start of a session, clearing it is the first task.

## Format

One line per item:
```
<SHA> · <surface area> · <what changed> · <doc to update>
```

## Current debt

*(empty)*

---

## How to use

1. **During active work / debugging**: hack fast, don't touch docs. Don't edit this file mid-iteration.
2. **When a commit changes architecture / API / UI / DB schema / infra / lib spine**: append a one-liner to this file describing what's owed.
3. **Before declaring a feature done**: clear this file by writing/updating the relevant docs. One batched commit, message format: `docs: update <area> after <feature>`.
4. **Don't end a session with this file non-empty.** Doc debt is a blocker for moving forward, not for moving fast.

## What counts as doc-relevant

Globs that trigger debt:
- `pages/**` (routes, page components) → likely debt on `docs/sitemap.md` + a `docs/features/*` page
- `pages/api/**` → debt on a `docs/endpoints/*` page
- `components/**` of consequence (AppShell, HomeView, AdminView, ProfileView, ThreadDetailView, AuthScreen) → debt on a `docs/features/*` page
- `migrations/**` → debt on `docs/data-model/migrations.md` and any affected `docs/catalogs/*` or `docs/data-model/*`
- `lib/triggerEngine.js`, `lib/sysConfig.js`, `lib/rankEngine.js`, `lib/auth-context.js`, `lib/supabase.js`, `lib/supabase-admin.js` → debt on `docs/modular-system/*` or `docs/auth/*`
- `next.config.js`, `server.js`, `ecosystem.config.js`, `.bat` deploy files → debt on `docs/infra/*`
- `package.json` dependency changes that matter → debt on `docs/conventions.md`

What does NOT count: typo fixes, comment-only changes, formatting, log-level tweaks, dependency bumps that don't change behavior.
