import React, { useState, useRef, useEffect, useCallback } from "react";
import type { CanvasTool } from "./InkCanvas";

interface Props {
  tool: CanvasTool;
  lassoActive: boolean;
  lassoMode: "freehand" | "rect";
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: CanvasTool) => void;
  onToggleLasso: (mode: "freehand" | "rect") => void;
  onSetLassoActive: (active: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onInsertTextBox: () => void;
  onInsertTable: () => void;
  onInsertImage: () => void;
  onInsertPdf: () => void;
}

export default function MiniToolbar({
  tool, lassoActive, lassoMode, canUndo, canRedo,
  onToolChange, onToggleLasso, onSetLassoActive, onUndo, onRedo,
  onInsertTextBox, onInsertTable, onInsertImage, onInsertPdf,
}: Props) {
  const [insertOpen, setInsertOpen] = useState(false);
  const insertRef = useRef<HTMLDivElement>(null);

  // Close insert popout on outside click
  useEffect(() => {
    if (!insertOpen) return;
    const handler = (e: PointerEvent) => {
      if (insertRef.current && !insertRef.current.contains(e.target as Node)) {
        setInsertOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [insertOpen]);

  const isActive = (t: CanvasTool) => tool === t && !lassoActive;
  const isLassoFreehand = lassoActive && lassoMode === "freehand";
  const isLassoRect = lassoActive && lassoMode === "rect";

  const selectTool = useCallback((t: CanvasTool) => {
    onSetLassoActive(false);
    onToolChange(t);
  }, [onToolChange, onSetLassoActive]);

  return (
    <div className="nm-mini-toolbar">
      {/* Pen */}
      <button
        className={`nm-mt-btn ${isActive("pen") ? "nm-mt-active" : ""}`}
        onClick={() => selectTool("pen")}
        title="Pen"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
        </svg>
      </button>

      {/* Eraser */}
      <button
        className={`nm-mt-btn ${isActive("eraser") ? "nm-mt-active" : ""}`}
        onClick={() => selectTool("eraser")}
        title="Eraser"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
          <path d="M22 21H7"/><path d="m5 11 9 9"/>
        </svg>
      </button>

      {/* Freehand Lasso */}
      <button
        className={`nm-mt-btn ${isLassoFreehand ? "nm-mt-active" : ""}`}
        onClick={() => {
          if (!lassoActive) onToolChange("pen");
          onToggleLasso("freehand");
        }}
        title="Freehand Lasso"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 22a5 5 0 0 1-2-4"/><path d="M7 16.93c.96.43 1.96.74 2.99.91"/>
          <path d="M3.34 14A6.8 6.8 0 0 1 2 10c0-4.42 4.48-8 10-8s10 3.58 10 8-4.48 8-10 8a12 12 0 0 1-3.34-.46"/>
          <path d="M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
        </svg>
      </button>

      {/* Rectangle Lasso */}
      <button
        className={`nm-mt-btn ${isLassoRect ? "nm-mt-active" : ""}`}
        onClick={() => {
          if (!lassoActive) onToolChange("pen");
          onToggleLasso("rect");
        }}
        title="Rectangle Lasso"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="14" height="14" rx="1" strokeDasharray="3 2"/><circle cx="19" cy="19" r="2"/>
        </svg>
      </button>

      {/* Pan/Move */}
      <button
        className={`nm-mt-btn ${isActive("grab") ? "nm-mt-active" : ""}`}
        onClick={() => selectTool("grab")}
        title="Pan / Move"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/>
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
        </svg>
      </button>

      {/* Insert — popout */}
      <div ref={insertRef} className="nm-mt-insert-wrap">
        <button
          className={`nm-mt-btn ${insertOpen ? "nm-mt-active" : ""}`}
          onClick={() => setInsertOpen((v) => !v)}
          title="Insert"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>
          </svg>
        </button>
        {insertOpen && (
          <div className="nm-mt-insert-popout">
            <button className="nm-mt-popout-btn" onClick={() => { onInsertTextBox(); setInsertOpen(false); }}>Text Box</button>
            <button className="nm-mt-popout-btn" onClick={() => { onInsertTable(); setInsertOpen(false); }}>Table</button>
            <button className="nm-mt-popout-btn" onClick={() => { onInsertImage(); setInsertOpen(false); }}>Image</button>
            <button className="nm-mt-popout-btn" onClick={() => { onInsertPdf(); setInsertOpen(false); }}>PDF</button>
          </div>
        )}
      </div>

      {/* Undo */}
      <button
        className="nm-mt-btn"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
        </svg>
      </button>

      {/* Redo */}
      <button
        className="nm-mt-btn"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
        </svg>
      </button>
    </div>
  );
}
