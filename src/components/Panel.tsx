import React, { useState, useRef, useCallback } from "react";
import { App } from "obsidian";
import MarkdownPreview from "./MarkdownPreview";
import MathPalette from "./MathPalette";

interface Props {
  inputCode: string;
  setInputCode: (v: string) => void;
  app: App;
  onInsertSymbol: (sym: string) => void;
}

function ensureMathDelimiters(text: string): string {
  const t = text.trim();
  if (!t) return t;
  if (t.includes("$")) return t;
  if (/\\[a-zA-Z]/.test(t) || /[_^{}]/.test(t)) {
    const lines = t.split("\n").map((line) => {
      const l = line.trim();
      if (!l) return "";
      if (l.includes("$")) return l;
      if (/\\[a-zA-Z]/.test(l) || /[_^{}]/.test(l)) return `$$${l}$$`;
      return l;
    });
    return lines.join("\n");
  }
  return t;
}

/* ── Resize handle ─────────────────────────────────────── */
function ResizeHandle({ onDrag }: { onDrag: (dy: number) => void }) {
  const dragging = useRef(false);
  const lastY = useRef(0);

  return (
    <div
      className="noteometry-resize-handle"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        lastY.current = e.clientY;
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const dy = e.clientY - lastY.current;
        lastY.current = e.clientY;
        onDrag(dy);
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        dragging.current = false;
      }}
    />
  );
}

export default function Panel({
  inputCode, setInputCode, app, onInsertSymbol,
}: Props) {
  const [heights, setHeights] = useState([35, 65]);

  const handleResize = useCallback((dy: number) => {
    setHeights((prev) => {
      const next = [...prev];
      const pct = (dy / 6);
      next[0] = Math.max(20, prev[0]! + pct);
      next[1] = Math.max(20, prev[1]! - pct);
      return next;
    });
  }, []);

  return (
    <div className="noteometry-panel">
      {/* Preview */}
      <div className="noteometry-panel-box" style={{ flex: heights[0] }}>
        <div className="noteometry-panel-box-hdr">
          <span>Preview</span>
        </div>
        <div className="noteometry-panel-box-content">
          {inputCode.trim()
            ? <MarkdownPreview content={ensureMathDelimiters(inputCode)} app={app} />
            : <div className="noteometry-placeholder">Write on the canvas, then lasso and READ INK</div>}
        </div>
      </div>

      <ResizeHandle onDrag={handleResize} />

      {/* Input editor + symbols */}
      <div className="noteometry-panel-box" style={{ flex: heights[1] }}>
        <div className="noteometry-panel-box-hdr">
          <span>Input</span>
          {inputCode && (
            <button className="noteometry-panel-clear" onClick={() => setInputCode("")}>
              Clear
            </button>
          )}
        </div>
        <textarea
          className="noteometry-panel-textarea"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          placeholder="Type or paste LaTeX, or use READ INK to scan handwriting..."
        />
        <MathPalette onInsert={onInsertSymbol} />
      </div>
    </div>
  );
}
