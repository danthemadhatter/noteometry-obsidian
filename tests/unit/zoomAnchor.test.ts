import { describe, it, expect } from "vitest";
import { scrollForZoomAnchor } from "../../src/lib/wheelZoom";

/**
 * v1.12.2 regression guardrail. Without scrollForZoomAnchor the canvas
 * effectively zooms toward world (0, 0), which Dan reported on Z Fold
 * as "zooms to the upper-left corner."
 *
 * The anchored-zoom invariant: the world point under (canvasX, canvasY)
 * is the same before and after the zoom step.
 *   worldX = scrollX + canvasX/zoom
 */

const worldUnder = (scroll: number, canvas: number, zoom: number): number =>
  scroll + canvas / zoom;

describe("scrollForZoomAnchor", () => {
  it("preserves the world point under the anchor across a zoom-in", () => {
    const before = { scrollX: 100, scrollY: 200, oldZoom: 1, newZoom: 2, canvasX: 400, canvasY: 300 };
    const after = scrollForZoomAnchor(before);
    expect(worldUnder(after.scrollX, before.canvasX, before.newZoom)).toBeCloseTo(
      worldUnder(before.scrollX, before.canvasX, before.oldZoom),
      9,
    );
    expect(worldUnder(after.scrollY, before.canvasY, before.newZoom)).toBeCloseTo(
      worldUnder(before.scrollY, before.canvasY, before.oldZoom),
      9,
    );
  });

  it("preserves the world point under the anchor across a zoom-out", () => {
    const before = { scrollX: -50, scrollY: 75, oldZoom: 2, newZoom: 0.5, canvasX: 250, canvasY: 180 };
    const after = scrollForZoomAnchor(before);
    expect(worldUnder(after.scrollX, before.canvasX, before.newZoom)).toBeCloseTo(
      worldUnder(before.scrollX, before.canvasX, before.oldZoom),
      9,
    );
  });

  it("is a no-op when zoom doesn't change", () => {
    const before = { scrollX: 12, scrollY: 34, oldZoom: 1.25, newZoom: 1.25, canvasX: 99, canvasY: 77 };
    const after = scrollForZoomAnchor(before);
    expect(after.scrollX).toBeCloseTo(12, 9);
    expect(after.scrollY).toBeCloseTo(34, 9);
  });

  it("anchors at canvas (0, 0) reproduces the legacy 'top-left' behaviour — no scroll change", () => {
    // Sanity: zooming around the literal top-left pixel needs no scroll
    // shift because canvasX*k = 0. This is what mainline did for every
    // zoom event before v1.12.2 — hence the bug Dan reported.
    const before = { scrollX: 100, scrollY: 200, oldZoom: 1, newZoom: 4, canvasX: 0, canvasY: 0 };
    const after = scrollForZoomAnchor(before);
    expect(after.scrollX).toBeCloseTo(100, 9);
    expect(after.scrollY).toBeCloseTo(200, 9);
  });

  it("round-trips zoom-in then zoom-out at the same anchor", () => {
    const start = { scrollX: 50, scrollY: 80 };
    const anchor = { canvasX: 320, canvasY: 240 };
    const zoomedIn = scrollForZoomAnchor({
      ...start, oldZoom: 1, newZoom: 2, ...anchor,
    });
    const zoomedOut = scrollForZoomAnchor({
      scrollX: zoomedIn.scrollX, scrollY: zoomedIn.scrollY,
      oldZoom: 2, newZoom: 1, ...anchor,
    });
    expect(zoomedOut.scrollX).toBeCloseTo(start.scrollX, 9);
    expect(zoomedOut.scrollY).toBeCloseTo(start.scrollY, 9);
  });
});
