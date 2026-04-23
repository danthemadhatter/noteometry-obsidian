/**
 * Pure zoom-delta math for the canvas wheel handler.
 *
 * Factored out of InkCanvas so the routing invariants are pinned by a
 * test instead of living inside a useEffect where they're effectively
 * unreachable from unit tests. The v1.6.9 regression (MBP trackpad pinch
 * stopped changing the zoom even though the wheel events arrived) was a
 * rounding bug that would have been caught by a 5-line unit test.
 */

/** Hard zoom bounds — mirrored in NoteometryApp.clampZoom. */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4.0;

export interface WheelZoomInput {
  /** Current zoom factor (1.0 = 100%). */
  zoom: number;
  /** Wheel deltaY (positive = scroll down / pinch-in, per the standard). */
  deltaY: number;
  /** True when the wheel event came from a trackpad pinch (Chromium
   *  synthesises ctrlKey for pinch-zoom even without a real Ctrl press). */
  ctrlKey: boolean;
  /** True when the user held Cmd (macOS) while scrolling with a mouse wheel. */
  metaKey: boolean;
}

/**
 * Compute the next zoom value for a Cmd/Ctrl+wheel or trackpad-pinch
 * wheel event. Returns the clamped, rounded result — or the unchanged
 * input zoom when the delta is too small to register.
 *
 * Why 3-decimal rounding: a Chromium trackpad pinch emits deltaY values
 * like -0.5 or -1.5. At scale 0.01 that's a -0.005 / -0.015 change per
 * tick. Rounding to 2 decimals (the pre-v1.6.10 behaviour) snapped
 * -0.005 back to 0, so the MBP pinch looked completely dead. Three
 * decimals preserves visible motion while keeping the readout pretty.
 */
export function nextWheelZoom(input: WheelZoomInput): number {
  const { zoom, deltaY, ctrlKey, metaKey } = input;
  // Boost pinch events (ctrlKey without metaKey) because their deltaY is
  // a fraction of what a real scroll wheel emits.
  const scale = ctrlKey && !metaKey ? 0.01 : 0.005;
  const delta = -deltaY * scale;
  const raw = zoom + delta;
  const rounded = Math.round(raw * 1000) / 1000;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, rounded));
}
