import React from "react";
import { MousePointer2, Pen, Eraser, Lasso, Type, Table, Undo2, Redo2, Image, ScanText } from "lucide-react";
import type { CanvasTool } from "./InkCanvas";

const INK_COLORS = [
  { color: "#1e1e1e", label: "K" },
  { color: "#e03131", label: "R" },
  { color: "#2f9e44", label: "G" },
  { color: "#1971c2", label: "B" },
];

interface Props {
  tool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  lassoActive: boolean;
  onLassoToggle: () => void;
  activeColor: string;
  onColorChange: (color: string) => void;
  onInsertTextBox: () => void;
  onInsertTable: () => void;
  onInsertImage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onReadInk: () => void;
  isReading: boolean;
}

export default function CanvasToolbar({
  tool, onToolChange,
  lassoActive, onLassoToggle,
  activeColor, onColorChange,
  onInsertTextBox, onInsertTable, onInsertImage,
  onUndo, onRedo, canUndo, canRedo,
  onReadInk, isReading,
}: Props) {
  return (
    <div className="noteometry-canvas-toolbar">
      {/* Tools */}
      <button
        className={`noteometry-toolbar-btn ${tool === "select" && !lassoActive ? "active" : ""}`}
        onClick={() => onToolChange("select")}
        title="Select / Move"
      >
        <MousePointer2 size={16} />
      </button>
      <button
        className={`noteometry-toolbar-btn ${tool === "pen" && !lassoActive ? "active" : ""}`}
        onClick={() => { onToolChange("pen"); }}
        title="Pen"
      >
        <Pen size={16} />
      </button>
      <button
        className={`noteometry-toolbar-btn ${tool === "eraser" ? "active" : ""}`}
        onClick={() => onToolChange("eraser")}
        title="Eraser"
      >
        <Eraser size={16} />
      </button>

      <div className="noteometry-toolbar-sep" />

      {/* Lasso + READ INK */}
      <button
        className={`noteometry-toolbar-btn ${lassoActive ? "active" : ""}`}
        onClick={onLassoToggle}
        title="Lasso select"
      >
        <Lasso size={16} />
      </button>
      <button
        className={`noteometry-toolbar-btn noteometry-toolbar-readink ${isReading ? "reading" : ""}`}
        onClick={onReadInk}
        disabled={isReading}
        title="Read lassoed ink"
      >
        <ScanText size={16} />
        <span className="noteometry-toolbar-label">{isReading ? "..." : "OCR"}</span>
      </button>

      <div className="noteometry-toolbar-sep" />

      {/* Color dots */}
      {INK_COLORS.map((c) => (
        <button
          key={c.color}
          className={`noteometry-color-dot ${activeColor === c.color ? "active" : ""}`}
          style={{ background: c.color }}
          onClick={() => onColorChange(c.color)}
          title={`${c.label} ink`}
        />
      ))}

      <div className="noteometry-toolbar-sep" />

      {/* Insert tools */}
      <button
        className="noteometry-toolbar-btn"
        onClick={onInsertTextBox}
        title="Insert text box"
      >
        <Type size={16} />
      </button>
      <button
        className="noteometry-toolbar-btn"
        onClick={onInsertTable}
        title="Insert table"
      >
        <Table size={16} />
      </button>
      <button
        className="noteometry-toolbar-btn"
        onClick={onInsertImage}
        title="Insert image"
      >
        <Image size={16} />
      </button>

      <div className="noteometry-toolbar-sep" />

      {/* Undo/Redo */}
      <button
        className="noteometry-toolbar-btn"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Cmd+Z)"
      >
        <Undo2 size={16} />
      </button>
      <button
        className="noteometry-toolbar-btn"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Cmd+Shift+Z)"
      >
        <Redo2 size={16} />
      </button>
    </div>
  );
}
