# Changelog

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
