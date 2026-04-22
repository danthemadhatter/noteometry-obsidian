/**
 * Pure selection + mutation helpers for lasso Clear/Move.
 *
 * These live as a separate module so they can be unit-tested without a DOM
 * or React. NoteometryApp.handleLassoClear / handleLassoMoveComplete are the
 * thin composition-layer adapters that call these helpers.
 *
 * World coordinate convention: strokes, stamps, and canvas objects are all
 * stored in world units. Lasso bounds from LassoOverlay are in screen units
 * (relative to the viewport container). Callers must convert screen→world
 * before invoking these helpers.
 */
import { strokeIntersectsPolygon, stampIntersectsPolygon, type Stroke, type Stamp } from "../../lib/inkEngine";
import type { CanvasObject } from "../../lib/canvasObjects";
import type { LassoRegion } from "./useLassoStack";

export interface WorldPoint { x: number; y: number; }

export interface WorldBounds {
  minX: number; minY: number; maxX: number; maxY: number;
}

/** Screen-space → world-space for a polygon. `zoom` is the current zoom
 * factor; `scrollX/Y` is the world-space origin of the viewport. */
export function polygonToWorld(
  points: WorldPoint[],
  scrollX: number, scrollY: number, zoom: number,
): WorldPoint[] {
  return points.map((p) => ({ x: p.x / zoom + scrollX, y: p.y / zoom + scrollY }));
}

/** Screen-space bounds → world-space bounds. */
export function boundsToWorld(
  b: WorldBounds,
  scrollX: number, scrollY: number, zoom: number,
): WorldBounds {
  return {
    minX: b.minX / zoom + scrollX,
    minY: b.minY / zoom + scrollY,
    maxX: b.maxX / zoom + scrollX,
    maxY: b.maxY / zoom + scrollY,
  };
}

/** AABB overlap check used for canvas-object selection. */
export function objectOverlapsBounds(obj: CanvasObject, b: WorldBounds): boolean {
  const objRight = obj.x + obj.w;
  const objBottom = obj.y + obj.h;
  return !(objRight < b.minX || obj.x > b.maxX || objBottom < b.minY || obj.y > b.maxY);
}

/** True if any region's world polygon/bounds captures at least one stroke,
 * stamp, or canvas object. Used to decide whether Clear/Move should no-op
 * with a Notice vs. proceed. */
export function selectionIsEmpty(
  strokes: Stroke[],
  stamps: Stamp[],
  objects: CanvasObject[],
  polygons: WorldPoint[][],
  bounds: WorldBounds[],
): boolean {
  for (const poly of polygons) {
    if (strokes.some((s) => strokeIntersectsPolygon(s, poly))) return false;
    if (stamps.some((s) => stampIntersectsPolygon(s, poly))) return false;
  }
  for (const b of bounds) {
    if (objects.some((o) => objectOverlapsBounds(o, b))) return false;
  }
  return true;
}

/** Remove all strokes that fall inside ANY of the given polygons. Pure —
 * returns a new array. Used by lasso Clear/Delete. */
export function deleteStrokesInPolygons(strokes: Stroke[], polygons: WorldPoint[][]): Stroke[] {
  if (polygons.length === 0) return strokes;
  return strokes.filter((s) => !polygons.some((poly) => strokeIntersectsPolygon(s, poly)));
}

/** Remove all stamps that fall inside ANY of the given polygons. */
export function deleteStampsInPolygons(stamps: Stamp[], polygons: WorldPoint[][]): Stamp[] {
  if (polygons.length === 0) return stamps;
  return stamps.filter((s) => !polygons.some((poly) => stampIntersectsPolygon(s, poly)));
}

/** Remove all canvas objects whose bbox overlaps ANY of the given world
 * bounds. */
export function deleteObjectsInBounds(objects: CanvasObject[], bounds: WorldBounds[]): CanvasObject[] {
  if (bounds.length === 0) return objects;
  return objects.filter((o) => !bounds.some((b) => objectOverlapsBounds(o, b)));
}

/** Translate all strokes inside the polygon by (dx, dy). Pure. */
export function moveStrokesInPolygon(
  strokes: Stroke[], polygon: WorldPoint[], dx: number, dy: number,
): Stroke[] {
  return strokes.map((s) => {
    if (!strokeIntersectsPolygon(s, polygon)) return s;
    return { ...s, points: s.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
  });
}

/** Translate all stamps inside the polygon by (dx, dy). */
export function moveStampsInPolygon(
  stamps: Stamp[], polygon: WorldPoint[], dx: number, dy: number,
): Stamp[] {
  return stamps.map((s) => {
    if (!stampIntersectsPolygon(s, polygon)) return s;
    return { ...s, x: s.x + dx, y: s.y + dy };
  });
}

/** Translate all canvas objects whose bbox overlaps the bounds by (dx, dy). */
export function moveObjectsInBounds(
  objects: CanvasObject[], bounds: WorldBounds, dx: number, dy: number,
): CanvasObject[] {
  return objects.map((o) => {
    if (!objectOverlapsBounds(o, bounds)) return o;
    return { ...o, x: o.x + dx, y: o.y + dy };
  });
}

/** Convert a list of lasso regions (screen-space) into world-space polygons
 * and bounds for selection work. */
export function regionsToWorldSelection(
  regions: LassoRegion[],
  scrollX: number, scrollY: number, zoom: number,
): { polygons: WorldPoint[][]; bounds: WorldBounds[] } {
  const polygons: WorldPoint[][] = [];
  const bounds: WorldBounds[] = [];
  for (const r of regions) {
    polygons.push(polygonToWorld(r.bounds.points, scrollX, scrollY, zoom));
    bounds.push(boundsToWorld(r.bounds, scrollX, scrollY, zoom));
  }
  return { polygons, bounds };
}
