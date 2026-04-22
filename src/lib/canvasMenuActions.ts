import type { ContextMenuItem } from "../components/ContextMenu";

/**
 * v1.6.8: dedicated factory for the "Clear Canvas" context-menu action.
 *
 * Extracted because this item went missing during the v1.6.6/v1.6.7 hub
 * repair passes — it was still in the source, but buried at the bottom
 * of a long menu and the user reported it as "disappeared." Keeping it
 * in its own pure factory lets a unit test pin the invariant: Clear
 * Canvas must exist, must be destructive-styled, and must call the
 * destructive handler (which is responsible for confirm + undo push).
 *
 * Intentionally not merged with generic menu-building: the lasso's
 * small "Clear" button (LassoOverlay) is a separate feature and must
 * NOT be confused with Clear Canvas. Distinct label + distinct action.
 */
export function buildClearCanvasAction(onDestructiveClear: () => void): ContextMenuItem {
  return {
    label: "Clear Canvas",
    icon: "🗑️",
    danger: true,
    onClick: onDestructiveClear,
  };
}

/**
 * The canonical label the menu uses. Exposed so the unit test can
 * assert the item is present without hard-coding the string in two
 * places.
 */
export const CLEAR_CANVAS_LABEL = "Clear Canvas";
