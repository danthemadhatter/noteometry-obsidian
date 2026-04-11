import { useState, useCallback, Dispatch, SetStateAction } from "react";
import type { CanvasObject } from "../../lib/canvasObjects";

/**
 * Canvas objects feature hook. Owns the list of non-ink elements on the
 * canvas (text boxes, tables, images, and future types like PDFs) plus the
 * currently-selected object id.
 *
 * Phase 1 version: thin wrapper around useState. The abstraction exists so
 * that Phase 2's v3 page schema (single `elements` tagged-union array) can
 * evolve this internal state without changing call sites in the composition
 * layer.
 *
 * Cross-cutting handlers (insert, paste, drop, lasso-move translation) stay
 * in NoteometryApp because they need access to scrollX/scrollY, the section
 * ref, and the plugin. They mutate state through setCanvasObjects.
 */
export interface UseObjectsReturn {
  canvasObjects: CanvasObject[];
  selectedObjectId: string | null;
  setCanvasObjects: Dispatch<SetStateAction<CanvasObject[]>>;
  setSelectedObjectId: Dispatch<SetStateAction<string | null>>;
  hydrate: (next: CanvasObject[]) => void;
}

export function useObjects(): UseObjectsReturn {
  const [canvasObjects, setCanvasObjects] = useState<CanvasObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const hydrate = useCallback((next: CanvasObject[]) => {
    setCanvasObjects(next);
    setSelectedObjectId(null);
  }, []);

  return {
    canvasObjects,
    selectedObjectId,
    setCanvasObjects,
    setSelectedObjectId,
    hydrate,
  };
}
