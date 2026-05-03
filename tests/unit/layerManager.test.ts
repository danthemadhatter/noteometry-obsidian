/**
 * v1.11.0 phase-1 sub-PR 1.2: LayerManager state machine tests.
 *
 * Tests the pure store directly. Same pattern as aiActivity.test.ts.
 *
 * Coverage:
 *   - Initial state (paper, clean, no page)
 *   - All happy-path transitions: summon/dismiss tool, summon/dismiss meta
 *   - 3F-swipe routing (handleSwipe3F)
 *   - One-layer-at-a-time invariant (no crossfade)
 *   - Freeze / unfreeze from any state
 *   - Frozen blocks 3F swipes
 *   - Per-page scope: setPageId clears frozen + collapses to paper
 *   - Idempotent freeze/unfreeze, idempotent setDirty
 *   - Subscribers fire on every state change
 *   - onDismissed events fire with correct origin (gesture, then summon fallback)
 *   - onDismissed does NOT fire for unfreeze
 */

import { describe, it, expect, vi } from "vitest";
import { createLayerManagerStore } from "../../src/features/layerManager";

describe("LayerManagerStore — initial state", () => {
  it("starts on paper, clean, no page id", () => {
    const s = createLayerManagerStore();
    expect(s.getState()).toEqual({
      layer: "paper",
      dirty: false,
      pageId: null,
    });
  });

  it("respects initial overrides", () => {
    const s = createLayerManagerStore({
      layer: "tool",
      dirty: true,
      pageId: "page-1",
    });
    expect(s.getState()).toEqual({
      layer: "tool",
      dirty: true,
      pageId: "page-1",
    });
  });
});

describe("LayerManagerStore — tool layer transitions", () => {
  it("paper → tool via summonTool", () => {
    const s = createLayerManagerStore();
    s.summonTool({ x: 100, y: 50 });
    expect(s.getState().layer).toBe("tool");
  });

  it("tool → paper via dismissTool", () => {
    const s = createLayerManagerStore();
    s.summonTool({ x: 100, y: 50 });
    s.dismissTool({ x: 100, y: 250 });
    expect(s.getState().layer).toBe("paper");
  });

  it("summonTool from non-paper is no-op", () => {
    const s = createLayerManagerStore();
    s.summonMeta({ x: 0, y: 0 });
    s.summonTool({ x: 0, y: 0 });
    expect(s.getState().layer).toBe("meta");
  });

  it("dismissTool from non-tool is no-op", () => {
    const s = createLayerManagerStore();
    s.dismissTool();
    expect(s.getState().layer).toBe("paper");
  });
});

describe("LayerManagerStore — meta layer transitions", () => {
  it("paper → meta via summonMeta", () => {
    const s = createLayerManagerStore();
    s.summonMeta({ x: 50, y: 100 });
    expect(s.getState().layer).toBe("meta");
  });

  it("meta → paper via dismissMeta", () => {
    const s = createLayerManagerStore();
    s.summonMeta({ x: 50, y: 100 });
    s.dismissMeta();
    expect(s.getState().layer).toBe("paper");
  });

  it("summonMeta from non-paper is no-op", () => {
    const s = createLayerManagerStore();
    s.summonTool();
    s.summonMeta();
    expect(s.getState().layer).toBe("tool");
  });
});

describe("LayerManagerStore — freeze", () => {
  it("paper → frozen via freeze", () => {
    const s = createLayerManagerStore();
    s.freeze();
    expect(s.getState().layer).toBe("frozen");
  });

  it("tool → frozen via freeze (freeze always wins)", () => {
    const s = createLayerManagerStore();
    s.summonTool();
    s.freeze();
    expect(s.getState().layer).toBe("frozen");
  });

  it("meta → frozen via freeze", () => {
    const s = createLayerManagerStore();
    s.summonMeta();
    s.freeze();
    expect(s.getState().layer).toBe("frozen");
  });

  it("frozen → paper via unfreeze", () => {
    const s = createLayerManagerStore();
    s.freeze();
    s.unfreeze();
    expect(s.getState().layer).toBe("paper");
  });

  it("freeze is idempotent", () => {
    const s = createLayerManagerStore();
    const listener = vi.fn();
    s.subscribe(listener);
    s.freeze();
    s.freeze();
    s.freeze();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(s.getState().layer).toBe("frozen");
  });

  it("unfreeze from non-frozen is no-op", () => {
    const s = createLayerManagerStore();
    const listener = vi.fn();
    s.subscribe(listener);
    s.unfreeze();
    expect(listener).not.toHaveBeenCalled();
    expect(s.getState().layer).toBe("paper");
  });
});

