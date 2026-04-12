import { describe, it, expect } from "vitest";
import { packToV3, unpackFromV3, CanvasData, NoteometryPageV3 } from "../../src/lib/pageFormat";

/**
 * These tests exercise the v3 pack/unpack pipeline. The persistence layer
 * stores data as v3 on disk but hooks consume the legacy CanvasData shape,
 * so every round-trip save→load must preserve every element and field.
 */

describe("persistence v3 pack/unpack", () => {
  const sampleData: CanvasData = {
    strokes: [
      {
        id: "stroke-1",
        points: [
          { x: 10, y: 20, pressure: 0.5 },
          { x: 15, y: 25, pressure: 0.7 },
        ],
        color: "#1e1e1e",
        width: 3,
      },
      {
        id: "stroke-2",
        points: [{ x: 100, y: 200, pressure: 0.5 }],
        color: "#e03131",
        width: 5,
      },
    ],
    stamps: [
      {
        id: "stamp-1",
        x: 50, y: 60,
        text: "∫",
        fontSize: 28,
        color: "#1e1e1e",
      },
    ],
    canvasObjects: [
      { id: "text-1", type: "textbox", x: 100, y: 100, w: 350, h: 200 },
      { id: "table-1", type: "table", x: 200, y: 200, w: 400, h: 250 },
      { id: "img-1", type: "image", x: 300, y: 300, w: 400, h: 300, dataURL: "Noteometry/General/attachments/abc.png" },
    ],
    viewport: { scrollX: 42, scrollY: 84, zoom: 1.5 },
    panelInput: "$$\\int 3x^2 dx$$",
    chatMessages: [
      { role: "user", text: "Solve this:" },
      { role: "assistant", text: "x³ + C" },
    ],
    tableData: {
      "table-1": [["a", "b", "c"], ["1", "2", "3"]],
    },
    textBoxData: {
      "text-1": "<p>Hello <b>world</b></p>",
    },
    lastSaved: "2026-04-10T22:00:00.000Z",
  };

  it("packToV3 produces a versioned page with tagged elements", () => {
    const v3 = packToV3(sampleData);
    expect(v3.type).toBe("noteometry-page");
    expect(v3.version).toBe(3);
    expect(v3.source).toMatch(/^noteometry-/);
    expect(v3.elements).toHaveLength(2 + 1 + 3); // strokes + stamps + canvasObjects
  });

  it("packToV3 tags each element with its type", () => {
    const v3 = packToV3(sampleData);
    const types = v3.elements.map((e) => e.type).sort();
    expect(types).toEqual(["image", "stamp", "stroke", "stroke", "table", "textbox"]);
  });

  it("packToV3 inlines textBoxData into textbox elements", () => {
    const v3 = packToV3(sampleData);
    const text = v3.elements.find((e) => e.type === "textbox") as Extract<typeof v3.elements[number], { type: "textbox" }>;
    expect(text.html).toBe("<p>Hello <b>world</b></p>");
  });

  it("packToV3 inlines tableData into table elements", () => {
    const v3 = packToV3(sampleData);
    const table = v3.elements.find((e) => e.type === "table") as Extract<typeof v3.elements[number], { type: "table" }>;
    expect(table.rows).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("packToV3 renames image dataURL to fileRef", () => {
    const v3 = packToV3(sampleData);
    const img = v3.elements.find((e) => e.type === "image") as Extract<typeof v3.elements[number], { type: "image" }>;
    expect(img.fileRef).toBe("Noteometry/General/attachments/abc.png");
  });

  it("packToV3 preserves viewport.zoom from CanvasData", () => {
    const v3 = packToV3(sampleData);
    expect(v3.viewport.zoom).toBe(1.5);
  });

  it("packToV3 defaults viewport.zoom to 1.0 when not set", () => {
    const noZoom = { ...sampleData, viewport: { scrollX: 0, scrollY: 0 } };
    const v3 = packToV3(noZoom);
    expect(v3.viewport.zoom).toBe(1.0);
  });

  it("packToV3 nests panelInput and chatMessages under pipeline", () => {
    const v3 = packToV3(sampleData);
    expect(v3.pipeline.panelInput).toBe("$$\\int 3x^2 dx$$");
    expect(v3.pipeline.chatMessages).toHaveLength(2);
  });

  it("unpackFromV3 splits elements back into the legacy arrays", () => {
    const v3 = packToV3(sampleData);
    const unpacked = unpackFromV3(v3);
    expect(unpacked.strokes).toHaveLength(2);
    expect(unpacked.stamps).toHaveLength(1);
    expect(unpacked.canvasObjects).toHaveLength(3);
  });

  it("unpackFromV3 rebuilds the textBoxData sidecar", () => {
    const v3 = packToV3(sampleData);
    const unpacked = unpackFromV3(v3);
    expect(unpacked.textBoxData["text-1"]).toBe("<p>Hello <b>world</b></p>");
  });

  it("unpackFromV3 rebuilds the tableData sidecar", () => {
    const v3 = packToV3(sampleData);
    const unpacked = unpackFromV3(v3);
    expect(unpacked.tableData["table-1"]).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("unpackFromV3 restores image dataURL from fileRef", () => {
    const v3 = packToV3(sampleData);
    const unpacked = unpackFromV3(v3);
    const img = unpacked.canvasObjects.find((o) => o.type === "image");
    expect(img).toBeDefined();
    expect((img as { dataURL: string }).dataURL).toBe("Noteometry/General/attachments/abc.png");
  });

  it("round-trip preserves all stroke data", () => {
    const round = unpackFromV3(packToV3(sampleData));
    expect(round.strokes).toEqual(sampleData.strokes);
  });

  it("round-trip preserves all stamp data", () => {
    const round = unpackFromV3(packToV3(sampleData));
    expect(round.stamps).toEqual(sampleData.stamps);
  });

  it("round-trip preserves viewport, panelInput, chatMessages, lastSaved", () => {
    const round = unpackFromV3(packToV3(sampleData));
    expect(round.viewport).toEqual(sampleData.viewport);
    expect(round.panelInput).toBe(sampleData.panelInput);
    expect(round.chatMessages).toEqual(sampleData.chatMessages);
    expect(round.lastSaved).toBe(sampleData.lastSaved);
  });

  it("round-trip preserves all three canvas object types", () => {
    const round = unpackFromV3(packToV3(sampleData));
    expect(round.canvasObjects).toHaveLength(3);
    expect(round.canvasObjects.find((o) => o.type === "textbox")).toBeDefined();
    expect(round.canvasObjects.find((o) => o.type === "table")).toBeDefined();
    expect(round.canvasObjects.find((o) => o.type === "image")).toBeDefined();
  });

  it("pack → JSON → parse → unpack is lossless (real disk simulation)", () => {
    const v3 = packToV3(sampleData);
    const json = JSON.stringify(v3);
    const parsed = JSON.parse(json) as NoteometryPageV3;
    const round = unpackFromV3(parsed);
    expect(round.strokes).toEqual(sampleData.strokes);
    expect(round.stamps).toEqual(sampleData.stamps);
    expect(round.canvasObjects).toHaveLength(3);
    expect(round.tableData).toEqual(sampleData.tableData);
    expect(round.textBoxData).toEqual(sampleData.textBoxData);
  });

  it("packs empty CanvasData cleanly", () => {
    const empty: CanvasData = {
      strokes: [], stamps: [], canvasObjects: [],
      viewport: { scrollX: 0, scrollY: 0 },
      panelInput: "", chatMessages: [],
      tableData: {}, textBoxData: {},
      lastSaved: "",
    };
    const v3 = packToV3(empty);
    expect(v3.elements).toHaveLength(0);
    expect(v3.pipeline.panelInput).toBe("");
  });

  it("unpacks to empty CanvasData when elements is empty", () => {
    const v3: NoteometryPageV3 = {
      type: "noteometry-page",
      version: 3,
      source: "noteometry-test",
      elements: [],
      viewport: { scrollX: 0, scrollY: 0, zoom: 1 },
      pipeline: { panelInput: "", chatMessages: [] },
      lastSaved: "",
    };
    const unpacked = unpackFromV3(v3);
    expect(unpacked.strokes).toEqual([]);
    expect(unpacked.stamps).toEqual([]);
    expect(unpacked.canvasObjects).toEqual([]);
    expect(unpacked.tableData).toEqual({});
    expect(unpacked.textBoxData).toEqual({});
  });

  it("unpack handles missing textBoxData gracefully (textbox with empty html)", () => {
    const v3: NoteometryPageV3 = {
      type: "noteometry-page",
      version: 3,
      source: "noteometry-test",
      elements: [
        { type: "textbox", id: "t1", x: 0, y: 0, w: 100, h: 50, html: "" },
      ],
      viewport: { scrollX: 0, scrollY: 0, zoom: 1 },
      pipeline: { panelInput: "", chatMessages: [] },
      lastSaved: "",
    };
    const unpacked = unpackFromV3(v3);
    expect(unpacked.textBoxData["t1"]).toBe("");
  });
});
