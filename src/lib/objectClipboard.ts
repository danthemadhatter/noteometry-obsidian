import type { CanvasObject } from "./canvasObjects";

/**
 * Pure helper for the canvas object clipboard. The right-click hub has
 * always exposed a "Copy" entry that stashed the hit object into a ref,
 * but v1.6.10 shipped without the matching "Paste" — the stash went in
 * and never came out, so Copy silently did nothing from the user's
 * perspective. Keeping the paste math in its own module so the test
 * suite can pin the offset / id behaviour without pulling in React.
 *
 * Produces a fresh object with a new id and a small offset from the
 * anchor point (or from the copy's own position when no anchor is
 * given), so repeated pastes cascade instead of stacking on top of
 * each other.
 */

export interface PastePoint {
  x: number;
  y: number;
}

export const PASTE_OFFSET = 24;

export function makePastedObject(
  source: CanvasObject,
  anchor: PastePoint | null,
  newId: () => string = () => crypto.randomUUID(),
): CanvasObject {
  const target: PastePoint = anchor
    ? { x: anchor.x, y: anchor.y }
    : { x: source.x + PASTE_OFFSET, y: source.y + PASTE_OFFSET };
  return {
    ...source,
    id: newId(),
    x: target.x,
    y: target.y,
  };
}
