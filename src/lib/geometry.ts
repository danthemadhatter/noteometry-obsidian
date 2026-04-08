/** Ray-casting point-in-polygon test */
export function pointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    if (
      pi.y > py !== pj.y > py &&
      px < ((pj.x - pi.x) * (py - pi.y)) / (pj.y - pi.y) + pi.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Check if an element's bounding box intersects a lasso polygon.
 *  Tests all 4 corners of the element AND samples along edges. */
export function elementIntersectsPolygon(
  el: { x: number; y: number; width: number; height: number },
  polygon: { x: number; y: number }[]
): boolean {
  const corners = [
    { x: el.x, y: el.y },
    { x: el.x + el.width, y: el.y },
    { x: el.x + el.width, y: el.y + el.height },
    { x: el.x, y: el.y + el.height },
  ];
  // If any corner is inside the polygon, element is selected
  if (corners.some((c) => pointInPolygon(c.x, c.y, polygon))) return true;

  // Also check center
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  if (pointInPolygon(cx, cy, polygon)) return true;

  // Check if any polygon vertex is inside the element bbox (for small polygon around large element)
  for (const p of polygon) {
    if (p.x >= el.x && p.x <= el.x + el.width && p.y >= el.y && p.y <= el.y + el.height) {
      return true;
    }
  }

  return false;
}
