import React, { useState, useRef, useEffect, useCallback } from "react";
import { App } from "obsidian";
import type NoteometryPlugin from "../main";
import type { ChatMessage, Attachment } from "../types";
import type { Stroke, Stamp } from "../lib/inkEngine";
import type { CanvasObject } from "../lib/canvasObjects";
import { strokeIntersectsPolygon, stampIntersectsPolygon, stampBBox } from "../lib/inkEngine";
import { renderStrokesToImage, renderLassoRegionToImage } from "../lib/canvasRenderer";
import { createTextBox, createTable, createImageObject } from "../lib/canvasObjects";
import { newStampId } from "../lib/inkEngine";
import { readInk, chat, solve } from "../lib/ai";
import {
  savePage, loadPage, listSections, listPages,
  createSection, createPage, migrateLegacy, migrateJsonToMd,
  CanvasData,
} from "../lib/persistence";
import InkCanvas, { CanvasTool } from "./InkCanvas";
import CanvasToolbar from "./CanvasToolbar";
import CanvasObjectLayer from "./CanvasObjectLayer";
import Panel from "./Panel";
import ChatPanel from "./ChatPanel";
import Sidebar from "./Sidebar";
import LassoOverlay from "./LassoOverlay";
import type { LassoBounds } from "./LassoOverlay";
import { getAllTableData, loadAllTableData, getAllTextBoxData, loadAllTextBoxData, setOnChangeCallback } from "../lib/tableStore";

interface Props {
  plugin: NoteometryPlugin;
  app: App;
}

/** Called by NoteometryView.onClose to flush pending saves */
export let flushSave: (() => Promise<void>) | null = null;

