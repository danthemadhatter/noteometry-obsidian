import React, { useState } from "react";
import {
  IconSelect, IconPen, IconEraser, IconHand, IconLasso, IconScan,
  IconType, IconTable, IconImage, IconUndo, IconRedo,
  IconLine, IconArrow, IconRect, IconCircle,
  IconDownload, IconTrash, IconPenLine,
} from "./Icons";
import type { CanvasTool } from "./InkCanvas";

const INK_COLORS = [
  { color: "#1e1e1e", label: "Black" },
  { color: "#e03131", label: "Red" },
  { color: "#2f9e44", label: "Green" },
  { color: "#1971c2", label: "Blue" },
  { color: "#f08c00", label: "Orange" },
  { color: "#7950f2", label: "Purple" },
];

const STROKE_WIDTHS = [
  { width: 1.5, label: "Fine" },
  { width: 3, label: "Medium" },
  { width: 5, label: "Thick" },
  { width: 8, label: "Marker" },
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
  onReadInk: () => void;
  isReading: boolean;
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
  onReadInk, isReading,
  onClearCanvas, onExportImage,
}: Props) {
  const [showWidths, setShowWidths] = useState(false);

  return (
    <div className="noteometry-canvas-toolbar">
      {/* ── Core tools ── */}
      <div className="noteometry-toolbar-group">
        <Btn active={tool === "select" && !lassoActive} onClick={() => onToolChange("select")} title="Select">
          <IconSelect />
        </Btn>
        <Btn active={tool === "pen" && !lassoActive} onClick={() => onToolChange("pen")} title="Pen">
          <IconPen />
        </Btn>
        <Btn active={tool === "eraser"} onClick={() => onToolChange("eraser")} title="Eraser">
          <IconEraser />
        </Btn>
        <Btn active={tool === "grab" && !lassoActive} onClick={() => onToolChange("grab")} title="Pan">
          <IconHand />
        </Btn>
      </div>

      {/* ── Shape tools ── */}
      <div className="noteometry-toolbar-group">
        <Btn active={tool === "line"} onClick={() => onToolChange("line")} title="Straight line">
          <IconLine />
        </Btn>
        <Btn active={tool === "arrow"} onClick={() => onToolChange("arrow")} title="Arrow">
          <IconArrow />
        </Btn>
        <Btn active={tool === "rect"} onClick={() => onToolChange("rect")} title="Rectangle">
          <IconRect />
        </Btn>
        <Btn active={tool === "circle"} onClick={() => onToolChange("circle")} title="Circle">
          <IconCircle />
        </Btn>
      </div>

      {/* ── Lasso + OCR ── */}
      <div className="noteometry-toolbar-group">
        <Btn active={lassoActive} onClick={onLassoToggle} title="Lasso select">
          <IconLasso />
        </Btn>
        <button
          className={`noteometry-toolbar-btn noteometry-toolbar-readink ${isReading ? "reading" : ""}`}
          onClick={onReadInk}
          disabled={isReading}
          title="Read lassoed ink"
        >
          <IconScan />
          <span className="noteometry-toolbar-label">{isReading ? "..." : "OCR"}</span>
        </button>
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

      {/* ── Stroke width ── */}
      <div className="noteometry-toolbar-group" style={{ position: "relative" }}>
        <Btn onClick={() => setShowWidths(!showWidths)} title="Stroke width" active={showWidths}>
          <IconPenLine />
        </Btn>
        {showWidths && (
          <div className="noteometry-width-picker">
            {STROKE_WIDTHS.map((sw) => (
              <button
                key={sw.width}
                className={`noteometry-width-option ${strokeWidth === sw.width ? "active" : ""}`}
                onClick={() => { onStrokeWidthChange(sw.width); setShowWidths(false); }}
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

      {/* ── Insert objects ── */}
      <div className="noteometry-toolbar-group">
        <Btn onClick={onInsertTextBox} title="Text box">
          <IconType />
        </Btn>
        <Btn onClick={onInsertTable} title="Table">
          <IconTable />
        </Btn>
        <Btn onClick={onInsertImage} title="Photo / Camera">
          <IconImage />
        </Btn>
      </div>

      {/* ── Undo / Redo / Actions ── */}
      <div className="noteometry-toolbar-group">
        <Btn onClick={onUndo} disabled={!canUndo} title="Undo">
          <IconUndo />
        </Btn>
        <Btn onClick={onRedo} disabled={!canRedo} title="Redo">
          <IconRedo />
        </Btn>
        <Btn onClick={onExportImage} title="Export as image">
          <IconDownload />
        </Btn>
        <Btn onClick={onClearCanvas} title="Clear canvas">
          <IconTrash />
        </Btn>
      </div>
    </div>
  );
}
