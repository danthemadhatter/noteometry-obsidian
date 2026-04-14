/**
 * Noteometry page format — pure data types and conversion functions.
 *
 * This module has zero runtime dependencies on Obsidian, React, or any
 * I/O layer. That lets it be unit-tested directly without module-resolution
 * gymnastics, and it enforces a clean boundary between "what goes on disk"
 * and "how we actually read/write the disk".
 *
 * persistence.ts owns the I/O layer and imports from here.
 */
import type { Stroke, StrokePoint, Stamp } from "./inkEngine";
import type { CanvasObject, RelativeStroke, CircuitElement, ChannelConfig } from "./canvasObjects";
import type { ChatMessage } from "../types";

/**
 * In-memory page data shape. This is what the feature hooks read and write.
 * Stable across format versions — the persistence layer converts between
 * this and whatever format is on disk.
 */
export interface CanvasData {
  version?: number;
  strokes: Stroke[];
  stamps: Stamp[];
  canvasObjects: CanvasObject[];
  viewport: { scrollX: number; scrollY: number; zoom?: number };
  panelInput: string;
  chatMessages: ChatMessage[];
  tableData: Record<string, string[][]>;
  textBoxData: Record<string, string>;
  lastSaved: string;
  // Legacy fields (read-only, for migration)
  excalidrawElements?: unknown[];
}

export const EMPTY_PAGE: CanvasData = {
  strokes: [],
  stamps: [],
  canvasObjects: [],
  viewport: { scrollX: 0, scrollY: 0 },
  panelInput: "",
  chatMessages: [],
  tableData: {},
  textBoxData: {},
  lastSaved: "",
};

/* ══════════════════════════════════════════════════════════════════════
 * v3 PAGE FORMAT
 *
 * Single `elements[]` tagged-union array + versioned schema + inlined
 * element data. This is what gets written to disk. Feature hooks still
 * use CanvasData (above) internally — the pack/unpack helpers bridge the
 * two shapes.
 *
 * Migration story:
 *   - v1 (legacy Excalidraw): handled by migrateLegacy() on startup
 *   - v2 (separate strokes/stamps/canvasObjects arrays + sidecar
 *        tableData/textBoxData dictionaries): loaded inline, saved as v3
 *        on next write
 *   - v3 (current): single elements[] array; text/table data inlined
 *        into their elements; image fileRef path (no more base64)
 *
 * Loading any version returns CanvasData; saving always writes v3.
 * Untouched v2 files remain v2 on disk until they are next modified.
 * ══════════════════════════════════════════════════════════════════════
 */

export const V3_SOURCE_TAG = "noteometry-1.3.0";

export interface StrokeElementV3 {
  type: "stroke";
  id: string;
  points: StrokePoint[];
  color: string;
  width: number;
}

export interface StampElementV3 {
  type: "stamp";
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  /** P2-8: Sub/superscript mode. Omitted when 'norm' (default). */
  scriptMode?: 'norm' | 'sub' | 'super';
}

export interface TextboxElementV3 {
  type: "textbox";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rich-text HTML content (was previously in the textBoxData sidecar dict) */
  html: string;
  /** User-editable display name. Optional for back-compat with old pages. */
  name?: string;
}

export interface TableElementV3 {
  type: "table";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Row-by-column cell strings (was previously in the tableData sidecar dict) */
  rows: string[][];
  name?: string;
}

export interface ImageElementV3 {
  type: "image";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Vault-relative path to the PNG file (never a data: URL). */
  fileRef: string;
  name?: string;
}

export interface PdfElementV3 {
  type: "pdf";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Vault-relative path to the PDF file (binary, stored in attachments). */
  fileRef: string;
  /** Current page (1-based). Restored on reload so the user lands on
   * whichever page they were studying. */
  page: number;
  name?: string;
}

export interface ImageAnnotatorElementV3 {
  type: "image-annotator";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  imagePath: string;
  imageAspectRatio: number;
  strokes: RelativeStroke[];
  name?: string;
}

export interface FormulaCardElementV3 {
  type: "formula-card";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  latex: string;
  bgColor: string;
  fontSize: number;
  name?: string;
}

