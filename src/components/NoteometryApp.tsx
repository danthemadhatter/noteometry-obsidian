import React, { useState, useRef, useEffect, useCallback } from "react";
import { App } from "obsidian";
import type NoteometryPlugin from "../main";
import type { Tool, Stroke, Point, ChatMessage, Attachment } from "../types";
import { readInk, solve, chat } from "../lib/gemini";
import { saveCanvas, loadCanvas, CanvasData } from "../lib/persistence";
import Toolbar from "./Toolbar";
import Panel from "./Panel";
import ChatPanel from "./ChatPanel";

interface Props {
  plugin: NoteometryPlugin;
  app: App;
}

/* ── Canvas constants ───────────────────────────────────── */
const ERASER_RADIUS = 20;
const PEN_WIDTH = 2.5;
const PEN_COLOR = "#1a1a1a";
const LASSO_COLOR = "#3b82f6";
const MIN_DIST = 1;
// 1/8" grid at 96 DPI = 12px per minor line, 8 minor = 1" = 96px major
const GRID_MINOR = 12;
const GRID_MAJOR = GRID_MINOR * 8;

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function NoteometryApp({ plugin, app }: Props) {
  /* ── Canvas refs ──────────────────────────────────────── */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const undoStackRef = useRef<Stroke[][]>([]);
  const redoStackRef = useRef<Stroke[][]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);
  const lassoPointsRef = useRef<Point[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  /* ── Tool state ───────────────────────────────────────── */
  const [activeTool, setActiveTool] = useState<Tool>("pen");
  const toolRef = useRef<Tool>("pen");
  const setTool = (t: Tool) => { setActiveTool(t); toolRef.current = t; };

  /* ── Panel state ──────────────────────────────────────── */
  const [inputCode, setInputCode] = useState("");
  const [outputCode, setOutputCode] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  /* ── Chat state ───────────────────────────────────────── */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  /* ── Persistence ──────────────────────────────────────── */
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadCanvas(plugin);
      if (cancelled) return;
      if (saved) {
        strokesRef.current = saved.strokes ?? [];
        setInputCode(saved.panelInput ?? "");
        setOutputCode(saved.panelOutput ?? "");
        setChatMessages(saved.chatMessages ?? []);
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const doSave = useCallback(() => {
    if (!plugin.settings.autoSave) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const data: CanvasData = {
        strokes: strokesRef.current,
        panelInput: inputCode,
        panelOutput: outputCode,
        chatMessages,
        lastSaved: new Date().toISOString(),
      };
      await saveCanvas(plugin, data);
    }, plugin.settings.autoSaveDelay);
  }, [inputCode, outputCode, chatMessages, plugin]);

  useEffect(() => { doSave(); }, [inputCode, outputCode, chatMessages]);
  useEffect(() => { return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }; }, []);

  /* ── Graph paper canvas drawing ───────────────────────── */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Minor grid lines (1/8")
    ctx.strokeStyle = "#e8ebe8";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = GRID_MINOR; x < w; x += GRID_MINOR) {
      if (x % GRID_MAJOR === 0) continue; // skip majors
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = GRID_MINOR; y < h; y += GRID_MINOR) {
      if (y % GRID_MAJOR === 0) continue;
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();

    // Major grid lines (1")
    ctx.strokeStyle = "#c8ccc8";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let x = GRID_MAJOR; x < w; x += GRID_MAJOR) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = GRID_MAJOR; y < h; y += GRID_MAJOR) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();

    for (const s of strokesRef.current) drawStroke(ctx, s);
    if (currentStrokeRef.current) drawStroke(ctx, currentStrokeRef.current);
  }, []);

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    const pts = stroke.points;
    if (pts.length < 2) return;
    const first = pts[0]!;
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.width;

    if (stroke.tool === "lasso") {
      ctx.setLineDash([6, 4]);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i++) { const p = pts[i]!; ctx.lineTo(p.x, p.y); }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    if (pts.length === 2) {
      const second = pts[1]!;
      ctx.lineTo(second.x, second.y);
    } else {
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)]!;
        const p1 = pts[i]!;
        const p2 = pts[i + 1]!;
        const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
        const t = 0.35;
        ctx.bezierCurveTo(
          p1.x + (p2.x - p0.x) * t, p1.y + (p2.y - p0.y) * t,
          p2.x - (p3.x - p1.x) * t, p2.y - (p3.y - p1.y) * t,
          p2.x, p2.y
        );
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // ResizeObserver — no zoom, just fill container
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const obs = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redraw();
    });
    obs.observe(container);
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    redraw();
    return () => obs.disconnect();
  }, [redraw, ready]);

  /* ── Pointer handlers ─────────────────────────────────── */
  function getPos(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, pressure: e.pressure ?? 0.5 };
  }

  function addPoint(stroke: Stroke, pos: Point) {
    const last = stroke.points[stroke.points.length - 1];
    if (!last) { stroke.points.push(pos); return; }
    if (Math.hypot(pos.x - last.x, pos.y - last.y) < MIN_DIST) return;
    stroke.points.push(pos);
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = getPos(e);
    const tool = toolRef.current;
    if (tool === "pen") {
      isDrawingRef.current = true;
      currentStrokeRef.current = { id: uuid(), points: [pos], color: PEN_COLOR, width: PEN_WIDTH, tool: "pen" };
    } else if (tool === "lasso") {
      isDrawingRef.current = true;
      lassoPointsRef.current = [pos];
      currentStrokeRef.current = { id: uuid(), points: [pos], color: LASSO_COLOR, width: 1.5, tool: "lasso" };
    } else if (tool === "eraser") {
      isDrawingRef.current = true;
      eraseAt(pos);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const pos = getPos(e);
    const tool = toolRef.current;
    if (tool === "pen" && currentStrokeRef.current) {
      addPoint(currentStrokeRef.current, pos);
      redraw();
    } else if (tool === "lasso" && currentStrokeRef.current) {
      lassoPointsRef.current.push(pos);
      addPoint(currentStrokeRef.current, pos);
      redraw();
    } else if (tool === "eraser") {
      eraseAt(pos);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    const tool = toolRef.current;
    if (tool === "pen" && currentStrokeRef.current && currentStrokeRef.current.points.length > 1) {
      undoStackRef.current.push([...strokesRef.current]);
      redoStackRef.current = [];
      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
      isDrawingRef.current = false;
      redraw();
      doSave();
      return;
    } else if (tool === "lasso" && currentStrokeRef.current) {
      const lp = lassoPointsRef.current;
      if (lp.length > 2 && lp[0]) {
        currentStrokeRef.current.points.push(lp[0]);
        lp.push(lp[0]);
      }
      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
      isDrawingRef.current = false;
      redraw();
      return;
    }
    currentStrokeRef.current = null;
    isDrawingRef.current = false;
    redraw();
  };

  function eraseAt(pos: Point) {
    const before = strokesRef.current.length;
    strokesRef.current = strokesRef.current.filter(
      (s) => !s.points.some((p) => Math.hypot(p.x - pos.x, p.y - pos.y) < ERASER_RADIUS)
    );
    if (strokesRef.current.length !== before) { redraw(); doSave(); }
  }

  /* ── Undo / Redo / Clear ──────────────────────────────── */
  const undo = useCallback(() => {
    if (!undoStackRef.current.length) return;
    redoStackRef.current.push([...strokesRef.current]);
    strokesRef.current = undoStackRef.current.pop()!;
    redraw();
    doSave();
  }, [redraw, doSave]);

  const redo = useCallback(() => {
    if (!redoStackRef.current.length) return;
    undoStackRef.current.push([...strokesRef.current]);
    strokesRef.current = redoStackRef.current.pop()!;
    redraw();
    doSave();
  }, [redraw, doSave]);

  const clearCanvas = useCallback(() => {
    undoStackRef.current.push([...strokesRef.current]);
    redoStackRef.current = [];
    strokesRef.current = [];
    lassoPointsRef.current = [];
    currentStrokeRef.current = null;
    redraw();
    doSave();
  }, [redraw, doSave]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo]);

  /* ── Snapshot helpers ─────────────────────────────────── */
  function cropToLasso(): string | null {
    const lasso = lassoPointsRef.current;
    const canvas = canvasRef.current;
    if (!canvas || lasso.length < 3) return null;
    const xs = lasso.map((p) => p.x);
    const ys = lasso.map((p) => p.y);
    const minX = Math.max(0, Math.floor(Math.min(...xs)) - 8);
    const minY = Math.max(0, Math.floor(Math.min(...ys)) - 8);
    const maxX = Math.min(canvas.width, Math.ceil(Math.max(...xs)) + 8);
    const maxY = Math.min(canvas.height, Math.ceil(Math.max(...ys)) + 8);
    const w = maxX - minX;
    const h = maxY - minY;
    if (w <= 0 || h <= 0) return null;
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext("2d")!;
    tctx.fillStyle = "#ffffff";
    tctx.fillRect(0, 0, w, h);
    tctx.translate(-minX, -minY);
    for (const s of strokesRef.current) {
      if (s.tool !== "lasso") drawStroke(tctx, s);
    }
    return tmp.toDataURL("image/png");
  }

  function fullSnapshot(): string {
    const canvas = canvasRef.current!;
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tctx = tmp.getContext("2d")!;
    tctx.fillStyle = "#ffffff";
    tctx.fillRect(0, 0, tmp.width, tmp.height);
    for (const s of strokesRef.current) {
      if (s.tool !== "lasso") drawStroke(tctx, s);
    }
    return tmp.toDataURL("image/png");
  }

  /* ── READ INK ─────────────────────────────────────────── */
  const handleReadInk = async () => {
    setIsReading(true);
    try {
      const img = lassoPointsRef.current.length >= 3
        ? (cropToLasso() ?? fullSnapshot())
        : fullSnapshot();
      const res = await readInk(img, plugin.settings.geminiApiKey, plugin.settings.geminiModel);
      if (res.ok) {
        setInputCode(res.text);
      } else {
        setInputCode(res.error ?? "READ INK failed");
      }
    } catch {
      setInputCode("Vision API failed.");
    }
    setIsReading(false);
  };

  /* ── Image upload for scan ────────────────────────────── */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsReading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(file);
      });
      const res = await readInk(dataUrl, plugin.settings.geminiApiKey, plugin.settings.geminiModel);
      if (res.ok) {
        setInputCode(res.text);
      } else {
        setInputCode(res.error ?? "Image scan failed");
      }
    } catch {
      setInputCode("Image scan failed.");
    }
    setIsReading(false);
  };

  /* ── SOLVE ────────────────────────────────────────────── */
  const handleSolve = async () => {
    if (!inputCode.trim()) return;
    setIsSolving(true);
    try {
      const res = await solve(inputCode, plugin.settings.geminiApiKey, plugin.settings.geminiModel);
      if (res.ok) {
        setOutputCode(res.text);
      } else {
        setOutputCode(res.error ?? "SOLVE failed");
      }
    } catch {
      setOutputCode("Solver API failed.");
    }
    setIsSolving(false);
  };

  /* ── Chat ─────────────────────────────────────────────── */
  const handleSendChat = async (text: string, attachments: Attachment[]) => {
    const userMsg: ChatMessage = { role: "user", text };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatLoading(true);
    try {
      const res = await chat(newHistory, attachments, plugin.settings.geminiApiKey, plugin.settings.geminiModel);
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        text: res.ok ? res.text : (res.error ?? "No response"),
      }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", text: "Chat API failed." }]);
    }
    setChatLoading(false);
  };

  /* ── EE Symbol insertion ──────────────────────────────── */
  const handleInsertSymbol = (sym: string) => {
    setInputCode((prev) => prev + sym);
  };

  /* ── Cursor ───────────────────────────────────────────── */
  const cursorClass = activeTool === "pen" ? "cursor-crosshair" : activeTool === "eraser" ? "cursor-cell" : "";

  /* ── Render ───────────────────────────────────────────── */
  if (!ready) {
    return <div className="noteometry-loading">Loading Noteometry…</div>;
  }

  return (
    <div className="noteometry-container">
      {/* Hidden image upload input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="noteometry-hidden"
      />

      <div className="noteometry-split">
        {/* ── Canvas area (full width when panel closed) ── */}
        <div className="noteometry-canvas-area">
          <Toolbar
            activeTool={activeTool}
            setTool={setTool}
            onUndo={undo}
            onRedo={redo}
            onClear={clearCanvas}
            onReadInk={handleReadInk}
            onSolve={handleSolve}
            onUploadImage={() => imageInputRef.current?.click()}
            onTogglePanel={() => setPanelOpen(!panelOpen)}
            isReading={isReading}
            isSolving={isSolving}
            hasInput={!!inputCode.trim()}
            panelOpen={panelOpen}
          />
          <div ref={containerRef} className="noteometry-canvas-container">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className={`noteometry-canvas ${cursorClass}`}
            />
          </div>
        </div>

        {/* ── Right panel (collapsible) ── */}
        {panelOpen && (
          <div className="noteometry-right">
            <Panel
              inputCode={inputCode}
              setInputCode={setInputCode}
              outputCode={outputCode}
              isSolving={isSolving}
              app={app}
              onInsertSymbol={handleInsertSymbol}
            />
            <ChatPanel
              messages={chatMessages}
              onSend={handleSendChat}
              loading={chatLoading}
              app={app}
            />
          </div>
        )}
      </div>
    </div>
  );
}
