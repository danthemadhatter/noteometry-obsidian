import React, { useState, useRef, useCallback } from "react";
import { IconChevRight, IconEye, IconEdit3, IconPlay, IconTrash } from "./Icons";
import KaTeXRenderer from "./KaTeXRenderer";
import MathPalette from "./MathPalette";

interface Props {
  inputCode: string;
  setInputCode: (v: string) => void;
  onInsertSymbol: (sym: string) => void;
  onStampSymbol?: (sym: string) => void;
  onDropStamp?: (display: string, screenX: number, screenY: number) => void;
  onSolve: () => void;
  onClosePanel: () => void;
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
  inputCode, setInputCode, onInsertSymbol, onStampSymbol, onDropStamp, onSolve, onClosePanel,
}: Props) {
  const [heights, setHeights] = useState([30, 70]);

  const handleResize = useCallback((dy: number) => {
    setHeights((prev) => {
      const next = [...prev];
      const pct = (dy / 6);
      next[0] = Math.max(10, prev[0]! + pct);
      next[1] = Math.max(10, prev[1]! - pct);
      return next;
    });
  }, []);

  return (
    <div className="noteometry-panel">
      {/* Preview */}
      <div className="noteometry-panel-box" style={{ flex: heights[0] }}>
        <div className="noteometry-panel-box-hdr">
          <span className="noteometry-panel-box-title">
            <IconEye />
            <span>Preview</span>
          </span>
          <button
            className="noteometry-panel-action noteometry-panel-hide"
            onClick={onClosePanel}
            title="Hide panel"
          >
            <IconChevRight />
          </button>
        </div>
        <div className="noteometry-panel-box-content">
          {inputCode.trim()
            ? <KaTeXRenderer content={ensureMathDelimiters(inputCode)} />
            : <div className="noteometry-placeholder">Use toolbar lasso → OCR, or type below</div>}
        </div>
      </div>

      <ResizeHandle onDrag={handleResize} />

      {/* Input editor + symbols */}
      <div className="noteometry-panel-box" style={{ flex: heights[1] }}>
        <div className="noteometry-panel-box-hdr">
          <span className="noteometry-panel-box-title">
            <IconEdit3 />
            <span>Input</span>
          </span>
          <div className="noteometry-panel-box-actions">
            {inputCode.trim() && (
              <button className="noteometry-panel-solve" onClick={onSolve} title="Send this to the solver">
                <IconPlay />
                <span>Solve</span>
              </button>
            )}
            {inputCode && (
              <button
                className="noteometry-panel-clear"
                onClick={() => setInputCode("")}
                title="Clear the LaTeX input box (does not clear chat)"
              >
                <IconTrash />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
        <textarea
          className="noteometry-panel-textarea"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          placeholder="Type or paste LaTeX, or use READ INK..."
        />
        {/* MathPalette removed — now available as floating popup via right-click > Math Tools > Math Palette */}
      </div>
    </div>
  );
}
