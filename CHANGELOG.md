# Changelog

## 1.13.3 — 2026-05-03

Hotfix to v1.13.2. Dan: "It clicks now, but doesnt drop down. This file structure should be: APUS, then course template that can be copied, and also the course names, then the week. Ultimately, we will be working on the 'week' folder."

### Fixed
- **PageHeader supports arbitrary breadcrumb depth.** v1.13.0–v1.13.2 hardcoded two segments (notebook + course) and could only render `APUS · ELEN201`. Refactored `parseSegments` to produce an `ancestors[]` array of any length, so a file at `Noteometry/APUS/ELEN201/Week 1/Lecture.nmpage` now displays `APUS · ELEN201 · Week 1` and the picker shows the pages inside `Week 1/`. The breadcrumb adapts to whatever folder depth the vault actually has.
- **Path-mismatch bug in the popover queries.** v1.13.0's `buildPageList` constructed `${root}/${coursePath}` to find sibling pages — but when the user's file lived outside the configured root (or the rootFolder had a `findAllNmpages` prefix-fallback), the filter looked for the wrong parent path and got nothing back, so the popover rendered as empty / "doesn't drop down." All sibling/page queries now use vault-absolute parent paths derived from the file's actual location, with no root-relative re-joining.
- **Each ancestor button → flyout of siblings at THAT level.** Tap `APUS` → flyout of other notebooks. Tap `ELEN201` → flyout of other courses. Tap `Week 1` → flyout of other weeks. Picking a sibling navigates to the first depth-first leaf in that subtree.

### Storage layout
- `<vault>/Noteometry/APUS/<Course>/<Week>/<Page>.nmpage` (4-level — full Course → Week → Page hierarchy)
- `<vault>/Noteometry/APUS/<Course>/<Week>.nmpage` (3-level — week IS the page)
- `<vault>/Noteometry/APUS/<file>.nmpage` (2-level)
- The header adapts; no hardcoded shape.

## 1.13.2 — 2026-05-03

Hotfix to v1.13.1. Dan: "Band showed up, doesnt work" → "does nothing when clicked." Picker buttons render but tapping fires no popover.

### Fixed
- **Picker buttons now use `onPointerUp` + `stopPropagation` instead of `onClick`.** React's synthetic `onClick` is fragile on Android Chromium / Samsung WebView — tap delay, click cancellation by minor finger movement, etc. The ContextMenu items already use `onPointerUp` for this exact reason; bringing the picker buttons in line. `onPointerDown` also gets `stopPropagation` so the click doesn't bubble to `noteometry-canvas-area`'s onClick handler (which would re-render and theoretically race the menu).

### Diagnostic
- Console log added in `showFlyoutAt`: `[Noteometry] PageHeader.showFlyoutAt { itemCount, hasButton }`. If the picker tap still produces nothing after this update, this log tells us whether the handler fired (item-list issue) or didn't fire at all (touch routing still broken).

## 1.13.1 — 2026-05-03

Hotfix to v1.13.0. Dan: "no change but it shows 1.13.0 in obsidian." The v1.13.0 PageHeader band was rendering correctly but was visually too subtle to notice — `--nm-faceplate` background blended into Obsidian's surrounding chrome, no clear separator from canvas, and no min-height meant it collapsed to ~32px tall.

### Fixed
- **Band is impossible to miss now.** Background bumped to `--nm-faceplate-light`, bottom border bumped from 1px paper-border to 2px solid accent, min-height pinned at 48px, padding bumped from 6px → 8px. Reads as a deliberate piece of chrome, not a slim strip.
- **Renders even when `file` is null.** v1.13.0 returned `null` if no page was bound (`file === null` on the initial render after a plugin reload). Now shows a placeholder "No page open" so the band's presence is consistent across all states.
- **Console diagnostic.** Added a one-line `console.log` on PageHeader mount (`[Noteometry] PageHeader mounted { hasFile, filePath }`) so future "no change" reports can be diagnosed in DevTools without code spelunking. Throwaway — removed once we're confident the band always shows.
- **Defensive against Obsidian themes.** Added `visibility: visible !important; opacity: 1 !important;` so any third-party theme that tries to hide elements in the canvas area can't blank the band.

## 1.13.0 — 2026-05-03

Dan: "I'd rather have a button I press and out pops 16 weeks, like a mouse over. No shit on the canvas FFS." Got it. Off the canvas entirely; one button → popover.

### Added
- **PageHeader band above the canvas.** New `<PageHeader>` component renders in `.noteometry-canvas-area`'s flex column, ABOVE the drawing surface, with its own background and bottom border. NOT floating on the canvas.
  - **Left**: tracked-uppercase breadcrumb of upper levels — notebook · course. Each segment is a button.
    - Tap notebook → flyout listing all top-level folders containing `.nmpage`s. Pick one → opens its first page (depth-first first leaf).
    - Tap course → flyout listing folders inside the active notebook. Pick one → opens its first page.
  - **Right**: the page-picker. Label = current page name + chevron, clearly a dropdown affordance.
    - Tap → flyout listing every `.nmpage` in the current course folder, naturally sorted ("Week 2" before "Week 10"). Active page marked with `●`.
    - Tap any page → loads in current tab.
  - All flyouts render via the existing `ContextMenu` component, so outside-click / Esc / viewport-clamping work uniformly.

### Removed
- **The v1.12.0 floating PageBreadcrumb pill.** Was sitting on the canvas at top-center; the new header band replaces its role with proper chrome separation. `src/components/PageBreadcrumb.tsx` deleted.
- **The v1.12.0 `📚 Pages` submenu in the right-click hub.** Navigation now lives entirely in the always-visible PageHeader. Right-click goes back to being purely tools (Undo / Clear / Drawing / Select / Insert / Math / Export). `src/components/menu/buildPagesMenu.ts` deleted.

### Path conventions
- `<vault>/Noteometry/<Notebook>/<Course>/<Page>.nmpage` is the supported shape — APUS / ELEN201 / Week 1, Colby / Sermons / Easter, etc.
- The header band gracefully handles deeper or shallower nesting: pages directly under a notebook folder show a breadcrumb without the course segment; pages at the vault root show only the page-picker.

### Tests
- 512/512 passing (no test surface change; component is wholly visual).

## 1.12.2 — 2026-05-03

Z Fold audit: v1.12.1 fixed two-finger hold (gestures reach JS now). Two follow-on issues surfaced:
1. **Pinch zoom anchored to the upper-left corner** instead of the user's fingers.
2. **Two-finger drag did not pan the canvas.**
3. **Math palette popup cut off at the bottom** with no way to reach the lower symbol rows.

### Fixed
- **Pinch zoom anchors to the centroid of the two fingers.** New pure helper `scrollForZoomAnchor(scroll, oldZoom, newZoom, canvasX, canvasY)` in `src/lib/wheelZoom.ts` returns the scroll values that keep the world point under the anchor pixel at the same screen position across the zoom step. Wired into the InkCanvas two-finger move path: each frame applies the zoom delta AND adjusts scroll so the world under the centroid stays put. Pre-1.12.2 every zoom step grew/shrank around world (0, 0) — that's why the Z Fold pinch read as "snap to top-left."
- **Two-finger pan works.** The InkCanvas two-finger move handler is restructured to apply zoom + pan in the same pass: pinch ratio updates zoom (anchored), centroid delta updates scroll. Pan velocity is `delta / zoom` so the canvas slides at the same world-units-per-pixel regardless of zoom level. Works in both default and finger-drawing mode.
- **Wheel / trackpad-pinch zoom anchors to the cursor.** Same `scrollForZoomAnchor` helper, anchor = `e.clientX/Y`. Chromium synthesises trackpad pinches as wheel events at the pointer position, so trackpad pinch anchors correctly too.
- **Keyboard / button zoom anchors to the viewport center.** New `zoomAroundCenter` callback in `NoteometryApp` — `+ / −` buttons and command-palette zoom commands now grow/shrink around what the user is looking at. `Reset 100%` keeps its identity behaviour (zoom = 1, scroll preserved) since "100%" is canonically a snap.
- **Math palette popup no longer clips.** Desktop variant gains `max-height: calc(100vh - 100px); overflow-y: auto`. Mobile variant bumps `max-height: 45vh → 60vh` and pins `touch-action: pan-y` so the popup scrolls cleanly when the symbol grid exceeds available height. Pre-1.12.2 desktop had no max-height; on smaller laptop displays the grid grew past the top edge with no way to reach the cut-off rows.

### Tests
- 5 new cases in `tests/unit/zoomAnchor.test.ts` pinning the anchored-zoom invariant: `worldX = scrollX + canvasX/zoom` is preserved across every zoom step. Round-trip zoom-in-then-out lands back at the start within fp epsilon.
- 512/512 passing (was 507, +5).

