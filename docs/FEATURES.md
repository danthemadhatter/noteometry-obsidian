# Noteometry Features

## Canvas / Drawing

### Pen Tool
- Freehand drawing with mouse or Apple Pencil
- Catmull-Rom spline smoothing (removes jitter, preserves natural feel)
- Uniform stroke width (no pressure sensitivity)
- Configurable width: Fine (1.5px), Medium (3px), Thick (5px), Marker (8px)
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
- Tap canvas objects (text boxes, tables, images) to select
- Keyboard Delete/Backspace to remove selected items

### Tool Cycling
- Toolbar cycle button: Pen → Eraser → Grab → Pen
- One tap to switch between the three most-used tools

### Undo / Redo
- Tracks strokes and stamps
- Ctrl/Cmd+Z for undo, Ctrl/Cmd+Shift+Z for redo
- Eraser operations batched into single undo entries

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
- Stored as base64 data URLs in page data

### Object Management
- Delete button (x) on each object's drag handle
- Confirmation dialog before deletion
- Objects only interactive in Select mode

## Lasso + OCR

### Lasso Selection
- Freeform polygon drawing
- Blue dashed outline with translucent fill
- Stays visible after capture until OCR processes or user cancels
- Captures strokes, stamps, AND canvas objects within the selection
- Minimum 10 points to register (prevents accidental taps)

### OCR (READ INK)
- Renders lasso region to high-resolution image (3x scale)
- Sends to Claude Vision API (or LM Studio vision model)
- Handles ANY content: handwriting, printed text, screenshots, circuit diagrams, photos, mixed media
- Extracted text goes to Input box, then auto-sends to Chat for solving
- Image attachment included so AI can see diagrams/figures

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
- Multi-turn conversation with Claude Opus 4 (or LM Studio)
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

## Navigation (OneNote-style)

### Sidebar
- Single-column tree: Sections expand to show Pages
- Create/rename/delete sections and pages
- Auto-collapses on mobile (<768px)
- Overlays canvas on mobile with backdrop dimming
- OK button for name inputs (reliable on iPad)
- Rename via pen icon on each item

### Page Persistence
- Each page saved as `Noteometry/<Section>/<Page>.md` in the vault
- JSON data inside .md files (Obsidian Sync compatible)
- Auto-save with 2-second debounce
- Save on page switch (flushes before loading new page)
- Save on view close (flushes before unmounting)
- Legacy migration from old canvas.json format
- Auto-migration from .json to .md on startup

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| AI Provider | Claude | Claude (cloud) or LM Studio (local) |
| Claude API Key | (empty) | Anthropic API key |
| Claude Model | claude-opus-4-20250514 | Model ID for all AI tasks |
| LM Studio URL | http://localhost:1234 | Local LM Studio server |
| LM Studio Text Model | qwen3-235b | Text model for solving/chat |
| LM Studio Vision Model | qwen2-vl-72b | Vision model for OCR |
| Vault Folder | Noteometry | Root folder for page data |
| Auto Save | true | Enable auto-save |
| Auto Save Delay | 2000 | Debounce delay in ms |

## Responsive Design

### Desktop (>1024px)
- Sidebar permanent, 260px wide
- Right panel 320px, resizable
- Toolbar centered at bottom

### Tablet / iPad (768-1024px)
- Sidebar permanent, narrower
- Right panel starts at 240px
- Toolbar scrollable horizontally

### Phone (<768px)
- Sidebar overlays canvas (slide-in with backdrop)
- Auto-collapses on load
- Canvas and panel stack vertically
- Color dots smaller (14px)
- Toolbar compact with smaller buttons

## Platform-Specific

### iPad
- Touch always pans (finger = pan, Apple Pencil = draw)
- Swipe gestures blocked (no accidental sidebar/backlinks opening)
- contentEditable focus on tap for keyboard popup
- inputMode="text" and enterKeyHint on all inputs
- Image picker shows photo library (not camera-only)

### Desktop
- Mouse/trackpad drawing
- HTML5 drag-and-drop from MathPalette to canvas
- Keyboard shortcuts (Ctrl/Cmd+Z undo, Shift+Z redo, Delete to remove)
- Mouse wheel for canvas scrolling
