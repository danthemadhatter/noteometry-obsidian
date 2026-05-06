# Noteometry API Reference

> Current as of **v1.14.11**. This is a *public surface* summary — not every internal export. When a detail here disagrees with the source, the source wins; open an issue so this doc can be corrected.

## Core Types (`src/types.ts`)

```typescript
type AIProvider = "claude" | "lmstudio" | "perplexity"

interface NoteometrySettings {
  aiProvider: AIProvider          // default: "perplexity"
  claudeApiKey: string
  claudeModel: string             // default: "claude-opus-4-6"
  perplexityApiKey: string
  perplexityModel: string         // default: "openai/gpt-5.4"
  lmStudioUrl: string             // default: "http://localhost:1234"
  lmStudioTextModel: string       // default: "qwen3-235b"
  lmStudioVisionModel: string     // default: "qwen2-vl-72b"
  vaultFolder: string             // default: "Noteometry"
  autoSave: boolean               // default: true
  autoSaveDelay: number           // default: 2000 (ms)
  fingerDrawing: boolean          // default: false
  gestureTutorialSeen: boolean    // v1.11.0+, default: false
  globalThemeEnabled: boolean     // v1.11.1+, default: true
}

interface ChatMessage {
  role: "user" | "assistant"
  text: string
}

interface Attachment {
  name: string
  mimeType: string
  data: string                    // base64 data URL
}
```

## Ink Engine (`src/lib/inkEngine.ts`)

### Types
```typescript
interface StrokePoint { x: number; y: number; pressure: number }
interface Stroke { id: string; points: StrokePoint[]; color: string; width: number }  // width is base; pressure modulates render width
interface Stamp { id: string; x: number; y: number; text: string; fontSize: number; color: string }
interface BBox { x: number; y: number; w: number; h: number }
```

### Functions
| Function | Signature | Description |
|----------|-----------|-------------|
| `newStrokeId` | `() => string` | UUID for new strokes |
| `newStampId` | `() => string` | UUID for new stamps |
| `stampBBox` | `(stamp: Stamp) => BBox` | Bounding box for stamp hit-testing |
| `pointNearStroke` | `(px, py, stroke, tolerance) => boolean` | Is point within tolerance of any stroke segment? |
| `smoothPoints` | `(raw: StrokePoint[], tension?) => StrokePoint[]` | Catmull-Rom spline smoothing |
| `strokeIntersectsPolygon` | `(stroke, polygon) => boolean` | Any stroke point inside polygon? |
| `stampIntersectsPolygon` | `(stamp, polygon) => boolean` | Stamp center inside polygon? |

## Canvas Objects (`src/lib/canvasObjects.ts`)

### Types
```typescript
interface CanvasObjectBase { id: string; x: number; y: number; w: number; h: number }
type CanvasObject = TextBoxObject | TableObject | ImageObject | PdfObject | MathObject | ChatObject
```

The full element shapes — including `MathObject` and `ChatObject` (the v1.10 drop-in replacements for the engineering/study suite) — live in `src/lib/pageFormat.ts` as `PageElementV3` (see Persistence below).

### Factory Functions
| Function | Default Size | Description |
|----------|-------------|-------------|
| `createTextBox(x, y)` | 350 x 200 | New text box at position |
| `createTable(x, y)` | 400 x 250 | New table at position |
| `createImageObject(x, y, fileRef, w?, h?)` | 300 x 200 | New image at position |
| `stripRemovedObjects(data)` | — | Strips element types removed in v1.10 (legacy engineering/math/study tools) on hydrate |

## Canvas Renderer (`src/lib/canvasRenderer.ts`)

| Function | Description |
|----------|-------------|
| `setupCanvas(canvas, w, h)` | Set canvas dimensions with device pixel ratio |
| `drawGrid(ctx, scrollX, scrollY, w, h)` | Draw graph paper grid (1/8" minor, 1" major) |
| `drawStroke(ctx, stroke, scrollX, scrollY)` | Draw single stroke — pressure-aware width when stroke has meaningful pressure data, otherwise full configured width |
| `drawAllStrokes(ctx, strokes, scrollX, scrollY, w, h)` | Draw all strokes |
| `drawAllStamps(ctx, stamps, scrollX, scrollY)` | Draw all stamps as fillText |
| `renderStrokesToImage(strokes, padding, scale, stamps?)` | Render to PNG data URL |
| `renderLassoRegionToImage(bounds, strokes, stamps, objects, padding, scale)` | Render lasso region to PNG |

## Table Store (`src/lib/tableStore.ts`)

Module-level Maps for table cell data and text box content. Data keyed by object ID. (Note: in v3 on disk, this data is inlined into the element itself — see `TableElementV3.rows` / `TextboxElementV3.html`. The store is the in-memory bridge while the page is open.)

