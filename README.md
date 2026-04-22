# Noteometry v1.6.5

**EE workstation — canvas, ink, AI, and drop-ins for electrical engineering students.**

An Obsidian plugin that turns your vault into an infinite canvas notebook with handwriting, AI-powered math solving, and 14 interactive engineering drop-ins. Built for iPad Pro + Apple Pencil, works on desktop too.

---

## Core Features

### Ink Engine
- **Pen** with pressure sensitivity (Apple Pencil: light touch = thin, hard press = thick)
- **Eraser** with stroke hit-testing
- **6 Google colors** (Black, Red, Blue, Green, Orange, Purple) + 4 widths
- **Catmull-Rom smoothing** for clean curves
- **Math stamps** — drag symbols from the palette onto the canvas

### AI Pipeline
- **Lasso** (freehand or rectangle) captures a region as an image
- **READ INK** — sends the capture to a vision model, returns LaTeX
- **Solve** — step-by-step DLP solutions (Math v12 protocol)
- **Chat** — conversational AI for follow-up questions
- **3 AI providers**: Claude (Anthropic), Perplexity, LM Studio (local)

### Notebooks
- **Sections + Pages** — tab-based sidebar with natural sort (Week 2 before Week 10)
- **New Course** — creates APUS section with Week 1-16 pages in one click
- **Auto-save** with 2-second debounce, Obsidian Sync compatible (.md files)
- **V3 serialization** — single `elements[]` tagged-union array, vault-relative file refs

---

## Drop-ins (14 types)

Right-click anywhere on the canvas to insert any drop-in. All drop-ins are draggable, resizable, and persist with the page.

### Core
| Drop-in | Description |
|---------|-------------|
| **Text Box** | Rich text editor (contenteditable), supports bold/italic/underline |
| **Table** | Grid editor with cell editing, add/remove rows and columns |
| **Image** | Insert from vault or paste from clipboard, stored as vault files |
| **PDF Viewer** | Native Chromium renderer (no pdfjs-dist), page navigation, resizes with pane |

### Engineering
| Drop-in | Description |
|---------|-------------|
| **Circuit Sniper** | Full schematic editor — 10 component types (R, C, L, diode, op-amp, NPN, switch, relay, V-source, ground), pin-based wiring with 45-degree snap, 30/45/60-degree rotation, Bill of Materials editor, CircuiTikz LaTeX export |
| **Unit Converter** | 6 categories (Resistance, Capacitance, Inductance, Voltage, Current, Frequency), instant SI prefix conversion |
| **Multimeter** | Simulated DMM with DC/AC voltage, current, resistance, capacitance, continuity, and diode modes. Auto-ranging LCD display |

### Math Tools (Signal Bus linked)
| Drop-in | Description |
|---------|-------------|
| **Graph Plotter** | Plot up to 6 math functions, canvas rendering with axes/grid, color-coded toggles |
| **Unit Circle** | Draggable point, snap to common angles, live trig values (sin/cos/tan/cot/sec/csc), quadrant presets |
| **Oscilloscope** | Dual-channel, 7 waveform types, green-on-black phosphor display, auto measurements (freq, Vpp, Vrms) |
| **Compute** | Expression evaluator with named variable cells, $RESULT display |
| **Animation Canvas** | Frame-based animation with play/pause, drawing, frame navigation |

### Study
| Drop-in | Description |
|---------|-------------|
| **Study Gantt** | Timeline planner with tasks, color coding, date ranges, progress bars |

### AI
| Drop-in | Description |
|---------|-------------|
| **AI Drop-in** | Canvas-positioned Solve/Chat toggle with input and preview |

---

## Signal Bus

The math drop-ins (Graph Plotter, Unit Circle, Oscilloscope) are linked via a pub/sub Signal Bus. Channels: `theta`, `frequency`, `amplitude`, `phase`, `voltage`. Changing theta on the Unit Circle updates the Oscilloscope in real time.

---

## Canvas Tools

All tools are accessed via **right-click context menu**:

- **Drawing**: Pen, Eraser, Color cycling, Width cycling
- **Select**: Pointer tool, Freehand Lasso, Rectangle Lasso
- **Insert**: Text Box, Table, Image, PDF
- **Engineering**: Circuit Sniper, Unit Converter, Multimeter
- **Math Tools**: Math Palette (floating), Graph Plotter, Unit Circle, Oscilloscope, Compute, Animation Canvas
- **Study**: Study Gantt
- **AI**: AI Drop-in
- **Canvas**: Undo, Redo, Zoom In/Out/Reset, Export PNG, Clear Canvas

**Floating widgets**: Undo/Redo + Zoom pill (bottom-right), Math Palette (toggleable)

---

## Installation

### From GitHub Releases (BRAT)
1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) in Obsidian
2. Add this repository: `danthemadhatter/noteometry-obsidian`
3. BRAT will pull the latest GitHub release automatically

**Note on updates:** BRAT matches the `version` in the repo's `manifest.json` against a published GitHub release with the same tag. If you're stuck on an older version, check that a release with the tag shown in `manifest.json` exists on the [releases page](https://github.com/danthemadhatter/noteometry-obsidian/releases). The release tag must match exactly (this repo uses the `v` prefix, e.g. `v1.6.5`).

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
| AI Provider | Claude, Perplexity, or LM Studio (default: Perplexity) |
| Claude API Key | Your Anthropic API key |
| Claude Model | e.g. `claude-opus-4-6` |
| Perplexity API Key | Your Perplexity API key |
| Perplexity Model | e.g. `openai/gpt-5.4` |
| LM Studio URL | Default: `http://localhost:1234` |
| LM Studio Text Model | Model name for chat (default: `qwen3-235b`) |
| LM Studio Vision Model | Model name for READ INK (default: `qwen2-vl-72b`) |
| Auto-save | Enable/disable + debounce delay (default: 2000ms) |
| Finger drawing | Draw with a single finger on touch devices (default: off, enable for Android) |

---

## Architecture

```
Noteometry v1.6.5 — System Architecture

Layer 1: Obsidian Plugin API (requestUrl, vault, TFile, WorkspaceLeaf)
Layer 2: Canvas Engine (infinite canvas, zoom, pan, grid, pointer events)
Layer 3: Serialization (v3 pack/unpack, pageFormat.ts, .noteometry files)
Layer 4: Canvas Object Layer (renders all drop-in instances, layout, z-index)
Layer 5: Drop-in Instances (14 types, each self-contained React component)

Signal Bus: pub/sub singleton linking math drop-ins (theta, frequency, amplitude)
AI Pipeline: User Canvas -> Lasso -> Vision Snapshot -> AI Drop-in -> requestUrl -> Claude/Perplexity/LM Studio
Snapshot Flow: Any Drop-in -> Camera Icon -> html2canvas -> Image on Canvas or Clipboard
```

---

## File Hierarchy

```
Notebooks/
  APUS/
    Week 1.md      <- page data (v3 JSON)
    Week 2.md
    attachments/
      img-xxx.png  <- vault-stored images
      pdf-xxx.pdf  <- vault-stored PDFs
  MATH303/
    ...
```

---

## License

0BSD — see [LICENSE](./LICENSE).
