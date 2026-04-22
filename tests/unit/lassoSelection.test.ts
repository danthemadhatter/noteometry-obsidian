import { describe, it, expect } from "vitest";
import {
  polygonToWorld,
  boundsToWorld,
  objectOverlapsBounds,
  selectionIsEmpty,
  deleteStrokesInPolygons,
  deleteStampsInPolygons,
  deleteObjectsInBounds,
  moveStrokesInPolygon,
  moveStampsInPolygon,
  moveObjectsInBounds,
  regionsToWorldSelection,
  type WorldBounds,
} from "../../src/features/lasso/selection";
import type { Stroke, Stamp, StrokePoint } from "../../src/lib/inkEngine";
import type { CanvasObject } from "../../src/lib/canvasObjects";
import type { LassoRegion } from "../../src/features/lasso/useLassoStack";

const pt = (x: number, y: number, pressure = 0.5): StrokePoint => ({ x, y, pressure });

const mkStroke = (id: string, points: StrokePoint[]): Stroke => ({
  id, points, color: "#000", width: 2,
});

const mkStamp = (id: string, x: number, y: number): Stamp => ({
  id, x, y, text: "∫", fontSize: 24, color: "#000",
});

const mkTextBox = (id: string, x: number, y: number, w = 100, h = 50): CanvasObject =>
  ({ id, type: "textbox", x, y, w, h, html: "" } as unknown as CanvasObject);

// Axis-aligned rect polygon around (0,0)–(100,100)
const rectPoly = (minX: number, minY: number, maxX: number, maxY: number) => [
  { x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY },
];

const rectBounds = (minX: number, minY: number, maxX: number, maxY: number): WorldBounds =>
  ({ minX, minY, maxX, maxY });

describe("polygonToWorld / boundsToWorld", () => {
  it("polygonToWorld converts screen to world with zoom=1 / no scroll", () => {
    const poly = [{ x: 10, y: 20 }, { x: 30, y: 40 }];
    expect(polygonToWorld(poly, 0, 0, 1)).toEqual(poly);
  });

  it("polygonToWorld applies scroll offset", () => {
    const poly = [{ x: 10, y: 20 }];
    expect(polygonToWorld(poly, 100, 200, 1)).toEqual([{ x: 110, y: 220 }]);
  });

  it("polygonToWorld applies zoom", () => {
    const poly = [{ x: 100, y: 50 }];
    // At zoom=2, 100 screen px = 50 world units
    expect(polygonToWorld(poly, 0, 0, 2)).toEqual([{ x: 50, y: 25 }]);
  });

  it("boundsToWorld applies same transform", () => {
    const b = rectBounds(10, 20, 30, 40);
    expect(boundsToWorld(b, 5, 5, 1)).toEqual({ minX: 15, minY: 25, maxX: 35, maxY: 45 });
  });
});

describe("objectOverlapsBounds", () => {
  it("detects overlap", () => {
    expect(objectOverlapsBounds(mkTextBox("a", 50, 50), rectBounds(0, 0, 100, 100))).toBe(true);
  });
  it("detects non-overlap on right", () => {
    expect(objectOverlapsBounds(mkTextBox("a", 200, 50, 50, 50), rectBounds(0, 0, 100, 100))).toBe(false);
  });
  it("detects partial overlap as overlap", () => {
    expect(objectOverlapsBounds(mkTextBox("a", 80, 80, 100, 100), rectBounds(0, 0, 100, 100))).toBe(true);
  });
});

describe("selectionIsEmpty", () => {
  const poly = rectPoly(0, 0, 100, 100);
  const b = rectBounds(0, 0, 100, 100);

  it("true when nothing intersects", () => {
    const strokes = [mkStroke("s1", [pt(200, 200)])];
    const stamps = [mkStamp("st1", 300, 300)];
    const objs = [mkTextBox("o1", 500, 500)];
    expect(selectionIsEmpty(strokes, stamps, objs, [poly], [b])).toBe(true);
  });

  it("false if any stroke point is inside", () => {
    const strokes = [mkStroke("s1", [pt(50, 50)])];
    expect(selectionIsEmpty(strokes, [], [], [poly], [b])).toBe(false);
  });

  it("false if any stamp is inside", () => {
    const stamps = [mkStamp("st1", 50, 50)];
    expect(selectionIsEmpty([], stamps, [], [poly], [b])).toBe(false);
  });

  it("false if any object overlaps", () => {
    const objs = [mkTextBox("o1", 50, 50)];
    expect(selectionIsEmpty([], [], objs, [poly], [b])).toBe(false);
  });

  it("true when polygons/bounds list is empty", () => {
    const strokes = [mkStroke("s1", [pt(50, 50)])];
    expect(selectionIsEmpty(strokes, [], [], [], [])).toBe(true);
  });
});

