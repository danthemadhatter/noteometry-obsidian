/**
 * useLayerGestures — v1.11.0 phase-1 sub-PR 1.3.
 *
 * One-line wiring from DOM gestures to LayerManager. Mounts
 * pointer-event listeners on `target`, runs them through the shared
 * gesture recognizer, and routes:
 *   - 3-finger swipes → store.handleSwipe3F(direction, origin)
 *   - 4-finger tap   → store.freeze()
 *
 * Sub-PR 1.4 (ToolLayer/MetaLayer shells) is the first consumer.
 * Until that lands, no one calls this hook — but it's importable
 * for tests and mounts cleanly when a target is provided.
 *
 * Why a separate file from `useGestureRecognition`:
 *   `useGestureRecognition` is the generic adapter (DOM →
 *   recognizer → callbacks). `useLayerGestures` is the
 *   LayerManager-specific wiring. Keeping them apart means tests
 *   can exercise the adapter without LayerManager and vice versa.
 */

import { useCallback } from "react";
import { useLayerManager } from "../layerManager";
import {
  useGestureRecognition,
  type GestureTarget,
} from "./useGestureRecognition";
import type {
  RecognizerConfig,
  Swipe3FResult,
  Tap4FResult,
} from "./gestureRecognizer";

export interface UseLayerGesturesOptions {
  /** Override recognizer thresholds. Default config from gestureRecognizer.ts. */
  config?: Partial<RecognizerConfig>;
  /** Disable the hook without unmounting. Default false. */
  disabled?: boolean;
}

/**
 * Mount the v1.11 layer gesture vocabulary on a DOM target. Calls
 * into LayerManager via the React context — this hook MUST be used
 * inside a `<LayerManagerProvider>`.
 */
export function useLayerGestures(
  target: GestureTarget,
  options: UseLayerGesturesOptions = {},
): void {
  const { store } = useLayerManager();

  const onSwipe3F = useCallback(
    (r: Swipe3FResult) => {
      store.handleSwipe3F(r.direction, r.origin);
    },
    [store],
  );

  const onTap4F = useCallback(
    (_r: Tap4FResult) => {
      // Phase 3 will also invalidate AI tokens here. For now,
      // freezing the LayerManager is enough — the freeze badge UI
      // ships in phase 3.
      store.freeze();
    },
    [store],
  );

  useGestureRecognition(target, {
    onSwipe3F,
    onTap4F,
    config: options.config,
    disabled: options.disabled,
  });
}
