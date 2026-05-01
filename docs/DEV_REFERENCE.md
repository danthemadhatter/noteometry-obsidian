# Noteometry Dev Reference

> Loaded at session start so Claude has full architectural context without
> needing to re-explore the repo. Update this when the layout, vault
> shape, or AI provider list changes — it's the contract between sessions.

## Where to find it

- **Repo**: https://github.com/danthemadhatter/noteometry-obsidian
- **Latest release**: https://github.com/danthemadhatter/noteometry-obsidian/releases/latest
- **All releases**: https://github.com/danthemadhatter/noteometry-obsidian/releases
- **BRAT install URL**: `danthemadhatter/noteometry-obsidian` (paste this, not a full URL, into BRAT's "Add Beta plugin")
- **Active Claude branch**: `claude/obsidian-plugin-builder-Hccne`

## Source layout

```
noteometry-obsidian/
├── src/
│   ├── main.ts                       Plugin entry, extends Obsidian's Plugin
│   ├── NoteometryView.ts             ItemView bridge → React root, swipe blocker
│   ├── settings.ts                   Settings tab UI
│   ├── types.ts                      NoteometrySettings + DEFAULT_SETTINGS
│   ├── components/
│   │   ├── NoteometryApp.tsx         Root component (~1450 lines, all top-level state)
│   │   ├── SidebarTree.tsx           v1.7.3+ OneNote tree sidebar
│   │   ├── InkCanvas.tsx             Pen / eraser / pointer events
│   │   ├── CanvasObjectLayer.tsx     Drop-in rendering layer
│   │   ├── Panel.tsx, ChatPanel.tsx  AI panel + chat panel
│   │   ├── ContextMenu.tsx           Right-click hub
│   │   ├── MathPalette.tsx           Math symbol palette
│   │   ├── KaTeXRenderer.tsx
│   │   ├── LassoOverlay.tsx
│   │   ├── PdfViewer.tsx
│   │   ├── RichTextEditor.tsx
│   │   ├── TableEditor.tsx
│   │   ├── Icons.tsx                 SVG icon components
│   │   └── dropins/                  AI drop-in stub etc.
│   ├── features/
│   │   ├── ink/useInk.ts             Ink state hook
│   │   ├── lasso/                    Lasso selection + rasterize
│   │   ├── objects/useObjects.ts     Canvas-object state
│   │   ├── pages/usePages.ts         currentPath + selectPath, init lifecycle
│   │   └── pipeline/usePipeline.ts   Panel input + chat history
│   └── lib/
│       ├── ai.ts                     AI calls (Claude / Perplexity / LM Studio)
│       ├── aiImageFormat.ts          Vision payload formatting
│       ├── canvasObjects.ts          Drop-in factories + types
│       ├── canvasMenuActions.ts      Clear-Canvas action factory
│       ├── canvasRenderer.ts         Stroke rasterization
│       ├── courseTemplate.ts         16-week course (3-level) template
│       ├── dropinExport.ts           Snapshot / download
│       ├── inkEngine.ts              Catmull-Rom smoothing, hit-testing
│       ├── mathml.ts                 MathML rendering (PROTECTED pipeline)
│       ├── objectClipboard.ts        Drop-in copy/paste
│       ├── objectDragHitTest.ts      Direct-drag pass-through
│       ├── pageFormat.ts             v3 pack/unpack
│       ├── persistence.ts            listTree, loadPageByPath, savePageByPath, …
│       ├── renameValidation.ts       Filename sanity check
│       ├── sidebarActions.ts         createSixteenWeekCourse, revealFolder
│       ├── SignalBus.ts              Math drop-in pub/sub
│       ├── tableStore.ts             Module-level table data store
│       ├── treeTypes.ts              TreeNode interface
│       ├── treeHelpers.ts            findNode, walkLeaves, ancestors, …
│       ├── version.ts                NOTEOMETRY_VERSION constant (in-app badge)
│       ├── wheelRouting.ts           Native scroll vs. canvas-zoom routing
│       └── wheelZoom.ts              Trackpad pinch / Ctrl-wheel zoom
├── tests/unit/                       Vitest tests (23 files, 265 tests)
├── docs/
│   ├── DEV_REFERENCE.md              This file
│   ├── DEVELOPMENT.md                Original dev guide
│   ├── ARCHITECTURE.md               Layered architecture overview
│   ├── FEATURES.md                   Feature catalog
│   ├── API.md                        Public API surface
│   ├── UPDATE_WORKFLOW.md            v1.7.0 ship-via-BRAT flow
│   └── SHARED_TEXTBOOK_SPEC.md
├── manifest.json                     Plugin metadata + version
├── versions.json                     Per-version minAppVersion map
├── package.json                      Build scripts, deps
├── esbuild.config.mjs                Production bundler + auto-deploy
├── version-bump.mjs                  npm-version hook (4-file bump)
├── scripts/ship.sh                   Local one-shot ship (alt to npm version)
├── .github/workflows/
│   ├── main.yml                      Tag-push → build + release
│   └── auto-tag.yml                  Branch-push → tag + build + release (v1.7.3+)
└── styles.css                        ~3400 lines, all CSS in one file
```

## Vault layout (where user data lives)

The plugin reads/writes inside the user's Obsidian vault, in a top-level
folder named per the **`vaultFolder` setting** (default: `Noteometry`).
On Dan's Mac that's `~/Documents/Noteometry/Noteometry/` because his
vault root *is* `~/Documents/Noteometry/`.

```
<vault root>/Noteometry/
├── <Course 1>/                        e.g. "Calc III"
│   ├── attachments/                   Images + PDFs for pages directly under this course
│   │   ├── img-<id>.png
│   │   └── pdf-<id>.pdf
│   ├── Week 1/
│   │   ├── attachments/               Week-local attachments (v1.7.3+)
│   │   ├── Lecture.md                 ← v3-format JSON page
│   │   ├── Lab.md
│   │   └── HW 1.md
│   ├── Week 2/
│   │   └── …
│   └── …
└── <Course 2>/
    └── …
```

- **`.md` files are JSON inside.** Despite the extension, each page is
  a v3 JSON document. The `.md` extension is intentional — Obsidian
  Sync only syncs `.md` (and a few other allowlisted extensions), so
  this is what makes pages cross-device.
- **Attachments** sit in an `attachments/` folder **next to** the page.
  With the v1.7.3 tree, that means Week-local folders for nested pages,
  course-local for pages directly under a course.
  `attachmentsDirForPage()` in `persistence.ts` resolves it.
- **Page format**: v3 = `elements[]` tagged-union (strokes, stamps,
  textboxes, tables, images, drop-ins). Defined in
  `src/lib/pageFormat.ts`. Loader in `loadPageByPath` falls back through
  v2 (separate arrays) and v1 (text-only) for old data.
- **`canvas.md` legacy migration** runs on first load: a pre-v1.6
  single-canvas plugin folder gets lifted into
  `Noteometry/General/Untitled.md`. One-shot, idempotent.

## Plugin install location (where the bundle lives)

```
<vault root>/.obsidian/plugins/noteometry/
├── main.js          ~825 KB bundled CJS (excludes obsidian, electron, codemirror, lezer)
├── manifest.json    id "noteometry", version match required for BRAT
├── styles.css       ~99 KB
└── data.json        Plugin settings (API keys, toggles, last view)
```

`esbuild.config.mjs` auto-copies `main.js` / `styles.css` /
`manifest.json` here at the end of every `npm run build` — that's the
deploy step, hardcoded path is
`~/Documents/Noteometry/.obsidian/plugins/noteometry/`.

## AI integration

**Providers** (`NoteometrySettings.aiProvider`):
`"claude" | "perplexity" | "lmstudio"`. Default: Perplexity.

**Settings** (`src/types.ts` → `NoteometrySettings`, persisted to
`data.json`):

| Field | Provider | Notes |
|---|---|---|
| `claudeApiKey` | Claude | sk-ant-… |
| `claudeModel` | Claude | e.g. `claude-opus-4-6` |
| `perplexityApiKey` | Perplexity | pplx-… |
| `perplexityModel` | Perplexity | e.g. `openai/gpt-5.4` |
| `lmstudioUrl` | LM Studio | default `http://localhost:1234` |
| `lmstudioTextModel` | LM Studio | default `qwen3-235b` |
| `lmstudioVisionModel` | LM Studio | default `qwen2-vl-72b` |
| `autoSave` | — | bool |
| `autoSaveDelay` | — | ms (default 2000) |
| `fingerDrawing` | — | enable single-finger draw (Android) |
| `showExperimental` | — | re-expose Multimeter / Animation Canvas / Study Gantt |
| `vaultFolder` | — | default `"Noteometry"` |

**Three call sites** in `src/lib/ai.ts`:

| Function | Inputs | Output |
|---|---|---|
| `readInk(snapshot, settings)` | rasterized lasso PNG | LaTeX |
| `solve(input, settings)` | LaTeX (or text) | step-by-step DLP solution (Math v12 protocol) |
| `chat(history, prompt, settings)` | message thread | reply |

**Transport**:
- **Claude / Perplexity** → Obsidian's `requestUrl()` (bypasses CORS — required on iPad).
- **LM Studio** → standard `fetch()` (local network).

**Vision payload format**: `src/lib/aiImageFormat.ts` packages PNGs as
either OpenAI-compatible image_url blocks (Perplexity / LM Studio
vision) or Anthropic content arrays (Claude).

**Math v12 / MathML / clipboard pipeline** is *protected* — explicit
regression tests (`tests/unit/mathV12Preset.test.ts`,
`mathml.test.ts`, `clipboardPayload.test.ts`) gate any change. Don't
refactor without reviewing those.

## Build, ship, install

**Local** (when you're at the Mac):

```bash
npm run build           # tsc -noEmit + esbuild prod + deploy to vault
npm run dev             # esbuild watch mode, no deploy
npm run test            # vitest
npm version <semver>    # bumps all 4 version locations + commits + tags
```

The `npm version` hook (`version-bump.mjs`) bumps `manifest.json`,
`versions.json`, `src/lib/version.ts`, and `package.json` atomically.
There's a vitest test (`tests/unit/version.test.ts`) that hard-fails
if any drift between them.

**No-Mac path** (Claude in the sandbox):

1. Push code to `claude/obsidian-plugin-builder-Hccne`.
2. `.github/workflows/auto-tag.yml` reads `manifest.json`, creates
   `v$VERSION` tag, then builds + publishes the GitHub release in the
   same workflow run (avoids GITHUB_TOKEN's downstream-trigger guard).
3. BRAT polls origin, sees the new release, pulls `main.js` /
   `styles.css` / `manifest.json` into every device's
   `.obsidian/plugins/noteometry/`.
4. Toggle plugin off/on per device to load the new `main.js` (Obsidian
   caches at app start).

**Tag-push path** (when at the Mac):

1. `npm version <semver>` → `git push --follow-tags`.
2. `.github/workflows/main.yml` (the original release workflow) builds
   + publishes on the tag push.
3. Same BRAT cycle.

## Plugin lifecycle

`src/main.ts` (the `Plugin` subclass):

1. `onload()` — registers `NoteometryView`, ribbon icon, command-palette
   entries, settings tab, status-bar version banner.
2. `loadSettings()` / `saveSettings()` — round-trip `data.json`
   through Obsidian's plugin storage.
3. `app.workspace.getLeavesOfType(VIEW_TYPE)` is detached + reopened on
   enable to force a clean view mount.
4. `onunload()` — unmounts views, no global state survives.

`src/NoteometryView.ts` (the `ItemView`):

- `onOpen` → mounts React root via `createRoot()` from `react-dom/client`.
- Blocks `touchstart`/`touchmove`/`touchend` from bubbling to Obsidian's
  swipe handlers (otherwise Obsidian eats your pen strokes as
  edge-swipes).
- v1.7.4: no longer auto-collapses Obsidian's left/right sidebars (the
  sidebar header has explicit toggles instead).
- `onClose` → flushes pending saves via the `flushSave` module-level
  export, then unmounts.

## State management (the React side)

- **Single root component** owns all top-level state:
  `src/components/NoteometryApp.tsx`. ~1450 lines. Per the dev doc this
  is "the God Component by necessity" — Obsidian plugin constraints keep
  it monolithic.
- **Refs mirror state** (`strokesRef`, `pathRef`, etc.) so event handlers
  don't capture stale closures.
- **Auto-save**: 2s debounce on any saveable state change.
  `loadingPageRef` flag prevents save-on-load races. v1.7.3+ keys on
  `pathRef.current` (single path string) instead of legacy
  `(section, page)`.
- **One module-level store**: `tableStore` — table/textbox content
  needs to be addressable by ID from child components. Everything else
  is React state.

## Tests

23 test files, 265 tests. Run with `npm test`. Highlights:

- `mathV12Preset.test.ts`, `mathml.test.ts`, `clipboardPayload.test.ts`
  — **protected** regression guardrails.
- `treeHelpers.test.ts` — v1.7.3 path-helper coverage (25 cases).
- `sidebarActions.test.ts` — v1.7.2 16-week course template invariants.
- `version.test.ts` — manifest / package / versions.json /
  `NOTEOMETRY_VERSION` all match.
- `persistenceV3.test.ts` — pack/unpack round-trip.

Protected tests fail loudly on accidental changes; assume any failure
there means investigate, not "fix the test."
