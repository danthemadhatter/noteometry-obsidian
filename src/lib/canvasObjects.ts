/* ── Canvas Objects ─────────────────────────────────────
   Positioned objects on the canvas: text boxes, tables, images.
   These render as DOM overlays above the ink layer.
   ──────────────────────────────────────────────────────── */

export interface CanvasObjectBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** User-editable display name shown in the drag handle. Defaults to
   * the type (Text / Table / Image / PDF) when the object is created.
   * Optional so old pages load without migration. */
  name?: string;
}

export interface TextBoxObject extends CanvasObjectBase {
  type: "textbox";
}

export interface TableObject extends CanvasObjectBase {
  type: "table";
}

export interface ImageObject extends CanvasObjectBase {
  type: "image";
  dataURL: string;
}

export interface PdfObject extends CanvasObjectBase {
  type: "pdf";
  /** Vault-relative path to the PDF file. Stored in the attachments dir
   * next to images. Never a base64 data URL — PDFs are far too big for
   * that to make sense. */
  fileRef: string;
  /** Current page being rendered (1-based). Saved with the object so the
   * user returns to the same page after reload. */
  page: number;
}

/* ── New drop-in types (v1.3.0) ──────────────────────── */

/** Relative stroke for Image Annotator — coordinates are 0.0–1.0
 *  fractions of the annotation area so they survive resizing. */
export interface RelativeStroke {
  points: { x: number; y: number; pressure: number }[];
  color: string;
  width: number;
}

export interface ImageAnnotatorObject extends CanvasObjectBase {
  type: "image-annotator";
  /** Vault-relative path to the source image, or a data: URL for camera roll imports. */
  imagePath: string;
  /** Width/height ratio of the source image, used for letterboxing. */
  imageAspectRatio: number;
  /** Annotation strokes stored in normalized 0.0–1.0 coordinates. */
  strokes: RelativeStroke[];
}

export interface FormulaCardObject extends CanvasObjectBase {
  type: "formula-card";
  /** Raw LaTeX source string. */
  latex: string;
  /** Background hex color. */
  bgColor: string;
  /** KaTeX display font size in px. */
  fontSize: number;
}

export interface UnitConverterObject extends CanvasObjectBase {
  type: "unit-converter";
  /** Currently selected category tab. */
  activeCategory: string;
  /** Per-category SI-base value last entered (null if cleared). */
  values: Record<string, number | null>;
}

/** Circuit element stored in the Circuit Sniper schematic. */
export interface CircuitElement {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation: number;
  label: string;
  value: string;
  /** Wire-only fields */
  from?: { elId?: string; pinId?: string; x: number; y: number };
  to?: { elId?: string; pinId?: string; x: number; y: number };
}

export interface CircuitSniperObject extends CanvasObjectBase {
  type: "circuit-sniper";
  /** Schematic elements (components + wires). */
  elements: CircuitElement[];
}

/* ── New math drop-in types (v1.4.0) ───────────────── */

export interface GraphPlotterObject extends CanvasObjectBase {
  type: "graph-plotter";
  functions: { expr: string; color: string; enabled: boolean }[];
  xMin: number;
  xMax: number;
  yMin: number | null;
  yMax: number | null;
  /** When true this drop-in is linked to the shared signal bus. */
  signalLinked?: boolean;
}

export interface UnitCircleObject extends CanvasObjectBase {
  type: "unit-circle";
  angleDeg: number;
  /** When true this drop-in is linked to the shared signal bus. */
  signalLinked?: boolean;
}

export interface ChannelConfig {
  waveform: "sine" | "square" | "sawtooth" | "triangle" | "pulse" | "dc" | "off";
  frequency: number;
  amplitude: number;
  phase: number;
  dcOffset: number;
  voltsDivIndex: number;
  visible: boolean;
  yOffset: number;
}

export interface OscilloscopeObject extends CanvasObjectBase {
  type: "oscilloscope";
  channelA: ChannelConfig;
  channelB: ChannelConfig;
  timeDivIndex: number;
  running: boolean;
  /** When true this drop-in is linked to the shared signal bus. */
  signalLinked?: boolean;
}

/* ── New drop-in types (v1.5.0) ──────────────────────── */

