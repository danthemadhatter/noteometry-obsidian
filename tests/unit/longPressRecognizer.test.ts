/**
 * v1.11.0 phase-3 sub-PR 3.3: long-press recognizer tests.
 *
 * Pure state machine — exercise:
 *   - Constants match the locked design (550ms, 8px slop, pen-only)
 *   - Pen long-press fires after deadline with the original origin
 *   - Movement > 8px cancels
 *   - Pointerup before deadline cancels
 *   - Touch / mouse / undefined pointer types are no-ops (not recognized)
 *   - Repeated pointerdown re-arms (overwrites prior state)
 *   - Verdict is idempotent: onTick after fire returns noop
 *   - Config overrides honored (test seam)
 */

import { describe, it, expect } from "vitest";
import {
  createLongPressRecognizer,
  LONG_PRESS_MS,
  LONG_PRESS_SLOP_PX,
  LONG_PRESS_SLOP_SQ,
  LONG_PRESS_POINTER_TYPES,
} from "../../src/features/gestures/longPress";

describe("long-press constants", () => {
  it("550ms deadline (matches iOS system long-press)", () => {
    expect(LONG_PRESS_MS).toBe(550);
  });

  it("8px slop (LONG_PRESS_SLOP_SQ = 64)", () => {
    expect(LONG_PRESS_SLOP_PX).toBe(8);
    expect(LONG_PRESS_SLOP_SQ).toBe(64);
  });

  it("pen-only by default", () => {
    expect(LONG_PRESS_POINTER_TYPES.has("pen")).toBe(true);
    expect(LONG_PRESS_POINTER_TYPES.has("touch")).toBe(false);
    expect(LONG_PRESS_POINTER_TYPES.has("mouse")).toBe(false);
  });
});

describe("long-press recognizer — happy path", () => {
  it("fires after deadline with the original pen-down origin", () => {
    const r = createLongPressRecognizer();
    const v1 = r.onPointerDown({ pointerType: "pen", clientX: 100, clientY: 200, t: 0 });
    expect(v1.kind).toBe("noop");
    expect(r.__peek()).toBe("armed");

    const v2 = r.onTick(LONG_PRESS_MS);
    expect(v2.kind).toBe("fire");
    expect(v2.origin).toEqual({ clientX: 100, clientY: 200 });
    expect(r.__peek()).toBe("fired");
  });

  it("does NOT fire before deadline", () => {
    const r = createLongPressRecognizer();
    r.onPointerDown({ pointerType: "pen", clientX: 0, clientY: 0, t: 0 });
    const v = r.onTick(LONG_PRESS_MS - 1);
    expect(v.kind).toBe("noop");
    expect(r.__peek()).toBe("armed");
  });

  it("fire is idempotent (subsequent ticks are noop)", () => {
    const r = createLongPressRecognizer();
    r.onPointerDown({ pointerType: "pen", clientX: 0, clientY: 0, t: 0 });
    expect(r.onTick(LONG_PRESS_MS).kind).toBe("fire");
    expect(r.onTick(LONG_PRESS_MS + 100).kind).toBe("noop");
    expect(r.onTick(2000).kind).toBe("noop");
  });
});

describe("long-press recognizer — cancellation", () => {
  it("movement just at slop boundary does NOT cancel (slop is exclusive)", () => {
    const r = createLongPressRecognizer();
    r.onPointerDown({ pointerType: "pen", clientX: 0, clientY: 0, t: 0 });
    // dx² + dy² == 64 (exactly at slop boundary)
    const v = r.onPointerMove({ pointerType: "pen", clientX: 8, clientY: 0, t: 50 });
    expect(v.kind).toBe("noop");
    expect(r.__peek()).toBe("armed");
  });

  it("movement just past slop cancels", () => {
    const r = createLongPressRecognizer();
    r.onPointerDown({ pointerType: "pen", clientX: 0, clientY: 0, t: 0 });
    // dx² + dy² == 65
    const v = r.onPointerMove({ pointerType: "pen", clientX: 8, clientY: 1, t: 50 });
    expect(v.kind).toBe("cancel");
    expect(r.__peek()).toBe("idle");
  });

  it("pointerup before deadline cancels", () => {
    const r = createLongPressRecognizer();
    r.onPointerDown({ pointerType: "pen", clientX: 0, clientY: 0, t: 0 });
    const v = r.onPointerUp({ pointerType: "pen", clientX: 0, clientY: 0, t: 100 });
    expect(v.kind).toBe("cancel");
    expect(r.__peek()).toBe("idle");
  });

  it("after cancel, onTick at deadline is a noop", () => {
    const r = createLongPressRecognizer();
    r.onPointerDown({ pointerType: "pen", clientX: 0, clientY: 0, t: 0 });
    r.onPointerMove({ pointerType: "pen", clientX: 100, clientY: 100, t: 50 });
    expect(r.onTick(LONG_PRESS_MS).kind).toBe("noop");
  });
});

describe("long-press recognizer — pointer-type filtering", () => {
  it("touch pointers are noop on pointerdown", () => {
    const r = createLongPressRecognizer();
    const v = r.onPointerDown({ pointerType: "touch", clientX: 0, clientY: 0, t: 0 });
    expect(v.kind).toBe("noop");
    expect(r.__peek()).toBe("idle");
    // And onTick stays idle
    expect(r.onTick(LONG_PRESS_MS).kind).toBe("noop");
  });

  it("mouse pointers are noop on pointerdown", () => {
    const r = createLongPressRecognizer();
    r.onPointerDown({ pointerType: "mouse", clientX: 0, clientY: 0, t: 0 });
    expect(r.__peek()).toBe("idle");
  });
});

describe("long-press recognizer — re-arming", () => {
  it("a second pointerdown overwrites prior state", () => {
    const r = createLongPressRecognizer();
    r.onPointerDown({ pointerType: "pen", clientX: 10, clientY: 10, t: 0 });
    r.onPointerDown({ pointerType: "pen", clientX: 50, clientY: 60, t: 100 });
    const v = r.onTick(100 + LONG_PRESS_MS);
    expect(v.kind).toBe("fire");
    expect(v.origin).toEqual({ clientX: 50, clientY: 60 });
  });
});

describe("long-press recognizer — config overrides", () => {
  it("custom deadline honored", () => {
    const r = createLongPressRecognizer({ deadlineMs: 200 });
    r.onPointerDown({ pointerType: "pen", clientX: 0, clientY: 0, t: 0 });
    expect(r.onTick(199).kind).toBe("noop");
    expect(r.onTick(200).kind).toBe("fire");
  });

  it("custom slop honored", () => {
    const r = createLongPressRecognizer({ slopPx: 4 });
    r.onPointerDown({ pointerType: "pen", clientX: 0, clientY: 0, t: 0 });
    // Old slop 8 → 5px would not cancel; new slop 4 → 5px cancels
    const v = r.onPointerMove({ pointerType: "pen", clientX: 5, clientY: 0, t: 50 });
    expect(v.kind).toBe("cancel");
  });

  it("custom pointer types honored (e.g. touch + pen)", () => {
    const r = createLongPressRecognizer({
      pointerTypes: new Set(["touch", "pen"]),
    });
    r.onPointerDown({ pointerType: "touch", clientX: 0, clientY: 0, t: 0 });
    expect(r.__peek()).toBe("armed");
  });
});
