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
  /** Called when the user double-taps/double-clicks on empty canvas.
   * Parent decides the next tool state (typically cycles pen → eraser →
   * lasso → pen). Works on pen (Apple Pencil) AND mouse — the Mac path
   * was previously missing, which left Dan without a keyboard-free tool
   * switcher. */
  onCycleTool?: () => void;
  disabled?: boolean;
  selectedStampId?: string | null;
  onEraseStart?: () => void;
  onEraseEnd?: () => void;
  /** If true, a single-finger touch draws instead of pans. Two-finger
   * touch still pans/pinches. Default false (iPad + Apple Pencil flow). */
  fingerDrawing?: boolean;
}

export default function InkCanvas({
  strokes, onStrokesChange, stamps, onStampsChange,
  activeColor, strokeWidth,
  tool, onToolChange, scrollX, scrollY, onViewportChange,
  zoom = 1,
  zoomLocked = false,
  onZoomChange,
  onCycleTool,
  disabled = false, selectedStampId = null,
  onEraseStart, onEraseEnd,
  fingerDrawing = false,
}: Props) {
  const fingerDrawingRef = useRef(fingerDrawing);
  useEffect(() => { fingerDrawingRef.current = fingerDrawing; }, [fingerDrawing]);
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

  // Double-tap / double-click detection — fires for BOTH Apple Pencil
  // (iPad, pen pointer type) and mouse (Mac, desktop). Parent handles the
  // cycle via onCycleTool. One shared timer so rapid clicks/taps cross
  // pointer types cleanly.
  const lastTapTimeRef = useRef(0);
  const lastTapPosRef = useRef<{ x: number; y: number } | null>(null);

  const onCycleToolRef = useRef(onCycleTool);

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
  useEffect(() => { onCycleToolRef.current = onCycleTool; }, [onCycleTool]);

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

  // ── Pen/Eraser pointer handlers ──────────────────────
  // Touch events are normally routed to the touch-pan handler below. When
  // fingerDrawing is on, single-finger touches draw instead; only multi-
  // touch reaches the pan/pinch handler.
  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.pointerType === "touch") {
      if (!fingerDrawingRef.current) return;
      // A second finger arriving while one is already down is a pinch,
      // not a stroke — bail so the pan handler runs instead.
      if (touchesRef.current.size > 0) return;
    }
    if (e.button === 2) return; // right-click — let onContextMenu handle it

    // Double-tap / double-click detection for pen AND mouse. Fires
    // onCycleTool in the parent, which drives pen → eraser → rect-lasso
    // → pen. Works on Mac where there's no Apple Pencil double-tap.
    if (e.pointerType === "pen" || e.pointerType === "mouse") {
      const now = performance.now();
      const prev = lastTapPosRef.current;
      const elapsed = now - lastTapTimeRef.current;
      if (elapsed < 350 && prev) {
        const dist = Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
        if (dist < 12) {
          lastTapTimeRef.current = 0;
          lastTapPosRef.current = null;
          e.preventDefault();
          e.stopPropagation();
          onCycleToolRef.current?.();
          return;
        }
      }
      lastTapTimeRef.current = now;
      lastTapPosRef.current = { x: e.clientX, y: e.clientY };
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
    if (e.pointerType === "touch") {
      if (!fingerDrawingRef.current) return;
      // A second finger entered → pinch/pan owns the gesture now.
      if (touchesRef.current.size > 1) return;
    }

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
    // Release pointer capture unconditionally so a touch sequence that set
    // capture on pointerdown doesn't keep eating events after the finger
    // lifts — which was making the top/bottom toolbars stop responding.
    const canvas = inkCanvasRef.current;
    if (canvas && canvas.hasPointerCapture?.(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    if (e.pointerType === "touch" && !fingerDrawingRef.current) return;

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
  // Single-finger drag → pan.
  // Two fingers → pan (by the centroid delta) AND zoom (by the distance
  // ratio) simultaneously, frame by frame. This is the standard mobile
  // gesture model (Google Maps, Figma, iOS Photos): two fingers moving
  // together scroll the canvas, two fingers spreading zoom in place.
  //
  // The old implementation froze pan when a second finger joined and only
  // zoomed based on the ratio against the initial distance, which is why
  // Android two-finger scrolls registered as tiny pinch-zooms — the
  // centroid was moving but only the distance was being read.
  //
  // touch-action: none on .noteometry-ink-layer plus the preventTouch
  // handler below keeps the OS from eating our gestures (double-tap
  // zoom, rubber-band scroll, etc.). All canvas gestures are ours.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Per-frame refs: we update these on every pointermove so pan and
    // zoom both read the *last* frame's values, not the initial snapshot.
    // pinchStartDistRef/pinchStartZoomRef are reused as "last-frame" state.
    const getMulti = (): { cx: number; cy: number; dist: number } | null => {
      const vals = Array.from(touchesRef.current.values());
      if (vals.length < 2) return null;
      const [a, b] = vals;
      return {
        cx: (a!.x + b!.x) / 2,
        cy: (a!.y + b!.y) / 2,
        dist: Math.hypot(b!.x - a!.x, b!.y - a!.y),
      };
    };

    const armMulti = () => {
      const m = getMulti();
      if (!m) return;
      pinchStartDistRef.current = m.dist;
      pinchStartZoomRef.current = zoomRef.current;
      // Reuse lastPanRef as the centroid tracker while multi-touch is
      // active — single-finger pan is suspended during multi-touch so
      // there's no conflict.
      lastPanRef.current = { x: m.cx, y: m.cy };
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (fingerDrawingRef.current) {
        // Finger-drawing mode: single finger draws via the pen handler;
        // only arm pan/pinch once a second finger joins.
        if (touchesRef.current.size === 2) {
          // Abort any in-progress single-finger stroke so the user can't
          // accidentally leave a tick-mark when they start two-finger pan.
          if (isDrawingRef.current) {
            isDrawingRef.current = false;
            activeStrokeRef.current = [];
            redrawInk();
          }
          armMulti();
        }
        return;
      }

      if (touchesRef.current.size === 1) {
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        pinchStartDistRef.current = null;
      } else if (touchesRef.current.size === 2) {
        // Second finger landed — start tracking centroid + distance so
        // we can pan AND zoom on every subsequent move.
        armMulti();
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Multi-touch path (2+ fingers): combined pan-by-centroid +
      // zoom-by-distance. Runs every frame so gestures feel continuous.
      if (touchesRef.current.size >= 2 && pinchStartDistRef.current !== null) {
        const m = getMulti();
        if (!m || !lastPanRef.current) return;

        // Pan: move the viewport by the centroid delta. Always applied,
        // even when zoom is locked, so two-finger scroll works.
        const z = zoomRef.current;
        const dx = (m.cx - lastPanRef.current.x) / z;
        const dy = (m.cy - lastPanRef.current.y) / z;
        if (dx !== 0 || dy !== 0) {
          const newX = scrollRef.current.x - dx;
          const newY = scrollRef.current.y - dy;
          scrollRef.current = { x: newX, y: newY };
          onViewportChange(newX, newY);
        }
        lastPanRef.current = { x: m.cx, y: m.cy };

        // Zoom: apply distance ratio against the *previous* frame's
        // distance, so pinch and pan compose cleanly. Skipped if locked
        // or if the distance effectively hasn't changed (pure pan).
        if (!zoomLockedRef.current && m.dist > 0 && pinchStartDistRef.current > 0) {
          const ratio = m.dist / pinchStartDistRef.current;
          // Dead-zone: ignore sub-1% distance jitter so two-finger pan
          // doesn't accidentally zoom when fingers rotate slightly.
          if (Math.abs(ratio - 1) > 0.01) {
            const newZoom = Math.max(0.5, Math.min(4, zoomRef.current * ratio));
            if (Math.abs(newZoom - zoomRef.current) > 0.001) {
              zoomRef.current = newZoom;
              onZoomChangeRef.current?.(newZoom);
            }
          }
        }
        pinchStartDistRef.current = m.dist;

        redrawGrid();
        redrawInk();
        return;
      }

      // Single-finger pan path — skipped entirely when finger-drawing
      // is on so the pen handler owns the stroke.
      if (fingerDrawingRef.current) return;
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
        // One finger remains after multi-touch — resume single-finger
        // pan from where that finger currently is, not from a stale
        // centroid. Drop the multi-touch state.
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
