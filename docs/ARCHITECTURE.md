# Noteometry Architecture

> Current as of **v1.7.2**. See [CHANGELOG.md](../CHANGELOG.md) for per-release notes; this document describes the current shape of the codebase.

## Overview

Noteometry is an Obsidian plugin — an ink-first STEM notebook with pencil, eraser, lasso OCR, shape tools, drop-in engineering tools, and AI-powered math/circuit solving. As of v1.7, it renders as a full-screen React app inside an Obsidian `FileView` registered for the `.nmpage` extension; navigation goes through Obsidian's file explorer rather than a plugin-owned sidebar.

## Tech Stack

- **Runtime:** Obsidian plugin (desktop + mobile)
- **UI:** React 18 with functional components and hooks
- **Build:** esbuild (bundles to single `main.js`)
- **Types:** TypeScript (strict, skipLibCheck)
- **Math:** KaTeX 0.16 for LaTeX rendering and MathML output (Math v12 DLP prompt, MathML generation, copy-to-Word clipboard pipeline — protected, do not modify)
- **AI:** Perplexity (default, `openai/gpt-5.4`), Claude (`claude-opus-4-6`) via Obsidian's `requestUrl`, and LM Studio (local) as alternatives
- **Icons:** Custom inline SVGs (no external icon library in the bundle)
- **Tests:** Vitest (jsdom environment for DOM-touching suites)

## Directory Structure

```
noteometry-obsidian/
  src/
    main.ts                    # Plugin entry point (Obsidian lifecycle, .nmpage extension registration, legacy migration)
    NoteometryView.ts          # Obsidian FileView → React bridge (file-bound)
    types.ts                   # Shared types and default settings
    settings.ts                # Obsidian settings tab UI
    lib/
      ai.ts                    # AI backend (Claude / Perplexity / LM Studio)
      persistence.ts           # Save/load pages as .nmpage files (file-bound API + legacy folder API)
      pageFormat.ts            # v3 serialization (single elements[] array)
      inkEngine.ts             # Stroke data model, smoothing, hit-testing
      canvasRenderer.ts        # Canvas 2D drawing (grid, strokes, stamps)
      canvasObjects.ts         # Canvas object types and factories
      canvasMenuActions.ts     # Right-click hub action factories (incl. buildClearCanvasAction)
      objectDragHitTest.ts     # Direct-drag hit test — which targets pass through to inner controls
      mathml.ts                # MathML rendering (protected pipeline)
      tableStore.ts            # In-memory store for table/textbox data
      SignalBus.ts             # Pub/sub singleton linking math drop-ins
    features/
      ink/                     # Pure ink helpers (no DOM)
      lasso/                   # selection.ts — pure delete/move/predicates on strokes/stamps/objects
      objects/                 # Drop-in object helpers
      pages/                   # Page-level state helpers
      pipeline/                # Rasterize / composite / clipboard pipeline (protected)
    components/
      NoteometryApp.tsx        # Root component — all state management
      InkCanvas.tsx            # HTML5 Canvas drawing surface
      ContextMenu.tsx          # Right-click context-menu hub (mouse / two-finger / Pencil long-press)
      CanvasObjectLayer.tsx    # DOM overlay for drop-ins
      RichTextEditor.tsx       # contentEditable text box editor
      TableEditor.tsx          # Table grid with input cells
      LassoOverlay.tsx         # Freehand + rectangle lasso with stacked regions
      KaTeXRenderer.tsx        # LaTeX → rendered math (HTML output)
      Panel.tsx                # Right panel: Preview + Input + MathPalette
      ChatPanel.tsx            # AI chat with MathML rendering
      Sidebar.tsx              # Section/page navigation
      MathPalette.tsx          # Tabbed math symbol palette (incl. shouldArmStamp routing)
      PdfViewer.tsx            # PDF drop-in viewer
      Icons.tsx                # All SVG icons as React components
      dropins/                 # Per-drop-in React components (Calculator, GraphPlotter, CircuitSniper, UnitConverter, Oscilloscope, UnitCircle, Multimeter, StudyGantt, AnimationCanvas, AIDropin (quarantined), …)
  tests/
    unit/
      canvasObjects.test.ts
      circuitSniperSnap.test.ts
      clearCanvasAction.test.ts
      clipboardPayload.test.ts
      contextMenuInsert.test.ts
      contextMenuLayout.test.ts
      inkEngine.test.ts
      lassoSelection.test.ts
      mathPaletteStamp.test.ts
      mathV12Preset.test.ts
      mathml.test.ts
      objectDragHitTest.test.ts
      persistenceV3.test.ts
      tableStore.test.ts
  docs/                        # This documentation
  styles.css                   # All CSS (KaTeX + Noteometry)
  esbuild.config.mjs           # Build config
  manifest.json                # Obsidian plugin manifest
  versions.json                # plugin version → minAppVersion map
  scripts/
    ship.sh                    # Patch-bump + build + commit + tag + push helper
  deploy.sh                    # Manual deploy script (backup)
  RELEASE.md                   # Single source of truth for the ship checklist
```