## 1.12.1 — 2026-05-03

Hotfix to v1.12.0. Dan: "gestures don't work on Z Fold 7."

### Fixed
- **Two-finger hold + pinch + pan now reach JS on Android Chromium / Samsung WebView.** The `.noteometry-ink-canvas-container` (where the multi-touch handler lives) had no `touch-action` set — defaulting to `auto`, which lets the OS consume multi-touch gestures before our PointerEvent listeners see them. The inner `.noteometry-ink-layer` was already `touch-action: none`, but Z Fold's WebView routes gestures starting near the edges (or via the container's pointerdown bubble) through the container, where they got eaten. Pinned `touch-action: none` on the container itself.

iPad Safari was forgiving here and shipped fine in v1.12.0; Android Chromium is stricter. One CSS line.

## 1.12.0 — 2026-05-03

The leaf-management war ends. After v1.11.1–v1.11.5 spent five releases fighting Obsidian's workspace manager to make the Pages panel behave in the left split (file-explorer displacement, stacked duplicates, "Plugin no longer active" orphans), Dan's call: scrap the panel, layer navigation into the right-click hub. **Right-click is the OS.**

### Added
- **📚 Pages submenu in the canvas right-click hub.** Pinned at the very top. Submenu structure:
  - "Recent" → last 6 pages by mtime, across all folders.
  - One submenu per folder (course), pages sorted recency-first, count shown on the right.
  - "+ New page" at the bottom. Empty-vault fallback: a disabled "No pages yet" row.
  - The currently-open page is marked with a ✓ icon.
  - Tap a page → opens in the current leaf via `getLeaf(false).openFile`.
  - Single-folder vault-root-only with ≤6 pages flattens — no point in nesting one bucket.
- **`ContextMenuItem.submenu` mechanism.** Items can carry a `submenu: ContextMenuItem[]` array; rows with a submenu show a chevron and spawn a child menu on hover (mouse) or tap (touch). Submenus position to the right of the parent row, flipping to the left when they would overflow. Recursive — submenus can have submenus arbitrarily deep. Outside-click closes the chain; Esc closes one level at a time.
- **Two-finger hold gesture on iPad.** 550ms with no finger movement past 12px → fires `onRequestContextMenu` at the centroid. Same threshold as the v1.6.9 pen long-press, adapted for fingers so iPad users without an Apple Pencil can reach the right-click hub. Cancels on pinch-or-pan motion or finger lift before the threshold.
- **Top-of-canvas page-name breadcrumb readout.** Tracked-uppercase mono pill at top-center showing current parent path + filename (e.g. `EE 301 · WEEK 4 · LECTURE`). Tap → opens the canvas right-click menu just below it. Doubles as orientation cue and primary navigation entry point.

### Removed
- **`PagesPanel.tsx` (248 lines) and `registerPagesPanel.ts` (97 lines) deleted.** The panel view-type is no longer registered. Workspace `revealPagesPanel`, "Noteometry pages" ribbon icon, and `noteometry-open-pages-panel` command all gone. Five releases of leaf-management bug-fighting deleted in one ship.
- **`pagesPanelEnabled` setting + its UI toggle.** No setting needed when there's no panel.
- **`detachDuplicatePagesPanelLeaves` replaced by `detachLegacyPagesPanelLeaves`.** The new sweep detaches EVERY noteometry-pages-panel leaf left behind by v1.11.x workspace.json so users upgrading from v1.11.x don't see "Plugin no longer active" placeholders. Idempotent — sweeps once on first load and finds nothing thereafter.
- **`tests/unit/v1113Regressions.test.ts`** and **`tests/unit/v1115Regressions.test.ts`** deleted — they pinned PagesPanel-specific bugs that no longer exist.

### Kept
- `src/components/pages/pagesPanelLogic.ts`. The pure data layer (`filterAndSort`, `folderChips`, `chipLabel`) is still consumed by the new `buildPagesMenu` helper. Same data, new render surface.

### Tests
- 507/507 passing. Net -345 lines of code.

## 1.11.5 — 2026-05-03

Dan's report: "this is impossible to use" with a screenshot showing **three stacked Noteometry Pages panels** plus a dead **"Plugin no longer active (file-explorer)"** leaf filling the entire left sidebar. v1.11.4 made things worse: my file-explorer auto-restore fallback created an orphan leaf, and every plugin reload through v1.11.1–v1.11.4 accumulated another Pages panel because the de-dup check raced with workspace.json restore.

### Fixed
- **Pages panel no longer stacks on every reload.** Added `detachDuplicatePagesPanelLeaves` that runs on layout-ready and detaches every pages-panel leaf past the first. Also guarded the auto-reveal on startup with an explicit `getLeavesOfType` check before calling `revealPagesPanel`, so even if the de-dup inside `revealPagesPanel` ever races we still don't add a second leaf.
- **"Plugin no longer active" file-explorer orphan removed.** v1.11.4's fallback path called `setViewState({ type: "file-explorer" })` on a fresh leaf when the `file-explorer:open` command wasn't available. That produced an orphan leaf because Obsidian only mounts the file-explorer view through its core-plugin lifecycle — not through `setViewState` on an arbitrary leaf. v1.11.5 drops the fallback entirely: command or nothing. Added `detachDeadEmptyLeavesInSidebar` that sweeps any leaf whose view type is `"empty"` out of the sidebar on layout-ready, cleaning up the orphans v1.11.4 already created.

### Tests
- 520/517 (+3 in `v1115Regressions.test.ts`: duplicate pages-panel detach, dead-empty-leaf sidebar sweep, file-explorer fallback removed).

## 1.11.4 — 2026-05-03

Hotfix to v1.11.3. Two user reports: file tree is still stuck, and there's no Chat tool in the insert menu.

### Fixed
- **Sidebar detection actually works now.** v1.11.3's `isLeafInSidebar` helper used `leftSplit.containsLeaf()` — but that's not a public Obsidian API in current builds, the call returned `undefined`, and every leaf read as not-in-sidebar. The canvas leaves stuck in the sidebar from pre-v1.11.3 workspace.json therefore never got relocated. Switched to `leaf.getRoot()` + identity compare against `workspace.leftSplit` / `workspace.rightSplit`, which is the documented path. DOM-class fallback stays for headless builds.
- **File explorer auto-restores on load.** Users upgraded through v1.11.1–v1.11.3 have a workspace.json with NO `file-explorer` leaf (it was overwritten by the pages panel). Obsidian never auto-recreates it. Added `ensureFileExplorerVisible` that runs on layout-ready: if zero file-explorer leaves exist, invoke the `file-explorer:open` command, fall back to creating a leaf manually. Idempotent — skips when the explorer is already there, so users who intentionally closed it aren't trampled... except by the first v1.11.4 launch, which will reopen it. Unavoidable without a persisted "user wants explorer closed" flag.

### Added
- **Chat is a first-class insert tool.** Right-click on empty canvas → Insert → Chat. Previously only reachable through Lasso → ABC (empty chat with pinned lasso image) or Math → Solve (chat seeded with LaTeX). Both flows are hidden gameplay for anyone who doesn't know the lasso radial exists. Menu item spawns a fresh `ChatObject` center-viewport, just like the freeze brain-dump flow.

## 1.11.3 — 2026-05-03

Followup to 1.11.2. Dan's report: "Text in the text box and table are white on white so it's invisible. I think all text is that way. The file tree is messed up." Two distinct bugs, both traced from the screenshot + code read.

### Fixed
- **File tree no longer disappears when the Pages panel loads.** `revealPagesPanel` used `workspace.getLeftLeaf(false)`, which returns an existing empty leaf in the left split — in practice that was Obsidian's own file-explorer leaf. `leaf.setViewState({ type: PAGES_PANEL_VIEW_TYPE })` then overwrote it, effectively deleting the file tree. Switched to `getLeftLeaf(true)` so Obsidian splits a brand-new leaf next to the file explorer instead of hijacking it.
- **Canvas no longer opens inside the narrow sidebar pane.** `handleLaunchOpen` called `getLeaf(false)` without checking where the returned leaf lived. If workspace.json restored a blank `noteometry-view` leaf in the left or right split (which it did for any user upgraded through the 1.11.1 → 1.11.2 window), the most-recent `.nmpage` opened inside that ~240px sidebar pane and the main area showed "New tab". Added `isLeafInSidebar` guard that falls back to a fresh main-area tab, plus a one-shot `relocateNoteometryLeavesOutOfSidebar` sweep on layout-ready that rescues any canvas leaves already stuck in the sidebar from a prior session.
- **Drop-in text is no longer white-on-white.** `.noteometry-richtext-content` and `.noteometry-table-cell` routed their text color through `var(--text-normal)`, which chained through a user-theme-owned variable. On certain dark themes (and inside `<input>` elements on macOS Electron), that chain resolved to near-white even though the surface was also near-white. Pulled `color` directly from `--nm-paper-ink` with `!important` and added `-webkit-text-fill-color` to beat the macOS input default.
- **Placeholder / faint text readable in dark mode drop-ins.** The cream-surface scope (`.noteometry-canvas-object`, `.noteometry-richtext`, `.noteometry-table-editor`, …) hard-coded `--text-faint: rgba(26, 35, 53, 0.52)` — dark navy at 52% — which is effectively black paint on the dark-mode surface. Added a `.theme-dark` override that re-flips it to `rgba(232, 232, 236, 0.55)` so "Type here…" and other faint labels stay visible.