export interface AnimationPath {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface AnimationFrame {
  id: string;
  paths: AnimationPath[];
}

export interface AnimationCanvasObject extends CanvasObjectBase {
  type: "animation-canvas";
  frames: AnimationFrame[];
  currentFrame: number;
  fps: number;
  playing: boolean;
}

export interface GanttTask {
  id: string;
  label: string;
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string;
  color: string;
  progress: number; // 0–100
}

export interface StudyGanttObject extends CanvasObjectBase {
  type: "study-gantt";
  tasks: GanttTask[];
  startDate: string; // ISO date string — left edge of chart
}

export type CanvasObject =
  | TextBoxObject
  | TableObject
  | ImageObject
  | PdfObject
  | ImageAnnotatorObject
  | FormulaCardObject
  | UnitConverterObject
  | CircuitSniperObject
  | GraphPlotterObject
  | UnitCircleObject
  | OscilloscopeObject
  | AnimationCanvasObject
  | StudyGanttObject;

export function newObjectId(): string {
  return crypto.randomUUID();
}

export function createTextBox(x: number, y: number, name: string = "Text"): TextBoxObject {
  return { id: newObjectId(), type: "textbox", x, y, w: 350, h: 200, name };
}

export function createTable(x: number, y: number, name: string = "Table"): TableObject {
  return { id: newObjectId(), type: "table", x, y, w: 400, h: 250, name };
}

export function createImageObject(
  x: number, y: number,
  dataURL: string,
  w: number = 300, h: number = 200,
  name: string = "Image"
): ImageObject {
  return { id: newObjectId(), type: "image", x, y, w, h, dataURL, name };
}

export function createPdfObject(
  x: number, y: number,
  fileRef: string,
  w: number = 560, h: number = 720,
  name: string = "PDF"
): PdfObject {
  return { id: newObjectId(), type: "pdf", x, y, w, h, fileRef, page: 1, name };
}

export function createImageAnnotator(
  x: number, y: number,
  imagePath: string = "",
  w: number = 320, h: number = 260,
  name: string = "Image Annotator"
): ImageAnnotatorObject {
  return {
    id: newObjectId(), type: "image-annotator", x, y, w, h, name,
    imagePath, imageAspectRatio: 4 / 3, strokes: [],
  };
}

export function createFormulaCard(
  x: number, y: number,
  name: string = "Formula"
): FormulaCardObject {
  return {
    id: newObjectId(), type: "formula-card", x, y,
    w: 240, h: 100, name,
    latex: "", bgColor: "#FFF9C4", fontSize: 18,
  };
}

export function createUnitConverter(
  x: number, y: number,
  name: string = "Unit Converter"
): UnitConverterObject {
  return {
    id: newObjectId(), type: "unit-converter", x, y,
    w: 240, h: 300, name,
    activeCategory: "resistance", values: {},
  };
}

export function createCircuitSniper(
  x: number, y: number,
  name: string = "Circuit Sniper"
): CircuitSniperObject {
  return {
    id: newObjectId(), type: "circuit-sniper", x, y,
    w: 600, h: 500, name,
    elements: [],
  };
}

const DEFAULT_CHANNEL: ChannelConfig = {
  waveform: "sine",
  frequency: 1000,
  amplitude: 1.0,
  phase: 0,
  dcOffset: 0,
  voltsDivIndex: 3, // 1V/div
  visible: true,
  yOffset: 0,
};

export function createGraphPlotter(
  x: number, y: number,
  name: string = "Graph Plotter"
): GraphPlotterObject {
  return {
    id: newObjectId(), type: "graph-plotter", x, y,
    w: 480, h: 380, name,
    functions: [{ expr: "sin(x)", color: "#4A90D9", enabled: true }],
    xMin: -10, xMax: 10, yMin: null, yMax: null,
  };
}

export function createUnitCircle(
  x: number, y: number,
  name: string = "Unit Circle"
): UnitCircleObject {
  return {
    id: newObjectId(), type: "unit-circle", x, y,
    w: 380, h: 320, name,
    angleDeg: 45,
  };
}

export function createOscilloscope(
  x: number, y: number,
  name: string = "Oscilloscope"
): OscilloscopeObject {
  return {
    id: newObjectId(), type: "oscilloscope", x, y,
    w: 520, h: 420, name,
    channelA: { ...DEFAULT_CHANNEL },
    channelB: { ...DEFAULT_CHANNEL, waveform: "off", visible: false },
    timeDivIndex: 4, // 1ms/div
    running: true,
  };
}

export function createAnimationCanvas(
  x: number, y: number,
  name: string = "Animation Canvas"
): AnimationCanvasObject {
  return {
    id: newObjectId(), type: "animation-canvas", x, y,
    w: 400, h: 320, name,
    frames: [{ id: crypto.randomUUID(), paths: [] }],
    currentFrame: 0,
    fps: 12,
    playing: false,
  };
}

export function createStudyGantt(
  x: number, y: number,
  name: string = "Study Gantt"
): StudyGanttObject {
  return {
    id: newObjectId(), type: "study-gantt", x, y,
    w: 500, h: 280, name,
    tasks: [],
    startDate: new Date().toISOString().slice(0, 10),
  };
}

/** Default display name when an object has none set (old pages). */
export function defaultObjectName(obj: CanvasObject): string {
  if (obj.name && obj.name.trim()) return obj.name;
  switch (obj.type) {
    case "textbox": return "Text";
    case "table": return "Table";
    case "image": return "Image";
    case "pdf": return "PDF";
    case "image-annotator": return "Image Annotator";
    case "formula-card": return "Formula";
    case "unit-converter": return "Unit Converter";
    case "circuit-sniper": return "Circuit Sniper";
    case "graph-plotter": return "Graph Plotter";
    case "unit-circle": return "Unit Circle";
    case "oscilloscope": return "Oscilloscope";
    case "animation-canvas": return "Animation Canvas";
    case "study-gantt": return "Study Gantt";
  }
}
