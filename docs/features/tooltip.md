# Feature: D4 Item Tooltip

The Wowhead-derived item tooltip rendered everywhere a D4 item appears: Latest Trades preview cards, the post / thread-detail view, the tooltip-only feed mode, the sell pipeline, the build planner item search. Single component, single CSS contract — context-aware overflow.

Component: [`../../components/D4Tooltip.js`](../../components/D4Tooltip.js).

## Locked-size contract — DO NOT BREAK (#48 contract)

**Outer dimensions are locked. Width and height. Independent of item content, screen size, scale prop, or wrapper context.** Adam's spec: "tooltip should always be same size no matter items".

The lock is enforced by CSS rules injected in `_injectBgOverride()` in [`../../components/D4Tooltip.js`](../../components/D4Tooltip.js):

| Dimension | Rule | Selector | Value |
|---|---|---|---|
| Width | `width / max-width / min-width` | `.wowhead-tooltip[data-game="d4"]` | `300px !important` |
| Height (scroll area) | `min-height / max-height` | `.wowhead-tooltip[data-game="d4"] .whtt-scroll` | `min-height: 380px !important; max-height: 420px !important` |
| Bottom-fixed (price + buy-now + realm row) | `flex-shrink: 0` | `.wowhead-tooltip[data-game="d4"] .d4-bottom-fixed` | always at intrinsic ~100px |

**Total intrinsic outer height ≈ 480–520px.** Scaled visually by the `scale` prop at the call site (preview ~0.30, post 0.64, tooltip-only mode 1.0).

### Why `min-height: 380px` is load-bearing
1. **Floor for short items.** Below 380px, items render shorter and the per-card height becomes content-driven, breaking uniformity. The `whtt-spacer` (see below) only fills empty space if the parent has a fixed-or-min height.
2. **Defeats flex's implicit `min-height: auto`.** The `.whtt-scroll` is a flex item with `flex: 1 0 auto` (flex-shrink:0). With no explicit `min-height`, flexbox applies an implicit `min-height: auto` equal to the element's min-content height — which can override `max-height` and let long content push the box past 420px. An explicit `min-height: 380px` cancels the implicit `auto`, so `max-height: 420px` actually clamps long content.

### Spacer system (short-content empty-space)
Short tooltips need to fill the 380px floor with empty space below the flavor / drop-sources, otherwise the locked frame would have content at the top and visual collapse at the bottom. The mechanism:

