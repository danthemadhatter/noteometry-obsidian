import React, { useRef, useCallback, useEffect } from "react";
import type { Stroke, StrokePoint, Stamp } from "../lib/inkEngine";
import { newStrokeId, smoothPoints, pointNearStroke, stampBBox, type BBox } from "../lib/inkEngine";
import { setupCanvas, drawGrid, drawAllStrokes, drawAllStamps, drawStroke } from "../lib/canvasRenderer";

export type CanvasTool = "select" | "pen" | "eraser" | "grab" | "line" | "arrow" | "rect" | "circle";

interface Props {
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
  stamps: Stamp[];
  onStampsChange: (stamps: Stamp[]) => void;
  activeColor: string;
  strokeWidth: number;
  tool: CanvasTool;
  onToolChange?: (tool: CanvasTool) => void;
  scrollX: number;
  scrollY: number;
  onViewportChange: (scrollX: number, scrollY: number) => void;
  /** Current zoom scale (1.0 = 100%). Drawing and pointer math are
   *  scaled accordingly. Default 1.0 if the caller doesn't pass it. */
  zoom?: number;
  /** If true, pinch-zoom is a no-op. Matches the toolbar lock button. */
  zoomLocked?: boolean;
  /** Called when the user pinches to zoom. Parent should clamp + setZoom. */
  onZoomChange?: (zoom: number) => void;
  disabled?: boolean;
  selectedStampId?: string | null;
  onEraseStart?: () => void;
  onEraseEnd?: () => void;
}

const TOOL_CYCLE: CanvasTool[] = ["pen", "eraser", "grab"];

