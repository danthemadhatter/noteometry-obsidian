import { describe, it, expect, vi } from "vitest";
import { buildClearCanvasAction, CLEAR_CANVAS_LABEL } from "../../src/lib/canvasMenuActions";

/**
 * v1.6.8 regression guardrail.
 *
 * Clear Canvas was reported as "disappeared" during v1.6.7 testing even
 * though the item was still being pushed into the context menu — it had
 * drifted to the very bottom of a 30+ item menu with no visual break
 * above it, and the label was easy to mistake for the lasso's "Clear"
 * button. These tests pin the contract the hub depends on so the item
 * cannot silently vanish again.
 */

describe("buildClearCanvasAction", () => {
  it("produces an item labeled exactly \"Clear Canvas\" so the registry test can find it", () => {
    const item = buildClearCanvasAction(() => {});
    expect(item.label).toBe(CLEAR_CANVAS_LABEL);
    expect(item.label).toBe("Clear Canvas");
  });

  it("is flagged as destructive so the menu styles it distinctly from safe actions", () => {
    const item = buildClearCanvasAction(() => {});
    expect(item.danger).toBe(true);
  });

  it("wires its onClick straight to the destructive handler the caller provides", () => {
    const handler = vi.fn();
    const item = buildClearCanvasAction(handler);
    expect(typeof item.onClick).toBe("function");
    item.onClick?.();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("label is distinct from the lasso overlay's \"Clear\" button", () => {
    // The lasso overlay renders a button whose label is the bare string
    // "Clear" (see LassoOverlay.tsx). Clear Canvas must NOT collapse to
    // that string — the two actions do very different things.
    const item = buildClearCanvasAction(() => {});
    expect(item.label).not.toBe("Clear");
  });

  it("is not disabled by default — Clear Canvas must always be reachable", () => {
    const item = buildClearCanvasAction(() => {});
    expect(item.disabled).toBeFalsy();
  });
});
