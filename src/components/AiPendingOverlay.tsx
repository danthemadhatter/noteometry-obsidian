import React from "react";
import type { LassoBounds } from "./LassoOverlay";

interface Props {
  /** Screen-space rectangles to pulse. Snapshot taken from the lasso
   *  bounds at the moment the AI call started; the rects stay where
   *  they were even if the user pans during the wait. */
  bounds: LassoBounds[];
}

/**
 * v1.7.5 in-canvas AI loading state. Renders a dashed pulsing
 * rectangle at each given bounds. Pointer-events disabled so it
 * doesn't intercept taps on the underlying ink. Self-contained: parent
 * mounts/unmounts based on whether an AI call is in flight.
 */
export default function AiPendingOverlay({ bounds }: Props) {
  if (bounds.length === 0) return null;
  return (
    <>
      {bounds.map((b, i) => (
        <div
          key={i}
          className="noteometry-ai-pending-rect"
          style={{
            position: "absolute",
            left: b.minX,
            top: b.minY,
            width: Math.max(0, b.maxX - b.minX),
            height: Math.max(0, b.maxY - b.minY),
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}
