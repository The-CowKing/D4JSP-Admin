# Feature: Forum Troll Gem

The clickable gem on the Latest Trades hero illustration. Click it enough times and it spawns a forum troll: a `forum_trolls` row with HP, despawn timer, attached to a random thread, broadcast in realtime to every connected client. While a troll is alive → gem locks into a dim pressed glow AND the EventTicker banner shows "The Forum Troll is Lurking..." When the troll dies or despawns → both release.

## Behavior — DO NOT BREAK (#46 contract)

Three independent visual elements. Each has a different state source. Don't bind them together; don't introduce a fourth.

| Element | Driven by | Renders | Notes |
|---|---|---|---|
| **Click animation** | local `gemFlash` state in [`../../components/HomeView.js`](../../components/HomeView.js) | brightness(2.5) + drop-shadow purple + scale(0.88) for 320ms (filter snap-in 0.06s) | Fires on every click. Independent of realtime. Restored in #45 / `bb200ce` after a c5d83c8 regression. |
| **Gem-on / glow** | realtime `trollActive` (= `activeTrolls.length > 0` in AppShell) | `.gem-pressed` class — brightness(0.85) + drop-shadow + scale(0.88) `!important` | Continuous while troll alive. Supplementary cue, not primary announcement. |
| **Banner** | same realtime `trollActive` | EventTicker scrolling marquee with "🧌 The Forum Troll is Lurking..." | **Primary announcement.** Single source of UI feedback for spawn. |

**Deprecated, do NOT re-introduce:**
- Bottom-right corner toast/shout-out for troll spawn ("🧌 Forum Troll summoned!"). Removed in #46. The banner is the announcement; toast was redundant noise per Adam.
- Any other troll-spawn signal beyond the three above.

The kill toast ("⚔️ Forum Troll slain! First Blood!") is a separate event (user achievement on kill) and remains in place.

## Spawn rate limit (#46)

- **Config field:** `triggers.config.max_per_week` (jsonb integer).
- **Scope:** GLOBAL — counts spawns across all users in the trailing 7 days.
- **Default:** unset/null = no limit.
- **Enforcement:** server-side in [`../../pages/api/quest-trigger.js`](../../pages/api/quest-trigger.js). When the count hits the limit, returns HTTP 429 with `{ blocked: 'weekly_limit', limit, current, message }`. Frontend surfaces the message via `showToast(_, 'err')`.
- **Edit via:** admin Quests tab → trigger config for `forum_troll_spawned`. See [`../admin/quests-tab.md`](../admin/quests-tab.md).
- **Don't hardcode the value** — the modular spine requires admin-editability.

## Stacking context contract (#49)

The gem's clickability across page-load lifecycle depends on two invariants. **DO NOT change either without re-testing both during-load and after-cards-loaded.**

