import React, { useState, useRef, useEffect, useCallback } from "react";
import { App } from "obsidian";
import type NoteometryPlugin from "../main";
import type { Tool, Stroke, Point, ChatMessage, Attachment, TextBox } from "../types";
import { readInk, chat } from "../lib/ai";
import {
  savePage, loadPage, listSections, listPages,
  createSection, createPage, migrateLegacy,
  CanvasData,
} from "../lib/persistence";
import Toolbar from "./Toolbar";
import Panel from "./Panel";
import ChatPanel from "./ChatPanel";
import Sidebar from "./Sidebar";

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
  const panRef = useRef({ x: 0, y: 0 });
  const grabAnchorRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const textBoxesRef = useRef<TextBox[]>([]);
  const [editingTextBox, setEditingTextBox] = useState<string | null>(null);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const draggingTextBox = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  /* ── Tool state ───────────────────────────────────────── */
  const [activeTool, setActiveTool] = useState<Tool>("pen");
  const toolRef = useRef<Tool>("pen");
  const setTool = (t: Tool) => { setActiveTool(t); toolRef.current = t; };

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

  /** Load page data into canvas/panel state */
  const applyPageData = useCallback((data: CanvasData) => {
    strokesRef.current = data.strokes ?? [];
    textBoxesRef.current = data.textBoxes ?? [];
    setTextBoxes(data.textBoxes ?? []);
    panRef.current = data.pan ?? { x: 0, y: 0 };
    undoStackRef.current = [];
    redoStackRef.current = [];
    lassoPointsRef.current = [];
    currentStrokeRef.current = null;
    setEditingTextBox(null);
    setInputCode(data.panelInput ?? "");
    setChatMessages(data.chatMessages ?? []);
  }, []);

  /** Save current page (immediate) */
  const saveNow = useCallback(async () => {
    const sec = sectionRef.current;
    const pg = pageRef.current;
    if (!sec || !pg) return;
    const data: CanvasData = {
      strokes: strokesRef.current,
      textBoxes: textBoxesRef.current,
      panelInput: inputCode,
      panelOutput: "",
      chatMessages,
      pan: { ...panRef.current },
      lastSaved: new Date().toISOString(),
    };
    await savePage(plugin, sec, pg, data);
  }, [inputCode, chatMessages, plugin]);

  const doSave = useCallback(() => {
    if (!plugin.settings.autoSave) return;
    if (!sectionRef.current || !pageRef.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await saveNow();
    }, plugin.settings.autoSaveDelay);
  }, [saveNow, plugin]);

  useEffect(() => { doSave(); }, [inputCode, chatMessages]);
  useEffect(() => { return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }; }, []);

  /** Handle section/page selection from sidebar */
  const handleSelect = useCallback(async (section: string, page: string) => {
    // Save current page first
    await saveNow();

    // If only section selected, load first page
    if (section && !page) {
      const pages = await listPages(plugin, section);
      page = pages[0] ?? "";
    }

    sectionRef.current = section;
    pageRef.current = page;
    setCurrentSection(section);
    setCurrentPage(page);

    if (section && page) {
      const data = await loadPage(plugin, section, page);
      applyPageData(data);
    } else {
      applyPageData({
        strokes: [], textBoxes: [], panelInput: "", panelOutput: "",
        chatMessages: [], pan: { x: 0, y: 0 }, lastSaved: "",
      });
    }
  }, [plugin, applyPageData, saveNow]);

  /** Initial load */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Migrate legacy single-file canvas
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
        // First run — create a default section and page
        sec = "General";
        pg = "Page 1";
        await createSection(plugin, sec);
        await createPage(plugin, sec, pg);
      }

      if (cancelled) return;
      sectionRef.current = sec;
      pageRef.current = pg;
      setCurrentSection(sec);
      setCurrentPage(pg);

      if (sec && pg) {
        const data = await loadPage(plugin, sec, pg);
        if (!cancelled) applyPageData(data);
      }

      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Graph paper canvas drawing ───────────────────────── */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const px = panRef.current.x;
    const py = panRef.current.y;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Minor grid lines (1/8") — offset by pan so they tile infinitely
    ctx.strokeStyle = "#e8ebe8";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    const minorOffX = ((px % GRID_MINOR) + GRID_MINOR) % GRID_MINOR;
    const minorOffY = ((py % GRID_MINOR) + GRID_MINOR) % GRID_MINOR;
    for (let x = minorOffX; x < w; x += GRID_MINOR) {
      const worldX = x - px;
      if (Math.round(worldX) % GRID_MAJOR === 0) continue;
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = minorOffY; y < h; y += GRID_MINOR) {
      const worldY = y - py;
      if (Math.round(worldY) % GRID_MAJOR === 0) continue;
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();

    // Major grid lines (1") — offset by pan
    ctx.strokeStyle = "#c8ccc8";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    const majorOffX = ((px % GRID_MAJOR) + GRID_MAJOR) % GRID_MAJOR;
    const majorOffY = ((py % GRID_MAJOR) + GRID_MAJOR) % GRID_MAJOR;
    for (let x = majorOffX; x < w; x += GRID_MAJOR) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = majorOffY; y < h; y += GRID_MAJOR) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();

    // Draw strokes in world coordinates (translate by pan)
    ctx.save();
    ctx.translate(px, py);
    for (const s of strokesRef.current) drawStroke(ctx, s);
    if (currentStrokeRef.current) drawStroke(ctx, currentStrokeRef.current);
    ctx.restore();
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

  // Redraw when page changes (strokes are in refs, need explicit trigger)
  useEffect(() => {
    if (ready) redraw();
  }, [currentSection, currentPage, ready, redraw]);

  /* ── Pointer handlers ─────────────────────────────────── */
  function getPos(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - r.left - panRef.current.x,
      y: e.clientY - r.top - panRef.current.y,
      pressure: e.pressure ?? 0.5,
    };
  }

  /** Screen-space position (no pan offset) for grab tool */
  function getScreenPos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function addPoint(stroke: Stroke, pos: Point) {
    const last = stroke.points[stroke.points.length - 1];
    if (!last) { stroke.points.push(pos); return; }
    if (Math.hypot(pos.x - last.x, pos.y - last.y) < MIN_DIST) return;
    stroke.points.push(pos);
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getPos(e);
    const tool = toolRef.current;
    if (tool === "text") {
      // Place a new text box at click position — don't capture pointer
      const newBox: TextBox = {
        id: uuid(),
        x: pos.x,
        y: pos.y,
        width: 200,
        height: 32,
        text: "",
        fontSize: 15,
      };
      textBoxesRef.current = [...textBoxesRef.current, newBox];
      setTextBoxes([...textBoxesRef.current]);
      setEditingTextBox(newBox.id);
      doSave();
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === "grab") {
      isDrawingRef.current = true;
      const sp = getScreenPos(e);
      grabAnchorRef.current = { x: sp.x, y: sp.y, panX: panRef.current.x, panY: panRef.current.y };
    } else if (tool === "pen") {
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
    const tool = toolRef.current;
    if (tool === "grab") {
      const sp = getScreenPos(e);
      const a = grabAnchorRef.current;
      panRef.current = { x: a.panX + (sp.x - a.x), y: a.panY + (sp.y - a.y) };
      redraw();
      return;
    }
    const pos = getPos(e);
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
    if (tool === "grab") {
      isDrawingRef.current = false;
      return;
    }
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
      undoStackRef.current.push([...strokesRef.current]);
      redoStackRef.current = [];
      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
      isDrawingRef.current = false;
      redraw();
      // Auto-trigger READ INK after lasso completes
      if (lp.length >= 3) {
        setTimeout(() => handleReadInk(), 100);
      }
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
    if (lasso.length < 3) return null;
    const xs = lasso.map((p) => p.x);
    const ys = lasso.map((p) => p.y);
    const pad = 12;
    const minX = Math.floor(Math.min(...xs)) - pad;
    const minY = Math.floor(Math.min(...ys)) - pad;
    const maxX = Math.ceil(Math.max(...xs)) + pad;
    const maxY = Math.ceil(Math.max(...ys)) + pad;
    const w = maxX - minX;
    const h = maxY - minY;
    if (w <= 0 || h <= 0) return null;
    // Cap to reasonable size
    const scale = Math.min(1, 4096 / Math.max(w, h));
    const tw = Math.round(w * scale);
    const th = Math.round(h * scale);
    const tmp = document.createElement("canvas");
    tmp.width = tw;
    tmp.height = th;
    const tctx = tmp.getContext("2d")!;
    tctx.fillStyle = "#ffffff";
    tctx.fillRect(0, 0, tw, th);
    if (scale !== 1) tctx.scale(scale, scale);
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
    tctx.save();
    tctx.translate(panRef.current.x, panRef.current.y);
    for (const s of strokesRef.current) {
      if (s.tool !== "lasso") drawStroke(tctx, s);
    }
    tctx.restore();
    return tmp.toDataURL("image/png");
  }

  /* ── Send to chat helper ──────────────────────────────── */
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

  /* ── READ INK → OCR → auto-solve in chat ─────────────── */
  const handleReadInk = async () => {
    setIsReading(true);
    try {
      const hasLasso = lassoPointsRef.current.length >= 3;
      const img = hasLasso
        ? (cropToLasso() ?? fullSnapshot())
        : fullSnapshot();

      // Remove lasso strokes from canvas after capture
      if (hasLasso) {
        strokesRef.current = strokesRef.current.filter((s) => s.tool !== "lasso");
        lassoPointsRef.current = [];
        redraw();
      }

      const res = await readInk(img, plugin.settings);
      if (res.ok && res.text.trim()) {
        // Populate input box (shows in Preview) and auto-solve in chat
        setInputCode(res.text);
        setIsReading(false);
        await sendToChat(`Solve this:\n$${res.text}$`);
        return;
      } else {
        setChatMessages((prev) => [...prev, {
          role: "assistant",
          text: res.error ?? "READ INK couldn't extract anything. Try drawing larger or using lasso.",
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
      const res = await readInk(dataUrl, plugin.settings);
      if (res.ok && res.text.trim()) {
        setInputCode(res.text);
        setIsReading(false);
        await sendToChat(`Solve this:\n$${res.text}$`);
        return;
      } else {
        setChatMessages((prev) => [...prev, {
          role: "assistant",
          text: res.error ?? "Image scan failed",
        }]);
      }
    } catch {
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        text: "Image scan failed.",
      }]);
    }
    setIsReading(false);
  };

  /* ── Chat ─────────────────────────────────────────────── */
  const handleSendChat = async (text: string, attachments: Attachment[]) => {
    await sendToChat(text, attachments);
  };

  /* ── Symbol insertion into input ──────────────────────── */
  const handleInsertSymbol = (sym: string) => {
    setInputCode((prev) => prev + sym);
  };

  /* ── Chat resize ───────────────────────────────────────── */
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
    setChatHeight((h) => Math.max(120, Math.min(600, h - dy)));
  };
  const handleChatResizeUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    chatDragging.current = false;
  };

  /* ── Text box helpers ─────────────────────────────────── */
  const updateTextBox = (id: string, updates: Partial<TextBox>) => {
    textBoxesRef.current = textBoxesRef.current.map((tb) =>
      tb.id === id ? { ...tb, ...updates } : tb
    );
    setTextBoxes([...textBoxesRef.current]);
    doSave();
  };

  const deleteTextBox = (id: string) => {
    textBoxesRef.current = textBoxesRef.current.filter((tb) => tb.id !== id);
    setTextBoxes([...textBoxesRef.current]);
    if (editingTextBox === id) setEditingTextBox(null);
    doSave();
  };

  const handleTextBoxPointerDown = (e: React.PointerEvent, tb: TextBox) => {
    e.stopPropagation();
    if (editingTextBox === tb.id) return; // already editing, let textarea handle it
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    draggingTextBox.current = {
      id: tb.id,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleTextBoxPointerMove = (e: React.PointerEvent) => {
    if (!draggingTextBox.current) return;
    const container = containerRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const drag = draggingTextBox.current;
    const newX = e.clientX - cr.left - panRef.current.x - drag.offsetX;
    const newY = e.clientY - cr.top - panRef.current.y - drag.offsetY;
    updateTextBox(drag.id, { x: newX, y: newY });
  };

  const handleTextBoxPointerUp = (e: React.PointerEvent) => {
    if (draggingTextBox.current) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      draggingTextBox.current = null;
    }
  };

  /* ── Cursor ───────────────────────────────────────────── */
  const cursorClass = activeTool === "pen" ? "cursor-crosshair" : activeTool === "eraser" ? "cursor-cell" : activeTool === "grab" ? "cursor-grab" : activeTool === "text" ? "cursor-text" : "";

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

      {/* ── Sidebar (sections + pages) ── */}
      <Sidebar
        plugin={plugin}
        currentSection={currentSection}
        currentPage={currentPage}
        onSelect={handleSelect}
      />

      {/* ── Main area (canvas + panel) ── */}
      <div className="noteometry-main">
        <div className="noteometry-split">
          {/* ── Canvas area ── */}
          <div className="noteometry-canvas-area">
            <Toolbar
              activeTool={activeTool}
              setTool={setTool}
              onUndo={undo}
              onRedo={redo}
              onClear={clearCanvas}
              onReadInk={handleReadInk}
              onUploadImage={() => imageInputRef.current?.click()}
              onTogglePanel={() => setPanelOpen(!panelOpen)}
              isReading={isReading}
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
              {/* Text box overlays */}
              {textBoxes.map((tb) => (
                <div
                  key={tb.id}
                  className={`noteometry-textbox ${editingTextBox === tb.id ? "editing" : ""}`}
                  style={{
                    left: tb.x + panRef.current.x,
                    top: tb.y + panRef.current.y,
                    width: tb.width,
                    minHeight: tb.height,
                    fontSize: tb.fontSize,
                  }}
                  onPointerDown={(e) => handleTextBoxPointerDown(e, tb)}
                  onPointerMove={handleTextBoxPointerMove}
                  onPointerUp={handleTextBoxPointerUp}
                  onDoubleClick={() => setEditingTextBox(tb.id)}
                >
                  {editingTextBox === tb.id ? (
                    <textarea
                      className="noteometry-textbox-input"
                      value={tb.text}
                      ref={(el) => { if (el) setTimeout(() => el.focus(), 10); }}
                      onChange={(e) => updateTextBox(tb.id, { text: e.target.value })}
                      onBlur={() => {
                        if (!tb.text.trim()) deleteTextBox(tb.id);
                        else setEditingTextBox(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          if (!tb.text.trim()) deleteTextBox(tb.id);
                          else setEditingTextBox(null);
                        }
                        e.stopPropagation();
                      }}
                      style={{ fontSize: tb.fontSize }}
                    />
                  ) : (
                    <div className="noteometry-textbox-display">
                      {tb.text || "\u00A0"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Right panel — Preview/Input + Chat ── */}
          {panelOpen && (
            <div className="noteometry-right">
              <Panel
                inputCode={inputCode}
                setInputCode={setInputCode}
                app={app}
                onInsertSymbol={handleInsertSymbol}
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
                  app={app}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
