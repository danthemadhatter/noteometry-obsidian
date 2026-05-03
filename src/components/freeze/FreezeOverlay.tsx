/**
 * FreezeOverlay — v1.11.0 phase-3 sub-PR 3.1.
 *
 * Renders the freeze treatment when LayerManager.layer === "frozen":
 *   - Canvas is desaturated (filter) and dimmed to ~80% via class on
 *     the page-shell wrapper (handled by paperDimClass in
 *     NoteometryApp; this component's job is the badge + cursor +
 *     tap-to-resume layer).
 *   - Disabled-pointer cursor over the freeze layer.
 *   - Top-center badge: "PAUSED — TAP CANVAS TO RESUME"
 *   - Two badge buttons: [Brain dump] [Resume].
 *   - Tap canvas anywhere also resumes (locked Q2, design doc §3
 *     freeze row + §7 Q2).
 *
 * This component is the SHELL only:
 *   - `onBrainDump` is supplied by the caller; sub-PR 3.2 will wire it
 *     to spawn a ChatDropin pre-filled `[brain dump @ ${timestamp}]`.
 *     For 3.1, NoteometryApp passes a no-op (or a console log) so the
 *     freeze flow ships testably without ChatDropin coupling.
 *
 * Soft-abort of pending AI calls is handled inside LayerManager + the
 * AIActivityContext — not here. This is presentation only.
 *
 * Pure / testable: the visibility predicate `isFreezeOverlayVisible`
 * is exported so unit tests can exercise it without React.
 */

import React, { type ReactNode } from "react";

import {
  useLayerManager,
  type LayerState,
} from "../../features/layerManager";

/** Visible when (and only when) layer === "frozen". */
export function isFreezeOverlayVisible(layer: LayerState): boolean {
  return layer === "frozen";
}

/** Pre-filled brain-dump text per design doc §3 row 3 / §7 Q1 lock. */
export function buildBrainDumpSeed(now: Date = new Date()): string {
  // Plain text, not LaTeX. Cursor-focused after spawn (handled by caller).
  return `[brain dump @ ${now.toISOString()}]`;
}

export interface FreezeOverlayProps {
  /** Optional override for tests. Defaults to LayerManager via useLayerManager. */
  layer?: LayerState;
  /** Called when the user taps "Brain dump". Caller spawns ChatDropin. */
  onBrainDump?: (seed: string) => void;
  /** Called when the user taps "Resume" or anywhere on the canvas. */
  onResume?: () => void;
}

/**
 * Default-export component. Reads frozen state from context unless
 * `layer` prop overrides; default `onResume` calls `store.unfreeze`.
 */
export default function FreezeOverlay(props: FreezeOverlayProps): ReactNode {
  const ctx = useLayerManager();
  const layer = props.layer ?? ctx.layer;
  if (!isFreezeOverlayVisible(layer)) return null;

  const handleResume = (): void => {
    if (props.onResume) {
      props.onResume();
      return;
    }
    ctx.store.unfreeze();
  };

  const handleBrainDump = (): void => {
    const seed = buildBrainDumpSeed();
    props.onBrainDump?.(seed);
    // Per design doc §3: brain dump ALSO unfreezes (capture replaces
    // pause; the user wanted to write something down). The caller
    // spawns the dropin; we collapse the freeze overlay so the user
    // can type into it.
    ctx.store.unfreeze();
  };

  return (
    <div
      className="noteometry-freeze-overlay"
      // Tap anywhere on the overlay (i.e. canvas) → resume.
      onClick={handleResume}
      onTouchStart={handleResume}
      role="dialog"
      aria-modal="true"
      aria-label="Canvas paused"
    >
      <div
        className="noteometry-freeze-badge"
        // Stop the canvas-tap-resume from firing when interacting with the badge.
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="noteometry-freeze-badge-text">
          PAUSED — TAP CANVAS TO RESUME
        </div>
        <div className="noteometry-freeze-badge-actions">
          <button
            type="button"
            className="noteometry-freeze-btn noteometry-freeze-btn-braindump"
            onClick={handleBrainDump}
          >
            Brain dump
          </button>
          <button
            type="button"
            className="noteometry-freeze-btn noteometry-freeze-btn-resume"
            onClick={handleResume}
          >
            Resume
          </button>
        </div>
      </div>
    </div>
  );
}
