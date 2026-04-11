/* ── Canvas Renderer ────────────────────────────────────
   Pure rendering functions: grid, strokes.
   Handles devicePixelRatio for Retina crispness.
   No state, no React — just drawing.
   ──────────────────────────────────────────────────────── */

import type { Stroke, StrokePoint, Stamp } from "./inkEngine";
import type { CanvasObject } from "./canvasObjects";

// 1/8 inch at 96 DPI = 12px. Every 8th line is 1 inch (96px).
const GRID_MINOR = 12;
const GRID_MAJOR = GRID_MINOR * 8; // 96px

// Blueprint grid on vellum — desaturated navy-ish blue at low alpha so the
// lines read as drafting-pad rule, not as modern UI grid.
const GRID_MINOR_COLOR = "rgba(100, 135, 175, 0.22)";
const GRID_MAJOR_COLOR = "rgba(100, 135, 175, 0.48)";
const GRID_MINOR_WIDTH = 0.5;
const GRID_MAJOR_WIDTH = 1.0;

// Vellum background — matches --nm-canvas-bg in styles.css
const GRID_BG_COLOR = "#f7efd8";

/** Set up canvas for Retina (call once on mount and resize) */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  return ctx;
}

/** Draw 1/8-inch graph paper grid */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  scrollX: number,
  scrollY: number,
  width: number,
  height: number
): void {
  ctx.clearRect(0, 0, width, height);

  // Fill background (vellum)
  ctx.fillStyle = GRID_BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  // Calculate grid offset from scroll position
  const startX = -(scrollX % GRID_MINOR);
  const startY = -(scrollY % GRID_MINOR);

  // Draw minor lines first
  ctx.strokeStyle = GRID_MINOR_COLOR;
  ctx.lineWidth = GRID_MINOR_WIDTH;
  ctx.beginPath();

  for (let x = startX; x <= width; x += GRID_MINOR) {
    const worldX = x + scrollX;
    // Skip major lines (they'll be drawn thicker)
    if (Math.abs(worldX % GRID_MAJOR) < 0.5) continue;
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, height);
  }
  for (let y = startY; y <= height; y += GRID_MINOR) {
    const worldY = y + scrollY;
    if (Math.abs(worldY % GRID_MAJOR) < 0.5) continue;
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
  }
  ctx.stroke();

  // Draw major lines (every 1 inch)
  ctx.strokeStyle = GRID_MAJOR_COLOR;
  ctx.lineWidth = GRID_MAJOR_WIDTH;
  ctx.beginPath();

  const majorStartX = -(scrollX % GRID_MAJOR);
  const majorStartY = -(scrollY % GRID_MAJOR);

  for (let x = majorStartX; x <= width; x += GRID_MAJOR) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, height);
  }
  for (let y = majorStartY; y <= height; y += GRID_MAJOR) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
  }
  ctx.stroke();
}

