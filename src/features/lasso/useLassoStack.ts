import { useState, useCallback, Dispatch, SetStateAction } from "react";
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

export interface LassoRegion {
  id: string;
  bounds: LassoBounds;
  /** Base64 PNG data URL, rasterized at the moment this region was drawn. */
  capturedImage: string;
}

export interface UseLassoStackReturn {
  lassoActive: boolean;
  regions: LassoRegion[];
  setLassoActive: Dispatch<SetStateAction<boolean>>;
  pushRegion: (region: LassoRegion) => void;
  clearStack: () => void;
  removeRegion: (id: string) => void;
  toggleLasso: () => void;
}

export function useLassoStack(): UseLassoStackReturn {
  const [lassoActive, setLassoActive] = useState(false);
  const [regions, setRegions] = useState<LassoRegion[]>([]);

  const pushRegion = useCallback((region: LassoRegion) => {
    setRegions((prev) => [...prev, region]);
  }, []);

  const clearStack = useCallback(() => {
    setRegions([]);
  }, []);

  const removeRegion = useCallback((id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const toggleLasso = useCallback(() => {
    setLassoActive((prev) => {
      // Deactivating lasso mode also wipes any pending stack — the user
      // either processed it or abandoned it.
      if (prev) setRegions([]);
      return !prev;
    });
  }, []);

  return {
    lassoActive,
    regions,
    setLassoActive,
    pushRegion,
    clearStack,
    removeRegion,
    toggleLasso,
  };
}
