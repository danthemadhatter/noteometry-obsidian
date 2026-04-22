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

/* ── v1.2+ drop-in types ────────────────────────────────── */

export interface CircuitSniperObject extends CanvasObjectBase {
  type: "circuit-sniper";
  /** JSON-serialized circuit state (components + wires). */
  circuitData: string;
}

export interface UnitConverterObject extends CanvasObjectBase {
  type: "unit-converter";
  /** Active category: "resistance" | "capacitance" | "inductance" | "voltage" | "current" | "frequency" */
  category: string;
  /** Current input value as string. */
  inputValue: string;
}

export interface GraphPlotterObject extends CanvasObjectBase {
  type: "graph-plotter";
  /** Function definitions [{expr, color, enabled}] */
  functions: Array<{ expr: string; color: string; enabled: boolean }>;
  /** View window */
  viewX: number; viewY: number; viewW: number; viewH: number;
  signalLinked?: boolean;
}

export interface UnitCircleObject extends CanvasObjectBase {
  type: "unit-circle";
  /** Current angle in degrees. */
  angleDeg: number;
  signalLinked?: boolean;
}

export interface OscilloscopeObject extends CanvasObjectBase {
  type: "oscilloscope";
  /** Channel A/B configs */
  channelA: OscilloscopeChannel;
  channelB: OscilloscopeChannel;
  /** Time division in ms */
  timeDiv: number;
  signalLinked?: boolean;
}

export interface OscilloscopeChannel {
  waveform: "sine" | "square" | "triangle" | "sawtooth" | "pulse" | "noise" | "dc" | "off";
  frequency: number;
  amplitude: number;
  phase: number;
  offset: number;
}

export interface ComputeObject extends CanvasObjectBase {
  type: "compute";
  /** Named variable cells [{name, expr, value}] */
  cells: Array<{ name: string; expr: string; value: string }>;
  /** Result expression */
  resultExpr: string;
}

export interface AnimationCanvasObject extends CanvasObjectBase {
  type: "animation-canvas";
  /** Frames as data URL strings (or empty for blank frames). */
  frames: string[];
  /** Current frame index (0-based). */
  currentFrame: number;
  /** Frames per second. */
  fps: number;
}

export interface StudyGanttObject extends CanvasObjectBase {
  type: "study-gantt";
  /** Start date ISO string. */
  startDate: string;
  /** Tasks [{title, startDay, duration, color, progress}] */
  tasks: Array<{
    id: string; title: string; startDay: number; duration: number;
    color: string; progress: number;
  }>;
}

export interface AIDropinObject extends CanvasObjectBase {
  type: "ai-dropin";
  /** Whether the panel is in Chat or Solve mode. */
  mode: "chat" | "solve";
}

export interface MultimeterObject extends CanvasObjectBase {
  type: "multimeter";
  meterMode: "DCV" | "ACV" | "DCA" | "ACA" | "OHM" | "CAP" | "CONT" | "DIODE";
  inputValue: string;
}

export type CanvasObject =
  | TextBoxObject | TableObject | ImageObject | PdfObject
  | CircuitSniperObject | UnitConverterObject
  | GraphPlotterObject | UnitCircleObject | OscilloscopeObject
  | ComputeObject | AnimationCanvasObject | StudyGanttObject
  | AIDropinObject | MultimeterObject;

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

/* ── v1.2+ factory functions ─────────────────────────────── */

const DEFAULT_CHANNEL: OscilloscopeChannel = {
  waveform: "sine", frequency: 1000, amplitude: 1, phase: 0, offset: 0,
};

export function createCircuitSniper(x: number, y: number, name = "Circuit Sniper"): CircuitSniperObject {
  return { id: newObjectId(), type: "circuit-sniper", x, y, w: 500, h: 350, name, circuitData: "[]" };
}

export function createUnitConverter(x: number, y: number, name = "Unit Converter"): UnitConverterObject {
  return { id: newObjectId(), type: "unit-converter", x, y, w: 260, h: 280, name, category: "resistance", inputValue: "1" };
}

export function createGraphPlotter(x: number, y: number, name = "Graph Plotter"): GraphPlotterObject {
  return {
    id: newObjectId(), type: "graph-plotter", x, y, w: 420, h: 340, name,
    functions: [{ expr: "sin(x)", color: "#7C3AED", enabled: true }],
    viewX: -10, viewY: -2, viewW: 20, viewH: 4,
    signalLinked: false,
  };
}

export function createUnitCircle(x: number, y: number, name = "Unit Circle"): UnitCircleObject {
  return { id: newObjectId(), type: "unit-circle", x, y, w: 360, h: 380, name, angleDeg: 45, signalLinked: false };
}

export function createOscilloscope(x: number, y: number, name = "Oscilloscope"): OscilloscopeObject {
  return {
    id: newObjectId(), type: "oscilloscope", x, y, w: 480, h: 400, name,
    channelA: { ...DEFAULT_CHANNEL }, channelB: { ...DEFAULT_CHANNEL, waveform: "off" },
    timeDiv: 1, signalLinked: false,
  };
}

export function createCompute(x: number, y: number, name = "Calculator"): ComputeObject {
  return {
    id: newObjectId(), type: "compute", x, y, w: 300, h: 250, name,
    cells: [], resultExpr: "",
  };
}

export function createAnimationCanvas(x: number, y: number, name = "Animation Canvas"): AnimationCanvasObject {
  return {
    id: newObjectId(), type: "animation-canvas", x, y, w: 400, h: 350, name,
    frames: [""], currentFrame: 0, fps: 12,
  };
}

export function createStudyGantt(x: number, y: number, name = "Study Gantt"): StudyGanttObject {
  return {
    id: newObjectId(), type: "study-gantt", x, y, w: 500, h: 300, name,
    startDate: new Date().toISOString().slice(0, 10), tasks: [],
  };
}

export function createAIDropin(x: number, y: number, name = "AI Drop-in"): AIDropinObject {
  return { id: newObjectId(), type: "ai-dropin", x, y, w: 350, h: 500, name, mode: "solve" };
}

export function createMultimeter(x: number, y: number, name = "Multimeter"): MultimeterObject {
  return { id: newObjectId(), type: "multimeter", x, y, w: 280, h: 350, name, meterMode: "DCV", inputValue: "0" };
}

/** Default display name when an object has none set (old pages). */
export function defaultObjectName(obj: CanvasObject): string {
  if (obj.name && obj.name.trim()) return obj.name;
  switch (obj.type) {
    case "textbox": return "Text";
    case "table": return "Table";
    case "image": return "Image";
    case "pdf": return "PDF";
    case "circuit-sniper": return "Circuit Sniper";
    case "unit-converter": return "Unit Converter";
    case "graph-plotter": return "Graph Plotter";
    case "unit-circle": return "Unit Circle";
    case "oscilloscope": return "Oscilloscope";
    case "compute": return "Calculator";
    case "animation-canvas": return "Animation Canvas";
    case "study-gantt": return "Study Gantt";
    case "ai-dropin": return "AI Drop-in";
    case "multimeter": return "Multimeter";
  }
}
