/**
 * v1.11.0 phase-1 sub-PR 1.3: gesture binding + LayerManager wiring tests.
 *
 * These tests cover the React-adjacent code in
 * `useGestureRecognition.ts` and `useLayerGestures.ts` without
 * mounting React (vitest runs in node env with no jsdom).
 *
 * Strategy:
 *   - Test `bindGestureRecognition` directly with a `FakeTarget`
 *     that mimics EventTarget (addEventListener / dispatchEvent).
 *   - Test `pointerEventToSnapshot` with mock PointerEvent objects.
 *   - Test the LayerManager → recognizer wiring by calling the
 *     recognizer's feed directly with synthetic pointer streams
 *     (the React hook is just useEffect-wrapped binder code).
 */

import { describe, it, expect, vi } from "vitest";
import {
  bindGestureRecognition,
  pointerEventToSnapshot,
} from "../../src/features/gestures/useGestureRecognition";
import { createLayerManagerStore } from "../../src/features/layerManager";
import {
  createGestureRecognizer,
  type Swipe3FResult,
  type Tap4FResult,
} from "../../src/features/gestures/gestureRecognizer";

/**
 * Minimal EventTarget shim for node. Tracks listeners so we can
 * fire events synchronously and verify add/remove behavior.
 */
class FakeTarget implements EventTarget {
  private listeners = new Map<string, Set<EventListener>>();