export interface UnitConverterElementV3 {
  type: "unit-converter";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  activeCategory: string;
  values: Record<string, number | null>;
  name?: string;
}

export interface CircuitSniperElementV3 {
  type: "circuit-sniper";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  elements: CircuitElement[];
  name?: string;
}

export interface GraphPlotterElementV3 {
  type: "graph-plotter";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  functions: { expr: string; color: string; enabled: boolean }[];
  xMin: number;
  xMax: number;
  yMin: number | null;
  yMax: number | null;
  name?: string;
}

export interface UnitCircleElementV3 {
  type: "unit-circle";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  angleDeg: number;
  name?: string;
}

export interface OscilloscopeElementV3 {
  type: "oscilloscope";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  channelA: ChannelConfig;
  channelB: ChannelConfig;
  timeDivIndex: number;
  running: boolean;
  name?: string;
}

export type PageElementV3 =
  | StrokeElementV3
  | StampElementV3
  | TextboxElementV3
  | TableElementV3
  | ImageElementV3
  | PdfElementV3
  | ImageAnnotatorElementV3
  | FormulaCardElementV3
  | UnitConverterElementV3
  | CircuitSniperElementV3
  | GraphPlotterElementV3
  | UnitCircleElementV3
  | OscilloscopeElementV3;

export interface NoteometryPageV3 {
  type: "noteometry-page";
  version: 3;
  source: string;
  elements: PageElementV3[];
  viewport: {
    scrollX: number;
    scrollY: number;
    zoom: number;
  };
  pipeline: {
    panelInput: string;
    /** Phase 3 will introduce structured run history here. For now: chat messages. */
    chatMessages: ChatMessage[];
  };
  lastSaved: string;
}

/**
 * Pack a CanvasData into the v3 on-disk shape. Merges strokes, stamps,
 * and canvasObjects into a single elements[] array, inlining text/table
 * sidecar data into their elements.
 */
