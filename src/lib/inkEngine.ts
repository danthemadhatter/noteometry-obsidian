/* ── Ink Engine ─────────────────────────────────────────
   Pure logic: stroke data model, smoothing, hit-testing.
   No DOM, no React — just math.
   ──────────────────────────────────────────────────────── */

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface Stroke {
  id: string;
  points: StrokePoint[];
  color: string;
  width: number; // base width, modulated by pressure
}

/** Stamp size presets — small for subscript, normal for body, large for display. */
export type StampSize = "small" | "normal" | "large";
export const STAMP_SIZES: Record<StampSize, number> = {
  small: 48,
  normal: 96,
  large: 144,
};

/** A "stamp" — a math symbol dropped onto the canvas from the palette.
 *  Rendered as crisp text on the canvas, captured by lasso just like ink. */
export interface Stamp {
  id: string;
  x: number;
  y: number;
  text: string;     // display character (e.g., "∫", "3", "α")
  fontSize: number;
  color: string;
  /** Optional size preset. If set, fontSize is derived from this. */
  size?: StampSize;
}

export function newStampId(): string {
  return crypto.randomUUID();
}

export function stampBBox(stamp: Stamp): BBox {
  // Generous bounding box for click hit-testing
  const w = Math.max(stamp.fontSize * stamp.text.length * 0.8, stamp.fontSize);
  const h = stamp.fontSize * 1.4;
  return { x: stamp.x - 4, y: stamp.y - h + 4, w: w + 8, h: h + 8 };
}

export function stampIntersectsPolygon(
  stamp: Stamp,
  polygon: { x: number; y: number }[]
): boolean {
  const bb = stampBBox(stamp);
  // Check if center of stamp is inside polygon
  const cx = bb.x + bb.w / 2;
  const cy = bb.y + bb.h / 2;
  return pointInPolygon(cx, cy, polygon);
}

/** Bounding box for spatial queries */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Generate unique stroke ID */
export function newStrokeId(): string {
  return crypto.randomUUID();
}

/** Check if a point is within `tolerance` of any segment of a stroke */
export function pointNearStroke(
  px: number, py: number,
  stroke: Stroke,
  tolerance: number
): boolean {
  const pts = stroke.points;
  if (pts.length === 0) return false;

  // Single-point stroke (a dot): check distance to the point itself.
  // Without this, the segment loop below runs 0 iterations for a 1-point
  // stroke and the function returns false, making dots un-erasable.
  if (pts.length === 1) {
    const p = pts[0]!;
    return Math.hypot(px - p.x, py - p.y) < tolerance;
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (pointToSegmentDist(px, py, a.x, a.y, b.x, b.y) < tolerance) {
      return true;
    }
  }
  return false;
}

/** Distance from point to line segment */
function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Smooth raw pointer input using Catmull-Rom → cubic Bezier conversion.
 * This removes jitter while preserving the natural feel of the stroke.
 * Only smooths if there are enough points; short strokes pass through.
 */
export function smoothPoints(raw: StrokePoint[], tension = 0.5): StrokePoint[] {
  if (raw.length < 4) return raw;

  const result: StrokePoint[] = [raw[0]!];
  const n = raw.length;

  for (let i = 1; i < n - 2; i++) {
    const p0 = raw[i - 1]!;
    const p1 = raw[i]!;
    const p2 = raw[i + 1]!;
    const p3 = raw[i + 2]!;

    // Interpolate between p1 and p2 with subdivision
    const steps = 3;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;

      // Catmull-Rom basis functions
      const f0 = -tension * t + 2 * tension * t2 - tension * t3;
      const f1 = 1 + (tension - 3) * t2 + (2 - tension) * t3;
      const f2 = tension * t + (3 - 2 * tension) * t2 + (tension - 2) * t3;
      const f3 = -tension * t2 + tension * t3;

      result.push({
        x: f0 * p0.x + f1 * p1.x + f2 * p2.x + f3 * p3.x,
        y: f0 * p0.y + f1 * p1.y + f2 * p2.y + f3 * p3.y,
        pressure: f0 * p0.pressure + f1 * p1.pressure + f2 * p2.pressure + f3 * p3.pressure,
      });
    }
  }

  // Add last two points
  result.push(raw[n - 2]!);
  result.push(raw[n - 1]!);
  return result;
}

/** Check if any stroke point falls inside a polygon (for lasso selection) */
export function strokeIntersectsPolygon(
  stroke: Stroke,
  polygon: { x: number; y: number }[]
): boolean {
  // Check if any point of the stroke is inside the polygon
  for (const p of stroke.points) {
    if (pointInPolygon(p.x, p.y, polygon)) return true;
  }
  return false;
}

/** Ray-casting point-in-polygon test */
function pointInPolygon(
  x: number, y: number,
  polygon: { x: number; y: number }[]
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i]!.x, yi = polygon[i]!.y;
    const xj = polygon[j]!.x, yj = polygon[j]!.y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
