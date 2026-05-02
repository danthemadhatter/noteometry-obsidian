import React from "react";
import type { LassoBounds } from "./LassoOverlay";

export type AiOverlayPhase = "pending" | "read" | "error";

interface Props {
  /** Screen-space rectangles to frame. Snapshot taken from the lasso
   *  bounds at the moment the AI call started; the rects stay where
   *  they were even if the user pans during the wait. */
  bounds: LassoBounds[];
  /** v1.8.4: state of the AI cycle. "pending" → BRIDGES-style frame
   *  with corner brackets + a READING… tracked-uppercase label tucked
   *  at the top-right of each rect. "read" → flashes a SOLVED-style
   *  type card briefly before bounds is cleared. "error" → CARGO-
   *  orange ERROR callout. Defaults to "pending" so existing callers
   *  that don't pass it still work. */
  phase?: AiOverlayPhase;
}

/**
 * v1.7.5 in-canvas AI loading state, rebuilt in v1.8.4 with the
 * Death Stranding aesthetic: hairline 1px frame, corner brackets,
 * tracked-uppercase type-card label. Pointer-events disabled so it
 * doesn't intercept taps on the underlying ink. Self-contained:
 * parent mounts/unmounts based on whether an AI call is in flight.
 */
export default function AiPendingOverlay({ bounds, phase = "pending" }: Props) {
  if (bounds.length === 0) return null;
  const labelText = phase === "pending" ? "READING…" : phase === "read" ? "SOLVED" : "ERROR";
  return (
    <>
      {bounds.map((b, i) => {
        const w = Math.max(0, b.maxX - b.minX);
        const h = Math.max(0, b.maxY - b.minY);
        return (
          <div
            key={i}
            className={`noteometry-ai-frame noteometry-ai-frame--${phase}`}
            style={{
              position: "absolute",
              left: b.minX,
              top: b.minY,
              width: w,
              height: h,
              pointerEvents: "none",
            }}
          >
            {/* Four corner brackets — the Bridges 'tactical-readout'
                marker. Pure CSS via box-shadows on tiny absolute divs
                so the brackets scale with the frame's actual edges. */}
            <span className="noteometry-ai-bracket noteometry-ai-bracket--tl" />
            <span className="noteometry-ai-bracket noteometry-ai-bracket--tr" />
            <span className="noteometry-ai-bracket noteometry-ai-bracket--bl" />
            <span className="noteometry-ai-bracket noteometry-ai-bracket--br" />

            {/* Type-card label, tucked top-right of the frame. */}
            <span className={`noteometry-ai-label noteometry-ai-label--${phase}`}>
              {labelText}
            </span>
          </div>
        );
      })}
    </>
  );
}
