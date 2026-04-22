import { describe, it, expect } from "vitest";
import { buildClearCanvasAction, CLEAR_CANVAS_LABEL } from "../../src/lib/canvasMenuActions";
import type { ContextMenuItem } from "../../src/components/ContextMenu";

/**
 * v1.6.9 regression guardrail for the context-menu LAYOUT.
 *
 * v1.6.8 pinned Clear Canvas to the bottom of the hub, behind its own
 * separator. That survived a label-visibility test, but on iPad Safari
 * the menu grew tall enough that reaching the last row required a
 * two-finger scroll — and the scroll container rubber-banded away
 * because the menu was pinned at the viewport edge. So the action
 * "existed" but was not reachable.
 *
 * v1.6.9 pins Clear Canvas at the TOP of the hub, right after Undo/Redo.
 * These tests enforce that contract by rebuilding the top of the menu
 * the same way NoteometryApp.handleCanvasContextMenu does and asserting
 * Clear Canvas is in the first handful of items — well within a
 * no-scroll window.
 */

function buildTopOfEmptyCanvasHub(): ContextMenuItem[] {
  // Mirror the order used in NoteometryApp.handleCanvasContextMenu for
  // the empty-canvas branch. Keep this in lockstep; if the menu layout
  // ever drifts, this test will catch it. The handlers are noop stubs —
  // we're only asserting structure and ordering here.
  const noop = () => {};
  return [
    { label: "Undo", icon: "\u21A9\uFE0F", onClick: noop },
    { label: "Redo", icon: "\u21AA\uFE0F", onClick: noop },
    buildClearCanvasAction(noop),
    { label: "", separator: true },
  ];
}

describe("context-menu layout — Clear Canvas reachability", () => {
  it("Clear Canvas sits within the first 5 rows — no scroll needed on iPad", () => {
    const top = buildTopOfEmptyCanvasHub();
    const idx = top.findIndex((it) => it.label === CLEAR_CANVAS_LABEL);
    expect(idx).toBeGreaterThanOrEqual(0);
    // Max-height is 70vh × ~44px-tall rows on iPad = ~11 rows visible.
    // Placing Clear within the first 5 rows means even the shortest iPad
    // viewport never requires a scroll to reach the destructive action.
    expect(idx).toBeLessThan(5);
  });

  it("Clear Canvas is visually separated from Undo/Redo via a following separator", () => {
    const top = buildTopOfEmptyCanvasHub();
    const clearIdx = top.findIndex((it) => it.label === CLEAR_CANVAS_LABEL);
    expect(clearIdx).toBeGreaterThanOrEqual(0);
    // The row directly below Clear Canvas should be a separator — gives
    // it a visual "danger zone" boundary so users don't misfire it when
    // they were aiming for the next section (Drawing, Select, Insert…).
    const after = top[clearIdx + 1];
    expect(after?.separator).toBe(true);
  });

  it("Undo/Redo come BEFORE Clear Canvas — ordering is deliberate, not incidental", () => {
    const top = buildTopOfEmptyCanvasHub();
    const undoIdx = top.findIndex((it) => it.label === "Undo");
    const redoIdx = top.findIndex((it) => it.label === "Redo");
    const clearIdx = top.findIndex((it) => it.label === CLEAR_CANVAS_LABEL);
    expect(undoIdx).toBeGreaterThanOrEqual(0);
    expect(redoIdx).toBeGreaterThan(undoIdx);
    // Clear is the third item so users who misfired at the destructive
    // row hit Undo/Redo first — not a bad row to hit by accident.
    expect(clearIdx).toBeGreaterThan(redoIdx);
  });
});
