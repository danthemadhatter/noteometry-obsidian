import React from "react";
import { PenTool, Eraser, Lasso, Undo2, Redo2, Trash2, ScanText, Calculator, ImageUp, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { Tool } from "../types";

interface Props {
  activeTool: Tool;
  setTool: (t: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onReadInk: () => void;
  onSolve: () => void;
  onUploadImage: () => void;
  onTogglePanel: () => void;
  isReading: boolean;
  isSolving: boolean;
  hasInput: boolean;
  panelOpen: boolean;
}

export default function Toolbar({
  activeTool, setTool,
  onUndo, onRedo, onClear,
  onReadInk, onSolve, onUploadImage, onTogglePanel,
  isReading, isSolving, hasInput, panelOpen,
}: Props) {
  const toolBtn = (tool: Tool, Icon: typeof PenTool) => (
    <button
      className={`noteometry-tb-btn ${activeTool === tool ? "active" : ""}`}
      onClick={() => setTool(tool)}
      title={tool.charAt(0).toUpperCase() + tool.slice(1)}
    >
      <Icon size={18} />
    </button>
  );

  return (
    <div className="noteometry-floating-toolbar-wrap">
      <div className="noteometry-floating-toolbar">
        {toolBtn("pen", PenTool)}
        {toolBtn("eraser", Eraser)}
        {toolBtn("lasso", Lasso)}

        <div className="noteometry-tb-sep" />

        <button className="noteometry-tb-btn" onClick={onUndo} title="Undo"><Undo2 size={18} /></button>
        <button className="noteometry-tb-btn" onClick={onRedo} title="Redo"><Redo2 size={18} /></button>
        <button className="noteometry-tb-btn noteometry-tb-btn-danger" onClick={onClear} title="Clear"><Trash2 size={18} /></button>

        <div className="noteometry-tb-sep" />

        <button
          className="noteometry-tb-btn"
          onClick={onUploadImage}
          disabled={isReading}
          title="Upload image to scan"
        >
          <ImageUp size={18} />
        </button>

        <button
          className="noteometry-tb-action noteometry-tb-readink"
          onClick={onReadInk}
          disabled={isReading || isSolving}
        >
          <ScanText size={15} />
          {isReading ? "Reading\u2026" : "READ INK"}
        </button>

        <button
          className="noteometry-tb-action noteometry-tb-solve"
          onClick={onSolve}
          disabled={isSolving || isReading || !hasInput}
        >
          <Calculator size={15} />
          {isSolving ? "Solving\u2026" : "SOLVE"}
        </button>

        <div className="noteometry-tb-sep" />

        <button
          className="noteometry-tb-btn"
          onClick={onTogglePanel}
          title={panelOpen ? "Close panel" : "Open panel"}
        >
          {panelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
      </div>
    </div>
  );
}
