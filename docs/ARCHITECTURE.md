# Noteometry Architecture

> Current as of **v1.14.11**. See [CHANGELOG.md](../CHANGELOG.md) for per-release notes; this document describes the current shape of the codebase.

## Overview

Noteometry is an Obsidian plugin — an ink-first STEM notebook with pencil, eraser, lasso OCR, shape tools, drop-in engineering tools, and AI-powered math/circuit solving. It renders as a full-screen React app inside an Obsidian `FileView` registered for the `.nmpage` extension. Page-to-page navigation runs through a plugin-owned **CanvasNav** strip rendered on the canvas itself (Sections | Pages, two columns) plus Obsidian's standard file explorer for the same `.nmpage` files.

## Tech Stack

- **Runtime:** Obsidian plugin (desktop + mobile)
- **UI:** React 18 with functional components and hooks
- **Build:** esbuild (bundles to single `main.js`)
- **Types:** TypeScript (strict, `noUncheckedIndexedAccess`, `skipLibCheck`)
- **Math:** KaTeX 0.16 for LaTeX rendering and MathML output (Math v12 DLP prompt, MathML generation, copy-to-Word clipboard pipeline — protected, do not modify)
- **AI:** Perplexity (default, `openai/gpt-5.4`), Claude (`claude-opus-4-6`) via Obsidian's `requestUrl`, and LM Studio (local) as alternatives
- **Icons:** Custom inline SVGs (no external icon library in the bundle)
- **Tests:** Vitest, `environment: "node"` (the `obsidian` runtime is aliased to a stub at `tests/stubs/obsidian.ts` — see `vitest.config.ts`)

## Directory Structure

```
noteometry-obsidian/
  src/
    main.ts                    # Plugin entry point — registerView, registerExtensions(["nmpage"]), ribbon, 2 commands (new-page, convert-legacy-md), legacy HomeView leaf cleanup
    NoteometryView.ts          # Obsidian FileView → React bridge (file-bound)
    types.ts                   # Shared types and DEFAULT_SETTINGS
    settings.ts                # Obsidian settings tab UI
    lib/
      ai.ts                    # AI backend (Claude / Perplexity / LM Studio)
      aiImageFormat.ts         # Image payload shaping for vision calls
      canvasMenuActions.ts     # Right-click hub action factories (incl. buildClearCanvasAction)
      canvasNavTree.ts         # buildNav / sectionPathFor / NavSection.isRootBucket — pure tree logic for CanvasNav
      canvasObjects.ts         # Canvas object types and factories; stripRemovedObjects
      canvasRenderer.ts        # Canvas 2D drawing (grid, strokes — pressure-aware width, stamps)
      chatToHtml.ts            # Chat MathML/HTML rendering helpers
      courseTemplate.ts        # Section-bootstrap helpers
      dropinExport.ts          # Drop-in serialization for clipboard / export
      dropinFocusGuards.ts     # Pointer/focus guards inside drop-ins (keep typing inside the input)
      globalTheme.ts           # v1.11.1 global theme application (paint Obsidian chrome to match)
      inkEngine.ts             # Stroke data model, smoothing, hit-testing
      mathml.ts                # MathML rendering (protected pipeline)
      objectClipboard.ts       # Copy/cut/paste of canvas objects
      objectDragHitTest.ts     # Direct-drag hit test — which targets pass through to inner controls
      pageFormat.ts            # v3 serialization (single elements[] tagged-union array, vault-relative file refs)
      persistence.ts           # Save/load .nmpage files (file-bound API), legacy migration, recovery cache (nm:cache: prefix)
      recentPages.ts           # Most-recent-first page tracking
      renderMath.ts            # KaTeX render helpers
      SignalBus.ts             # Pub/sub singleton linking math drop-ins
      tableStore.ts            # In-memory store for table/textbox data
      version.ts               # NOTEOMETRY_VERSION — single source of truth (mirrored in manifest/package/versions.json + version.test.ts)
      wheelRouting.ts          # Wheel-event routing (canvas vs. nested drop-in scroll)
      wheelZoom.ts             # Trackpad-pinch / wheel-zoom math
    features/
      aiActivity.tsx           # AI activity indicator + status surface
      gestures/                # Long-press recognizer, two-finger gestures, gesture binding/fuzz tests
      ink/                     # Pure ink helpers (no DOM)
      lasso/                   # selection.ts — pure delete/move/predicates on strokes/stamps/objects
      layerManager.tsx         # Layer state + ordering
      objects/                 # Drop-in object helpers
      pipeline/                # Rasterize / composite / clipboard pipeline (protected)
    components/
      NoteometryApp.tsx        # Root component — all state management, autosave timers, ctxMenu state
      InkCanvas.tsx            # HTML5 Canvas drawing surface (pressure-aware, conditional listeners)
      ContextMenu.tsx          # Right-click context-menu hub (mouse / two-finger / Pencil long-press)
      CanvasNav.tsx            # v1.14.9+ on-canvas Sections | Pages two-column listbox; a11y v1.14.10; event-bubble fix v1.14.11
      CanvasObjectLayer.tsx    # DOM overlay for drop-ins
      RichTextEditor.tsx       # contentEditable text box editor
      TableEditor.tsx          # Table grid with input cells
      LassoOverlay.tsx         # Freehand + rectangle lasso with stacked regions
      KaTeXRenderer.tsx        # LaTeX → rendered math (HTML output)
      Panel.tsx                # Right panel: Preview + Input + MathPalette
      MathPalette.tsx          # Tabbed math symbol palette (incl. shouldArmStamp routing)
      PdfViewer.tsx            # PDF drop-in viewer
      Icons.tsx                # All SVG icons as React components
      ambient/                 # Ambient cues (cursor color hint, status nudges)
      dropins/                 # ChatDropin, MathDropin (right-pane consumers as drop-ins)
      freeze/                  # Freeze overlay (lock subset of canvas)
      layers/                  # Layer shells / stacking UI
      onboarding/              # First-run gesture cheatsheet (v1.11.0+)
      pages/                   # Pages-panel logic helpers
  tests/
    unit/                      # 51 files, 565 tests at v1.14.11 (read tests/unit/ for the authoritative list)
    stubs/
      obsidian.ts              # vitest alias target — minimal Obsidian API surface for unit tests
  docs/                        # This documentation
  styles.css                   # All CSS (KaTeX + Noteometry)
  esbuild.config.mjs           # Build config
  manifest.json                # Obsidian plugin manifest
  versions.json                # plugin version → minAppVersion map
  scripts/
    ship.sh                    # Patch-bump + build + commit + tag + push helper
  deploy.sh                    # Manual deploy script (backup)
  RELEASE.md                   # Single source of truth for the ship checklist
  .github/workflows/auto-tag.yml  # Auto-tag + auto-release on merge to main (~35-45s after squash-merge)
```