describe("deleteStrokesInPolygons", () => {
  const poly = rectPoly(0, 0, 100, 100);

  it("removes strokes fully inside", () => {
    const strokes = [mkStroke("inside", [pt(50, 50)]), mkStroke("outside", [pt(200, 200)])];
    const result = deleteStrokesInPolygons(strokes, [poly]);
    expect(result.map((s) => s.id)).toEqual(["outside"]);
  });

  it("removes strokes with at least one point inside", () => {
    const strokes = [mkStroke("partial", [pt(50, 50), pt(200, 200)])];
    expect(deleteStrokesInPolygons(strokes, [poly])).toHaveLength(0);
  });

  it("empty polygon list is a no-op", () => {
    const strokes = [mkStroke("x", [pt(50, 50)])];
    expect(deleteStrokesInPolygons(strokes, [])).toEqual(strokes);
  });

  it("handles multiple polygons (union semantics)", () => {
    const a = rectPoly(0, 0, 100, 100);
    const b = rectPoly(200, 200, 300, 300);
    const strokes = [
      mkStroke("in-a", [pt(50, 50)]),
      mkStroke("in-b", [pt(250, 250)]),
      mkStroke("neither", [pt(500, 500)]),
    ];
    const result = deleteStrokesInPolygons(strokes, [a, b]);
    expect(result.map((s) => s.id)).toEqual(["neither"]);
  });

  it("returns a new array (pure)", () => {
    const strokes = [mkStroke("x", [pt(500, 500)])];
    const result = deleteStrokesInPolygons(strokes, [poly]);
    expect(result).not.toBe(strokes);
  });
});

describe("deleteStampsInPolygons", () => {
  const poly = rectPoly(0, 0, 100, 100);

  it("removes stamps whose center is inside", () => {
    const stamps = [mkStamp("inside", 50, 50), mkStamp("outside", 500, 500)];
    const result = deleteStampsInPolygons(stamps, [poly]);
    expect(result.map((s) => s.id)).toEqual(["outside"]);
  });
});

describe("deleteObjectsInBounds", () => {
  const b = rectBounds(0, 0, 100, 100);

  it("removes overlapping objects", () => {
    const objs = [mkTextBox("in", 20, 20, 30, 30), mkTextBox("out", 500, 500)];
    const result = deleteObjectsInBounds(objs, [b]);
    expect(result.map((o) => o.id)).toEqual(["out"]);
  });
});

describe("moveStrokesInPolygon", () => {
  const poly = rectPoly(0, 0, 100, 100);

  it("translates strokes inside and leaves outside unchanged", () => {
    const strokes = [
      mkStroke("inside", [pt(50, 50)]),
      mkStroke("outside", [pt(500, 500)]),
    ];
    const result = moveStrokesInPolygon(strokes, poly, 10, 20);
    expect(result[0]!.points[0]).toMatchObject({ x: 60, y: 70 });
    expect(result[1]!.points[0]).toMatchObject({ x: 500, y: 500 });
  });

  it("preserves relative positions of multi-point strokes", () => {
    const strokes = [mkStroke("s", [pt(10, 10), pt(50, 50), pt(90, 90)])];
    const result = moveStrokesInPolygon(strokes, poly, 100, 0);
    const [a, b, c] = result[0]!.points;
    expect(b!.x - a!.x).toBe(40);
    expect(c!.x - b!.x).toBe(40);
  });

  it("returns new stroke objects (pure)", () => {
    const strokes = [mkStroke("s", [pt(50, 50)])];
    const result = moveStrokesInPolygon(strokes, poly, 1, 1);
    expect(result[0]).not.toBe(strokes[0]);
  });

  it("preserves stroke identity when unchanged", () => {
    const s = mkStroke("out", [pt(500, 500)]);
    const result = moveStrokesInPolygon([s], poly, 10, 10);
    expect(result[0]).toBe(s);
  });
});