### Tests
- 501/497 (+4 regression guards in `v1113Regressions.test.ts`: `revealPagesPanel` must not use `getLeftLeaf(false)`; dropin `color` declarations must come from `--nm-paper-ink`; `handleLaunchOpen` must check for sidebar leaves; dark-mode `--text-faint` override must exist).

## 1.11.2 — 2026-05-03

Drop-in interaction bugfixes. Dan's report: "the text drop in disappears when you mess with it. There are tons of bugs all over." Five concrete bugs traced from a deep code read of every drop-in path; one root focus issue was driving most of the visible chaos.

### Fixed
- **Text drop-in no longer disappears when you click chrome icons.** The window-level `Delete` / `Backspace` handler in `NoteometryApp` only guarded `INPUT` / `TEXTAREA` / `contenteditable`, but clicking Snapshot / Download / Duplicate moved focus to the chrome `BUTTON` — Backspace then fell through to the "delete selected object" branch and nuked the drop-in. New guard: any focus inside `.noteometry-object-selected` suppresses the delete.
- **Chrome icon buttons no longer steal focus from the editor.** Added `onMouseDown` `preventDefault` to the chrome icon row so clicking Snapshot / Download / Duplicate / Delete keeps the caret inside the `RichTextEditor`. Click still fires (click ≠ mousedown), but focus stays where the user put it.
- **Wheel-scrolling inside a drop-in no longer pans the canvas.** The drop-in content `<div>` had `onTouchStart` `stopPropagation` but no `onWheel` handler, so scrolling chat history or a long text body also scrolled the canvas underneath. Added `onWheel={(e) => e.stopPropagation()}`.
- **`bringToFront` no longer remounts `RichTextEditor` mid-edit.** Every `pointerdown` on a drop-in moved its object to the end of the array; React saw the changed key order and unmounted/remounted the wrapper subtree, which made `RichTextEditor`'s `useEffect` rehydrate `innerHTML` from `tableStore` and blow away the caret position. Now skips the reorder when an `input` / `textarea` / `contenteditable` inside that drop-in already has focus.
- **Circular dark-mode CSS token resolved.** `--nm-paper-ink: var(--text-normal, #E8E8EC)` (line 166) and `.noteometry-container { --text-normal: var(--nm-paper-ink) }` (line 224) formed a cycle; CSS resolves cycles to guaranteed-invalid, so `color` fell back to `inherit` and could render wrong (or invisibly) on certain ancestor scopes. Replaced the dark-mode `--nm-paper-ink` with the literal `#E8E8EC`.

### Refactor
- Extracted the focus-aware Delete and `bringToFront` guards into `src/lib/dropinFocusGuards.ts` (`shouldSuppressDelete`, `shouldSkipBringToFront`) so they're unit-testable without jsdom.

### Tests
- 497/497 (was 486, +11 covering both focus guards across body / no-selection / chrome-button / contenteditable / out-of-dropin / cross-dropin scenarios).

## 1.11.1 — 2026-05-03

UX overhaul. Four user-reported pain points fixed in one ship.

### Fixed
- **Dark mode is now readable.** The whole stylesheet had zero `.theme-dark` overrides plus 46 hard-coded `#FFFFFF` / `#fff` / `#333` literals that bypassed the token system, so on dark theme drop-ins, modals, and the math toolbar stayed white-on-dark with dark text — effectively invisible. Added 14 new surface tokens, swept all 46 literals through them, and added a full `.theme-dark` override block (deep graphite canvas `#1E1E22`, chrome `#25252B`, accent lifted to `#5AA0E8` for contrast). Dan's 2026-04-11 "all text is black" rule was a light-mode rule and now scopes to light mode only; dark mode routes text through Obsidian's `--text-normal` so the user theme can fine-tune.

### Changed
- **No more home-view detour on launch.** Opening Obsidian now opens the most-recently-edited `.nmpage` directly. The Home view (Resume / New page / Recents) is one tap away via the home ribbon icon and the `Noteometry: Open home` command, and Settings → "Show home view on launch" brings back the old behavior.

### Added
- **Custom Pages panel** in the left sidebar: only `.nmpage` files (no `.md` / `.canvas` noise), folder filter chips at top with counts, search box, sort toggle (Recent ↔ A→Z ↔ Z→A), context menu (Open / Open in new tab / Rename… / Delete), inline `+ New` button. Tap targets bump to 44px on touch devices. Toggle in Settings → "Show Noteometry pages panel".
- **Global Noteometry theme** (default ON) re-skins all of Obsidian — sidebar, tab bar, ribbon, status bar, command palette, modals, and the default file explorer — to match the canvas. Respects light/dark choice, removes cleanly when toggled off, runtime-injected so no manual install. Toggle in Settings → "Apply Noteometry theme to all of Obsidian".

### Tests
- 486/486 (was 460, +26 covering pages panel filter/sort/chips, global theme apply/remove lifecycle, most-recent-nmpage resolver).

### Notes
- Toggling the Pages panel off requires a reload (or plugin re-toggle) to fully detach the registered view; the global theme toggle applies/removes live without reload.

## 1.11.0 — 2026-05-03

3D layers. The canvas is now three planes: the paper you draw on (always present), the **tool layer** (3-finger swipe down), and the **meta layer** (3-finger swipe right). Plus a hard-stop **freeze** (4-finger tap) for hypomanic-mind brakes. ADHD-tuned: anti-amnesia ambient cues, anti-modal everywhere, no menu hunting, calm-tech peripheral signaling. Bipolar-tuned: dual-sided coverage — long-press contextual menu = depressive slow path; 4-finger freeze = hypomanic kill switch. Both always available, neither requires layer state.

### New — 3D layer architecture
- **Tool layer** (top, 150ms slide-down) holds pen / eraser / select toggles, 6 ink colors, 4 stroke widths, math palette toggle, clear-canvas. Summon with 3-finger swipe down; dismiss with 3-finger swipe up, tap canvas, or 2-second idle. Right-click context menu still has the same actions — it's the depressive slow path; the layer is the hypomanic fast path.
- **Meta layer** (left, 200ms slide-right) holds page metadata. Same summon/dismiss model.
- **Freeze** (4-finger tap) shows a `PAUSED — TAP CANVAS TO RESUME` badge with [Brain dump] [Resume] buttons. Brain dump spawns a ChatDropin pre-seeded with `[brain dump @ <iso>]` and cursor pre-focused at the end — racing thought capture without losing the page state. Per-page scope; freeze on Page A doesn't follow you to Page B.

### New — ambient cues (calm-tech, peripheral only)
- **Edge glow** — 1px hairlines on the top/left edges hint summonable layers (8% opacity, no event handlers, zero layout cost).
- **Cursor color** — inkable surface cursor reflects current ink color (`buildPenCursorUri`). Out-of-sight stops being out-of-mind.
- **Save dot** — dirty-state indicator, no save spinner anxiety.
- **AI activity ribbon** — single observable for "is any AI call in flight right now". Pulses when active, idle otherwise.
- **Ghost-echo** — translucent emblem at dismiss origin (400ms hold + 800ms fade). Solves the object-permanence crash for ADHD users in deep hyperfocus.

### New — onboarding
- First-run gesture cheatsheet modal: grouped 3-finger / 4-finger / pen long-press / lasso recap. Dismiss with `Got it`, Esc, or backdrop tap.
- **Settings → Reset gesture tutorial** button replays the cheatsheet on next canvas open. Day-30 re-learning safety net.

