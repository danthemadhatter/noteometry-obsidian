import React, { useState, useRef, useEffect, useCallback } from "react";
import { App, Notice } from "obsidian";
import type NoteometryPlugin from "../main";
import { strokeIntersectsPolygon, stampIntersectsPolygon, stampBBox, newStampId } from "../lib/inkEngine";
import { renderStrokesToImage } from "../lib/canvasRenderer";
import { createTextBox, createTable, createImageObject } from "../lib/canvasObjects";
import { savePage, saveImageToVault, CanvasData } from "../lib/persistence";
import InkCanvas, { CanvasTool } from "./InkCanvas";
import CanvasToolbar from "./CanvasToolbar";
import CanvasObjectLayer from "./CanvasObjectLayer";
import Panel from "./Panel";
import ChatPanel from "./ChatPanel";
import Sidebar from "./Sidebar";
import LassoOverlay from "./LassoOverlay";
import type { LassoBounds } from "./LassoOverlay";
import { getAllTableData, loadAllTableData, getAllTextBoxData, loadAllTextBoxData, setOnChangeCallback } from "../lib/tableStore";
import { useInk } from "../features/ink/useInk";
import { useLassoStack } from "../features/lasso/useLassoStack";
import type { LassoRegion } from "../features/lasso/useLassoStack";
import { useObjects } from "../features/objects/useObjects";
import { usePipeline } from "../features/pipeline/usePipeline";
import { usePages } from "../features/pages/usePages";
import { rasterizeRegion } from "../features/lasso/rasterize";
import { compositeRegions } from "../features/lasso/composite";

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
    lassoActive, setLassoActive, regions: lassoRegions,
    pushRegion, clearStack, toggleLasso,
  } = useLassoStack();

  /* ── Objects feature: canvas objects + selection ─── */
  const {
    canvasObjects, selectedObjectId,
    setCanvasObjects, setSelectedObjectId,
    hydrate: hydrateObjects,
  } = useObjects();

  /* ── Pipeline feature: panel input + chat + READ INK + solve + presets ─── */
  const {
    inputCode, chatMessages, isReading, chatLoading,
    presets, activePreset,
    setInputCode, setChatMessages, setActivePresetId,
    sendToChat, processCrop, handleSolveInput, handleInsertSymbol,
    hydrate: hydratePipeline,
  } = usePipeline(plugin);

  /* ── Composition-layer state ─── */
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [zoomLocked, setZoomLocked] = useState(false);

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

  const toggleZoomLock = useCallback(() => {
    setZoomLocked((v) => !v);
  }, []);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
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
    if (target.closest(".noteometry-canvas-object, .noteometry-canvas-toolbar")) return;

    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left + scrollX;
    const clickY = e.clientY - rect.top + scrollY;

    // Place pending symbol from palette (tap to place on touch devices)
    if (pendingSymbol) {
      setStamps(prev => [...prev, {
        id: newStampId(), x: clickX, y: clickY,
        text: pendingSymbol, fontSize: 28, color: activeColor,
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
      viewport: { scrollX, scrollY },
      panelInput: inputCode,
      chatMessages,
      tableData: getAllTableData(),
      textBoxData: getAllTextBoxData(),
      lastSaved: new Date().toISOString(),
    };
    await savePage(plugin, sec, pg, data);
  }, [strokes, stamps, canvasObjects, scrollX, scrollY, inputCode, chatMessages, plugin, sectionRef, pageRef]);

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
    const container = canvasAreaRef.current;
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

  const handleInsertTable = useCallback(() => {
    const obj = createTable(scrollX + 200, scrollY + 200);
    setCanvasObjects((prev) => [...prev, obj]);
    setTool("select");
    setSelectedObjectId(obj.id);
  }, [scrollX, scrollY]);

  const handleInsertImage = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

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
    const el = canvasAreaRef.current;
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
        fontSize: 28,
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

            {/* Floating toolbar */}
            <CanvasToolbar
              tool={tool}
              onToolChange={(t) => { setTool(t); setLassoActive(false); }}
              lassoActive={lassoActive}
              onLassoToggle={() => {
                if (!lassoActive) setTool("pen");
                toggleLasso();
              }}
              activeColor={activeColor}
              onColorChange={setActiveColor}
              strokeWidth={strokeWidth}
              onStrokeWidthChange={setStrokeWidth}
              onInsertTextBox={handleInsertTextBox}
              onInsertTable={handleInsertTable}
              onInsertImage={handleInsertImage}
              onUndo={handleUndoWrapped}
              onRedo={handleRedoWrapped}
              canUndo={canUndo}
              canRedo={canRedo}
              onClearCanvas={() => {
                if (confirm("Clear all strokes and stamps from this page?")) {
                  pushUndo();
                  setStrokes([]);
                  setStamps([]);
                }
              }}
              onExportImage={() => {
                const dataUrl = renderStrokesToImage(strokes, 20, 2, stamps);
                if (!dataUrl) return;
                const link = document.createElement("a");
                link.download = `${currentPage || "canvas"}.png`;
                link.href = dataUrl;
                link.click();
              }}
            />

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

            {/* Lasso overlay */}
            <LassoOverlay
              active={lassoActive}
              containerRef={canvasAreaRef as React.RefObject<HTMLDivElement>}
              regions={lassoRegions}
              onComplete={handleLassoComplete}
              onCancel={clearStack}
              onClear={clearStack}
              onProcess={handleProcessStack}
              onMoveComplete={handleLassoMoveComplete}
            />

            {/* Zoom controls — floating pill, bottom-right */}
            <div className="noteometry-zoom-controls">
              <button
                className="noteometry-zoom-btn"
                onClick={zoomOut}
                disabled={zoomLocked || zoom <= 0.25}
                title="Zoom out"
              >
                −
              </button>
              <button
                className="noteometry-zoom-btn noteometry-zoom-percent"
                onClick={resetZoom}
                disabled={zoomLocked}
                title="Reset to 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                className="noteometry-zoom-btn"
                onClick={zoomIn}
                disabled={zoomLocked || zoom >= 4}
                title="Zoom in"
              >
                +
              </button>
              <button
                className={`noteometry-zoom-btn noteometry-zoom-lock ${zoomLocked ? "locked" : ""}`}
                onClick={toggleZoomLock}
                title={zoomLocked ? "Unlock zoom" : "Lock zoom (prevents accidental changes)"}
              >
                {zoomLocked ? "L" : "U"}
              </button>
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
                    // Direct stamp placement from touch drag
                    const rect = canvasAreaRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const x = screenX - rect.left + scrollX;
                    const y = screenY - rect.top + scrollY;
                    setStamps(prev => [...prev, {
                      id: newStampId(), x, y,
                      text: display, fontSize: 28, color: activeColor,
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
                    onClear={() => setChatMessages([])}
                    loading={chatLoading}
                    presets={presets}
                    activePresetId={activePreset.id}
                    onPresetChange={setActivePresetId}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
