/**
 * v1.6.12: wheel routing across drop-ins.
 *
 * Dan's two-finger scroll on MacBook Pro stopped dead whenever the cursor
 * crossed a drop-in — the canvas pan worked on empty canvas but a drop-in
 * silently ate the wheel events. Pre-v1.6.12 the canvas wheel handler
 * bailed on any target inside `[data-dropin-id], textarea,
 * .noteometry-object-content` without forwarding the pan, so non-scrollable
 * drop-ins created dead zones.
 *
 * Policy:
 *   • If the target (or an ancestor up to the canvas viewport) is an
 *     element that's genuinely scrollable in the axis the user is
 *     scrolling, yield to it — OneNote / MyScript work the same way.
 *   • Otherwise, pan the canvas. Drop-ins don't get to be dead zones.
 *
 * "Genuinely scrollable" = overflow:auto/scroll AND scrollHeight/Width
 * exceeds clientHeight/Width in the relevant direction. That skips divs
 * that happen to have overflow:auto but no overflowing content.
 */

export interface WheelDelta {
  deltaX: number;
  deltaY: number;
}

/** True if `el` can scroll further in the given axis (including wrap-around
 *  in the opposite direction if it's already scrolled). */
function canScroll(el: Element, axis: "x" | "y", delta: number): boolean {
  const style = (el.ownerDocument?.defaultView ?? window).getComputedStyle(el);
  const overflow = axis === "y" ? style.overflowY : style.overflowX;
  if (overflow !== "auto" && overflow !== "scroll") return false;

  const html = el as HTMLElement;
  const scrollSize = axis === "y" ? html.scrollHeight : html.scrollWidth;
  const clientSize = axis === "y" ? html.clientHeight : html.clientWidth;
  if (scrollSize <= clientSize + 1) return false;

  const pos = axis === "y" ? html.scrollTop : html.scrollLeft;
  const max = scrollSize - clientSize;
  if (delta > 0 && pos >= max - 0.5) return false;
  if (delta < 0 && pos <= 0.5) return false;
  return true;
}

/**
 * Walk from `target` up to (but not through) `boundary`, looking for an
 * element that can absorb the scroll in either axis. Returns true when
 * the caller should yield (let the element scroll natively).
 */
export function shouldYieldToNativeScroll(
  target: Element | null,
  boundary: Element | null,
  delta: WheelDelta,
): boolean {
  if (!target) return false;
  let el: Element | null = target;
  while (el && el !== boundary) {
    if (delta.deltaY !== 0 && canScroll(el, "y", delta.deltaY)) return true;
    if (delta.deltaX !== 0 && canScroll(el, "x", delta.deltaX)) return true;
    el = el.parentElement;
  }
  return false;
}
