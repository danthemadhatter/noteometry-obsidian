import { describe, it, expect } from "vitest";
import { scrollForZoomAnchor } from "../../src/lib/wheelZoom";

/**
 * v1.7.7 regression guardrail: zoom must keep the world point under
 * the anchor pixel at the same screen position across the zoom step.
 * Without scrollForZoomAnchor the canvas effectively zooms toward
 * world (0, 0), which the user reported as "anchored to the top-left
 * corner."
 *
 * Invariant: worldX = scrollX + canvasX/zoom must be the same before
 * and after.
 */

const worldUnder = (scrollX: number, canvasX: number, zoom: number): number =>
  scrollX + canvasX / zoom;

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

  it("anchors at canvas (0, 0) reproduces the legacy 'top-left' bug — i.e. no scroll change", () => {
    // Sanity check that the math degenerates correctly: if you zoom
    // around the literal top-left pixel of the canvas, the scroll
    // doesn't need to change because canvasX*k = 0.
    const before = { scrollX: 100, scrollY: 200, oldZoom: 1, newZoom: 4, canvasX: 0, canvasY: 0 };
    const after = scrollForZoomAnchor(before);
    expect(after.scrollX).toBeCloseTo(100, 9);
    expect(after.scrollY).toBeCloseTo(200, 9);
  });

  it("anchors at the centroid for round-trip zoom (in then out)", () => {
    const start = { scrollX: 50, scrollY: 80 };
    const anchor = { canvasX: 320, canvasY: 240 };
    const zoomedIn = scrollForZoomAnchor({
      ...start, oldZoom: 1, newZoom: 2, ...anchor,
    });
    const zoomedOut = scrollForZoomAnchor({
      scrollX: zoomedIn.scrollX, scrollY: zoomedIn.scrollY,
      oldZoom: 2, newZoom: 1, ...anchor,
    });
    // Round trip should land exactly back at the start (within fp epsilon).
    expect(zoomedOut.scrollX).toBeCloseTo(start.scrollX, 9);
    expect(zoomedOut.scrollY).toBeCloseTo(start.scrollY, 9);
  });
});