## Data Flow

```
User Input
    │
    ├── Stylus/Mouse → InkCanvas (pointer events)
    │       │
    │       ├── Pen tool → accumulate StrokePoints → smoothPoints → add Stroke
    │       ├── Eraser → filter strokes/stamps by proximity
    │       ├── Grab → pan viewport (scrollX, scrollY)
    │       └── Shapes → preview → finalize as Stroke points
    │
    ├── Touch → always pans (touch pan effect on container)
    │
    ├── Toolbar → tool/color/width changes, insert objects
    │
    ├── MathPalette → tap inserts LaTeX to Input, drag stamps canvas
    │
    ├── Lasso → capture region → action bar (OCR | Move)
    │         ├── OCR → AI vision → Input/Chat
    │         └── Move → drag delta → translate selected strokes/stamps
    │
    └── Chat → send text + attachments → Claude / Perplexity / LM Studio → MathML response
    
State (all in NoteometryApp)
    │
    ├── strokes: Stroke[]          → InkCanvas renders on <canvas>
    ├── stamps: Stamp[]            → InkCanvas renders as fillText
    ├── canvasObjects: CanvasObject[] → CanvasObjectLayer renders as DOM
    ├── scrollX, scrollY           → viewport offset
    ├── tool: CanvasTool           → controls which pointer handlers active
    ├── inputCode: string          → Panel Input textarea
    ├── chatMessages: ChatMessage[] → ChatPanel message list
    └── boundFile: TFile           → set by NoteometryView.onLoadFile, drives persistence
    
Persistence
    │
    ├── Auto-save (2s debounce) → savePage(boundFile) → vault.modify()
    ├── File switch (new tab/leaf) → onLoadFile() re-renders against new TFile
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
              │     ├── CanvasToolbar (floating bottom pill)
              │     ├── InkCanvas (2 stacked <canvas>: grid + ink)
              │     ├── CanvasObjectLayer (positioned DOM overlays)
              │     │     ├── RichTextEditor (contentEditable)
              │     │     ├── TableEditor (input grid)
              │     │     └── <img> (images)
              │     └── LassoOverlay (temporary capture canvas)
              └── Right panel (collapsible)
                    ├── Panel
                    │     ├── KaTeXRenderer (preview)
                    │     ├── <textarea> (input)
                    │     └── MathPalette (13 symbol tabs)
                    └── ChatPanel (AI chat with MathML)

Page-to-page navigation: Obsidian's file explorer (clicking a .nmpage opens or
focuses a NoteometryView leaf for that file). No plugin-owned sidebar.
```

## Key Design Decisions

1. **Custom ink engine, not Excalidraw.** The original version used Excalidraw but it was too heavy and its CSS conflicted with Obsidian. The custom engine uses HTML5 Canvas with Catmull-Rom spline smoothing.

2. **No pressure sensitivity.** Uniform stroke width for clean, consistent lines that look good on any device. Pressure data is still captured but ignored during rendering.

3. **Stamps, not text objects for math symbols.** Math symbols from the MathPalette are rendered as `fillText` on the canvas (stamps), not as DOM elements. This means they're captured by lasso OCR and behave like ink.

4. **`.nmpage` extension with `registerExtensions`.** Pre-v1.7 the plugin used `.md`-wrapped JSON so Obsidian Sync would pick it up; the cost was that Obsidian's editor tried to render the JSON as markdown if you opened it outside the plugin. v1.7 registers `.nmpage` against `NoteometryView` via `registerExtensions(["nmpage"], VIEW_TYPE)` so clicking the file in the file explorer opens the canvas directly. Sync still works because `.nmpage` is a normal vault file. A bulk-rename migration command handles vaults left over from the `.md` era.

5. **Custom SVG icons.** Lucide-react icons were invisible inside Obsidian's plugin context due to CSS class conflicts (Obsidian uses lucide internally). All icons are hand-written inline SVGs.

6. **Touch swipe blocking at view boundary.** Obsidian mobile uses swipe gestures to open sidebars. The NoteometryView attaches bubble-phase touch event listeners that stop propagation, preventing Obsidian from interpreting swipes inside Noteometry as navigation gestures.

7. **requestUrl for API calls.** Obsidian's `requestUrl` bypasses CORS, which is required for API calls on iPad (where `fetch` is blocked by CORS for direct API access).