export function packToV3(data: CanvasData): NoteometryPageV3 {
  const elements: PageElementV3[] = [];
  const tableData = data.tableData ?? {};
  const textBoxData = data.textBoxData ?? {};

  for (const s of data.strokes ?? []) {
    elements.push({
      type: "stroke",
      id: s.id,
      points: s.points,
      color: s.color,
      width: s.width,
    });
  }

  for (const s of data.stamps ?? []) {
    const stampEl: StampElementV3 = {
      type: "stamp",
      id: s.id,
      x: s.x,
      y: s.y,
      text: s.text,
      fontSize: s.fontSize,
      color: s.color,
    };
    // P2-8: Only persist scriptMode if non-default (keeps v3 files lean)
    if (s.scriptMode && s.scriptMode !== 'norm') {
      stampEl.scriptMode = s.scriptMode;
    }
    elements.push(stampEl);
  }

  for (const obj of data.canvasObjects ?? []) {
    if (obj.type === "textbox") {
      elements.push({
        type: "textbox",
        id: obj.id,
        x: obj.x, y: obj.y, w: obj.w, h: obj.h,
        html: textBoxData[obj.id] ?? "",
        name: obj.name,
      });
    } else if (obj.type === "table") {
      elements.push({
        type: "table",
        id: obj.id,
        x: obj.x, y: obj.y, w: obj.w, h: obj.h,
        rows: tableData[obj.id] ?? [],
        name: obj.name,
      });
    } else if (obj.type === "image") {
      elements.push({
        type: "image",
        id: obj.id,
        x: obj.x, y: obj.y, w: obj.w, h: obj.h,
        fileRef: obj.dataURL,
        name: obj.name,
      });
    } else if (obj.type === "pdf") {
      elements.push({
        type: "pdf",
        id: obj.id,
        x: obj.x, y: obj.y, w: obj.w, h: obj.h,
        fileRef: obj.fileRef,
        page: obj.page,
        name: obj.name,
      });
    } else if (obj.type === "image-annotator") {
      elements.push({
        type: "image-annotator",
        id: obj.id,
        x: obj.x, y: obj.y, w: obj.w, h: obj.h,
        imagePath: obj.imagePath,
        imageAspectRatio: obj.imageAspectRatio,
        strokes: obj.strokes,
        name: obj.name,
      });
    } else if (obj.type === "formula-card") {
      elements.push({
        type: "formula-card",
        id: obj.id,
        x: obj.x, y: obj.y, w: obj.w, h: obj.h,
        latex: obj.latex,
        bgColor: obj.bgColor,
        fontSize: obj.fontSize,
        name: obj.name,
      });
    } else if (obj.type === "unit-converter") {
      elements.push({
        type: "unit-converter",
        id: obj.id,
        x: obj.x, y: obj.y, w: obj.w, h: obj.h,
        activeCategory: obj.activeCategory,
        values: obj.values,
        name: obj.name,
      });
    } else if (obj.type === "circuit-sniper") {
      elements.push({
        type: "circuit-sniper",
        id: obj.id,
        x: obj.x, y: obj.y, w: obj.w, h: obj.h,
        elements: obj.elements,
        name: obj.name,
      });
    } else if (obj.type === "graph-plotter") {
      elements.push({
        type: "graph-plotter",
        id: obj.id,
        x: obj.x, y: obj.y, w: obj.w, h: obj.h,
        functions: obj.functions,
        xMin: obj.xMin, xMax: obj.xMax,
        yMin: obj.yMin, yMax: obj.yMax,
        name: obj.name,
      });
    } else if (obj.type === "unit-circle") {
      elements.push({
        type: "unit-circle",
        id: obj.id,
        x: obj.x, y: obj.y, w: obj.w, h: obj.h,
        angleDeg: obj.angleDeg,
        name: obj.name,
      });
    } else if (obj.type === "oscilloscope") {
      elements.push({
        type: "oscilloscope",
        id: obj.id,
        x: obj.x, y: obj.y, w: obj.w, h: obj.h,
        channelA: obj.channelA,
        channelB: obj.channelB,
        timeDivIndex: obj.timeDivIndex,
        running: obj.running,
        name: obj.name,
      });
    }
  }

  return {
    type: "noteometry-page",
    version: 3,
    source: V3_SOURCE_TAG,
    elements,
    viewport: {
      scrollX: data.viewport?.scrollX ?? 0,
      scrollY: data.viewport?.scrollY ?? 0,
      zoom: data.viewport?.zoom ?? 1.0,
    },
    pipeline: {
      panelInput: data.panelInput ?? "",
      chatMessages: data.chatMessages ?? [],
    },
    lastSaved: data.lastSaved ?? "",
  };
}

/**
 * Unpack a v3 page into the legacy CanvasData shape that hooks consume.
 * Splits elements[] back into separate strokes/stamps/canvasObjects
 * arrays and rebuilds the tableData/textBoxData sidecar dictionaries.
 */