describe("moveStampsInPolygon", () => {
  const poly = rectPoly(0, 0, 100, 100);

  it("translates stamps inside and leaves outside", () => {
    const stamps = [mkStamp("in", 50, 50), mkStamp("out", 500, 500)];
    const result = moveStampsInPolygon(stamps, poly, 10, 20);
    expect(result[0]).toMatchObject({ x: 60, y: 70 });
    expect(result[1]).toMatchObject({ x: 500, y: 500 });
  });
});

describe("moveObjectsInBounds", () => {
  const b = rectBounds(0, 0, 100, 100);

  it("translates overlapping objects and preserves relative positions", () => {
    const objs = [
      mkTextBox("a", 10, 10, 50, 50),
      mkTextBox("b", 40, 40, 50, 50),
      mkTextBox("out", 500, 500, 50, 50),
    ];
    const result = moveObjectsInBounds(objs, b, 100, 0);
    expect(result[0]).toMatchObject({ x: 110, y: 10 });
    expect(result[1]).toMatchObject({ x: 140, y: 40 });
    expect(result[2]).toMatchObject({ x: 500, y: 500 });
    // Relative positions preserved
    expect(result[1]!.x - result[0]!.x).toBe(30);
  });
});

describe("regionsToWorldSelection", () => {
  const region: LassoRegion = {
    id: "r1",
    bounds: {
      points: rectPoly(10, 20, 30, 40),
      minX: 10, minY: 20, maxX: 30, maxY: 40,
    },
    capturedImage: "data:image/png;base64,",
  };

  it("converts regions to polygons + bounds in world space", () => {
    const { polygons, bounds } = regionsToWorldSelection([region], 5, 5, 1);
    expect(polygons).toHaveLength(1);
    expect(bounds).toHaveLength(1);
    expect(bounds[0]).toEqual({ minX: 15, minY: 25, maxX: 35, maxY: 45 });
    expect(polygons[0]![0]).toEqual({ x: 15, y: 25 });
  });

  it("is empty when regions list is empty", () => {
    const { polygons, bounds } = regionsToWorldSelection([], 0, 0, 1);
    expect(polygons).toEqual([]);
    expect(bounds).toEqual([]);
  });
});

describe("lasso clear + move integration (pure helpers)", () => {
  // Simulate the NoteometryApp.handleLassoClear flow on pure data.
  it("Clear removes selected strokes and leaves others; undo-able snapshot", () => {
    const strokes = [
      mkStroke("a", [pt(10, 10)]),
      mkStroke("b", [pt(50, 50)]),
      mkStroke("c", [pt(500, 500)]),
    ];
    const poly = rectPoly(0, 0, 100, 100);
    const before = strokes;
    const after = deleteStrokesInPolygons(strokes, [poly]);
    expect(after.map((s) => s.id)).toEqual(["c"]);
    // The "before" array is a valid undo snapshot — unchanged.
    expect(before).toHaveLength(3);
  });

  it("Move translates strokes + stamps + objects by the same delta", () => {
    const poly = rectPoly(0, 0, 100, 100);
    const b = rectBounds(0, 0, 100, 100);
    const strokes = [mkStroke("s", [pt(50, 50)])];
    const stamps = [mkStamp("st", 60, 60)];
    const objs = [mkTextBox("o", 20, 20, 40, 40)];

    const dx = 200, dy = 50;
    const ns = moveStrokesInPolygon(strokes, poly, dx, dy);
    const nst = moveStampsInPolygon(stamps, poly, dx, dy);
    const no = moveObjectsInBounds(objs, b, dx, dy);

    expect(ns[0]!.points[0]).toMatchObject({ x: 250, y: 100 });
    expect(nst[0]).toMatchObject({ x: 260, y: 110 });
    expect(no[0]).toMatchObject({ x: 220, y: 70 });
  });
});
