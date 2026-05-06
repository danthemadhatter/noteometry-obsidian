# Noteometry

**EE workstation — canvas, ink, AI, and drop-ins for electrical engineering students.**

An Obsidian plugin that turns your vault into an infinite canvas notebook with handwriting, AI-powered math solving, and interactive engineering drop-ins. Built for iPad Pro + Apple Pencil, works on desktop too.

> Current as of **v1.14.11**. See [CHANGELOG.md](./CHANGELOG.md) for the full history.

---

## Core Features

### Ink Engine
- **Pen** with pressure sensitivity (Apple Pencil: light touch = thin, hard press = thick)
- **Eraser** with stroke hit-testing
- **6 ink colors** (Black, Red, Blue, Green, Orange, Purple) + 4 widths
- **Catmull-Rom smoothing** for clean curves
- **Math stamps** — drag symbols from the palette onto the canvas

### AI Pipeline
- **Lasso** (freehand or rectangle) captures a region as an image
- **READ INK** — sends the capture to a vision model, returns LaTeX
- **Solve** — step-by-step DLP solutions (Math v12 protocol)
- **Chat** — conversational AI for follow-up questions
- **3 AI providers**: Claude (Anthropic), Perplexity, LM Studio (local)

### Pages
- **Pages are `.nmpage` files** in your vault. Click one in Obsidian's file explorer and it opens directly in the canvas (no markdown step in between).
- **CanvasNav (v1.14.9+)** is the on-canvas Sections | Pages two-column nav at the top of the canvas. Click a section on the left, click a page on the right; double-click renames; right-click deletes (with confirm). Add a section / page from the inline `+ Add` buttons. Collapse to a thin rail with the chevron on the Pages column.
- **Ribbon icon → "New Noteometry page"** (or the command palette equivalent) creates a new `.nmpage` next to your active file (or in the configured Vault folder if no file is active) and opens it.
- **Auto-save** with 2-second debounce. Obsidian Sync compatible — `.nmpage` is registered as a recognized extension, so it syncs like any other vault file.
- **V3 serialization** — single `elements[]` tagged-union array, vault-relative file refs.
- **Legacy migration** — pages from the pre-v1.7 `.md`-wrapped-JSON era are auto-detected; run **Noteometry: Convert legacy .md pages to .nmpage** from the command palette to migrate in bulk.

---

## Drop-ins

Right-click anywhere on the canvas to insert any drop-in. All drop-ins are draggable (direct tap-drag on the object body) and resizable, and persist with the page.

### Core
| Drop-in | Description |
|---------|-------------|
| **Text Box** | Rich text editor (contenteditable), supports bold/italic/underline |
| **Table** | Grid editor with cell editing, add/remove rows and columns |
| **Image** | Insert from vault or paste from clipboard, stored as vault files |
| **PDF Viewer** | Native Chromium renderer, page navigation, resizes with pane |

### Engineering
| Drop-in | Description |
|---------|-------------|
| **Circuit Sniper** | Full schematic editor — 10 component types (R, C, L, diode, op-amp, NPN, switch, relay, V-source, ground), pin-based wiring with 45° snap, 30/45/60° rotation, proximity-based pin lookup for reliable angled snap, Bill of Materials editor, CircuiTikz LaTeX export |
| **Unit Converter** | 6 categories (Resistance, Capacitance, Inductance, Voltage, Current, Frequency), instant SI prefix conversion |

### Math Tools (Signal Bus linked)
| Drop-in | Description |
|---------|-------------|
| **Graph Plotter** | Plot up to 6 math functions, click-drag pan, wheel/trackpad pinch zoom |
| **Unit Circle** | Draggable point, snap to common angles, live trig values (sin/cos/tan/cot/sec/csc) |
| **Oscilloscope** | Dual-channel, 7 waveform types, green-on-black phosphor display, auto measurements (freq, Vpp, Vrms) |
| **Calculator** | Expression evaluator with named variable cells, $RESULT display. (Persisted under the legacy `compute` kind for backward compatibility.) |

### Quarantined
| Drop-in | Status |
|---------|--------|
| **AI Drop-in** | Deprecated in v1.6.6. The real AI flow lives in the lasso 123/ABC radial. Legacy pages still load the stub. |

---

## Signal Bus

The math drop-ins (Graph Plotter, Unit Circle, Oscilloscope) are linked via a pub/sub Signal Bus. Channels: `theta`, `frequency`, `amplitude`, `phase`, `voltage`. Changing theta on the Unit Circle updates the Oscilloscope in real time.

---

## Canvas Tools

Tools are accessed via **right-click (mouse), two-finger tap (touch), or Apple Pencil long-press (550 ms)** — all open the context-menu hub at the press location.

