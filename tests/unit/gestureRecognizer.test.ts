/**
 * v1.11.0 phase-1: gesture recognizer unit tests.
 *
 * Covers the four guardrails from /docs/v1.11-3d-layers-design.md §2:
 *   1. 50ms stability window (debounce on count change)
 *   2. 250ms pencil lockout (palm-during-pencil suppression)
 *   3. Peak finger count over the first 80ms (sloppy 4F-as-3F = freeze)
 *   4. Velocity floor for swipes (slow trackpad rest doesn't classify)
 *
 * Plus the happy paths:
 *   - 3-finger swipe in all four directions
 *   - 4-finger tap with low movement + short duration
 *
 * Pure unit tests against the recognizer's `feed(PointerSnapshot)` API.
 * No DOM or React.
 */

import { describe, it, expect } from "vitest";
import {
  createGestureRecognizer,
  type PointerSnapshot,
  type GestureResult,
} from "../../src/features/gestures/gestureRecognizer";

/** Helper: build a PointerSnapshot. */
function ev(
  pointerId: number,
  phase: PointerSnapshot["phase"],
  x: number,
  y: number,
  t: number,
  pointerType: PointerSnapshot["pointerType"] = "touch",
): PointerSnapshot {
  return { pointerId, phase, x, y, t, pointerType };
}

/** Helper: feed a sequence and collect any non-null results. */
function feedAll(
  rec: ReturnType<typeof createGestureRecognizer>,
  evs: PointerSnapshot[],
): GestureResult[] {
  const out: GestureResult[] = [];
  for (const e of evs) {
    const r = rec.feed(e);
    if (r) out.push(r);
  }
  return out;
}

/**
 * Build a 3-finger swipe sequence.
 *   - Three pointers go down at staggered times within the peak window
 *     (forces peakCount = 3).
 *   - Each pointer translates by (dx, dy) over `duration` ms.
 *   - All three lift roughly together at t = startT + duration.
 *
 * `startTOffset` lets us place the swipe relative to a wider timeline
 * (e.g. for the pencil-lockout test).
 */
function swipe3F(
  dx: number,
  dy: number,
  duration: number,
  startT = 1000,
): PointerSnapshot[] {
  const evs: PointerSnapshot[] = [];
  // Down events at t = startT, startT+5, startT+10 — well inside the
  // 80ms peak window, all 3 pointers count toward peak.
  const x0 = 200;
  const y0 = 400;
  evs.push(ev(1, "down", x0, y0, startT));
  evs.push(ev(2, "down", x0 + 30, y0, startT + 5));
  evs.push(ev(3, "down", x0 + 60, y0, startT + 10));
  // Mid-move at t = startT + duration/2.
  const mid = startT + duration / 2;
  evs.push(ev(1, "move", x0 + dx / 2, y0 + dy / 2, mid));
  evs.push(ev(2, "move", x0 + 30 + dx / 2, y0 + dy / 2, mid));
  evs.push(ev(3, "move", x0 + 60 + dx / 2, y0 + dy / 2, mid));
  // Up at t = startT + duration.
  const endT = startT + duration;
  evs.push(ev(1, "up", x0 + dx, y0 + dy, endT));
  evs.push(ev(2, "up", x0 + 30 + dx, y0 + dy, endT));
  evs.push(ev(3, "up", x0 + 60 + dx, y0 + dy, endT));
  return evs;
}

/**
 * Build a 4-finger tap sequence: 4 pointers go down close together,
 * barely move, lift after `duration` ms.
 */
function tap4F(duration: number, startT = 1000): PointerSnapshot[] {
  const evs: PointerSnapshot[] = [];
  const x0 = 200;
  const y0 = 400;
  evs.push(ev(1, "down", x0, y0, startT));
  evs.push(ev(2, "down", x0 + 30, y0, startT + 5));
  evs.push(ev(3, "down", x0 + 60, y0, startT + 10));
  evs.push(ev(4, "down", x0 + 90, y0, startT + 15));
  const endT = startT + duration;
  // Lift in the same order, all at endT — stability window has held.
  evs.push(ev(1, "up", x0, y0, endT));
  evs.push(ev(2, "up", x0 + 30, y0, endT));
  evs.push(ev(3, "up", x0 + 60, y0, endT));
  evs.push(ev(4, "up", x0 + 90, y0, endT));
  return evs;
}

