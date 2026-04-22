/**
 * v1.6.9: pure-function hit test for "does this pointerdown target on
 * a canvas object's body start a drag, or should it pass through to an
 * inner control?"
 *
 * Extracted so a unit test can pin the invariant: classic direct
 * manipulation (Dan's feedback — "every normal app supports direct
 * object dragging") without hijacking clicks on inputs, buttons, or
 * editable text inside a drop-in. The selector list is intentionally
 * broad — the cost of missing an interactive tag is that the user
 * accidentally drags the object when they meant to type; the cost of
 * flagging too many is just that the *body* isn't a drag target near
 * that control (the title bar still is).
 */
export const INTERACTIVE_SELECTOR =
  "input, textarea, select, button, " +
  "[contenteditable='true'], [role='button'], [role='textbox'], " +
  "[role='slider'], a, label, canvas";

export function shouldStartObjectDrag(target: HTMLElement | null): boolean {
  if (!target) return false;
  return target.closest(INTERACTIVE_SELECTOR) === null;
}
