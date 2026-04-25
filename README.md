# Noteometry v1.6.9

**EE workstation — canvas, ink, AI, and drop-ins for electrical engineering students.**

An Obsidian plugin that turns your vault into an infinite canvas notebook with handwriting, AI-powered math solving, and interactive engineering drop-ins. Built for iPad Pro + Apple Pencil, works on desktop too.

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

### Experimental (hidden by default)
Available when **Settings → Show experimental tools** is enabled. Pages that already contain these drop-ins still render normally.

| Drop-in | Description |
|---------|-------------|
| **Multimeter** | Simulated DMM with DC/AC voltage, current, resistance, capacitance, continuity, and diode modes |
| **Animation Canvas** | Frame-based animation with play/pause, drawing, frame navigation |
| **Study Gantt** | Timeline planner with tasks, color coding, date ranges, progress bars |

### Quarantined
| Drop-in | Status |
|---------|--------|
| **AI Drop-in** | Deprecated in v1.6.6. The real AI flow lives in the right panel (Input / Chat / Solve). Legacy pages still load the stub. |

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
- **Experimental (opt-in)**: Multimeter, Animation Canvas, Study Gantt
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

**Note on updates:** BRAT matches the `version` in the repo's `manifest.json` against a published GitHub release with the same tag. If you're stuck on an older version, check that a release with the tag shown in `manifest.json` exists on the [releases page](https://github.com/danthemadhatter/noteometry-obsidian/releases). The release tag must match exactly — this repo uses the `v` prefix (e.g. `v1.6.9`). See [RELEASE.md](./RELEASE.md) for the full ship checklist.

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

### Cross-device updates via Obsidian Sync

If you build Noteometry on one Mac and want every other device (iPad,
Android, second Mac) to pick up the new bundle automatically — without
running anything on those devices — see
[docs/SYNC_WORKFLOW.md](./docs/SYNC_WORKFLOW.md). It walks through the
one-time Sync toggles and the daily build-on-Mac, sync-everywhere cycle.

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
| Show experimental tools | Re-expose Multimeter, Animation Canvas, and Study Gantt in the right-click hub (default: off) |

---

## Architecture

```
Noteometry v1.6.9 — System Architecture

Layer 1: Obsidian Plugin API (requestUrl, vault, TFile, WorkspaceLeaf)
Layer 2: Canvas Engine (infinite canvas, zoom, pan, grid, pointer events)
Layer 3: Serialization (v3 pack/unpack, pageFormat.ts, .md-wrapped JSON)
Layer 4: Canvas Object Layer (renders all drop-in instances, layout, z-index)
Layer 5: Drop-in Instances (each self-contained React component)

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