describe("LayerManagerStore — handleSwipe3F", () => {
  it("down on paper → tool", () => {
    const s = createLayerManagerStore();
    expect(s.handleSwipe3F("down", { x: 1, y: 1 })).toBe(true);
    expect(s.getState().layer).toBe("tool");
  });

  it("up on tool → paper", () => {
    const s = createLayerManagerStore();
    s.summonTool();
    expect(s.handleSwipe3F("up", { x: 1, y: 1 })).toBe(true);
    expect(s.getState().layer).toBe("paper");
  });

  it("right on paper → meta", () => {
    const s = createLayerManagerStore();
    expect(s.handleSwipe3F("right", { x: 1, y: 1 })).toBe(true);
    expect(s.getState().layer).toBe("meta");
  });

  it("left on meta → paper", () => {
    const s = createLayerManagerStore();
    s.summonMeta();
    expect(s.handleSwipe3F("left", { x: 1, y: 1 })).toBe(true);
    expect(s.getState().layer).toBe("paper");
  });

  it("down on tool is no-op (already up, can't summon again)", () => {
    const s = createLayerManagerStore();
    s.summonTool();
    expect(s.handleSwipe3F("down", { x: 1, y: 1 })).toBe(false);
    expect(s.getState().layer).toBe("tool");
  });

  it("right on meta is no-op", () => {
    const s = createLayerManagerStore();
    s.summonMeta();
    expect(s.handleSwipe3F("right", { x: 1, y: 1 })).toBe(false);
    expect(s.getState().layer).toBe("meta");
  });

  it("up on paper is no-op (nothing to dismiss)", () => {
    const s = createLayerManagerStore();
    expect(s.handleSwipe3F("up", { x: 1, y: 1 })).toBe(false);
    expect(s.getState().layer).toBe("paper");
  });

  it("frozen blocks all 3F swipes", () => {
    const s = createLayerManagerStore();
    s.freeze();
    expect(s.handleSwipe3F("down", { x: 1, y: 1 })).toBe(false);
    expect(s.handleSwipe3F("up", { x: 1, y: 1 })).toBe(false);
    expect(s.handleSwipe3F("right", { x: 1, y: 1 })).toBe(false);
    expect(s.handleSwipe3F("left", { x: 1, y: 1 })).toBe(false);
    expect(s.getState().layer).toBe("frozen");
  });

  it("right on tool is no-op (one layer at a time)", () => {
    // Crossfade is intentionally not supported per design doc §5.
    const s = createLayerManagerStore();
    s.summonTool();
    expect(s.handleSwipe3F("right", { x: 1, y: 1 })).toBe(false);
    expect(s.getState().layer).toBe("tool");
  });
});

