# Noteometry Features

> Current as of **v1.14.11**. See [CHANGELOG.md](../CHANGELOG.md) for per-release notes; this document describes current behaviour only.

## Canvas / Drawing

### Pen Tool
- Freehand drawing with mouse or Apple Pencil
- **Pen is the default tool on first open** so the Pencil / mouse can draw immediately — previously the canvas opened in `select` mode, which piped pointer events away from the ink layer and made the canvas look broken
- Catmull-Rom spline smoothing (removes jitter, preserves natural feel)
- **Pressure-aware width** for Apple Pencil — pressure modulates stroke width (clamped to 0.3× min); mouse/trackpad input has no pressure data and renders at the full configured width
- Configurable base width: Fine (1.5px), Medium (3px), Thick (5px), Marker (8px)
- 6 ink colors: Black, Red, Green, Blue, Orange, Purple

### Eraser Tool
- Point-proximity erasing (removes strokes/stamps within 10px tolerance)
- Works on both strokes and stamps
- Batched undo (one undo snapshot per drag, not per pixel)

### Grab / Pan Tool
- Click-and-drag to pan the infinite canvas
- Mouse wheel scrolling (always active in all modes)
- Touch panning (finger always pans, even in pen mode — iPad optimization)

### Shape Tools
- **Line:** Click-drag for straight lines
- **Arrow:** Click-drag for arrows with arrowhead
- **Rectangle:** Click-drag for rectangles
- **Circle:** Click-drag for ellipses
- Dashed preview while dragging, solid stroke on release
- All shapes stored as regular strokes (undoable, erasable, lasso-selectable)

### Select Tool
- Tap stamps to select (blue dashed highlight)
- Tap canvas objects (text boxes, tables, images, drop-ins) to select
- Keyboard Delete/Backspace to remove selected items

### Tool Cycling
- Toolbar cycle button: Pen → Eraser → Grab → Pen
- Mouse / trackpad double-click on empty canvas also cycles the sequence
- **Apple Pencil double-tap is not exposed to Obsidian plugin JS / WebKit**, so the Pencil cannot cycle tools. Use the toolbar button, the math palette "Canvas" path, or the context-menu hub (opened by Pencil long-press — see Input Methods below).

### Undo / Redo
- Tracks strokes and stamps
- Ctrl/Cmd+Z for undo, Ctrl/Cmd+Shift+Z for redo
- Eraser operations batched into single undo entries

### Zoom
- Trackpad pinch (`ctrlKey`-synthesised wheel) zooms the viewport, anchored to the cursor
- Wheel routing distinguishes canvas zoom from nested drop-in scroll (PDFs, scrollable contents)

## Canvas Objects (DOM Overlays)

### Text Boxes
- Rich text editing with contentEditable
- Bold, Italic, Underline formatting
- Bullet and numbered lists
- Font size selector (12-32px)
- Drag to move, corner handle to resize
- Auto-switches to Select mode on insert
- Tap to focus and bring up keyboard (iPad)

### Tables
- Editable grid with input cells
- Tab key navigates between cells
- Add/remove rows and columns
- Minimum 1 row and 1 column
- Data persisted per table ID in tableStore

### Images
- Insert from photo library or camera
- Drag to move, corner handle to resize
- Captured by lasso OCR (AI can read image content)
- Stored as separate vault files (`Noteometry/<Section>/.attachments/<id>.png`)
- Legacy base64 images auto-migrate to vault files on page load

### Object Management
- Delete button (x) on each object's drag handle
- Confirmation dialog before deletion (v1.14.6+)
- Objects only interactive in Select mode
- Copy / cut / paste of selected objects via standard shortcuts (`objectClipboard.ts`)

## Lasso + OCR

### Lasso Selection
- Freeform polygon drawing (Freehand) and Rectangle modes
- Blue dashed outline with translucent fill; regions stack so multiple selections compose
- After capture, a floating action bar appears with **OCR**, **Move**, and **Clear** buttons
- Tap outside or press Escape to cancel
- Captures strokes, stamps, AND canvas objects within the selection
- Minimum 10 points to register (prevents accidental taps)

