import { useCallback, useRef } from "react";

/** Threshold in ms before the long-press fires. */
const LONG_PRESS_MS = 500;
/** Max movement in px before the press is cancelled (that's a scroll, not a press). */
const MOVE_THRESHOLD = 8;

export interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

/**
 * Returns pointer + contextmenu handlers that fire `callback` on:
 *   - Long-press (touch-and-hold ~500ms, stationary within 8px) — iPad
 *   - Right-click (contextmenu event) — desktop
 *
 * The callback receives `{ x, y }` in client coordinates (suitable for
 * positioning a context menu).
 *
 * Cancels the long-press if the pointer moves more than 8px (scroll/draw)
 * or lifts before 500ms.
 */
export function useLongPress(
  callback: (pos: { x: number; y: number }, e: React.PointerEvent | React.MouseEvent) => void,
): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  // Stash the event so we can pass it to the callback from the timer.
  const lastEventRef = useRef<React.PointerEvent | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
    lastEventRef.current = null;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only track touch and pen — mouse uses contextmenu instead
    if (e.pointerType === "mouse") return;
    firedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    lastEventRef.current = e;

    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      const pos = startPosRef.current;
      if (pos) {
        callback(pos, lastEventRef.current!);
      }
      cancel();
    }, LONG_PRESS_MS);
  }, [callback, cancel]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!startPosRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    if (dx * dx + dy * dy > MOVE_THRESHOLD * MOVE_THRESHOLD) {
      cancel();
    }
  }, [cancel]);

  const onPointerUp = useCallback((_e: React.PointerEvent) => {
    cancel();
  }, [cancel]);

  const onPointerCancel = useCallback((_e: React.PointerEvent) => {
    cancel();
  }, [cancel]);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    // Desktop right-click: fire the callback immediately
    e.preventDefault();
    e.stopPropagation();
    callback({ x: e.clientX, y: e.clientY }, e);
  }, [callback]);

  return { onPointerDown, onPointerUp, onPointerMove, onPointerCancel, onContextMenu };
}