describe("GestureRecognizer — happy paths", () => {
  it("classifies 3-finger swipe down", () => {
    const rec = createGestureRecognizer();
    // 80px down over 200ms = 400 px/sec, well above the 240 floor.
    const results = feedAll(rec, swipe3F(0, 80, 200));
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.kind).toBe("swipe-3f");
    if (r.kind === "swipe-3f") expect(r.direction).toBe("down");
  });

  it("classifies 3-finger swipe up", () => {
    const rec = createGestureRecognizer();
    const results = feedAll(rec, swipe3F(0, -80, 200));
    expect(results).toHaveLength(1);
    if (results[0].kind === "swipe-3f")
      expect(results[0].direction).toBe("up");
  });

  it("classifies 3-finger swipe right", () => {
    const rec = createGestureRecognizer();
    const results = feedAll(rec, swipe3F(80, 0, 200));
    expect(results).toHaveLength(1);
    if (results[0].kind === "swipe-3f")
      expect(results[0].direction).toBe("right");
  });

  it("classifies 3-finger swipe left", () => {
    const rec = createGestureRecognizer();
    const results = feedAll(rec, swipe3F(-80, 0, 200));
    expect(results).toHaveLength(1);
    if (results[0].kind === "swipe-3f")
      expect(results[0].direction).toBe("left");
  });

  it("classifies 4-finger tap", () => {
    const rec = createGestureRecognizer();
    const results = feedAll(rec, tap4F(120));
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("tap-4f");
  });

  it("returns null while pointers are still down", () => {
    const rec = createGestureRecognizer();
    const r1 = rec.feed(ev(1, "down", 100, 100, 0));
    const r2 = rec.feed(ev(2, "down", 130, 100, 5));
    const r3 = rec.feed(ev(3, "down", 160, 100, 10));
    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(r3).toBeNull();
    expect(rec.__peekActiveCount()).toBe(3);
  });
});

describe("GestureRecognizer — guardrails", () => {
  it("guardrail 1 (stability): rejects 3-finger gesture if peak count changed too late", () => {
    // Add the 3rd finger only ~10ms before lift — stability window
    // (50ms) hasn't held, gesture must be rejected.
    const rec = createGestureRecognizer();
    const x0 = 200;
    const y0 = 400;
    const evs: PointerSnapshot[] = [
      ev(1, "down", x0, y0, 0),
      ev(2, "down", x0 + 30, y0, 5),
      // Move first two down to satisfy distance threshold.
      ev(1, "move", x0, y0 + 80, 190),
      ev(2, "move", x0 + 30, y0 + 80, 190),
      // 3rd pointer joins very late.
      ev(3, "down", x0 + 60, y0 + 80, 195),
      // All lift at 200ms — peak of 3 only held for 5ms < 50ms window.
      ev(1, "up", x0, y0 + 80, 200),
      ev(2, "up", x0 + 30, y0 + 80, 200),
      ev(3, "up", x0 + 60, y0 + 80, 200),
    ];
    const results = feedAll(rec, evs);
    expect(results).toHaveLength(0);
  });

  it("guardrail 2 (pencil lockout): suppresses gesture within 250ms of pen event", () => {
    const rec = createGestureRecognizer();
    // Pen event at t = 0.
    rec.feed(ev(99, "down", 100, 100, 0, "pen"));
    rec.feed(ev(99, "up", 100, 100, 5, "pen"));
    // 3-finger swipe starts at t = 100 (well within 250ms lockout)
    // and ends at t = 200. End - lastPenT = 195 < 250 → suppressed.
    const results = feedAll(rec, swipe3F(0, 80, 100, 100));
    expect(results).toHaveLength(0);
  });

  it("guardrail 2 (pencil lockout): allows gesture once 250ms has passed", () => {
    const rec = createGestureRecognizer();
    rec.feed(ev(99, "down", 100, 100, 0, "pen"));
    rec.feed(ev(99, "up", 100, 100, 5, "pen"));
    // Swipe starts at t = 1000, ends at t = 1200. lockout cleared.
    const results = feedAll(rec, swipe3F(0, 80, 200, 1000));
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("swipe-3f");
  });

  it("guardrail 3 (peak count): sloppy 4-finger-that-started-as-3 still classifies as freeze", () => {
    // 3 fingers land at t = 0, 5, 10. 4th finger lands at t = 60
    // (still inside 80ms peak window). Peak = 4 → tap-4f, even
    // though the recognizer briefly saw 3.
    const rec = createGestureRecognizer();
    const x0 = 200;
    const y0 = 400;
    const evs: PointerSnapshot[] = [
      ev(1, "down", x0, y0, 0),
      ev(2, "down", x0 + 30, y0, 5),
      ev(3, "down", x0 + 60, y0, 10),
      ev(4, "down", x0 + 90, y0, 60),
      // Hold for stability window then lift — barely any motion.
      ev(1, "up", x0, y0, 200),
      ev(2, "up", x0 + 30, y0, 200),
      ev(3, "up", x0 + 60, y0, 200),
      ev(4, "up", x0 + 90, y0, 200),
    ];
    const results = feedAll(rec, evs);
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("tap-4f");
  });

  it("guardrail 4 (velocity floor): slow 3-finger drift on trackpad does NOT classify as swipe", () => {
    // 80px translation over 1000ms = 80 px/sec, well below the
    // 240 px/sec floor. Even though distance threshold is met, the
    // gesture must be rejected as a swipe.
    const rec = createGestureRecognizer();
    const results = feedAll(rec, swipe3F(0, 80, 1000));
    expect(results).toHaveLength(0);
  });

  it("guardrail 4 (velocity floor): fast swipe at the velocity floor DOES classify", () => {
    // 80px in 200ms = 400 px/sec, comfortably above the 240 floor.
    const rec = createGestureRecognizer();
    const results = feedAll(rec, swipe3F(0, 80, 200));
    expect(results).toHaveLength(1);
  });
});

