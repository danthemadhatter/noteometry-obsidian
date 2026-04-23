import { describe, it, expect } from "vitest";
import { nextWheelZoom, ZOOM_MIN, ZOOM_MAX } from "../../src/lib/wheelZoom";

/**
 * v1.6.10 regression guardrail.
 *
 * The MBP trackpad pinch regression was a rounding bug: a Chromium
 * pinch emits wheel events with deltaY values like -0.5, which at
 * scale 0.01 is a -0.005 zoom change. The pre-v1.6.10 handler rounded
 * to 2 decimals, so that change snapped to zero and the user saw no
 * visible zoom motion. These tests pin the rounding to 3 decimals so
 * a future refactor can't silently walk it back.
 */

describe("nextWheelZoom", () => {
  it("applies a visible change for small pinch deltas (MBP trackpad)", () => {
    const next = nextWheelZoom({ zoom: 1, deltaY: -0.5, ctrlKey: true, metaKey: false });
    // deltaY -0.5 × scale 0.01 = +0.005 → 1.005
    expect(next).toBeCloseTo(1.005, 4);
    expect(next).toBeGreaterThan(1);
  });

  it("applies a larger change for Cmd+wheel (mouse) than for pinch", () => {
    // Same deltaY, different modifiers — pinch (ctrl only) uses 0.01, Cmd (meta) uses 0.005.
    const pinch = nextWheelZoom({ zoom: 1, deltaY: -10, ctrlKey: true, metaKey: false });
    const cmd   = nextWheelZoom({ zoom: 1, deltaY: -10, ctrlKey: false, metaKey: true });
    expect(pinch - 1).toBeGreaterThan(cmd - 1);
  });

  it("zooms in when deltaY is negative (pinch-out)", () => {
    const next = nextWheelZoom({ zoom: 1, deltaY: -10, ctrlKey: true, metaKey: false });
    expect(next).toBeGreaterThan(1);
  });

  it("zooms out when deltaY is positive (pinch-in)", () => {
    const next = nextWheelZoom({ zoom: 1, deltaY: 10, ctrlKey: true, metaKey: false });
    expect(next).toBeLessThan(1);
  });

  it("clamps to ZOOM_MIN", () => {
    const next = nextWheelZoom({ zoom: ZOOM_MIN, deltaY: 999, ctrlKey: true, metaKey: false });
    expect(next).toBe(ZOOM_MIN);
  });

  it("clamps to ZOOM_MAX", () => {
    const next = nextWheelZoom({ zoom: ZOOM_MAX, deltaY: -999, ctrlKey: true, metaKey: false });
    expect(next).toBe(ZOOM_MAX);
  });

  it("rounds to 3 decimals (the whole reason for this helper)", () => {
    // Pick a delta that would produce lots of floating fuzz.
    const next = nextWheelZoom({ zoom: 1.0, deltaY: -0.333, ctrlKey: true, metaKey: false });
    // Check it's rounded — multiply by 1000 should be an integer.
    expect(next * 1000).toBeCloseTo(Math.round(next * 1000), 6);
  });

  it("a no-modifier wheel event still gets the slow scale (defensive)", () => {
    // The handler only calls nextWheelZoom when ctrl/meta is set, but the
    // helper stays total regardless so it's safe to reuse elsewhere.
    const next = nextWheelZoom({ zoom: 1, deltaY: -10, ctrlKey: false, metaKey: false });
    expect(next).toBeCloseTo(1.05, 3);
  });
});
