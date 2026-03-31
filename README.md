# Noteometry – Obsidian Plugin

Ink-first STEM notebook. Pencil + eraser + AI-powered math recognition and solving. Powered by Excalidraw + Gemini.

## Features

- **Three modes**: Text · Math · Circuits
- **READ INK** – Export canvas → Gemini Vision → clean LaTeX in your input box
- **SOLVE** – DLP v12 step-by-step solutions with boxed answers
- **Math symbol palette** (∫ ∑ √ π Ω and more)
- **Circuit symbol palette** (R, C, L, D, OpAmp, etc.)
- **Split-pane layout** – Excalidraw canvas left, processing panel right
- **Auto-save** – Canvas and panel state persist across sessions
- **Theme-aware** – Adapts to your Obsidian light/dark theme
- **Rendered output** – Solutions render with Obsidian's built-in math engine

Made for engineers who want a pencil, an eraser, and a solver.

## Installation

1. Clone or download this repo into `.obsidian/plugins/noteometry/`
2. `npm install && npm run build`
3. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/noteometry/`
4. Enable **Noteometry** in Obsidian → Settings → Community plugins
5. Set your Gemini API key in Settings → Noteometry
6. Click the pencil ribbon icon or run "Open Noteometry canvas" from the command palette

## API Key

Get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey). Default model: `gemini-3.1-pro-preview` (configurable in settings).

## Development

```bash
npm install
npm run dev     # Watch mode
npm run build   # Production build
```

## License

0BSD

Built by Dan.
