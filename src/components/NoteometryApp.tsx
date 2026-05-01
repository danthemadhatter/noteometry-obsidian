import React, { useState, useRef, useEffect, useCallback } from "react";
import { App, Notice } from "obsidian";
import type NoteometryPlugin from "../main";
import { stampBBox, newStampId, STAMP_SIZES, type StampSize } from "../lib/inkEngine";
import { renderStrokesToImage } from "../lib/canvasRenderer";
import {
  createTextBox, createTable, createImageObject, createPdfObject,
  createCircuitSniper, createUnitConverter, createGraphPlotter,
  createUnitCircle, createOscilloscope, createCompute,
  createAnimationCanvas, createStudyGantt,
  createMultimeter,
} from "../lib/canvasObjects";
import {
  savePageByPath,
  saveImageToVaultByPath,
  savePdfToVaultByPath,
  CanvasData,
} from "../lib/persistence";
import InkCanvas, { CanvasTool } from "./InkCanvas";
// CanvasToolbar removed — all tools now live in the right-click context menu
import CanvasObjectLayer from "./CanvasObjectLayer";
import Panel from "./Panel";
import ChatPanel from "./ChatPanel";
import SidebarTree from "./SidebarTree";
import LassoOverlay from "./LassoOverlay";
import type { LassoBounds } from "./LassoOverlay";
import ContextMenu from "./ContextMenu";
import type { ContextMenuItem } from "./ContextMenu";
import { buildClearCanvasAction, CLEAR_CANVAS_LABEL } from "../lib/canvasMenuActions";
import MathPalette from "./MathPalette";
import type { CanvasObject } from "../lib/canvasObjects";
import { makePastedObject } from "../lib/objectClipboard";
import { getAllTableData, loadAllTableData, getAllTextBoxData, loadAllTextBoxData, setOnChangeCallback, setTextBoxData } from "../lib/tableStore";
import { shouldYieldToNativeScroll } from "../lib/wheelRouting";
import { useInk } from "../features/ink/useInk";
import { useLassoStack } from "../features/lasso/useLassoStack";
import type { LassoRegion } from "../features/lasso/useLassoStack";
import { useObjects } from "../features/objects/useObjects";
import { usePipeline } from "../features/pipeline/usePipeline";
import { usePages } from "../features/pages/usePages";
import { rasterizeRegion } from "../features/lasso/rasterize";
import { compositeRegions } from "../features/lasso/composite";
import {
  regionsToWorldSelection,
  selectionIsEmpty,
  deleteStrokesInPolygons,
  deleteStampsInPolygons,
  deleteObjectsInBounds,
  moveStrokesInPolygon,
  moveStampsInPolygon,
  moveObjectsInBounds,
  polygonToWorld,
  boundsToWorld,
} from "../features/lasso/selection";

/* ── Color and width presets for context-menu cycling ───────────── */
const INK_COLORS = [
  { color: "#202124", label: "Black" },
  { color: "#d93025", label: "Red" },
  { color: "#1a73e8", label: "Blue" },
  { color: "#188038", label: "Green" },
  { color: "#e8710a", label: "Orange" },
  { color: "#9334e6", label: "Purple" },
];

const STROKE_WIDTHS = [
  { width: 1.5, label: "Fine" },
  { width: 3, label: "Medium" },
  { width: 5, label: "Thick" },
  { width: 8, label: "Marker" },
];

interface Props {
  plugin: NoteometryPlugin;
  app: App;
}

/** Called by NoteometryView.onClose to flush pending saves */
export let flushSave: (() => Promise<void>) | null = null;

