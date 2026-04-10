# Noteometry Development Guide

## Setup

```bash
git clone https://github.com/danthemadhatter/noteometry-obsidian.git
cd noteometry-obsidian
npm install --legacy-peer-deps
```

## Build

```bash
npm run build    # TypeScript check + esbuild production bundle + auto-deploy
npm run dev      # esbuild watch mode (rebuild on file changes)
npm test         # Run vitest unit tests
```

The build automatically deploys `main.js`, `styles.css`, and `manifest.json` to `~/Documents/Noteometry/.obsidian/plugins/noteometry/` (the Obsidian Sync vault).

## Development Workflow

1. Edit source files in `src/`
2. Run `npm run build`
3. In Obsidian: Settings → Community plugins → toggle Noteometry off/on (or Ctrl+P → "Reload app without saving")
4. Test the changes
5. Commit and push

## Project Structure

### Entry Point: `src/main.ts`
- Extends Obsidian's `Plugin` class
- Registers the `NoteometryView` view type
- Loads/saves settings
- Adds ribbon icon and command to open Noteometry
- Auto-opens the view on startup
- Closes empty "New Tab" leaves that Obsidian creates

### View Bridge: `src/NoteometryView.ts`
- Extends Obsidian's `ItemView`
- Mounts React root on `onOpen()`
- Calls `flushSave()` on `onClose()` to prevent data loss
- Blocks touch swipe gestures (bubble-phase `stopPropagation`)
- Collapses Obsidian's left/right sidebars on open

### Root Component: `src/components/NoteometryApp.tsx`
- ALL state lives here (no global stores except tableStore)
- Manages: canvas state, panel state, chat state, persistence, undo/redo
- ~800 lines — this is the God Component by necessity (Obsidian plugin constraints)

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
- `"touch"` → always pans (handled by separate touch effect)
- `"pen"` or `"mouse"` → uses current tool (pen, eraser, grab, shapes)

### Auto-Save Debouncing
A `useEffect` watches all saveable state. On change, it clears any pending timer and sets a new 2-second timeout. The `loadingPageRef` flag prevents saves from firing when loading a new page.

## Testing

Tests are in `tests/unit/` using Vitest:
```bash
npm test              # Run all tests
npx vitest --watch    # Watch mode
```

Current test coverage:
- `canvasObjects.test.ts` — factory functions, ID uniqueness
- `inkEngine.test.ts` — hit-testing, smoothing, polygon intersection
- `tableStore.test.ts` — get/set/load/getAll round-trips

To add tests for a new module:
1. Create `tests/unit/<module>.test.ts`
2. Import from `../../src/lib/<module>`
3. Run `npm test`

## Build Configuration

### esbuild (`esbuild.config.mjs`)
- Entry: `src/main.ts`
- Output: `main.js` (CJS format, ES2018 target)
- External: `obsidian`, `electron`, CodeMirror modules, Node builtins
- Production: minified, no sourcemap
- Development: inline sourcemap, watch mode
- Auto-deploy: copies built files to Obsidian Sync vault after production build

### TypeScript (`tsconfig.json`)
- Target: ES6, Module: ESNext
- JSX: react-jsx
- Strict mode enabled
- `skipLibCheck` used in build command (Obsidian types have issues)

## AI Integration

### Adding a New AI Provider
1. Add provider to `AIProvider` type in `types.ts`
2. Add settings fields to `NoteometrySettings` and `DEFAULT_SETTINGS`
3. Implement the call function in `ai.ts` (see `callClaude` and `callLMStudio` patterns)
4. Add dispatch branches in `readInk`, `solve`, and `chat`
5. Add settings UI in `settings.ts`

### API Call Pattern
All AI calls go through Obsidian's `requestUrl` (for Claude) or standard `fetch` (for LM Studio). This is because `requestUrl` bypasses CORS, which is required on iPad.

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
2. **CSS Variables** (lines 9-24) — design tokens (colors, radii, shadows, fonts)
3. **Layout** — root container, sidebar, split, canvas area, right panel
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
