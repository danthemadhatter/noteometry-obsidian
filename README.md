# Noteometry – Obsidian Plugin

Ink-first STEM notebook. Pencil + eraser + AI-powered math recognition and solving. Claude AI + LM Studio.

## Features

- **Three modes**: Text · Math · Circuits
- **READ INK** – Lasso handwriting → Claude Vision → clean LaTeX in your input box
- **SOLVE** – DLP v12 step-by-step solutions with boxed answers
- **AI Provider toggle** – Anthropic Claude (cloud) or LM Studio (local)
- **Math symbol palette** (∫ ∑ √ π Ω and more)
- **Canvas pan** – Grab tool for scrolling the infinite canvas
- **Split-pane layout** – Ink canvas left, processing panel right
- **Auto-save** – Canvas and panel state persist across sessions
- **Theme-aware** – Adapts to your Obsidian light/dark theme
- **Rendered output** – Solutions render with Obsidian's built-in math engine

Made for engineers who want a pencil, an eraser, and a solver.

## Installation

1. Clone or download this repo into `.obsidian/plugins/noteometry/`
2. `npm install && npm run build`
3. Enable **Noteometry** in Obsidian → Settings → Community plugins
4. Set your Claude API key in Settings → Noteometry
5. Click the pencil ribbon icon or run "Open Noteometry canvas" from the command palette

## AI Setup

**Claude (default):** Get a key from [console.anthropic.com](https://console.anthropic.com). Default model: `claude-sonnet-4-6`.

**LM Studio (local):** Point to your LM Studio server (default `http://localhost:1234`). Set text and vision model names.

## Development

```bash
npm install
npm run dev     # Watch mode
npm run build   # Production build
```

## License

0BSD

Built by Dan.
