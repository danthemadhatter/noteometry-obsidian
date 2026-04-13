import React, { useRef, useEffect, useCallback, useState } from "react";
import type { ImageAnnotatorObject, RelativeStroke } from "../../lib/canvasObjects";
import type NoteometryPlugin from "../../main";
import { loadImageFromVault } from "../../lib/persistence";
import { smoothPoints } from "../../lib/inkEngine";

const ANNOTATION_COLORS = [
  { color: "#FF3B30", label: "Red" },
  { color: "#007AFF", label: "Blue" },
  { color: "#34C759", label: "Green" },
  { color: "#1C1C1E", label: "Black" },
];

const MIN_PRESSURE_WIDTH = 1.5;
const MAX_PRESSURE_WIDTH = 6;

interface Props {
  obj: ImageAnnotatorObject;
  onChange: (patch: Partial<ImageAnnotatorObject>) => void;
  plugin?: NoteometryPlugin;
  onSendToAI?: (dataUrl: string) => void;
}

export default function ImageAnnotator({ obj, onChange, plugin, onSendToAI }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string>(obj.imagePath);
  const [imgError, setImgError] = useState(false);
  const [strokeColor, setStrokeColor] = useState(ANNOTATION_COLORS[0]!.color);
  const activeStrokeRef = useRef<{ x: number; y: number; pressure: number }[]>([]);
  const isDrawingRef = useRef(false);

  // Resolve vault path to data URL
  useEffect(() => {
    setImgError(false);
    if (!obj.imagePath || obj.imagePath.startsWith("data:") || !plugin) {
      setResolvedSrc(obj.imagePath);
      return;
    }
    let cancelled = false;
    loadImageFromVault(plugin, obj.imagePath)
      .then((dataUrl) => { if (!cancelled) setResolvedSrc(dataUrl); })
      .catch(() => { if (!cancelled) setImgError(true); });
    return () => { cancelled = true; };
  }, [plugin, obj.imagePath]);

  // Redraw all strokes whenever strokes or canvas size changes
  const redrawStrokes = useCallback(() => {
    const canvas = inkCanvasRef.current;
    const container = contentRef.current;
    if (!canvas || !container) return;
    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    for (const stroke of obj.strokes) {
      drawStroke(ctx, stroke, width, height);
    }
  }, [obj.strokes]);

  // ResizeObserver to keep canvas synced
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => redrawStrokes());
    ro.observe(container);
    redrawStrokes();
    return () => ro.disconnect();
  }, [redrawStrokes]);

  // Draw a single relative stroke onto the canvas context
  function drawStroke(
    ctx: CanvasRenderingContext2D,
    stroke: RelativeStroke,
    w: number, h: number
  ) {
    const smoothed = smoothPoints(
      stroke.points.map((p) => ({
        x: p.x * w,
        y: p.y * h,
        pressure: p.pressure,
      }))
    );
    if (smoothed.length === 0) return;

    ctx.strokeStyle = stroke.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 0; i < smoothed.length - 1; i++) {
      const p0 = smoothed[i]!;
      const p1 = smoothed[i + 1]!;
      const avgPressure = (p0.pressure + p1.pressure) / 2;
      ctx.lineWidth = MIN_PRESSURE_WIDTH + avgPressure * (MAX_PRESSURE_WIDTH - MIN_PRESSURE_WIDTH);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }

  // Pointer handlers for annotation drawing
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only Apple Pencil (pen) draws
    if (e.pointerType !== "pen") return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    activeStrokeRef.current = [{ x, y, pressure: e.pressure }];
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || e.pointerType !== "pen") return;
    e.preventDefault();
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    activeStrokeRef.current.push({ x, y, pressure: e.pressure });

    // Live preview: draw the in-progress stroke
    const canvas = inkCanvasRef.current;
    const container = contentRef.current;
    if (!canvas || !container) return;
    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Draw just the last segment for performance
    const pts = activeStrokeRef.current;
    if (pts.length < 2) return;
    const p0 = pts[pts.length - 2]!;
    const p1 = pts[pts.length - 1]!;
    const avgPressure = (p0.pressure + p1.pressure) / 2;
    ctx.strokeStyle = strokeColor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = MIN_PRESSURE_WIDTH + avgPressure * (MAX_PRESSURE_WIDTH - MIN_PRESSURE_WIDTH);
    ctx.beginPath();
    ctx.moveTo(p0.x * width, p0.y * height);
    ctx.lineTo(p1.x * width, p1.y * height);
    ctx.stroke();
  }, [strokeColor]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || e.pointerType !== "pen") return;
    isDrawingRef.current = false;
    if (activeStrokeRef.current.length > 0) {
      const newStroke: RelativeStroke = {
        points: activeStrokeRef.current,
        color: strokeColor,
        width: MAX_PRESSURE_WIDTH,
      };
      onChange({ strokes: [...obj.strokes, newStroke] });
      activeStrokeRef.current = [];
    }
  }, [strokeColor, obj.strokes, onChange]);

  const handleClearInk = useCallback(() => {
    onChange({ strokes: [] });
  }, [onChange]);

  const handleRead = useCallback(() => {
    if (!onSendToAI) return;
    const container = contentRef.current;
    const img = imgRef.current;
    const inkCanvas = inkCanvasRef.current;
    if (!container || !inkCanvas) return;

    const { offsetWidth: w, offsetHeight: h } = container;
    const dpr = window.devicePixelRatio || 1;
    const offscreen = document.createElement("canvas");
    offscreen.width = w * dpr * 2;
    offscreen.height = h * dpr * 2;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr * 2, dpr * 2);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, w, h);
    }
    ctx.drawImage(inkCanvas, 0, 0, w, h);
    onSendToAI(offscreen.toDataURL("image/png"));
  }, [onSendToAI]);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "4px",
        padding: "2px 6px", flexShrink: 0,
        borderBottom: "1px solid var(--nm-paper-border, #ddd)",
        background: "var(--nm-faceplate-recessed, #f5f2ea)",
        minHeight: "36px",
      }}>
        {ANNOTATION_COLORS.map((c) => (
          <button
            key={c.color}
            title={c.label}
            onClick={() => setStrokeColor(c.color)}
            style={{
              width: 28, height: 28, minWidth: 28, borderRadius: "50%",
              background: c.color, border: strokeColor === c.color ? "2px solid #333" : "2px solid transparent",
              cursor: "pointer", padding: 0, flexShrink: 0,
            }}
          />
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={handleClearInk}
          title="Clear Ink"
          style={{
            padding: "4px 10px", fontSize: "12px", fontWeight: 600,
            background: "none", border: "1px solid var(--nm-paper-border, #ccc)",
            borderRadius: "4px", cursor: "pointer", minHeight: "32px", minWidth: "44px",
          }}
        >
          Clear Ink
        </button>
        <button
          onClick={handleRead}
          title="Read — send snapshot to AI"
          style={{
            padding: "4px 10px", fontSize: "12px", fontWeight: 600,
            background: "var(--nm-accent, #4a6fa5)", color: "#fff",
            border: "none", borderRadius: "4px", cursor: "pointer",
            minHeight: "32px", minWidth: "44px",
          }}
        >
          Read
        </button>
      </div>
      {/* Content: image + ink overlay */}
      <div
        ref={contentRef}
        style={{ flex: 1, position: "relative", overflow: "hidden", touchAction: "none" }}
      >
        {obj.imagePath ? (
          imgError ? (
            <div style={{
              width: "100%", height: "100%", display: "flex",
              alignItems: "center", justifyContent: "center",
              background: "#f4e9d0", color: "#c8382c", fontSize: "12px",
              fontFamily: "monospace", textAlign: "center", padding: "8px",
            }}>
              Image not found: {obj.imagePath}
            </div>
          ) : (
            <img
              ref={imgRef}
              src={resolvedSrc}
              alt="Annotator image"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              draggable={false}
            />
          )
        ) : (
          <div style={{
            width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center",
            color: "#999", fontSize: "14px", userSelect: "none",
          }}>
            Insert an image to annotate
          </div>
        )}
        <canvas
          ref={inkCanvasRef}
          style={{
            position: "absolute", top: 0, left: 0,
            width: "100%", height: "100%",
            pointerEvents: "all", touchAction: "none",
            background: "transparent",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
    </div>
  );
}
