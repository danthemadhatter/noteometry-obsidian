# Noteometry Architecture

## Overview

Noteometry is an Obsidian plugin — an ink-first STEM notebook with pencil, eraser, lasso OCR, shape tools, and AI-powered math/circuit solving. It renders as a full-screen React app inside an Obsidian ItemView.

## Tech Stack

- **Runtime:** Obsidian plugin (desktop + mobile)
- **UI:** React 18 with functional components and hooks
- **Build:** esbuild (bundles to single `main.js`)
- **Types:** TypeScript (strict, skipLibCheck)
- **Math:** KaTeX 0.16 for LaTeX rendering and MathML output
- **AI:** Claude API (`claude-sonnet-4-6` default) via Obsidian's `requestUrl`, LM Studio (local) as alternative
- **Icons:** Custom inline SVGs (no external icon library in the bundle)
- **Tests:** Vitest

## Directory Structure

```
noteometry-obsidian/
  src/
    main.ts                  # Plugin entry point (Obsidian lifecycle)
    NoteometryView.ts        # Obsidian ItemView → React bridge
    types.ts                 # Shared types and default settings
    settings.ts              # Obsidian settings tab UI
    lib/
      ai.ts                  # AI backend (Claude + LM Studio)
      persistence.ts         # Save/load pages as .md files in vault
      inkEngine.ts           # Stroke data model, smoothing, hit-testing
      canvasRenderer.ts      # Canvas 2D drawing (grid, strokes, stamps)
      canvasObjects.ts       # Canvas object types (textbox, table, image)
      tableStore.ts          # In-memory store for table/textbox data
    components/
      NoteometryApp.tsx      # Root component — all state management
      InkCanvas.tsx          # HTML5 Canvas drawing surface
      CanvasToolbar.tsx      # Floating bottom toolbar
      CanvasObjectLayer.tsx  # DOM overlay for text boxes, tables, images
      RichTextEditor.tsx     # contentEditable text box editor
      TableEditor.tsx        # Table grid with input cells
      LassoOverlay.tsx       # Freeform lasso selection overlay
      KaTeXRenderer.tsx      # LaTeX → rendered math (HTML output)
      Panel.tsx              # Right panel: Preview + Input + MathPalette
      ChatPanel.tsx          # AI chat with MathML rendering
      Sidebar.tsx            # Section/page navigation (OneNote-style)
      MathPalette.tsx        # Tabbed math symbol palette (13 tabs)
      Icons.tsx              # All SVG icons as React components
  tests/
    unit/
      canvasObjects.test.ts
      inkEngine.test.ts
      tableStore.test.ts
  docs/                      # This documentation
  styles.css                 # All CSS (KaTeX + Noteometry)
  esbuild.config.mjs         # Build config (auto-deploys to vault)
  manifest.json              # Obsidian plugin manifest
  deploy.sh                  # Manual deploy script (backup)
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
    └── Chat → send text + attachments → Claude/LM Studio → MathML response
    
State (all in NoteometryApp)
    │
    ├── strokes: Stroke[]          → InkCanvas renders on <canvas>
    ├── stamps: Stamp[]            → InkCanvas renders as fillText
    ├── canvasObjects: CanvasObject[] → CanvasObjectLayer renders as DOM
    ├── scrollX, scrollY           → viewport offset
    ├── tool: CanvasTool           → controls which pointer handlers active
    ├── inputCode: string          → Panel Input textarea
    ├── chatMessages: ChatMessage[] → ChatPanel message list
    └── currentSection/Page        → Sidebar selection → persistence
    
Persistence
    │
    ├── Auto-save (2s debounce) → savePage() → vault adapter.write()
    ├── Page switch → saveNow() current → loadPage() new
    ├── View close → flushSave()
    └── Files: Noteometry/<Section>/<Page>.md (JSON inside .md)
         └── Obsidian Sync picks up .md files automatically
```

## Component Hierarchy

```
NoteometryView (Obsidian ItemView)
  └── NoteometryApp (React root, all state)
        ├── Sidebar (section/page navigation)
        └── Main area
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
```

## Key Design Decisions

1. **Custom ink engine, not Excalidraw.** The original version used Excalidraw but it was too heavy and its CSS conflicted with Obsidian. The custom engine uses HTML5 Canvas with Catmull-Rom spline smoothing.

2. **No pressure sensitivity.** Uniform stroke width for clean, consistent lines that look good on any device. Pressure data is still captured but ignored during rendering.

3. **Stamps, not text objects for math symbols.** Math symbols from the MathPalette are rendered as `fillText` on the canvas (stamps), not as DOM elements. This means they're captured by lasso OCR and behave like ink.

4. **`.md` extension for data files.** Obsidian Sync only syncs recognized file types. Using `.md` instead of `.json` ensures page data syncs across devices automatically.

5. **Custom SVG icons.** Lucide-react icons were invisible inside Obsidian's plugin context due to CSS class conflicts (Obsidian uses lucide internally). All icons are hand-written inline SVGs.

6. **Touch swipe blocking at view boundary.** Obsidian mobile uses swipe gestures to open sidebars. The NoteometryView attaches bubble-phase touch event listeners that stop propagation, preventing Obsidian from interpreting swipes inside Noteometry as navigation gestures.

7. **requestUrl for API calls.** Obsidian's `requestUrl` bypasses CORS, which is required for API calls on iPad (where `fetch` is blocked by CORS for direct API access).
