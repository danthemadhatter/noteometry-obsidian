# Noteometry API Reference

## Core Types (`src/types.ts`)

```typescript
type AIProvider = "claude" | "lmstudio"

interface NoteometrySettings {
  aiProvider: AIProvider
  claudeApiKey: string
  claudeModel: string           // default: "claude-opus-4-20250514"
  lmStudioUrl: string           // default: "http://localhost:1234"
  lmStudioTextModel: string     // default: "qwen3-235b"
  lmStudioVisionModel: string   // default: "qwen2-vl-72b"
  vaultFolder: string           // default: "Noteometry"
  autoSave: boolean             // default: true
  autoSaveDelay: number         // default: 2000 (ms)
}

interface ChatMessage {
  role: "user" | "assistant"
  text: string
}

interface Attachment {
  name: string
  mimeType: string
  data: string                  // base64 data URL
}
```

## Ink Engine (`src/lib/inkEngine.ts`)

### Types
```typescript
interface StrokePoint { x: number; y: number; pressure: number }
interface Stroke { id: string; points: StrokePoint[]; color: string; width: number }
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
interface TextBoxObject extends CanvasObjectBase { type: "textbox" }
interface TableObject extends CanvasObjectBase { type: "table" }
interface ImageObject extends CanvasObjectBase { type: "image"; dataURL: string }
type CanvasObject = TextBoxObject | TableObject | ImageObject
```

### Factory Functions
| Function | Default Size | Description |
|----------|-------------|-------------|
| `createTextBox(x, y)` | 350 x 200 | New text box at position |
| `createTable(x, y)` | 400 x 250 | New table at position |
| `createImageObject(x, y, dataURL, w?, h?)` | 300 x 200 | New image at position |

## Canvas Renderer (`src/lib/canvasRenderer.ts`)

| Function | Description |
|----------|-------------|
| `setupCanvas(canvas, w, h)` | Set canvas dimensions with device pixel ratio |
| `drawGrid(ctx, scrollX, scrollY, w, h)` | Draw graph paper grid (1/8" minor, 1" major) |
| `drawStroke(ctx, stroke, scrollX, scrollY)` | Draw single stroke (uniform width, no pressure) |
| `drawAllStrokes(ctx, strokes, scrollX, scrollY, w, h)` | Draw all strokes |
| `drawAllStamps(ctx, stamps, scrollX, scrollY)` | Draw all stamps as fillText |
| `renderStrokesToImage(strokes, padding, scale, stamps?)` | Render to PNG data URL |
| `renderLassoRegionToImage(bounds, strokes, stamps, objects, padding, scale)` | Render lasso region to PNG |

## Table Store (`src/lib/tableStore.ts`)

Module-level Maps for table cell data and text box content. Data keyed by object ID.

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

## Persistence (`src/lib/persistence.ts`)

### Page Data Format
```typescript
interface CanvasData {
  version?: number             // 2
  strokes: Stroke[]
  stamps: Stamp[]
  canvasObjects: CanvasObject[]
  viewport: { scrollX: number; scrollY: number }
  panelInput: string
  chatMessages: ChatMessage[]
  tableData: Record<string, string[][]>
  textBoxData: Record<string, string>
  lastSaved: string            // ISO date string
}
```

### File Structure
```
<vault>/Noteometry/
  General/
    Page 1.md         ← JSON data inside .md file
    Page 2.md
  ELEN201/
    Week 1.md
    Week 2.md
```

### Functions
| Function | Description |
|----------|-------------|
| `listSections(plugin)` | List all section folders |
| `createSection(plugin, name)` | Create section folder |
| `deleteSection(plugin, name)` | Delete section and all pages |
| `listPages(plugin, section)` | List all pages in section |
| `createPage(plugin, section, name)` | Create empty page file |
| `deletePage(plugin, section, name)` | Delete page file |
| `loadPage(plugin, section, name)` | Load and parse page data |
| `savePage(plugin, section, name, data)` | Save page data as JSON |
| `migrateJsonToMd(plugin)` | Rename .json files to .md |
| `migrateLegacy(plugin)` | Migrate old canvas.json format |
| `saveImageToVault(plugin, section, id, base64)` | Save image as vault file, returns vault path |
| `loadImageFromVault(plugin, vaultPath)` | Load vault image, returns base64 data URL |
| `migrateBase64Images(plugin, section, canvasObjects)` | Migrate legacy base64 images to vault files |

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

## React Components

### NoteometryApp (root)
**Props:** `{ plugin: NoteometryPlugin; app: App }`
**State:** strokes, stamps, canvasObjects, scrollX/Y, tool, activeColor, strokeWidth, inputCode, chatMessages, lassoActive, pendingSymbol, panelOpen, panelWidth, chatHeight, currentSection, currentPage, selectedObjectId, selectedStampId, canUndo, canRedo

### InkCanvas
**Props:** strokes, stamps, tool, scrollX/Y, activeColor, strokeWidth, onStrokesChange, onStampsChange, onViewportChange, onToolChange, onEraseStart, onEraseEnd, disabled, selectedStampId
**Exports:** `CanvasTool = "select" | "pen" | "eraser" | "grab" | "line" | "arrow" | "rect" | "circle"`

### CanvasToolbar
**Props:** tool, onToolChange, lassoActive, onLassoToggle, activeColor, onColorChange, strokeWidth, onStrokeWidthChange, onInsertTextBox, onInsertTable, onInsertImage, onUndo, onRedo, canUndo, canRedo, onReadInk, isReading, onClearCanvas, onExportImage

### CanvasObjectLayer
**Props:** objects, onObjectsChange, scrollX, scrollY, tool, selectedObjectId, onSelectObject

### LassoOverlay
**Props:** active, containerRef, onCapture, onAction, onMoveComplete, onCancel
**Exports:** `LassoBounds = { points, minX, minY, maxX, maxY }`, `LassoAction = "ocr" | "move"`
**Behavior:** After capture shows floating action bar (OCR | Move). OCR calls `onCapture(imageData)`. Move calls `onMoveComplete(delta)` on drag end.

### MathPalette
**Props:** onInsert, onDragStart?, onDropStamp?

### Panel
**Props:** inputCode, setInputCode, onInsertSymbol, onStampSymbol?, onDropStamp?, onSolve, onClosePanel

### ChatPanel
**Props:** messages, onSend, onClear, loading

### Sidebar
**Props:** plugin, currentSection, currentPage, onSelect
