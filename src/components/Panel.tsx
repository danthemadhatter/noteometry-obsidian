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

/** Ensure LaTeX content has $ delimiters so Obsidian renders it as math */
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

/* ── EE Symbol groups ─────────────────────────────────── */
const SYMBOLS: { label: string; items: { sym: string; tip: string }[] }[] = [
  {
    label: "Math",
    items: [
      { sym: "\\int ", tip: "\u222b" },
      { sym: "\\sum ", tip: "\u2211" },
      { sym: "\\frac{}{}", tip: "a/b" },
      { sym: "\\sqrt{}", tip: "\u221a" },
      { sym: "\\partial ", tip: "\u2202" },
      { sym: "\\infty", tip: "\u221e" },
      { sym: "\\pm ", tip: "\u00b1" },
      { sym: "\\cdot ", tip: "\u00b7" },
      { sym: "\\rightarrow ", tip: "\u2192" },
      { sym: "\\boxed{}", tip: "[ ]" },
    ],
  },
  {
    label: "Greek",
    items: [
      { sym: "\\Omega", tip: "\u03a9" },
      { sym: "\\mu", tip: "\u03bc" },
      { sym: "\\pi", tip: "\u03c0" },
      { sym: "\\theta", tip: "\u03b8" },
      { sym: "\\omega", tip: "\u03c9" },
      { sym: "\\phi", tip: "\u03c6" },
      { sym: "\\Delta ", tip: "\u0394" },
      { sym: "\\alpha", tip: "\u03b1" },
      { sym: "\\beta", tip: "\u03b2" },
      { sym: "\\gamma", tip: "\u03b3" },
      { sym: "\\lambda", tip: "\u03bb" },
      { sym: "\\epsilon", tip: "\u03b5" },
    ],
  },
  {
    label: "EE",
    items: [
      { sym: "\\vec{}", tip: "vec" },
      { sym: "\\hat{}", tip: "hat" },
      { sym: "\\nabla ", tip: "\u2207" },
      { sym: "\\text{ V}", tip: "V" },
      { sym: "\\text{ A}", tip: "A" },
      { sym: "\\text{ W}", tip: "W" },
      { sym: "\\text{ F}", tip: "F" },
      { sym: "\\text{ H}", tip: "H" },
      { sym: "\\text{ Hz}", tip: "Hz" },
      { sym: "\\text{ dB}", tip: "dB" },
      { sym: "\\text{ k}\\Omega", tip: "k\u03a9" },
      { sym: "j\\omega", tip: "j\u03c9" },
    ],
  },
];

/* ── Resize handle between boxes ───────────────────────── */
function ResizeHandle({ onDrag }: { onDrag: (dy: number) => void }) {
  const dragging = useRef(false);
  const lastY = useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    lastY.current = e.clientY;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dy = e.clientY - lastY.current;
    lastY.current = e.clientY;
    onDrag(dy);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragging.current = false;
  };

  return (
    <div
      className="noteometry-resize-handle"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}

export default function Panel({
  inputCode, setInputCode, outputCode, isSolving, app, onInsertSymbol,
}: Props) {
  // Heights as percentages of panel (4 boxes = 25% each default)
  const [heights, setHeights] = useState([25, 25, 25, 25]);

  const handleResize = useCallback((index: number, dy: number) => {
    setHeights((prev) => {
      const next = [...prev];
      // Convert dy pixels to rough percentage (assume ~600px panel height)
      const pct = (dy / 6);
      const above = next[index]!;
      const below = next[index + 1]!;
      const newAbove = Math.max(10, above + pct);
      const newBelow = Math.max(10, below - pct);
      next[index] = newAbove;
      next[index + 1] = newBelow;
      return next;
    });
  }, []);

  return (
    <div className="noteometry-panel">
      {/* Box 1: Input — Rendered */}
      <div className="noteometry-panel-box" style={{ flex: heights[0] }}>
        <div className="noteometry-panel-box-hdr">
          <span>Input — Rendered</span>
        </div>
        <div className="noteometry-panel-box-content">
          {inputCode.trim()
            ? <MarkdownPreview content={ensureMathDelimiters(inputCode)} app={app} />
            : <div className="noteometry-placeholder">Lasso ink or upload image</div>}
        </div>
      </div>

      <ResizeHandle onDrag={(dy) => handleResize(0, dy)} />

      {/* Box 2: Input — Code + EE Symbols */}
      <div className="noteometry-panel-box" style={{ flex: heights[1] }}>
        <div className="noteometry-panel-box-hdr">
          <span>Input — Code</span>
          <button
            className="noteometry-panel-box-action noteometry-panel-box-action-danger"
            onClick={() => setInputCode("")}
          >
            Clear
          </button>
        </div>
        <textarea
          className="noteometry-panel-textarea"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          placeholder="LaTeX / plain math / text — editable"
        />
        {/* EE Symbol bar */}
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
                    {item.tip}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ResizeHandle onDrag={(dy) => handleResize(1, dy)} />

      {/* Box 3: Output — Rendered */}
      <div className="noteometry-panel-box" style={{ flex: heights[2] }}>
        <div className="noteometry-panel-box-hdr">
          <span>Output — Rendered</span>
          {outputCode && (
            <button
              className="noteometry-panel-box-action noteometry-panel-box-action-copy"
              onClick={() => navigator.clipboard.writeText(outputCode).catch(() => {})}
            >
              Copy
            </button>
          )}
        </div>
        <div className="noteometry-panel-box-content">
          {isSolving
            ? <div className="noteometry-placeholder noteometry-pulse">DLP v12 solving…</div>
            : outputCode.trim()
              ? <SolutionRenderer raw={outputCode} app={app} />
              : <div className="noteometry-placeholder">Solution appears here</div>}
        </div>
      </div>

      <ResizeHandle onDrag={(dy) => handleResize(2, dy)} />

      {/* Box 4: Output — Raw LaTeX */}
      <div className="noteometry-panel-box" style={{ flex: heights[3] }}>
        <div className="noteometry-panel-box-hdr">
          <span>Output — Raw LaTeX</span>
        </div>
        <pre className="noteometry-panel-raw">
          {outputCode || <span className="noteometry-placeholder">Raw LaTeX output</span>}
        </pre>
      </div>
    </div>
  );
}