- **Drawing**: Pen, Eraser, Color cycling, Width cycling. Default tool on first open is **Pen**, so the Pencil or mouse can draw immediately on a fresh canvas.
- **Select**: Pointer tool, Freehand Lasso, Rectangle Lasso. Lasso Clear deletes strokes / stamps / objects inside the regions; Lasso Move drags the captured selection.
- **Insert**: Text Box, Table, Image, PDF
- **Engineering**: Circuit Sniper, Unit Converter
- **Math Tools**: Math Palette (floating), Graph Plotter, Unit Circle, Oscilloscope, Calculator
- **Canvas**: Undo, Redo, Zoom In/Out/Reset, Export PNG, **Clear Canvas** (pinned near the top of the hub, behind its own separator, so it's reachable on short iPad viewports)

**Floating widgets**: Undo/Redo + Zoom pill (bottom-right), Math Palette (toggleable)

**Direct object drag**: drop-in objects (calculator, graph, unit converter, circuit, etc.) can be moved by tap-dragging the object body from any tool. Clicks on inner controls (inputs, buttons, sliders, contenteditable regions, inner canvases) pass through as normal.

**Note on Apple Pencil**: Pencil double-tap is not exposed to Obsidian plugins by WebKit/Safari. The context-menu hub is opened instead by a 550 ms long-press with an 8 px movement slop — if a stroke was mid-draw when the hold fires, it is cancelled so the menu-open is not also a scribble.

---

## Installation

### From GitHub Releases (BRAT)
1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) in Obsidian
2. Add this repository: `danthemadhatter/noteometry-obsidian`
3. BRAT will pull the latest GitHub release automatically

**Note on updates:** BRAT matches the `version` in the repo's `manifest.json` against a published GitHub release with the same tag. If you're stuck on an older version, check that a release with the tag shown in `manifest.json` exists on the [releases page](https://github.com/danthemadhatter/noteometry-obsidian/releases). The release tag must match exactly — this repo uses the `v` prefix (e.g. `v1.14.11`). See [RELEASE.md](./RELEASE.md) for the full ship checklist.

### Manual
1. Download `main.js`, `styles.css`, `manifest.json` from the [latest release](https://github.com/danthemadhatter/noteometry-obsidian/releases)
2. Create `~/.obsidian/plugins/noteometry/` in your vault
3. Copy the 3 files there
4. Enable "Noteometry" in Obsidian Settings > Community Plugins

### From Source
```bash
git clone https://github.com/danthemadhatter/noteometry-obsidian.git
cd noteometry-obsidian
npm install
npm run build
```

---

## Settings

| Setting | Description |
|---------|-------------|
| AI Provider | Perplexity (default), Claude, or LM Studio |
| Perplexity API Key / Model | Default model: `openai/gpt-5.4` |
| Claude API Key / Model | Default model: `claude-opus-4-6` |
| LM Studio URL / Text model / Vision model | Default URL: `http://localhost:1234`; text model `qwen3-235b`, vision `qwen2-vl-72b` |
| Vault folder | Default: `Noteometry`. Where the ribbon's "New page" lands and where legacy-migration scans look. |
| Auto-save / delay | Default: on, 2000 ms debounce |
| Apply Noteometry theme to all of Obsidian | Default: on (v1.11.1+) |
| Reset gesture tutorial | Re-triggers the first-run gesture cheatsheet (v1.11.0+) |
| Finger drawing | Draw with a single finger on touch devices (default: off, enable for Android) |

---

## Architecture

```
Noteometry v1.14.11 — System Architecture

Layer 1: Obsidian Plugin API (FileView, TFile, registerExtensions, requestUrl)
Layer 2: Canvas Engine (infinite canvas, zoom, pan, grid, pointer events)
Layer 3: Serialization (v3 pack/unpack, pageFormat.ts, .nmpage files)
Layer 4: Canvas Object Layer (renders all drop-in instances, layout, z-index)
Layer 5: Drop-in Instances (each self-contained React component)

Signal Bus: pub/sub singleton linking math drop-ins (theta, frequency, amplitude)
AI Pipeline: User Canvas -> Lasso -> Vision Snapshot -> requestUrl -> Claude/Perplexity/LM Studio
Snapshot Flow: Any Drop-in -> Camera Icon -> html2canvas -> Image on Canvas or Clipboard
On-canvas nav: CanvasNav (v1.14.9+) renders Sections | Pages at the top of the canvas; v1.14.10 killed the standalone Home view.
```

For the full breakdown see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## File Hierarchy

`.nmpage` files live wherever you put them in your vault — Obsidian's file explorer and the on-canvas CanvasNav are both navigation layers, so folder structure is up to you. The plugin's **Vault folder** setting (default: `Noteometry/`) is where the ribbon's "New page" lands when no other file is active and where the legacy-migration scan looks; nothing prevents you from moving pages around afterward.

```
<your vault>/
  Noteometry/                  <- default folder (configurable)
    My Course/
      Week 1.nmpage            <- page data (v3 JSON in a .nmpage file)
      Week 2.nmpage
    APUS/
      ELEN201/
        Lecture 4.nmpage       <- pages organize freely; not bound to a fixed depth
    attachments/
      img-xxx.png              <- vault-stored images
      pdf-xxx.pdf              <- vault-stored PDFs
```

CanvasNav treats first-level child folders of the Vault folder as "Sections" and shows every `.nmpage` underneath each section as a flat page list (sub-folders are folded into the page list). Loose `.nmpage` files directly under the root land in a synthetic root bucket labeled with the root folder name (e.g. "Noteometry").

**Migrating from pre-v1.7 vaults:** older releases stored pages as `.md` files containing JSON. On load, the plugin detects these and surfaces a Notice; run **Noteometry: Convert legacy .md pages to .nmpage** from the command palette to rename them in bulk. Collisions get a numeric suffix (`Foo 1.nmpage`, `Foo 2.nmpage`) so nothing is silently skipped.

---

## License

0BSD — see [LICENSE](./LICENSE).
