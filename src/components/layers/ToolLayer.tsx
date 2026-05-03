/**
 * ToolLayer — v1.11.0 phase-5 (toolbar migration).
 *
 * Replaces the phase-1 placeholder shell with the actual toolbar:
 * pen / eraser / select toggles, ink color swatches, stroke width
 * pips, and the math palette toggle. The right-click context menu
 * is unchanged (it stays the depressive slow path per design doc
 * §6b); this layer is the hypomanic fast path — one 3-finger swipe
 * down, tap, swipe up, gone.
 *
 * Contract:
 *   - Strip across the TOP edge, 150 ms slide-down (CSS).
 *   - Canvas dims to ~70% behind it (NoteometryApp's paperDimClass
 *     already applies `noteometry-paper-dim-tool`).
 *   - When hidden, `pointer-events: none` so accidental taps don't
 *     leak onto the strip.
 *
 * Why a thin presentational shell instead of importing NoteometryApp's
 * setters directly: the `children` escape hatch from phase 1 sub-PR
 * 1.4 is still there, but for v1.11.0 ship we render a default
 * toolbar that takes its state via props. NoteometryApp owns the
 * canonical state and threads only the bits the toolbar needs.
 *
 * Migration from old surface (design doc §5 step 20):
 *   - Old tools-FAB: gone (was already removed in v1.10).
 *   - Old math toolbar button: gone (was already removed in v1.10).
 *   - The right-click context menu still shows the same actions for
 *     the depressive slow path. They are intentional duplicates.
 */

import React from "react";
import { useLayerManager } from "../../features/layerManager";
import {
  INK_COLORS,
  STROKE_WIDTHS,
} from "../../features/ink/palettes";
import type { CanvasTool } from "../InkCanvas";

export interface ToolLayerToolbarProps {
  tool: CanvasTool;
  onToolChange: (t: CanvasTool) => void;
  activeColor: string;
  onColorChange: (c: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (w: number) => void;
  mathPaletteOpen: boolean;
  onToggleMathPalette: () => void;
  /** Optional: clear-canvas action so the depressive slow path is
   *  reachable via the layer too. NoteometryApp passes its bound
   *  buildClearCanvasAction handler. */
  onClearCanvas?: () => void;
}

export interface ToolLayerProps extends Partial<ToolLayerToolbarProps> {
  /** Optional override content. Phase 1 shell used this for the
   *  placeholder; phase 5 still honors it for tests. */
  children?: React.ReactNode;
}

/** Pure, testable predicate: should the layer be visible?
 *  Exported so unit tests don't need to mount React. */
export function isToolLayerVisible(layer: string): boolean {
  return layer === "tool";
}

interface ToolButtonProps {
  active: boolean;
  label: string;
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}

const ToolButton: React.FC<ToolButtonProps> = ({
  active,
  label,
  ariaLabel,
  onClick,
  children,
}) => (
  <button
    type="button"
    className={`nm-tool-btn${active ? " is-active" : ""}`}
    aria-label={ariaLabel}
    aria-pressed={active}
    title={label}
    onClick={onClick}
  >
    {children}
  </button>
);

export function ToolLayer({
  children,
  tool,
  onToolChange,
  activeColor,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  mathPaletteOpen,
  onToggleMathPalette,
  onClearCanvas,
}: ToolLayerProps): React.ReactElement {
  const { layer } = useLayerManager();
  const visible = isToolLayerVisible(layer);

  // If a custom child was supplied (test/legacy escape hatch) render
  // it verbatim. Otherwise render the canonical phase-5 toolbar — but
  // only when all required props were threaded through; if the host
  // forgot any, fall back to the shell label so we don't crash.
  const haveAllProps =
    typeof tool === "string" &&
    typeof onToolChange === "function" &&
    typeof activeColor === "string" &&
    typeof onColorChange === "function" &&
    typeof strokeWidth === "number" &&
    typeof onStrokeWidthChange === "function" &&
    typeof mathPaletteOpen === "boolean" &&
    typeof onToggleMathPalette === "function";

  return (
    <div
      className={`noteometry-tool-layer${visible ? " noteometry-tool-layer-visible" : ""}`}
      aria-hidden={!visible}
      role="region"
      aria-label="Tool layer"
      style={{
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {children ??
        (haveAllProps ? (
          <div className="nm-tool-toolbar" role="toolbar" aria-label="Drawing tools">
            {/* Tool selectors */}
            <div className="nm-tool-group" role="group" aria-label="Tools">
              <ToolButton
                active={tool === "pen"}
                label="Pen"
                ariaLabel="Pen tool"
                onClick={() => onToolChange!("pen")}
              >
                ✏️
              </ToolButton>
              <ToolButton
                active={tool === "eraser"}
                label="Eraser"
                ariaLabel="Eraser tool"
                onClick={() => onToolChange!("eraser")}
              >
                🧹
              </ToolButton>
              <ToolButton
                active={tool === "select"}
                label="Select"
                ariaLabel="Select / pointer tool"
                onClick={() => onToolChange!("select")}
              >
                👆
              </ToolButton>
            </div>

            {/* Color swatches */}
            <div className="nm-tool-group" role="group" aria-label="Ink color">
              {INK_COLORS.map((c) => (
                <button
                  key={c.color}
                  type="button"
                  className={`nm-tool-swatch${c.color === activeColor ? " is-active" : ""}`}
                  aria-label={`${c.label} ink`}
                  aria-pressed={c.color === activeColor}
                  title={c.label}
                  style={{ background: c.color }}
                  onClick={() => onColorChange!(c.color)}
                />
              ))}
            </div>

            {/* Stroke width pips */}
            <div className="nm-tool-group" role="group" aria-label="Stroke width">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w.width}
                  type="button"
                  className={`nm-tool-width${w.width === strokeWidth ? " is-active" : ""}`}
                  aria-label={`${w.label} stroke (${w.width} px)`}
                  aria-pressed={w.width === strokeWidth}
                  title={w.label}
                  onClick={() => onStrokeWidthChange!(w.width)}
                >
                  <span
                    className="nm-tool-width-pip"
                    style={{
                      width: `${Math.min(18, w.width * 2)}px`,
                      height: `${Math.min(18, w.width * 2)}px`,
                      background: activeColor,
                    }}
                  />
                </button>
              ))}
            </div>

            {/* Math palette toggle */}
            <div className="nm-tool-group" role="group" aria-label="Math">
              <ToolButton
                active={mathPaletteOpen}
                label="Math palette"
                ariaLabel="Toggle math palette"
                onClick={() => onToggleMathPalette!()}
              >
                🧮
              </ToolButton>
            </div>

            {onClearCanvas && (
              <div
                className="nm-tool-group nm-tool-group-end"
                role="group"
                aria-label="Canvas"
              >
                <button
                  type="button"
                  className="nm-tool-btn nm-tool-btn-warn"
                  aria-label="Clear canvas"
                  title="Clear canvas (also in right-click menu)"
                  onClick={onClearCanvas}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="noteometry-tool-layer-placeholder">
            <span className="noteometry-tool-layer-emblem">☰</span>
            <span className="noteometry-tool-layer-label">Tool layer</span>
          </div>
        ))}
    </div>
  );
}
