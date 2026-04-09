import { describe, it, expect } from "vitest";
import { createTextBox, createTable, createImageObject } from "../../src/lib/canvasObjects";

describe("canvasObjects", () => {
  it("createTextBox returns correct shape", () => {
    const tb = createTextBox(100, 200);
    expect(tb.type).toBe("textbox");
    expect(tb.x).toBe(100);
    expect(tb.y).toBe(200);
    expect(tb.w).toBe(350);
    expect(tb.h).toBe(200);
    expect(tb.id).toBeTruthy();
  });

  it("createTable returns correct shape", () => {
    const t = createTable(50, 75);
    expect(t.type).toBe("table");
    expect(t.x).toBe(50);
    expect(t.y).toBe(75);
    expect(t.w).toBe(400);
    expect(t.h).toBe(250);
  });

  it("createImageObject returns correct shape with defaults", () => {
    const img = createImageObject(10, 20, "data:image/png;base64,abc");
    expect(img.type).toBe("image");
    expect(img.dataURL).toBe("data:image/png;base64,abc");
    expect(img.w).toBe(300);
    expect(img.h).toBe(200);
  });

  it("createImageObject accepts custom dimensions", () => {
    const img = createImageObject(0, 0, "data:x", 500, 400);
    expect(img.w).toBe(500);
    expect(img.h).toBe(400);
  });

  it("IDs are unique", () => {
    const a = createTextBox(0, 0);
    const b = createTextBox(0, 0);
    expect(a.id).not.toBe(b.id);
  });
});