| Function | Description |
|----------|-------------|
| `getTableData(id)` | Get cell grid (string[][]) for table ID |
| `setTableData(id, data)` | Set cell grid for table ID |
| `getAllTableData()` | Get all tables as Record<string, string[][]> |
| `loadAllTableData(data)` | Replace all table data (page load) |
| `getTextBoxData(id)` | Get HTML content for text box ID |
| `setTextBoxData(id, data)` | Set HTML content for text box ID |
| `getAllTextBoxData()` | Get all text boxes as Record<string, string> |
| `loadAllTextBoxData(data)` | Replace all text box data (page load) |
| `setOnChangeCallback(fn)` | Register callback for auto-save triggering |

## Persistence (`src/lib/persistence.ts`, `src/lib/pageFormat.ts`)

### Page Data Format

**In-memory (`CanvasData`)** — what feature hooks read and write:
```typescript
interface CanvasData {
  version?: number
  strokes: Stroke[]
  stamps: Stamp[]
  canvasObjects: CanvasObject[]
  viewport: { scrollX: number; scrollY: number; zoom?: number }
  /** Legacy v1.9 field — empty in v1.10+, preserved for v1.9 readers. */
  panelInput: string
  /** Legacy v1.9 field — empty in v1.10+, preserved for v1.9 readers. */
  chatMessages: ChatMessage[]
  tableData: Record<string, string[][]>
  textBoxData: Record<string, string>
  lastSaved: string             // ISO date string
  excalidrawElements?: unknown[] // legacy v1 read-only
}
```

**On disk (v3 — `NoteometryPageV3`)**: a single `elements[]` tagged-union array, plus a versioned schema. Elements:

```typescript
type PageElementV3 =
  | StrokeElementV3              // { type:"stroke", id, points, color, width }
  | StampElementV3               // { type:"stamp", id, x, y, text, fontSize, color }
  | TextboxElementV3             // { type:"textbox", id, x, y, w, h, html, name? }
  | TableElementV3               // { type:"table", id, x, y, w, h, rows, name? }
  | ImageElementV3               // { type:"image", id, x, y, w, h, fileRef, name? } — fileRef is vault-relative, no base64
  | PdfElementV3                 // { type:"pdf", id, x, y, w, h, fileRef, page, name? }
  | MathElementV3                // { type:"math", id, x, y, w, h, latex, pending?, name? } (v1.10 drop-in)
  | ChatElementV3                // { type:"chat", id, x, y, w, h, attachedImage?, seedLatex?, seedText?, messages, pending?, name? } (v1.10 drop-in)
```

**Migration story:**
- v1 (legacy Excalidraw): handled by `migrateLegacy()` on startup
- v2 (separate `strokes` / `stamps` / `canvasObjects` arrays + sidecar `tableData` / `textBoxData` dicts): loaded inline, saved as v3 on next write
- v3 (current): single `elements[]`; text/table data inlined; image `fileRef` path
- v1.10.0 (within v3): legacy engineering / math-tools / study / legacy-AI element types are no longer accepted in-memory — `stripRemovedObjects` in `canvasObjects.ts` skips them on hydrate

### File Layout
```
<vault>/Noteometry/
  ELEN201/
    Week 1.nmpage
    Week 2.nmpage
    .attachments/
      <image-id>.png
      <pdf-id>.pdf
  General/
    Notes.nmpage
```

`.nmpage` is registered against `NoteometryView` via `registerExtensions(["nmpage"], VIEW_TYPE)` so clicking the file in the file explorer opens the canvas directly. Pages can live anywhere in the vault — the `Noteometry` folder is just the default landing spot.

