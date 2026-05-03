/**
 * SaveDot — v1.11.0 phase-2 sub-PR 2.1.
 *
 * Tiny dot ambient cue for save state. Per design doc §4 cue 4:
 *
 *   "Bottom-right corner. 4px circle. Filled = dirty unsaved changes,
 *    hollow = clean. ≤2s after last edit it flips dirty→clean. The
 *    only signal of save state in the app — replaces every 'Save'
 *    button and every save-status toast we've ever shown."
 *
 * The dot subscribes to LayerManager.dirty. NoteometryApp wires its
 * existing autosave path to call store.setDirty(true) on edits and
 * store.setDirty(false) when saveNow finishes.
 *
 * Hidden during freeze (the PAUSED treatment in phase 3 owns the
 * full-canvas read; we don't want the dot competing for attention).
 */

import React from "react";
import { useLayerManager } from "../../features/layerManager";

export function SaveDot(): React.ReactElement {
  const { dirty, layer } = useLayerManager();
  const hidden = layer === "frozen";

  return (
    <div
      className={`noteometry-save-dot${dirty ? " noteometry-save-dot-dirty" : ""}${
        hidden ? " noteometry-save-dot-hidden" : ""
      }`}
      aria-hidden="true"
      title={dirty ? "Unsaved changes" : "Saved"}
    />
  );
}
