/**
 * EdgeGlow — v1.11.0 phase-2 sub-PR 2.1.
 *
 * 1px peripheral glow on the edge of every summonable layer. Per
 * design doc §4 cue 1:
 *
 *   "1px line at 8% opacity when the [tool|meta] layer is available
 *    (= always). Color: matches active accent. Invisible at gaze,
 *    visible at peripheral glance."
 *
 * Two instances render at app root:
 *   - <EdgeGlow side="top" />  — for ToolLayer (3F swipe down)
 *   - <EdgeGlow side="left" /> — for MetaLayer (3F swipe right)
 *
 * The glow is purely decorative — no event handlers, no React state
 * beyond the LayerManager subscription. It HIDES when its
 * corresponding layer is currently summoned (the strip itself
 * provides the signal at that point) and during freeze (no chrome
 * teaser when frozen).
 *
 * Cost: <1ms paint, no JS work past mount.
 */

import React from "react";
import { useLayerManager } from "../../features/layerManager";

export interface EdgeGlowProps {
  side: "top" | "left";
}

export function EdgeGlow({ side }: EdgeGlowProps): React.ReactElement {
  const { layer } = useLayerManager();

  // Hide the glow whose layer is currently summoned (the strip itself
  // is louder than 1px) and during freeze (calm-tech: don't tease
  // chrome when the user is paused).
  const hidden =
    layer === "frozen" ||
    (side === "top" && layer === "tool") ||
    (side === "left" && layer === "meta");

  return (
    <div
      className={`noteometry-edge-glow noteometry-edge-glow-${side}${
        hidden ? " noteometry-edge-glow-hidden" : ""
      }`}
      aria-hidden="true"
    />
  );
}
