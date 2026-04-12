import React, { useState, useRef, useEffect, useCallback } from "react";
import { App, Notice } from "obsidian";
import type NoteometryPlugin from "../main";
import { strokeIntersectsPolygon, stampIntersectsPolygon, stampBBox, newStampId } from "../lib/inkEngine";
import { renderStrokesToImage } from "../lib/canvasRenderer";
import { createTextBox, createTable, createImageObject, createPdfObject } from "../lib/canvasObjects";
import { savePage, saveImageToVault, savePdfToVault, CanvasData } from "../lib/persistence";
import InkCanvas, { CanvasTool } from "./InkCanvas";
// CanvasToolbar removed — all tools now live in the right-click context menu
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
import { rasterizeRegion } from "../features/lasso/rasterize";
import { compositeRegions } from "../features/lasso/composite";

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
        { label: "Select (Pointer)", shortcut: tool === "select" && !lassoActive ? "\u2713" : "", onClick: () => { setTool("select"); setLassoActive(false); }},
        { label: "Pen", shortcut: tool === "pen" && !lassoActive ? "\u2713" : "", onClick: () => { setTool("pen"); setLassoActive(false); }},
        { label: "Eraser", shortcut: tool === "eraser" ? "\u2713" : "", onClick: () => { setTool("eraser"); setLassoActive(false); }},
        { label: `Color: \u25CF ${colorEntry.label}`, onClick: nextColor },
        { label: `Width: \u2500\u2500 ${widthEntry.label}`, onClick: nextWidth },
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
        { label: "PDF\u2026", onClick: handleInsertPdf },
        { label: "", separator: true },
      );

      // ── Canvas ──
      items.push(
        { label: "\u2500\u2500 Canvas \u2500\u2500", disabled: true },
        { label: "Undo", shortcut: "\u2318Z", disabled: !canUndo, onClick: handleUndoWrapped },
        { label: "Redo", shortcut: "\u21E7\u2318Z", disabled: !canRedo, onClick: handleRedoWrapped },
        { label: "", separator: true },
        { label: "Zoom In", shortcut: `${Math.round(zoom * 100)}%`, onClick: zoomIn },
        { label: "Zoom Out", onClick: zoomOut },
        { label: "Reset Zoom (100%)", onClick: resetZoom },
        { label: "Lock Zoom", shortcut: zoomLocked ? "\u2713" : "", onClick: () => setZoomLocked((v) => !v) },
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

    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  }, [
    zoom, zoomLocked, scrollX, scrollY, canvasObjects, stamps, selectedObjectId, tool, activeColor, strokeWidth,
    lassoActive, lassoMode, canUndo, canRedo, strokes, currentPage,
    setCanvasObjects, setSelectedObjectId, setStamps, setTool, setLassoActive, setActiveColor, setStrokeWidth,
    setZoomLocked, toggleLasso, handleUndoWrapped, handleRedoWrapped, zoomIn, zoomOut, resetZoom, pushUndo,
    handleInsertTextBox, handleInsertTable, handleInsertImage, handleInsertPdf,
  ]);

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
      {/* ── Sidebar ── */}
      <Sidebar
        plugin={plugin}
        currentSection={currentSection}
        currentPage={currentPage}
        onSelect={handleSelect}
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
              />

              {/* Lasso overlay — operates within the viewport */}
              <LassoOverlay
                active={lassoActive}
                mode={lassoMode}
                containerRef={viewportRef as React.RefObject<HTMLDivElement>}
                regions={lassoRegions}
                onComplete={handleLassoComplete}
                onCancel={clearStack}
                onClear={clearStack}
                onProcess={handleProcessStack}
                onMoveComplete={handleLassoMoveComplete}
              />
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
              <div className="noteometry-right-inner">
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
                <div
                  className="noteometry-resize-handle"
                  onPointerDown={handleChatResizeDown}
                  onPointerMove={handleChatResizeMove}
                  onPointerUp={handleChatResizeUp}
                />
                <div style={{ height: chatHeight, flexShrink: 0 }}>
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
    </div>
  );
}