/** Draw a single stroke — uniform width, no pressure sensitivity */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  scrollX: number,
  scrollY: number
): void {
  const pts = stroke.points;
  if (pts.length < 2) {
    // Single point — draw a dot
    if (pts.length === 1) {
      const p = pts[0]!;
      ctx.fillStyle = stroke.color;
      ctx.beginPath();
      ctx.arc(p.x - scrollX, p.y - scrollY, stroke.width * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;

  // Draw as a single smooth path
  ctx.beginPath();
  const p0 = pts[0]!;
  ctx.moveTo(p0.x - scrollX, p0.y - scrollY);

  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    ctx.quadraticCurveTo(a.x - scrollX, a.y - scrollY, midX - scrollX, midY - scrollY);
  }

  // Final segment
  const last = pts[pts.length - 1]!;
  ctx.lineTo(last.x - scrollX, last.y - scrollY);
  ctx.stroke();
}

/** Draw all strokes */
export function drawAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  scrollX: number,
  scrollY: number,
  width: number,
  height: number
): void {
  // Simple viewport culling — skip strokes entirely outside the view
  for (const stroke of strokes) {
    drawStroke(ctx, stroke, scrollX, scrollY);
  }
}

/** Draw a stamp (dropped math symbol) on canvas */
function drawStamp(
  ctx: CanvasRenderingContext2D,
  stamp: Stamp,
  scrollX: number,
  scrollY: number
): void {
  ctx.font = `${stamp.fontSize}px "Times New Roman", "STIX Two Math", serif`;
  ctx.fillStyle = stamp.color;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(stamp.text, stamp.x - scrollX, stamp.y - scrollY);
}

/** Draw all stamps */
export function drawAllStamps(
  ctx: CanvasRenderingContext2D,
  stamps: Stamp[],
  scrollX: number,
  scrollY: number
): void {
  for (const stamp of stamps) {
    drawStamp(ctx, stamp, scrollX, scrollY);
  }
}

/**
 * Render specific strokes AND stamps to an offscreen canvas at high resolution.
 * Used by lasso crop for OCR — renders at `scale`x for maximum clarity.
 */
export function renderStrokesToImage(
  strokes: Stroke[],
  padding: number = 20,
  scale: number = 3,
  stamps: Stamp[] = []
): string {
  if (strokes.length === 0 && stamps.length === 0) return "";

  // Compute bounding box of all strokes AND stamps
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  for (const st of stamps) {
    const estW = st.fontSize * st.text.length * 0.7;
    const estH = st.fontSize * 1.2;
    if (st.x < minX) minX = st.x;
    if (st.y - estH < minY) minY = st.y - estH;
    if (st.x + estW > maxX) maxX = st.x + estW;
    if (st.y > maxY) maxY = st.y;
  }

  const w = (maxX - minX + padding * 2) * scale;
  const h = (maxY - minY + padding * 2) * scale;

  if (w <= 0 || h <= 0) return "";

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // White background for OCR
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  // Render at scale, offset so bounding box starts at (padding, padding)
  ctx.scale(scale, scale);
  const offsetX = minX - padding;
  const offsetY = minY - padding;

  for (const stroke of strokes) {
    drawStroke(ctx, stroke, offsetX, offsetY);
  }
  for (const stamp of stamps) {
    drawStamp(ctx, stamp, offsetX, offsetY);
  }

  return canvas.toDataURL("image/png");
}

/**
 * Render a full lasso region to an image: strokes, stamps, AND canvas objects
 * (images, text boxes, tables). This captures everything the user sees in the
 * selected area so the AI can process homework screenshots, diagrams, etc.
 *
 * Returns a Promise because image objects need to be loaded asynchronously.
 */
export async function renderLassoRegionToImage(
  regionBounds: { minX: number; minY: number; maxX: number; maxY: number },
  strokes: Stroke[],
  stamps: Stamp[],
  canvasObjects: CanvasObject[],
  padding: number = 20,
  scale: number = 3
): Promise<string> {
  const { minX, minY, maxX, maxY } = regionBounds;
  const regionW = maxX - minX + padding * 2;
  const regionH = maxY - minY + padding * 2;

  if (regionW <= 0 || regionH <= 0) return "";

  const w = regionW * scale;
  const h = regionH * scale;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // White background for OCR
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  ctx.scale(scale, scale);
  const offsetX = minX - padding;
  const offsetY = minY - padding;

  // 1. Draw strokes
  for (const stroke of strokes) {
    drawStroke(ctx, stroke, offsetX, offsetY);
  }

  // 2. Draw stamps
  for (const stamp of stamps) {
    drawStamp(ctx, stamp, offsetX, offsetY);
  }

  // 3. Draw canvas objects (images, text placeholders)
  for (const obj of canvasObjects) {
    const objRight = obj.x + obj.w;
    const objBottom = obj.y + obj.h;

    // Skip objects fully outside the region
    if (objRight < minX || obj.x > maxX || objBottom < minY || obj.y > maxY) continue;

    const drawX = obj.x - offsetX;
    const drawY = obj.y - offsetY;

    if (obj.type === "image" && obj.dataURL) {
      // Load and draw the image
      try {
        const img = await loadImage(obj.dataURL);
        ctx.drawImage(img, drawX, drawY, obj.w, obj.h);
      } catch {
        // Draw placeholder if image fails to load
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(drawX, drawY, obj.w, obj.h);
        ctx.fillStyle = "#999";
        ctx.font = "12px sans-serif";
        ctx.fillText("[Image]", drawX + 8, drawY + 20);
      }
    } else if (obj.type === "textbox" || obj.type === "table") {
      // Draw a bordered box with the type label — the actual content
      // is in the DOM, so we render a visible placeholder for the AI
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(drawX, drawY, obj.w, obj.h);
      ctx.strokeStyle = "#ccc";
      ctx.lineWidth = 1;
      ctx.strokeRect(drawX, drawY, obj.w, obj.h);
      ctx.fillStyle = "#666";
      ctx.font = "11px sans-serif";
      ctx.fillText(obj.type === "textbox" ? "[Text Box]" : "[Table]", drawX + 6, drawY + 16);
    }
  }

  return canvas.toDataURL("image/png");
}

/** Load an image from a data URL */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
