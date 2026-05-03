import React, { useState, useRef, useEffect, useCallback } from "react";
import { App, Notice, Platform, TFile } from "obsidian";
import type NoteometryPlugin from "../main";
import { stampBBox, newStampId, STAMP_SIZES, type StampSize } from "../lib/inkEngine";
import { renderStrokesToImage } from "../lib/canvasRenderer";
import {
  createTextBox, createTable, createImageObject, createPdfObject,
  createMathObject, createChatObject, stripRemovedObjects,
} from "../lib/canvasObjects";
import {
  saveImageBytesTo, savePdfBytesTo, rootDir,
  CanvasData,
} from "../lib/persistence";
import InkCanvas, { CanvasTool } from "./InkCanvas";
// CanvasToolbar removed — all tools now live in the right-click context menu
import CanvasObjectLayer from "./CanvasObjectLayer";
import LassoOverlay from "./LassoOverlay";
import type { LassoBounds } from "./LassoOverlay";
import ContextMenu from "./ContextMenu";
import type { ContextMenuItem } from "./ContextMenu";
import { buildClearCanvasAction, CLEAR_CANVAS_LABEL } from "../lib/canvasMenuActions";
import MathPalette from "./MathPalette";
import type { CanvasObject } from "../lib/canvasObjects";
import { makePastedObject } from "../lib/objectClipboard";
import { getAllTableData, loadAllTableData, getAllTextBoxData, loadAllTextBoxData, setOnChangeCallback, clearScope } from "../lib/tableStore";
import { shouldYieldToNativeScroll } from "../lib/wheelRouting";
import { useInk } from "../features/ink/useInk";
import { useLassoStack } from "../features/lasso/useLassoStack";
import type { LassoRegion } from "../features/lasso/useLassoStack";
import { useObjects } from "../features/objects/useObjects";
import { useAIActivity } from "../features/aiActivity";
import { useLayerManager } from "../features/layerManager";
import { useLayerGestures } from "../features/gestures/useLayerGestures";
import { ToolLayer } from "./layers/ToolLayer";
import { MetaLayer } from "./layers/MetaLayer";
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
  /** Bound page file. Null when the view hasn't finished loading yet. */
  file: TFile | null;
  /** Decoded CanvasData for the current file (null until loaded). */
  initialData: CanvasData | null;
  /** Increments whenever the view binds a new file, so React knows to re-hydrate. */
  initialDataToken: number;
  /** Write-callback supplied by the view; persists the current in-memory
   *  CanvasData to the bound file. */
  onSaveData: (data: CanvasData) => Promise<void>;
  /** Callback the view calls on mount so subsequent file-binds can push
   *  fresh initial data into the React tree without remounting. */
  registerInitialDataSetter: (
    setter: (data: CanvasData | null, token: number) => void,
  ) => void;
  /** Per-view flush bridge. NoteometryApp registers its own saveNow here
   *  so each open tab flushes to the right file — a module-level singleton
   *  would cause the most-recently-mounted tab to overwrite sibling tabs
   *  on unload. */
  registerFlushSave: (fn: (() => Promise<void>) | null) => void;
}