### Changed
- **Long-press recognizer unified.** v1.6.9's pen-only 550ms long-press extracted into `src/features/gestures/longPress.ts` (pure state machine, exports `LONG_PRESS_MS=550`, `LONG_PRESS_SLOP_PX=8`, `LONG_PRESS_POINTER_TYPES=Set(['pen'])`). InkCanvas consumes the same module. Single source of truth.
- **Soft-abort for AI calls on freeze.** `requestUrl`-backed paths (Claude / Perplexity / OpenAI on iPad — load-bearing for CORS) cannot be aborted at the network layer. Soft-abort via token invalidation in `aiActivity` means responses arrive but are dropped. Native `fetch` paths (LM Studio) get a real `AbortController`.
- **Drop-in z-index under the tool layer.** Drop-ins dim AND become non-interactive while the tool layer is open. They're still visible — just not stealing focus.
- **Palette source of truth moved to `src/features/ink/palettes.ts`.** Tool layer toolbar and right-click context-menu cycling shortcuts share the same arrays.

### Tests
- 460/460 unit tests, including 9 LCG-seeded gesture-recognizer fuzz scenarios across palm-during-Pencil, sloppy 3→4 finger bursts, trackpad slow-drag, and random PointerEvent storms (anti-false-positive **and** anti-false-negative pinned).
- Fuzz tests run deterministically (200 iterations per scenario) so regressions are reproducible from a seed.

### Notes
- Z Fold Android Chromium WebView: the `useGestureRecognizer` hook is hardware-feature-detected; on Z Fold the Samsung gesture conflicts (screenshot, split-screen) intercept first — we don't fight them. Fuzz coverage stays in for when the test hardware shows up.
- Pencil double-tap: WebKit feature-detect retained; if the WebView drops it, the 550ms pen long-press is the fallback.

## 1.10.0 — 2026-05-02

The big cull. Ten drop-ins and the right-side AI sidebar are gone. The chat box is reborn as a canvas drop-in. Lasso flow collapses to a binary 123/ABC choice. Everything optimized for ADHD/bipolar use — anti-amnesia, anti-modal, fast and smooth.

### Removed (permanent)
- **All EE / lab / scratch drop-ins:** Circuit Sniper, Oscilloscope, Multimeter, Compute, Graph Plotter, Unit Circle, Unit Converter, Animation Canvas, Study Gantt, AI Drop-in. Source files deleted, factories removed from the hub, persistence layer drops them on read with a one-time migration Notice. Existing pages that referenced them lose those objects but keep ink/text/tables/PDFs/images intact.
- **Right-side AI panel** (the persistent `ChatPanel` sidebar) and its `Panel` wrapper. The whole right-pane resize/drag plumbing went with it (panelWidth, panelDragging, chatHeight, mobileRightTab — all removed). Reopener button gone too.
- **`showExperimentalTools` setting.** No longer relevant — there are no experimental tools.
- **Calculator drop-in.** Folded into the cull above.

### Kept
- Math toolbar (palette stamp), text, tables, PDF import, drawing/ink, OCR pipeline, file tree. The bullet-proof core. Export PNG stays.

### New — drop-ins as canvas-anchored notes
- **MathDropin** — KaTeX-rendered LaTeX block. Editable. Has a **Solve** button that fires the v12 preset and spawns a ChatDropin pinned beside it. Spinner during the vision call.
- **ChatDropin** — wraps the chat engine, lives on the canvas. When seeded from a lasso, the lasso image is pinned at the top of the conversation. Auto-fires v12 on `seedLatex`. Conversations are notes — they save with the page and stay where you put them.
- Drop-in philosophy: **anti-amnesia anchors.** Tool/meta planes are hideable; canvas objects are not. Out of sight is not out of mind — it's permanently lost. So nothing important hides.

### New — lasso flow
- **Lasso → radial 2-button (123 / ABC).** No more menu hunting, no more named modes that confused the flow.
  - **123** → vision → LaTeX → MathDropin spawned at lasso centroid.
  - **ABC** → ChatDropin spawned with the lasso image pinned, ready for free-form question.
- **100% of lassoed content goes to vision as image.** No pre-OCR. Vision sees what the user sees. (Pre-OCR was lossy and inconsistent across handwriting.)
- With only two choices, the radial degenerates cleanly to a left/right split at the lasso centroid — fast for hypomanic mode, still legible in depressive/mixed mode.

### Persistence & migration
- **`stripRemovedObjects` migration in the page loader.** First time v1.10 reads a page that contains any of the 10 deleted element types, it strips them and fires a one-time `Notice` so the user knows what happened. Loud once, silent thereafter. Migration tested with happy / partial / malformed / mixed-with-current cases.
- **`pageFormat.ts` rewritten.** New element types: `MathElementV3`, `ChatElementV3`. `V3_SOURCE_TAG` bumped to `"noteometry-1.10.0"`. The `pipeline` field is now optional on read, written empty on save. `unpackFromV3` uses a soft cast + `REMOVED_ELEMENT_TYPES` set so unknown types fail closed instead of crashing.
- **v1.9 reader compat.** Saves still emit `panelInput: ""` and `chatMessages: []` so a user on a stale v1.9 install can open a v1.10 page without the parser exploding. Those fields are documented as legacy on the `CanvasData` interface.
- **No permanently-spinning ghosts.** `MathElement.pending` and `ChatElement.pending` are forced to `false` on read. If the app crashed mid-AI-call, the drop-in comes back idle, not stuck.

### Removed UI plumbing
- `mobileRightTab` state, `panelOpen` / `setPanelOpen`, `handleDropChatToCanvas`, the Panel/chat resize handlers, the ◨ Panel reopener button. ≈100 lines of NoteometryApp.tsx gone.
- `MathPalette.onInsert` rerouted: the input box it used to populate is gone, so it now stamps via `setPendingSymbol(latex)` and closes the palette.

### ADHD / bipolar design notes (parked here for future reference; full research in `docs/adhd-bipolar-gui-research.md`)
- Calm-tech target: **peripherally present, not invisible.** Cursor indicators and 1px edge glows preferred over hidden state.
- Latency budget: pencil-to-ink ≤22ms, tool-plane summon ≤80ms (animate 150ms), AI ack ≤500ms, completion ≤8s streaming. Smoothness over raw speed — bipolar processing is measurably slower even in euthymia.
- Long-press contextual menu always works as a slow path — the radial is the fast path for hypomanic mode but inverts in depressive/mixed mode.

### Tests
- `tests/unit/contextMenuInsert.test.ts` rewritten for v1.10. `VISIBLE_HUB_FACTORIES` = textbox/table/image/pdf. `SPAWN_ONLY_FACTORIES` = math/chat (factory contracts, not in hub). New `stripRemovedObjects` migration coverage. All 243 tests pass.

### Out of scope
- 3D layers redesign (the next big swing). Research is done; implementation lands in v1.11.

## 1.9.1 — 2026-05-02

