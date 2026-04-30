# Changelog

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
