# Noteometry Development Guide

> Current as of **v1.14.11**. See [RELEASE.md](../RELEASE.md) for the ship checklist.

## Setup

```bash
git clone https://github.com/danthemadhatter/noteometry-obsidian.git
cd noteometry-obsidian
npm install --legacy-peer-deps
```

## Build

```bash
npm run build    # TypeScript check + esbuild production bundle + auto-deploy (main branch only)
npm run dev      # esbuild watch mode (rebuild on file changes)
npm test         # Run vitest unit tests
npm test -- --run  # Run vitest once (no watch)
```

Production builds auto-deploy `main.js`, `styles.css`, and `manifest.json` to `~/Documents/Noteometry/.obsidian/plugins/noteometry/` (the Obsidian Sync vault) **only when the working tree is on `main`**. Branch builds skip the deploy step so a feature branch can't clobber the running plugin.

## Development Workflow

1. Edit source files in `src/`
2. Run `npm run build`
3. In Obsidian: Settings → Community plugins → toggle Noteometry off/on (or Ctrl+P → "Reload app without saving")
4. Test the changes
5. Commit and push — open a PR, squash-merge, then `.github/workflows/auto-tag.yml` auto-tags + auto-releases ~35-45s after merge

## Project Structure

### Entry Point: `src/main.ts`
- Extends Obsidian's `Plugin` class (~294 lines)
- `registerView(VIEW_TYPE, …)` for `NoteometryView`
- `registerExtensions(["nmpage"], VIEW_TYPE)` so `.nmpage` opens directly in the canvas
- Loads/saves settings; `addRibbonIcon("pencil", "New Noteometry page")`
- Two commands: **New page** and **Convert legacy .md pages to .nmpage**
- On layout-ready, sweeps any stranded `noteometry-home` leaves (the legacy HomeView removed in v1.14.10)
- Applies the global theme (`globalThemeEnabled`) to Obsidian's chrome

### View Bridge: `src/NoteometryView.ts`
- Extends Obsidian's `FileView` — bound to one `.nmpage` `TFile`
- Mounts React root on `onOpen()`; re-renders on `onLoadFile()` so drop-ins and CanvasNav see the bound file
- Calls `flushSave()` on `onClose()` to prevent data loss
- `onUnloadFile` / `onClose` use `lastFile` because `this.file` is null between them
- Blocks touch swipe gestures (bubble-phase `stopPropagation`)

### Root Component: `src/components/NoteometryApp.tsx`
- ALL state lives here (no global stores except `tableStore`)
- Manages: canvas state, panel state, chat state, persistence, undo/redo, ctxMenu state
- This is the God Component by necessity (Obsidian plugin constraints)

### State Management Pattern
- React `useState` for all UI state
- `useRef` for mutable values accessed in event handlers (avoids stale closures)
- `useCallback` with explicit dependency arrays for all handlers
- `tableStore.ts` is the only module-level store (tables/textboxes need to be accessed by ID from child components)

## Key Code Patterns

### Stale Closure Prevention
InkCanvas uses refs (`strokesRef`, `toolRef`, `scrollRef`, etc.) that mirror state values. Event handlers read from refs instead of state to avoid capturing stale values in closures:
```typescript
const strokesRef = useRef(strokes);
useEffect(() => { strokesRef.current = strokes; }, [strokes]);
// In event handler: use strokesRef.current, not strokes
```

### Conditional Event Listeners
InkCanvas conditionally attaches pointer event listeners based on the current tool. In "select" mode, NO listeners are attached, and the canvas has `pointerEvents: "none"` — this lets clicks pass through to the CanvasObjectLayer beneath it.

### Touch vs. Stylus Discrimination
All pointer handlers in InkCanvas check `e.pointerType`:
- `"touch"` → always pans (handled by separate touch effect, unless `fingerDrawing` is enabled)
- `"pen"` or `"mouse"` → uses current tool (pen, eraser, grab, shapes)

### Auto-Save Debouncing + Recovery Cache
A `useEffect` watches all saveable state. On change, it clears any pending timer and sets a new 2-second timeout. The `loadingPageRef` flag prevents saves from firing when loading a new page. The save path mirrors the page synchronously to `localStorage` under `nm:cache:<path>` **before** the async `vault.modify` await, so a tab close mid-save still recovers on reload.

### Event Bubbling Inside CanvasNav (v1.14.11)
CanvasNav's outer shell stops propagation on `click` / `dblclick` / `contextmenu` / `mousedown` so a right-click on a nav row doesn't bubble up to the canvas's `onContextMenu={handleCanvasContextMenu}` and pop the big tools hub. The same fix applies in both the open-state and the collapsed-rail render branches. Pinned by `tests/unit/v1411CanvasNavEventBubble.test.ts`.

### `noUncheckedIndexedAccess`
`tsconfig.json` enables this — `array[i]` returns `T | undefined` even when `i` looks "obviously" valid. The repo-wide pattern is to capture into a `const` and null-check before use. Existing tests will catch regressions, but the type errors are loud enough on their own.

## Testing

