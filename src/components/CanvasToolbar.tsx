import React, { useState } from "react";
import {
  IconSelect, IconPen, IconEraser, IconHand, IconLasso,
  IconType, IconTable, IconImage, IconUndo, IconRedo,
  IconLine, IconArrow, IconRect, IconCircle,
  IconDownload, IconTrash, IconSliders,
} from "./Icons";
import type { CanvasTool } from "./InkCanvas";

// Stencil palette — bright colors legible on the blueprint-cyan canvas.
// Pre-Phase-4 the defaults were near-black on near-white, which inverts
// completely on the v3 palette (dark canvas). These are the replacements.
const INK_COLORS = [
  { color: "#eae6d5", label: "Chalk" },
  { color: "#ffb000", label: "Amber" },
  { color: "#ff5555", label: "Signal Red" },
  { color: "#7ec84a", label: "Phosphor Green" },
  { color: "#6fc0ff", label: "Sky Blue" },
  { color: "#d47fff", label: "Magenta" },
];

const STROKE_WIDTHS = [
  { width: 1.5, label: "Fine" },
  { width: 3, label: "Medium" },
  { width: 5, label: "Thick" },
  { width: 8, label: "Marker" },
];

const SHAPE_TOOLS: { tool: CanvasTool; icon: React.FC; label: string }[] = [
  { tool: "line", icon: IconLine, label: "Line" },
  { tool: "arrow", icon: IconArrow, label: "Arrow" },
  { tool: "rect", icon: IconRect, label: "Rectangle" },
  { tool: "circle", icon: IconCircle, label: "Circle" },
];

interface Props {
  tool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  lassoActive: boolean;
  onLassoToggle: () => void;
  activeColor: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (w: number) => void;
  onInsertTextBox: () => void;
  onInsertTable: () => void;
  onInsertImage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClearCanvas: () => void;
  onExportImage: () => void;
}

function Btn({ active, disabled, onClick, title, children }: {
  active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      className={`noteometry-toolbar-btn ${active ? "active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

export default function CanvasToolbar({
  tool, onToolChange,
  lassoActive, onLassoToggle,
  activeColor, onColorChange,
  strokeWidth, onStrokeWidthChange,
  onInsertTextBox, onInsertTable, onInsertImage,
  onUndo, onRedo, canUndo, canRedo,
  onClearCanvas, onExportImage,
}: Props) {
  const [popup, setPopup] = useState<"" | "shapes" | "widths" | "insert" | "more">("");
  const toggle = (p: typeof popup) => setPopup(popup === p ? "" : p);
  const isShape = ["line", "arrow", "rect", "circle"].includes(tool);

  // Get current shape icon for the button
  const ShapeIcon = SHAPE_TOOLS.find(s => s.tool === tool)?.icon ?? IconLine;

  return (
    <div className="noteometry-canvas-toolbar">
      {/* ── Core drawing tools ── */}
      <div className="noteometry-toolbar-group">
        <Btn active={tool === "pen" && !lassoActive} onClick={() => onToolChange("pen")} title="Pen">
          <IconPen />
        </Btn>
        <Btn active={tool === "eraser"} onClick={() => onToolChange("eraser")} title="Eraser">
          <IconEraser />
        </Btn>
        <Btn active={tool === "grab" && !lassoActive} onClick={() => onToolChange("grab")} title="Pan">
          <IconHand />
        </Btn>
        <Btn active={tool === "select" && !lassoActive} onClick={() => onToolChange("select")} title="Select">
          <IconSelect />
        </Btn>
      </div>

      {/* ── Shapes (popup) ── */}
      <div className="noteometry-toolbar-group" style={{ position: "relative" }}>
        <Btn active={isShape} onClick={() => toggle("shapes")} title="Shapes">
          <ShapeIcon />
        </Btn>
        {popup === "shapes" && (
          <div className="noteometry-toolbar-popup">
            {SHAPE_TOOLS.map((s) => (
              <Btn key={s.tool} active={tool === s.tool} onClick={() => { onToolChange(s.tool); setPopup(""); }} title={s.label}>
                <s.icon />
              </Btn>
            ))}
          </div>
        )}
      </div>

      {/* ── Undo / Redo (always visible) ── */}
      <div className="noteometry-toolbar-group">
        <Btn onClick={onUndo} disabled={!canUndo} title="Undo">
          <IconUndo />
        </Btn>
        <Btn onClick={onRedo} disabled={!canRedo} title="Redo">
          <IconRedo />
        </Btn>
      </div>

      {/* ── Lasso ── */}
      <div className="noteometry-toolbar-group">
        <Btn active={lassoActive} onClick={onLassoToggle} title="Lasso select">
          <IconLasso />
        </Btn>
      </div>

      {/* ── Colors ── */}
      <div className="noteometry-toolbar-group noteometry-toolbar-colors">
        {INK_COLORS.map((c) => (
          <button
            key={c.color}
            className={`noteometry-color-dot ${activeColor === c.color ? "active" : ""}`}
            style={{ background: c.color }}
            onClick={() => onColorChange(c.color)}
            title={c.label}
          />
        ))}
      </div>

      {/* ── Width picker (popup) ── */}
      <div className="noteometry-toolbar-group" style={{ position: "relative" }}>
        <Btn onClick={() => toggle("widths")} title="Stroke width" active={popup === "widths"}>
          <IconSliders />
        </Btn>
        {popup === "widths" && (
          <div className="noteometry-toolbar-popup">
            {STROKE_WIDTHS.map((sw) => (
              <button
                key={sw.width}
                className={`noteometry-width-option ${strokeWidth === sw.width ? "active" : ""}`}
                onClick={() => { onStrokeWidthChange(sw.width); setPopup(""); }}
                title={sw.label}
              >
                <span
                  className="noteometry-width-preview"
                  style={{ height: sw.width, width: 20, background: activeColor, borderRadius: sw.width }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Insert (direct buttons) ── */}
      <div className="noteometry-toolbar-group">
        <Btn onClick={onInsertTextBox} title="Text box">
          <IconType />
        </Btn>
        <Btn onClick={onInsertTable} title="Table">
          <IconTable />
        </Btn>
        <Btn onClick={onInsertImage} title="Image">
          <IconImage />
        </Btn>
      </div>

      {/* ── More actions (popup) ── */}
      <div className="noteometry-toolbar-group" style={{ position: "relative" }}>
        <Btn onClick={() => toggle("more")} title="More" active={popup === "more"}>
          <IconDownload />
        </Btn>
        {popup === "more" && (
          <div className="noteometry-toolbar-popup">
            <Btn onClick={() => { onExportImage(); setPopup(""); }} title="Export PNG"><IconDownload /></Btn>
            <Btn onClick={() => { onClearCanvas(); setPopup(""); }} title="Clear canvas"><IconTrash /></Btn>
          </div>
        )}
      </div>
    </div>
  );
}
