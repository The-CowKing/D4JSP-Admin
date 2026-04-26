# Feature: D4 Item Tooltip

The Wowhead-derived item tooltip rendered everywhere a D4 item appears: Latest Trades preview cards, the post / thread-detail view, the tooltip-only feed mode, the sell pipeline, the build planner item search. Single component, single CSS contract — context-aware overflow.

Component: [`../../components/D4Tooltip.js`](../../components/D4Tooltip.js).

## Locked-size contract — DO NOT BREAK (#48 + #54 contract)

**Outer dimensions are locked. Width and height. Independent of item content, screen size, scale prop, or wrapper context.** Adam's spec: "tooltip should always be same size no matter items".

The lock is enforced by CSS rules injected in `_injectBgOverride()` in [`../../components/D4Tooltip.js`](../../components/D4Tooltip.js):

| Dimension | Selector | Rule | Effect |
|---|---|---|---|
| Width | `.wowhead-tooltip[data-game="d4"]` | `width / max-width / min-width: 300px !important` | Tooltip is always 300px wide intrinsic. |
| **Container height (whole tooltip)** | `.wowhead-tooltip[data-game="d4"] .whtt-container` | `height: 520px !important` | **Total tooltip height is fixed at 520px. The single load-bearing rule.** |
| Scroll area (top region — header + stats + flavor) | `.wowhead-tooltip[data-game="d4"] .whtt-scroll` | `flex: 1 1 0 !important; max-height: 420px !important` | Fills container minus bottom-fixed (= 420px). |
| Bottom-fixed (price + buy-now + realm row) | `.wowhead-tooltip[data-game="d4"] .d4-bottom-fixed` | `flex-shrink: 0 !important` | Always at intrinsic ~100px, anchored at bottom of container. |

**Total outer height = exactly 520px. Always.** Scaled visually by the `scale` prop at the call site (preview ~0.30, post 0.64, tooltip-only mode 1.0).

### Why `.whtt-container { height: 520px }` is THE load-bearing rule (#54)
The original lock used `height: auto` on the container with `min-height: 380px + max-height: 420px` on `.whtt-scroll`. That worked in the post path (overflow-y:auto) but failed on preview cards (overflow:hidden) — long content's scroll-area would render past 420px under flex's basis-resolution rules, pushing the bottom-fixed (Buy Now / price / footer) below the visible frame on preview thumbnails.

Fix: lock the container itself at 520px and let the scroll-area grow to fill (`flex: 1 1 0`) within that fixed budget. Now the layout is fully deterministic regardless of content or overflow setting:
- container = 520
- bottom-fixed = ~100 (intrinsic, flex-shrink:0)
- scroll-area = container - bottom-fixed = 420 (max-height clamps if overflow would exceed)

The bottom-fixed is **structurally anchored** at the bottom of the 520-tall container. It can never be pushed below the visible frame because there's nothing for it to be pushed by — the container itself is the frame.

### Spacer system (short-content empty-space)
Short tooltips need to fill the 420px scroll-area with empty space below the flavor / drop-sources, otherwise the locked frame would have content at the top and visual collapse at the bottom of the scroll area. The mechanism:

