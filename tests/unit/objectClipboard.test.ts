import { describe, it, expect } from "vitest";
import { makePastedObject, PASTE_OFFSET } from "../../src/lib/objectClipboard";
import type { CanvasObject } from "../../src/lib/canvasObjects";

/**
 * v1.6.11 regression: Copy existed without Paste, so the right-click
 * clipboard was write-only. makePastedObject is the pure helper the
 * new Paste entry delegates to. Pin the three invariants that
 * determine whether Paste feels correct: fresh id, honored anchor,
 * and predictable offset when no anchor is given.
 */

function makeObj(over: Partial<CanvasObject> = {}): CanvasObject {
  return {
    id: "src-1",
    type: "textbox",
    x: 100,
    y: 50,
    w: 200,
    h: 120,
    name: "Original",
    ...over,
  } as CanvasObject;
}

describe("makePastedObject", () => {
  it("produces a fresh id so paste never collides with the source", () => {
    let n = 0;
    const out = makePastedObject(makeObj(), null, () => `new-${++n}`);
    expect(out.id).toBe("new-1");
    expect(out.id).not.toBe("src-1");
  });

  it("pastes at the anchor point when given (right-click world coords)", () => {
    const out = makePastedObject(makeObj(), { x: 400, y: 300 }, () => "x");
    expect(out.x).toBe(400);
    expect(out.y).toBe(300);
  });

  it("pastes with a small offset from the source when no anchor is given", () => {
    const src = makeObj();
    const out = makePastedObject(src, null, () => "x");
    expect(out.x).toBe(src.x + PASTE_OFFSET);
    expect(out.y).toBe(src.y + PASTE_OFFSET);
  });

  it("preserves object type, size, and payload fields", () => {
    const src = makeObj({ type: "image", w: 512, h: 384, name: "Screenshot" }) as CanvasObject;
    const out = makePastedObject(src, { x: 0, y: 0 }, () => "x");
    expect(out.type).toBe(src.type);
    expect(out.w).toBe(src.w);
    expect(out.h).toBe(src.h);
    expect(out.name).toBe(src.name);
  });

  it("defaults to crypto.randomUUID when no id factory is given", () => {
    const out = makePastedObject(makeObj(), null);
    expect(typeof out.id).toBe("string");
    expect(out.id.length).toBeGreaterThan(0);
    expect(out.id).not.toBe("src-1");
  });
});