  addEventListener(
    type: string,
    listener: EventListener | null,
    _opts?: boolean | AddEventListenerOptions,
  ): void {
    if (!listener) return;
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(
    type: string,
    listener: EventListener | null,
    _opts?: boolean | EventListenerOptions,
  ): void {
    if (!listener) return;
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(ev: Event): boolean {
    const set = this.listeners.get(ev.type);
    if (set) for (const l of set) l(ev);
    return true;
  }

  get listenerCount(): number {
    let n = 0;
    for (const s of this.listeners.values()) n += s.size;
    return n;
  }
}

/** Build a synthetic PointerEvent-like object. */
function pevt(
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  pointerId: number,
  x: number,
  y: number,
  pointerType: "touch" | "pen" | "mouse" = "touch",
): Event {
  // We extend a regular Event with the PointerEvent fields the
  // recognizer reads. Avoids needing the real PointerEvent constructor
  // (jsdom-only).
  const ev = new Event(type) as Event & {
    pointerId: number;
    pointerType: string;
    clientX: number;
    clientY: number;
  };
  ev.pointerId = pointerId;
  ev.pointerType = pointerType;
  ev.clientX = x;
  ev.clientY = y;
  return ev;
}

describe("pointerEventToSnapshot", () => {
  it("maps DOM PointerEvent fields", () => {
    const ev = pevt("pointerdown", 7, 100, 200, "touch");
    const snap = pointerEventToSnapshot(ev as PointerEvent, "down");
    expect(snap.pointerId).toBe(7);
    expect(snap.pointerType).toBe("touch");
    expect(snap.x).toBe(100);
    expect(snap.y).toBe(200);
    expect(snap.phase).toBe("down");
    expect(typeof snap.t).toBe("number");
  });

  it("coerces unknown pointerType to 'mouse'", () => {
    const ev = pevt("pointerdown", 1, 0, 0, "touch");
    (ev as PointerEvent & { pointerType: string }).pointerType = "garbage";
    const snap = pointerEventToSnapshot(ev as PointerEvent, "down");
    expect(snap.pointerType).toBe("mouse");
  });

  it("preserves pen pointerType", () => {
    const ev = pevt("pointerdown", 99, 0, 0, "pen");
    const snap = pointerEventToSnapshot(ev as PointerEvent, "down");
    expect(snap.pointerType).toBe("pen");
  });
});

describe("bindGestureRecognition — listener lifecycle", () => {
  it("attaches 4 listeners on bind", () => {
    const tgt = new FakeTarget();
    const bound = bindGestureRecognition(tgt);
    expect(tgt.listenerCount).toBe(4);
    bound.dispose();
  });

  it("dispose removes all listeners", () => {
    const tgt = new FakeTarget();
    const bound = bindGestureRecognition(tgt);
    bound.dispose();
    expect(tgt.listenerCount).toBe(0);
  });

  it("dispose resets the recognizer state", () => {
    const tgt = new FakeTarget();
    const bound = bindGestureRecognition(tgt);
    tgt.dispatchEvent(pevt("pointerdown", 1, 100, 100));
    expect(bound.recognizer.__peekActiveCount()).toBe(1);
    bound.dispose();
    expect(bound.recognizer.__peekActiveCount()).toBe(0);
  });
});

describe("bindGestureRecognition — gesture dispatch", () => {
  it("fires onSwipe3F on a 3-finger swipe down", () => {
    const tgt = new FakeTarget();
    const onSwipe = vi.fn<(r: Swipe3FResult) => void>();
    const onTap = vi.fn<(r: Tap4FResult) => void>();
    const bound = bindGestureRecognition(tgt, {
      onSwipe3F: onSwipe,
      onTap4F: onTap,
    });

    // Three pointers down, all move down 80px, all lift.
    // Real timing: the recognizer's velocity floor (240px/sec) needs
    // <= ~333ms duration for 80px. performance.now() is real so we
    // dispatch the events back-to-back — enough for the recognizer
    // to see them as a fast swipe.
    const x0 = 100;
    const y0 = 100;
    tgt.dispatchEvent(pevt("pointerdown", 1, x0, y0));
    tgt.dispatchEvent(pevt("pointerdown", 2, x0 + 30, y0));
    tgt.dispatchEvent(pevt("pointerdown", 3, x0 + 60, y0));
    tgt.dispatchEvent(pevt("pointermove", 1, x0, y0 + 80));
    tgt.dispatchEvent(pevt("pointermove", 2, x0 + 30, y0 + 80));
    tgt.dispatchEvent(pevt("pointermove", 3, x0 + 60, y0 + 80));
    tgt.dispatchEvent(pevt("pointerup", 1, x0, y0 + 80));
    tgt.dispatchEvent(pevt("pointerup", 2, x0 + 30, y0 + 80));
    tgt.dispatchEvent(pevt("pointerup", 3, x0 + 60, y0 + 80));

    // Stability window (50ms) requires lastCountChange to be 50ms
    // before sessionEnd. Real performance.now() between dispatches
    // is microseconds; we'd fail stability. Use config override to
    // 0ms for this test.
    bound.dispose();

    // Re-bind with relaxed thresholds and re-fire.
    const tgt2 = new FakeTarget();
    const onSwipe2 = vi.fn<(r: Swipe3FResult) => void>();
    const bound2 = bindGestureRecognition(tgt2, {
      onSwipe3F: onSwipe2,
      onTap4F: vi.fn(),
      config: {
        stabilityWindowMs: 0,
        peakWindowMs: 1000,
        swipeMaxDuration: 10000,
        swipeMinVelocity: 0,
      },
    });
    tgt2.dispatchEvent(pevt("pointerdown", 1, x0, y0));
    tgt2.dispatchEvent(pevt("pointerdown", 2, x0 + 30, y0));
    tgt2.dispatchEvent(pevt("pointerdown", 3, x0 + 60, y0));
    tgt2.dispatchEvent(pevt("pointermove", 1, x0, y0 + 80));
    tgt2.dispatchEvent(pevt("pointermove", 2, x0 + 30, y0 + 80));
    tgt2.dispatchEvent(pevt("pointermove", 3, x0 + 60, y0 + 80));
    tgt2.dispatchEvent(pevt("pointerup", 1, x0, y0 + 80));
    tgt2.dispatchEvent(pevt("pointerup", 2, x0 + 30, y0 + 80));
    tgt2.dispatchEvent(pevt("pointerup", 3, x0 + 60, y0 + 80));

    expect(onSwipe2).toHaveBeenCalledTimes(1);
    const r = onSwipe2.mock.calls[0][0];
    expect(r.kind).toBe("swipe-3f");
    expect(r.direction).toBe("down");
    bound2.dispose();
  });

  it("fires onTap4F on a 4-finger tap", () => {
    const tgt = new FakeTarget();
    const onTap = vi.fn<(r: Tap4FResult) => void>();
    const bound = bindGestureRecognition(tgt, {
      onTap4F: onTap,
      config: {
        stabilityWindowMs: 0,
        peakWindowMs: 1000,
        tapMaxDuration: 10000,
      },
    });
    const x0 = 200;
    const y0 = 400;
    tgt.dispatchEvent(pevt("pointerdown", 1, x0, y0));
    tgt.dispatchEvent(pevt("pointerdown", 2, x0 + 30, y0));
    tgt.dispatchEvent(pevt("pointerdown", 3, x0 + 60, y0));
    tgt.dispatchEvent(pevt("pointerdown", 4, x0 + 90, y0));
    tgt.dispatchEvent(pevt("pointerup", 1, x0, y0));
    tgt.dispatchEvent(pevt("pointerup", 2, x0 + 30, y0));
    tgt.dispatchEvent(pevt("pointerup", 3, x0 + 60, y0));
    tgt.dispatchEvent(pevt("pointerup", 4, x0 + 90, y0));
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap.mock.calls[0][0].kind).toBe("tap-4f");
    bound.dispose();
  });

  it("ignores pen pointer events for gesture classification", () => {
    const tgt = new FakeTarget();
    const onSwipe = vi.fn();
    const onTap = vi.fn();
    const bound = bindGestureRecognition(tgt, {
      onSwipe3F: onSwipe,
      onTap4F: onTap,
    });
    tgt.dispatchEvent(pevt("pointerdown", 99, 100, 100, "pen"));
    tgt.dispatchEvent(pevt("pointermove", 99, 100, 200, "pen"));
    tgt.dispatchEvent(pevt("pointerup", 99, 100, 200, "pen"));
    expect(onSwipe).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
    expect(bound.recognizer.__peekActiveCount()).toBe(0);
    bound.dispose();
  });

  it("uses __recognizerFactory override (test seam)", () => {
    const tgt = new FakeTarget();
    const fakeRecognizer = createGestureRecognizer();
    const factory = vi.fn(() => fakeRecognizer);
    const bound = bindGestureRecognition(tgt, { __recognizerFactory: factory });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(bound.recognizer).toBe(fakeRecognizer);
    bound.dispose();
  });
});

describe("LayerManager wiring", () => {
  // The useLayerGestures hook is a useCallback + useGestureRecognition
  // combo. We verify the routing logic by calling LayerManager methods
  // with results the recognizer would produce.

  it("3F swipe-down routes to summonTool via handleSwipe3F", () => {
    const store = createLayerManagerStore();
    store.handleSwipe3F("down", { x: 100, y: 100 });
    expect(store.getState().layer).toBe("tool");
  });

  it("3F swipe-right routes to summonMeta via handleSwipe3F", () => {
    const store = createLayerManagerStore();
    store.handleSwipe3F("right", { x: 100, y: 100 });
    expect(store.getState().layer).toBe("meta");
  });

  it("4F tap routes to freeze (the wiring useLayerGestures performs)", () => {
    const store = createLayerManagerStore();
    // Simulating what the hook does on Tap4FResult:
    store.freeze();
    expect(store.getState().layer).toBe("frozen");
  });

  it("4F tap from tool layer still freezes (freeze always wins)", () => {
    const store = createLayerManagerStore();
    store.summonTool();
    store.freeze();
    expect(store.getState().layer).toBe("frozen");
  });

  it("3F swipe while frozen is no-op (recognition continues but routing returns false)", () => {
    const store = createLayerManagerStore();
    store.freeze();
    expect(store.handleSwipe3F("down", { x: 0, y: 0 })).toBe(false);
    expect(store.handleSwipe3F("right", { x: 0, y: 0 })).toBe(false);
    expect(store.getState().layer).toBe("frozen");
  });
});

describe("end-to-end: target → recognizer → LayerManager", () => {
  it("3-finger swipe down on a target summons the tool layer", () => {
    const tgt = new FakeTarget();
    const store = createLayerManagerStore();

    // Wire what useLayerGestures wires.
    const bound = bindGestureRecognition(tgt, {
      onSwipe3F: (r) => {
        store.handleSwipe3F(r.direction, r.origin);
      },
      onTap4F: () => {
        store.freeze();
      },
      config: {
        stabilityWindowMs: 0,
        peakWindowMs: 1000,
        swipeMaxDuration: 10000,
        swipeMinVelocity: 0,
      },
    });

    const x0 = 100;
    const y0 = 100;
    tgt.dispatchEvent(pevt("pointerdown", 1, x0, y0));
    tgt.dispatchEvent(pevt("pointerdown", 2, x0 + 30, y0));
    tgt.dispatchEvent(pevt("pointerdown", 3, x0 + 60, y0));
    tgt.dispatchEvent(pevt("pointermove", 1, x0, y0 + 80));
    tgt.dispatchEvent(pevt("pointermove", 2, x0 + 30, y0 + 80));
    tgt.dispatchEvent(pevt("pointermove", 3, x0 + 60, y0 + 80));
    tgt.dispatchEvent(pevt("pointerup", 1, x0, y0 + 80));
    tgt.dispatchEvent(pevt("pointerup", 2, x0 + 30, y0 + 80));
    tgt.dispatchEvent(pevt("pointerup", 3, x0 + 60, y0 + 80));

    expect(store.getState().layer).toBe("tool");
    bound.dispose();
  });

  it("4-finger tap on a target freezes the LayerManager", () => {
    const tgt = new FakeTarget();
    const store = createLayerManagerStore();
    const bound = bindGestureRecognition(tgt, {
      onSwipe3F: (r) => store.handleSwipe3F(r.direction, r.origin),
      onTap4F: () => store.freeze(),
      config: {
        stabilityWindowMs: 0,
        peakWindowMs: 1000,
        tapMaxDuration: 10000,
      },
    });
    const x0 = 200;
    const y0 = 400;
    tgt.dispatchEvent(pevt("pointerdown", 1, x0, y0));
    tgt.dispatchEvent(pevt("pointerdown", 2, x0 + 30, y0));
    tgt.dispatchEvent(pevt("pointerdown", 3, x0 + 60, y0));
    tgt.dispatchEvent(pevt("pointerdown", 4, x0 + 90, y0));
    tgt.dispatchEvent(pevt("pointerup", 1, x0, y0));
    tgt.dispatchEvent(pevt("pointerup", 2, x0 + 30, y0));
    tgt.dispatchEvent(pevt("pointerup", 3, x0 + 60, y0));
    tgt.dispatchEvent(pevt("pointerup", 4, x0 + 90, y0));
    expect(store.getState().layer).toBe("frozen");
    bound.dispose();
  });
});
