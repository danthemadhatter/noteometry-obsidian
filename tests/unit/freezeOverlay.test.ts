/**
 * v1.11.0 phase-3 sub-PR 3.1: FreezeOverlay tests.
 *
 * Vitest is node-env (no jsdom, no React rendering), so we test:
 *   - `isFreezeOverlayVisible` predicate covers all four LayerStates
 *   - `buildBrainDumpSeed` formats `[brain dump @ <iso>]` per design
 *     doc §3 / §7 Q1 lock (plain text, ISO timestamp)
 *   - End-to-end through `createLayerManagerStore`:
 *       · freeze() flips visibility predicate to true
 *       · unfreeze() flips back to false
 *       · paper / tool / meta states are NOT visible
 *       · per-page scope: setPageId() clears frozen back to paper
 *       · idempotent: double freeze / double unfreeze don't break
 */

import { describe, it, expect } from "vitest";
import { createLayerManagerStore } from "../../src/features/layerManager";
import {
  isFreezeOverlayVisible,
  buildBrainDumpSeed,
} from "../../src/components/freeze/FreezeOverlay";

describe("isFreezeOverlayVisible", () => {
  it("returns true only for 'frozen'", () => {
    expect(isFreezeOverlayVisible("paper")).toBe(false);
    expect(isFreezeOverlayVisible("tool")).toBe(false);
    expect(isFreezeOverlayVisible("meta")).toBe(false);
    expect(isFreezeOverlayVisible("frozen")).toBe(true);
  });
});

describe("buildBrainDumpSeed (design doc §7 Q1 lock)", () => {
  it("produces plain text with ISO timestamp", () => {
    const fixed = new Date("2026-05-03T04:14:00Z");
    expect(buildBrainDumpSeed(fixed)).toBe(
      "[brain dump @ 2026-05-03T04:14:00.000Z]",
    );
  });

  it("uses real-time when no date passed", () => {
    const seed = buildBrainDumpSeed();
    expect(seed).toMatch(
      /^\[brain dump @ \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/,
    );
  });

  it("does NOT use LaTeX \\text{} (Q1 explicitly rejected MathDropin)", () => {
    const seed = buildBrainDumpSeed();
    expect(seed).not.toMatch(/\\text/);
    expect(seed).not.toMatch(/\$/);
  });
});

describe("LayerManager → FreezeOverlay visibility integration", () => {
  it("starts hidden (paper)", () => {
    const store = createLayerManagerStore();
    expect(isFreezeOverlayVisible(store.getState().layer)).toBe(false);
  });

  it("freeze() makes it visible", () => {
    const store = createLayerManagerStore();
    store.freeze();
    expect(isFreezeOverlayVisible(store.getState().layer)).toBe(true);
  });

  it("unfreeze() hides it again", () => {
    const store = createLayerManagerStore();
    store.freeze();
    store.unfreeze();
    expect(isFreezeOverlayVisible(store.getState().layer)).toBe(false);
  });

  it("freeze from tool / meta also makes it visible", () => {
    const store = createLayerManagerStore();
    store.summonTool({ x: 0, y: 0 });
    store.freeze();
    expect(isFreezeOverlayVisible(store.getState().layer)).toBe(true);

    const store2 = createLayerManagerStore();
    store2.summonMeta({ x: 0, y: 0 });
    store2.freeze();
    expect(isFreezeOverlayVisible(store2.getState().layer)).toBe(true);
  });

  it("setPageId clears frozen (per-page scope, design doc §3)", () => {
    const store = createLayerManagerStore({ pageId: "a.md" });
    store.freeze();
    expect(isFreezeOverlayVisible(store.getState().layer)).toBe(true);
    store.setPageId("b.md");
    expect(isFreezeOverlayVisible(store.getState().layer)).toBe(false);
  });

  it("double freeze / double unfreeze are idempotent", () => {
    const store = createLayerManagerStore();
    store.freeze();
    store.freeze();
    expect(isFreezeOverlayVisible(store.getState().layer)).toBe(true);
    store.unfreeze();
    store.unfreeze();
    expect(isFreezeOverlayVisible(store.getState().layer)).toBe(false);
  });

  it("3F swipes are no-ops while frozen (gestures blocked)", () => {
    const store = createLayerManagerStore();
    store.freeze();
    const swallowed = store.handleSwipe3F("down", { x: 0, y: 0 });
    expect(swallowed).toBe(false);
    // Still frozen.
    expect(isFreezeOverlayVisible(store.getState().layer)).toBe(true);
  });
});
