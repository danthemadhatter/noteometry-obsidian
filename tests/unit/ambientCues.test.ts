/**
 * v1.11.0 phase-2 sub-PR 2.1: ambient cue visibility logic tests.
 *
 * vitest is node-env (no jsdom), so we don't render React. Each
 * component is a pure function of its context inputs (LayerManager
 * state + AIActivityContext); we exercise that function-of-state
 * here by replicating the predicates the components encode.
 *
 * If a component's logic drifts, this file is the canary — keep it
 * synced with the components by hand or extract shared helpers.
 *
 * Coverage:
 *   - EdgeGlow: visible by default, hidden when its layer is up,
 *     hidden during freeze
 *   - SaveDot: dirty/clean class, hidden during freeze
 *   - AIActivityRibbon: active when count > 0, hidden during freeze
 *     (overrides active)
 *   - End-to-end: dirty wiring through createLayerManagerStore
 */

import { describe, it, expect } from "vitest";
import { createLayerManagerStore } from "../../src/features/layerManager";
import { createAIActivityStore } from "../../src/features/aiActivity";

type Layer = "paper" | "tool" | "meta" | "frozen";

/** Mirror of EdgeGlow.tsx visibility predicate. */
function edgeGlowHidden(side: "top" | "left", layer: Layer): boolean {
  return (
    layer === "frozen" ||
    (side === "top" && layer === "tool") ||
    (side === "left" && layer === "meta")
  );
}

/** Mirror of SaveDot.tsx hidden predicate. */
function saveDotHidden(layer: Layer): boolean {
  return layer === "frozen";
}

/** Mirror of AIActivityRibbon.tsx active predicate (the rendered class
 *  is "active" only when count>0 AND not frozen). */
function aiRibbonActive(isActive: boolean, layer: Layer): boolean {
  return isActive && layer !== "frozen";
}

describe("EdgeGlow visibility", () => {
  it("top edge visible on paper", () => {
    expect(edgeGlowHidden("top", "paper")).toBe(false);
  });

  it("top edge HIDDEN when tool layer is up (strip itself is the signal)", () => {
    expect(edgeGlowHidden("top", "tool")).toBe(true);
  });

  it("top edge visible when meta layer is up", () => {
    expect(edgeGlowHidden("top", "meta")).toBe(false);
  });

  it("left edge visible on paper", () => {
    expect(edgeGlowHidden("left", "paper")).toBe(false);
  });

  it("left edge HIDDEN when meta layer is up", () => {
    expect(edgeGlowHidden("left", "meta")).toBe(true);
  });

  it("left edge visible when tool layer is up", () => {
    expect(edgeGlowHidden("left", "tool")).toBe(false);
  });

  it("both edges HIDDEN during freeze (no chrome teaser)", () => {
    expect(edgeGlowHidden("top", "frozen")).toBe(true);
    expect(edgeGlowHidden("left", "frozen")).toBe(true);
  });
});

describe("SaveDot visibility", () => {
  it("visible on paper, tool, meta", () => {
    expect(saveDotHidden("paper")).toBe(false);
    expect(saveDotHidden("tool")).toBe(false);
    expect(saveDotHidden("meta")).toBe(false);
  });

  it("hidden during freeze", () => {
    expect(saveDotHidden("frozen")).toBe(true);
  });
});

describe("SaveDot dirty wiring (end-to-end through LayerManager store)", () => {
  it("starts clean", () => {
    const store = createLayerManagerStore();
    expect(store.getState().dirty).toBe(false);
  });

  it("setDirty(true) flips dirty and notifies", () => {
    const store = createLayerManagerStore();
    let notified = 0;
    store.subscribe(() => notified++);
    store.setDirty(true);
    expect(store.getState().dirty).toBe(true);
    expect(notified).toBe(1);
  });

  it("setDirty(false) flips back and notifies", () => {
    const store = createLayerManagerStore({ dirty: true });
    let notified = 0;
    store.subscribe(() => notified++);
    store.setDirty(false);
    expect(store.getState().dirty).toBe(false);
    expect(notified).toBe(1);
  });

  it("repeated setDirty(true) is idempotent (no extra notify)", () => {
    const store = createLayerManagerStore();
    let notified = 0;
    store.subscribe(() => notified++);
    store.setDirty(true);
    store.setDirty(true);
    store.setDirty(true);
    expect(notified).toBe(1);
  });
});

describe("AIActivityRibbon active state", () => {
  it("active when AI in flight on paper/tool/meta", () => {
    expect(aiRibbonActive(true, "paper")).toBe(true);
    expect(aiRibbonActive(true, "tool")).toBe(true);
    expect(aiRibbonActive(true, "meta")).toBe(true);
  });

  it("inactive when no AI in flight", () => {
    expect(aiRibbonActive(false, "paper")).toBe(false);
    expect(aiRibbonActive(false, "tool")).toBe(false);
  });

  it("inactive during freeze even with AI calls in flight (soft-aborted)", () => {
    expect(aiRibbonActive(true, "frozen")).toBe(false);
  });
});

describe("AIActivityRibbon end-to-end through aiActivity store", () => {
  it("ribbon goes active when a call begins, idle when it ends", () => {
    const ai = createAIActivityStore();
    expect(aiRibbonActive(ai.getIsActive(), "paper")).toBe(false);
    const id = ai.begin();
    expect(aiRibbonActive(ai.getIsActive(), "paper")).toBe(true);
    ai.end(id);
    expect(aiRibbonActive(ai.getIsActive(), "paper")).toBe(false);
  });

  it("ribbon stays active while >=1 call is in flight", () => {
    const ai = createAIActivityStore();
    const id1 = ai.begin();
    const id2 = ai.begin();
    expect(ai.getCount()).toBe(2);
    ai.end(id1);
    expect(aiRibbonActive(ai.getIsActive(), "paper")).toBe(true);
    ai.end(id2);
    expect(aiRibbonActive(ai.getIsActive(), "paper")).toBe(false);
  });
});

describe("Per-page frozen scope", () => {
  it("setPageId clears frozen state (so user isn't stranded after navigation)", () => {
    const store = createLayerManagerStore({ pageId: "page-a" });
    store.freeze();
    expect(store.getState().layer).toBe("frozen");
    store.setPageId("page-b");
    expect(store.getState().layer).toBe("paper");
    expect(store.getState().pageId).toBe("page-b");
  });

  it("setPageId(same) is idempotent", () => {
    const store = createLayerManagerStore({ pageId: "page-a" });
    let notified = 0;
    store.subscribe(() => notified++);
    store.setPageId("page-a");
    expect(notified).toBe(0);
  });
});