export default function InkCanvas({
  strokes, onStrokesChange, stamps, onStampsChange,
  activeColor, strokeWidth,
  tool, onToolChange, scrollX, scrollY, onViewportChange,
  zoom = 1,
  zoomLocked = false,
  onZoomChange,
  disabled = false, selectedStampId = null,
  onEraseStart, onEraseEnd,
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
  const zoomRef = useRef(zoom);
  const selectedStampIdRef = useRef(selectedStampId);

  // Active drawing state
  const activeStrokeRef = useRef<StrokePoint[]>([]);
  const isDrawingRef = useRef(false);

  // Grab-pan state (mouse/stylus)
  const isGrabbingRef = useRef(false);
  const grabLastRef = useRef<{ x: number; y: number } | null>(null);

  // Shape tool state
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const shapeEndRef = useRef<{ x: number; y: number } | null>(null);

  // Apple Pencil double-tap detection
  const lastPenTapTimeRef = useRef(0);
  const lastPenTapPosRef = useRef<{ x: number; y: number } | null>(null);

  // Touch pan state (shared between touch handler and main)
  const touchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);

  // Pinch-zoom state — set when a second finger lands, cleared when
  // we drop back to zero or one fingers.
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);

  // Ref mirrors for pinch-zoom props so the touch effect doesn't need
  // to re-attach listeners every time onZoomChange or zoomLocked changes.
  const onZoomChangeRef = useRef(onZoomChange);
  const zoomLockedRef = useRef(zoomLocked);

  // Keep refs in sync
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);
  useEffect(() => { stampsRef.current = stamps; }, [stamps]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = activeColor; }, [activeColor]);
  useEffect(() => { widthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { scrollRef.current = { x: scrollX, y: scrollY }; }, [scrollX, scrollY]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { selectedStampIdRef.current = selectedStampId; }, [selectedStampId]);
  useEffect(() => { onZoomChangeRef.current = onZoomChange; }, [onZoomChange]);
  useEffect(() => { zoomLockedRef.current = zoomLocked; }, [zoomLocked]);

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
  //
  // Zoom math: the canvas pixel buffer is sized to (w * dpr) x (h * dpr).
  // We apply ctx.setTransform(dpr*zoom, 0, 0, dpr*zoom, 0, 0) so that
  // drawing commands in "world space" (minus scroll offset) land at the
  // right screen pixels after DPR + zoom scaling. The VISIBLE region in
  // world units shrinks as zoom grows: visibleW = w / zoom.
  const redrawGrid = useCallback(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const zoom = zoomRef.current;
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
    // drawGrid iterates from 0..worldW; at zoom=2, visibleW is half the
    // CSS width, so we pass w/zoom to avoid drawing off-screen ticks.
    const worldW = sizeRef.current.w / zoom;
    const worldH = sizeRef.current.h / zoom;
    drawGrid(ctx, scrollRef.current.x, scrollRef.current.y, worldW, worldH);
  }, []);

  const redrawInk = useCallback(() => {
    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const zoom = zoomRef.current;
    // Clear first using an un-scaled transform so we wipe the full buffer.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    // Now apply DPR × zoom for drawing.
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
    drawAllStrokes(ctx, strokesRef.current, scrollRef.current.x, scrollRef.current.y, w / zoom, h / zoom);
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

    // Shape preview
    if (shapeStartRef.current && shapeEndRef.current) {
      const s = shapeStartRef.current;
      const e = shapeEndRef.current;
      const ox = scrollRef.current.x, oy = scrollRef.current.y;
      ctx.strokeStyle = colorRef.current;
      ctx.lineWidth = widthRef.current;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      if (toolRef.current === "line" || toolRef.current === "arrow") {
        ctx.moveTo(s.x - ox, s.y - oy);
        ctx.lineTo(e.x - ox, e.y - oy);
      } else if (toolRef.current === "rect") {
        ctx.rect(s.x - ox, s.y - oy, e.x - s.x, e.y - s.y);
      } else if (toolRef.current === "circle") {
        const cx = (s.x + e.x) / 2 - ox, cy = (s.y + e.y) / 2 - oy;
        const rx = Math.abs(e.x - s.x) / 2, ry = Math.abs(e.y - s.y) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, []);

  useEffect(() => { redrawGrid(); redrawInk(); }, [strokes, stamps, scrollX, scrollY, selectedStampId, zoom]);

  // ── Pen/Eraser pointer handlers (NO touch — that's separate) ───
  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.pointerType === "touch") return; // handled by touch pan effect

    // Apple Pencil double-tap detection
    if (e.pointerType === "pen") {
      const now = performance.now();
      const prev = lastPenTapPosRef.current;
      const elapsed = now - lastPenTapTimeRef.current;
      if (elapsed < 300 && prev) {
        const dist = Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
        if (dist < 10) {
          // Double-tap detected — cycle tool
          lastPenTapTimeRef.current = 0;
          lastPenTapPosRef.current = null;
          e.preventDefault();
          e.stopPropagation();
          const idx = TOOL_CYCLE.indexOf(toolRef.current);
          const next = TOOL_CYCLE[(idx + 1) % TOOL_CYCLE.length]!;
          onToolChange?.(next);
          return;
        }
      }
      lastPenTapTimeRef.current = now;
      lastPenTapPosRef.current = { x: e.clientX, y: e.clientY };
    }

    const canvas = inkCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Screen coords → world coords: divide by zoom before adding scroll.
    const z = zoomRef.current;
    const x = (e.clientX - rect.left) / z + scrollRef.current.x;
    const y = (e.clientY - rect.top) / z + scrollRef.current.y;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    if (toolRef.current === "grab") {
      isGrabbingRef.current = true;
      grabLastRef.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    const isShapeTool = toolRef.current === "line" || toolRef.current === "arrow" || toolRef.current === "rect" || toolRef.current === "circle";
    if (isShapeTool) {
      shapeStartRef.current = { x, y };
      shapeEndRef.current = { x, y };
      isDrawingRef.current = true;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (toolRef.current === "eraser") {
      onEraseStart?.();
      // Eraser tolerance is specified in screen pixels (visual radius),
      // converted to world units by dividing by zoom. At 200% zoom a
      // 10px visual eraser is 5 world units, so world-space hit-testing
      // still feels consistent on screen.
      const tolerance = 10 / z;
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
  }, [onStrokesChange, onStampsChange, onToolChange]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (e.pointerType === "touch") return;

    if (isGrabbingRef.current && grabLastRef.current) {
      // Screen-space drag delta → world-space scroll delta: divide by zoom.
      // At 2x zoom, dragging 100 screen px should move scroll by 50 world units
      // so the content appears to move the full 100 px under the cursor.
      const z = zoomRef.current;
      const dx = (e.clientX - grabLastRef.current.x) / z;
      const dy = (e.clientY - grabLastRef.current.y) / z;
      grabLastRef.current = { x: e.clientX, y: e.clientY };
      const newX = scrollRef.current.x - dx;
      const newY = scrollRef.current.y - dy;
      scrollRef.current = { x: newX, y: newY };
      onViewportChange(newX, newY);
      redrawGrid();
      redrawInk();
      return;
    }

    if (!isDrawingRef.current) return;

    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const z = zoomRef.current;
    const x = (e.clientX - rect.left) / z + scrollRef.current.x;
    const y = (e.clientY - rect.top) / z + scrollRef.current.y;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    // Shape preview
    if (shapeStartRef.current && (toolRef.current === "line" || toolRef.current === "arrow" || toolRef.current === "rect" || toolRef.current === "circle")) {
      shapeEndRef.current = { x, y };
      redrawInk();
      return;
    }

    if (toolRef.current === "eraser") {
      const tolerance = 10 / z;
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

    if (isGrabbingRef.current) {
      isGrabbingRef.current = false;
      grabLastRef.current = null;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (toolRef.current === "eraser") { onEraseEnd?.(); return; }

    // Finalize shape tools → convert to stroke points
    if (shapeStartRef.current && shapeEndRef.current) {
      const s = shapeStartRef.current;
      const end = shapeEndRef.current;
      const pts: StrokePoint[] = [];
      const pr = 0.5;

      if (toolRef.current === "line" || toolRef.current === "arrow") {
        pts.push({ x: s.x, y: s.y, pressure: pr }, { x: end.x, y: end.y, pressure: pr });
        // Arrow: add arrowhead lines
        if (toolRef.current === "arrow") {
          const angle = Math.atan2(end.y - s.y, end.x - s.x);
          const headLen = 15;
          const a1x = end.x - headLen * Math.cos(angle - 0.4);
          const a1y = end.y - headLen * Math.sin(angle - 0.4);
          const a2x = end.x - headLen * Math.cos(angle + 0.4);
          const a2y = end.y - headLen * Math.sin(angle + 0.4);
          // Add as separate strokes for arrowhead
          const head1: Stroke = { id: newStrokeId(), points: [{ x: end.x, y: end.y, pressure: pr }, { x: a1x, y: a1y, pressure: pr }], color: colorRef.current, width: widthRef.current };
          const head2: Stroke = { id: newStrokeId(), points: [{ x: end.x, y: end.y, pressure: pr }, { x: a2x, y: a2y, pressure: pr }], color: colorRef.current, width: widthRef.current };
          const line: Stroke = { id: newStrokeId(), points: pts, color: colorRef.current, width: widthRef.current };
          onStrokesChange([...strokesRef.current, line, head1, head2]);
          shapeStartRef.current = null;
          shapeEndRef.current = null;
          return;
        }
      } else if (toolRef.current === "rect") {
        pts.push(
          { x: s.x, y: s.y, pressure: pr }, { x: end.x, y: s.y, pressure: pr },
          { x: end.x, y: end.y, pressure: pr }, { x: s.x, y: end.y, pressure: pr },
          { x: s.x, y: s.y, pressure: pr },
        );
      } else if (toolRef.current === "circle") {
        const cx = (s.x + end.x) / 2, cy = (s.y + end.y) / 2;
        const rx = Math.abs(end.x - s.x) / 2, ry = Math.abs(end.y - s.y) / 2;
        const steps = 48;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), pressure: pr });
        }
      }

      if (pts.length >= 2) {
        const newStroke: Stroke = { id: newStrokeId(), points: pts, color: colorRef.current, width: widthRef.current };
        onStrokesChange([...strokesRef.current, newStroke]);
      }
      shapeStartRef.current = null;
      shapeEndRef.current = null;
      return;
    }

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

    const shouldListen = tool !== "select" && !disabled;
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

  // ── Touch panning + pinch-zoom — ALWAYS active, on the container ─
  //
  // Single-finger drag → pan (existing behavior).
  // Two-finger pinch → zoom, driven by the ratio between the current
  // and initial distance between the two fingers. We update zoomRef
  // and redraw synchronously for smooth feedback, then call
  // onZoomChange() so the parent state catches up on the next render.
  //
  // touch-action: none on .noteometry-ink-layer plus the preventTouch
  // handler below keeps the OS from eating our gestures (double-tap
  // zoom, rubber-band scroll, etc.). All canvas gestures are ours.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getPinchDist = (): number => {
      const vals = Array.from(touchesRef.current.values());
      if (vals.length < 2) return 0;
      const [a, b] = vals;
      return Math.hypot(b!.x - a!.x, b!.y - a!.y);
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchesRef.current.size === 1) {
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        pinchStartDistRef.current = null;
      } else if (touchesRef.current.size === 2) {
        // Second finger landed — start a pinch. Freeze the single-finger
        // pan so pinch and pan don't fight for the same scroll delta.
        pinchStartDistRef.current = getPinchDist();
        pinchStartZoomRef.current = zoomRef.current;
        lastPanRef.current = null;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Pinch-zoom path (2 fingers)
      if (touchesRef.current.size >= 2 && pinchStartDistRef.current !== null) {
        if (zoomLockedRef.current) return;
        const currentDist = getPinchDist();
        if (currentDist <= 0) return;
        const ratio = currentDist / pinchStartDistRef.current;
        // Clamp to [0.5, 4] matching the Cmd+wheel limits in NoteometryApp.
        const newZoom = Math.max(0.5, Math.min(4, pinchStartZoomRef.current * ratio));
        if (Math.abs(newZoom - zoomRef.current) < 0.001) return;
        // Update ref + redraw synchronously so the canvas tracks fingers
        // without waiting for a React re-render round-trip.
        zoomRef.current = newZoom;
        redrawGrid();
        redrawInk();
        // Tell the parent so object layer, zoom percent readout, and
        // everything else that mirrors the state stays in sync.
        onZoomChangeRef.current?.(newZoom);
        return;
      }

      // Single-finger pan path
      if (lastPanRef.current) {
        const touch = touchesRef.current.values().next().value;
        if (touch) {
          const z = zoomRef.current;
          const dx = (touch.x - lastPanRef.current.x) / z;
          const dy = (touch.y - lastPanRef.current.y) / z;
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
      if (touchesRef.current.size === 0) {
        lastPanRef.current = null;
        pinchStartDistRef.current = null;
      } else if (touchesRef.current.size === 1) {
        // One finger remains after a pinch — resume pan from where
        // that finger currently is, not from its stale pre-pinch spot.
        pinchStartDistRef.current = null;
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

  // Tool cycling is handled by a toolbar button (works on all devices)

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
          cursor: tool === "grab" ? "grab" : tool === "eraser" ? "cell" : (tool === "pen" || tool === "line" || tool === "arrow" || tool === "rect" || tool === "circle") ? "crosshair" : "default",
          pointerEvents: (tool === "select" || disabled) ? "none" : "auto",
        }}
      />
    </div>
  );
}
