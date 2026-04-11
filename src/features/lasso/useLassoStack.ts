import { useState, useCallback, useRef, Dispatch, SetStateAction } from "react";
import type { LassoBounds } from "../../components/LassoOverlay";

/**
 * Lasso stack feature hook. Phase 3 version: multi-region selection.
 *
 * The stack holds N completed regions, each with its own rasterized snapshot
 * captured at the moment the user finished drawing it. Rasterizing at capture
 * time matters because the user may scroll between lassos — we want Region 1
 * to reflect what was visible when it was drawn, not where that region now
 * lies in scene space after panning away.
 *
 * The actual rasterization happens in the composition layer (which has the
 * DOM container ref and imports html2canvas). This hook is pure state.
 *
 * Cross-feature handlers (rasterize on draw complete, composite + send to
 * pipeline on process) stay in NoteometryApp because they bridge ink, DOM,
 * and the pipeline.
 */

/** Lasso drawing mode. "freehand" = polygon traced with pen; "rect" =
 * axis-aligned rectangle (drag a corner to the opposite corner). Rect mode
 * exists for capturing printed material from dropped images or pasted
 * screenshots where a clean rectangle is faster/cleaner than a scribble. */
export type LassoMode = "freehand" | "rect";

export interface LassoRegion {
  id: string;
  bounds: LassoBounds;
  /** Base64 PNG data URL, rasterized at the moment this region was drawn. */
  capturedImage: string;
}

export interface UseLassoStackReturn {
  lassoActive: boolean;
  lassoMode: LassoMode;
  regions: LassoRegion[];
  setLassoActive: Dispatch<SetStateAction<boolean>>;
  setLassoMode: Dispatch<SetStateAction<LassoMode>>;
  pushRegion: (region: LassoRegion) => void;
  clearStack: () => void;
  removeRegion: (id: string) => void;
  /** Toggle lasso on/off. If `mode` is provided, switching between modes
   * while active keeps the stack; clicking the same mode while active
   * deactivates AND wipes the stack. Omitting `mode` is a plain on/off
   * toggle that preserves whatever mode is currently selected. */
  toggleLasso: (mode?: LassoMode) => void;
}

export function useLassoStack(): UseLassoStackReturn {
  const [lassoActive, setLassoActive] = useState(false);
  const [lassoMode, setLassoMode] = useState<LassoMode>("freehand");
  const [regions, setRegions] = useState<LassoRegion[]>([]);

  // Ref mirror so toggleLasso can read the latest mode without rebinding
  // every time mode changes.
  const lassoModeRef = useRef<LassoMode>(lassoMode);
  lassoModeRef.current = lassoMode;

  const pushRegion = useCallback((region: LassoRegion) => {
    setRegions((prev) => [...prev, region]);
  }, []);

  const clearStack = useCallback(() => {
    setRegions([]);
  }, []);

  const removeRegion = useCallback((id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const toggleLasso = useCallback((mode?: LassoMode) => {
    setLassoActive((prev) => {
      if (mode === undefined) {
        // Simple toggle — preserve current mode.
        if (prev) setRegions([]);
        return !prev;
      }
      const currentMode = lassoModeRef.current;
      if (prev && currentMode === mode) {
        // Same mode clicked while active → deactivate and wipe stack.
        setRegions([]);
        return false;
      }
      // Switching modes while active keeps the stack so the user can
      // mix freehand and rect captures into one batch. Also covers the
      // "activate in a specific mode" case.
      setLassoMode(mode);
      return true;
    });
  }, []);

  return {
    lassoActive,
    lassoMode,
    regions,
    setLassoActive,
    setLassoMode,
    pushRegion,
    clearStack,
    removeRegion,
    toggleLasso,
  };
}
