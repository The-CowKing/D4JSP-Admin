# Feature: Forum Troll Gem

The clickable gem on the Latest Trades header. Click it enough times and it spawns a forum troll: a `forum_trolls` row with HP, despawn timer, attached to a random thread, broadcast in realtime to every connected client. Hits the gem fast → flash. While a troll is alive → gem locks into a dim pressed glow. When the troll dies or despawns → gem releases.

## UI

- **Page:** `/` (Latest Trades home).
- **Mounted in:** [`../../components/AppShell.js`](../../components/AppShell.js) — gem state and click handler live here.
- **Rendered by:** [`../../components/HomeView.js:833-877`](../../components/HomeView.js) — the `<img>` element + the `gem-pressed` style block. The `<img>` is positioned absolutely at `gemPos` (computed from the banner image's bounding rect) with `zIndex: 9999` to beat the header (z=110), cards (z=106), and decorative frame (z=105).
- **States:**
  - **Idle:** no class, inline `transform: translate(-50%,-50%) scale(1)`, `filter: drop-shadow(0 0 8px rgba(139,92,246,0.5))`.
  - **Click flash (180 ms):** `gemFlash=true` → inline `scale(0.88)` + `filter: brightness(2.5) drop-shadow(0 0 6px #a855f7)`. **No `gem-pressed` class** — that's the regression that caused the frozen-gem bug; see [`../audits/2026-04-26.md`](../audits/2026-04-26.md) and `_batch-log.md` entry #42.
  - **Persistent pressed (troll alive):** `trollActive=true` → `className='gem-button gem-pressed'`. The class adds `transform: scale(0.88) !important` + `filter: brightness(0.85) drop-shadow(0 0 6px rgba(139,92,246,0.55)) !important`. The `!important` rules survive parent CSS overrides during a live troll. Inline values still apply for the click-flash window.
- **Click handler:** [`HomeView.js:837-841`](../../components/HomeView.js) sets `gemFlash=true` for 180ms then calls `onGemClick` (passed in from AppShell as `handleGemClick`).
- **Visual placeholder:** [`HomeView.js:886-888`](../../components/HomeView.js) renders a non-clickable static gem image inside the banner with `pointerEvents: 'none'`. Visible while `gemPos` is being measured (~500ms post-mount). The clickable absolute gem at z=9999 paints over it.

## Click → spawn flow

1. User clicks gem → `gemFlash=true`, `setTimeout(180)` to flip back, `onGemClick()` called.
2. `handleGemClick()` in [`AppShell.js`](../../components/AppShell.js) (search the file for `// Gem click mechanic`): increments `gemClicks`. If `gemClicks + 1 >= gemTarget`, fires:
   ```js
   POST /api/quest-trigger
     body { trigger_id: 'forum_troll_spawned' }
     headers Authorization: Bearer <user JWT>
   ```
   Then resets `gemClicks=0` and re-randomizes `gemTarget` from `gemConfigRef.current` (`min`/`max` from `triggers.config` for `forum_troll_spawned`, fetched on mount; non-admins use default 1–10 range).
3. `gemTarget` is loaded from `/api/admin/trigger-config?id=forum_troll_spawned` for admins; non-admins use default range. See [`../catalogs/triggers.md`](../catalogs/triggers.md) for trigger config shape.

## Server-side (POST /api/quest-trigger)

Route: [`../../pages/api/quest-trigger.js`](../../pages/api/quest-trigger.js).

1. Verifies user JWT.
2. Loads the `triggers` row, checks `enabled`, `expires_after`, `allowed_subscriptions` against the user's `subscription_tier`.
3. Loads all `quests` where `trigger_id='forum_troll_spawned' AND active=true`.
4. For each quest: upserts `quest_progress`, marks `completed=true` when `progress >= threshold` (currently hardcoded to `1` at line 138 — see [`../audits/2026-04-26.md`](../audits/2026-04-26.md) finding M-3).
5. On completion, calls `_grantQuestRewards()` which adds `fg_reward` + `xp_reward` to the user inline (note: bypasses `fg_ledger` — finding M-2).
6. Calls `_spawnForumTroll(questId, userId)` which inserts a row into `forum_trolls` with HP and despawn from `quest.config` (`clicks_to_kill`, `despawn_minutes`, `spawn_location`). Random thread is chosen via `_pickRandomThread()`.
7. Calls [`emitTrigger('forum_troll_spawned', userId)`](../../lib/triggerEngine.js) which dispatches `process_trigger` SQL → fires every `specials` matching the trigger.
8. If `triggers.config.recurring`, resets `cycle_start` to now.

## Realtime fan-out

`forum_trolls` is in the `supabase_realtime` publication (added by [`../../migrations/038_forum_trolls_realtime.sql`](../../migrations/038_forum_trolls_realtime.sql)). The subscription in [`AppShell.js:671-682`](../../components/AppShell.js):

```js
supabase
  .channel('forum-trolls-global')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_trolls' },
      (payload) => refetch('realtime:' + payload.eventType))
  .subscribe(...)
```

INSERT/UPDATE/DELETE all trigger one `GET /api/forum-trolls` → server returns currently-alive trolls → AppShell's `activeTrolls` state updates → HomeView's `trollActive` prop flips → gem applies/removes the `.gem-pressed` class.

A 2-minute fallback poll covers WS drops. On mount there's an immediate fetch so an existing troll lights the gem instantly without waiting for a realtime event.

## Killing a troll

User clicks the troll card on its attached thread. Handler `handleTrollHit` in [`AppShell.js:695-717`](../../components/AppShell.js):

```js
POST /api/forum-trolls
  body { action: 'hit', troll_id }
  headers Authorization: Bearer <user JWT>
```

Server decrements HP. When HP hits 0:
1. Removes the `forum_trolls` row.
2. Awards completion (`forum_troll_slain` trigger fires, granting `specials` to the killer).
3. Realtime DELETE event → all clients refetch → `activeTrolls` empties → gem releases.

## Admin settings

- **Admin tab:** Quests tab in `/admin-panel`.
- **Edit the trigger:** [`../endpoints/admin.md`](../endpoints/admin.md) `/api/admin/trigger-config?id=forum_troll_spawned`. Fields: `expires_after`, `cycle_start`, `recurring`, `on_expiry` (`auto_fire` | `deactivate`), `allowed_subscriptions` (array of tier ids; empty = all), plus the gem-specific `min` and `max` click-target range.
- **Edit the quest config:** Quests tab → edit the `forum_troll_spawned` quest. Fields on `quests.config`: `clicks_to_kill` (troll HP), `despawn_minutes`, `spawn_location` (`any` | `ladder` | `eternal` | `d4` | `d2r` | `d3`), `spawn_limit` (consider only N most recent threads in the category).
- **Add specials:** Specials tab → create rows where `trigger_id='forum_troll_spawned'` to grant FG/badges/XP on every spawn. Use [`../catalogs/specials.md`](../catalogs/specials.md) for schema.

## Data

- **`triggers`** row id `forum_troll_spawned` — see [`../catalogs/triggers.md`](../catalogs/triggers.md).
- **`quests`** rows where `trigger_id='forum_troll_spawned'` — see [`../catalogs/quests.md`](../catalogs/quests.md).
- **`specials`** rows where `trigger_id='forum_troll_spawned'` — see [`../catalogs/specials.md`](../catalogs/specials.md).
- **`forum_trolls`** — live troll rows. Schema: `id`, `spawned_by` (uuid), `quest_id`, `hp`, `max_hp`, `despawn_at`, `thread_id`. In `supabase_realtime` publication.
- **`quest_progress`** — per-user quest state.
- **`special_claims`** — append-only ledger of which user got which special grant.

## Endpoints

- [`POST /api/quest-trigger`](../endpoints/quests-triggers.md) — frontend fires the spawn.
- [`GET /api/forum-trolls`](../endpoints/quests-triggers.md) — list active trolls.
- [`POST /api/forum-trolls { action: 'hit' }`](../endpoints/quests-triggers.md) — kill a troll.
- [`POST /api/admin/trigger-config`](../endpoints/admin.md) — admin edit trigger config.
- [`POST /api/admin/quests`](../endpoints/admin.md) — admin edit quest.

## Gotchas

- **The `gem-pressed` class has `!important`.** Anything you set inline that conflicts with `transform` or `filter` will be ignored while the class is applied. The click-flash bright-purple glow only renders because the class is NOT applied during `gemFlash` — only during `trollActive`. Don't change that without re-thinking the visual stacking.
- **`gemPos` is measured ~500ms after mount.** Until then the absolute gem doesn't render. The decorative gem in the banner (with `pointerEvents: 'none'`) covers the gap visually. Don't delete the decorative gem.
- **`gemTarget` is randomized per spawn cycle.** Different users (or the same user across reloads) hit different click counts before triggering. Admins can see/set the `min`/`max` range via trigger config.
- **`process_trigger` is in Supabase, not in repo.** If you change reward grant logic, the function definition lives in the dashboard. Document the change here AND mirror to a migration file.
- **Quest threshold is hardcoded to 1.** Every gem-spawn currently auto-completes its quest in one click of the gem-target chain. To use `quests.requirements.threshold`, fix [`pages/api/quest-trigger.js:138`](../../pages/api/quest-trigger.js).

## Recent changes

- **2026-04-26 `00ec198`** — Restored click-flash + persistent-pressed glow. The previous commit (`c5d83c8`) had layered `.gem-pressed` on `gemFlash || trollActive`, masking click-flash visuals. Now the class applies only on `trollActive`. Bumped zIndex 107 → 9999 to clear header z=110.
- **2026-04-26 `758b2aa`** (Patch 5) — Bulletproof `.gem-pressed` class with `!important` rules. Persistent-press now survives parent CSS overrides.
- **2026-04-26 `b438f1f`** (Patch 2) — Realtime sub on `forum_trolls`, hydrate-on-mount, 2-min poll fallback.
- **2026-04-26 (Patch 1, SQL)** — `forum_trolls` added to `supabase_realtime` publication.

## Related

- [`./escrow.md`](./escrow.md) — sibling feature on Latest Trades feed
- [`./realtime.md`](./realtime.md) — full list of realtime channels
- [`./sell-pipeline.md`](./sell-pipeline.md) — what happens when a user uploads a screenshot
- [`../catalogs/triggers.md`](../catalogs/triggers.md) — trigger registry schema
- [`../catalogs/quests.md`](../catalogs/quests.md) — quest registry schema
- [`../catalogs/specials.md`](../catalogs/specials.md) — special grant schema
- [`../endpoints/quests-triggers.md`](../endpoints/quests-triggers.md) — `/api/quest-trigger`, `/api/forum-trolls`
- [`../admin/quests-tab.md`](../admin/quests-tab.md) — admin UI for editing
- [`../modular-system/overview.md`](../modular-system/overview.md) — full traced quest example
