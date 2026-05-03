/**
 * AIActivityRibbon — v1.11.0 phase-2 sub-PR 2.1.
 *
 * 1px ribbon along the bottom edge that pulses while any AI call is
 * in flight. Per design doc §4 cue 5:
 *
 *   "Bottom edge. 1px. Pulses gently while any AI call is in flight,
 *    static when nothing's running. The user always knows whether
 *    the system is 'thinking' without needing a spinner inside any
 *    drop-in. Replaces every per-drop-in loading state."
 *
 * Subscribes to AIActivityContext (phase 0). When `count > 0`, the
 * ribbon animates a 2-second pulse cycle. When count drops to zero
 * the ribbon goes idle (transparent) over a 200ms fade — calm exit,
 * no popping.
 *
 * Hidden during freeze: the freeze treatment in phase 3 will surface
 * its own [N AI calls interrupted] tail in chat dropins, so the
 * ribbon would be redundant. Also, soft-aborted calls finish over
 * the wire AFTER freeze — the ribbon would keep ticking past the
 * pause, which would feel broken.
 */

import React from "react";
import { useAIActivity } from "../../features/aiActivity";
import { useLayerManager } from "../../features/layerManager";

export function AIActivityRibbon(): React.ReactElement {
  const { isActive } = useAIActivity();
  const { layer } = useLayerManager();
  const hidden = layer === "frozen";

  return (
    <div
      className={`noteometry-ai-ribbon${
        isActive && !hidden ? " noteometry-ai-ribbon-active" : ""
      }${hidden ? " noteometry-ai-ribbon-hidden" : ""}`}
      aria-hidden="true"
    />
  );
}
