import React, { useState, useRef, useEffect, useCallback } from "react";
import { App, Notice, TFolder, TFile } from "obsidian";
import type NoteometryPlugin from "../main";
import { strokeIntersectsPolygon, stampIntersectsPolygon, stampBBox, newStampId } from "../lib/inkEngine";
import { renderStrokesToImage } from "../lib/canvasRenderer";
import { createTextBox, createTable, createImageObject, createPdfObject, createImageAnnotator, createFormulaCard, createUnitConverter, createCircuitSniper } from "../lib/canvasObjects";
import { savePage, saveImageToVault, savePdfToVault, pagePath, loadPage, migrateBase64Images, CanvasData } from "../lib/persistence";
import InkCanvas, { CanvasTool } from "./InkCanvas";
import CanvasObjectLayer from "./CanvasObjectLayer";
import Panel from "./Panel";
import ChatPanel from "./ChatPanel";
import Sidebar from "./Sidebar";
import LassoOverlay from "./LassoOverlay";
import type { LassoBounds } from "./LassoOverlay";
import ContextMenu from "./ContextMenu";
import type { ContextMenuItem } from "./ContextMenu";
import type { CanvasObject } from "../lib/canvasObjects";
import { getAllTableData, loadAllTableData, getAllTextBoxData, loadAllTextBoxData, setOnChangeCallback, setTextBoxData } from "../lib/tableStore";
import { useInk } from "../features/ink/useInk";
import { useLassoStack } from "../features/lasso/useLassoStack";
import type { LassoRegion } from "../features/lasso/useLassoStack";
import { useObjects } from "../features/objects/useObjects";
import { usePipeline } from "../features/pipeline/usePipeline";
import { usePages } from "../features/pages/usePages";
import { compositeRegions } from "../features/lasso/composite";
import ZoomWidget from "./ZoomWidget";
import ColorThicknessPanel, { PEN_COLORS, PEN_WIDTHS } from "./ColorThicknessPanel";
import { useLongPress } from "../hooks/useLongPress";

/* ── Color and width presets for context-menu cycling ───────────── */
const INK_COLORS = PEN_COLORS;