export default function NoteometryApp({
  plugin,
  app,
  file,
  initialData,
  initialDataToken,
  onSaveData,
  registerInitialDataSetter,
  registerFlushSave,
}: Props) {
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

  /* ── v1.11 phase-0: AI activity context handle ──────────────
     The app shell wraps NoteometryApp in <AIActivityProvider> in
     NoteometryView so this returns the live aggregator. Outside that
     provider (i.e. unit tests that mount NoteometryApp directly) it
     falls back to the no-op default and begin/end become free. */
  const aiActivity = useAIActivity();

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

  /* v1.10.0: usePipeline removed entirely. The right-side Panel + ChatPanel
     have been deleted; AI flow lives 100% on the lasso 123/ABC radial which
     spawns Math/Chat drop-ins on the canvas, and the Math Palette popup arms
     a pending stamp instead of typing into a now-nonexistent input box. */

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

  /* ── v1.11.0 phase-1 sub-PR 1.4: 3D layers wiring ────────────────
   * useLayerGestures binds 3F-swipe / 4F-tap recognition to the
   * container and routes results into LayerManager (paper | tool |
   * meta | frozen). Layer shells live below; CSS classes derived
   * from the layer state dim/lock the paper plane.
   *
   * Pen / 1F / 2F gestures pass through untouched — the recognizer's
   * peak-count rule means single-finger ink and 2F pan never
   * classify, and pen events only update the lockout clock. */
  const { layer: activeLayer } = useLayerManager();
  useLayerGestures(containerRef);
  const paperDimClass =
    activeLayer === "tool"
      ? " noteometry-paper-dim-tool"
      : activeLayer === "meta"
        ? " noteometry-paper-dim-meta"
        : activeLayer === "frozen"
          ? " noteometry-paper-frozen"
          : "";

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
  const [mathPaletteOpen, setMathPaletteOpen] = useState(false);

  /* ── Persistence coordination (file-bound) ─────────────────
   *
   * The bound TFile and its decoded CanvasData are owned by NoteometryView
   * and pushed in via props. We hydrate the feature hooks whenever the
   * `initialDataToken` changes (i.e. Obsidian rebinds the leaf to a new
   * file or the initial file finishes loading). Autosave debounces to
   * `onSaveData` which the view routes to vault.modify on the bound TFile.
   */
  const saveTimer = useRef<number>(0);
  const loadingPageRef = useRef(false);
  const [hydrated, setHydrated] = useState(initialData !== null);

  // Track the current file + data token via refs so saveNow closes over
  // the latest values without re-creating on every prop change.
  const fileRef = useRef<TFile | null>(file);
  useEffect(() => { fileRef.current = file; }, [file]);

  /** Per-page scope key for the table/textbox store. Falls back to a
   *  stable "orphan" token before the file is bound so in-memory edits
   *  on an unbound leaf don't collide with any real file's scope. */
  const scope = file?.path ?? "__orphan__";
  const onSaveDataRef = useRef(onSaveData);
  useEffect(() => { onSaveDataRef.current = onSaveData; }, [onSaveData]);

  // Indirection ref: flushPendingSave calls the latest saveNow without
  // re-binding autosave on every state update.
  const saveNowRef = useRef<() => Promise<void>>(async () => {});

  const flushPendingSave = useCallback(async () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = 0;
    }
    await saveNowRef.current();
  }, []);

  const hydrateFromData = useCallback((data: CanvasData) => {
    loadingPageRef.current = true;
    hydrateInk(data.strokes ?? [], data.stamps ?? []);
    // v1.10.0: silently strip any drop-in types we deleted (Circuit
    // Sniper, Calculator, etc.) before hydrating, and surface a one-time
    // Notice listing what was migrated so users aren't blindsided.
    const incoming = (data.canvasObjects ?? []) as unknown[];
    const { kept, removed } = stripRemovedObjects(incoming);
    hydrateObjects(kept);
    const removedEntries = Object.entries(removed);
    if (removedEntries.length > 0) {
      const summary = removedEntries
        .map(([label, count]) => `${count}× ${label}`)
        .join(", ");
      new Notice(
        `Noteometry v1.10: removed retired drop-ins from this page (${summary}).`,
        12000,
      );
    }
    loadAllTableData(scope, data.tableData ?? {});
    loadAllTextBoxData(scope, data.textBoxData ?? {});
    setScrollX(data.viewport?.scrollX ?? 0);
    setScrollY(data.viewport?.scrollY ?? 0);
    requestAnimationFrame(() => { loadingPageRef.current = false; });
  }, [hydrateInk, hydrateObjects, scope]);

  // Hydrate on first mount (and when the view pushes a new initial data
  // token for a newly-bound file).
  useEffect(() => {
    if (initialData) {
      hydrateFromData(initialData);
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDataToken]);

  // Expose a setter so NoteometryView can push new initial data into this
  // tree when Obsidian rebinds the leaf to a different file. We flush
  // any pending save for the OLD file first, then hydrate fresh state.
  useEffect(() => {
    registerInitialDataSetter((data: CanvasData | null, _token: number) => {
      (async () => {
        await flushPendingSave();
        if (data) {
          hydrateFromData(data);
          setHydrated(true);
        }
      })();
    });
  }, [registerInitialDataSetter, flushPendingSave, hydrateFromData]);

  const saveNow = useCallback(async () => {
    const f = fileRef.current;
    if (!f) return;
    const data: CanvasData = {
      version: 2,
      strokes,
      stamps,
      canvasObjects,
      viewport: { scrollX, scrollY },
      // v1.10.0: panelInput + chatMessages no longer exist (Panel + ChatPanel
      // deleted). Persist empty values so v1.9 readers stay happy.
      panelInput: "",
      chatMessages: [],
      tableData: getAllTableData(scope),
      textBoxData: getAllTextBoxData(scope),
      lastSaved: new Date().toISOString(),
    };
    await onSaveDataRef.current(data);
  }, [strokes, stamps, canvasObjects, scrollX, scrollY, scope]);

  useEffect(() => { saveNowRef.current = saveNow; }, [saveNow]);

  const doSave = useCallback(() => {
    if (!plugin.settings.autoSave) return;
    if (!fileRef.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await saveNow();
    }, plugin.settings.autoSaveDelay);
  }, [saveNow, plugin]);

  useEffect(() => { if (!loadingPageRef.current) doSave(); }, [strokes, stamps, canvasObjects]);
  useEffect(() => { return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }; }, []);

  useEffect(() => {
    setOnChangeCallback(scope, () => doSave());
    return () => setOnChangeCallback(scope, null);
  }, [doSave, scope]);

  // When this NoteometryApp unmounts (tab closed or leaf detached), drop
  // its scope from the store so long-running sessions don't accumulate
  // Maps for pages the user has closed.
  useEffect(() => {
    return () => { clearScope(scope); };
  }, [scope]);

  useEffect(() => {
    registerFlushSave(saveNow);
    return () => { registerFlushSave(null); };
  }, [saveNow, registerFlushSave]);

  /** Parent folder path of the bound file, used to scope attachment writes
   *  (and handed to CanvasObjectLayer for snapshot-to-canvas image saves). */
  const parentFolderPath = file?.parent?.path ?? rootDir(plugin);
  const ready = hydrated;
  const currentPage = file?.basename ?? "";

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

  /* ── Lasso 123 ── Render Equation
     Composite the lasso stack → spawn an empty (pending) MathDropin near
     the lasso → await readInk() → fill the LaTeX into the drop-in.
     Failure leaves the drop-in in place with an empty + non-pending state
     plus a Notice, so the user can fix-by-edit or delete it. */
  const handleProcess123 = useCallback(async () => {
    const snapshot = lassoRegions;
    if (snapshot.length === 0) return;
    const composite = await compositeRegions(snapshot.map((r) => r.capturedImage));
    if (!composite) {
      new Notice("Failed to composite lasso regions — see console", 8000);
      return;
    }
    // Anchor the math drop-in just below the bottom-right of the
    // bounding box of the most recent region, so it visually "falls
    // out" of what was lassoed.
    const last = snapshot[snapshot.length - 1];
    const anchorX = (last?.bounds?.maxX ?? scrollX + 200) + 16;
    const anchorY = last?.bounds?.minY ?? scrollY + 200;
    const obj = createMathObject(anchorX, anchorY, "", true);
    setCanvasObjects((prev) => [...prev, obj]);
    setSelectedObjectId(obj.id);
    clearStack();
    setLassoActive(false);

    // Lazy import to avoid pulling lib/ai into modules that don't need it.
    const { readInk } = await import("../lib/ai");
    // v1.11 phase-0: ping AI activity context so the app-level ribbon and
    // any future freeze observer can see this vision call as live.
    const callId = aiActivity.begin();
    try {
      const res = await readInk(composite, plugin.settings);
      setCanvasObjects((prev) => prev.map((o) =>
        o.id === obj.id && o.type === "math"
          ? { ...o, latex: res.ok ? res.text.trim() : "", pending: false }
          : o,
      ));
      if (!res.ok) new Notice(res.error ?? "123 failed — vision returned no text", 6000);
    } catch (err) {
      console.error("[Noteometry] 123 vision call failed:", err);
      setCanvasObjects((prev) => prev.map((o) =>
        o.id === obj.id && o.type === "math" ? { ...o, pending: false } : o,
      ));
      new Notice("123 failed — see console", 6000);
    } finally {
      aiActivity.end(callId);
    }
  }, [lassoRegions, clearStack, setLassoActive, scrollX, scrollY, setCanvasObjects, setSelectedObjectId, plugin, aiActivity]);

  /* ── Lasso ABC ── Ask a Question
     Composite the stack → spawn an empty ChatDropin with the image pinned.
     User types/speaks the question; the first send packages the image as
     the attachment. No pre-vision pass — the chat model handles it. */
  const handleProcessABC = useCallback(async () => {
    const snapshot = lassoRegions;
    if (snapshot.length === 0) return;
    const composite = await compositeRegions(snapshot.map((r) => r.capturedImage));
    if (!composite) {
      new Notice("Failed to composite lasso regions — see console", 8000);
      return;
    }
    const last = snapshot[snapshot.length - 1];
    const anchorX = (last?.bounds?.maxX ?? scrollX + 200) + 16;
    const anchorY = last?.bounds?.minY ?? scrollY + 200;
    const obj = createChatObject(anchorX, anchorY, { attachedImage: composite });
    setCanvasObjects((prev) => [...prev, obj]);
    setSelectedObjectId(obj.id);
    clearStack();
    setLassoActive(false);
  }, [lassoRegions, clearStack, setLassoActive, scrollX, scrollY, setCanvasObjects, setSelectedObjectId]);

  /* ── Math → Solve ──
     User clicked Solve on a math drop-in. Spawn a ChatDropin offset to
     the right, seeded with the LaTeX. The ChatDropin auto-fires its
     first turn through the v12 system prompt. */
  const handleSolveMath = useCallback((mathDropinId: string) => {
    const math = canvasObjects.find((o) => o.id === mathDropinId && o.type === "math");
    if (!math || math.type !== "math" || !math.latex.trim()) return;
    const chat = createChatObject(
      math.x + math.w + 24,
      math.y,
      { seedLatex: math.latex },
    );
    setCanvasObjects((prev) => [...prev, chat]);
    setSelectedObjectId(chat.id);
  }, [canvasObjects, setCanvasObjects, setSelectedObjectId]);

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

  /* v1.10.0: handleDropChatToCanvas removed — ChatDropin already lives ON the canvas. */


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

  /* v1.10.0: All engineering + math-tool + study + legacy-AI drop-in
     inserters removed. The surviving factories (Text/Table/Image/PDF/
     Math/Chat) use the insertDropin helper where applicable; Math and
     Chat are never inserted manually — they only spawn from the lasso
     123/ABC radial or from Solve on a math drop-in. */

  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    e.target.value = "";
    try {
      const bytes = await picked.arrayBuffer();
      const obj = createPdfObject(scrollX + 80, scrollY + 80, "");
      const f = fileRef.current;
      if (!f) {
        new Notice("Can't insert PDF — no Noteometry page is open.", 6000);
        return;
      }
      const vaultPath = await savePdfBytesTo(app, f.parent?.path ?? rootDir(plugin), obj.id, bytes);
      obj.fileRef = vaultPath;
      setCanvasObjects((prev) => [...prev, obj]);
      setTool("select");
      setSelectedObjectId(obj.id);
    } catch (err) {
      console.error("[Noteometry] PDF insert failed:", err);
      new Notice("PDF insert failed — see console", 8000);
    }
  }, [scrollX, scrollY, plugin, app, setCanvasObjects, setSelectedObjectId]);

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

      // v1.10.0: Engineering / Math Tools / Study / Canvas sections
      // are gone. The right-click hub is now four insertable kinds
      // (Text/Table/Image/PDF), the Math Palette toggle, and Export PNG.
      // Everything else (zoom, undo/redo/clear, ink color/width) lives
      // pinned at the top of this same menu via the existing helpers,
      // or as keyboard shortcuts. AI flow lives entirely on the lasso
      // 123/ABC radial — not here.
      items.push(
        { label: "Math Palette", icon: "🧮", shortcut: mathPaletteOpen ? "\u2713" : "", onClick: () => setMathPaletteOpen(p => !p) },
        { label: "", separator: true },
        { label: "Export PNG", icon: "🖼️", onClick: () => {
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
    mathPaletteOpen,
  ]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
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
          console.error("[Noteometry] image decode failed for", picked.name);
          new Notice(`Can't decode image "${picked.name}" — unsupported format?`, 8000);
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
            // Save to the bound page's attachments folder if we can; otherwise
            // the dataURL stays in memory (still renders, won't sync).
            const f = fileRef.current;
            if (f) {
              try {
                const vaultPath = await saveImageBytesTo(app, f.parent?.path ?? rootDir(plugin), obj.id, dataURL);
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
      reader.readAsDataURL(picked);
    } catch (err) {
      console.error("[Noteometry] image insert outer error:", err);
      new Notice("Couldn't insert Image — see console", 8000);
    }
  }, [scrollX, scrollY, plugin, app, setCanvasObjects, setSelectedObjectId]);

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
              const f = fileRef.current;
              if (f) {
                try {
                  const vaultPath = await saveImageBytesTo(app, f.parent?.path ?? rootDir(plugin), obj.id, dataURL);
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
  }, [scrollX, scrollY, plugin, app, pushUndo, setCanvasObjects, setSelectedObjectId]);

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

  /* v1.10.0: panel + chat resize handlers removed along with the right sidebar. */

  /* ── Render ──────────────────────────────────────────── */
  if (!ready) {
    return <div className="noteometry-loading">Loading Noteometry…</div>;
  }

  return (
    <div ref={containerRef} className="noteometry-container noteometry-container-native-explorer">
      {/* v1.11.0 phase-1 sub-PR 1.4: layer shells. Both layers always
          mount; their visibility is driven by LayerManager state via
          useLayerManager() inside the components. They sit OUTSIDE
          .noteometry-main so the dim class applied to main doesn't
          dim them too. */}
      <ToolLayer />
      <MetaLayer />
      {/* ── Main area ── (Obsidian's file explorer is the page navigator) */}
      <div className={`noteometry-main${paperDimClass}`}>
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
                parentFolder={parentFolderPath}
                scope={scope}
                onSolveMath={handleSolveMath}
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
                onProcess123={handleProcess123}
                onProcessABC={handleProcessABC}
                onMoveComplete={handleLassoMoveComplete}
              />

              {/* Mobile-only Tools FAB. Gated by Platform.isMobile (runtime,
                  reliable inside Obsidian's webview) instead of CSS media
                  queries — those misfire on iPad when an Apple Pencil is paired
                  (pencil reports as fine pointer; landscape > 768px), leaving
                  the canvas with no reachable tool entry on touch devices. */}
              {Platform.isMobile && (
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
              )}

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

          {/* v1.10.0: Right side panel removed entirely. Both Panel (LaTeX
              input + preview) and ChatPanel (sidebar chat) are gone. The
              new flow is canvas-first: lasso → 123/ABC radial spawns Math
              or Chat drop-ins on the canvas itself. The Math Palette popup
              (right-click → Math Palette) replaces the in-panel symbol grid. */}
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
            // v1.10.0: There is no longer an Input box to insert into.
            // Pure-glyph buttons still arm a stamp via onArmStamp; for the
            // structural-LaTeX buttons we route the same way — the user
            // wanted symbols to land *on the canvas*, not in a sidebar.
            onInsert={(latex) => {
              setPendingSymbol(latex);
              setMathPaletteOpen(false);
            }}
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
