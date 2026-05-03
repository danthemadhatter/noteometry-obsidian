/**
 * MetaLayer — v1.11.0 phase-1 sub-PR 1.4 (shell).
 *
 * The Meta Layer (z=−1) is summoned by 3-finger swipe right. In this
 * shell PR it has no real content yet — just the strip emerging from
 * the left edge. Settings, file tree, recent pages move in during
 * phase 5 (design doc §5 step 5).
 *
 * Visual contract per design doc §3:
 *   - Strip emerges from the LEFT edge
 *   - 200ms reveal
 *   - Canvas slides forward + shrinks to 60% (handled in CSS — for
 *     this shell we just dim the paper layer)
 *
 * Dismiss paths:
 *   - 3-finger swipe left (wired here via LayerManager)
 *   - Tap canvas (phase 2)
 */

import React from "react";
import { useLayerManager } from "../../features/layerManager";

export interface MetaLayerProps {
  children?: React.ReactNode;
}

export function MetaLayer({ children }: MetaLayerProps): React.ReactElement {
  const { layer } = useLayerManager();
  const visible = layer === "meta";

  return (
    <div
      className={`noteometry-meta-layer${visible ? " noteometry-meta-layer-visible" : ""}`}
      aria-hidden={!visible}
      role="region"
      aria-label="Meta layer"
      style={{
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {children ?? (
        <div className="noteometry-meta-layer-placeholder">
          <span className="noteometry-meta-layer-emblem">▤</span>
          <span className="noteometry-meta-layer-label">
            Meta layer (shell — content arrives in v1.11 phase 5)
          </span>
        </div>
      )}
    </div>
  );
}