Release-pipeline fix. Every release in the v1.8.x and v1.9.0 line shipped a `manifest.json` with **no `"version"` field at all** — the field had been deleted somewhere in the v1.8.0 cleanup and never replaced. BRAT (and Obsidian's plugin manifest validator) refuse to install a plugin whose manifest lacks `version`, surfacing as `version attribute missing` in the BRAT log. Cosmetic doc rot piled on top of it.

- **`manifest.json` now carries `"version": "1.9.1"`.** Single root cause of the BRAT install failures since v1.8.0. Verified against the released asset on every prior tag — none of them had it. The `version-bump.mjs` driver still works for `npm version <x>` flows but was never the only path being used; the field is now in source so the build is correct regardless of how the bump is performed.
- **CI guard so the manifest can't drift from the tag silently.** `.github/workflows/main.yml` now fails the release job if `manifest.json` `version` ≠ the pushed tag (stripping a leading `v`). Catches both "forgot to bump" and "deleted the field again" at build time instead of post-release at install time.
- **`src/lib/version.ts` constant pinned to 1.9.1.** Was stuck on 1.7.2 through the whole v1.8.x line. The `tests/unit/version.test.ts` triple-pin (manifest / package.json / versions.json / constant) only catches drift when CI actually runs vitest — which the release workflow doesn't. The CI guard above closes that hole for the release path.
- **`versions.json` extended with `1.9.1` → `1.0.0`.** Required for the Obsidian community-plugin update channel even when not listed in the directory.
- **README cleanup.** Stale "v1.7.2" header removed; "6 Google colors" → "6 ink colors" (the Google Material palette reference dates from a much earlier draft and was never accurate to what's in the picker).
- **Stale draft releases v1.8.7 and v1.8.8 removed from GitHub.** They were sitting as never-published drafts confusing the release timeline.

**Out of scope (next pass):** Circuit Sniper drop-in mush — the OCR + node detection path needs a focused look, not a bolt-on fix from this release.

## 1.7.2 — 2026-04-28

Bugfix on the legacy migration path that shipped with the v1.7 line. `convertLegacyMdPagesToNmpage` was silently `continue`ing whenever the target `.nmpage` already existed, leaving the legacy `.md` on disk. The next plugin load re-detected the unmigrated `.md` via `findLegacyMdPages` and the legacy notice fired again — every restart, even after the user ran the convert command. The convert command's success counter also excluded the skipped files, so the user had no signal anything went wrong.

- **Walk to the next free numeric suffix on collision.** `Foo.nmpage` exists → rename to `Foo 1.nmpage`. `Foo 1.nmpage` also exists → `Foo 2.nmpage`, etc. Every legacy file is now always renamed and the notice goes silent.
- **Honest convert-command Notice.** The command now returns `{converted, collisions}` and the Notice surfaces both: "converted N pages (M renamed with a numeric suffix to avoid collision)". Users can compare the original `.nmpage` with the suffixed one and delete whichever they don't want.
- **Tests pin the migration contract.** `tests/unit/persistenceFileBound.test.ts` covers happy path, single-collision suffix, walk-past-existing-suffixes, and "leave real markdown alone" cases.

## 1.7.1 — 2026-04-28

First tagged release of the **Tier 3 native-explorer line**. The eight commits between v1.6.13 and v1.7.1 (`tier3:` prefix) replaced the plugin's own ItemView + internal Notebooks sidebar with an Obsidian-native `FileView` bound to `.nmpage` files: pages now live anywhere in the vault, navigation goes through Obsidian's file explorer, and there is no longer a duplicated sidebar. The bump-driver for v1.7.1 itself is the mobile-FAB fix below; the architectural shift is the line's headline change.

- **Mobile tools FAB now gated on `Platform.isMobile`** (the v1.7.1 trigger). CSS `@media` gating misfires inside the Obsidian webview — on iPad with an Apple Pencil paired the pencil reports as a fine pointer and landscape exceeds 768px, so the `@media (pointer: coarse)` and `(max-width)` guards both miss and the FAB stayed hidden. Touch users had no reachable entry to the canvas tool menu (long-press is `preventDefault`'d to drive ink). The FAB now renders only when `Platform.isMobile` (runtime, reliable inside the webview) and its full appearance rules moved out of the `@media` block to the base selector so JSX gating is the single switch.
- **NoteometryView is now a `FileView` bound to a TFile.** Each open page is an Obsidian leaf for one `.nmpage` file. `onLoadFile` re-renders React with the new file so drop-ins see the bound file. Per-page `tableStore` and `flushSave` scoping prevents cross-page bleed when multiple pages are open in different tabs.
- **`.nmpage` extension registered for the view.** `registerExtensions(["nmpage"], VIEW_TYPE)` makes Obsidian's file explorer the canonical entry point — clicking a `.nmpage` opens the canvas. No more plugin-owned Notebooks sidebar duplicating the navigation.
- **Ribbon icon repurposed to "New Noteometry page."** Replaces the singleton-canvas opener; creates a new `.nmpage` in the configured vault folder and opens it.
- **Stale workspace-leaf scrubber on layout-ready.** Obsidian's saved `workspace.json` could hold a `noteometry-view` leaf from the pre-Tier 3 singleton. After upgrade, those leaves had no bound file and rendered as empty/broken panes. The plugin now scans `iterateAllLeaves` on `onLayoutReady` and detaches any unbound `noteometry-view`.
- **Legacy `.md` page detection + migration command.** `findLegacyMdPages` scans the configured vault folder for legacy noteometry-JSON-in-`.md` files on load and surfaces a Notice prompting migration. `Noteometry: Convert legacy .md pages to .nmpage` runs the rename in bulk. (See v1.7.2 for the collision-handling fix.)
- **File-bound persistence API alongside legacy folder API.** `savePage` / `loadPage` now operate on a passed `TFile` rather than a folder + section + page name tuple, while the legacy folder-based API stays available for migration and tests.
- **Build-time guard against unintended vault deploys.** `esbuild.config.mjs` production builds now refuse to copy the bundle into `~/Documents/Noteometry/.obsidian/plugins/noteometry/` unless the current branch is `main`. Override with `NOTEOMETRY_FORCE_DEPLOY=1`. (Landed shortly after the v1.7.2 tag — prevents the "experimental branch stranded my vault" failure mode that the early Tier 3 attempt hit.)

## 1.6.13 — 2026-04-23

Diagnostic + visibility pass on top of v1.6.12. Dan's v1.6.12 report was "most updates didn't work, specifically all canvas and canvas tool updates. Screenshot works but is awkward. No GUI changes." Repo audit confirmed v1.6.12 code + release assets were correct and wired into the active runtime — the **chrome was just too subtle to see**. Math v12 prompt semantics, MathML generation, copy-to-Word, Word-clipboard pipeline, right-click/local hub, and every v1.6.9–v1.6.12 pipeline are untouched.

- **Root cause of "no GUI change apparent."** v1.6.12 rendered the new snapshot/download icons at `opacity: 0.55` on a `background: none` button sitting on the paper-colored title bar. On a white/cream drop-in header a 13px stroked glyph at 55% is nearly invisible, especially on touch where there's no hover state to reveal it. The code change landed; the visual change did not.
- **Drop-in chrome is now unmistakably visible.** Icons render at full strength (`opacity: 1`), sit on a recessed faceplate pill with a soft border, and grow from 2 buttons to 4: **Snapshot**, **Download / Copy rich text** (depending on drop-in type), **Duplicate**, **Delete**. Tap targets widen to 30×26 on coarse-pointer devices. Delete has a danger-tinted hover (red) so destructive intent is honest. Right-click hub still exposes the same actions; the chrome is additive.
- **Screenshot UX is no longer awkward.** v1.6.12 dropped the rasterized image next to the source with zero visible feedback, so Dan had to hunt for where the result went. v1.6.13: after a successful snapshot the new image object is auto-selected (shows selection ring) and a confirming Notice ("Snapshot added to canvas") fires. Failure modes still surface their specific Notices — the awkwardness was purely missing success feedback.
- **Version badge in Settings + console banner.** Obsidian aggressively caches plugin JS, so after a GitHub Releases install the user could be looking at a stale `main.js` without realising it. Settings → Noteometry now shows the running version in a highlighted row ("Version **1.6.13** — if this doesn't match the release you installed, restart Obsidian to clear cached plugin code"), and `plugin.onload()` logs `[Noteometry] v1.6.13 loaded` to the console. Pinned by `tests/unit/version.test.ts` — manifest / package.json / versions.json / the constant can never drift apart silently.
- **Duplicate + Delete icons eliminate the "right-click to do anything common" friction.** Duplicate creates a new copy offset 24/24 and selects it (plus a confirmation Notice). Delete shows a browser confirm dialog before removing the drop-in. Both mirror the right-click-hub entries exactly — just reachable with one click from the title bar.

**Tests & build:** 240 passing (22 files), 0 failing. `npm run build` green (tsc + esbuild). New: `tests/unit/version.test.ts` (3 cases pinning the version constant to all three manifest files).

**If the release assets were right but the design was too subtle:** yes, that's exactly what happened with v1.6.12. The chrome worked and clicked correctly — it just wasn't visible enough to notice. v1.6.13 fixes that at the CSS + component level with no changes to the underlying code paths.

**Out of scope (hard constraints, untouched):** Math v12 prompt semantics, MathML generation, copy-to-Word, Word-clipboard pipeline, right-click/local hub, classic object handling, v1.6.9's default-pen-tool and direct-object-drag behaviour, v1.6.10's pinch-zoom / 16-week template / reveal-in-Finder paths, v1.6.11 paste / rename / Perplexity data-URI fixes, v1.6.12 wheel routing / resize handles / rich-text copy.

## 1.6.12 — 2026-04-23

Canvas-and-drop-in UX pass on top of v1.6.11. Six of Dan's nine reported issues from the post-1.6.11 checklist addressed; the other three (left-sidebar compact rail, icon-first UI sweep, OCR verification step) are scoped into design notes for a follow-up so they don't ship half-finished. Math v12 prompt, MathML generation, copy-to-Word / clipboard-for-Word pipeline, right-click/local hub, and v1.6.9 direct-drag / default-pen behaviour are all untouched.

- **Two-finger scroll no longer dies over drop-ins.** Root cause: `NoteometryApp`'s wheel handler bailed out as soon as the target was inside `[data-dropin-id], textarea, .noteometry-object-content`, without preventing default AND without panning. On a MacBook Pro, that turned every drop-in into a dead zone — the pan stopped mid-gesture if the cursor crossed a calculator or compute block. Routing is now delegated to a pure `shouldYieldToNativeScroll()` helper (`src/lib/wheelRouting.ts`): it walks from the event target up to the canvas viewport and only yields if an ancestor is genuinely scrollable in the axis the wheel is moving (overflow auto/scroll AND scrollHeight/Width > clientSize AND not already pinned at the boundary). Anything else falls through to canvas pan — OneNote / MyScript behave the same way. Pinned by 8 unit tests (null target, overflowing vs non-overflowing, overflow:hidden, horizontal axis, boundary stops). `InkCanvas`'s wheel handler gets the same treatment as a belt-and-suspenders.
- **Drop-in screenshot-to-canvas button actually works.** Pre-v1.6.12 the camera icon was expected to rasterize the drop-in and drop the result onto the canvas, but `html2canvas` was silently returning blank canvases on iframe / PDF drop-ins and the failure surfaced as "nothing happened." The snapshot path is now split into `rasterizeDropin` + `measureDataUrl` + a canvas-drop orchestrator in `CanvasObjectLayer.tsx`, so a blank capture is detected explicitly and surfaced via an Obsidian `Notice` suggesting Download PNG as a fallback instead of failing silently.
- **Drop-in download / export chrome.** New chrome icon pair in every drop-in title bar — snapshot (drop-onto-canvas) and download (PNG for most types, rich-text HTML/plain for text boxes, direct data-URL save for image drop-ins). Filenames run through a new `sanitizeDownloadName` helper (`src/lib/dropinExport.ts`) that strips path-reserved chars, collapses leading dots, caps length at 120 chars, and falls back to `drop-in` when cleaning produces an empty string. Pinned by 14 unit tests.
- **Rich-text drop-in Copy-as-HTML.** The `RichTextEditor` toolbar gains a dedicated Copy button that writes both `text/html` and `text/plain` to the system clipboard via `ClipboardItem`, falling back to plain-text `writeText` on WebViews that don't support rich clipboard writes. Pasting into Word / Google Docs now preserves bold / italic / lists / font size. The Copy-to-Word Math pipeline is **untouched** — this is a separate, distinctly-named helper (`buildRichTextClipboardBlobs` in `dropinExport.ts`) that returns Blob maps for `ClipboardItem`, not the `{html, plain}` string pair that `mathml.ts::buildClipboardPayload` produces for the Math v12 path.
- **Resize handles don't eat ink any more.** v1.6.11's handles were 6px wide (edges) / 12px corners, which was miserable to grab on iPad, and the underlying ink canvas could still receive pointer events through stacking quirks on touch. Edges widened to 10px and corners to 14px; every handle now carries `touchAction: "none"` and a `data-resize-handle` attribute; `InkCanvas`'s `handlePointerDown` now bails early when the raw target matches `[data-resize-handle], .noteometry-canvas-object` even if stacking would have let the event through.
- **Text drop-in reflow confirmed OneNote-like.** User request was for rich-text block semantics — resize changes box width, text reflows, toolbar controls font size. The existing `RichTextEditor` already satisfies this via `overflow-y:auto` + width-driven reflow; the v1.6.12 change is the new Copy button plus clarified title-bar download behaviour. No resize math was changed.
- **Icon-first chrome on drop-in title bars.** Emoji camera button replaced with two stroked SVG icons (snapshot + download) inside a `.nm-object-chrome-icons` wrapper; coarse-pointer media query enlarges the tap targets on touch. This is the first installment of the broader icon-first sweep — the sidebar and toolbar pass is deferred.

**Tests & build:** 237 passing (21 files), 0 failing. `npm run build` green (tsc + esbuild). New test files: `tests/unit/wheelRouting.test.ts` (8 cases), `tests/unit/dropinExport.test.ts` (14 cases).

**Deferred to v1.6.13:** left-sidebar collapsible / compact rail (issue 6 — requires a design pass on the footer + section list + tab rail that's out of scope for a focused bug-fix release), broader icon-first UI sweep beyond drop-in chrome (issue 8), OCR verification / confirm-before-compute affordance (issue 9 — needs a UI contract with the Math v12 compute path, and I will NOT touch that pipeline without an explicit go-ahead).

**Out of scope (hard constraints, untouched):** Math v12 prompt semantics, MathML generation, copy-to-Word, Word-clipboard pipeline, right-click/local hub, classic object handling, v1.6.9's default-pen-tool and direct-object-drag behaviour, v1.6.10's pinch-zoom / 16-week template / reveal-in-Finder paths, v1.6.11 paste / rename / Perplexity data-URI fixes.

## 1.6.11 — 2026-04-23

Follow-up repair pass on top of v1.6.10. Five user-reported bugs, scope intentionally narrow — Math v12 prompt, MathML generation, copy-to-Word, clipboard-for-Word pipeline, right-click/local hub, and v1.6.9's direct-drag / Pencil-draw behaviour are all untouched.

- **Paste now works on the canvas.** Pre-v1.6.11 the paste listener was bound to the canvas-area `<div>`, which never receives `paste` events (divs aren't focusable; the event lands on the document or an inner input). Users reported "when I paste" with nothing happening. The listener now sits on the document and bows out when the target is editable (input / textarea / contenteditable), so chat, `RichTextEditor`, and `TableEditor` paste paths are untouched. System-clipboard images drop as a canvas image object and persist via `saveImageToVault`; the internal object clipboard (from right-click Copy) pastes with undo; plain text falls through with an explicit Notice instead of a silent no-op.
- **"Copy" without "Paste" fixed.** v1.6.10 shipped Cut/Copy/Duplicate on the object right-click menu but no Paste, so `objectClipboardRef` was write-only. Paste is now present both on the object submenu (at the right-click world point) and on the empty-canvas hub (between Clear Canvas and the Drawing section), each disabled when the clipboard is empty. New pure helper `src/lib/objectClipboard.ts` (fresh id, anchor honored, cascade offset when no anchor given) is pinned by 5 unit tests.
- **Rename works and reports errors.** Pre-v1.6.11 any blank / unchanged / colliding / filesystem-unsafe name silently cancelled the rename with no message, so the user reported "Rename doesn't work." Rename validation is now a pure helper (`src/lib/renameValidation.ts`) surfacing Notice messages on all rejection cases, pinned by 7 unit tests. Section rename also moves the `attachments/` folder (images and PDFs no longer strand). A pencil `IconPen` button is now visible on every section tab and every page row so touch users don't have to rely on double-click to enter rename mode. Success emits a confirming Notice.
- **Drop-in screenshot icon now drops onto the canvas.** Pre-v1.6.11 the camera icon rasterized the drop-in and wrote it to the system clipboard (or downloaded a file if clipboard write failed), which didn't match the user's expectation — "clicking the camera should drop the screenshot onto the canvas." The button now rasterizes via html2canvas, persists through `saveImageToVault` when a section is active, and appends an image object offset from the source drop-in. Width is capped at ~90% of the source width (520 px max) so the snapshot fits next to the original. Failure paths surface Notice messages instead of silent `console.error`.
- **Perplexity HTTP 400 "data URI must start with 'data:image/'" fixed.** When an attachment had an empty or non-image mime type (paste with `mimeType: ""`, or a file picker reporting `application/octet-stream`), `claudeToPerplexityInput` constructed `data:${mediaType};base64,...` that failed the Perplexity validator. New pure helper `src/lib/aiImageFormat.ts#toImageMediaType` coerces any non-image / empty mime type to `image/png` so the request is structurally valid; non-image attachments are now also filtered out of the Perplexity formatted list (the provider only accepts images). Claude and LM Studio paths are unchanged. Pinned by 5 unit tests.
- **Shared-textbook / per-week checklist spec filed, not implemented.** User wants a single course-wide PDF plus a checklist object instead of re-uploading the textbook to each of 16 weekly folders. The full feature crosses persistence layout, the PDF drop-in, and a new canvas object type — too big for this pass without risking a half-broken state. Full design note is in `docs/SHARED_TEXTBOOK_SPEC.md` including the proposed `_course/` layout, `ChecklistObject` shape, migration risk, and the settings flag it would ship behind. No UI affordance added so there's no vestigial half-feature.

**Tests & build:** 215 passing (19 files), 0 failing. `npm run build` green. New test files: `tests/unit/objectClipboard.test.ts` (5 cases), `tests/unit/renameValidation.test.ts` (7 cases), `tests/unit/perplexityImageUri.test.ts` (5 cases).

**Out of scope (hard constraints, untouched):** Math v12 prompt semantics, MathML generation, copy-to-Word, Word-clipboard pipeline, right-click/local hub, classic object handling, v1.6.9's default-pen-tool and direct-object-drag behaviour, v1.6.10's pinch-zoom / 16-week template / reveal-in-Finder paths.

## 1.6.10 — 2026-04-23

Three narrow, user-reported repairs from v1.6.9 testing. Scope intentionally minimal — Math v12 prompt, MathML generation, copy-to-Word, clipboard pipeline, right-click hub, and v1.6.9's direct-drag/Pencil-draw behaviour are all untouched.

- **MBP trackpad pinch-zoom restored.** Root cause was a rounding bug combined with a stale-closure wheel listener. Chromium surfaces a two-finger trackpad pinch as `wheel` events with `ctrlKey: true` and small floating `deltaY` (often ±0.5). The pre-v1.6.10 handler computed `Math.round((zoom + delta) * 100) / 100` — at the pinch scale `0.01`, a `deltaY` of `-0.5` produces a `+0.005` change that rounds straight to zero, so the user got zero visible motion and reported zoom as "dead." Separately, the parent wheel listener closed over a stale `zoom` state and was re-attached on every zoom tick. Fix: handle zoom directly in `InkCanvas`'s wheel handler (the hot path) via a new pure helper `src/lib/wheelZoom.ts` that rounds to **3 decimals**, clamps to `[0.25, 4.0]`, and scales ~2× larger for pinch (`ctrlKey`) than for `Cmd+wheel` (mouse). Parent handler still listens as a belt-and-suspenders backup, now resilient via refs instead of closures. iPad Apple-Pencil drawing, two-finger pan, and desktop middle-click-drag pan paths are untouched. Pinned by 8 unit tests in `tests/unit/wheelZoom.test.ts` (MBP small-delta case, scale parity, direction, clamping, rounding).
- **16-week course template rediscoverable.** The helper was never actually missing — the sidebar button was labelled just "Course", which in a list alongside "New page" / "New section" read as a generic "create something called Course" rather than "seed a 16-week semester." Renamed the sidebar button to **"16-week course"** so intent is literal, extracted the seeding loop into a pure helper `src/lib/courseTemplate.ts` (via a `createSixteenWeekCourseWith` DI helper and a concrete `createSixteenWeekCourse` wrapper in `sidebarActions.ts`), and added `tests/unit/sidebarActions.test.ts` pinning the contract: section + exactly 16 `Week 1…Week 16` pages, whitespace trimmed, blank names rejected, section created before any page. Same helper is now used by the Sidebar button **and** the first-run `usePages` seed, so the two paths cannot silently drift apart again.
- **Sidebar file-structure transparency.** User reported "I'm not convinced each page is its own file, and I can't copy folders." Sidebar now shows a persistent footer displaying the live vault path (e.g. `Noteometry/EE 301`) so it's immediately obvious pages are real `.md` files in a real folder, and a new reveal-in-Finder button opens the section folder in the host OS file manager via Obsidian's `app.showInFolder()` (Finder on macOS, Explorer on Windows, default manager on Linux). On mobile (iPad / Android, where no filesystem reveal API exists) the button falls back to copying the vault-relative path to the clipboard and surfacing a Notice. Implementation is in `src/lib/sidebarActions.ts` (`revealSection`, `sectionVaultPath`) guarded by `instanceof FileSystemAdapter`.

**Tests & build:** 198 passing (16 files), 0 failing. `npm run build` green (tsc + esbuild). New: `tests/unit/wheelZoom.test.ts` (8 cases), `tests/unit/sidebarActions.test.ts` (5 cases on the pure helper).

Out of scope (hard constraints, untouched): Math v12 prompt, MathML generation, copy-to-Word, clipboard pipeline, right-click/local context hub, v1.6.9's default-pen-tool and direct-object-drag behaviour. No voice/chat/ChatGPT feature added.

## 1.6.9 — 2026-04-22

Interaction-model repairs from v1.6.8 testing. Scope intentionally narrow — right-click hub concept, math v12 prompt, MathML/clipboard pipeline untouched.

- **Apple Pencil / mouse now draw on an empty canvas.** Root cause: the default tool was `"select"`, which pipes pointer events away from the ink layer (`pointer-events: none` on the canvas element). On first-ever open, stroking with a Pencil produced nothing visible and looked broken. Default tool is now `"pen"` — the canvas is ready to draw the moment the view renders.
- **Direct object drag restored.** Drop-in objects (calculator, graph, unit converter, circuit…) were only draggable while the user was in the lasso-like `"select"` tool, which contradicted "every normal app supports direct object dragging." Objects are now always interactive: tap-drag on the object body moves it, while clicks on inner controls (inputs, buttons, sliders, contenteditable regions, inner canvases) pass through as normal. Hit test lives in `src/lib/objectDragHitTest.ts` with the selector list documented in code and pinned by a jsdom unit test.
- **Clear Canvas reachable on iPad.** Pinned at the **top** of the right-click hub (directly under Undo/Redo, behind its own separator) instead of the bottom of a ~30-item menu. Old placement required two-finger scroll to the last row on short iPad viewports and the scroll container rubber-banded away. Also raised `.noteometry-ctx-menu` `max-height` to 80vh (70vh on touch), enabled `-webkit-overflow-scrolling: touch`, and set `touch-action: pan-y` on the scroll container + `manipulation` on rows so iOS Safari stops hijacking the gesture.
- **Math palette tap routing fixed.** Pure glyphs (π, ω, →, ∈, ∞, ⏚ ground marker, circuit DC supply, etc.) now arm a **pending stamp** — next canvas tap drops it. Structural LaTeX (fractions, matrices, `\sum_{i=1}^{n}`, `\int_{a}^{b}`, `\begin{pmatrix}…`) still goes to the Input textarea where it needs editing before it can render. Routing logic is in `shouldArmStamp()` in `src/components/MathPalette.tsx` and is pinned by a parameterised unit test covering 20+ symbols across tabs.
- **Apple Pencil long-press opens the tool hub.** Pencil double-tap is NOT exposed to web pages in WebKit/Safari, so a reliable fallback is required. Pressing-and-holding the Pencil tip for 550 ms (with an 8px movement slop) now opens the right-click context menu at the hold location — and if a stroke was mid-draw, it's cancelled so the menu-open isn't also a scribble. Mouse/touch right-click + two-finger tap continue to work as before.
- **Tests:** added `tests/unit/mathPaletteStamp.test.ts` (22 cases — stamp vs. input routing, circuit markers, per-tab reachability), `tests/unit/contextMenuLayout.test.ts` (3 cases — Clear Canvas is in the first 5 rows, separator below, Undo/Redo precede it), `tests/unit/objectDragHitTest.test.ts` (8 cases — drag starts on body, not on form controls / contenteditable / canvas / role=button). Existing suites untouched. Total: 185 passing, 0 failing.

Out of scope (hard constraints, untouched): Math v12 prompt, MathML generation, copy-to-Word, clipboard pipeline, right-click context hub concept. Lasso stack behaviour from v1.6.8 is preserved — this release only *adds* a direct-drag path for objects; lasso is still the tool for multi-region erase / move / process.

## 1.6.8 — 2026-04-22

Two narrow repairs from v1.6.7 test feedback: **"Clear Canvas tool disappeared"** and **"Lasso Clear does nothing. Lasso Move does nothing."** Existing architecture — right-click hub, multi-region lasso stack, freehand/rect modes, rasterize/composite pipeline, stack-based action bar — is preserved; these fixes restore classic behaviour without rewriting anything.

- **Clear Canvas restored to visible prominence.** The action had never actually left the codebase — it was the last item in the Canvas section of the right-click hub — but after the v1.6.6/v1.6.7 hub repairs it sat immediately below **Export PNG** with no separator, in a ~30-entry menu that scrolls on shorter viewports. With a visually identical neighbour it read as gone. Added a separator above it, pulled the item into a dedicated `buildClearCanvasAction` factory (so a unit test can pin the invariant), and kept the existing safety rails: two-step confirm, `pushUndo()` before state wipe, autosave naturally picks up the post-clear state.
- **Defensive console error** if a future refactor ever drops Clear Canvas from the assembled menu — silent disappearance is the exact failure mode this release is fixing, so regressions now shout.
- **Lasso Clear now deletes.** The Clear button previously only wiped the region outlines while leaving all captured content in place, so it read as a no-op. Clear now:
  - Removes strokes whose points fall inside any region polygon,
  - Removes stamps whose center is inside any region,
  - Removes canvas objects whose bbox overlaps any region,
  - Records an undo snapshot (so `Ctrl/Cmd+Z` restores),
  - Persists via the normal autosave subscription,
  - Surfaces a `Nothing selected to delete` Notice when the region is empty instead of silently doing nothing.
- **Lasso Move stops being swallowed by a new lasso draw.** The main lasso drawing listeners on the viewport container ran in capture phase and fired even while Move mode was active, so the user's pointerdown started a fresh lasso instead of grabbing the selection. Added a `moveModeRef` guard to those listeners.
- **Move now gives visual feedback on entry.** The ghost snapshot canvas is painted at the selection's starting position as soon as Move activates (instead of staying blank until the first `pointermove`), and a `Drag the selection to its new position` Notice fires. Previously the action bar disappeared and the canvas looked idle, which read as "Move does nothing".
- **Pure selection/mutation helpers extracted.** `src/features/lasso/selection.ts` holds `deleteStrokesInPolygons`, `moveStrokesInPolygon`, `selectionIsEmpty`, world/screen transforms, etc. `handleLassoMoveComplete` was refactored onto these helpers — same math, testable without a DOM.
- **Tests:** `clearCanvasAction.test.ts` pins the Clear Canvas label, `danger` flag, onClick wiring, and the distinction from the lasso overlay's "Clear" button. `lassoSelection.test.ts` covers the lasso helpers end-to-end — screen↔world conversion, polygon + bbox selection, pure delete/move semantics on strokes/stamps/objects, multi-region union, preserved relative positions, and the "empty selection" predicate.

Out of scope (hard constraints, untouched): Math v12 prompt, MathML generation, copy-to-Word, clipboard pipeline, right-click context hub concept. The lasso was not rewritten from scratch — the existing `LassoOverlay`, `useLassoStack`, rasterize/composite pipeline, and stack-based action bar are preserved.

## 1.6.7 — 2026-04-22

Follow-up pass on v1.6.6 manual-test feedback.

- **Circuit Sniper — angled snap, take two.** v1.6.6 fixed `getPinCoords` so rendered pins match returned endpoints at 30/45/60°, but pins still didn't *connect* — the 12 px pin hit target is tiny and off-grid at those angles, so the pointer kept missing it mid-drag. Added proximity-based pin lookup (`findNearestPin`, 20 px threshold): while drawing or editing a wire, the tip now locks onto the nearest pin across any angled component. Same logic for wire endpoint edits.
- **Trackpad pinch zoom on desktop.** The InkCanvas container's wheel handler was pan-on-every-event, which ate the pinch gestures (Chromium synthesises `wheel` + `ctrlKey: true`) before the viewport's zoom handler could see them. Bailed early when `ctrlKey` or `metaKey` is set so pinch zoom reaches the parent cleanly; plain two-finger scroll still pans.
- **Context-hub cleanup:**
  - Renamed **Compute → Calculator** in the hub and on the drop-in chrome. The feature is the same (named-variable scratchpad); the label was the problem. Persistence keeps the `compute` kind for backward compatibility.
  - Hid **Animation Canvas**, **Study Gantt**, and **Multimeter** from the main hub by default. User feedback was "WTF is this for" / "worthless" / "doesn't fit" — they're legacy or speculative, not part of the core math/EE flow. Re-enable via **Settings → Show experimental tools**. Existing pages with these drop-ins still render exactly as before.
- **Calculator inline help** now gives a concrete EE example (`V=12`, `R=1000`, `V/R`) so the drop-in's purpose is obvious at first insert.

Out of scope for this pass (hard constraints): Math v12 prompt, MathML generation, copy-to-Word, clipboard pipeline, right-click hub concept — untouched.

## 1.6.6 — 2026-04-22

- **Context hub repair:** audited every right-click insert action. Fixed broken wiring in GraphPlotter (empty signal-bus subscribe removed, added pan/zoom controls), StudyGantt (exposed startDay/duration/progress/color controls so tasks aren't inert), UnitConverter (re-sync baseValue when the persisted prop changes externally), CircuitSniper (moved render-phase onChange into useEffect).
- **Quarantined AI drop-in:** the inline textarea + "Type a problem" input bar had no handlers and silently dropped input. The drop-in is removed from the creatable hub and replaced with a deprecation placeholder pointing at the right panel. Legacy pages still load.
- **Robust insert path:** every Insert/Drop-in handler now wraps in try/catch and surfaces a Notice on failure instead of silently no-oping.
- **Type cleanup:** removed unneeded `as "DCV"` cast on Multimeter wiring — factory type already matches.
- **Tests:** added `contextMenuInsert.test.ts` guardrail covering every hub factory + the quarantined legacy factory.

### Manual-test follow-ups (second pass)

- **Insert Image:** FileReader / Image decode / vault-save now each have their own error notice + console path, and successful inserts select the new object (matching Text Box / Table). Previously any silent failure — unreadable file, unsupported format, blocked vault write — looked identical to "nothing happened".
- **StudyGantt edit controls:** clicking duration / start-day / progress inputs no longer steals focus back to the title field. The auto-focus fallback only fires when the click lands on empty space inside the object wrapper, not on an interactive control.
- **Graph Plotter pan/zoom:** canvas is now directly click-drag pannable and wheel/trackpad-pinch zoomable; the button row remains for touch/pen. Pinch (`ctrlKey` synthesized by Chromium/Electron) uses a finer zoom step.
- **Trackpad two-finger scroll:** plain wheel events (without Cmd/Ctrl) now pan the canvas viewport via `scrollX`/`scrollY` deltas, divided by the current zoom so gesture distance matches on-screen. Drop-in internal scrollers still win over canvas pan.
- **Circuit Sniper angled snap:** `getPinCoords` no longer grid-snaps pin coords when the component is at a non-axis-aligned rotation. At 30°/45°/60° etc. the rendered pin and the returned endpoint now agree, so angled components actually overlap when you push them together.
- **Compute / Animation Canvas / Multimeter:** added minimal inline hints so first-use isn't confusing — "useless"-looking empty states now explain what to do.

## 1.6.5 — 2026-04-17

- **Math v12 guardrails:** regression tests for Math v12 prompt, MathML output, and copy-to-Word clipboard behavior. (`1615dd0`)

## 1.6.4 — 2026-04-17

- **Mobile CSS:** trigger mobile layout on coarse pointer too, so Z-Fold / foldable devices get the mobile tabs and FAB. (`72f1951`)

## 1.6.3 — 2026-04-17

- **Touch strokes:** release pointer capture after touch strokes so subsequent taps aren't swallowed.
- **Mobile:** add Tools FAB for quick access to drawing tools on mobile. (`1151fc5`)

## 1.6.2 — 2026-04-17

- **Android:** finger drawing mode toggle in Settings → Finger drawing, so users without a stylus can still draw on Android. (`5048bbc`)

## 1.6.1 — 2026-04-17

- **deleteSection:** use recursive rmdir so the section folder actually goes away instead of leaving empty shells behind. (`985a021`)

## 1.6.0 — 2026-04-17

- **Mobile:** right panel Input/Chat tabs with hide button; math palette docks top on mobile instead of bottom; context menu scrolls when it overflows.
- **Versioning:** CHANGELOG + scripts/ship.sh helper so every visible change gets its own patch bump.
- Rolls up 1.5.1 through 1.5.8.

## 1.5.8 — 2026-04-17

- **Mobile:** stack canvas above right panel at <=768px; raise panel height from 40vh to 65vh. (`72c9335`)

## 1.5.7 — 2026-04-17

- **Sidebar:** section tabs stack vertically instead of truncating at 100px. Left-border accent replaces bottom-border. (`4a29636`)

## 1.5.6 — 2026-04-17

- **Stamp menu:** label "Regular" renamed to "Normal" to match the internal `StampSize` enum. (`c7ce6d5`)

## 1.5.5 — 2026-04-17

- **Clear Canvas:** now wipes drop-ins too, not just strokes and stamps. Double confirmation retained. (`81d0191`)

## 1.5.4 — 2026-04-17

- **Stamp size:** collapsed from three sizes (S/M/L floating toggle) to Small/Normal via right-click context menu. (`306fe0e`)

## 1.5.3 — 2026-04-17

- **Drop-in z-order:** pointer-down on any drop-in raises it above stacked neighbors. Capture phase, so interactions inside a drop-in's own content still trigger the raise. (`d2a9ad4`)

## 1.5.2 — 2026-04-17

- **AI error surfacing:** `throw: false` on Obsidian `requestUrl` so Anthropic/LMStudio 4xx bodies reach the UI instead of the generic "Request failed" wrapper.
- **Chat history:** drop ghost-empty user turns (leftover from image-only sends whose attachments aren't persisted) that were causing 400 `non-empty content` errors. (`dc88320`)

## 1.5.1 — 2026-04-17

- **ChatPanel:** accept pasted (⌘V) and dragged/dropped images directly instead of letting Obsidian create a `file://` link to a temp path that gets wiped.
- **Build:** deploy only to `plugins/noteometry`; was also writing to a stale `noteometry-build` clone that kept resurrecting. (`40f49de`)

## 1.5.0 — earlier

- Full source recovery, 14 drop-ins, PDF fix, Circuit Sniper.