### Lasso Clear
- Deletes strokes whose points fall inside any region polygon
- Deletes stamps whose center is inside any region
- Deletes canvas objects whose bbox overlaps any region
- Records an undo snapshot before wiping, persists via autosave
- `Nothing selected to delete` notice fires on empty regions instead of silently no-op-ing

### OCR (READ INK)
- Action bar **OCR** button: renders lasso region to high-resolution image (3x scale)
- Sends to Claude Vision API (or LM Studio vision model)
- Handles ANY content: handwriting, printed text, screenshots, circuit diagrams, photos, mixed media
- Extracted text goes to Input box, then auto-sends to Chat for solving
- Image attachment included so AI can see diagrams/figures

### Move
- Action bar **Move** button: drag anywhere inside the lasso region
- Translates all selected strokes, stamps, and canvas objects by the drag delta
- Paints a ghost snapshot of the selection at its starting position the instant Move activates (the action used to look idle until the first `pointermove`)
- Fires a `Drag the selection to its new position` notice so the mode change is visible
- Supports undo

## Math Panel (Right Side)

### Preview Pane
- Live LaTeX rendering via KaTeX
- Auto-wraps content in math delimiters if needed
- Resizable split with Input pane

### Input Pane
- Textarea for LaTeX or plain text
- Symbol insertion from MathPalette
- SOLVE button sends to DLP solver (dedicated prompt)
- Clear button resets input

### MathPalette (13 tabs)
| Tab | Content |
|-----|---------|
| 123 | Digits, basic operators (+, -, =, x, y, z) |
| sqrt | Fractions, roots, superscript, subscript, brackets |
| in/inf | Relations, sets, infinity, approximation |
| arrows | Arrows, dots, ellipsis |
| alpha | Greek letters (alpha through Omega) |
| matrices | 2x2, 3x3 matrices, determinants, piecewise |
| int/lim | Integrals, derivatives, partial derivatives, limits, sums, nabla |
| accents | Hats, bars, vectors, dots, bold, blackboard |
| sin | Trig functions (including inverse), log, exponential |
| y' (DiffEq) | Derivatives, Laplace/Fourier transforms, delta, step functions |
| P(X) (Stats) | Probability, expected value, variance, distributions, hypothesis |
| lightning (EE) | V, I, R, Z, phasors, E/B/H fields, curl, divergence, impedance, dB, H(s) |
| logic | Universal/existential quantifiers, logical operators, set operations |

### Symbol Placement
- **Tap:** Inserts LaTeX into Input textarea
- **Desktop drag:** Places stamp on canvas (no Input insertion)
- **iPad "Canvas" button:** Sets pending symbol, tap canvas to place

## AI Chat

### Chat Panel
- Multi-turn conversation with the configured AI provider (Perplexity, Claude, or LM Studio)
- Renders math as native MathML (Safari renders natively)
- "Copy for Word" button puts MathML on clipboard (pastes as editable equations in Word)
- File attachments (images, PDFs, documents)
- New conversation button to clear history

### SOLVE (DLP Protocol)
- Dedicated solver with the Deterministic Linear Protocol v12
- Structured output: Problem → Given → Equations → Where → Solution → Answer
- Inline math only (no display blocks)
- Final answer in \boxed{}

### Chat (General)
- Uses CHAT_SYSTEM prompt (math/engineering assistant)
- Supports display and inline math
- Attachments sent as base64 images

## Navigation (CanvasNav + Obsidian, v1.14.9+)