export default function NoteometryApp({ plugin, app }: Props) {
  /* ── Ink feature: strokes, stamps, tool, color, width, undo/redo ─── */
  const {
    strokes, stamps, tool, activeColor, strokeWidth,
    selectedStampId, pendingSymbol, canUndo, canRedo,
    setStrokes, setStamps, setTool, setActiveColor, setStrokeWidth,
    setSelectedStampId, setPendingSymbol,
    handleStrokesChange, handleStampsChange,
    pushUndo, handleUndo, handleRedo, hydrate: hydrateInk,
    onEraseStart, onEraseEnd,
  } = useInk();

  /* ── Lasso stack feature: multi-region selection ─── */
  const {
    lassoActive, lassoMode, setLassoActive, setLassoMode, regions: lassoRegions,
    pushRegion, clearStack, toggleLasso,
  } = useLassoStack();

  /* ── Double-click / double-tap tool cycle ──────────────
   * Used by both Apple Pencil double-tap (iPad) and mouse double-click
   * (Mac). Cycles: pen → eraser → rect-lasso → pen. Lasso is included
   * because Dan explicitly wanted a keyboard-free way to jump between
   * the three core canvas modes without digging in the toolbar. */
  const handleCycleTool = useCallback(() => {
    if (lassoActive) {
      // Currently in a lasso mode → return to pen
      setLassoActive(false);
      setTool("pen");
    } else if (tool === "eraser") {
      // Eraser → rect lasso (start in rect mode, which is more useful
      // than freehand for the typical "crop a dropped image" flow)
      setTool("pen");
      setLassoMode("rect");
      setLassoActive(true);
    } else {
      // pen / grab / select / shapes → eraser
      setTool("eraser");
    }
  }, [lassoActive, tool, setLassoActive, setLassoMode]);

  /* ── Objects feature: canvas objects + selection ─── */
  const {
    canvasObjects, selectedObjectId,
    setCanvasObjects, setSelectedObjectId,
    hydrate: hydrateObjects,
  } = useObjects();

  /* ── Pipeline feature: panel input + chat + READ INK + solve ─── */
  const {
    inputCode, chatMessages, isReading, chatLoading,
    setInputCode, setChatMessages,
    sendToChat, stopChat, processCrop, handleSolveInput, handleInsertSymbol,
    hydrate: hydratePipeline,
  } = usePipeline(plugin);

  /* ── Composition-layer state ─── */
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [zoomLocked, setZoomLocked] = useState(false);
  // viewportRef = the drawing surface inside the canvas area.
  // Lasso, rasterization, and zoom wheel events all key off this.
  const viewportRef = useRef<HTMLDivElement>(null);

  // Zoom controls — bounds and step.
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 4.0;
  const ZOOM_STEP = 0.1;

  const clampZoom = useCallback((z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)), []);

  const zoomIn = useCallback(() => {
    if (zoomLocked) return;
    setZoom((z) => clampZoom(Math.round((z + ZOOM_STEP) * 100) / 100));
  }, [zoomLocked, clampZoom]);

  const zoomOut = useCallback(() => {
    if (zoomLocked) return;
    setZoom((z) => clampZoom(Math.round((z - ZOOM_STEP) * 100) / 100));
  }, [zoomLocked, clampZoom]);

  const resetZoom = useCallback(() => {
    if (zoomLocked) return;
    setZoom(1);
  }, [zoomLocked]);

  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  /* ── Context menu (right-click) state ────────────────── */
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  /* Internal clipboard for cut/copy of canvas objects. Stores a deep
   * clone so later edits to the original don't mutate the clipboard. */
  const objectClipboardRef = useRef<CanvasObject | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Swipe blocking is handled in NoteometryView.ts at the view boundary

  // Clear canvas object selection when switching away from select tool.
  // (Stamp selection is cleared inside useInk.)
  useEffect(() => {
    if (tool !== "select") {
      setSelectedObjectId(null);
    }
  }, [tool]);

  // Keyboard delete for selected objects AND stamps
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target as HTMLElement)?.tagName;
        const editable = (e.target as HTMLElement)?.isContentEditable;
        if (tag === "INPUT" || tag === "TEXTAREA" || editable) return;

        if (selectedObjectId) {
          e.preventDefault();
          setCanvasObjects(prev => prev.filter(o => o.id !== selectedObjectId));
          setSelectedObjectId(null);
        } else if (selectedStampId) {
          e.preventDefault();
          setStamps(prev => prev.filter(s => s.id !== selectedStampId));
          setSelectedStampId(null);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedObjectId, selectedStampId]);

  // Click canvas to place pending symbol, select stamps, or deselect
  const handleCanvasAreaClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".noteometry-canvas-object")) return;

    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left + scrollX;
    const clickY = e.clientY - rect.top + scrollY;

    // Place pending symbol from palette (tap to place on touch devices)
    if (pendingSymbol) {
      setStamps(prev => [...prev, {
        id: newStampId(), x: clickX, y: clickY,
        text: pendingSymbol, fontSize: 96, color: activeColor,
      }]);
      setPendingSymbol(null);
      return;
    }

    if (tool !== "select") return;

    // Check if clicking a stamp
    for (const st of stamps) {
      const bb = stampBBox(st);
      if (clickX >= bb.x && clickX <= bb.x + bb.w && clickY >= bb.y && clickY <= bb.y + bb.h) {
        setSelectedStampId(st.id);
        setSelectedObjectId(null);
        return;
      }
    }

    // Clicked empty space
    setSelectedObjectId(null);
    setSelectedStampId(null);
  }, [tool, stamps, scrollX, scrollY, pendingSymbol, activeColor]);

  // handleCanvasContextMenu moved below handleInsertPdf to avoid TDZ on
  // the handleInsert* handlers it closes over.

  // Wrapped undo/redo that also clears cross-feature selection (canvas objects).
  // Stamp selection is cleared inside useInk.
  const handleUndoWrapped = useCallback(() => {
    handleUndo();
    setSelectedObjectId(null);
  }, [handleUndo]);

  const handleRedoWrapped = useCallback(() => {
    handleRedo();
    setSelectedObjectId(null);
  }, [handleRedo]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        const tag = (e.target as HTMLElement)?.tagName;
        const editable = (e.target as HTMLElement)?.isContentEditable;
        if (tag === "INPUT" || tag === "TEXTAREA" || editable) return;
        e.preventDefault();
        if (e.shiftKey) handleRedoWrapped();
        else handleUndoWrapped();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndoWrapped, handleRedoWrapped]);

  /* ── Panel state ──────────────────────────────────────── */
  const [panelOpen, setPanelOpen] = useState(true);
  const [mathPaletteOpen, setMathPaletteOpen] = useState(false);
  /* Mobile-only: which of the two stacked right-panel sections is visible.
   * On wider screens CSS shows both simultaneously. */
  const [mobileRightTab, setMobileRightTab] = useState<"input" | "chat">("input");

  /* ── Persistence coordination ─────────────────────────── */
  const saveTimer = useRef<number>(0);
  const loadingPageRef = useRef(false);

  // Indirection ref: lets flushPendingSave call the latest saveNow without
  // creating a circular dependency with usePages.
  const saveNowRef = useRef<() => Promise<void>>(async () => {});

  const flushPendingSave = useCallback(async () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = 0;
    }
    await saveNowRef.current();
  }, []);

  const onPageLoaded = useCallback(async (data: CanvasData) => {
    loadingPageRef.current = true;
    hydratePipeline(data.panelInput ?? "", data.chatMessages ?? []);
    hydrateInk(data.strokes ?? [], data.stamps ?? []);
    hydrateObjects(data.canvasObjects ?? []);
    loadAllTableData(data.tableData ?? {});
    loadAllTextBoxData(data.textBoxData ?? {});
    setScrollX(data.viewport?.scrollX ?? 0);
    setScrollY(data.viewport?.scrollY ?? 0);
    // Clear loading flag after React processes the state updates
    requestAnimationFrame(() => { loadingPageRef.current = false; });
  }, [hydratePipeline, hydrateInk, hydrateObjects]);

  const onEmptyState = useCallback(() => {
    loadingPageRef.current = true;
    hydratePipeline("", []);
    hydrateInk([], []);
    hydrateObjects([]);
    setScrollX(0);
    setScrollY(0);
    requestAnimationFrame(() => { loadingPageRef.current = false; });
  }, [hydratePipeline, hydrateInk, hydrateObjects]);

  /* ── Pages feature: path-based state + load lifecycle ── */
  const {
    currentPath, pathRef, tree, refreshTree,
    selectPath: handleSelect,
    ready,
  } = usePages({ plugin, onPageLoaded, onEmptyState, flushPendingSave });
  // Filename for "Export PNG" — last segment of the current path.
  const currentPage = currentPath.includes("/")
    ? currentPath.slice(currentPath.lastIndexOf("/") + 1)
    : currentPath;

  const saveNow = useCallback(async () => {
    const path = pathRef.current;
    if (!path) return;

    const data: CanvasData = {
      version: 2,
      strokes,
      stamps,
      canvasObjects,
      viewport: { scrollX, scrollY },
      panelInput: inputCode,
      chatMessages,
      tableData: getAllTableData(),
      textBoxData: getAllTextBoxData(),
      lastSaved: new Date().toISOString(),
    };
    await savePageByPath(plugin, path, data);
  }, [strokes, stamps, canvasObjects, scrollX, scrollY, inputCode, chatMessages, plugin, pathRef]);

  // Keep the indirection ref up to date so flushPendingSave sees the latest saveNow.
  useEffect(() => { saveNowRef.current = saveNow; }, [saveNow]);

  const doSave = useCallback(() => {
    if (!plugin.settings.autoSave) return;
    if (!pathRef.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await saveNow();
    }, plugin.settings.autoSaveDelay);
  }, [saveNow, plugin, pathRef]);

  useEffect(() => { if (!loadingPageRef.current) doSave(); }, [inputCode, chatMessages, strokes, stamps, canvasObjects]);
  useEffect(() => { return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }; }, []);

  // Trigger auto-save when table/textbox store changes
  useEffect(() => {
    setOnChangeCallback(() => doSave());
    return () => setOnChangeCallback(null);
  }, [doSave]);

  // Expose save for view close
  useEffect(() => {
    flushSave = saveNow;
    return () => { flushSave = null; };
  }, [saveNow]);

  /* ── Lasso complete → rasterize + push to stack ── */
  const handleLassoComplete = useCallback(async (bounds: LassoBounds) => {
    const container = viewportRef.current;
    if (!container) {
      setLassoActive(false);
      return;
    }

    // Rasterize the visible region through the dumb pipe.
    // html2canvas captures ink strokes, text box contents, table cells,
    // images, everything. Zero data-model interpretation.
    const dataUrl = await rasterizeRegion(container, {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
    });

    if (!dataUrl) {
      new Notice("Lasso capture failed — see console", 8000);
      return;
    }

    // Add the captured region to the stack. The user can either process
    // the stack now (via the action bar) or draw more regions first.
    const region: LassoRegion = {
      id: crypto.randomUUID(),
      bounds,
      capturedImage: dataUrl,
    };
    pushRegion(region);
  }, [setLassoActive, pushRegion]);

  /* ── Process the lasso stack: composite + send to AI pipeline ── */
  const handleProcessStack = useCallback(async () => {
    // Snapshot the current stack so the async work is decoupled from state.
    const snapshot = lassoRegions;
    if (snapshot.length === 0) return;

    // Composite all region images into one tall labeled PNG
    const composite = await compositeRegions(snapshot.map((r) => r.capturedImage));
    if (!composite) {
      new Notice("Failed to composite lasso regions — see console", 8000);
      return;
    }

    // Clear the stack and deactivate lasso mode before sending to the AI
    // so the user can't accidentally add more regions mid-flight.
    clearStack();
    setLassoActive(false);

    // Hand off to the pipeline (OCR + solve + chat with image attached)
    await processCrop(composite);
  }, [lassoRegions, clearStack, setLassoActive, processCrop]);

  const handleLassoMoveComplete = useCallback((delta: { dx: number; dy: number }, bounds: LassoBounds) => {
    // Screen-space bounds + delta → world-space: divide by zoom, then add scroll.
    // At 2x zoom, a screen bound of 100px maps to 50 world units.
    const z = zoom;
    const scenePolygon = polygonToWorld(bounds.points, scrollX, scrollY, z);
    const regionBounds = boundsToWorld(bounds, scrollX, scrollY, z);

    // Delta is also in screen space (from the move drag overlay).
    const worldDx = delta.dx / z;
    const worldDy = delta.dy / z;

    pushUndo();
    setStrokes(prev => moveStrokesInPolygon(prev, scenePolygon, worldDx, worldDy));
    setStamps(prev => moveStampsInPolygon(prev, scenePolygon, worldDx, worldDy));
    setCanvasObjects(prev => moveObjectsInBounds(prev, regionBounds, worldDx, worldDy));

    setLassoActive(false);
    clearStack();
  }, [scrollX, scrollY, zoom, pushUndo, setLassoActive, clearStack, setStrokes, setStamps, setCanvasObjects]);

  /* ── Lasso Clear → classic delete: remove any strokes/stamps/objects
   * inside the current region stack, record undo, and exit selection. If
   * the stack has no captured content, we still wipe the outline (matches
   * prior behavior of "cancel selection"). The button is hidden when the
   * stack is empty so there's no silent no-op from the action bar. */
  const handleLassoClear = useCallback(() => {
    const snapshot = lassoRegions;
    if (snapshot.length === 0) {
      // Nothing selected — just ensure lasso is dismissed cleanly.
      setLassoActive(false);
      return;
    }

    const { polygons, bounds } = regionsToWorldSelection(snapshot, scrollX, scrollY, zoom);

    if (selectionIsEmpty(strokes, stamps, canvasObjects, polygons, bounds)) {
      // Region drawn over empty canvas — no content to delete. Clear the
      // selection outlines and let the user know so it doesn't look broken.
      new Notice("Nothing selected to delete", 3000);
      clearStack();
      setLassoActive(false);
      return;
    }

    pushUndo();
    setStrokes((prev) => deleteStrokesInPolygons(prev, polygons));
    setStamps((prev) => deleteStampsInPolygons(prev, polygons));
    setCanvasObjects((prev) => deleteObjectsInBounds(prev, bounds));

    clearStack();
    setLassoActive(false);
  }, [
    lassoRegions, scrollX, scrollY, zoom,
    strokes, stamps, canvasObjects,
    pushUndo, setStrokes, setStamps, setCanvasObjects,
    clearStack, setLassoActive,
  ]);

  // Chat send, solve from input, and symbol insertion all live in usePipeline now.

  /* ── Insert canvas objects ───────────────────────────── */
  const handleInsertTextBox = useCallback(() => {
    try {
      const obj = createTextBox(scrollX + 150, scrollY + 150);
      setCanvasObjects((prev) => [...prev, obj]);
      setTool("select");
      setSelectedObjectId(obj.id);
    } catch (err) {
      console.error("[Noteometry] Text Box insert failed:", err);
      new Notice("Couldn't insert Text Box — see console", 6000);
    }
  }, [scrollX, scrollY]);

  /* ── Drop AI chat response onto the canvas ──────────────
   * Creates a new text box at the top-left of the current viewport
   * pre-populated with the rendered HTML (LaTeX already converted to
   * MathML by ChatPanel before calling us). User can then drag/resize
   * or edit the text around the rendered math. */
  const handleDropChatToCanvas = useCallback((html: string) => {
    // Position near the top-left of what the user is currently looking
    // at. Stack subsequent drops diagonally so they don't fully overlap.
    const existingDropCount = canvasObjects.filter((o) => o.type === "textbox").length;
    const offset = 40 + (existingDropCount % 6) * 24;
    const x = scrollX + offset;
    const y = scrollY + offset;
    const obj = createTextBox(x, y);
    // Wider/taller than default so a full DLP-format solution fits.
    const sized = { ...obj, w: 460, h: 280 };
    // Seed the textbox HTML BEFORE the component mounts, so RichTextEditor
    // reads the content from tableStore on first render and shows it.
    setTextBoxData(sized.id, html);
    setCanvasObjects((prev) => [...prev, sized]);
    setTool("select");
    setSelectedObjectId(sized.id);
  }, [scrollX, scrollY, canvasObjects, setCanvasObjects, setSelectedObjectId]);

  const handleInsertTable = useCallback(() => {
    try {
      const obj = createTable(scrollX + 200, scrollY + 200);
      setCanvasObjects((prev) => [...prev, obj]);
      setTool("select");
      setSelectedObjectId(obj.id);
    } catch (err) {
      console.error("[Noteometry] Table insert failed:", err);
      new Notice("Couldn't insert Table — see console", 6000);
    }
  }, [scrollX, scrollY]);

  const handleInsertImage = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleInsertPdf = useCallback(() => {
    pdfInputRef.current?.click();
  }, []);

  /* ── v1.2+ drop-in insert handlers ──────────────────────
   * Factories build a fully-formed CanvasObject; historically they never
   * threw, but a bad factory or a state setter throwing would surface as
   * a silent no-op from the user's perspective. v1.6.6 wraps the insert
   * path so any failure gets logged + surfaced via a Notice. */
  const insertDropin = useCallback((factory: (x: number, y: number) => CanvasObject, label?: string) => {
    try {
      const obj = factory(scrollX + 100, scrollY + 100);
      setCanvasObjects((prev) => [...prev, obj]);
      setTool("select");
      setSelectedObjectId(obj.id);
    } catch (err) {
      const name = label ?? "drop-in";
      console.error(`[Noteometry] ${name} insert failed:`, err);
      new Notice(`Couldn't insert ${name} — see console`, 6000);
    }
  }, [scrollX, scrollY, setCanvasObjects, setSelectedObjectId]);

  const handleInsertCircuitSniper = useCallback(() => insertDropin(createCircuitSniper, "Circuit Sniper"), [insertDropin]);
  const handleInsertUnitConverter = useCallback(() => insertDropin(createUnitConverter, "Unit Converter"), [insertDropin]);
  const handleInsertGraphPlotter = useCallback(() => insertDropin(createGraphPlotter, "Graph Plotter"), [insertDropin]);
  const handleInsertUnitCircle = useCallback(() => insertDropin(createUnitCircle, "Unit Circle"), [insertDropin]);
  const handleInsertOscilloscope = useCallback(() => insertDropin(createOscilloscope, "Oscilloscope"), [insertDropin]);
  // Renamed v1.6.7: user called this "Computer" in feedback — the label
   // "Compute" wasn't doing its job. "Calculator" matches what it actually
   // is (a named-variables scratchpad that spits out a number). The
   // create* factory still uses the "compute" kind for persistence
   // compatibility.
   const handleInsertCompute = useCallback(() => insertDropin(createCompute, "Calculator"), [insertDropin]);
  const handleInsertAnimationCanvas = useCallback(() => insertDropin(createAnimationCanvas, "Animation Canvas"), [insertDropin]);
  const handleInsertStudyGantt = useCallback(() => insertDropin(createStudyGantt, "Study Gantt"), [insertDropin]);
  // handleInsertAIDropin removed in v1.6.6 — the AI drop-in is quarantined;
  // chat/solve live in the right panel. Old pages with an ai-dropin object
  // still render via CanvasObjectLayer with a deprecation placeholder.
  const handleInsertMultimeter = useCallback(() => insertDropin(createMultimeter, "Multimeter"), [insertDropin]);

  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const bytes = await file.arrayBuffer();
      const obj = createPdfObject(scrollX + 80, scrollY + 80, "");
      const path = pathRef.current;
      if (!path) {
        new Notice("Can't insert PDF — no active page. Create or open a page first.", 6000);
        return;
      }
      const vaultPath = await savePdfToVaultByPath(plugin, path, obj.id, bytes);
      obj.fileRef = vaultPath;
      setCanvasObjects((prev) => [...prev, obj]);
      setTool("select");
      setSelectedObjectId(obj.id);
    } catch (err) {
      console.error("[Noteometry] PDF insert failed:", err);
      new Notice("PDF insert failed — see console", 8000);
    }
  }, [scrollX, scrollY, plugin, setCanvasObjects, setSelectedObjectId]);

  /* ── Right-click context menu ──────────────────────────
   * This is now the PRIMARY tool interface — the toolbar has been removed
   * entirely. Detects what the user right-clicked on (canvas object /
   * stamp / empty canvas) and builds the appropriate menu. */
  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    // Don't hijack right-clicks on inputs/textareas/contenteditable so
    // those retain their native browser context menus.
    const target = e.target as HTMLElement | null;
    if (target && (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.closest("[contenteditable='true']")
    )) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    // World-space click position (used for hit tests and paste anchor)
    const worldX = (e.clientX - rect.left) / zoom + scrollX;
    const worldY = (e.clientY - rect.top) / zoom + scrollY;

    // Hit-test canvas objects first (they're above strokes)
    const hitObj = [...canvasObjects].reverse().find((o) =>
      worldX >= o.x && worldX <= o.x + o.w && worldY >= o.y && worldY <= o.y + o.h
    );
    const hitStamp = stamps.find((st) => {
      const bb = stampBBox(st);
      return worldX >= bb.x && worldX <= bb.x + bb.w && worldY >= bb.y && worldY <= bb.y + bb.h;
    });

    const items: ContextMenuItem[] = [];

    if (hitObj) {
      /* ── Right-clicked on a canvas object (drop-in) ── */
      setSelectedObjectId(hitObj.id);
      items.push(
        { label: "Cut", shortcut: "\u2318X", onClick: () => {
          objectClipboardRef.current = { ...hitObj };
          pushUndo();
          setCanvasObjects((prev) => prev.filter((o) => o.id !== hitObj.id));
          setSelectedObjectId(null);
        }},
        { label: "Copy", shortcut: "\u2318C", onClick: () => {
          objectClipboardRef.current = { ...hitObj };
        }},
        // v1.6.11: Paste menu entry. v1.6.10 shipped Copy/Cut but no Paste,
        // so the internal clipboard filled up and never emptied — users
        // reported "Copy works but nothing pastes." Pastes onto the
        // current right-click world point, offset if anchored on the
        // object itself, with undo + the normal autosave through the
        // canvasObjects setter.
        { label: "Paste", shortcut: "\u2318V", disabled: !objectClipboardRef.current, onClick: () => {
          const src = objectClipboardRef.current;
          if (!src) return;
          pushUndo();
          const pasted = makePastedObject(src, { x: worldX, y: worldY });
          setCanvasObjects((prev) => [...prev, pasted]);
          setSelectedObjectId(pasted.id);
        }},
        { label: "Duplicate", onClick: () => {
          pushUndo();
          const dup: CanvasObject = { ...hitObj, id: crypto.randomUUID(), x: hitObj.x + 24, y: hitObj.y + 24 };
          setCanvasObjects((prev) => [...prev, dup]);
          setSelectedObjectId(dup.id);
        }},
        { label: "Rename\u2026", onClick: () => {
          const current = hitObj.name ?? "";
          const next = window.prompt("Rename this drop-in:", current);
          if (next !== null && next.trim()) {
            setCanvasObjects((prev) => prev.map((o) => o.id === hitObj.id ? { ...o, name: next.trim() } : o));
          }
        }},
        { label: "", separator: true },
        { label: "Delete", danger: true, onClick: () => {
          setCanvasObjects((prev) => prev.filter((o) => o.id !== hitObj.id));
          if (selectedObjectId === hitObj.id) setSelectedObjectId(null);
        }},
      );
    } else if (hitStamp) {
      /* ── Right-clicked on a stamp ── */
      const curSize: StampSize = hitStamp.size ?? "normal";
      const setStampSize = (sz: StampSize) => {
        setStamps((prev) => prev.map((s) =>
          s.id === hitStamp.id ? { ...s, size: sz, fontSize: STAMP_SIZES[sz] } : s
        ));
      };
      items.push(
        { label: "Small", shortcut: curSize === "small" ? "\u2713" : "", onClick: () => setStampSize("small") },
        { label: "Normal", shortcut: curSize === "normal" ? "\u2713" : "", onClick: () => setStampSize("normal") },
        { label: "", separator: true },
        { label: "Delete Stamp", danger: true, onClick: () => {
          setStamps((prev) => prev.filter((s) => s.id !== hitStamp.id));
        }},
      );
    } else {
      /* ── Right-clicked on empty canvas — full tool interface ── */

      // v1.6.9: pin Clear Canvas at the TOP of the hub, right next to
      // Undo/Redo. Previously it was the last item after Export PNG, so
      // on iPad the menu grew tall enough that reaching Clear required
      // scrolling — and the menu container rubber-banded on two-finger
      // scroll, making the action effectively unreachable. Keeping it at
      // top means the destructive action is always one tap away and
      // never depends on the container scrolling at all.
      const clearCanvas = buildClearCanvasAction(() => {
        if (!confirm("Clear everything from this page — strokes, stamps, and all drop-ins?")) return;
        if (!confirm("Are you SURE? This wipes every stroke, stamp, and drop-in on this page. Click OK only if you really mean it.")) return;
        pushUndo();
        setStrokes([]);
        setStamps([]);
        setCanvasObjects([]);
        setSelectedObjectId(null);
        setSelectedStampId(null);
      });
      items.push(
        { label: "Undo", icon: "↩️", shortcut: "\u2318Z", disabled: !canUndo, onClick: handleUndoWrapped },
        { label: "Redo", icon: "↪️", shortcut: "\u21E7\u2318Z", disabled: !canRedo, onClick: handleRedoWrapped },
        clearCanvas,
        // v1.6.11: paste the internally-copied object at the right-click point.
        // Disabled when the clipboard ref is empty so the menu is honest
        // rather than silently no-op.
        { label: "Paste", icon: "📋", shortcut: "\u2318V", disabled: !objectClipboardRef.current, onClick: () => {
          const src = objectClipboardRef.current;
          if (!src) return;
          pushUndo();
          const pasted = makePastedObject(src, { x: worldX, y: worldY });
          setCanvasObjects((prev) => [...prev, pasted]);
          setSelectedObjectId(pasted.id);
        }},
        { label: "", separator: true },
      );

      // Resolve current color/width labels for display
      const colorEntry = INK_COLORS.find((c) => c.color === activeColor) ?? INK_COLORS[0]!;
      const widthEntry = STROKE_WIDTHS.find((w) => w.width === strokeWidth) ?? STROKE_WIDTHS[1]!;

      // Helper: cycle to next entry in an array
      const nextColor = () => {
        const idx = INK_COLORS.findIndex((c) => c.color === activeColor);
        const next = INK_COLORS[(idx + 1) % INK_COLORS.length]!;
        setActiveColor(next.color);
      };
      const nextWidth = () => {
        const idx = STROKE_WIDTHS.findIndex((w) => w.width === strokeWidth);
        const next = STROKE_WIDTHS[(idx + 1) % STROKE_WIDTHS.length]!;
        setStrokeWidth(next.width);
      };

      // ── Drawing ──
      items.push(
        { label: "\u2500\u2500 Drawing \u2500\u2500", disabled: true },
        { label: "Pen", icon: "✏️", shortcut: tool === "pen" && !lassoActive ? "\u2713" : "", onClick: () => { setTool("pen"); setLassoActive(false); }},
        { label: "Eraser", icon: "🧹", shortcut: tool === "eraser" ? "\u2713" : "", onClick: () => { setTool("eraser"); setLassoActive(false); }},
        { label: `Color: ${colorEntry.label}`, icon: "\u25CF", shortcut: "", onClick: nextColor },
        { label: `Width: ${widthEntry.label}`, icon: "〰️", onClick: nextWidth },
        { label: "", separator: true },
      );

      // ── Select ──
      items.push(
        { label: "\u2500\u2500 Select \u2500\u2500", disabled: true },
        { label: "Freehand Lasso", icon: "✂️", shortcut: lassoActive && lassoMode === "freehand" ? "\u2713" : "", onClick: () => {
          if (!lassoActive) setTool("pen");
          toggleLasso("freehand");
        }},
        { label: "Rectangle Lasso", icon: "⬜", shortcut: lassoActive && lassoMode === "rect" ? "\u2713" : "", onClick: () => {
          if (!lassoActive) setTool("pen");
          toggleLasso("rect");
        }},
        { label: "", separator: true },
      );

      // ── Select (Pointer) ──
      items.push(
        { label: "Select (Pointer)", icon: "👆", shortcut: tool === "select" ? "\u2713" : "", onClick: () => { setTool("select"); setLassoActive(false); }},
        { label: "", separator: true },
      );

      // ── Insert ──
      items.push(
        { label: "\u2500\u2500 Insert \u2500\u2500", disabled: true },
        { label: "Text Box", icon: "📝", onClick: handleInsertTextBox },
        { label: "Table", icon: "📊", onClick: handleInsertTable },
        { label: "Image", icon: "🖼️", onClick: handleInsertImage },
        { label: "PDF", icon: "📄", onClick: handleInsertPdf },
        { label: "", separator: true },
      );

      // ── Engineering ──
      // Multimeter was hidden from the main hub in v1.6.7 — user reported
      // they didn't know how it fit the math/EE workbench flow. Still
      // reachable behind the "Show experimental tools" setting so existing
      // pages keep working and power users can opt in.
      items.push(
        { label: "\u2500\u2500 Engineering \u2500\u2500", disabled: true },
        { label: "Circuit Sniper", icon: "⚡", onClick: handleInsertCircuitSniper },
        { label: "Unit Converter", icon: "🔄", onClick: handleInsertUnitConverter },
      );
      if (plugin.settings.showExperimentalTools) {
        items.push({ label: "Multimeter (experimental)", icon: "🔌", onClick: handleInsertMultimeter });
      }
      items.push({ label: "", separator: true });

      // ── Math Tools ──
      // Compute → renamed "Calculator" in v1.6.7; user's feedback was
      // "WTF is 'Computer' for?" — the label was the problem, not the
      // feature. Animation Canvas was a Manim-inspired speculative
      // experiment; hide behind the setting until it earns its keep.
      items.push(
        { label: "\u2500\u2500 Math Tools \u2500\u2500", disabled: true },
        { label: "Math Palette", icon: "🧮", shortcut: mathPaletteOpen ? "\u2713" : "", onClick: () => setMathPaletteOpen(p => !p) },
        { label: "Graph Plotter", icon: "📈", onClick: handleInsertGraphPlotter },
        { label: "Unit Circle", icon: "🔘", onClick: handleInsertUnitCircle },
        { label: "Oscilloscope", icon: "📟", onClick: handleInsertOscilloscope },
        { label: "Calculator", icon: "🧮", onClick: handleInsertCompute },
      );
      if (plugin.settings.showExperimentalTools) {
        items.push({ label: "Animation Canvas (experimental)", icon: "🎬", onClick: handleInsertAnimationCanvas });
      }
      items.push({ label: "", separator: true });

      // ── Study ──
      // Study Gantt was reported as "completely worthless" — hide behind
      // the setting. Legacy pages still render via CanvasObjectLayer.
      if (plugin.settings.showExperimentalTools) {
        items.push(
          { label: "\u2500\u2500 Study \u2500\u2500", disabled: true },
          { label: "Study Gantt (experimental)", icon: "📅", onClick: handleInsertStudyGantt },
          { label: "", separator: true },
        );
      }

      // AI Drop-in removed from menu — Preview + Input remain in the right panel

      // ── Canvas ── (Undo/Redo/Clear live pinned at top; here we keep
      // the less-critical view-level actions that are fine to scroll to.)
      items.push(
        { label: "\u2500\u2500 Canvas \u2500\u2500", disabled: true },
        { label: "Zoom In", shortcut: `${Math.round(zoom * 100)}%`, onClick: zoomIn },
        { label: "Zoom Out", onClick: zoomOut },
        { label: "Reset Zoom (100%)", onClick: resetZoom },
        { label: "", separator: true },
        { label: "Export PNG", onClick: () => {
          const dataUrl = renderStrokesToImage(strokes, 20, 2, stamps);
          if (!dataUrl) return;
          const link = document.createElement("a");
          link.download = `${currentPage || "canvas"}.png`;
          link.href = dataUrl;
          link.click();
        }},
      );

      // Belt-and-braces: if a future refactor ever drops Clear Canvas
      // from the menu, surface it loudly in the console instead of
      // silently vanishing (the exact failure mode v1.6.8 is fixing).
      if (!items.some((i) => i.label === CLEAR_CANVAS_LABEL)) {
        console.error("[Noteometry] Clear Canvas missing from context menu — this is a regression.");
      }
    }

    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  }, [
    zoom, scrollX, scrollY, canvasObjects, stamps, selectedObjectId, tool, activeColor, strokeWidth,
    lassoActive, lassoMode, canUndo, canRedo, strokes, currentPage,
    setCanvasObjects, setSelectedObjectId, setStamps, setTool, setLassoActive, setActiveColor, setStrokeWidth,
    toggleLasso, handleUndoWrapped, handleRedoWrapped, zoomIn, zoomOut, resetZoom, pushUndo,
    handleInsertTextBox, handleInsertTable, handleInsertImage, handleInsertPdf,
    handleInsertCircuitSniper, handleInsertUnitConverter, handleInsertGraphPlotter,
    handleInsertUnitCircle, handleInsertOscilloscope, handleInsertCompute,
    handleInsertAnimationCanvas, handleInsertStudyGantt, handleInsertMultimeter,
    mathPaletteOpen, plugin.settings.showExperimentalTools,
  ]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const reader = new FileReader();
      reader.onerror = () => {
        console.error("[Noteometry] image FileReader error:", reader.error);
        new Notice("Image insert failed — couldn't read file (see console)", 8000);
      };
      reader.onload = async (ev) => {
        const dataURL = ev.target?.result as string;
        if (!dataURL) {
          new Notice("Image insert failed — empty file", 6000);
          return;
        }
        const img = new window.Image();
        img.onerror = () => {
          console.error("[Noteometry] image decode failed for", file.name);
          new Notice(`Can't decode image "${file.name}" — unsupported format?`, 8000);
        };
        img.onload = async () => {
          try {
            const maxW = 400;
            const scale = Math.min(1, maxW / img.width);
            const obj = createImageObject(
              scrollX + 150, scrollY + 150,
              dataURL,
              img.width * scale,
              img.height * scale
            );
            // Save to vault if we have an active page; otherwise the
            // dataURL stays in memory (still renders, won't sync).
            const path = pathRef.current;
            if (path) {
              try {
                const vaultPath = await saveImageToVaultByPath(plugin, path, obj.id, dataURL);
                obj.dataURL = vaultPath;
              } catch (err) {
                console.error("[Noteometry] image vault save failed:", err);
                new Notice("Image saved in-memory only — vault write failed (see console)", 8000);
              }
            } else {
              new Notice("No active page — image dropped on canvas but not saved to vault", 6000);
            }
            setCanvasObjects((prev) => [...prev, obj]);
            setTool("select");
            setSelectedObjectId(obj.id);
          } catch (err) {
            console.error("[Noteometry] image insert failed in onload:", err);
            new Notice("Couldn't insert Image — see console", 8000);
          }
        };
        img.src = dataURL;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("[Noteometry] image insert outer error:", err);
      new Notice("Couldn't insert Image — see console", 8000);
    }
  }, [scrollX, scrollY, plugin, setCanvasObjects, setSelectedObjectId]);

  // v1.6.11: paste routing.
  //
  // Pre-v1.6.11 the listener attached to the canvas-area <div>, which
  // never receives `paste` events — divs aren't focusable, so the event
  // target is always either the document or an inner input. Users
  // reported "When I paste…" with nothing happening on the canvas.
  //
  // The listener now sits on the document. When the paste target is an
  // editable element (input/textarea/contenteditable) we bow out and
  // let the browser's default behaviour handle it — so pasting text
  // into the chat box, a RichTextEditor, or a table cell works as
  // before. Otherwise we inspect the clipboard: images drop onto the
  // canvas as image objects (same path as v1.6.10), an internal-object
  // clipboard entry drops as a canvas object, and text is forwarded to
  // a stamp so users aren't surprised by "nothing happens."
  useEffect(() => {
    const handler = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Editable target → let the default happen. This is what keeps
      // the chat textarea, RichTextEditor, and table cell paste paths
      // untouched (the Math v12 / clipboard-to-Word pipeline is guarded
      // upstream and never reached from here).
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.closest("[contenteditable='true']")) {
          return;
        }
      }
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      // 1) Prefer a system-clipboard image.
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = async (ev) => {
              const dataURL = ev.target?.result as string;
              if (!dataURL) return;
              const obj = createImageObject(scrollX + 150, scrollY + 150, dataURL);
              const path = pathRef.current;
              if (path) {
                try {
                  const vaultPath = await saveImageToVaultByPath(plugin, path, obj.id, dataURL);
                  obj.dataURL = vaultPath;
                } catch (err) {
                  console.error("[Noteometry] paste image vault save failed:", err);
                  new Notice("Pasted image save failed — kept in memory only, may not sync across devices", 8000);
                }
              }
              pushUndo();
              setCanvasObjects((prev) => [...prev, obj]);
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }

      // 2) Fall back to the internal object clipboard (set by right-click Copy).
      const src = objectClipboardRef.current;
      if (src) {
        e.preventDefault();
        pushUndo();
        const pasted = makePastedObject(src, null);
        setCanvasObjects((prev) => [...prev, pasted]);
        setSelectedObjectId(pasted.id);
        return;
      }

      // 3) Plain text paste onto an empty canvas is not currently
      //    routed — make it explicit instead of silently dropping.
      const hasText = Array.from(items).some((i) => i.kind === "string");
      if (hasText) {
        new Notice("Paste into a text box or chat — canvas-level text paste isn't wired up", 5000);
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [scrollX, scrollY, plugin, pushUndo, setCanvasObjects, setSelectedObjectId]);

  /* ── Viewport change ─────────────────────────────────── */
  const handleViewportChange = useCallback((newX: number, newY: number) => {
    setScrollX(newX);
    setScrollY(newY);
  }, []);

  /* ── Wheel handler: Cmd/Ctrl+wheel → zoom, plain wheel → pan.
   *
   * v1.6.10: InkCanvas now owns Cmd/Ctrl+wheel zoom on its own container,
   * which fixed the MBP trackpad pinch regression. This viewport-level
   * handler stays as a backup for wheel events that land on non-ink
   * regions (overlays, empty areas between the canvas and the panel),
   * and still owns plain-wheel pan so the user can two-finger scroll
   * anywhere in the viewport. Using refs for zoom state so re-binding
   * doesn't race with the pinch event stream. */
  const zoomLockedStateRef = useRef(zoomLocked);
  const zoomStateRef = useRef(zoom);
  useEffect(() => { zoomLockedStateRef.current = zoomLocked; }, [zoomLocked]);
  useEffect(() => { zoomStateRef.current = zoom; }, [zoom]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      const zoomGesture = e.metaKey || e.ctrlKey;
      if (zoomGesture) {
        if (zoomLockedStateRef.current) { e.preventDefault(); return; }
        e.preventDefault();
        setZoom((z) => {
          const scale = e.ctrlKey && !e.metaKey ? 0.01 : 0.005;
          const delta = -e.deltaY * scale;
          return clampZoom(Math.round((z + delta) * 1000) / 1000);
        });
        return;
      }
      // v1.6.12: route wheel events across drop-ins. Previously any target
      // inside a drop-in was treated as a dead zone (bail without
      // preventDefault), which made 2-finger scroll stop the moment the
      // cursor entered a drop-in. Now we yield only when the drop-in's
      // internal element is genuinely scrollable in the axis the user is
      // scrolling; otherwise we pan the canvas the same way we would over
      // empty space. OneNote / MyScript behave the same way.
      const target = e.target as Element | null;
      if (shouldYieldToNativeScroll(target, el, { deltaX: e.deltaX, deltaY: e.deltaY })) {
        return;
      }
      e.preventDefault();
      const z = zoomStateRef.current || 1;
      setScrollX((x) => x + e.deltaX / z);
      setScrollY((y) => y + e.deltaY / z);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [clampZoom]);

  /* ── Drag-and-drop math symbols onto canvas ──────────── */
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-noteometry-symbol")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    const data = e.dataTransfer.getData("application/x-noteometry-symbol");
    if (!data) return;
    e.preventDefault();
    try {
      const item = JSON.parse(data) as { display: string; stamp?: string };
      const rect = canvasAreaRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left + scrollX;
      const y = e.clientY - rect.top + scrollY;
      pushUndo();
      setStamps(prev => [...prev, {
        id: newStampId(), x, y,
        text: item.stamp ?? item.display,
        fontSize: 96,
        color: activeColor,
      }]);
    } catch { /* ignore */ }
  }, [scrollX, scrollY, activeColor, pushUndo]);

  /* ── Right panel resize ──────────────────────────────── */
  const [panelWidth, setPanelWidth] = useState(() => window.innerWidth < 1024 ? 240 : 320);
  const panelDragging = useRef(false);
  const panelLastX = useRef(0);

  const handlePanelResizeDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    panelDragging.current = true;
    panelLastX.current = e.clientX;
  };
  const handlePanelResizeMove = (e: React.PointerEvent) => {
    if (!panelDragging.current) return;
    const dx = e.clientX - panelLastX.current;
    panelLastX.current = e.clientX;
    setPanelWidth((w) => Math.max(200, Math.min(900, w - dx)));
  };
  const handlePanelResizeUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    panelDragging.current = false;
  };

  /* ── Chat vertical resize ───────────────────────────── */
  const [chatHeight, setChatHeight] = useState(320);
  const chatDragging = useRef(false);
  const chatLastY = useRef(0);

  const handleChatResizeDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    chatDragging.current = true;
    chatLastY.current = e.clientY;
  };
  const handleChatResizeMove = (e: React.PointerEvent) => {
    if (!chatDragging.current) return;
    const dy = e.clientY - chatLastY.current;
    chatLastY.current = e.clientY;
    setChatHeight((h) => Math.max(80, h - dy));
  };
  const handleChatResizeUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    chatDragging.current = false;
  };

  /* ── Render ──────────────────────────────────────────── */
  if (!ready) {
    return <div className="noteometry-loading">Loading Noteometry…</div>;
  }

  return (
    <div ref={containerRef} className="noteometry-container">
      {/* ── Sidebar tree ── */}
      <SidebarTree
        plugin={plugin}
        tree={tree}
        currentPath={currentPath}
        onSelect={(p) => { void handleSelect(p); }}
        onTreeChanged={refreshTree}
      />

      {/* ── Main area ── */}
      <div className="noteometry-main">
        <div className="noteometry-split">
          {/* ── Canvas area ── */}
          <div ref={canvasAreaRef} className={`noteometry-canvas-area${lassoActive ? " noteometry-lasso-active" : ""}${pendingSymbol ? " noteometry-placing-symbol" : ""}`}
            onClick={handleCanvasAreaClick}
            onContextMenu={handleCanvasContextMenu}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
          >
            {/* Hidden image input */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="noteometry-hidden"
            />
            {/* Hidden PDF input */}
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handlePdfUpload}
              className="noteometry-hidden"
            />

            {/* ── Viewport: the full drawing surface (toolbar removed — use right-click) ── */}
            <div ref={viewportRef} className="noteometry-canvas-viewport">
              {!panelOpen && (
                <div className="noteometry-canvas-actions">
                  <button
                    className="noteometry-canvas-action-btn"
                    onClick={() => setPanelOpen(true)}
                    title="Open panel"
                  >
                    ◨ Panel
                  </button>
                </div>
              )}

              {/* Ink canvas */}
              <InkCanvas
                strokes={strokes}
                onStrokesChange={handleStrokesChange}
                stamps={stamps}
                onStampsChange={handleStampsChange}
                onEraseStart={onEraseStart}
                onEraseEnd={onEraseEnd}
                activeColor={activeColor}
                strokeWidth={strokeWidth}
                tool={tool}
                onToolChange={setTool}
                scrollX={scrollX}
                scrollY={scrollY}
                zoom={zoom}
                zoomLocked={zoomLocked}
                onZoomChange={(z) => setZoom(clampZoom(z))}
                onCycleTool={handleCycleTool}
                onRequestContextMenu={(clientX, clientY) => {
                  // v1.6.9 pen-long-press fallback for Apple Pencil — no
                  // reliable web event exists for pencil double-tap on
                  // iPad Safari / Obsidian mobile webview, so we route a
                  // 550ms pen hold to the same context-menu entry point
                  // the right-click handler uses. Keeps the "local tool
                  // hub" concept Dan asked us to preserve.
                  const fake = new MouseEvent("contextmenu", {
                    clientX, clientY, bubbles: true,
                  });
                  Object.defineProperty(fake, "preventDefault", { value: () => {} });
                  handleCanvasContextMenu(fake as unknown as React.MouseEvent);
                }}
                fingerDrawing={plugin.settings.fingerDrawing}
                onViewportChange={handleViewportChange}
                /* v1.6.9: silence the ink layer while a pending stamp is
                 * armed so the tap lands as "place symbol" (handled by
                 * handleCanvasAreaClick) instead of also starting a
                 * stroke under it. */
                disabled={lassoActive || pendingSymbol !== null}
                selectedStampId={selectedStampId}
              />

              {/* Canvas object overlays (text boxes, tables, images) */}
              <CanvasObjectLayer
                objects={canvasObjects}
                onObjectsChange={setCanvasObjects}
                scrollX={scrollX}
                scrollY={scrollY}
                zoom={zoom}
                tool={tool}
                selectedObjectId={selectedObjectId}
                onSelectObject={setSelectedObjectId}
                plugin={plugin}
                pagePath={currentPath}
              />

              {/* Lasso overlay — operates within the viewport */}
              <LassoOverlay
                active={lassoActive}
                mode={lassoMode}
                containerRef={viewportRef as React.RefObject<HTMLDivElement>}
                regions={lassoRegions}
                onComplete={handleLassoComplete}
                onCancel={clearStack}
                onClear={handleLassoClear}
                onProcess={handleProcessStack}
                onMoveComplete={handleLassoMoveComplete}
              />

              {/* ── Mobile-only Tools FAB — opens the canvas context menu
                      at the button position. Touch devices can't long-press
                      the canvas because we preventDefault touchstart to
                      drive drawing, so this is the only reachable entry
                      point to the tool menu on Android. ── */}
              <button
                className="nm-tools-fab"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const fake = new MouseEvent("contextmenu", {
                    clientX: rect.left,
                    clientY: rect.top,
                    bubbles: true,
                  });
                  Object.defineProperty(fake, "preventDefault", { value: () => {} });
                  handleCanvasContextMenu(fake as unknown as React.MouseEvent);
                }}
                title="Tools"
                aria-label="Tools"
              >☰</button>

              {/* ── Floating undo/redo + zoom widget ── */}
              <div className="nm-zoom-widget" style={{
                position: "absolute", bottom: "12px", right: "12px", zIndex: 200,
                display: "flex", gap: "4px", alignItems: "center",
                background: "var(--nm-faceplate, #F5F5F5)",
                border: "1px solid var(--nm-paper-border, #E0E0E0)",
                borderRadius: "8px", padding: "2px 4px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                userSelect: "none",
              }}>
                <button className="nm-zoom-btn" onClick={handleUndoWrapped} disabled={!canUndo}
                  title="Undo" style={{ opacity: canUndo ? 1 : 0.3 }}>↩</button>
                <button className="nm-zoom-btn" onClick={handleRedoWrapped} disabled={!canRedo}
                  title="Redo" style={{ opacity: canRedo ? 1 : 0.3 }}>↪</button>
                <span style={{ width: "1px", height: "16px", background: "#D0D0D0", margin: "0 2px" }} />
                <button className="nm-zoom-btn" onClick={zoomOut} title="Zoom out">−</button>
                <button className="nm-zoom-pct" onClick={resetZoom} title="Reset zoom">
                  {Math.round(zoom * 100)}%
                </button>
                <button className="nm-zoom-btn" onClick={zoomIn} title="Zoom in">+</button>
              </div>
            </div>
          </div>

          {/* ── Right panel ── */}
          {panelOpen && (
            <div className="noteometry-right" style={{ width: panelWidth }}>
              <div
                className="noteometry-right-resize"
                onPointerDown={handlePanelResizeDown}
                onPointerMove={handlePanelResizeMove}
                onPointerUp={handlePanelResizeUp}
              />
              <div className="noteometry-right-inner" data-mobile-tab={mobileRightTab}>
                {/* Mobile-only tab switcher — hidden on desktop via CSS */}
                <div className="nm-right-tabs">
                  <button
                    className={`nm-right-tab${mobileRightTab === "input" ? " active" : ""}`}
                    onClick={() => setMobileRightTab("input")}
                  >Input</button>
                  <button
                    className={`nm-right-tab${mobileRightTab === "chat" ? " active" : ""}`}
                    onClick={() => setMobileRightTab("chat")}
                  >Chat</button>
                  <button
                    className="nm-right-tab nm-right-tab-hide"
                    onClick={() => setPanelOpen(false)}
                    title="Hide panel"
                    aria-label="Hide panel"
                  >×</button>
                </div>

                <div className="nm-right-pane nm-right-pane-input">
                  <Panel
                    inputCode={inputCode}
                    setInputCode={setInputCode}
                    onInsertSymbol={handleInsertSymbol}
                    onStampSymbol={(sym) => setPendingSymbol(sym)}
                    onDropStamp={(display, screenX, screenY) => {
                      // Direct stamp placement from touch drag. Divide
                      // by zoom before adding scroll so the drop lands
                      // under the finger at any zoom level — same screen
                      // → world math used by InkCanvas pointer handlers.
                      const rect = canvasAreaRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      const x = (screenX - rect.left) / zoom + scrollX;
                      const y = (screenY - rect.top) / zoom + scrollY;
                      setStamps(prev => [...prev, {
                        id: newStampId(), x, y,
                        text: display, fontSize: 96, color: activeColor,
                      }]);
                    }}
                    onSolve={handleSolveInput}
                    onClosePanel={() => setPanelOpen(false)}
                  />
                </div>
                <div
                  className="noteometry-resize-handle nm-desktop-only"
                  onPointerDown={handleChatResizeDown}
                  onPointerMove={handleChatResizeMove}
                  onPointerUp={handleChatResizeUp}
                />
                <div className="nm-right-pane nm-right-pane-chat" style={{ height: chatHeight }}>
                  <ChatPanel
                    messages={chatMessages}
                    onSend={sendToChat}
                    onStop={stopChat}
                    onClear={() => setChatMessages([])}
                    loading={chatLoading}
                    onDropToCanvas={handleDropChatToCanvas}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {/* ── Floating Math Palette ── */}
      {mathPaletteOpen && (
        <div className="nm-math-palette-popup" style={{
          zIndex: 600, background: "var(--nm-faceplate, #F5F5F5)",
          border: "1px solid var(--nm-paper-border, #E0E0E0)",
          borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "4px 8px", borderBottom: "1px solid var(--nm-paper-border, #E0E0E0)",
            fontSize: "11px", fontWeight: 600, color: "var(--nm-ink, #1A1A2E)",
          }}>
            <span>Math Palette</span>
            <button
              onClick={() => setMathPaletteOpen(false)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "14px", color: "var(--nm-ink-muted, #6B7280)", padding: "2px 6px",
              }}
            >x</button>
          </div>
          <MathPalette
            onInsert={handleInsertSymbol}
            onDragStart={(sym) => setPendingSymbol(sym)}
            onArmStamp={(display) => {
              // v1.6.9: close the palette so the user immediately sees
              // where they're about to place, and arm pendingSymbol so
              // the next canvas tap drops the glyph.
              setPendingSymbol(display);
              setMathPaletteOpen(false);
            }}
            onDropStamp={(display, screenX, screenY) => {
              const rect = canvasAreaRef.current?.getBoundingClientRect();
              if (!rect) return;
              const x = (screenX - rect.left) / zoom + scrollX;
              const y = (screenY - rect.top) / zoom + scrollY;
              setStamps(prev => [...prev, {
                id: newStampId(), x, y,
                text: display, fontSize: 96, color: activeColor,
              }]);
            }}
          />
        </div>
      )}
    </div>
  );
}
