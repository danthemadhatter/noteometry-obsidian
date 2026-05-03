/**
 * ToolLayer — v1.11.0 phase-1 sub-PR 1.4 (shell).
 *
 * The Tool Layer (z=+1) is summoned by 3-finger swipe down. In this
 * shell PR it has no real content yet — just the translucent strip
 * across the top edge so we can verify the gesture wires through and
 * the animation feels right. The actual toolbar buttons (pen / eraser
 * / lasso / colors / weights / math palette) move in during phase 5
 * migration; per design doc §5 step 4.
 *
 * Visual contract per design doc §3:
 *   - Translucent strip across the TOP edge
 *   - 150ms slide-down animation
 *   - Canvas dims to 70% behind it (handled in CSS via
 *     `.noteometry-paper-dimmed` applied to the paper layer)
 *
 * Dismiss paths (only the gesture-driven dismiss is wired here; the
 * "tap dimmed canvas" and "2-second idle" dismisses arrive in phase
 * 2/3):
 *   - 3-finger swipe up
 *   - Same gesture inverted, handled by useLayerGestures
 */

import React from "react";
import { useLayerManager } from "../../features/layerManager";

export interface ToolLayerProps {
  /** Optional content to render inside the layer. Phase 5 will wire
   *  the toolbar in here. Until then we render a placeholder. */
  children?: React.ReactNode;
}

export function ToolLayer({ children }: ToolLayerProps): React.ReactElement {
  const { layer } = useLayerManager();
  const visible = layer === "tool";

  return (
    <div
      className={`noteometry-tool-layer${visible ? " noteometry-tool-layer-visible" : ""}`}
      aria-hidden={!visible}
      role="region"
      aria-label="Tool layer"
      // pointer-events on the layer itself follow visibility — when
      // hidden the strip is fully off-screen but we belt-and-suspenders
      // with pointer-events: none so accidental taps don't summon.
      style={{
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {children ?? (
        <div className="noteometry-tool-layer-placeholder">
          {/* Phase 5 wires the actual toolbar in here. Until then this
              placeholder lets us verify the gesture path mounts the
              shell and dismiss returns to paper. */}
          <span className="noteometry-tool-layer-emblem">☰</span>
          <span className="noteometry-tool-layer-label">
            Tool layer (shell — content arrives in v1.11 phase 5)
          </span>
        </div>
      )}
    </div>
  );
}
