/**
 * v1.11.0 phase-1 sub-PR 1.4: layer shell + paper-dim wiring tests.
 *
 * vitest is configured for node env (no jsdom), so we don't render
 * the React tree. Instead we exercise the *logic* the components
 * embody:
 *   - paperDimClass derivation (the ternary in NoteometryApp)
 *   - ToolLayer visibility = (layer === "tool")
 *   - MetaLayer visibility = (layer === "meta")
 *   - Paper layer is interactive in paper state, non-interactive
 *     under tool / frozen, interactive under meta (tap-to-dismiss
 *     handled later).
 *
 * The components themselves are tiny — a className, an aria-hidden,
 * and a children passthrough. The state machine they read from is
 * already covered by layerManager.test.ts, so this file pins the
 * derived DOM-class semantics that `useLayerManager()` produces for
 * NoteometryApp's render path.
 */

import { describe, it, expect } from "vitest";
import { createLayerManagerStore } from "../../src/features/layerManager";

/** Mirror of the ternary inside NoteometryApp.tsx. Kept in sync by
 *  hand for now — when NoteometryApp grows a derivedSelector helper
 *  this test should import that helper directly. */
function paperDimClass(layer: "paper" | "tool" | "meta" | "frozen"): string {
  return layer === "tool"
    ? " noteometry-paper-dim-tool"
    : layer === "meta"
      ? " noteometry-paper-dim-meta"
      : layer === "frozen"
        ? " noteometry-paper-frozen"
        : "";
}

describe("paperDimClass — derived from LayerManager state", () => {
  it("paper state yields no class", () => {
    expect(paperDimClass("paper")).toBe("");
  });

  it("tool state yields dim-tool class (locks drop-ins)", () => {
    expect(paperDimClass("tool")).toBe(" noteometry-paper-dim-tool");
  });

  it("meta state yields dim-meta class (lighter dim, paper stays interactive)", () => {
    expect(paperDimClass("meta")).toBe(" noteometry-paper-dim-meta");
  });

  it("frozen state yields frozen class (kill switch)", () => {
    expect(paperDimClass("frozen")).toBe(" noteometry-paper-frozen");
  });
});

describe("Layer shell visibility logic", () => {
  // The shells render with class "noteometry-tool-layer-visible" when
  // visible. We test the predicate the components use.
  const isToolVisible = (l: string) => l === "tool";
  const isMetaVisible = (l: string) => l === "meta";

  it("ToolLayer visible only in tool state", () => {
    expect(isToolVisible("paper")).toBe(false);
    expect(isToolVisible("tool")).toBe(true);
    expect(isToolVisible("meta")).toBe(false);
    expect(isToolVisible("frozen")).toBe(false);
  });

  it("MetaLayer visible only in meta state", () => {
    expect(isMetaVisible("paper")).toBe(false);
    expect(isMetaVisible("tool")).toBe(false);
    expect(isMetaVisible("meta")).toBe(true);
    expect(isMetaVisible("frozen")).toBe(false);
  });

  it("Both layers hidden simultaneously is the default", () => {
    expect(isToolVisible("paper")).toBe(false);
    expect(isMetaVisible("paper")).toBe(false);
  });

  it("Layers are mutually exclusive (only one visible at a time)", () => {
    // The state machine enforces this; we double-check the
    // visibility predicates can't both be true for any state.
    for (const l of ["paper", "tool", "meta", "frozen"] as const) {
      expect(isToolVisible(l) && isMetaVisible(l)).toBe(false);
    }
  });
});

describe("End-to-end: gestures → state → paperDimClass", () => {
  it("3F-down summons tool, paper class flips to dim-tool, dismiss restores", () => {
    const store = createLayerManagerStore();
    expect(paperDimClass(store.getState().layer)).toBe("");
    store.handleSwipe3F("down", { x: 100, y: 100 });
    expect(paperDimClass(store.getState().layer)).toBe(
      " noteometry-paper-dim-tool",
    );
    store.handleSwipe3F("up", { x: 100, y: 100 });
    expect(paperDimClass(store.getState().layer)).toBe("");
  });

  it("3F-right summons meta, paper class flips to dim-meta, dismiss restores", () => {
    const store = createLayerManagerStore();
    store.handleSwipe3F("right", { x: 100, y: 100 });
    expect(paperDimClass(store.getState().layer)).toBe(
      " noteometry-paper-dim-meta",
    );
    store.handleSwipe3F("left", { x: 100, y: 100 });
    expect(paperDimClass(store.getState().layer)).toBe("");
  });

  it("freeze flips paper to frozen class, unfreeze restores", () => {
    const store = createLayerManagerStore();
    store.freeze();
    expect(paperDimClass(store.getState().layer)).toBe(
      " noteometry-paper-frozen",
    );
    store.unfreeze();
    expect(paperDimClass(store.getState().layer)).toBe("");
  });
});
