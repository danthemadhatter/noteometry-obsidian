import { useRef, useEffect } from "react";

interface LassoBounds {
  points: { x: number; y: number }[];
  minX: number; minY: number; maxX: number; maxY: number;
}

interface Props {
  active: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  onComplete: (bounds: LassoBounds) => void;
  onCancel: () => void;
}

export type { LassoBounds };

export default function LassoOverlay({ active, containerRef, onComplete, onCancel }: Props) {
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  // Keep latest callbacks in refs so the effect doesn't re-run on every render
  const onCompleteRef = useRef(onComplete);
  const onCancelRef = useRef(onCancel);
  onCompleteRef.current = onComplete;
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    // Create an overlay canvas
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;z-index:99999;" +
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

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
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
        onCompleteRef.current({
          points: [...pts],
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys),
        });
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

    // CAPTURE phase to intercept before Excalidraw
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

  return null;
}
