import { describe, it, expect } from "vitest";
import {
  stampBBox,
  strokeBBox,
  pointNearStroke,
  smoothPoints,
  strokeIntersectsPolygon,
  stampIntersectsPolygon,
  pointInPolygonExport,
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

describe("strokeBBox", () => {
  it("returns zero-size for empty stroke", () => {
    const bb = strokeBBox(mkStroke([]));
    expect(bb.w).toBe(0);
    expect(bb.h).toBe(0);
  });

  it("bounds all points", () => {
    const s = mkStroke([pt(10, 20), pt(50, 80), pt(30, 40)]);
    const bb = strokeBBox(s);
    expect(bb.x).toBe(10);
    expect(bb.y).toBe(20);
    expect(bb.w).toBe(40); // 50 - 10
    expect(bb.h).toBe(60); // 80 - 20
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

describe("pointInPolygonExport", () => {
  const square = [
    { x: 0, y: 0 }, { x: 100, y: 0 },
    { x: 100, y: 100 }, { x: 0, y: 100 },
  ];

  it("detects point inside", () => {
    expect(pointInPolygonExport(50, 50, square)).toBe(true);
  });

  it("rejects point outside", () => {
    expect(pointInPolygonExport(150, 50, square)).toBe(false);
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
