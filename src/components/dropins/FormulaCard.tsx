import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import katex from "katex";
import type { FormulaCardObject } from "../../lib/canvasObjects";

const PRESETS: { name: string; latex: string }[] = [
  { name: "Ohm's Law",          latex: "V = IR" },
  { name: "KVL",                latex: "\\sum V = 0" },
  { name: "KCL",                latex: "\\sum I = 0" },
  { name: "Impedance",          latex: "Z = R + jX" },
  { name: "Power",              latex: "P = IV = I^2R = \\frac{V^2}{R}" },
  { name: "Capacitor Current",  latex: "I = C\\frac{dV}{dt}" },
  { name: "Inductor Voltage",   latex: "V = L\\frac{dI}{dt}" },
  { name: "RC Time Constant",   latex: "\\tau = RC" },
  { name: "Resonant Frequency", latex: "\\omega_0 = \\frac{1}{\\sqrt{LC}}" },
  { name: "Euler's Formula",    latex: "e^{j\\theta} = \\cos\\theta + j\\sin\\theta" },
  { name: "Transfer Function",  latex: "H(s) = \\frac{V_{out}(s)}{V_{in}(s)}" },
  { name: "Voltage Divider",    latex: "V_{out} = V_{in}\\frac{R_2}{R_1+R_2}" },
];

const BG_COLORS = [
  "#FFFFFF", "#FFF9C4", "#E3F2FD", "#E8F5E9", "#FCE4EC", "#F5F5F5",
];

function renderKatex(latex: string, container: HTMLElement, displayMode = true): void {
  try {
    katex.render(latex, container, {
      throwOnError: false,
      displayMode,
      trust: false,
    });
    container.style.color = "";
  } catch (e) {
    container.textContent = `Parse error: ${(e as Error).message}`;
    container.style.color = "red";
  }
}

interface Props {
  obj: FormulaCardObject;
  onChange: (patch: Partial<FormulaCardObject>) => void;
}

export default function FormulaCard({ obj, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(obj.latex);
  const [showPresets, setShowPresets] = useState(false);
  const renderRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const presetPopoverRef = useRef<HTMLDivElement>(null);

  // Render formula in display mode
  useEffect(() => {
    if (!editing && renderRef.current) {
      if (obj.latex) {
        renderKatex(obj.latex, renderRef.current);
      } else {
        renderRef.current.textContent = "Tap + to insert formula";
        renderRef.current.style.color = "#999";
      }
    }
  }, [obj.latex, editing]);

  // Pre-render preset previews
  const presetRefs = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    presetRefs.current.forEach((el, i) => {
      if (el) {
        try {
          katex.render(PRESETS[i]!.latex, el, {
            throwOnError: false,
            displayMode: false,
            trust: false,
          });
        } catch {
          el.textContent = PRESETS[i]!.latex;
        }
      }
    });
  }, []);

  // Live preview in edit mode
  useEffect(() => {
    if (editing && previewRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (previewRef.current) {
          renderKatex(draft, previewRef.current);
        }
      }, 150);
    }
    return () => clearTimeout(debounceRef.current);
  }, [draft, editing]);

  // Focus input on edit mode enter
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Close preset popover on outside click
  useEffect(() => {
    if (!showPresets) return;
    const handler = (e: PointerEvent) => {
      if (presetPopoverRef.current && !presetPopoverRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [showPresets]);

  const handleDoubleClick = useCallback(() => {
    setDraft(obj.latex);
    setEditing(true);
  }, [obj.latex]);

  const commitEdit = useCallback(() => {
    onChange({ latex: draft });
    setEditing(false);
  }, [draft, onChange]);

  const handlePresetSelect = useCallback((latex: string) => {
    onChange({ latex });
    setShowPresets(false);
    setEditing(false);
  }, [onChange]);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      width: "100%", height: "100%",
      background: obj.bgColor,
    }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "3px",
        padding: "2px 4px", flexShrink: 0, minHeight: "32px",
        borderBottom: "1px solid rgba(0,0,0,0.1)",
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowPresets((v) => !v); }}
          title="Preset formulas"
          style={{
            width: 32, height: 32, minWidth: 32, fontSize: "18px", fontWeight: 700,
            background: "none", border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: "4px", cursor: "pointer", lineHeight: "28px",
          }}
        >
          +
        </button>
        {BG_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChange({ bgColor: c })}
            style={{
              width: 20, height: 20, minWidth: 20, borderRadius: "3px",
              background: c,
              border: obj.bgColor === c ? "2px solid #333" : "1px solid rgba(0,0,0,0.2)",
              cursor: "pointer", padding: 0, flexShrink: 0,
            }}
          />
        ))}
      </div>

      {/* Preset popover */}
      {showPresets && (
        <div
          ref={presetPopoverRef}
          style={{
            position: "absolute", top: "32px", left: 0, right: 0,
            zIndex: 100, background: "var(--nm-paper, #fff)",
            border: "1px solid var(--nm-paper-border, #ccc)",
            borderRadius: "4px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            maxHeight: "240px", overflowY: "auto",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {PRESETS.map((preset, i) => (
            <button
              key={preset.name}
              onClick={() => handlePresetSelect(preset.latex)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "6px 10px", gap: "8px",
                background: "none", border: "none",
                borderBottom: i < PRESETS.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                cursor: "pointer", textAlign: "left", fontSize: "12px",
                minHeight: "36px",
              }}
            >
              <span style={{ flexShrink: 0, fontWeight: 600, color: "#555" }}>{preset.name}</span>
              <span
                ref={(el) => { presetRefs.current[i] = el; }}
                style={{ fontSize: "14px", overflow: "hidden" }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div
        style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "8px", overflow: "hidden",
          position: "relative",
        }}
        onDoubleClick={handleDoubleClick}
      >
        {editing ? (
          <>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
              }}
              onBlur={commitEdit}
              placeholder="Enter LaTeX..."
              style={{
                width: "100%", padding: "4px 6px", fontSize: "13px",
                fontFamily: "monospace", border: "1px solid var(--nm-paper-border, #ccc)",
                borderRadius: "3px", boxSizing: "border-box",
                background: "var(--nm-paper, #fff)",
              }}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <div
              ref={previewRef}
              style={{
                marginTop: "6px", fontSize: `${obj.fontSize}px`,
                overflowX: "auto", maxWidth: "100%",
              }}
            />
          </>
        ) : (
          <div
            ref={renderRef}
            style={{
              fontSize: `${obj.fontSize}px`,
              overflowX: "auto", maxWidth: "100%",
              textAlign: "center", cursor: "default",
            }}
          />
        )}
      </div>
    </div>
  );
}