const STROKE_WIDTHS = PEN_WIDTHS;

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
    presets, activePreset,
    setInputCode, setChatMessages, setActivePresetId,
    sendToChat, stopChat, processCrop, handleSolveInput, handleInsertSymbol,
    hydrate: hydratePipeline,
  } = usePipeline(plugin);

  /* ── Composition-layer state ─── */
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [zoomLocked, setZoomLocked] = useState(false);
  const [showGrid, setShowGrid] = useState(plugin.settings.showGrid);
  const [colorPanel, setColorPanel] = useState<{ x: number; y: number } | null>(null);

  /* ── Floating panel state (P1-7) ─── */
  const [fpDocked, setFpDocked] = useState(plugin.settings.floatingPanelDocked);
  const [fpMinimized, setFpMinimized] = useState(plugin.settings.floatingPanelMinimized);
  const [fpPos, setFpPos] = useState({ x: plugin.settings.floatingPanelX, y: plugin.settings.floatingPanelY });
  const [fpSize, setFpSize] = useState({ w: plugin.settings.floatingPanelWidth, h: plugin.settings.floatingPanelHeight });
  const fpDragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const fpResizeRef = useRef<{ startX: number; startW: number } | null>(null);
  const fpResizeBRRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
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

  // Persist showGrid
  useEffect(() => {
    plugin.settings.showGrid = showGrid;
    plugin.saveSettings();
  }, [showGrid]);

  // Persist floating panel state
  useEffect(() => {
    plugin.settings.floatingPanelDocked = fpDocked;
    plugin.settings.floatingPanelMinimized = fpMinimized;
    plugin.settings.floatingPanelX = fpPos.x;
    plugin.settings.floatingPanelY = fpPos.y;
    plugin.settings.floatingPanelWidth = fpSize.w;
    plugin.settings.floatingPanelHeight = fpSize.h;
    plugin.saveSettings();
  }, [fpDocked, fpMinimized, fpPos, fpSize]);

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
    setZoom(clampZoom(data.viewport?.zoom ?? 1));
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
    setZoom(1);
    requestAnimationFrame(() => { loadingPageRef.current = false; });
  }, [hydratePipeline, hydrateInk, hydrateObjects]);

  /* ── Pages feature: section/page state + load lifecycle ── */
  const {
    currentSection, currentPage, ready,
    sectionRef, pageRef,
    selectPage: handleSelect,
  } = usePages({ plugin, onPageLoaded, onEmptyState, flushPendingSave });

  const saveNow = useCallback(async () => {
    const sec = sectionRef.current;
    const pg = pageRef.current;
    if (!sec || !pg) return;

    const data: CanvasData = {
      version: 2,
      strokes,
      stamps,
      canvasObjects,
      viewport: { scrollX, scrollY, zoom },
      panelInput: inputCode,
      chatMessages,
      tableData: getAllTableData(),
      textBoxData: getAllTextBoxData(),
      lastSaved: new Date().toISOString(),
    };
    await savePage(plugin, sec, pg, data);
  }, [strokes, stamps, canvasObjects, scrollX, scrollY, zoom, inputCode, chatMessages, plugin, sectionRef, pageRef]);

  // Keep the indirection ref up to date so flushPendingSave sees the latest saveNow.
  useEffect(() => { saveNowRef.current = saveNow; }, [saveNow]);

  const doSave = useCallback(() => {
    if (!plugin.settings.autoSave) return;
    if (!sectionRef.current || !pageRef.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await saveNow();
    }, plugin.settings.autoSaveDelay);
  }, [saveNow, plugin, sectionRef, pageRef]);

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

  // Sync file watcher — reload the page when Obsidian Sync updates the
  // underlying .md file from another device.
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.path) return;
      const sec = sectionRef.current;
      const pg = pageRef.current;
      if (!sec || !pg) return;
      const currentPath = pagePath(plugin, sec, pg);
      if (detail.path !== currentPath) return;

      // The file we're currently viewing was modified externally — reload.
      const data = await loadPage(plugin, sec, pg);
      const objs = data.canvasObjects ?? [];
      const imgResult = await migrateBase64Images(plugin, sec, objs);
      data.canvasObjects = imgResult.objects;
      await onPageLoaded(data);
    };
    window.addEventListener("noteometry:file-changed", handler);
    return () => window.removeEventListener("noteometry:file-changed", handler);
  }, [plugin, sectionRef, pageRef, onPageLoaded]);

  /* ── Lasso complete → ALWAYS snapshot canvas pixels + push to stack ── */
  const handleLassoComplete = useCallback(async (bounds: LassoBounds) => {
    const container = viewportRef.current;
    if (!container) {
      setLassoActive(false);
      return;
    }

    // VISION SNAPSHOT: capture the actual pixels from the ink canvas.
    // This is the ONLY lasso path — no text extraction, no hybrid.
    // Everything goes to the vision model as an image.
    const inkCanvas = container.querySelector<HTMLCanvasElement>(".noteometry-ink-layer");
    if (!inkCanvas) {
      new Notice("Lasso capture failed — ink canvas not found", 8000);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const regionX = Math.max(0, Math.floor(bounds.minX * dpr));
    const regionY = Math.max(0, Math.floor(bounds.minY * dpr));
    const regionW = Math.min(inkCanvas.width - regionX, Math.ceil((bounds.maxX - bounds.minX) * dpr));
    const regionH = Math.min(inkCanvas.height - regionY, Math.ceil((bounds.maxY - bounds.minY) * dpr));

    if (regionW <= 0 || regionH <= 0) {
      new Notice("Lasso region too small", 4000);
      return;
    }

    // Draw the selected region into an offscreen canvas
    const offscreen = document.createElement("canvas");
    offscreen.width = regionW;
    offscreen.height = regionH;
    const ctx = offscreen.getContext("2d");
    if (!ctx) {
      new Notice("Lasso capture failed — could not create offscreen canvas", 8000);
      return;
    }

    // White background so the vision model sees clean content
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, regionW, regionH);
    ctx.drawImage(inkCanvas, regionX, regionY, regionW, regionH, 0, 0, regionW, regionH);

    const dataUrl = offscreen.toDataURL("image/png");

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

  /* ── Lasso Clear — delete strokes/stamps/objects inside the lasso regions ── */
  const handleLassoClear = useCallback(() => {
    if (lassoRegions.length === 0) {
      clearStack();
      setLassoActive(false);
      return;
    }

    pushUndo();

    const z = zoom;
    // Build world-space polygons and bounds for all regions
    const worldRegions = lassoRegions.map((r) => ({
      polygon: r.bounds.points.map((p) => ({
        x: p.x / z + scrollX,
        y: p.y / z + scrollY,
      })),
      bounds: {
        minX: r.bounds.minX / z + scrollX,
        minY: r.bounds.minY / z + scrollY,
        maxX: r.bounds.maxX / z + scrollX,
        maxY: r.bounds.maxY / z + scrollY,
      },
    }));

    // Remove strokes inside any lasso region
    setStrokes((prev) =>
      prev.filter((s) =>
        !worldRegions.some((wr) => strokeIntersectsPolygon(s, wr.polygon))
      )
    );

    // Remove stamps inside any lasso region
    setStamps((prev) =>
      prev.filter((s) =>
        !worldRegions.some((wr) => stampIntersectsPolygon(s, wr.polygon))
      )
    );

    // Remove canvas objects whose bbox overlaps any lasso region
    setCanvasObjects((prev) =>
      prev.filter((obj) => {
        const objRight = obj.x + obj.w;
        const objBottom = obj.y + obj.h;
        return !worldRegions.some((wr) =>
          !(objRight < wr.bounds.minX || obj.x > wr.bounds.maxX ||
            objBottom < wr.bounds.minY || obj.y > wr.bounds.maxY)
        );
      })
    );

    clearStack();
    setLassoActive(false);
  }, [lassoRegions, zoom, scrollX, scrollY, pushUndo, clearStack, setLassoActive, setStrokes, setStamps, setCanvasObjects]);

  const handleLassoMoveComplete = useCallback((delta: { dx: number; dy: number }, bounds: LassoBounds) => {
    // Screen-space bounds + delta → world-space: divide by zoom, then add scroll.
    // At 2x zoom, a screen bound of 100px maps to 50 world units.
    const z = zoom;
    const scenePolygon = bounds.points.map((p) => ({
      x: p.x / z + scrollX,
      y: p.y / z + scrollY,
    }));

    const regionBounds = {
      minX: bounds.minX / z + scrollX,
      minY: bounds.minY / z + scrollY,
      maxX: bounds.maxX / z + scrollX,
      maxY: bounds.maxY / z + scrollY,
    };

    // Delta is also in screen space (from the move drag overlay).
    const worldDx = delta.dx / z;
    const worldDy = delta.dy / z;

    pushUndo();

    // Move strokes inside lasso
    setStrokes(prev => prev.map(s => {
      if (strokeIntersectsPolygon(s, scenePolygon)) {
        return { ...s, points: s.points.map(p => ({ ...p, x: p.x + worldDx, y: p.y + worldDy })) };
      }
      return s;
    }));

    // Move stamps inside lasso
    setStamps(prev => prev.map(s => {
      if (stampIntersectsPolygon(s, scenePolygon)) {
        return { ...s, x: s.x + worldDx, y: s.y + worldDy };
      }
      return s;
    }));

    // Move canvas objects whose bbox overlaps the lasso bounds.
    setCanvasObjects(prev => prev.map(obj => {
      const objRight = obj.x + obj.w;
      const objBottom = obj.y + obj.h;
      const overlaps = !(objRight < regionBounds.minX || obj.x > regionBounds.maxX ||
                         objBottom < regionBounds.minY || obj.y > regionBounds.maxY);
      if (overlaps) {
        return { ...obj, x: obj.x + worldDx, y: obj.y + worldDy };
      }
      return obj;
    }));

    setLassoActive(false);
    clearStack();
  }, [scrollX, scrollY, zoom, pushUndo, setLassoActive, clearStack]);

  // Chat send, solve from input, and symbol insertion all live in usePipeline now.

  /* ── Insert canvas objects ───────────────────────────── */
  const handleInsertTextBox = useCallback(() => {
    const obj = createTextBox(scrollX + 150, scrollY + 150);
    setCanvasObjects((prev) => [...prev, obj]);
    setTool("select");
    setSelectedObjectId(obj.id);
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
    const obj = createTable(scrollX + 200, scrollY + 200);
    setCanvasObjects((prev) => [...prev, obj]);
    setTool("select");
    setSelectedObjectId(obj.id);
  }, [scrollX, scrollY]);

  const handleInsertImage = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleInsertPdf = useCallback(() => {
    pdfInputRef.current?.click();
  }, []);

  const handleInsertImageAnnotator = useCallback(() => {
    const obj = createImageAnnotator(scrollX + 150, scrollY + 150);
    setCanvasObjects((prev) => [...prev, obj]);
    setTool("select");
    setSelectedObjectId(obj.id);
  }, [scrollX, scrollY]);

  const handleInsertFormulaCard = useCallback(() => {
    const obj = createFormulaCard(scrollX + 150, scrollY + 150);
    setCanvasObjects((prev) => [...prev, obj]);
    setTool("select");
    setSelectedObjectId(obj.id);
  }, [scrollX, scrollY]);

  const handleInsertUnitConverter = useCallback(() => {
    const obj = createUnitConverter(scrollX + 150, scrollY + 150);
    setCanvasObjects((prev) => [...prev, obj]);
    setTool("select");
    setSelectedObjectId(obj.id);
  }, [scrollX, scrollY]);

  const handleInsertCircuitSniper = useCallback(() => {
    const obj = createCircuitSniper(scrollX + 150, scrollY + 150);
    setCanvasObjects((prev) => [...prev, obj]);
    setTool("select");
    setSelectedObjectId(obj.id);
  }, [scrollX, scrollY]);

  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const bytes = await file.arrayBuffer();
      const obj = createPdfObject(scrollX + 80, scrollY + 80, "");
      const sec = sectionRef.current;
      if (!sec) {
        new Notice("Can't insert PDF — no active section. Create or open a page first.", 6000);
        return;
      }
      const vaultPath = await savePdfToVault(plugin, sec, obj.id, bytes);
      obj.fileRef = vaultPath;
      setCanvasObjects((prev) => [...prev, obj]);
      setTool("select");
      setSelectedObjectId(obj.id);
    } catch (err) {
      console.error("[Noteometry] PDF insert failed:", err);
      new Notice("PDF insert failed — see console", 8000);
    }
  }, [scrollX, scrollY, plugin, setCanvasObjects, setSelectedObjectId]);

  /* ── Context menu (right-click / long-press) ────────────
   * This is now the PRIMARY tool interface — the toolbar has been removed
   * entirely. Detects what the user tapped/clicked on (canvas object /
   * stamp / empty canvas) and builds the appropriate menu.
   * Triggered by:
   *   - Right-click (desktop) via useLongPress contextmenu handler
   *   - Long-press (iPad/touch, ~500ms) via useLongPress pointer handler */
  const openCanvasContextMenu = useCallback((clientX: number, clientY: number) => {
    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    // World-space click position (used for hit tests and paste anchor)
    const worldX = (clientX - rect.left) / zoom + scrollX;
    const worldY = (clientY - rect.top) / zoom + scrollY;

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
          setCanvasObjects((prev) => prev.filter((o) => o.id !== hitObj.id));
          setSelectedObjectId(null);
        }},
        { label: "Copy", shortcut: "\u2318C", onClick: () => {
          objectClipboardRef.current = { ...hitObj };
        }},
        { label: "Duplicate", onClick: () => {
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
      items.push(
        { label: "Delete Stamp", danger: true, onClick: () => {
          setStamps((prev) => prev.filter((s) => s.id !== hitStamp.id));
        }},
      );
    } else {
      /* ── Right-clicked on empty canvas — full tool interface ── */

      // Resolve current color/width labels for display
      const colorEntry = INK_COLORS.find((c) => c.color === activeColor) ?? INK_COLORS[0]!;
      const widthEntry = STROKE_WIDTHS.find((w) => w.width === strokeWidth) ?? STROKE_WIDTHS[0]!;

      // ── Drawing ──
      items.push(
        { label: "\u2500\u2500 Drawing \u2500\u2500", disabled: true },
        { label: "Select (Pointer)", shortcut: tool === "select" && !lassoActive ? "\u2713" : "", onClick: () => { setTool("select"); setLassoActive(false); }},
        { label: "Pen", shortcut: tool === "pen" && !lassoActive ? "\u2713" : "", onClick: () => { setTool("pen"); setLassoActive(false); }},
        { label: "Eraser", shortcut: tool === "eraser" ? "\u2713" : "", onClick: () => { setTool("eraser"); setLassoActive(false); }},
        { label: `Color & Width: \u25CF ${colorEntry.label} / ${widthEntry.label}`, onClick: () => {
          // Open the color/thickness sub-panel at the click position
          setColorPanel({ x: clientX, y: clientY });
        }},
        { label: "", separator: true },
      );

      // ── Select ──
      items.push(
        { label: "\u2500\u2500 Select \u2500\u2500", disabled: true },
        { label: "Freehand Lasso", shortcut: lassoActive && lassoMode === "freehand" ? "\u2713" : "", onClick: () => {
          if (!lassoActive) setTool("pen");
          toggleLasso("freehand");
        }},
        { label: "Rectangle Lasso", shortcut: lassoActive && lassoMode === "rect" ? "\u2713" : "", onClick: () => {
          if (!lassoActive) setTool("pen");
          toggleLasso("rect");
        }},
        { label: "", separator: true },
      );

      // ── Insert ──
      items.push(
        { label: "\u2500\u2500 Insert \u2500\u2500", disabled: true },
        { label: "Text Box", onClick: handleInsertTextBox },
        { label: "Table", onClick: handleInsertTable },
        { label: "Image\u2026", onClick: handleInsertImage },
        { label: "Image Annotator", onClick: handleInsertImageAnnotator },
        { label: "Formula Card", onClick: handleInsertFormulaCard },
        { label: "Unit Converter", onClick: handleInsertUnitConverter },
        { label: "Circuit Sniper", onClick: handleInsertCircuitSniper },
        { label: "PDF\u2026", onClick: handleInsertPdf },
        { label: "", separator: true },
      );

      // ── Canvas ──
      items.push(
        { label: "\u2500\u2500 Canvas \u2500\u2500", disabled: true },
        { label: "Undo", shortcut: "\u2318Z", disabled: !canUndo, onClick: handleUndoWrapped },
        { label: "Redo", shortcut: "\u21E7\u2318Z", disabled: !canRedo, onClick: handleRedoWrapped },
        { label: "", separator: true },
        { label: "Lock Zoom", shortcut: zoomLocked ? "\u2713" : "", onClick: () => setZoomLocked((v) => !v) },
        { label: "Grid Paper", shortcut: showGrid ? "\u2713" : "", onClick: () => setShowGrid((v) => !v) },
        { label: "", separator: true },
        { label: "Export PNG", onClick: () => {
          const dataUrl = renderStrokesToImage(strokes, 20, 2, stamps);
          if (!dataUrl) return;
          const link = document.createElement("a");
          link.download = `${currentPage || "canvas"}.png`;
          link.href = dataUrl;
          link.click();
        }},
        { label: "Clear Canvas", danger: true, onClick: () => {
          if (!confirm("Clear all strokes and stamps from this page?")) return;
          if (!confirm("Are you SURE? This wipes every stroke and stamp. Click OK only if you really mean it.")) return;
          pushUndo();
          setStrokes([]);
          setStamps([]);
        }},
      );
    }

    setCtxMenu({ x: clientX, y: clientY, items });
  }, [
    zoom, zoomLocked, scrollX, scrollY, canvasObjects, stamps, selectedObjectId, tool, activeColor, strokeWidth,
    lassoActive, lassoMode, canUndo, canRedo, strokes, currentPage, showGrid,
    setCanvasObjects, setSelectedObjectId, setStamps, setTool, setLassoActive, setActiveColor, setStrokeWidth,
    setZoomLocked, toggleLasso, handleUndoWrapped, handleRedoWrapped, zoomIn, zoomOut, resetZoom, pushUndo,
    handleInsertTextBox, handleInsertTable, handleInsertImage, handleInsertPdf,
    handleInsertImageAnnotator, handleInsertFormulaCard, handleInsertUnitConverter, handleInsertCircuitSniper,
  ]);

  /* ── Long-press hook for the canvas area ────────────────
   * On desktop: right-click fires the context menu immediately.
   * On iPad/touch: long-press (~500ms hold, no movement) fires it. */
  const canvasLongPress = useLongPress(
    useCallback((pos: { x: number; y: number }, e: React.PointerEvent | React.MouseEvent) => {
      // Don't hijack right-clicks on inputs/textareas/contenteditable so
      // those retain their native browser context menus.
      const target = e.target as HTMLElement | null;
      if (target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.closest("[contenteditable='true']")
      )) return;
      openCanvasContextMenu(pos.x, pos.y);
    }, [openCanvasContextMenu]),
  );

  /* ── Object long-press context menu (for CanvasObjectLayer) ── */
  const handleObjectContextMenu = useCallback((objId: string, clientX: number, clientY: number) => {
    const hitObj = canvasObjects.find((o) => o.id === objId);
    if (!hitObj) return;
    setSelectedObjectId(hitObj.id);
    const items: ContextMenuItem[] = [
      { label: "Rename\u2026", onClick: () => {
        const current = hitObj.name ?? "";
        const next = window.prompt("Rename this drop-in:", current);
        if (next !== null && next.trim()) {
          setCanvasObjects((prev) => prev.map((o) => o.id === hitObj.id ? { ...o, name: next.trim() } : o));
        }
      }},
      { label: "Duplicate", onClick: () => {
        const dup: CanvasObject = { ...hitObj, id: crypto.randomUUID(), x: hitObj.x + 24, y: hitObj.y + 24 };
        setCanvasObjects((prev) => [...prev, dup]);
        setSelectedObjectId(dup.id);
      }},
      { label: "", separator: true },
      { label: "Cut", shortcut: "\u2318X", onClick: () => {
        objectClipboardRef.current = { ...hitObj };
        setCanvasObjects((prev) => prev.filter((o) => o.id !== hitObj.id));
        setSelectedObjectId(null);
      }},
      { label: "Copy", shortcut: "\u2318C", onClick: () => {
        objectClipboardRef.current = { ...hitObj };
      }},
      { label: "", separator: true },
      { label: "Delete", danger: true, onClick: () => {
        setCanvasObjects((prev) => prev.filter((o) => o.id !== hitObj.id));
        if (selectedObjectId === hitObj.id) setSelectedObjectId(null);
      }},
    ];
    setCtxMenu({ x: clientX, y: clientY, items });
  }, [canvasObjects, selectedObjectId, setCanvasObjects, setSelectedObjectId]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataURL = ev.target?.result as string;
      if (dataURL) {
        const img = new window.Image();
        img.onload = async () => {
          const maxW = 400;
          const scale = Math.min(1, maxW / img.width);
          const obj = createImageObject(
            scrollX + 150, scrollY + 150,
            dataURL,
            img.width * scale,
            img.height * scale
          );
          // Save to vault if we have a section
          const sec = sectionRef.current;
          if (sec) {
            try {
              const vaultPath = await saveImageToVault(plugin, sec, obj.id, dataURL);
              obj.dataURL = vaultPath;
            } catch (err) {
              console.error("[Noteometry] image vault save failed:", err);
              new Notice("Image save failed — kept in memory only, may not sync across devices", 8000);
            }
          }
          setCanvasObjects((prev) => [...prev, obj]);
        };
        img.src = dataURL;
      }
    };
    reader.readAsDataURL(file);
  }, [scrollX, scrollY, plugin]);

  // Paste listener for images
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const handler = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = async (ev) => {
              const dataURL = ev.target?.result as string;
              if (dataURL) {
                const obj = createImageObject(scrollX + 150, scrollY + 150, dataURL);
                const sec = sectionRef.current;
                if (sec) {
                  try {
                    const vaultPath = await saveImageToVault(plugin, sec, obj.id, dataURL);
                    obj.dataURL = vaultPath;
                  } catch (err) {
                    console.error("[Noteometry] paste image vault save failed:", err);
                    new Notice("Pasted image save failed — kept in memory only, may not sync across devices", 8000);
                  }
                }
                setCanvasObjects((prev) => [...prev, obj]);
              }
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
    };
    el.addEventListener("paste", handler);
    return () => el.removeEventListener("paste", handler);
  }, [scrollX, scrollY, plugin]);

  /* ── Viewport change ─────────────────────────────────── */
  const handleViewportChange = useCallback((newX: number, newY: number) => {
    setScrollX(newX);
    setScrollY(newY);
  }, []);

  /* ── Cmd/Ctrl + wheel → zoom (desktop) ─────────────────── */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (zoomLocked) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      // Scroll up → zoom in; scroll down → zoom out.
      // Sensitivity: ~1 wheel tick per 0.05 zoom step.
      setZoom((z) => {
        const delta = -e.deltaY * 0.005;
        return clampZoom(Math.round((z + delta) * 100) / 100);
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [zoomLocked, clampZoom]);

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

  /* ── (Right panel resize removed — now handled by floating panel) ── */

  /* ── Render ──────────────────────────────────────────── */
  if (!ready) {
    return <div className="noteometry-loading">Loading Noteometry…</div>;
  }

  return (
    <div ref={containerRef} className="noteometry-container">
      {/* ── Sidebar ── */}
      <Sidebar
        plugin={plugin}
        currentSection={currentSection}
        currentPage={currentPage}
        onSelect={handleSelect}
        app={app}
      />

      {/* ── Main area ── */}
      <div className="noteometry-main">
        <div className="noteometry-split">
          {/* ── Canvas area ── */}
          <div ref={canvasAreaRef} className={`noteometry-canvas-area${lassoActive ? " noteometry-lasso-active" : ""}${pendingSymbol ? " noteometry-placing-symbol" : ""}`}
            onClick={handleCanvasAreaClick}
            {...canvasLongPress}
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

            {/* ── Viewport: the full drawing surface ── */}
            <div ref={viewportRef} className="noteometry-canvas-viewport">
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
                showGrid={showGrid}
                onZoomChange={(z) => setZoom(clampZoom(z))}
                onCycleTool={handleCycleTool}
                onViewportChange={handleViewportChange}
                disabled={lassoActive}
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
                onObjectContextMenu={handleObjectContextMenu}
                onSendToAI={processCrop}
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

              {/* P0-1: Zoom Widget — always visible, bottom-right. Includes undo/redo. */}
              <ZoomWidget
                zoom={zoom}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onReset={resetZoom}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={handleUndoWrapped}
                onRedo={handleRedoWrapped}
              />

              {/* P2-8: Stamp script toggle — appears below selected stamp */}
              {selectedStampId && (() => {
                const stamp = stamps.find(s => s.id === selectedStampId);
                if (!stamp) return null;
                const bb = stampBBox(stamp);
                // Convert world coords to screen coords
                const screenX = (bb.x - scrollX) * zoom;
                const screenY = (bb.y + bb.h - scrollY) * zoom + 4;
                const mode = stamp.scriptMode || 'norm';
                const setMode = (m: 'norm' | 'sub' | 'super') => {
                  setStamps(prev => prev.map(s => s.id === selectedStampId ? { ...s, scriptMode: m } : s));
                };
                return (
                  <div className="nm-stamp-script-toggle" style={{ position: 'absolute', left: screenX, top: screenY, zIndex: 1100 }}>
                    <button className={`nm-script-btn ${mode === 'sub' ? 'nm-script-active' : ''}`} onClick={() => setMode('sub')} title="Subscript">x&#x2082;</button>
                    <button className={`nm-script-btn ${mode === 'norm' ? 'nm-script-active' : ''}`} onClick={() => setMode('norm')} title="Normal">x</button>
                    <button className={`nm-script-btn ${mode === 'super' ? 'nm-script-active' : ''}`} onClick={() => setMode('super')} title="Superscript">x&#xB2;</button>
                  </div>
                );
              })()}
            </div>

            {/* Mini toolbar removed — all tools via context menu.
                Undo/redo moved to ZoomWidget. */}
          </div>
        </div>
      </div>

      {/* ── P1-7: Floating AI Panel ── */}
      {panelOpen && (() => {
        const containerRect = containerRef.current?.getBoundingClientRect();
        const cw = containerRect?.width ?? window.innerWidth;
        const ch = containerRect?.height ?? window.innerHeight;
        const dockedX = cw - fpSize.w;
        const posX = fpDocked ? dockedX : (fpPos.x < 0 ? dockedX : fpPos.x);
        const posY = fpDocked ? 0 : fpPos.y;
        return (
          <div
            className={`nm-floating-panel ${fpMinimized ? "nm-fp-minimized" : ""} ${fpDocked ? "nm-fp-docked" : ""}`}
            style={{
              position: "absolute",
              left: posX,
              top: posY,
              width: fpSize.w,
              height: fpMinimized ? 28 : fpSize.h,
              zIndex: 500,
              maxHeight: fpDocked ? "100%" : undefined,
            }}
          >
            {/* Title bar — drag handle */}
            <div
              className="nm-fp-titlebar"
              onPointerDown={(e) => {
                if (fpMinimized) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                fpDragRef.current = { startX: e.clientX, startY: e.clientY, posX, posY };
              }}
              onPointerMove={(e) => {
                if (!fpDragRef.current) return;
                const dx = e.clientX - fpDragRef.current.startX;
                const dy = e.clientY - fpDragRef.current.startY;
                const nx = Math.max(0, Math.min(cw - 100, fpDragRef.current.posX + dx));
                const ny = Math.max(0, Math.min(ch - 28, fpDragRef.current.posY + dy));
                setFpPos({ x: nx, y: ny });
                setFpDocked(false);
              }}
              onPointerUp={() => { fpDragRef.current = null; }}
            >
              <span className="nm-fp-drag-icon">⋮⋮</span>
              <span className="nm-fp-title">{fpMinimized ? "AI Panel ▼" : "AI Panel"}</span>
              <div className="nm-fp-titlebar-actions">
                {!fpDocked && !fpMinimized && (
                  <button className="nm-fp-dock-btn" onClick={() => { setFpDocked(true); setFpPos({ x: -1, y: 0 }); }} title="Dock">⬒</button>
                )}
                <button className="nm-fp-min-btn" onClick={() => setFpMinimized((v) => !v)} title={fpMinimized ? "Expand" : "Minimize"}>
                  {fpMinimized ? "▲" : "▬"}
                </button>
              </div>
            </div>
            {!fpMinimized && (
              <div className="nm-fp-body">
                {/* Resize handle on left edge */}
                <div
                  className="nm-fp-resize-left"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    fpResizeRef.current = { startX: e.clientX, startW: fpSize.w };
                    const onMove = (ev: PointerEvent) => {
                      ev.preventDefault();
                      if (!fpResizeRef.current) return;
                      const dx = fpResizeRef.current.startX - ev.clientX;
                      const nw = Math.max(280, Math.min(600, fpResizeRef.current.startW + dx));
                      setFpSize((prev) => ({ ...prev, w: nw }));
                    };
                    const onUp = () => {
                      fpResizeRef.current = null;
                      document.removeEventListener("pointermove", onMove);
                      document.removeEventListener("pointerup", onUp);
                      // Persist width to settings
                      plugin.saveSettings();
                    };
                    document.addEventListener("pointermove", onMove, { passive: false } as EventListenerOptions);
                    document.addEventListener("pointerup", onUp);
                  }}
                />
                <div className="nm-fp-content">
                  <Panel
                    inputCode={inputCode}
                    setInputCode={setInputCode}
                    onInsertSymbol={handleInsertSymbol}
                    onStampSymbol={(sym) => setPendingSymbol(sym)}
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
                    onSolve={handleSolveInput}
                    onClosePanel={() => setPanelOpen(false)}
                  />
                  <div className="noteometry-resize-handle" />
                  <div style={{ flex: 1, minHeight: 200 }}>
                    <ChatPanel
                      messages={chatMessages}
                      onSend={sendToChat}
                      onStop={stopChat}
                      onClear={() => setChatMessages([])}
                      loading={chatLoading}
                      onDropToCanvas={handleDropChatToCanvas}
                      presets={presets}
                      activePreset={activePreset}
                      onPresetChange={setActivePresetId}
                    />
                  </div>
                </div>
                {/* Bottom-right resize handle */}
                <div
                  className="nm-fp-resize-br"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    fpResizeBRRef.current = { startX: e.clientX, startY: e.clientY, startW: fpSize.w, startH: fpSize.h };
                    const onMove = (ev: PointerEvent) => {
                      ev.preventDefault();
                      if (!fpResizeBRRef.current) return;
                      const dx = ev.clientX - fpResizeBRRef.current.startX;
                      const dy = ev.clientY - fpResizeBRRef.current.startY;
                      const nw = Math.max(280, Math.min(600, fpResizeBRRef.current.startW + dx));
                      const nh = Math.max(400, Math.min(900, fpResizeBRRef.current.startH + dy));
                      setFpSize({ w: nw, h: nh });
                    };
                    const onUp = () => {
                      fpResizeBRRef.current = null;
                      document.removeEventListener("pointermove", onMove);
                      document.removeEventListener("pointerup", onUp);
                      plugin.saveSettings();
                    };
                    document.addEventListener("pointermove", onMove, { passive: false } as EventListenerOptions);
                    document.addEventListener("pointerup", onUp);
                  }}
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* Show panel button when minimized or closed */}
      {!panelOpen && (
        <button
          className="nm-fp-show-btn"
          onClick={() => setPanelOpen(true)}
          title="Show AI Panel"
        >
          AI Panel
        </button>
      )}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {colorPanel && (
        <ColorThicknessPanel
          activeColor={activeColor}
          activeWidth={strokeWidth}
          onColorChange={setActiveColor}
          onWidthChange={setStrokeWidth}
          anchorX={colorPanel.x}
          anchorY={colorPanel.y}
          onClose={() => setColorPanel(null)}
        />
      )}
    </div>
  );
}
