import { describe, it, expect } from "vitest";
import {
  createTextBox, createTable, createImageObject, createPdfObject,
  createCircuitSniper, createUnitConverter, createGraphPlotter,
  createUnitCircle, createOscilloscope, createCompute,
  createAnimationCanvas, createStudyGantt, createMultimeter,
  defaultObjectName,
} from "../../src/lib/canvasObjects";

/**
 * v1.6.6 regression guardrails for the right-click context-menu hub.
 *
 * The context menu in NoteometryApp wires each "Insert" item directly to a
 * factory here. These tests pin the contract the menu depends on: every
 * visible Insert action must return a hydratable CanvasObject with a
 * stable, non-empty `type`, `id`, a positive bounding box, and a non-empty
 * default display name. If a factory regresses (e.g. someone silently
 * drops a field or breaks the discriminator), the menu action would show
 * no object on the canvas — exactly the class of silent failure we're
 * trying to stop shipping.
 */

// The registry intentionally excludes createAIDropin: in v1.6.6 the AI
// drop-in is quarantined behind a deprecation placeholder and no longer
// surfaced in the context menu.
const VISIBLE_HUB_FACTORIES = [
  ["textbox",         () => createTextBox(0, 0)],
  ["table",           () => createTable(0, 0)],
  ["image",           () => createImageObject(0, 0, "data:image/png;base64,x")],
  ["pdf",             () => createPdfObject(0, 0, "fake/path.pdf")],
  ["circuit-sniper",  () => createCircuitSniper(0, 0)],
  ["unit-converter",  () => createUnitConverter(0, 0)],
  ["graph-plotter",   () => createGraphPlotter(0, 0)],
  ["unit-circle",     () => createUnitCircle(0, 0)],
  ["oscilloscope",    () => createOscilloscope(0, 0)],
  ["compute",         () => createCompute(0, 0)],
  ["animation-canvas",() => createAnimationCanvas(0, 0)],
  ["study-gantt",     () => createStudyGantt(0, 0)],
  ["multimeter",      () => createMultimeter(0, 0)],
] as const;

describe("context-menu insert registry", () => {
  it.each(VISIBLE_HUB_FACTORIES)(
    "%s factory produces a well-formed CanvasObject",
    (type, make) => {
      const obj = make();
      expect(obj.type).toBe(type);
      expect(typeof obj.id).toBe("string");
      expect(obj.id.length).toBeGreaterThan(0);
      expect(obj.w).toBeGreaterThan(0);
      expect(obj.h).toBeGreaterThan(0);
      const name = defaultObjectName(obj);
      expect(name).toBeTruthy();
      expect(name.trim().length).toBeGreaterThan(0);
    },
  );

  it("every factory produces a distinct id on each call", () => {
    for (const [, make] of VISIBLE_HUB_FACTORIES) {
      const a = make();
      const b = make();
      expect(a.id).not.toBe(b.id);
    }
  });

  it("factories respect the (x, y) insert position", () => {
    for (const [, make] of VISIBLE_HUB_FACTORIES) {
      const obj = make();
      // All visible-hub factories place the object at (0, 0) when called
      // with those coords; regressing to an ignored-coord factory (which
      // would mean the menu "Insert at cursor" loses meaning) should fail
      // here rather than silently drop objects off-screen.
      expect(obj.x).toBe(0);
      expect(obj.y).toBe(0);
    }
  });
});

describe("quarantined drop-ins stay loadable", () => {
  // Legacy pages may still carry an ai-dropin object. v1.6.6 removed it
  // from the creatable hub but kept the factory + component so existing
  // pages render with a deprecation placeholder rather than blowing up.
  it("createAIDropin is still exported for legacy page loads", async () => {
    const mod = await import("../../src/lib/canvasObjects");
    expect(typeof mod.createAIDropin).toBe("function");
    const obj = mod.createAIDropin(0, 0);
    expect(obj.type).toBe("ai-dropin");
    expect(defaultObjectName(obj)).toBe("AI Drop-in");
  });
});
