import { describe, it, expect } from "vitest";
import {
  createTextBox, createTable, createImageObject, createPdfObject,
  createMathObject, createChatObject,
  defaultObjectName, stripRemovedObjects,
} from "../../src/lib/canvasObjects";

/**
 * v1.10.0 regression guardrails for the right-click context-menu hub.
 *
 * The context menu in NoteometryApp wires each "Insert" item directly to a
 * factory here. v1.10 culled the engineering / math-tools / study / legacy-AI
 * drop-ins; the surviving inserts are Text/Table/Image/PDF. Math + Chat are
 * NOT manually-insertable — they only spawn from the lasso 123/ABC radial or
 * from Solve on a math drop-in. We still pin the factory contract for them so
 * the spawn paths stay honest.
 */

const VISIBLE_HUB_FACTORIES = [
  ["textbox",         () => createTextBox(0, 0)],
  ["table",           () => createTable(0, 0)],
  ["image",           () => createImageObject(0, 0, "data:image/png;base64,x")],
  ["pdf",             () => createPdfObject(0, 0, "fake/path.pdf")],
] as const;

const SPAWN_ONLY_FACTORIES = [
  ["math",            () => createMathObject(0, 0)],
  ["chat",            () => createChatObject(0, 0)],
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
      expect(obj.x).toBe(0);
      expect(obj.y).toBe(0);
    }
  });
});

describe("v1.10 spawn-only factories (Math + Chat)", () => {
  it.each(SPAWN_ONLY_FACTORIES)(
    "%s factory produces a well-formed CanvasObject",
    (type, make) => {
      const obj = make();
      expect(obj.type).toBe(type);
      expect(typeof obj.id).toBe("string");
      expect(obj.id.length).toBeGreaterThan(0);
      expect(obj.w).toBeGreaterThan(0);
      expect(obj.h).toBeGreaterThan(0);
      const name = defaultObjectName(obj);
      expect(name.trim().length).toBeGreaterThan(0);
    },
  );

  it("createMathObject defaults to empty latex + non-pending", () => {
    const m = createMathObject(0, 0);
    expect(m.type).toBe("math");
    expect(m.latex).toBe("");
    expect(m.pending).toBe(false);
  });

  it("createChatObject defaults to empty messages", () => {
    const c = createChatObject(0, 0);
    expect(c.type).toBe("chat");
    expect(c.messages).toEqual([]);
    expect(c.attachedImage).toBeUndefined();
    expect(c.seedLatex).toBeUndefined();
  });

  it("createChatObject pins lasso image when provided", () => {
    const c = createChatObject(0, 0, { attachedImage: "data:image/png;base64,xyz" });
    expect(c.attachedImage).toBe("data:image/png;base64,xyz");
  });

  it("createChatObject seeds LaTeX for Solve-spawned chats", () => {
    const c = createChatObject(0, 0, { seedLatex: "\\int x dx" });
    expect(c.seedLatex).toBe("\\int x dx");
  });
});

describe("v1.10 stripRemovedObjects migration", () => {
  it("drops every retired drop-in type and tallies counts by label", () => {
    const incoming = [
      { id: "a", type: "circuit-sniper", x: 0, y: 0, w: 10, h: 10 },
      { id: "b", type: "oscilloscope", x: 0, y: 0, w: 10, h: 10 },
      { id: "c", type: "compute", x: 0, y: 0, w: 10, h: 10 },
      { id: "d", type: "compute", x: 0, y: 0, w: 10, h: 10 },
      { id: "e", type: "ai-dropin", x: 0, y: 0, w: 10, h: 10 },
      { id: "f", type: "graph-plotter", x: 0, y: 0, w: 10, h: 10 },
      { id: "g", type: "unit-circle", x: 0, y: 0, w: 10, h: 10 },
      { id: "h", type: "unit-converter", x: 0, y: 0, w: 10, h: 10 },
      { id: "i", type: "animation-canvas", x: 0, y: 0, w: 10, h: 10 },
      { id: "j", type: "study-gantt", x: 0, y: 0, w: 10, h: 10 },
      { id: "k", type: "multimeter", x: 0, y: 0, w: 10, h: 10 },
    ];
    const { kept, removed } = stripRemovedObjects(incoming);
    expect(kept).toEqual([]);
    expect(removed["Calculator"]).toBe(2);
    expect(removed["Circuit Sniper"]).toBe(1);
    expect(removed["Oscilloscope"]).toBe(1);
    expect(removed["AI Drop-in"]).toBe(1);
  });

  it("keeps Text/Table/Image/PDF/Math/Chat objects untouched", () => {
    const incoming = [
      createTextBox(10, 20),
      createTable(0, 0),
      createMathObject(5, 5, "x^2"),
      createChatObject(0, 0),
    ];
    const { kept, removed } = stripRemovedObjects(incoming);
    expect(kept).toHaveLength(4);
    expect(Object.keys(removed)).toHaveLength(0);
  });

  it("silently drops elements with no `type` field rather than crashing", () => {
    const incoming = [{ id: "x", x: 0, y: 0, w: 0, h: 0 }, null, undefined];
    const { kept } = stripRemovedObjects(incoming as unknown[]);
    expect(kept).toEqual([]);
  });
});