## Data Flow

```
User Input
    │
    ├── Stylus/Mouse → InkCanvas (pointer events)
    │       │
    │       ├── Pen tool → accumulate StrokePoints (with pressure) → smoothPoints → add Stroke
    │       ├── Eraser → filter strokes/stamps by proximity
    │       ├── Grab → pan viewport (scrollX, scrollY)
    │       └── Shapes → preview → finalize as Stroke points
    │
    ├── Touch → always pans (touch pan effect on container; finger-draw opt-in via setting)
    │
    ├── Wheel / trackpad pinch → wheelRouting decides canvas-zoom vs. drop-in scroll
    │
    ├── Toolbar → tool/color/width changes, insert objects
    │
    ├── MathPalette → tap inserts LaTeX to Input (structural) or arms a stamp (pure glyph)
    │
    ├── Lasso → capture region → action bar (OCR | Move | Clear)
    │         ├── OCR → AI vision → Input/Chat
    │         └── Move → drag delta → translate selected strokes/stamps/objects
    │
    ├── CanvasNav → click section / page; double-click rename; right-click delete (with confirm)
    │
    └── Chat → send text + attachments → Claude / Perplexity / LM Studio → MathML response

State (all in NoteometryApp)
    │
    ├── strokes: Stroke[]              → InkCanvas renders on <canvas>
    ├── stamps: Stamp[]                → InkCanvas renders as fillText
    ├── canvasObjects: CanvasObject[]  → CanvasObjectLayer renders as DOM
    ├── scrollX, scrollY, zoom         → viewport
    ├── tool: CanvasTool               → controls which pointer handlers active
    ├── inputCode: string              → Panel Input textarea
    ├── chatMessages: ChatMessage[]    → ChatPanel message list
    └── boundFile: TFile               → set by NoteometryView.onLoadFile, drives persistence

Persistence
    │
    ├── Auto-save (2s debounce) → savePage(boundFile) → vault.modify()
    │     └── Synchronous mirror to localStorage under `nm:cache:<path>` BEFORE the await,
    │         so a tab close mid-save still recovers on reload.
    ├── File switch (new tab/leaf) → onLoadFile() flushes prior file before loading new one
    ├── View close → flushSave(boundFile)
    └── Files: <vault>/<any-folder>/<Page-name>.nmpage (v3 JSON, file extension registered for the view)
         └── Obsidian Sync handles .nmpage like any other recognized vault file
```