- **CSS** at [`../../components/D4Tooltip.js:61`](../../components/D4Tooltip.js#L61):
  ```css
  .wowhead-tooltip[data-game="d4"] .whtt-scroll .whtt-spacer { flex: 1 1 auto }
  ```
- **DOM insertion** in `injectUserStats` at [`../../components/D4Tooltip.js:420`](../../components/D4Tooltip.js#L420):
  appends `<div class="whtt-spacer">` at the end of `.whtt-scroll` on every render.

In a flex column with a fixed/min-height parent, the spacer absorbs all unused vertical space — pushing the bottom of the scroll area down to fill the parent's available height. **Both rules are required** — DOM insertion alone does nothing without the CSS, and CSS alone is meaningless without the DOM element. Both are already in place; do not remove either.

## Context-aware overflow (#48 contract)

**Same locked dimensions on both surfaces. Different overflow behavior.**

| Context | Selector | Overflow rule | Long-content behavior |
|---|---|---|---|
| **Preview card** (Latest Trades thumbnail) | `.feed-thumb .wowhead-tooltip[data-game="d4"] .whtt-scroll` | `overflow: hidden !important` | **Clipped.** Stats fill the locked frame; flavor / drop-sources beyond the frame are hidden. NO scrollbar. NO scrolling possible. |
| **Post detail view** (ThreadDetailView) | `.wowhead-tooltip[data-game="d4"] .whtt-scroll` (no `.feed-thumb` ancestor) | `overflow-y: auto !important` (global) | **Scrollable.** Stats area scrolls internally; outer frame stays at 420px max. |
| Tooltip-only view mode (HomeView TOOLTIP VIEW toggle, [`../../components/HomeView.js:1145`](../../components/HomeView.js#L1145)) | no `.feed-thumb` ancestor → global rule | `overflow-y: auto` | post-like (full-width viewing mode, scrollable). |
| Bare-tip mode (slider ≥ 0.60 in HomeView) | wrapped in `.feed-thumb` (still uses `FeedTooltipThumbnail`) → preview rule | `overflow: hidden` | preview-like. Long items clipped. |

The seam — `.feed-thumb` ancestor class — is not a new abstraction. It's the existing wrapper class that has always distinguished the preview path from the post path. The CSS rule keys off it; no component prop / data-attribute changes needed.

### Why context-aware (not uniform scroll)
Adam's call: "instead of the preview card allowing scrolling it should just show whatever fits. the lower flavor text is just hidden on preview cards.. that's what we aimed for before.. because of hover over previews and stuff are damn near perfect and that might conflict.. only time to scroll the items stats are inside the post." Scrolling inside a tiny preview thumbnail risks (a) wheel/touch interactions consuming events that should reach the card-click / hover-zoom layer, and (b) nested-scroll jank inside the page's main scroll. Clip-on-preview, scroll-in-post is the original design intent; the card-resize feature regressed it.

## Width / scale / wrapper layout

D4Tooltip's outer wrap is `display: inline-block` with `transform: scale(<scale>)` on an inner div. The inner element's intrinsic size is 300px × (380–420 + ~100). Transform doesn't affect layout, so the wrap reserves intrinsic size unless we shrink it.

`writeLayout()` in [`../../components/D4Tooltip.js:555–596`](../../components/D4Tooltip.js#L555) self-measures `inner.scrollWidth * scale` / `inner.scrollHeight * scale` after first paint via rAF and writes the wrap's `width` / `height` to those values. ResizeObserver re-measures on font / image load. With the height lock in place, scrollHeight is stable across items so writeLayout converges in one pass.

The per-instance scoped CSS at [`../../components/D4Tooltip.js:612`](../../components/D4Tooltip.js#L612) re-asserts the 300px width via a `data-d4tt="<id>"` attribute selector, defending against any cascade that might unset the global rule.

## Preview card outer height lock (#48 contract)

The preview card (Latest Trades) wraps the tooltip in additional layers; each was set to `height: auto` / `overflow: visible` by the card-resize feature commits, which let the tooltip's intrinsic height bubble up to the card's outer height (per-card height variance based on tooltip content). Re-locked after #48:

In [`../../components/HomeView.js`](../../components/HomeView.js):
- `feed-thumb` (FeedTooltipThumbnail at line ~352): `width: thumbW, height: thumbH, overflow: 'hidden'` where `thumbH = Math.round(520 * scale)`.
- Card outer `motion.div.stone-border-card` (~line 1199): `height: cardH` where `cardH = innerH + 12` (12 = stone-border padding × 2).
- Card content wrapper (~line 1222): `height: innerH` where `innerH = Math.round(520 * tooltipScale)`.
- Left panel (~line 1227): `height: innerH, overflow: 'hidden'`. **The `overflow: 'hidden'` here is what fixes the desktop title-behind-tooltip stacking** — left panel has `zIndex: 2` (above the right panel's `zIndex: 1` which contains the title), and previously its `overflow: 'visible'` let the inline-block tooltip wrap's first-paint flash bleed past `leftPanelW` and stack over the title.
- All transitions tagged with `height 0.2s ease` so slider drags are still cohesive.

`520` = max possible tooltip intrinsic height = `max-height(420) + d4-bottom-fixed(~100)`. Picking the max ensures long items don't clip their bottom-fixed price/buy-now row inside the locked card. Short items get a small dark gap at the bottom — within the `.stone-border-card` chrome, looks intentional.

## History — commits to know about

- **`03235db`** (2026-04-11) — `"uniform-tooltip-height-flex-spacer-before-flavor"`. Original commit that established the locked-height contract: added `min-height: 380px; max-height: 420px` on `.whtt-scroll`, plus the `whtt-spacer` insertion. The commit name is the spec.
- **`b0a8bea`** (2026-04-17, 03:56) — `fix(trade-card): remove gear icon, fix FG balance, tooltip bottom gap, coin size`. **Root-cause regression for #48.** Removed `min-height: 380px` from the global rule with the comment "so bottom section (price/realm) hugs actual content with no artificial gap." This single deletion broke uniformity on BOTH surfaces simultaneously: short items shrank below 380, AND long items started growing past 420 (because removing the explicit `min-height` re-enabled flex's implicit `min-height: auto` cascade).
- **`abc0d10`** (2026-04-17, 13:03) — `feat(feed): tooltip scale slider with 3-zone card resize`. The card-resize feature itself. Sound architecture; not the regression source.
- **`a17c251`** + **`9f3fc21`** + **`7bfebf2`** (2026-04-17, afternoon) — series of "follow the variable height down the chain" commits that removed fixed heights / `overflow: hidden` from card / content wrapper / left panel / feed-thumb. Compounded the `b0a8bea` regression by letting the now-content-driven tooltip height bubble up to the card outer height (per-card variance on Latest Trades).
- **#48 fix** (2026-04-26) — restored `min-height: 380px !important` on `.whtt-scroll` (revert of `b0a8bea`'s deletion); added `.feed-thumb .whtt-scroll { overflow: hidden }` rule; restored explicit heights + `overflow: hidden` on the HomeView wrapper chain.

## DO NOT BREAK

1. **The line `min-height: 380px !important` on `.wowhead-tooltip[data-game="d4"] .whtt-scroll`** in [`../../components/D4Tooltip.js`](../../components/D4Tooltip.js) `_injectBgOverride()`. **Removing it is the regression that batch-log #48 fixed.** Do not remove "to let the bottom section hug content" — that's exactly what spec-author Adam does NOT want. Empty space below short content is the *desired* behavior, not an artifact.
2. **The `.feed-thumb .whtt-scroll { overflow: hidden !important }` rule.** Defines preview-vs-post overflow. Removing it makes preview cards scrollable, which conflicts with hover-over previews (Adam: "are damn near perfect").
3. **The `.whtt-spacer` insertion + `flex: 1 1 auto` rule.** Both required together. Removing either breaks short-content empty-space below flavor.
4. **`overflow: hidden` on the preview card's left panel + locked `height: innerH`.** Removing either causes the desktop title-behind-tooltip stacking regression.
5. **Width: 300px** on `.wowhead-tooltip[data-game="d4"]` (global at [`../../components/D4Tooltip.js:54`](../../components/D4Tooltip.js#L54), per-instance at [`../../components/D4Tooltip.js:612`](../../components/D4Tooltip.js#L612)). Both must stay.
6. **D4Tooltip's `writeLayout` self-measure.** With the height lock in place, scrollHeight is stable; writeLayout converges in one pass. If a future "optimization" removes writeLayout, the inline-block wrap will reserve full intrinsic 300px × 520px space regardless of `scale`, breaking layouts.

## Verification spec (any change to this file must pass)

- Tooltip outer dimensions identical across all items, regardless of content length.
- Short item (e.g. 2-affix ring): renders content at top, empty space below flavor / drop sources, frame at locked dimensions.
- Long item (e.g. mythic unique with multiple drop sources): preview = clipped (no scroll, no scrollbar); post = scrolls internally, outer frame stays at locked max.
- Latest Trades — all cards on the page identical outer height at any tooltipScale.
- Card-resize slider — all cards resize together cohesively (slider is React state; height is derived from same state in same render pass).
- Desktop — title text on every Latest Trades card fully visible, not stacked over by tooltip.
- Hover-over preview popup (desktop) and long-press popup (mobile) still work — they read `tooltipHtml` directly and render at cursor / above the long-pressed card. Independent of preview-card rendering.

## See also

- [`./forum-troll-gem.md`](./forum-troll-gem.md) — sibling feature with similar "DO NOT BREAK" contract structure.
- [`../../components/D4Tooltip.js`](../../components/D4Tooltip.js) — the component itself.
- [`../../components/HomeView.js`](../../components/HomeView.js) — preview-card wrapper chain.
- [`../../components/ThreadDetailView.js`](../../components/ThreadDetailView.js) — post-view caller.
- [`../../public/css/wowhead-tooltip.css`](../../public/css/wowhead-tooltip.css) — Wowhead's base CSS we layer overrides on top of.
- [`../_batch-log.md`](../_batch-log.md) #48 — the diagnosis + fix record.
