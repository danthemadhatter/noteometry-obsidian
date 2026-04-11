import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { LassoRegion } from "../features/lasso/useLassoStack";

interface LassoBounds {
  points: { x: number; y: number }[];
  minX: number; minY: number; maxX: number; maxY: number;
}

export type { LassoBounds };

interface Props {
  active: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  /** Completed regions in the current lasso stack (drawn persistently as outlines). */
  regions: LassoRegion[];
  /** Called when the user finishes drawing a new lasso. Parent should rasterize and pushRegion. */
  onComplete: (bounds: LassoBounds) => void;
  /** Called when the user draws an invalid (too-short) lasso. */
  onCancel: () => void;
  /** Called when user clicks Clear — wipes the stack. */
  onClear: () => void;
  /** Called when user clicks OCR/Process — composites the stack and sends to AI. */
  onProcess: () => void;
  /** Optional Move action — only shown when the stack has exactly one region. */
  onMoveComplete?: (delta: { dx: number; dy: number }, bounds: LassoBounds) => void;
}

export default function LassoOverlay({
  active,
  containerRef,
  regions,
  onComplete,
  onCancel,
  onClear,
  onProcess,
  onMoveComplete,
}: Props) {
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  // Mirror regions into a ref so the main drawing effect can read the latest
  // list without needing regions in its deps (which would cause listener
  // re-attachment on every stack change).
  const regionsRef = useRef(regions);
  regionsRef.current = regions;

  // Redraw function handle, exposed from the setup effect so the
  // regions-watching effect below can trigger a redraw without re-running
  // the setup.
  const redrawRef = useRef<(() => void) | null>(null);

  // Move mode state (only meaningful when stack has exactly 1 region)
  const [moveMode, setMoveMode] = useState(false);
  const moveDragRef = useRef<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const moveBoundsRef = useRef<LassoBounds | null>(null);
  const snapshotRef = useRef<{ canvas: HTMLCanvasElement; sx: number; sy: number } | null>(null);
  const ghostCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Callback refs so the setup effect doesn't re-run when parent re-renders
  const onCompleteRef = useRef(onComplete);
  const onCancelRef = useRef(onCancel);
  const onMoveCompleteRef = useRef(onMoveComplete);
  onCompleteRef.current = onComplete;
  onCancelRef.current = onCancel;
  onMoveCompleteRef.current = onMoveComplete;

  // Action bar position: top-center of the MOST RECENT region.
  // When a new region is pushed, the bar visually "follows" it.
  const actionBarPos = useMemo(() => {
    if (regions.length === 0) return null;
    const last = regions[regions.length - 1]!.bounds;
    const x = (last.minX + last.maxX) / 2;
    const y = Math.max(10, last.minY - 10);
    return { x, y };
  }, [regions]);

  // Reset move state when deactivated
  useEffect(() => {
    if (!active) {
      setMoveMode(false);
      moveDragRef.current = null;
      moveBoundsRef.current = null;
    }
  }, [active]);

  const handleMove = useCallback(() => {
    // Move only makes sense when there's exactly one region.
    const current = regionsRef.current;
    if (current.length !== 1) return;
    moveBoundsRef.current = current[0]!.bounds;
    setMoveMode(true);
  }, []);

  // Capture a snapshot of the lasso region from the ink canvas for ghost rendering
  const captureSnapshot = useCallback(() => {
    const container = containerRef.current;
    if (!container || !moveBoundsRef.current) return;
    const inkCanvas = container.querySelector<HTMLCanvasElement>(".noteometry-ink-layer");
    if (!inkCanvas) return;
    const bounds = moveBoundsRef.current;
    const dpr = window.devicePixelRatio || 1;

    const cssSx = Math.max(0, Math.floor(bounds.minX));
    const cssSy = Math.max(0, Math.floor(bounds.minY));
    const cssSw = Math.ceil(bounds.maxX - bounds.minX);
    const cssSh = Math.ceil(bounds.maxY - bounds.minY);
    if (cssSw <= 0 || cssSh <= 0) return;

    const pxSx = Math.floor(cssSx * dpr);
    const pxSy = Math.floor(cssSy * dpr);
    const pxSw = Math.min(inkCanvas.width - pxSx, Math.ceil(cssSw * dpr));
    const pxSh = Math.min(inkCanvas.height - pxSy, Math.ceil(cssSh * dpr));
    if (pxSw <= 0 || pxSh <= 0) return;

    const offscreen = document.createElement("canvas");
    offscreen.width = cssSw;
    offscreen.height = cssSh;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(inkCanvas, pxSx, pxSy, pxSw, pxSh, 0, 0, cssSw, cssSh);

    snapshotRef.current = { canvas: offscreen, sx: cssSx, sy: cssSy };
  }, [containerRef]);

  const drawGhost = useCallback((dx: number, dy: number) => {
    const gc = ghostCanvasRef.current;
    const snap = snapshotRef.current;
    if (!gc || !snap) return;
    const ctx = gc.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, gc.width, gc.height);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(snap.canvas, snap.sx + dx, snap.sy + dy);
    ctx.globalAlpha = 1.0;
  }, []);

  // Move mode: drag handling via effect on the container
  useEffect(() => {
    if (!moveMode || !active) return;
    const container = containerRef.current;
    if (!container) return;

    const gc = ghostCanvasRef.current;
    if (gc) {
      const rect = container.getBoundingClientRect();
      gc.width = rect.width;
      gc.height = rect.height;
    }

    const rafId = requestAnimationFrame(() => {
      captureSnapshot();
    });

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      moveDragRef.current = { startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY };
    };

    const onMove = (e: PointerEvent) => {
      if (!moveDragRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      moveDragRef.current.currentX = e.clientX;
      moveDragRef.current.currentY = e.clientY;
      const dx = e.clientX - moveDragRef.current.startX;
      const dy = e.clientY - moveDragRef.current.startY;
      drawGhost(dx, dy);
    };

    const onUp = (e: PointerEvent) => {
      if (!moveDragRef.current || !moveBoundsRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const dx = moveDragRef.current.currentX - moveDragRef.current.startX;
      const dy = moveDragRef.current.currentY - moveDragRef.current.startY;
      const bounds = moveBoundsRef.current;
      moveDragRef.current = null;
      snapshotRef.current = null;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        onMoveCompleteRef.current?.({ dx, dy }, bounds);
      }
      setMoveMode(false);
    };

    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;z-index:310;" +
      "cursor:move;touch-action:none;pointer-events:auto;";
    container.appendChild(overlay);

    overlay.addEventListener("pointerdown", onDown, true);
    overlay.addEventListener("pointermove", onMove, true);
    overlay.addEventListener("pointerup", onUp, true);

    return () => {
      cancelAnimationFrame(rafId);
      overlay.removeEventListener("pointerdown", onDown, true);
      overlay.removeEventListener("pointermove", onMove, true);
      overlay.removeEventListener("pointerup", onUp, true);
      overlay.remove();
      snapshotRef.current = null;
    };
  }, [moveMode, active, containerRef, captureSnapshot, drawGhost]);

  // Main drawing effect — attaches pointer listeners and provides redraw()
  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;z-index:300;" +
      "cursor:crosshair;touch-action:none;pointer-events:auto;";
    canvas.dataset.lasso = "true";
    container.appendChild(canvas);
    canvasRef.current = canvas;

    const getPoint = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const drawPolygon = (
      ctx: CanvasRenderingContext2D,
      pts: { x: number; y: number }[],
      fillAlpha: number,
    ) => {
      if (pts.length > 2) {
        // Phosphor amber fill, very low alpha — the "active selection" tint
        ctx.fillStyle = `rgba(255, 176, 0, ${fillAlpha})`;
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, pts[0]!.y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
        ctx.closePath();
        ctx.fill();
      }
      if (pts.length >= 2) {
        // Phosphor amber dashed outline — high contrast against vellum,
        // distinct from the blueprint-blue canvas grid so selections are
        // unambiguous against the background.
        ctx.strokeStyle = "#ffb000";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, pts[0]!.y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };

    const redraw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Ensure canvas pixel dimensions match the container's current size.
      // (May have changed since the canvas was created if the view resized.)
      const rect = container.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw persistent region outlines from the stack (subtle fill)
      for (const region of regionsRef.current) {
        drawPolygon(ctx, region.bounds.points, 0.08);
      }

      // Draw in-progress polygon on top (brighter fill)
      drawPolygon(ctx, pointsRef.current, 0.15);
    };

    // Expose redraw so the regions-watching effect can trigger paints
    // without re-running this setup.
    redrawRef.current = redraw;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // Don't intercept clicks that land on the action bar — let those
      // flow through to the buttons. Also ignore clicks on any UI that
      // the canvas shouldn't steal.
      const target = e.target as HTMLElement | null;
      if (target?.closest(".noteometry-lasso-action-bar")) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      canvas.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      pointsRef.current = [getPoint(e)];
      redraw();
    };

    const onMove = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      pointsRef.current.push(getPoint(e));
      redraw();
    };

    const onUp = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      canvas.releasePointerCapture(e.pointerId);
      drawingRef.current = false;

      const pts = pointsRef.current;
      if (pts.length >= 10) {
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const bounds: LassoBounds = {
          points: [...pts],
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys),
        };
        // Clear WIP points. The parent will async rasterize + push to
        // regions, and the regions-watching effect will then redraw
        // with the new persistent outline.
        pointsRef.current = [];
        redraw();
        onCompleteRef.current(bounds);
      } else {
        // Short drag / click — dismiss the WIP attempt and let the user retry.
        onCancelRef.current();
        pointsRef.current = [];
        redraw();
      }
    };

    // CAPTURE phase so we intercept before the ink/object layers
    container.addEventListener("pointerdown", onDown, true);
    container.addEventListener("pointermove", onMove, true);
    container.addEventListener("pointerup", onUp, true);

    // Initial paint — show any pre-existing regions on reactivation
    redraw();

    return () => {
      container.removeEventListener("pointerdown", onDown, true);
      container.removeEventListener("pointermove", onMove, true);
      container.removeEventListener("pointerup", onUp, true);
      canvas.remove();
      canvasRef.current = null;
      drawingRef.current = false;
      pointsRef.current = [];
      redrawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, containerRef]);

  // Trigger redraws when regions change (without re-running the setup effect)
  useEffect(() => {
    redrawRef.current?.();
  }, [regions]);

  if (!active) return null;

  // Move mode: render the ghost preview canvas over everything
  if (moveMode) {
    return (
      <canvas
        ref={ghostCanvasRef}
        className="noteometry-lasso-ghost"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 305,
          pointerEvents: "none",
        }}
      />
    );
  }

  // No regions drawn yet → no action bar, just the drawing canvas (created above).
  if (!actionBarPos || regions.length === 0) return null;

  const regionCount = regions.length;
  const canMove = regionCount === 1;

  return (
    <div
      className="noteometry-lasso-action-bar"
      style={{
        position: "absolute",
        left: actionBarPos.x,
        top: actionBarPos.y,
        transform: "translate(-50%, -100%)",
        zIndex: 320,
      }}
    >
      <span className="noteometry-lasso-count">
        {regionCount} {regionCount === 1 ? "region" : "regions"}
      </span>
      <button className="noteometry-lasso-action-btn" onClick={onProcess}>OCR</button>
      <button className="noteometry-lasso-action-btn" onClick={onClear}>Clear</button>
      {canMove && (
        <button className="noteometry-lasso-action-btn" onClick={handleMove}>Move</button>
      )}
    </div>
  );
}
