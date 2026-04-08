import React, { useRef, useCallback, useEffect } from "react";
import type { Stroke, StrokePoint, Stamp } from "../lib/inkEngine";
import { newStrokeId, smoothPoints, pointNearStroke, stampBBox, type BBox } from "../lib/inkEngine";
import { setupCanvas, drawGrid, drawAllStrokes, drawAllStamps, drawStroke } from "../lib/canvasRenderer";

export type CanvasTool = "select" | "pen" | "eraser";

interface Props {
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
  stamps: Stamp[];
  onStampsChange: (stamps: Stamp[]) => void;
  activeColor: string;
  strokeWidth: number;
  tool: CanvasTool;
  scrollX: number;
  scrollY: number;
  onViewportChange: (scrollX: number, scrollY: number) => void;
  disabled?: boolean;
  selectedStampId?: string | null;
}

export default function InkCanvas({
  strokes, onStrokesChange, stamps, onStampsChange,
  activeColor, strokeWidth,
  tool, scrollX, scrollY, onViewportChange,
  disabled = false, selectedStampId = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);

  // Refs for event handler state (avoid stale closures)
  const strokesRef = useRef(strokes);
  const stampsRef = useRef(stamps);
  const toolRef = useRef(tool);
  const colorRef = useRef(activeColor);
  const widthRef = useRef(strokeWidth);
  const scrollRef = useRef({ x: scrollX, y: scrollY });
  const selectedStampIdRef = useRef(selectedStampId);

  // Active drawing state
  const activeStrokeRef = useRef<StrokePoint[]>([]);
  const isDrawingRef = useRef(false);

  // Touch pan state (shared between touch handler and main)
  const touchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);

  // Keep refs in sync
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);
  useEffect(() => { stampsRef.current = stamps; }, [stamps]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = activeColor; }, [activeColor]);
  useEffect(() => { widthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { scrollRef.current = { x: scrollX, y: scrollY }; }, [scrollX, scrollY]);
  useEffect(() => { selectedStampIdRef.current = selectedStampId; }, [selectedStampId]);

  // ── Canvas sizing ──────────────────────────────────
  const sizeRef = useRef({ w: 0, h: 0 });

  const resizeCanvases = useCallback(() => {
    const container = containerRef.current;
    const gridCanvas = gridCanvasRef.current;
    const inkCanvas = inkCanvasRef.current;
    if (!container || !gridCanvas || !inkCanvas) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    sizeRef.current = { w, h };

    setupCanvas(gridCanvas, w, h);
    setupCanvas(inkCanvas, w, h);

    redrawGrid();
    redrawInk();
  }, []);

  // ── Drawing functions ──────────────────────────────
  const redrawGrid = useCallback(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrid(ctx, scrollRef.current.x, scrollRef.current.y, sizeRef.current.w, sizeRef.current.h);
  }, []);

  const redrawInk = useCallback(() => {
    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    drawAllStrokes(ctx, strokesRef.current, scrollRef.current.x, scrollRef.current.y, w, h);
    drawAllStamps(ctx, stampsRef.current, scrollRef.current.x, scrollRef.current.y);

    // Draw selection highlight around selected stamp
    if (selectedStampIdRef.current) {
      const sel = stampsRef.current.find(s => s.id === selectedStampIdRef.current);
      if (sel) {
        const bb = stampBBox(sel);
        ctx.strokeStyle = "#4A90D9";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(
          bb.x - scrollRef.current.x,
          bb.y - scrollRef.current.y,
          bb.w, bb.h
        );
        ctx.setLineDash([]);
      }
    }

    if (activeStrokeRef.current.length > 0) {
      const active: Stroke = {
        id: "",
        points: activeStrokeRef.current,
        color: colorRef.current,
        width: widthRef.current,
      };
      drawStroke(ctx, active, scrollRef.current.x, scrollRef.current.y);
    }
  }, []);

  useEffect(() => { redrawGrid(); redrawInk(); }, [strokes, stamps, scrollX, scrollY, selectedStampId]);

  // ── Pen/Eraser pointer handlers (NO touch — that's separate) ───
  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.pointerType === "touch") return; // handled by touch pan effect

    const canvas = inkCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current.x;
    const y = e.clientY - rect.top + scrollRef.current.y;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    if (toolRef.current === "eraser") {
      const tolerance = 10;
      const remainingStrokes = strokesRef.current.filter(s => !pointNearStroke(x, y, s, tolerance));
      if (remainingStrokes.length !== strokesRef.current.length) onStrokesChange(remainingStrokes);
      const remainingStamps = stampsRef.current.filter(st => {
        const bb = stampBBox(st);
        return !(x >= bb.x && x <= bb.x + bb.w && y >= bb.y && y <= bb.y + bb.h);
      });
      if (remainingStamps.length !== stampsRef.current.length) onStampsChange(remainingStamps);
      isDrawingRef.current = true;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // Pen: start new stroke
    isDrawingRef.current = true;
    activeStrokeRef.current = [{ x, y, pressure }];
    canvas.setPointerCapture(e.pointerId);
  }, [onStrokesChange, onStampsChange]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    if (!isDrawingRef.current) return;

    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current.x;
    const y = e.clientY - rect.top + scrollRef.current.y;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    if (toolRef.current === "eraser") {
      const tolerance = 10;
      const remainingStrokes = strokesRef.current.filter(s => !pointNearStroke(x, y, s, tolerance));
      if (remainingStrokes.length !== strokesRef.current.length) onStrokesChange(remainingStrokes);
      const remainingStamps = stampsRef.current.filter(st => {
        const bb = stampBBox(st);
        return !(x >= bb.x && x <= bb.x + bb.w && y >= bb.y && y <= bb.y + bb.h);
      });
      if (remainingStamps.length !== stampsRef.current.length) onStampsChange(remainingStamps);
      return;
    }

    activeStrokeRef.current.push({ x, y, pressure });
    redrawInk();
  }, [onStrokesChange, onStampsChange, redrawInk]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (toolRef.current === "eraser") return;

    const rawPoints = activeStrokeRef.current;
    activeStrokeRef.current = [];
    if (rawPoints.length === 0) return;

    const smoothed = smoothPoints(rawPoints);
    const newStroke: Stroke = {
      id: newStrokeId(),
      points: smoothed,
      color: colorRef.current,
      width: widthRef.current,
    };
    onStrokesChange([...strokesRef.current, newStroke]);
  }, [onStrokesChange]);

  // ── CONDITIONAL listener attachment ─────────────────
  // Only attach pen/eraser listeners when those tools are active.
  // In select mode: NO listeners → events pass through to objects.
  useEffect(() => {
    const canvas = inkCanvasRef.current;
    if (!canvas) return;

    const shouldListen = (tool === "pen" || tool === "eraser") && !disabled;
    if (!shouldListen) return; // no listeners attached → click-through works

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);

    const preventTouch = (e: TouchEvent) => { e.preventDefault(); };
    canvas.addEventListener("touchstart", preventTouch, { passive: false });
    canvas.addEventListener("touchmove", preventTouch, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      canvas.removeEventListener("touchstart", preventTouch);
      canvas.removeEventListener("touchmove", preventTouch);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp, tool, disabled]);

  // ── Touch panning — ALWAYS active, on the container ─
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchesRef.current.size === 1) {
        lastPanRef.current = { x: e.clientX, y: e.clientY };
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (lastPanRef.current) {
        const touch = touchesRef.current.values().next().value;
        if (touch) {
          const dx = touch.x - lastPanRef.current.x;
          const dy = touch.y - lastPanRef.current.y;
          lastPanRef.current = { x: touch.x, y: touch.y };
          const newX = scrollRef.current.x - dx;
          const newY = scrollRef.current.y - dy;
          scrollRef.current = { x: newX, y: newY };
          onViewportChange(newX, newY);
          redrawGrid();
          redrawInk();
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touchesRef.current.delete(e.pointerId);
      if (touchesRef.current.size === 0) lastPanRef.current = null;
      else {
        const r = touchesRef.current.values().next().value;
        if (r) lastPanRef.current = { x: r.x, y: r.y };
      }
    };

    container.addEventListener("pointerdown", onDown);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerup", onUp);
    container.addEventListener("pointercancel", onUp);
    return () => {
      container.removeEventListener("pointerdown", onDown);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerup", onUp);
      container.removeEventListener("pointercancel", onUp);
    };
  }, [onViewportChange, redrawGrid, redrawInk]);

  // ── Resize observer ────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => resizeCanvases());
    observer.observe(container);
    resizeCanvases();
    return () => observer.disconnect();
  }, [resizeCanvases]);

  // ── Mouse wheel scrolling — on the CONTAINER (works in all modes) ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const newX = scrollRef.current.x + e.deltaX;
      const newY = scrollRef.current.y + e.deltaY;
      scrollRef.current = { x: newX, y: newY };
      onViewportChange(newX, newY);
      redrawGrid();
      redrawInk();
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [onViewportChange, redrawGrid, redrawInk]);

  return (
    <div
      ref={containerRef}
      className="noteometry-ink-canvas-container"
    >
      <canvas ref={gridCanvasRef} className="noteometry-ink-grid" />
      <canvas
        ref={inkCanvasRef}
        className="noteometry-ink-layer"
        style={{
          cursor: tool === "eraser" ? "cell" : tool === "pen" ? "crosshair" : "default",
          pointerEvents: (tool === "select" || disabled) ? "none" : "auto",
        }}
      />
    </div>
  );
}