- **CSS** at [`../../components/D4Tooltip.js:71`](../../components/D4Tooltip.js#L71):
  ```css
  .wowhead-tooltip[data-game="d4"] .whtt-scroll .whtt-spacer { flex: 1 1 auto }
  ```
- **DOM insertion** in `injectUserStats` at [`../../components/D4Tooltip.js:425`](../../components/D4Tooltip.js#L425):
  appends `<div class="whtt-spacer">` at the end of `.whtt-scroll` on every render.

The scroll-area is itself a `display:flex; flex-direction:column` container. The spacer (`flex: 1 1 auto`) absorbs all unused vertical space inside the 420-tall scroll-area — pushing the flavor text / drop sources to sit just above the bottom-fixed area, with empty space between them and the stats above.

**Both rules are required** — DOM insertion alone does nothing without the CSS, and CSS alone is meaningless without the DOM element. Both are already in place; do not remove either.

### Bottom-fixed area — DO NOT clip (#54 contract)
The bottom-fixed area at [`../../components/D4Tooltip.js:73`](../../components/D4Tooltip.js#L73) (`.d4-bottom-fixed`) carries the **actionable Buy Now button** plus the price, FG icon, and realm/age/views footer. **It must never be clipped on either preview or post.** The `height:520px` container rule + `flex-shrink:0` on the bottom-fixed area together guarantee this:
- Container size is fixed → bottom-fixed has a deterministic place to sit.
- `flex-shrink:0` → bottom-fixed never compresses to make room for an oversized scroll-area.
- `max-height:420` on scroll-area → scroll-area can never push past its allotment.

If you ever change the container's `height` rule, you MUST verify on a long-content item (e.g. mythic unique with multiple drop sources) that the Buy Now button stays visible at the bottom of the locked frame on both preview and post.

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
- **#54 fix** (2026-04-26) — restructured the height lock from `height:auto` container + `min/max-height` on scroll, to `height:520px` on container + `flex:1 1 0` on scroll. Buy Now / price / footer (`.d4-bottom-fixed`) was being pushed below the visible frame on long-content preview cards under the prior shape because `overflow:hidden` + flex's basis-resolution rules let the scroll-area render past `max-height:420`. Fixed-container approach makes the layout deterministic: scroll-area always grows to fill 420 within the 520 container, bottom-fixed always anchored at the bottom 100.
- **#55 fix** (2026-04-26) — desktop right-edge clipping. Wowhead's base CSS forces `white-space:normal!important` on tooltip table cells via a mobile-only `@media (max-width:599px)` rule. On desktop, tables/cells inherit default wrap behavior plus `.wowhead-tooltip td { max-width:500px }`, letting long flavor text render the cell wider than the locked 300px tooltip and overflow horizontally past the right edge. Mirrored the mobile wrap rule globally + added `overflow-wrap:anywhere` and `max-width:300px` clamps on table cells / scroll descendants. Also added `overflowWrap: 'anywhere'` + `hyphens: 'auto'` on the seller-column username so it can break mid-word as a fallback when space-breaks don't fit at desktop font rendering.

## DO NOT BREAK

1. **`.wowhead-tooltip[data-game="d4"] .whtt-container { height: 520px !important }`** in [`../../components/D4Tooltip.js`](../../components/D4Tooltip.js) `_injectBgOverride()`. **This is THE single rule that makes the locked-size contract work after #54.** Do not change to `height: auto` — that's the bug.
2. **`.wowhead-tooltip[data-game="d4"] .whtt-scroll { flex: 1 1 0; max-height: 420px }`** combined with #1 above. The `flex: 1 1 0` (basis 0, grow 1, shrink 1) is what makes the scroll-area deterministically fill the available 420px inside the 520 container, regardless of content. Do not change to `flex: 1 0 auto` — flex-shrink:0 + flex-basis:auto reintroduces the #54 regression (flex resolves basis to content size, can exceed max-height under some layout passes).
3. **The `.feed-thumb .whtt-scroll { overflow: hidden !important }` rule.** Defines preview-vs-post overflow. Removing it makes preview cards scrollable, which conflicts with hover-over previews (Adam: "are damn near perfect").
4. **The `.whtt-spacer` insertion + `flex: 1 1 auto` rule.** Both required together. Removing either breaks short-content empty-space below flavor.
5. **`overflow: hidden` on the preview card's left panel + locked `height: innerH`.** Removing either causes the desktop title-behind-tooltip stacking regression.
6. **Width: 300px** on `.wowhead-tooltip[data-game="d4"]` (global at [`../../components/D4Tooltip.js:54`](../../components/D4Tooltip.js#L54), per-instance at [`../../components/D4Tooltip.js:612`](../../components/D4Tooltip.js#L612)). Both must stay.
7. **D4Tooltip's `writeLayout` self-measure.** With the height lock in place, scrollHeight is stable; writeLayout converges in one pass. If a future "optimization" removes writeLayout, the inline-block wrap will reserve full intrinsic 300px × 520px space regardless of `scale`, breaking layouts.
8. **The Buy Now button must always be visible.** The bottom-fixed area carries the actionable buy button; clipping it breaks the marketplace UX. If you change layout in this area, verify on a long-content item that the button stays inside the visible frame on both preview and post.
9. **The desktop wrap rules** (`white-space:normal!important; overflow-wrap:anywhere!important` on tooltip tables/cells, `max-width:300px!important` on cells, `overflow-wrap:anywhere; word-break:break-word` on `.whtt-scroll *`) — restore #55. Wowhead's base CSS only forces wrap on `max-width:599px`; without our global mirror, desktop tooltips overflow their locked 300px width on long flavor text. Don't remove these rules thinking they're redundant with mobile.

## Desktop layout — DO NOT NARROW the left panel

The card's left panel hosts the tooltip thumbnail. Its width is `leftPanelW = round(300 * tooltipScale) + 4` (the 4 is buffer). At minimum tooltipScale (0.15 on desktop, 0.30 on mobile) that's 49px / 94px. The 300px tooltip layout box is scaled to fit visually inside this width via `transform: scale(tooltipScale)`. **Do not narrow leftPanelW below `300*scale + 4`** — the tooltip's intrinsic 300px-wide box will then overflow the panel's right edge and clip via the panel's `overflow:hidden`. The +4 buffer is intentional; don't remove it.

The tooltip itself is locked at `width: 300px` (intrinsic). After scaling, visual width = 300 × scale. Always smaller than or equal to leftPanelW. **The desktop right-edge clip in #55 was a TEXT WRAPPING bug inside the tooltip, not a panel-width bug** — table cells were rendering wider than 300px on desktop because Wowhead's base wrap-rule was mobile-only. Fixed in `_injectBgOverride()` with global wrap rules.

## Verification spec (any change to this file must pass)

- Tooltip outer dimensions identical across all items, regardless of content length.
- Short item (e.g. 2-affix ring): renders content at top of scroll area, empty space below flavor / drop sources within the scroll area, bottom-fixed (price + Buy Now + footer) at bottom of frame, frame at locked 520px.
- Long item (e.g. mythic unique with multiple drop sources): preview = clipped (no scroll, no scrollbar) at the BOTTOM of the scroll-area (flavor / drop sources hidden); **bottom-fixed (Buy Now / price / footer) ALWAYS visible at the bottom of the locked frame.** post = scrolls internally; outer frame stays at locked 520; bottom-fixed always anchored at the bottom regardless of scroll position.
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
- [`../_batch-log.md`](../_batch-log.md) #48 (diagnosis), #50 (initial fix), #54 (bottom-anchor restructure), #55 (desktop right-edge wrap) — the work history.
