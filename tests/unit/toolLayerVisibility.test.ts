/**
 * v1.11.0 phase-5: ToolLayer visibility predicate test.
 *
 * The ToolLayer now exports `isToolLayerVisible(layer)` so that the
 * phase-5 toolbar's mount/dismiss can be unit-tested without React.
 */

import { describe, it, expect } from "vitest";
import { isToolLayerVisible } from "../../src/components/layers/ToolLayer";
import { createLayerManagerStore } from "../../src/features/layerManager";

describe("isToolLayerVisible", () => {
  it("only true for the 'tool' state", () => {
    expect(isToolLayerVisible("paper")).toBe(false);
    expect(isToolLayerVisible("tool")).toBe(true);
    expect(isToolLayerVisible("meta")).toBe(false);
    expect(isToolLayerVisible("frozen")).toBe(false);
  });

  it("flips through a real LayerManager session", () => {
    const store = createLayerManagerStore();
    expect(isToolLayerVisible(store.getState().layer)).toBe(false);
    store.summonTool();
    expect(isToolLayerVisible(store.getState().layer)).toBe(true);
    store.dismissTool();
    expect(isToolLayerVisible(store.getState().layer)).toBe(false);
  });

  it("freeze does not reveal the tool layer", () => {
    const store = createLayerManagerStore();
    store.freeze();
    expect(isToolLayerVisible(store.getState().layer)).toBe(false);
  });
});