### CanvasNav (on-canvas Sections | Pages)
- Two-column listbox at the top of the canvas — **Sections** on the left, **Pages** on the right
- The synthetic root bucket reads with the real folder name (default `Noteometry`) instead of `(root)`
- Click a section to focus it; click a page to open it; double-click to rename; right-click to delete (with v1.14.6 confirm)
- Inline `+ Add` buttons on each column for new section / new page in the focused section
- Full keyboard navigation: Arrow keys move focus + selection inside a column, Enter opens (pages) / switches (sections), F2 renames, Delete triggers the confirm dialog, Tab moves between columns
- Screen-reader friendly: `role=listbox` / `role=option`, `aria-selected`, `aria-activedescendant`
- Active row uses a filled accent background (was a near-invisible 3px left border in v1.14.9)
- Root-bucket rename / delete are guarded — used to trash the entire Noteometry folder
- The collapse chevron on the Pages column shrinks the whole strip to a thin rail to give the canvas back its real estate
- v1.14.11: nav events (click / dblclick / contextmenu / mousedown) `stopPropagation` so a right-click on a nav row no longer also opens the canvas's right-click hub

### Obsidian-side navigation
- Pages remain `.nmpage` files in the vault — Obsidian's file explorer still works as a parallel entry point
- Click any `.nmpage` in the file explorer to open or focus a NoteometryView leaf for that file
- Rename / move / delete via the file explorer's standard right-click menu still works
- Multiple pages can be open in tabs simultaneously; each has its own scoped `tableStore` and `flushSave`

### Page creation
- **Ribbon icon → "New Noteometry page"** (or the equivalent command palette entry) creates a new `.nmpage` next to the active file (or in the configured Vault Folder if no file is active) and opens it
- The Vault Folder setting is the default landing spot; you can move pages anywhere in the vault afterward
- v1.14.10 removed the legacy HomeView. `main.ts` sweeps stranded `noteometry-home` leaves on layout-ready

### Page Persistence
- Each page saved as a `.nmpage` file (registered extension; opened by NoteometryView, not the markdown editor)
- File-bound API: `savePage(file)` / `loadPage(file)` operate on a passed `TFile`
- Auto-save with 2-second debounce
- Save on file change (`onLoadFile` flushes the prior file before loading the new one)
- Save on view close (`flushSave` before unmount)
- Recovery cache mirrors the in-progress page to `localStorage` under `nm:cache:<path>` synchronously, before the async `vault.modify` await — so a tab close mid-save still recovers on reload
- Legacy `.md`-wrapped JSON pages are auto-detected on load; **Noteometry: Convert legacy .md pages to .nmpage** renames them in bulk, with numeric-suffix collision handling

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| AI Provider | Perplexity | Perplexity (cloud), Claude (cloud), or LM Studio (local) |
| Claude API Key | (empty) | Anthropic API key |
| Claude Model | claude-opus-4-6 | Model ID for Claude |
| Perplexity API Key | (empty) | Perplexity API key |
| Perplexity Model | openai/gpt-5.4 | Model ID for Perplexity |
| LM Studio URL | http://localhost:1234 | Local LM Studio server |
| LM Studio Text Model | qwen3-235b | Text model for solving/chat |
| LM Studio Vision Model | qwen2-vl-72b | Vision model for OCR |
| Vault Folder | Noteometry | Root folder for page data |
| Auto Save | true | Enable auto-save |
| Auto Save Delay | 2000 | Debounce delay in ms |
| Finger Drawing | false | Draw with a single finger (enable for Android) |
| Gesture Tutorial Seen (v1.11.0+) | false | Internal flag — flips to `true` when the first-run gesture cheatsheet is dismissed. Settings → "Reset gesture tutorial" flips it back so the modal reappears (per the gesture-recall design note) |
| Global Theme Enabled (v1.11.1+) | true | Apply Noteometry's visual theme to the rest of Obsidian (sidebar, tab bar, ribbon, command palette) |

## Responsive Design

### Desktop (>1024px)
- Right panel 320px, resizable
- Toolbar centered at bottom
- File-explorer navigation lives in Obsidian's left side panel (toggle with the standard Obsidian shortcut); CanvasNav lives on the canvas itself

### Tablet / iPad (768-1024px)
- Right panel starts at 240px
- Toolbar scrollable horizontally
- CanvasNav remains visible; collapsing it returns the canvas to full height