describe("LayerManagerStore — onDismissed (ghost-echo source)", () => {
  it("emits on tool dismiss with gesture origin", () => {
    const s = createLayerManagerStore();
    const events: unknown[] = [];
    s.onDismissed((ev) => events.push(ev));
    s.summonTool({ x: 50, y: 50 });
    s.dismissTool({ x: 60, y: 240 });
    expect(events).toHaveLength(1);
    const ev = events[0] as { kind: string; origin: { x: number; y: number } };
    expect(ev.kind).toBe("tool");
    expect(ev.origin).toEqual({ x: 60, y: 240 });
  });

  it("emits on meta dismiss with gesture origin", () => {
    const s = createLayerManagerStore();
    const events: unknown[] = [];
    s.onDismissed((ev) => events.push(ev));
    s.summonMeta({ x: 30, y: 80 });
    s.dismissMeta({ x: 25, y: 75 });
    expect(events).toHaveLength(1);
    const ev = events[0] as { kind: string; origin: { x: number; y: number } };
    expect(ev.kind).toBe("meta");
    expect(ev.origin).toEqual({ x: 25, y: 75 });
  });

  it("falls back to summon origin when dismiss origin is omitted", () => {
    const s = createLayerManagerStore();
    const events: { origin: { x: number; y: number } }[] = [];
    s.onDismissed((ev) => events.push(ev));
    s.summonTool({ x: 999, y: 111 });
    s.dismissTool();
    expect(events[0].origin).toEqual({ x: 999, y: 111 });
  });

  it("does NOT emit on unfreeze (no echo on resume)", () => {
    const s = createLayerManagerStore();
    const events: unknown[] = [];
    s.onDismissed((ev) => events.push(ev));
    s.freeze();
    s.unfreeze();
    expect(events).toHaveLength(0);
  });

  it("does NOT emit when dismiss is a no-op", () => {
    const s = createLayerManagerStore();
    const events: unknown[] = [];
    s.onDismissed((ev) => events.push(ev));
    s.dismissTool({ x: 1, y: 1 });
    s.dismissMeta({ x: 1, y: 1 });
    expect(events).toHaveLength(0);
  });

  it("unsubscribe removes listener", () => {
    const s = createLayerManagerStore();
    const listener = vi.fn();
    const unsub = s.onDismissed(listener);
    unsub();
    s.summonTool();
    s.dismissTool();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("LayerManagerStore — dirty + page id", () => {
  it("setDirty updates state and notifies", () => {
    const s = createLayerManagerStore();
    const listener = vi.fn();
    s.subscribe(listener);
    s.setDirty(true);
    expect(s.getState().dirty).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("setDirty is idempotent (same value = no notify)", () => {
    const s = createLayerManagerStore({ dirty: false });
    const listener = vi.fn();
    s.subscribe(listener);
    s.setDirty(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it("setPageId updates page id", () => {
    const s = createLayerManagerStore();
    s.setPageId("page-a");
    expect(s.getState().pageId).toBe("page-a");
  });

  it("setPageId clears frozen state (per-page scope)", () => {
    const s = createLayerManagerStore({ pageId: "page-a" });
    s.freeze();
    expect(s.getState().layer).toBe("frozen");
    s.setPageId("page-b");
    expect(s.getState().layer).toBe("paper");
    expect(s.getState().pageId).toBe("page-b");
  });

  it("setPageId collapses tool layer back to paper", () => {
    // A tool layer summoned for Page A shouldn't carry to Page B.
    const s = createLayerManagerStore({ pageId: "page-a" });
    s.summonTool();
    s.setPageId("page-b");
    expect(s.getState().layer).toBe("paper");
  });

  it("setPageId with same id is idempotent", () => {
    const s = createLayerManagerStore({ pageId: "page-a" });
    const listener = vi.fn();
    s.subscribe(listener);
    s.setPageId("page-a");
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("LayerManagerStore — subscribe", () => {
  it("listener fires on every state change", () => {
    const s = createLayerManagerStore();
    const listener = vi.fn();
    s.subscribe(listener);
    s.summonTool();
    s.dismissTool();
    s.setDirty(true);
    s.freeze();
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("unsubscribe stops notifications", () => {
    const s = createLayerManagerStore();
    const listener = vi.fn();
    const unsub = s.subscribe(listener);
    unsub();
    s.summonTool();
    expect(listener).not.toHaveBeenCalled();
  });

  it("multiple subscribers all fire", () => {
    const s = createLayerManagerStore();
    const a = vi.fn();
    const b = vi.fn();
    s.subscribe(a);
    s.subscribe(b);
    s.summonTool();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