### Functions
| Function | Description |
|----------|-------------|
| `rootDir(plugin)` | Vault-relative root folder for new pages (`vaultFolder` setting) |
| `parsePageContent(raw)` | Parse `.nmpage` JSON (v3) or legacy `.md`-wrapped JSON (v2) → `CanvasData \| null` |
| `loadPageFromFile(app, file)` | Read + parse a `.nmpage` (or legacy) `TFile` |
| `savePageToFile(app, file, data)` | Pack `CanvasData` to v3 and `vault.modify` it. Mirrors to recovery cache synchronously **before** the await |
| `cachePageDataSync(path, json)` | Write packed page JSON to `localStorage` under `nm:cache:<path>` synchronously |
| `getCachedPageData(path)` | Read from the recovery cache (used on next open if the last save didn't flush) |
| `clearPageCache(path)` | Drop the recovery cache entry (called after a successful flush) |
| `isLegacyNoteometryMdContent(raw)` | Heuristic detector for `.md`-wrapped legacy pages |
| `createNewPageFile(app, plugin, name?, parentDir?)` | Create + open a fresh `.nmpage` |
| `findLegacyMdPages(app, plugin)` | Enumerate `.md` files that are actually legacy Noteometry pages |
| `convertLegacyMdPagesToNmpage(app, plugin)` | Bulk-rename legacy pages to `.nmpage` (numeric-suffix collision handling) |
| `saveImageBytesTo(app, file, bytes)` / `savePdfBytesTo(app, file, bytes)` | Write attachment bytes to vault |
| `loadImageFromVault(app, vaultPath)` / `loadPdfFromVault(app, vaultPath)` | Read attachment bytes back |

## CanvasNav (`src/components/CanvasNav.tsx`, `src/lib/canvasNavTree.ts`)

The on-canvas Sections | Pages strip introduced in v1.14.9 (a11y in v1.14.10, event-bubble fix in v1.14.11).

### Component
```typescript
interface Props {
  app: App
  plugin: NoteometryPlugin
  /** Currently-open file, used to highlight the active section + page
   *  and to default the "+ Add page" target to the active section. */
  file: TFile | null
}
```

### Tree Helpers (`canvasNavTree.ts`)
| Export | Description |
|--------|-------------|
| `NavSection` | `{ folderPath, label, pages, isRootBucket }` — section row in the listbox |
| `NavPage` | `{ file, label }` — page row in the listbox |
| `buildNav(app, root)` | Walk the `root` folder and produce ordered `NavSection[]`. Files at the root collapse into a synthetic root bucket labelled with the actual folder name. |
| `sectionPathFor(file, sections)` | Return the section folder path that contains `file`, or `null` |
| `rootSectionLabel(root)` | The display label for the synthetic root bucket (the real folder name, not `(root)`) |

## AI (`src/lib/ai.ts`)

### Functions
| Function | Description |
|----------|-------------|
| `readInk(base64Png, settings)` | OCR: send image to vision model, extract content |
| `solve(problem, settings)` | DLP solver: structured math solving |
| `chat(messages, attachments, settings)` | Multi-turn chat with attachments |

### Return Type
```typescript
interface AIResult {
  ok: boolean
  text: string
  error?: string
}
```

### System Prompts
- **VISION_SYSTEM:** Universal content extraction (math, text, circuits, diagrams, photos)
- **DLP_SYSTEM:** Deterministic Linear Protocol v12 (structured solving)
- **CHAT_SYSTEM:** General math/engineering assistant

## Version (`src/lib/version.ts`)

```typescript
export const NOTEOMETRY_VERSION = "1.14.11";
```

Single source of truth. `tests/unit/version.test.ts` fails loudly if `manifest.json` / `package.json` / `versions.json` / this constant drift apart.

## React Components (selected)

### NoteometryApp (root)
**Props:** `{ plugin: NoteometryPlugin; app: App; file: TFile | null }`
**State:** strokes, stamps, canvasObjects, scrollX/Y, zoom, tool, activeColor, strokeWidth, inputCode, chatMessages, lassoActive, pendingSymbol, panelOpen, panelWidth, chatHeight, selectedObjectId, selectedStampId, canUndo, canRedo, ctxMenu

### InkCanvas
**Props:** strokes, stamps, tool, scrollX/Y, zoom, activeColor, strokeWidth, onStrokesChange, onStampsChange, onViewportChange, onToolChange, onEraseStart, onEraseEnd, disabled, selectedStampId
**Exports:** `CanvasTool = "select" | "pen" | "eraser" | "grab" | "line" | "arrow" | "rect" | "circle"`

### CanvasToolbar
**Props:** tool, onToolChange, lassoActive, onLassoToggle, activeColor, onColorChange, strokeWidth, onStrokeWidthChange, onInsertTextBox, onInsertTable, onInsertImage, onUndo, onRedo, canUndo, canRedo, onReadInk, isReading, onClearCanvas, onExportImage

### CanvasObjectLayer
**Props:** objects, onObjectsChange, scrollX, scrollY, zoom, tool, selectedObjectId, onSelectObject

### LassoOverlay
**Props:** active, containerRef, onCapture, onAction, onMoveComplete, onCancel
**Exports:** `LassoBounds = { points, minX, minY, maxX, maxY }`, `LassoAction = "ocr" | "move"`
**Behavior:** After capture shows floating action bar (OCR | Move | Clear). OCR calls `onCapture(imageData)`. Move calls `onMoveComplete(delta)` on drag end.

### MathPalette
**Props:** onInsert, onDragStart?, onDropStamp?
**Exports:** `shouldArmStamp(latex) => boolean` — pure-glyph vs. structural-LaTeX routing (pinned by `mathPaletteStamp.test.ts`)

### Panel
**Props:** inputCode, setInputCode, onInsertSymbol, onStampSymbol?, onDropStamp?, onSolve, onClosePanel

### ChatPanel
**Props:** messages, onSend, onClear, loading

### CanvasNav
See dedicated section above. (Replaces the old `Sidebar.tsx`, which no longer exists.)
