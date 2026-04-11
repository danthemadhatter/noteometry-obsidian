import { describe, it, expect } from "vitest";
import {
  stampBBox,
  pointNearStroke,
  smoothPoints,
  strokeIntersectsPolygon,
  stampIntersectsPolygon,
  type Stroke,
  type StrokePoint,
  type Stamp,
} from "../../src/lib/inkEngine";

const pt = (x: number, y: number, pressure = 0.5): StrokePoint => ({ x, y, pressure });

const mkStroke = (points: StrokePoint[]): Stroke => ({
  id: "test",
  points,
  color: "#000",
  width: 2,
});

const mkStamp = (x: number, y: number, text = "∫"): Stamp => ({
  id: "test",
  x, y,
  text,
  fontSize: 28,
  color: "#000",
});

describe("stampBBox", () => {
  it("returns a bounding box with positive dimensions", () => {
    const bb = stampBBox(mkStamp(100, 100));
    expect(bb.w).toBeGreaterThan(0);
    expect(bb.h).toBeGreaterThan(0);
  });

  it("bbox contains the stamp position", () => {
    const bb = stampBBox(mkStamp(100, 100));
    expect(bb.x).toBeLessThanOrEqual(100);
    expect(bb.y).toBeLessThanOrEqual(100);
  });
});

describe("pointNearStroke", () => {
  const s = mkStroke([pt(0, 0), pt(100, 0)]);

  it("detects point near a stroke segment", () => {
    expect(pointNearStroke(50, 3, s, 10)).toBe(true);
  });

  it("rejects point far from stroke", () => {
    expect(pointNearStroke(50, 50, s, 10)).toBe(false);
  });

  it("detects point near endpoint", () => {
    expect(pointNearStroke(2, 0, s, 5)).toBe(true);
  });

  // Regression: the old implementation treated a dot (single-point stroke)
  // as never erasable because its segment loop ran zero iterations.
  // These tests guard against that bug ever coming back.
  describe("single-point strokes (dots)", () => {
    const dot = mkStroke([pt(50, 50)]);

    it("detects point exactly on a dot", () => {
      expect(pointNearStroke(50, 50, dot, 5)).toBe(true);
    });

    it("detects point within tolerance of a dot", () => {
      expect(pointNearStroke(53, 54, dot, 10)).toBe(true);
    });

    it("rejects point outside tolerance of a dot", () => {
      expect(pointNearStroke(80, 80, dot, 5)).toBe(false);
    });

    it("rejects empty stroke", () => {
      expect(pointNearStroke(0, 0, mkStroke([]), 100)).toBe(false);
    });
  });
});

describe("smoothPoints", () => {
  it("returns raw points if fewer than 4", () => {
    const raw = [pt(0, 0), pt(10, 10)];
    expect(smoothPoints(raw)).toBe(raw);
  });

  it("returns more points than input when smoothing", () => {
    const raw = [pt(0, 0), pt(10, 5), pt(20, 0), pt(30, 5), pt(40, 0)];
    const smoothed = smoothPoints(raw);
    expect(smoothed.length).toBeGreaterThan(raw.length);
  });

  it("preserves first and last points", () => {
    const raw = [pt(0, 0), pt(10, 5), pt(20, 0), pt(30, 5)];
    const smoothed = smoothPoints(raw);
    expect(smoothed[0]!.x).toBe(0);
    expect(smoothed[smoothed.length - 1]!.x).toBe(30);
  });
});

describe("strokeIntersectsPolygon", () => {
  const square = [
    { x: 0, y: 0 }, { x: 100, y: 0 },
    { x: 100, y: 100 }, { x: 0, y: 100 },
  ];

  it("detects stroke with points inside polygon", () => {
    const s = mkStroke([pt(50, 50), pt(60, 60)]);
    expect(strokeIntersectsPolygon(s, square)).toBe(true);
  });

  it("rejects stroke entirely outside polygon", () => {
    const s = mkStroke([pt(200, 200), pt(300, 300)]);
    expect(strokeIntersectsPolygon(s, square)).toBe(false);
  });
});

describe("stampIntersectsPolygon", () => {
  const square = [
    { x: 0, y: 0 }, { x: 200, y: 0 },
    { x: 200, y: 200 }, { x: 0, y: 200 },
  ];

  it("detects stamp inside polygon", () => {
    expect(stampIntersectsPolygon(mkStamp(100, 100), square)).toBe(true);
  });

  it("rejects stamp outside polygon", () => {
    expect(stampIntersectsPolygon(mkStamp(500, 500), square)).toBe(false);
  });
});