## Component Hierarchy

```
NoteometryView (Obsidian FileView, bound to one .nmpage TFile)
  └── NoteometryApp (React root, all state — receives boundFile)
        └── Split layout
              ├── Canvas area
              │     ├── CanvasNav (v1.14.9+, on-canvas Sections | Pages strip; collapsible to a rail)
              │     ├── CanvasToolbar (floating bottom pill)
              │     ├── InkCanvas (2 stacked <canvas>: grid + ink)
              │     ├── CanvasObjectLayer (positioned DOM overlays)
              │     │     ├── RichTextEditor (contentEditable)
              │     │     ├── TableEditor (input grid)
              │     │     ├── PdfViewer
              │     │     ├── ChatDropin / MathDropin
              │     │     └── <img> (images)
              │     ├── LassoOverlay (temporary capture canvas)
              │     └── ContextMenu (right-click hub; portal-mounted as of v1.14.7)
              └── Right panel (collapsible)
                    ├── Panel
                    │     ├── KaTeXRenderer (preview)
                    │     ├── <textarea> (input)
                    │     └── MathPalette (13 symbol tabs)
                    └── ChatPanel (AI chat with MathML)

Page-to-page navigation: CanvasNav owns the in-canvas listbox UX, and Obsidian's
file explorer remains a parallel entry point — both open the same .nmpage files.
The legacy `noteometry-home` HomeView is gone (v1.14.10); main.ts sweeps any
stranded leaves with that view-type on layout-ready.
```

## Key Design Decisions

1. **Custom ink engine, not Excalidraw.** The original version used Excalidraw but it was too heavy and its CSS conflicted with Obsidian. The custom engine uses HTML5 Canvas with Catmull-Rom spline smoothing.

2. **Pressure-aware rendering.** Apple Pencil pressure is recorded per-point and modulates stroke width (`canvasRenderer.ts` clamps to 0.3× minimum). Mouse/trackpad strokes have `pressure=0` and render at full width — they look identical to the old uniform-width behaviour.

3. **Stamps, not text objects for math symbols.** Math symbols from the MathPalette are rendered as `fillText` on the canvas (stamps), not as DOM elements. This means they're captured by lasso OCR and behave like ink.

4. **`.nmpage` extension with `registerExtensions`.** Pre-v1.7 the plugin used `.md`-wrapped JSON so Obsidian Sync would pick it up; the cost was that Obsidian's editor tried to render the JSON as markdown if you opened it outside the plugin. v1.7 registers `.nmpage` against `NoteometryView` via `registerExtensions(["nmpage"], VIEW_TYPE)` so clicking the file in the file explorer opens the canvas directly. Sync still works because `.nmpage` is a normal vault file. A bulk-rename migration command handles vaults left over from the `.md` era.

5. **Custom SVG icons.** Lucide-react icons were invisible inside Obsidian's plugin context due to CSS class conflicts (Obsidian uses lucide internally). All icons are hand-written inline SVGs.

6. **Touch swipe blocking at view boundary.** Obsidian mobile uses swipe gestures to open sidebars. The NoteometryView attaches bubble-phase touch event listeners that stop propagation, preventing Obsidian from interpreting swipes inside Noteometry as navigation gestures.

7. **requestUrl for API calls.** Obsidian's `requestUrl` bypasses CORS, which is required for API calls on iPad (where `fetch` is blocked by CORS for direct API access).

8. **CanvasNav lives on the canvas, not in an Obsidian sidebar.** The plugin owns the nav UI but mounts it inside the FileView, not as a `WorkspaceLeaf`. This keeps it in the same React tree as everything else, lets it close when the file closes, and avoids the "ghost sidebar" problem if multiple `.nmpage` tabs are open. CanvasNav events (click / dblclick / contextmenu / mousedown) `stopPropagation` on the nav shell so right-clicks on a row don't bubble to the canvas's context-menu hub (v1.14.11 fix).

9. **`noUncheckedIndexedAccess`.** `tsconfig.json` enables this — `array[i]` returns `T | undefined`. The repo-wide pattern is to capture into a `const` and null-check before use, even when the index is "obviously" valid.