export function unpackFromV3(v3: NoteometryPageV3): CanvasData {
  const strokes: Stroke[] = [];
  const stamps: Stamp[] = [];
  const canvasObjects: CanvasObject[] = [];
  const tableData: Record<string, string[][]> = {};
  const textBoxData: Record<string, string> = {};

  for (const el of v3.elements ?? []) {
    switch (el.type) {
      case "stroke":
        strokes.push({
          id: el.id,
          points: el.points,
          color: el.color,
          width: el.width,
        });
        break;
      case "stamp":
        stamps.push({
          id: el.id,
          x: el.x, y: el.y,
          text: el.text,
          fontSize: el.fontSize,
          color: el.color,
          // P2-8: Restore scriptMode (undefined ≡ 'norm')
          ...(el.scriptMode ? { scriptMode: el.scriptMode } : {}),
        });
        break;
      case "textbox":
        canvasObjects.push({
          id: el.id,
          type: "textbox",
          x: el.x, y: el.y, w: el.w, h: el.h,
          name: el.name,
        });
        textBoxData[el.id] = el.html;
        break;
      case "table":
        canvasObjects.push({
          id: el.id,
          type: "table",
          x: el.x, y: el.y, w: el.w, h: el.h,
          name: el.name,
        });
        tableData[el.id] = el.rows;
        break;
      case "image":
        canvasObjects.push({
          id: el.id,
          type: "image",
          x: el.x, y: el.y, w: el.w, h: el.h,
          dataURL: el.fileRef,
          name: el.name,
        });
        break;
      case "pdf":
        canvasObjects.push({
          id: el.id,
          type: "pdf",
          x: el.x, y: el.y, w: el.w, h: el.h,
          fileRef: el.fileRef,
          page: el.page ?? 1,
          name: el.name,
        });
        break;
      case "image-annotator":
        canvasObjects.push({
          id: el.id,
          type: "image-annotator",
          x: el.x, y: el.y, w: el.w, h: el.h,
          imagePath: el.imagePath,
          imageAspectRatio: el.imageAspectRatio ?? 4 / 3,
          strokes: el.strokes ?? [],
          name: el.name,
        });
        break;
      case "formula-card":
        canvasObjects.push({
          id: el.id,
          type: "formula-card",
          x: el.x, y: el.y, w: el.w, h: el.h,
          latex: el.latex ?? "",
          bgColor: el.bgColor ?? "#FFF9C4",
          fontSize: el.fontSize ?? 18,
          name: el.name,
        });
        break;
      case "unit-converter":
        canvasObjects.push({
          id: el.id,
          type: "unit-converter",
          x: el.x, y: el.y, w: el.w, h: el.h,
          activeCategory: el.activeCategory ?? "resistance",
          values: el.values ?? {},
          name: el.name,
        });
        break;
      case "circuit-sniper":
        canvasObjects.push({
          id: el.id,
          type: "circuit-sniper",
          x: el.x, y: el.y, w: el.w, h: el.h,
          elements: el.elements ?? [],
          name: el.name,
        });
        break;
      case "graph-plotter":
        canvasObjects.push({
          id: el.id,
          type: "graph-plotter",
          x: el.x, y: el.y, w: el.w, h: el.h,
          functions: el.functions ?? [{ expr: "sin(x)", color: "#4A90D9", enabled: true }],
          xMin: el.xMin ?? -10,
          xMax: el.xMax ?? 10,
          yMin: el.yMin ?? null,
          yMax: el.yMax ?? null,
          name: el.name,
        });
        break;
      case "unit-circle":
        canvasObjects.push({
          id: el.id,
          type: "unit-circle",
          x: el.x, y: el.y, w: el.w, h: el.h,
          angleDeg: el.angleDeg ?? 45,
          name: el.name,
        });
        break;
      case "oscilloscope": {
        const defaultCh = {
          waveform: "sine" as const,
          frequency: 1000, amplitude: 1.0, phase: 0, dcOffset: 0,
          voltsDivIndex: 3, visible: true, yOffset: 0,
        };
        canvasObjects.push({
          id: el.id,
          type: "oscilloscope",
          x: el.x, y: el.y, w: el.w, h: el.h,
          channelA: el.channelA ?? { ...defaultCh },
          channelB: el.channelB ?? { ...defaultCh, waveform: "off", visible: false },
          timeDivIndex: el.timeDivIndex ?? 4,
          running: el.running ?? true,
          name: el.name,
        });
        break;
      }
    }
  }

  return {
    strokes,
    stamps,
    canvasObjects,
    viewport: {
      scrollX: v3.viewport?.scrollX ?? 0,
      scrollY: v3.viewport?.scrollY ?? 0,
      zoom: v3.viewport?.zoom ?? 1.0,
    },
    panelInput: v3.pipeline?.panelInput ?? "",
    chatMessages: v3.pipeline?.chatMessages ?? [],
    tableData,
    textBoxData,
    lastSaved: v3.lastSaved ?? "",
  };
}

/** Type guard: is this parsed JSON a v3 Noteometry page? */
export function isV3Page(parsed: unknown): parsed is NoteometryPageV3 {
  if (!parsed || typeof parsed !== "object") return false;
  const obj = parsed as Record<string, unknown>;
  return obj.version === 3 && obj.type === "noteometry-page" && Array.isArray(obj.elements);
}
