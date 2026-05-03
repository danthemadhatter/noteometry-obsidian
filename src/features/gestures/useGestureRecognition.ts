/**
 * useGestureRecognition — v1.11.0 phase-1 sub-PR 1.3.
 *
 * React adapter that bridges DOM PointerEvents → the pure
 * `createGestureRecognizer()` from `./gestureRecognizer.ts` →
 * user-supplied callbacks for swipe-3f and tap-4f.
 *
 * Design doc §5 step 2/3 names two hooks (`useGesture3F`,
 * `useGesture4F`) but the recognizer is unified — its four
 * guardrails are joint state across both gesture families
 * (e.g. peak-count classification needs to know whether a
 * 4-finger tap briefly registered as 3 fingers). Splitting
 * them into two hooks would require two recognizer instances,
 * which would race on the same pointer events.
 *
 * Solution: one hook, two callbacks. Thin convenience wrappers
 * `useGesture3F` / `useGesture4F` are exported below for call
 * sites that only care about one family — under the hood they
 * share a single recognizer.
 *
 * Target binding:
 *   The hook accepts a `target` that can be:
 *     - a Window (typically `window`) — captures everywhere
 *     - an HTMLElement directly
 *     - a React ref to an HTMLElement
 *     - null (hook is disabled until a real target appears)
 *
 *   When the target changes, listeners are torn down and rebound
 *   atomically. Recognizer state is reset on rebind so a stray
 *   pointer-down on the old target can't poison the new session.
 *
 * Pencil lockout integration:
 *   PointerEvents include `pointerType` directly, so the recognizer
 *   gets pen events natively without any DOM-level filtering. The
 *   recognizer's lockout clock handles the timing.
 *
 * passive: false:
 *   We need to be able to call preventDefault on touchstart-like
 *   events to suppress iOS rubber-band scroll on the canvas. The
 *   listeners are bound passive: false. This is conservative — the
 *   hook itself doesn't call preventDefault, but consumers may want
 *   to wrap it in a stopPropagation pass.
 */

import { useEffect, useRef } from "react";
import {
  createGestureRecognizer,
  type GestureRecognizer,
  type GestureResult,
  type PointerSnapshot,
  type RecognizerConfig,
  type Swipe3FResult,
  type Tap4FResult,
} from "./gestureRecognizer";

export type GestureTarget =
  | Window
  | HTMLElement
  | { current: HTMLElement | null }
  | null;

export interface UseGestureRecognitionOptions {
  /** Called when a 3-finger swipe commits. Optional. */
  onSwipe3F?: (result: Swipe3FResult) => void;
  /** Called when a 4-finger tap commits. Optional. */
  onTap4F?: (result: Tap4FResult) => void;
  /** Per-call recognizer overrides. Default config from gestureRecognizer.ts. */
  config?: Partial<RecognizerConfig>;
  /** Disable the hook without unmounting. Default false. */
  disabled?: boolean;
  /** Override recognizer factory — test-only seam. */
  __recognizerFactory?: (
    config: Partial<RecognizerConfig>,
  ) => GestureRecognizer;
}

/**
 * Resolve a GestureTarget to its EventTarget right now. Returns null
 * if the target is currently unresolvable (ref not yet attached).
 */
function resolveTarget(target: GestureTarget): EventTarget | null {
  if (target === null) return null;
  if (typeof Window !== "undefined" && target instanceof Window) {
    return target;
  }
  // HTMLElement check via duck-typing (avoids ReferenceError in non-DOM tests).
  if (
    typeof (target as HTMLElement).addEventListener === "function" &&
    typeof (target as HTMLElement).removeEventListener === "function"
  ) {
    return target as EventTarget;
  }
  // Ref object: { current: ... }
  if (typeof target === "object" && "current" in target) {
    return target.current ?? null;
  }
  return null;
}

/**
 * Convert a DOM PointerEvent to the recognizer's PointerSnapshot
 * shape. Exported for unit testing without a real DOM.
 */
export function pointerEventToSnapshot(
  ev: PointerEvent,
  phase: PointerSnapshot["phase"],
): PointerSnapshot {
  // Coerce pointerType — recognizer only knows mouse/pen/touch.
  // PointerEvent technically allows arbitrary strings; on iPad WebKit
  // it's always one of the three.
  let pointerType: PointerSnapshot["pointerType"];
  if (ev.pointerType === "pen") pointerType = "pen";
  else if (ev.pointerType === "touch") pointerType = "touch";
  else pointerType = "mouse";

  return {
    pointerId: ev.pointerId,
    pointerType,
    x: ev.clientX,
    y: ev.clientY,
    phase,
    t:
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
        ? performance.now()
        : Date.now(),
  };
}

export interface BoundGestureRecognition {
  /** The active recognizer. */
  recognizer: GestureRecognizer;
  /** Tear down listeners and reset recognizer state. */
  dispose: () => void;
}

