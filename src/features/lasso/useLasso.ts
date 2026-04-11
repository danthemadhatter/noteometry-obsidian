import { useState, useRef, useCallback, Dispatch, SetStateAction, MutableRefObject } from "react";

/**
 * Lasso feature hook. Phase 1 version: single-lasso state only.
 *
 * Owns: lassoActive toggle, pendingCropRef for OCR-pending crops.
 *
 * The actual lasso handlers (handleLassoComplete, handleLassoMoveComplete)
 * stay in the composition layer because they coordinate across multiple
 * features (ink, objects) and need cross-hook state access. This hook is
 * deliberately minimal — it's the seed for useLassoStack in Phase 3 where
 * multi-region selection will live.
 */
export interface UseLassoReturn {
  lassoActive: boolean;
  setLassoActive: Dispatch<SetStateAction<boolean>>;
  pendingCropRef: MutableRefObject<string | null>;
  toggleLasso: () => void;
  clearPending: () => void;
}

export function useLasso(): UseLassoReturn {
  const [lassoActive, setLassoActive] = useState(false);
  const pendingCropRef = useRef<string | null>(null);

  const toggleLasso = useCallback(() => {
    setLassoActive((prev) => {
      if (prev) pendingCropRef.current = null;
      return !prev;
    });
  }, []);

  const clearPending = useCallback(() => {
    pendingCropRef.current = null;
  }, []);

  return {
    lassoActive,
    setLassoActive,
    pendingCropRef,
    toggleLasso,
    clearPending,
  };
}
