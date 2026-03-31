import React, { useState, useEffect } from "react";
import { App } from "obsidian";
import { NoteometryMode } from "../types";
import MathPalette from "./MathPalette";
import CircuitPalette from "./CircuitPalette";
import MarkdownPreview from "./MarkdownPreview";

interface Props {
  mode: NoteometryMode;
  inputRaw: string;
  setInputRaw: (v: string) => void;
  outputRaw: string;
  loading: boolean;
  error: string | null;
  onReadInk: () => void;
  onSolve: () => void;
  onInsertSymbol: (s: string) => void;
  app: App;
}

export default function Panel({
  mode,
  inputRaw,
  setInputRaw,
  outputRaw,
  loading,
  error,
  onReadInk,
  onSolve,
  onInsertSymbol,
  app,
}: Props) {
  // Debounce input for the rendered preview so we don't thrash Obsidian's
  // markdown renderer on every keystroke.
  const [previewInput, setPreviewInput] = useState(inputRaw);
  useEffect(() => {
    const t = window.setTimeout(() => setPreviewInput(inputRaw), 350);
    return () => window.clearTimeout(t);
  }, [inputRaw]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      /* silently fail in restricted contexts */
    });
  };

  return (
    <div className="noteometry-panel">
      {/* ── Input ───────────────────────────────── */}
      <div className="noteometry-section">
        <div className="noteometry-section-hdr">
          <span>Input</span>
          <button
            className="noteometry-btn-icon"
            onClick={() => setInputRaw("")}
            title="Clear"
          >
            ✕
          </button>
        </div>

        <textarea
          className="noteometry-textarea"
          value={inputRaw}
          onChange={(e) => setInputRaw(e.target.value)}
          placeholder="Write LaTeX here, or use READ INK to capture from canvas…"
          rows={4}
        />

        {previewInput && (
          <div className="noteometry-preview">
            <MarkdownPreview content={previewInput} app={app} />
          </div>
        )}
      </div>

      {/* ── Palette ─────────────────────────────── */}
      {mode === "math" && <MathPalette onInsert={onInsertSymbol} />}
      {mode === "circuits" && <CircuitPalette onInsert={onInsertSymbol} />}

      {/* ── Actions ─────────────────────────────── */}
      <div className="noteometry-actions">
        <button
          className="noteometry-btn noteometry-btn-readink"
          onClick={onReadInk}
          disabled={loading}
        >
          {loading ? "⏳" : "📸"} READ INK
        </button>
        <button
          className="noteometry-btn noteometry-btn-solve"
          onClick={onSolve}
          disabled={loading || !inputRaw.trim()}
        >
          {loading ? "⏳" : "🧠"} SOLVE
        </button>
      </div>

      {/* ── Error ───────────────────────────────── */}
      {error && <div className="noteometry-error">{error}</div>}

      {/* ── Output ──────────────────────────────── */}
      {outputRaw && (
        <div className="noteometry-section">
          <div className="noteometry-section-hdr">
            <span>Output</span>
            <button
              className="noteometry-btn-icon"
              onClick={() => copyToClipboard(outputRaw)}
              title="Copy raw output"
            >
              📋
            </button>
          </div>

          <div className="noteometry-preview noteometry-output-rendered">
            <MarkdownPreview content={outputRaw} app={app} />
          </div>

          <details className="noteometry-raw-toggle">
            <summary>Raw LaTeX</summary>
            <pre className="noteometry-raw-block">{outputRaw}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