Tests are in `tests/unit/` using Vitest:
```bash
npm test              # Run all tests (watch mode)
npm test -- --run     # Run once (CI / pre-merge)
npx vitest --watch    # Watch mode (alternative)
```

**Configuration** (`vitest.config.ts`):
- `environment: "node"` — no jsdom. DOM-touching tests stub `document` / `localStorage` / etc. via `vi.stubGlobal` or build minimal fakes inside the test.
- `obsidian` runtime is aliased to `tests/stubs/obsidian.ts` so any module that imports from `obsidian` resolves under plain Node.

**Baseline at v1.14.11:** 51 test files, 565 tests. Read `tests/unit/` directly for the authoritative current list — adding it inline here drifts every release. Notable suites:

- `version.test.ts` — fails loudly if `manifest.json` / `package.json` / `versions.json` / `src/lib/version.ts` drift apart
- `mathV12Preset.test.ts`, `mathml.test.ts`, `clipboardPayload.test.ts` — protected pipelines (Math v12 DLP, MathML, copy-to-Word). Changes require explicit review, not a drive-by refactor.
- `persistenceFileBound.test.ts`, `persistenceRecoveryCache.test.ts`, `persistenceV3.test.ts` — file-bound API, recovery cache, v3 round-trips
- `gestureRecognizer.test.ts`, `gestureFuzz.test.ts`, `longPressRecognizer.test.ts`, `gestureBinding.test.ts` — gesture state machines
- `v11*.test.ts`, `v141*.test.ts` — version-pinned regression tests for shipped fixes (each release that fixes a bug should add one here)

To add tests for a new module:
1. Create `tests/unit/<module>.test.ts`
2. Import from the module under test (`../../src/lib/<module>`, `../../src/features/...`, etc.)
3. Run `npm test -- --run`

## Build Configuration

### esbuild (`esbuild.config.mjs`)
- Entry: `src/main.ts`
- Output: `main.js` (CJS format, ES2018 target)
- External: `obsidian`, `electron`, CodeMirror modules, Node builtins
- Production: minified, no sourcemap
- Development: inline sourcemap, watch mode
- Auto-deploy: copies built files to Obsidian Sync vault after production build **on the `main` branch only**

### TypeScript (`tsconfig.json`)
- Target: ES6, Module: ESNext
- JSX: react-jsx
- Strict mode enabled
- `noUncheckedIndexedAccess: true` (see Key Code Patterns)
- `skipLibCheck` used in build command (Obsidian types have issues)

## AI Integration

### Adding a New AI Provider
1. Add provider to `AIProvider` type in `types.ts`
2. Add settings fields to `NoteometrySettings` and `DEFAULT_SETTINGS`
3. Implement the call function in `ai.ts` (see `callClaude` and `callLMStudio` patterns)
4. Add dispatch branches in `readInk`, `solve`, and `chat`
5. Add settings UI in `settings.ts`

### API Call Pattern
All AI calls go through Obsidian's `requestUrl` (for Claude / Perplexity) or standard `fetch` (for LM Studio). `requestUrl` bypasses CORS, which is required on iPad.

```typescript
const response = await requestUrl({
  url: "https://api.anthropic.com/v1/messages",
  method: "POST",
  headers: { ... },
  body: JSON.stringify({ ... }),
});
```

## CSS Architecture

All styles in a single `styles.css` file:
1. **KaTeX CSS** (line 1) — bundled inline from katex package
2. **CSS Variables** — design tokens (colors, radii, shadows, fonts)
3. **Layout** — root container, split, canvas area, right panel, **CanvasNav strip on the canvas (v1.14.9+)**
4. **Components** — toolbar, objects, palette, chat, etc.
5. **Responsive** — `@media` queries for tablet (<1024px) and phone (<768px)

CSS class prefix: `noteometry-` for all plugin classes.

## Common Tasks

### Adding a New Tool
1. Add to `CanvasTool` type in `InkCanvas.tsx`
2. Add pointer handling in `handlePointerDown`/`Move`/`Up`
3. Add button in `CanvasToolbar.tsx`
4. Add icon in `Icons.tsx`
5. Update cursor in InkCanvas return JSX

### Adding a New MathPalette Tab
1. Add a new entry to the `TABS` array in `MathPalette.tsx`
2. Each item needs: `{ latex, display, stamp?, title? }`
3. `latex` = what gets inserted into Input
4. `display` = what shows on the button
5. `stamp` = what renders on canvas (defaults to `display`)

### Adding a New Canvas Object Type
1. Add interface extending `CanvasObjectBase` in `canvasObjects.ts`
2. Add to the `CanvasObject` union type
3. Add factory function
4. Add rendering in `CanvasObjectLayer.tsx` content area
5. Add handling in `renderLassoRegionToImage` if it should be captured by lasso

### Cutting a Release
See `RELEASE.md` — the short version: branch → bump version (manifest, package, versions, `src/lib/version.ts`) → CHANGELOG entry at the top of `CHANGELOG.md` → tests pass → push → PR → squash-merge. The auto-tag workflow handles the GitHub release.