/**
 * Pure (non-React) binder. Attaches pointer listeners to `evtTarget`,
 * routes events through a fresh recognizer, and dispatches results to
 * the supplied callbacks. Returns a dispose function.
 *
 * The React hook below is a thin useEffect wrapper around this; tests
 * exercise this directly without mounting React.
 */
export function bindGestureRecognition(
  evtTarget: EventTarget,
  options: UseGestureRecognitionOptions = {},
): BoundGestureRecognition {
  const factory = options.__recognizerFactory ?? createGestureRecognizer;
  const recognizer = factory(options.config ?? {});

  const dispatch = (result: GestureResult | null): void => {
    if (!result) return;
    if (result.kind === "swipe-3f") {
      options.onSwipe3F?.(result);
    } else if (result.kind === "tap-4f") {
      options.onTap4F?.(result);
    }
  };

  const onDown = (ev: Event): void => {
    dispatch(recognizer.feed(pointerEventToSnapshot(ev as PointerEvent, "down")));
  };
  const onMove = (ev: Event): void => {
    dispatch(recognizer.feed(pointerEventToSnapshot(ev as PointerEvent, "move")));
  };
  const onUp = (ev: Event): void => {
    dispatch(recognizer.feed(pointerEventToSnapshot(ev as PointerEvent, "up")));
  };
  const onCancel = (ev: Event): void => {
    dispatch(
      recognizer.feed(pointerEventToSnapshot(ev as PointerEvent, "cancel")),
    );
  };

  // passive: false leaves consumers free to call preventDefault
  // (e.g. on touchmove to block iOS rubber-band) without us forcing a
  // passive listener.
  const opts: AddEventListenerOptions = { passive: false };
  evtTarget.addEventListener("pointerdown", onDown, opts);
  evtTarget.addEventListener("pointermove", onMove, opts);
  evtTarget.addEventListener("pointerup", onUp, opts);
  evtTarget.addEventListener("pointercancel", onCancel, opts);

  return {
    recognizer,
    dispose: () => {
      evtTarget.removeEventListener("pointerdown", onDown, opts);
      evtTarget.removeEventListener("pointermove", onMove, opts);
      evtTarget.removeEventListener("pointerup", onUp, opts);
      evtTarget.removeEventListener("pointercancel", onCancel, opts);
      recognizer.reset();
    },
  };
}

/**
 * Bind 3F/4F gesture recognition to a DOM target. Returns the
 * recognizer instance for advanced cases (diagnostics, manual feeds);
 * most call sites can ignore it.
 */
export function useGestureRecognition(
  target: GestureTarget,
  options: UseGestureRecognitionOptions = {},
): { recognizerRef: { current: GestureRecognizer | null } } {
  const recognizerRef = useRef<GestureRecognizer | null>(null);

  // Stash callbacks/config in refs so the effect doesn't re-bind on
  // every render. Re-bind only on target change.
  const onSwipeRef = useRef(options.onSwipe3F);
  const onTapRef = useRef(options.onTap4F);
  const configRef = useRef(options.config);
  const factoryRef = useRef(options.__recognizerFactory);
  const disabledRef = useRef(options.disabled);
  onSwipeRef.current = options.onSwipe3F;
  onTapRef.current = options.onTap4F;
  configRef.current = options.config;
  factoryRef.current = options.__recognizerFactory;
  disabledRef.current = options.disabled;

  useEffect(() => {
    const evtTarget = resolveTarget(target);
    if (!evtTarget) return;
    if (disabledRef.current) return;

    // Fresh binding per target — prevents state leaking between swaps.
    const bound = bindGestureRecognition(evtTarget, {
      onSwipe3F: (r) => onSwipeRef.current?.(r),
      onTap4F: (r) => onTapRef.current?.(r),
      config: configRef.current,
      __recognizerFactory: factoryRef.current,
    });
    recognizerRef.current = bound.recognizer;

    return () => {
      bound.dispose();
      recognizerRef.current = null;
    };
  }, [target]);

  return { recognizerRef };
}

/**
 * Convenience hook that fires only on 3-finger swipes. Internally
 * shares the same recognizer as useGesture4F (guardrails need joint
 * state) — but call sites that don't care about 4F can use this for
 * clarity.
 */
export function useGesture3F(
  target: GestureTarget,
  onSwipe: (result: Swipe3FResult) => void,
  config?: Partial<RecognizerConfig>,
): void {
  useGestureRecognition(target, { onSwipe3F: onSwipe, config });
}

/**
 * Convenience hook that fires only on 4-finger taps (freeze gesture).
 */
export function useGesture4F(
  target: GestureTarget,
  onTap: (result: Tap4FResult) => void,
  config?: Partial<RecognizerConfig>,
): void {
  useGestureRecognition(target, { onTap4F: onTap, config });
}