### Phone (<768px)
- Canvas and panel stack vertically
- Color dots smaller (14px)
- Toolbar compact with smaller buttons
- **Mobile tools FAB** (gated on `Platform.isMobile`, v1.7.1+) provides a touch-reachable entry to the canvas tool menu since long-press is reserved for the context-menu hub

## Platform-Specific

### iPad
- Touch always pans (finger = pan, Apple Pencil = draw)
- Swipe gestures blocked at the view boundary (no accidental Obsidian sidebar/backlinks opening while drawing)
- contentEditable focus on tap for keyboard popup
- inputMode="text" and enterKeyHint on all inputs
- Image picker shows photo library (not camera-only)
- **Apple Pencil long-press (550 ms, 8px movement slop)** opens the right-click context-menu hub at the hold location. Any mid-draw stroke is cancelled so the menu-open isn't also a scribble. Double-tap would be preferred but WebKit does not expose it to web pages.
- **Two-finger tap** also opens the hub (standard iPadOS right-click)
- **Clear Canvas** is pinned near the top of the hub behind its own separator so it's reachable on short viewports; the menu `max-height` is 70vh on touch with `touch-action: pan-y` + `-webkit-overflow-scrolling: touch` to stop iOS Safari hijacking the scroll gesture.

### Desktop
- Mouse/trackpad drawing
- HTML5 drag-and-drop from MathPalette to canvas
- Keyboard shortcuts (Ctrl/Cmd+Z undo, Shift+Z redo, Delete to remove)
- Mouse wheel for canvas scrolling; plain two-finger scroll pans; trackpad pinch (`ctrlKey`-synthesised wheel) zooms the viewport, anchored to the cursor
- Right-click opens the context-menu hub at the pointer
- Right-click on a CanvasNav row does NOT open the canvas hub (v1.14.11 — nav `stopPropagation` on contextmenu)

## Input Methods (context-menu hub)

The right-click context-menu hub is the single entry point for every insert and canvas action. All three open paths below surface the same menu at the press location:

- **Mouse right-click** (desktop / trackpad)
- **Two-finger tap** (iPad, desktop touchpads)
- **Apple Pencil long-press** (550 ms hold, 8 px movement slop) — the mid-draw stroke is cancelled so the hub-open isn't also a scribble

Inside the hub, Clear Canvas is pinned near the top (directly under Undo/Redo, behind its own separator) instead of the bottom of the ~30-item menu, so it's reachable on short iPad viewports without a two-finger scroll. The hub is portal-mounted (v1.14.7+) to escape any clipping ancestors and clamp itself to the viewport.

## Drop-in interaction model

- **Direct drag from any tool.** Drop-in objects (Calculator, Graph Plotter, Unit Converter, Circuit Sniper, etc.) can be moved by tap-dragging the object body no matter which canvas tool is active. This replaces the previous behaviour where the user had to switch to the `select` tool to move a drop-in, which contradicted "every normal app supports direct object dragging."
- **Inner controls pass through.** Clicks on form inputs, buttons, sliders, `contenteditable` regions, `role="button"` elements, and inner `<canvas>` elements inside a drop-in are not captured as drags — they reach the drop-in's own event handlers. The selector list lives in `src/lib/objectDragHitTest.ts` and is pinned by a unit test.
- **Focus guards.** `dropinFocusGuards.ts` keeps typing inside an input from leaking out to the canvas (no accidental tool toggles, no keyboard-shortcut conflicts).

## Math Palette Routing

Tapping a palette item either stamps it directly on the canvas or inserts it into the Input textarea, based on whether the token is a pure glyph or structural LaTeX:

- **Pure glyphs** (π, ω, →, ∈, ∞, ⏚ ground marker, circuit DC supply, etc.) arm a **pending stamp** — the next canvas tap drops it at that location.
- **Structural LaTeX** (`\frac{}{}`, matrices, `\sum_{i=1}^{n}`, `\int_{a}^{b}`, `\begin{pmatrix}…`) goes to the Input textarea, since it needs editing before it can render.

The decision lives in `shouldArmStamp()` in `src/components/MathPalette.tsx` and is pinned by a parameterised unit test covering 20+ symbols across the palette tabs.