export default function NoteometryApp({ plugin, app }: Props) {
  /* ── Canvas state ────────────────────────────────────── */
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [canvasObjects, setCanvasObjects] = useState<CanvasObject[]>([]);
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [activeColor, setActiveColor] = useState("#1e1e1e");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [lassoActive, setLassoActive] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const [pendingSymbol, setPendingSymbol] = useState<string | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Swipe blocking is handled in NoteometryView.ts at the view boundary

  // Clear selection when switching away from select tool
  useEffect(() => {
    if (tool !== "select") {
      setSelectedObjectId(null);
      setSelectedStampId(null);
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

  /* ── Undo/Redo (snapshots of strokes + stamps) ────────── */
  interface UndoSnapshot { strokes: Stroke[]; stamps: Stamp[] }
  const undoStackRef = useRef<UndoSnapshot[]>([]);
  const redoStackRef = useRef<UndoSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushUndo = useCallback(() => {
    undoStackRef.current.push({ strokes, stamps });
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [strokes, stamps]);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop()!;
    redoStackRef.current.push({ strokes, stamps });
    setStrokes(prev.strokes);
    setStamps(prev.stamps);
    setSelectedStampId(null);
    setSelectedObjectId(null);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  }, [strokes, stamps]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push({ strokes, stamps });
    setStrokes(next.strokes);
    setStamps(next.stamps);
    setSelectedStampId(null);
    setSelectedObjectId(null);
    setCanRedo(redoStackRef.current.length > 0);
    setCanUndo(true);
  }, [strokes, stamps]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        const tag = (e.target as HTMLElement)?.tagName;
        const editable = (e.target as HTMLElement)?.isContentEditable;
        if (tag === "INPUT" || tag === "TEXTAREA" || editable) return;
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  /* ── Stroke changes (with undo tracking) ─────────────── */
  const erasingRef = useRef(false);
  const handleStrokesChange = useCallback((newStrokes: Stroke[]) => {
    if (!erasingRef.current) pushUndo();
    setStrokes(newStrokes);
  }, [pushUndo]);

  /* ── Panel state ──────────────────────────────────────── */
  const [inputCode, setInputCode] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  /* ── Chat state ───────────────────────────────────────── */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  /* ── Section / Page state ─────────────────────────────── */
  const [currentSection, setCurrentSection] = useState("");
  const [currentPage, setCurrentPage] = useState("");
  const sectionRef = useRef("");
  const pageRef = useRef("");

  /* ── Persistence ──────────────────────────────────────── */
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<number>(0);

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
  }, [strokes, stamps, canvasObjects, scrollX, scrollY, inputCode, chatMessages, plugin]);

  const doSave = useCallback(() => {
    if (!plugin.settings.autoSave) return;
    if (!sectionRef.current || !pageRef.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await saveNow();
    }, plugin.settings.autoSaveDelay);
  }, [saveNow, plugin]);

  const loadingPageRef = useRef(false);
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

  /* ── Section/page selection ──────────────────────────── */
  const handleSelect = useCallback(async (section: string, page: string) => {
    // Clear pending debounced save to prevent it firing for the wrong page
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = 0;
    }
    await saveNow();

    if (section && !page) {
      const pages = await listPages(plugin, section);
      page = pages[0] ?? "";
    }

    sectionRef.current = section;
    pageRef.current = page;
    setCurrentSection(section);
    setCurrentPage(page);

    loadingPageRef.current = true;
    if (section && page) {
      const data = await loadPage(plugin, section, page);
      setInputCode(data.panelInput ?? "");
      setChatMessages(data.chatMessages ?? []);
      setStrokes(data.strokes ?? []);
      setStamps(data.stamps ?? []);
      setCanvasObjects(data.canvasObjects ?? []);
      setScrollX(data.viewport?.scrollX ?? 0);
      setScrollY(data.viewport?.scrollY ?? 0);
      loadAllTableData(data.tableData ?? {});
      loadAllTextBoxData(data.textBoxData ?? {});
      undoStackRef.current = [];
      redoStackRef.current = [];
      setCanUndo(false);
      setCanRedo(false);
    } else {
      setInputCode("");
      setChatMessages([]);
      setStrokes([]);
      setStamps([]);
      setCanvasObjects([]);
      setScrollX(0);
      setScrollY(0);
    }
    // Clear loading flag after React processes the state updates
    requestAnimationFrame(() => { loadingPageRef.current = false; });
  }, [plugin, saveNow]);

  /* ── Initial load ────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await migrateJsonToMd(plugin);
      const migrated = await migrateLegacy(plugin);
      const secs = await listSections(plugin);
      if (cancelled) return;

      let sec = "";
      let pg = "";

      if (migrated) {
        sec = migrated.section;
        pg = migrated.page;
      } else if (secs.length > 0) {
        sec = secs[0]!;
        const pages = await listPages(plugin, sec);
        pg = pages[0] ?? "";
      } else {
        sec = "My Course";
        pg = "Week 1";
        await createSection(plugin, sec);
        for (let i = 1; i <= 16; i++) {
          await createPage(plugin, sec, `Week ${i}`);
        }
      }

      if (cancelled) return;
      sectionRef.current = sec;
      pageRef.current = pg;
      setCurrentSection(sec);
      setCurrentPage(pg);

      if (sec && pg) {
        const data = await loadPage(plugin, sec, pg);
        if (!cancelled) {
          setInputCode(data.panelInput ?? "");
          setChatMessages(data.chatMessages ?? []);
          setStrokes(data.strokes ?? []);
          setStamps(data.stamps ?? []);
          setCanvasObjects(data.canvasObjects ?? []);
          setScrollX(data.viewport?.scrollX ?? 0);
          setScrollY(data.viewport?.scrollY ?? 0);
          loadAllTableData(data.tableData ?? {});
          loadAllTextBoxData(data.textBoxData ?? {});
        }
      }

      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Send to chat helper ─────────────────────────────── */
  const sendToChat = async (userText: string, atts: Attachment[] = []) => {
    const userMsg: ChatMessage = { role: "user", text: userText };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatLoading(true);
    try {
      const res = await chat(newHistory, atts, plugin.settings);
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        text: res.ok ? res.text : (res.error ?? "No response"),
      }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", text: "AI request failed." }]);
    }
    setChatLoading(false);
  };

  /* ── READ INK → OCR → auto-solve ────────────────────── */
  const pendingLassoCropRef = useRef<string | null>(null);

  const handleReadInk = async () => {
    const lassoCrop = pendingLassoCropRef.current;
    if (!lassoCrop) {
      setLassoActive(true);
      return;
    }
    pendingLassoCropRef.current = null;
    setLassoActive(false);

    setIsReading(true);
    try {
      const res = await readInk(lassoCrop, plugin.settings);
      if (res.ok && res.text.trim()) {
        setInputCode(res.text);
        setIsReading(false);
        // Also send the original image as an attachment so the AI can see
        // diagrams, figures, and context that text extraction might miss
        const imgAttachment = {
          name: "lasso-capture.png",
          mimeType: "image/png",
          data: lassoCrop,
        };
        await sendToChat(`Solve this:\n${res.text}`, [imgAttachment]);
        return;
      } else {
        setChatMessages((prev) => [...prev, {
          role: "assistant",
          text: res.error ?? "READ INK couldn't extract anything from the selection.",
        }]);
      }
    } catch {
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        text: "Vision API failed.",
      }]);
    }
    setIsReading(false);
  };

  // Keep a ref to handleReadInk so handleLassoComplete can call the latest version
  const handleReadInkRef = useRef(handleReadInk);
  handleReadInkRef.current = handleReadInk;

  /* ── Lasso complete → high-res crop of EVERYTHING visible ── */
  const handleLassoComplete = useCallback(async (bounds: LassoBounds) => {
    // Convert lasso polygon from screen coords to scene coords
    const scenePolygon = bounds.points.map((p) => ({
      x: p.x + scrollX,
      y: p.y + scrollY,
    }));

    // Scene-space bounding box of the lasso
    const regionBounds = {
      minX: bounds.minX + scrollX,
      minY: bounds.minY + scrollY,
      maxX: bounds.maxX + scrollX,
      maxY: bounds.maxY + scrollY,
    };

    // Filter strokes AND stamps that intersect the lasso polygon
    const selectedStrokes = strokes.filter((s) => strokeIntersectsPolygon(s, scenePolygon));
    const selectedStamps = stamps.filter((s) => stampIntersectsPolygon(s, scenePolygon));

    // Filter canvas objects that overlap the lasso bounding box
    const selectedObjects = canvasObjects.filter((obj) => {
      const objRight = obj.x + obj.w;
      const objBottom = obj.y + obj.h;
      return !(objRight < regionBounds.minX || obj.x > regionBounds.maxX ||
               objBottom < regionBounds.minY || obj.y > regionBounds.maxY);
    });

    if (selectedStrokes.length === 0 && selectedStamps.length === 0 && selectedObjects.length === 0) return;

    // Render the full region (strokes + stamps + images/objects) at 3x for OCR
    const dataUrl = await renderLassoRegionToImage(
      regionBounds, selectedStrokes, selectedStamps, selectedObjects, 30, 3
    );
    if (dataUrl) {
      pendingLassoCropRef.current = dataUrl;
      // Lasso stays visible — user taps OCR to process, or lasso toggle to cancel
    } else {
      // Nothing captured — dismiss lasso
      setLassoActive(false);
    }
  }, [strokes, stamps, canvasObjects, scrollX, scrollY]);

  /* ── Chat ────────────────────────────────────────────── */
  const handleSendChat = async (text: string, attachments: Attachment[]) => {
    await sendToChat(text, attachments);
  };

  /* ── Solve from Input box ────────────────────────────── */
  const handleSolveInput = async () => {
    if (!inputCode.trim()) return;
    setChatMessages(prev => [...prev, { role: "user", text: inputCode }]);
    setChatLoading(true);
    try {
      const res = await solve(inputCode, plugin.settings);
      setChatMessages(prev => [...prev, {
        role: "assistant",
        text: res.ok ? res.text : (res.error ?? "Solve failed."),
      }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", text: "Solver error." }]);
    }
    setChatLoading(false);
  };

  /* ── Symbol insertion ────────────────────────────────── */
  const handleInsertSymbol = (sym: string) => {
    setInputCode((prev) => prev + sym);
  };

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
    reader.onload = (ev) => {
      const dataURL = ev.target?.result as string;
      if (dataURL) {
        const img = new window.Image();
        img.onload = () => {
          const maxW = 400;
          const scale = Math.min(1, maxW / img.width);
          const obj = createImageObject(
            scrollX + 150, scrollY + 150,
            dataURL,
            img.width * scale,
            img.height * scale
          );
          setCanvasObjects((prev) => [...prev, obj]);
        };
        img.src = dataURL;
      }
    };
    reader.readAsDataURL(file);
  }, [scrollX, scrollY]);

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
            reader.onload = (ev) => {
              const dataURL = ev.target?.result as string;
              if (dataURL) {
                const obj = createImageObject(scrollX + 150, scrollY + 150, dataURL);
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
  }, [scrollX, scrollY]);

  /* ── Viewport change ─────────────────────────────────── */
  const handleViewportChange = useCallback((newX: number, newY: number) => {
    setScrollX(newX);
    setScrollY(newY);
  }, []);

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
                setLassoActive((prev) => {
                  if (!prev) setTool("pen");
                  else pendingLassoCropRef.current = null;
                  return !prev;
                });
              }}
              activeColor={activeColor}
              onColorChange={setActiveColor}
              strokeWidth={strokeWidth}
              onStrokeWidthChange={setStrokeWidth}
              onInsertTextBox={handleInsertTextBox}
              onInsertTable={handleInsertTable}
              onInsertImage={handleInsertImage}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
              onReadInk={handleReadInk}
              isReading={isReading}
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
              onStampsChange={(newStamps: Stamp[]) => { if (!erasingRef.current) pushUndo(); setStamps(newStamps); }}
              onEraseStart={() => { erasingRef.current = true; pushUndo(); }}
              onEraseEnd={() => { erasingRef.current = false; }}
              activeColor={activeColor}
              strokeWidth={strokeWidth}
              tool={tool}
              onToolChange={setTool}
              scrollX={scrollX}
              scrollY={scrollY}
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
              tool={tool}
              selectedObjectId={selectedObjectId}
              onSelectObject={setSelectedObjectId}
            />

            {/* Lasso overlay */}
            <LassoOverlay
              active={lassoActive}
              containerRef={canvasAreaRef as React.RefObject<HTMLDivElement>}
              onComplete={handleLassoComplete}
              onCancel={() => {}}
            />
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
                    onSend={handleSendChat}
                    onClear={() => setChatMessages([])}
                    loading={chatLoading}
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
