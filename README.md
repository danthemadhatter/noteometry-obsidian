# Noteometry

An EE workstation built as an Obsidian plugin. Infinite canvas, pressure-sensitive ink, floating drop-ins, and AI-powered math/circuit analysis — all visible at once without context switching.

**Primary device:** iPad Pro with Apple Pencil. Also works on Mac.  
**AI backend:** Claude (Anthropic) or LM Studio (local).  
**Current version:** v1.3.3

---

## Quick Reference — Drop-Ins

| Drop-In | Purpose | Min Size |
|---|---|---|
| Text Box | Plain text editor on canvas | — |
| Table | Editable grid with add/remove rows and columns | — |
| Image | Display any vault image | — |
| Image Annotator | Annotate vault images or clipboard images with ink | — |
| Formula Card | KaTeX-rendered LaTeX sticky note with 12 EE presets | 160×80px |
| Unit Converter | Instant conversion across 6 EE unit categories | 200×260px |
| PDF Viewer | Render any vault PDF, page-by-page | — |
| Circuit Sniper | Full schematic builder with AI analysis and CircuiTikZ export | 400×350px |

---

## Contents

- [Canvas](#canvas)
- [Lasso](#lasso)
- [Context Menu](#context-menu)
- [AI Panel](#ai-panel)
- [Drop-Ins](#drop-ins)
- [Sidebar](#sidebar)
- [Persistence & Sync](#persistence--sync)
- [Settings](#settings)
- [Installation](#installation)
- [Development](#development)
- [Release History](#release-history)
- [License](#license)

---

## Canvas

- Infinite canvas, white background
- Optional graph paper grid (toggle in context menu)
- Apple Pencil draws with pressure sensitivity — 30%–100% width variation
- Catmull-Rom stroke smoothing on all ink
- **Pan:** single finger when Pan tool is active, or two-finger drag
- **Pinch-to-zoom:** two fingers, range 25%–400%
- **Zoom widget:** floating pill in the bottom-right corner

```
[ ↩ ]  [ − ]  [ 87% ]  [ + ]  [ ↪ ]
```

- Tap `%` to reset zoom to 100%
- `↩` = Undo, `↪` = Redo

### Tools

| Tool | Description |
|---|---|
| Pen | Draw ink strokes; opens color + width sub-panel |
| Eraser | Erase ink strokes |
| Freehand Lasso | Free-form region selection |
| Rectangle Lasso | Rectangular region selection |
| Pan / Select | Pan the canvas or select objects |

All tools are accessed via **long-press** (iPad) or **right-click** (Mac) context menu.

---

## Lasso

The lasso is the primary AI input mechanism.

- Draw a freehand or rectangle selection around any region of the canvas
- Always uses a vision snapshot — captures actual pixels and sends them to Claude Vision
- Works on handwriting, printed text, circuit diagrams, photos — anything visible on canvas
- After selecting: an action bar appears with an **OCR** button
- OCR result populates the AI Panel input box
- Vision prompt is tuned for EE content: math notation, schematics, and symbols

---

## Context Menu

Long-press canvas on iPad, or right-click on Mac. All tools and insert actions are in one place.

### Drawing

- Select (Pointer)
- Pen
- Eraser

**Color & Width sub-panel** (opens when Pen is selected):

| Color | Hex |
|---|---|
| Navy | `#1A1A2E` |
| Blue | `#4A90D9` |
| Red | `#E53935` |
| Green | `#43A047` |
| Amber | `#F5A623` |
| Graphite | `#757575` |

| Width | Size |
|---|---|
| Fine | 1px |
| Medium | 2px |
| Bold | 3px |
| Thick | 5px |

### Select

- Freehand Lasso
- Rectangle Lasso

### Insert

- Text Box
- Table
- Image
- Image Annotator
- Formula Card
- Unit Converter
- PDF
- Circuit Sniper

### Canvas

- Lock Zoom
- Show Grid Paper (toggle; checkmark when active)
- Export PNG
- Clear Canvas (requires double confirmation)

---

## AI Panel

A floating panel that lives on top of the canvas.

- Draggable to any position
- Cannot be deleted
- Minimize button collapses to title bar only
- Bottom-right resize handle — min 280×400px, max 600×900px
- Position and size persist across sessions

### Sections

**1. Preview**  
Shows the lasso OCR result or the last AI response, rendered with KaTeX.

**2. Input**  
Type LaTeX or plain text. Math palette tabs below for symbol insertion.

**3. Chat — two modes**

| Mode | Behavior |
|---|---|
| ∑ Solve | DLP v12 step-by-step math solver; output rendered with KaTeX |
| ✈ Chat | Plain conversational assistant; no forced math formatting |

**4. Math Palette**  
Tabs organized by symbol category.  
- Click a symbol → inserts into the input box  
- Drag a symbol → places a stamp on the canvas

**Math stamps on canvas:**  
Each stamp has a toggle: **normal** / **superscript (x²)** / **subscript (x₂)**.  
Use this to help the AI distinguish sub/superscripts via vision.

---

## Drop-Ins

Drop-ins are floating panels that sit on top of the canvas. They are always visible and never hidden. Add any drop-in from the context menu → Insert.

Every drop-in has:
- Drag handle in the title bar
- Bottom-right resize handle (triangle indicator)
- Long-press context menu: **Rename | Duplicate | Delete**

---

### Text Box

Plain text editor placed directly on the canvas.

---

### Table

Editable grid. Add or remove rows and columns. Cell-level editing.

---

### Image

Display any image from your vault on the canvas.

---

### Image Annotator

Load a vault image or paste from clipboard, then annotate with ink.

- Pressure-sensitive Catmull-Rom strokes (same engine as the main canvas)
- 4 ink colors
- **Read** button: composites the image and annotations into a single vision snapshot and sends to AI
- **Clear Ink**: removes annotations without deleting the source image
- Annotation strokes stored in relative coordinates — survive resize
- Lasso capture includes both the image and the ink overlay

---

### Formula Card

A KaTeX-rendered LaTeX sticky note, permanently placed on the canvas.

- Double-tap to edit; live KaTeX preview while typing
- 6 background colors: white, yellow, blue, green, pink, gray
- Min size: 160×80px

**12 preloaded EE formulas** (tap `+` to access):

| Formula | Expression |
|---|---|
| Ohm's Law | `V = IR` |
| KVL | `ΣV = 0` |
| KCL | `ΣI = 0` |
| Impedance | `Z = R + jX` |
| Power | `P = IV = I²R = V²/R` |
| Capacitor | `I = C·dV/dt` |
| Inductor | `V = L·dI/dt` |
| RC time constant | `τ = RC` |
| Resonant frequency | `ω₀ = 1/√(LC)` |
| Euler's formula | `e^(jθ) = cosθ + j sinθ` |
| Transfer function | `H(s) = Vout(s)/Vin(s)` |
| Voltage divider | `Vout = Vin · R₂/(R₁+R₂)` |

---

### Unit Converter

Instant unit conversion across 6 EE categories.

- Type in any field → all other fields update immediately
- 6 significant figures; auto exponential notation for extreme values
- Clear button resets all fields
- Min size: 200×260px

| Tab | Units |
|---|---|
| Resistance | Ω ↔ kΩ ↔ MΩ |
| Capacitance | pF ↔ nF ↔ μF ↔ F |
| Inductance | nH ↔ μH ↔ mH ↔ H |
| Voltage | μV ↔ mV ↔ V ↔ kV |
| Current | μA ↔ mA ↔ A |
| Frequency | Hz ↔ kHz ↔ MHz ↔ GHz |

---

### PDF Viewer

Render any PDF from your vault directly on the canvas.

- Renders pages via pdfjs (no-worker mode — compatible with the Obsidian sandbox)
- Prev/Next page buttons with page X of Y display
- Re-renders on resize via ResizeObserver
- Multi-strategy path resolution (handles vault-name prefix issues)
- Re-link button if the file can't be found

---

### Circuit Sniper

A full schematic builder drop-in, ported from the standalone Circuit Sniper app.

**Components (11 types):**  
Resistor, Capacitor, Inductor, Diode, Op-Amp, NPN transistor, Switch, Relay, V-Source, I-Source, Ground

**Building:**
- Place components by clicking the library toolbar
- Wire routing: drag from pin to pin with 45° angle snap
- Rotate: hover over a component → rotate button appears above it (45° increments)
- Pin hit targets: 20×20px (designed for iPad tap accuracy)
- Undo/Redo with full history stack

**BOM panel:**  
Edit label, value, and rotation per component in a collapsible side panel.

**AI features:**

| Feature | Description |
|---|---|
| LM Studio vision scan | Pick a vault image of a schematic → AI extracts components as JSON → populates canvas |
| LM Studio text analysis | Ask questions about the circuit; get KaTeX-rendered answers |
| Governing equations | Auto-generates relevant equations (e.g. `I = C·dV/dt`) based on placed components |
| AI snapshot | Lasso capture exports the schematic as PNG for vision analysis |

**Export:**
- **CircuiTikZ export**: generates Overleaf-ready LaTeX — copy to clipboard

**LM Studio URL** is pulled from Noteometry settings automatically (no separate config needed).

Default size: 600×500px, min: 400×350px.

---

## Sidebar

Three-level hierarchy:

```
📁 APUS              ← Notebook (course)
  📁 Week 1          ← Week
    📄 Notes         ← Page (canvas)
    📄 Homework
  📁 Week 2
    📄 Notes
```

### Levels

| Level | Description |
|---|---|
| Notebook | Top-level course folder |
| Week | Sub-folder (Week 1–16 or custom name) |
| Page | Individual canvas with ink, drop-ins, and all content |

### Context Menus (long-press or right-click)

| Item | Actions |
|---|---|
| Notebook | Rename \| Add Week \| Duplicate as Template \| Delete |
| Week | Rename \| Add Page \| Delete |
| Page | Rename \| Delete |

### New Course

The **New Course** button creates a Notebook with Week 1–16, each pre-populated with a default Notes page.

### Duplicate as Template

Copies the folder structure with blank canvases — no content is copied.

**Backward compatible** with old 2-level (Section > Page) data.

---

## Persistence & Sync

- Canvas data saved as `.md` files in the vault (Obsidian-native format)
- Auto-save: 1.5-second debounce after the last change
- File watcher: detects changes from Obsidian Sync on other devices and reloads the canvas automatically
- Images stored as vault files (not base64) in an `.attachments/` subfolder
- Viewport (zoom level and pan position) persists per page
- Drop-in positions, sizes, and content persist
- AI panel position and size persist

---

## Settings

Obsidian → Settings → Noteometry

| Setting | Description | Default |
|---|---|---|
| Claude API Key | From [console.anthropic.com](https://console.anthropic.com) | — |
| Claude Model | Claude model to use for AI requests | `claude-sonnet-4-6` |
| LM Studio URL | Base URL for local LM Studio server | `http://localhost:1234` |
| LM Studio Text Model | Model name for text analysis requests | — |
| LM Studio Vision Model | Model name for vision/image scan requests | — |

---

## Installation

### From Release (recommended for iPad)

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/danthemadhatter/noteometry-obsidian/releases)
2. Copy all three files to `<vault>/.obsidian/plugins/noteometry/` (create the folder if it doesn't exist)
3. In Obsidian: Settings → Community Plugins → enable **Noteometry**
4. Add your Claude API key in Settings → Noteometry

### From Source (Mac / dev)

```bash
git clone https://github.com/danthemadhatter/noteometry-obsidian.git
cd noteometry-obsidian
npm install && npm run build
# Built files auto-deploy to ~/Documents/Noteometry/.obsidian/plugins/noteometry/
```

**To update from source:**

```bash
cd noteometry-obsidian
git stash && git pull && npm run build
```

---

## Development

```bash
npm install
npm run dev      # Watch mode — rebuilds on file change
npm run build    # Production build
npm test         # Run test suite (70 tests)
```

**Stack:** React 18, TypeScript, esbuild, Vitest, KaTeX, pdfjs-dist

---

## Release History

### v1.3.3 — 2026-04-13

- **Pinch zoom fix:** replaced PointerEvent-based touch handlers with native DOM TouchEvent listeners (`{ passive: false }`) for reliable two-finger pinch-to-zoom on iPad
- **Drop-in resize fix:** fixed layout jump on hover (resize handle set to `position: absolute`); fixed stale closure after page changes with document-level pointer listeners in a `useEffect`
- **3-level sidebar:** Notebook > Week > Page hierarchy with disclosure triangles; "New Course" creates Week 1–16 structure; backward-compatible with existing 2-level data
- **AI Panel cleanup:** removed broken left-edge resize handle; kept bottom-right corner resize
- **Simplified AI modes:** removed Explain, Transcribe, Circuit, Homework, and Ask presets; two modes only — Solve (∑) and Chat (✈)

### v1.3.2 — 2026-04-13

- **Circuit Sniper UX:** rotate button hidden by default, visible on hover/tap; pin hit targets enlarged to 20×20px; label positioning moved below component to avoid overlap
- **PDF Viewer:** switched to pdfjs legacy build (no-worker); disabled worker fetch; added detailed error logging
- **Image Annotator file picker:** empty state shows "Choose Image from Vault" and "Paste from Clipboard" buttons; inline scrollable vault dropdown with search; "Change" button in toolbar once image is loaded; clipboard paste via `navigator.clipboard.read()`

### v1.3.1 — 2026-04-13

- **Circuit Sniper drop-in:** full schematic builder on canvas — 11 component types, pin-to-pin wire routing with 45° snap, undo/redo, BOM editor, LM Studio vision scan and text analysis, governing equations panel, CircuiTikZ export, AI snapshot

### v1.3.0 — 2026-04-13

- **Image Annotator:** vault/clipboard image loading, Catmull-Rom pressure-sensitive ink, 4-color palette, "Read" button for vision composite, "Clear Ink"
- **Formula Card:** KaTeX sticky notes, double-tap to edit, 12 EE presets, 6 background colors
- **Unit Converter:** 6 EE categories, instant conversion, 6 significant figures, exponential notation
- 70 tests pass across 5 test files

### v1.2.3 — 2026-04-13

- **PDF Viewer:** nuclear rebuild using `app.vault.adapter.readBinary()` and `disableWorker: true`
- **Touch drawing:** single finger draws when pen/eraser active, pans when grab tool active; Apple Pencil always draws; two-finger always zooms
- **Mobile colors:** 6 hardcoded hex colors as inline styles, immune to theme overrides
- **Cascading sidebar:** Finder-style two-column layout
- **Vision-only lasso:** all lasso captures go through canvas pixel snapshot → vision model; no text-only path
- **Mini toolbar removed:** undo/redo moved to zoom widget; all tools via long-press context menu
- **AI panel resize handle:** 16×16px bottom-right drag handle (min 280×400, max 600×900)

### v1.2.2 — 2026-04-13

- **PDF path resolution:** multi-strategy fallback (exact path → strip vault prefix → filename search)
- **Lasso clear:** "Clear" button properly deletes strokes, stamps, and objects inside selection; pushes undo snapshot
- **Grid paper default:** grid on by default for new installs; checkmark in context menu
- **Floating panel resize:** document-level pointer events for reliable iPad drag; 12px touch target; max width 600px
- **Obsidian Sync:** file watcher detects external changes and reloads; 2-second write guard prevents reload loops; auto-save debounce reduced to 1500ms
- **Mobile/iPad GUI:** bottom sheet on narrow viewports; 44–48px touch targets throughout; 13px minimum font; proper chat bubble wrapping

### v1.2.1 — 2026-04-12

- **Long-press context menu:** added ~500ms long-press as universal iPad equivalent of right-click; works on canvas, drop-ins, stamps, sidebar sections, and sidebar pages
- **Persistent mini toolbar:** left-edge floating toolbar with pen, eraser, lasso, pan, insert, undo, redo; 44×44px touch targets; active tool highlighted; insert popout
- **Grid off by default:** `showGrid` defaults to `false` for new pages

### v1.2.0 — 2026-04-12

- **Floating zoom widget:** always-visible `[ − ] [ % ] [ + ]` pill in bottom-right; pinch-to-zoom fix
- **PDF Viewer rebuild:** ResizeObserver auto-rerender; Re-link button on file-not-found
- **Color/thickness sub-panel:** 6 colors + 4 widths visible at once; replaces blind cycling
- **Document color scheme:** white canvas (`#FFFFFF`), light gray chrome (`#F5F5F5`), steel blue accent (`#4A90D9`)
- **Duplicate as Template:** copy section folder structure with empty canvases
- **Floating AI Panel:** draggable, dockable, minimizable chat + palette panel
- **Math stamp sub/superscript toggle:** 3-state `[ sub | norm | super ]` pill on stamps

### v1.1.0 — 2026-04-12

- **Drop onto Canvas:** "Drop onto Canvas" button now appears on every AI response to place solutions as text boxes
- **Select (Pointer) tool:** added to right-click context menu
- **Zoom lock:** new toggle in Canvas section of context menu
- **Pressure sensitivity:** Apple Pencil pressure now drives stroke width (30%–100% of base width)
- **Zoom persistence:** zoom level now correctly saved and restored per page
- **UI overhaul:** compact sidebar (28px items), compact context menu (28px items), rounded panels (6px), iMessage-style chat bubbles, edge-to-edge layout, softer shadows
- Full functional audit: 33 features checked — 27 working, 3 fixed, 1 dead code removed

---

## License

0BSD — Built by Dan Hatter
