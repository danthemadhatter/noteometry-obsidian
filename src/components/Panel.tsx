import React, { useState, useRef, useCallback } from "react";
import { App } from "obsidian";
import MarkdownPreview from "./MarkdownPreview";
import SolutionRenderer from "./SolutionRenderer";

interface Props {
  inputCode: string;
  setInputCode: (v: string) => void;
  outputCode: string;
  isSolving: boolean;
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

/* ── EE Symbols ────────────────────────────────────────── */
const SYMBOLS: { label: string; items: { sym: string; display: string }[] }[] = [
  {
    label: "Calculus",
    items: [
      { sym: "\\int ", display: "\u222b" },
      { sym: "\\sum ", display: "\u2211" },
      { sym: "\\frac{}{}", display: "\u00b9/\u2093" },
      { sym: "\\sqrt{}", display: "\u221a" },
      { sym: "\\partial ", display: "\u2202" },
      { sym: "\\lim_{}", display: "lim" },
      { sym: "\\infty", display: "\u221e" },
      { sym: "\\rightarrow ", display: "\u2192" },
    ],
  },
  {
    label: "Greek",
    items: [
      { sym: "\\alpha", display: "\u03b1" },
      { sym: "\\beta", display: "\u03b2" },
      { sym: "\\gamma", display: "\u03b3" },
      { sym: "\\delta", display: "\u03b4" },
      { sym: "\\epsilon", display: "\u03b5" },
      { sym: "\\theta", display: "\u03b8" },
      { sym: "\\lambda", display: "\u03bb" },
      { sym: "\\mu", display: "\u03bc" },
      { sym: "\\pi", display: "\u03c0" },
      { sym: "\\phi", display: "\u03c6" },
      { sym: "\\omega", display: "\u03c9" },
      { sym: "\\Omega", display: "\u03a9" },
      { sym: "\\Delta ", display: "\u0394" },
    ],
  },
  {
    label: "EE",
    items: [
      { sym: "j\\omega", display: "j\u03c9" },
      { sym: "\\vec{}", display: "a\u20d7" },
      { sym: "\\nabla ", display: "\u2207" },
      { sym: "\\pm ", display: "\u00b1" },
      { sym: "\\cdot ", display: "\u00b7" },
      { sym: "\\times ", display: "\u00d7" },
      { sym: "\\boxed{}", display: "\u25a1" },
      { sym: "\\text{ V}", display: "V" },
      { sym: "\\text{ A}", display: "A" },
      { sym: "\\text{ W}", display: "W" },
      { sym: "\\text{ }\\Omega", display: "\u03a9" },
      { sym: "\\text{ k}\\Omega", display: "k\u03a9" },
      { sym: "\\text{ F}", display: "F" },
      { sym: "\\text{ H}", display: "H" },
      { sym: "\\text{ Hz}", display: "Hz" },
    ],
  },
];

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
  inputCode, setInputCode, outputCode, isSolving, app, onInsertSymbol,
}: Props) {
  const [heights, setHeights] = useState([30, 30, 40]);
  const [showRaw, setShowRaw] = useState(false);

  const handleResize = useCallback((index: number, dy: number) => {
    setHeights((prev) => {
      const next = [...prev];
      const pct = (dy / 6);
      const above = next[index]!;
      const below = next[index + 1]!;
      next[index] = Math.max(15, above + pct);
      next[index + 1] = Math.max(15, below - pct);
      return next;
    });
  }, []);

  return (
    <div className="noteometry-panel">
      {/* Input preview */}
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

      <ResizeHandle onDrag={(dy) => handleResize(0, dy)} />

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
        <div className="noteometry-symbols">
          {SYMBOLS.map((group) => (
            <div key={group.label} className="noteometry-symbol-group">
              <span className="noteometry-symbol-label">{group.label}</span>
              <div className="noteometry-symbol-row">
                {group.items.map((item) => (
                  <button
                    key={item.sym}
                    className="noteometry-symbol-btn"
                    onClick={() => onInsertSymbol(item.sym)}
                    title={item.sym}
                  >
                    {item.display}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ResizeHandle onDrag={(dy) => handleResize(1, dy)} />

      {/* Solution output */}
      <div className="noteometry-panel-box" style={{ flex: heights[2] }}>
        <div className="noteometry-panel-box-hdr">
          <span>Solution</span>
          <div className="noteometry-panel-box-actions">
            {outputCode && (
              <>
                <button
                  className="noteometry-panel-action"
                  onClick={() => setShowRaw(!showRaw)}
                >
                  {showRaw ? "Rendered" : "Raw"}
                </button>
                <button
                  className="noteometry-panel-action"
                  onClick={() => navigator.clipboard.writeText(outputCode).catch(() => {})}
                >
                  Copy
                </button>
              </>
            )}
          </div>
        </div>
        <div className="noteometry-panel-box-content">
          {isSolving
            ? <div className="noteometry-placeholder noteometry-pulse">Solving...</div>
            : outputCode.trim()
              ? showRaw
                ? <pre className="noteometry-panel-raw">{outputCode}</pre>
                : <SolutionRenderer raw={outputCode} app={app} />
              : <div className="noteometry-placeholder">Hit SOLVE to get a step-by-step solution</div>}
        </div>
      </div>
    </div>
  );
}