describe("GestureRecognizer — misc", () => {
  it("rejects 2-finger gestures (not interesting)", () => {
    const rec = createGestureRecognizer();
    const results = feedAll(rec, [
      ev(1, "down", 100, 100, 0),
      ev(2, "down", 130, 100, 5),
      ev(1, "move", 100, 200, 100),
      ev(2, "move", 130, 200, 100),
      ev(1, "up", 100, 200, 200),
      ev(2, "up", 130, 200, 200),
    ]);
    expect(results).toHaveLength(0);
  });

  it("rejects 4-finger tap that moved too far (treated as swipe-4f, not supported)", () => {
    const rec = createGestureRecognizer();
    const x0 = 200;
    const y0 = 400;
    // 4 fingers all drift 80px down — that's a 4F swipe (unsupported),
    // exceeds tapMaxMovement of 30. Must not classify.
    const evs: PointerSnapshot[] = [
      ev(1, "down", x0, y0, 0),
      ev(2, "down", x0 + 30, y0, 5),
      ev(3, "down", x0 + 60, y0, 10),
      ev(4, "down", x0 + 90, y0, 15),
      ev(1, "up", x0, y0 + 80, 200),
      ev(2, "up", x0 + 30, y0 + 80, 200),
      ev(3, "up", x0 + 60, y0 + 80, 200),
      ev(4, "up", x0 + 90, y0 + 80, 200),
    ];
    const results = feedAll(rec, evs);
    expect(results).toHaveLength(0);
  });

  it("rejects 4-finger tap held too long (>250ms)", () => {
    const rec = createGestureRecognizer();
    const results = feedAll(rec, tap4F(400));
    expect(results).toHaveLength(0);
  });

  it("re-classifies cleanly across consecutive sessions", () => {
    const rec = createGestureRecognizer();
    const r1 = feedAll(rec, swipe3F(0, 80, 200, 0));
    expect(r1).toHaveLength(1);
    expect(rec.__peekActiveCount()).toBe(0);
    const r2 = feedAll(rec, tap4F(120, 1000));
    expect(r2).toHaveLength(1);
    expect(r2[0].kind).toBe("tap-4f");
  });

  it("idempotent on duplicate pointerdown for same id", () => {
    // WebKit can re-fire pointerdown. Second down for same id should
    // not bump peak count.
    const rec = createGestureRecognizer();
    rec.feed(ev(1, "down", 100, 100, 0));
    rec.feed(ev(1, "down", 100, 100, 1)); // duplicate
    rec.feed(ev(2, "down", 130, 100, 5));
    rec.feed(ev(3, "down", 160, 100, 10));
    expect(rec.__peekActiveCount()).toBe(3);
  });

  it("reset() wipes session state", () => {
    const rec = createGestureRecognizer();
    rec.feed(ev(1, "down", 100, 100, 0));
    rec.feed(ev(2, "down", 130, 100, 5));
    expect(rec.__peekActiveCount()).toBe(2);
    rec.reset();
    expect(rec.__peekActiveCount()).toBe(0);
  });

  it("cancel phase is treated like up", () => {
    // 3F swipe but 3rd finger sends cancel instead of up — should
    // still classify (gesture committed, OS just yanked the touch).
    const rec = createGestureRecognizer();
    const x0 = 200;
    const y0 = 400;
    const evs: PointerSnapshot[] = [
      ev(1, "down", x0, y0, 0),
      ev(2, "down", x0 + 30, y0, 5),
      ev(3, "down", x0 + 60, y0, 10),
      ev(1, "up", x0, y0 + 80, 200),
      ev(2, "up", x0 + 30, y0 + 80, 200),
      ev(3, "cancel", x0 + 60, y0 + 80, 200),
    ];
    const results = feedAll(rec, evs);
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("swipe-3f");
  });
});