1. **`zIndex: 109` on the clickable gem `<img>`.** Three steps above cards-section (`zIndex: 106`) and one step below the header (`zIndex: 110`).
   - Card stacking budget: cards-section at z=106 contains all cards. Cards use framer-motion `whileHover` (translateY -1) and `whileTap` (scale 0.97), each creating per-card transform stacking contexts bounded by z=106. With `marginTop: -48` pulling cards up into the banner area, a 1-step margin (z=107 vs z=106) was too tight (#49 regression). z=109 gives 3 steps of headroom.
   - Header upper bound: header is `zIndex: 110`. Crossing 110 makes the gem float into the header bar (the #44 regression). 109 is the ceiling.
   - **DO NOT raise to z=9999 or any value ≥110**, and DO NOT lower below 109 without verifying card-mount no longer occludes.

2. **`<img src="/images/latest-trades-goblin.png" onLoad={() => measureRef.current?.()}>`.** The gem position (`gemPos`) is computed from the goblin image's bounding rect at 65.7%/81%/11%. On slow mobile / throttled network the image can decode AFTER the 500ms `setTimeout` re-measure fires, leaving `gemPos` stuck on a 0-height measurement. The `onLoad` handler re-runs `measure()` synchronously when the image paints — not optional, **DO NOT remove**.
   - `measureRef` is a stable ref set inside the `useEffect` that owns `measure()`. The effect is deps-empty (mount-only) so the ref is stable for the component's lifetime.

## Cache contract for `/api/forum-trolls`

`Cache-Control: no-store` on the GET. **DO NOT re-add `s-maxage` / `stale-while-revalidate`** — the 2-min idle poll on a single-row select is cheap, and any cache window will mask realtime spawns (the empty list gets cached pre-spawn and returned post-spawn until expiry). #45 root cause.

## Release-path contract (#47)

`trollActive` MUST flip false on three independent triggers. The client is responsible for catching all three; do NOT depend on Supabase realtime alone.

1. **Kill (server UPDATE sets `killed_at`):** `handleTrollHit` always calls `refetch('hit-after')` after the server responds, regardless of `data.killed` / `data.ok`. The refetch hits `/api/forum-trolls` GET which filters out killed rows, so the next `setActiveTrolls(...)` excludes the dead troll.
2. **Passive despawn (TTL expiry of `despawn_at`):** when `setActiveTrolls` lands an alive troll, a `setTimeout` is scheduled at `min(despawn_at) - now() + 250ms` that fires `refetch('despawn')`. No DB event is needed; the timer is the trigger.
3. **Defensive client-side filter:** in `refetch`, the response is filtered through `isAlive(t) = !t.killed_at && new Date(t.despawn_at) > now()` before `setActiveTrolls`. Even if the API mistakenly includes a dead row (cache, RLS quirk, replay), the client refuses to display it as alive.

Realtime is a fast hint, NOT the source of truth. RLS on `forum_trolls` isn't in tracked migrations — anon clients may or may not receive UPDATE-to-killed events depending on policy. The client refetches on every realtime payload but doesn't trust the payload's `new` row to derive state.

**DO NOT remove the despawn `setTimeout` or the `isAlive` filter.** Both are #47's release-path safety net. Removing either re-introduces the gem-stuck-on regression.

## Banners — single global banner only (#56 contract — supersedes #53)

There is **exactly one** troll-state banner in the entire app. It lives in `AppShell.js` and renders only when `selectedThreadId` matches an alive troll's `thread_id`. Both the post-detail view and any other view that sets `selectedThreadId` see this single banner; **do NOT add a per-view variant**.

History:
- #46 introduced the EventTicker scrolling banner as the spawn announcement (kept).
- #53 added a thread-scoped realtime sub + an in-thread "A Forum Troll has appeared" banner inside `ThreadDetailView` body for live spawn render. **Superseded.**
- #56 (Adam: "we don't need the second troll thing that's right above the card.. just the top one") removed the in-thread banner + its thread-scoped sub + the despawn timer + `huntTroll` from `ThreadDetailView`. The AppShell global sub already keeps `activeTrolls` fresh; the AppShell-rendered "FORUM TROLL SIGHTED!" banner shows up wherever the user is on a thread that has a troll.

**DO NOT** add any new `forum_trolls` realtime subscription, `activeTroll` state, in-thread banner JSX, or `huntTroll` handler back into `ThreadDetailView` (or any non-AppShell component). The AppShell global sub at `forum-trolls-global` channel + `selectedThreadId`-filtered render in `AppShell.js` is the single source of UI truth.

If a future requirement needs richer per-thread troll UX (e.g., per-troll animation), implement it inside the AppShell render path — not by adding a second sub.

## HIT failure feedback contract (#56)

`AppShell.handleTrollHit` MUST surface a visible toast on every non-success path. The original code dropped non-`ok` responses into a no-op branch which manifested as Adam's "clicking hit doesn't do anything" regression. Pinned paths:

| Cause | Branch | User toast |
|---|---|---|
| `getToken()` returns falsy | early return | "Session expired — please sign in again to hunt." |
| HTTP `r.ok && data?.ok && data.killed` | optimistic remove + quest text or "⚔️ Forum Troll slain! First Blood!" | (positive — kept) |
| HTTP `r.ok && data?.ok` (HP decrement) | merge HP into state | (no toast — silent positive update) |
| Any other response | server `data.error` if present, else `Hit failed (HTTP <status>)` | visible 'err' toast |
| `try/catch` network error | catch | `Hit network error: <err.message>` |

**DO NOT remove the visible-failure toasts.** They're both UX (user knows the click registered) and a diagnostic surface — when something breaks in this path again, the toast tells us the cause without requiring browser dev tools.

## UI

- **Page:** `/` (Latest Trades home).
- **Mounted in:** [`../../components/AppShell.js`](../../components/AppShell.js) — gem state and click handler live here.
- **Rendered by:** [`../../components/HomeView.js:833-877`](../../components/HomeView.js) — the `<img>` element + the `gem-pressed` style block. The `<img>` is positioned absolutely at `gemPos` (computed from the banner image's bounding rect) with `zIndex: 107`.

## Layout — DO NOT MOVE (#44 contract)

The gem is anchored on top of the goblin's illustrated gem in the Latest Trades banner. Position is responsive and was hard-won across mobile and desktop. Don't change it without re-verifying both breakpoints.

### Anchor strategy
- **Computed in** [`HomeView.js:438-458`](../../components/HomeView.js) `useEffect` `measure()` function.
- **Math:**
  ```js
  setGemPos({
    top:  iRect.top  - pRect.top  + iRect.height * 0.81,
    left: iRect.left - pRect.left + iRect.width  * 0.657,
    size: iRect.width * 0.11,
  });
  ```
- `iRect` = banner image (`/images/latest-trades-goblin.png`) bounding rect.
- `pRect` = nearest positioned ancestor (the `motion.div` wrapper at `position: relative`).
- **Percentages** (do NOT change without re-measuring against the artwork): `65.7%` across, `81%` down, `11%` wide. These pin the gem on the goblin's central illustrated gem at every viewport width because they're percentages of the rendered image, not of the viewport.
- **Recomputes on** mount, `window.resize`, and a 500ms post-mount retry (covers slow image load).

### Z-index rule
- **`zIndex: 107`** — sits above cards (z=106) and the decorative frame (z=105) but BELOW the header (z=110).
- **DO NOT raise above the header** (e.g. 9999). The header's screen area doesn't overlap the gem's computed position (the gem lives inside the banner area which is below the header on screen). Raising z above 110 makes the gem visually float up in the header bar near the avatar — that was the #44 regression. If the gem ever appears truly clipped by the header, the fix is to relocate `gemPos`, NOT to raise z.

### Responsive verification points
- **Mobile (~375 px width)** — gem must overlay the goblin's illustrated gem.
- **Desktop (~1440 px width)** — same.
- **Resize between** — gem must stay locked, no jump.
- The percentage-based math handles all of these automatically; if it visually drifts, suspect (a) `iRect` is being measured before the image fully loads, or (b) the parent stacking context shifted.

### Static placeholder
[`HomeView.js:886-888`](../../components/HomeView.js) renders a non-clickable decorative gem inside the banner div with `pointerEvents: 'none'`, positioned at `left: 65.7%, top: 81%, width: 11%`. Same percentages as the clickable gem. Visible during the ~500 ms before `gemPos` is measured. The clickable absolute gem paints over it once measured.
- **States:**
  - **Idle:** no class, inline `transform: translate(-50%,-50%) scale(1)`, `filter: drop-shadow(0 0 8px rgba(139,92,246,0.5))`.
  - **Click flash (180 ms):** `gemFlash=true` → inline `scale(0.88)` + `filter: brightness(2.5) drop-shadow(0 0 6px #a855f7)`. **No `gem-pressed` class** — that's the regression that caused the frozen-gem bug; see [`../audits/2026-04-26.md`](../audits/2026-04-26.md) and `_batch-log.md` entry #42.
  - **Persistent pressed (troll alive):** `trollActive=true` → `className='gem-button gem-pressed'`. The class adds `transform: scale(0.88) !important` + `filter: brightness(0.85) drop-shadow(0 0 6px rgba(139,92,246,0.55)) !important`. The `!important` rules survive parent CSS overrides during a live troll. Inline values still apply for the click-flash window.
- **Click handler:** [`HomeView.js:837-841`](../../components/HomeView.js) sets `gemFlash=true` for 180ms then calls `onGemClick` (passed in from AppShell as `handleGemClick`).
- **Visual placeholder:** see Layout section above.

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

- **2026-04-26 `7e1febf`** — Reverted zIndex 9999 → 107 (regression #44). 9999 made the gem float above the header detached from the goblin; 107 keeps it locked on the artwork.
- **2026-04-26 `00ec198`** — Restored click-flash by removing `gem-pressed` class application during `gemFlash` (the class's `!important` filter was masking the click-flash brightness). Click flash now uses inline style alone. (Persistent-glow regression introduced here is being tracked separately — see `_doc-debt.md` "Persistent gem-glow not actually persistent".)
- **2026-04-26 `758b2aa`** (Patch 5) — Bulletproof `.gem-pressed` class with `!important` rules. Persistent-press now survives parent CSS overrides.
- **2026-04-26 `b438f1f`** (Patch 2) — Realtime sub on `forum_trolls`, hydrate-on-mount, 2-min poll fallback.
- **2026-04-26 (Patch 1, SQL)** — `forum_trolls` added to `supabase_realtime` publication.

## Related

- [`./escrow.md`](./escrow.md) — sibling feature on Latest Trades feed
- [`./tooltip.md`](./tooltip.md) — D4 item tooltip locked-size contract (rendered inside every Latest Trades card)
- [`./realtime.md`](./realtime.md) — full list of realtime channels
- [`./sell-pipeline.md`](./sell-pipeline.md) — what happens when a user uploads a screenshot
- [`../catalogs/triggers.md`](../catalogs/triggers.md) — trigger registry schema
- [`../catalogs/quests.md`](../catalogs/quests.md) — quest registry schema
- [`../catalogs/specials.md`](../catalogs/specials.md) — special grant schema
- [`../endpoints/quests-triggers.md`](../endpoints/quests-triggers.md) — `/api/quest-trigger`, `/api/forum-trolls`
- [`../admin/quests-tab.md`](../admin/quests-tab.md) — admin UI for editing
- [`../modular-system/overview.md`](../modular-system/overview.md) — full traced quest example
