import React, { useRef, useEffect, useState, useCallback } from "react";

interface LassoBounds {
  points: { x: number; y: number }[];
  minX: number; minY: number; maxX: number; maxY: number;
}

export type LassoAction = "ocr" | "move";

interface Props {
  active: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  onComplete: (bounds: LassoBounds) => void;
  onCancel: () => void;
  onAction?: (action: LassoAction, bounds: LassoBounds) => void;
  onMoveComplete?: (delta: { dx: number; dy: number }, bounds: LassoBounds) => void;
}

export type { LassoBounds };

export default function LassoOverlay({ active, containerRef, onComplete, onCancel, onAction, onMoveComplete }: Props) {
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  // Action bar state
  const [actionBar, setActionBar] = useState<{ x: number; y: number; bounds: LassoBounds } | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const moveDragRef = useRef<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const boundsRef = useRef<LassoBounds | null>(null);

  // Keep latest callbacks in refs so the effect doesn't re-run on every render
  const onCompleteRef = useRef(onComplete);
  const onCancelRef = useRef(onCancel);
  const onActionRef = useRef(onAction);
  const onMoveCompleteRef = useRef(onMoveComplete);
  onCompleteRef.current = onComplete;
  onCancelRef.current = onCancel;
  onActionRef.current = onAction;
  onMoveCompleteRef.current = onMoveComplete;

  // Reset state when deactivated
  useEffect(() => {
    if (!active) {
      setActionBar(null);
      setMoveMode(false);
      moveDragRef.current = null;
      boundsRef.current = null;
    }
  }, [active]);

  const handleOCR = useCallback(() => {
    if (!boundsRef.current) return;
    onActionRef.current?.("ocr", boundsRef.current);
  }, []);

  const handleMove = useCallback(() => {
    setMoveMode(true);
    setActionBar(null);
  }, []);

  // Move mode: drag handling via effect on the container
  useEffect(() => {
    if (!moveMode || !active) return;
    const container = containerRef.current;
    if (!container) return;

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
    };

    const onUp = (e: PointerEvent) => {
      if (!moveDragRef.current || !boundsRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const dx = moveDragRef.current.currentX - moveDragRef.current.startX;
      const dy = moveDragRef.current.currentY - moveDragRef.current.startY;
      moveDragRef.current = null;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        onMoveCompleteRef.current?.({ dx, dy }, boundsRef.current);
      }
      setMoveMode(false);
    };

    // Use a transparent overlay div for move dragging
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;z-index:310;" +
      "cursor:move;touch-action:none;pointer-events:auto;";
    container.appendChild(overlay);

    overlay.addEventListener("pointerdown", onDown, true);
    overlay.addEventListener("pointermove", onMove, true);
    overlay.addEventListener("pointerup", onUp, true);

    return () => {
      overlay.removeEventListener("pointerdown", onDown, true);
      overlay.removeEventListener("pointermove", onMove, true);
      overlay.removeEventListener("pointerup", onUp, true);
      overlay.remove();
    };
  }, [moveMode, active, containerRef]);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    // Create an overlay canvas
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

    const redraw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const pts = pointsRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (pts.length > 2) {
        ctx.fillStyle = "rgba(74, 144, 217, 0.08)";
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, pts[0]!.y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
        ctx.closePath();
        ctx.fill();
      }
      if (pts.length >= 2) {
        ctx.strokeStyle = "#4A90D9";
        ctx.lineWidth = 2;
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

    let captured = false;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || captured) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      canvas.setPointerCapture(e.pointerId);
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width;
      canvas.height = r.height;
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
        captured = true;
        // Let clicks pass through to toolbar/OCR button
        canvas.style.pointerEvents = "none";
        const bounds: LassoBounds = {
          points: [...pts],
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys),
        };
        boundsRef.current = bounds;
        // Show action bar near top of lasso bounding box
        const barX = (bounds.minX + bounds.maxX) / 2;
        const barY = bounds.minY - 10;
        setActionBar({ x: barX, y: Math.max(10, barY), bounds });
        onCompleteRef.current(bounds);
        // Keep the lasso drawing visible — don't clear canvas.
        // It stays until the effect cleanup removes the canvas element.
      } else {
        // Short drag / click — clear and let user retry
        onCancelRef.current();
        pointsRef.current = [];
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    // CAPTURE phase to intercept before canvas layers
    container.addEventListener("pointerdown", onDown, true);
    container.addEventListener("pointermove", onMove, true);
    container.addEventListener("pointerup", onUp, true);

    return () => {
      container.removeEventListener("pointerdown", onDown, true);
      container.removeEventListener("pointermove", onMove, true);
      container.removeEventListener("pointerup", onUp, true);
      canvas.remove();
      canvasRef.current = null;
      drawingRef.current = false;
      pointsRef.current = [];
    };
    // Only re-run when active changes — callbacks stored in refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, containerRef]);

  if (!active || !actionBar || moveMode) return null;

  return (
    <div
      className="noteometry-lasso-action-bar"
      style={{
        position: "absolute",
        left: actionBar.x,
        top: actionBar.y,
        transform: "translate(-50%, -100%)",
        zIndex: 320,
      }}
    >
      <button className="noteometry-lasso-action-btn" onClick={handleOCR}>OCR</button>
      <button className="noteometry-lasso-action-btn" onClick={handleMove}>Move</button>
    </div>
  );
}
