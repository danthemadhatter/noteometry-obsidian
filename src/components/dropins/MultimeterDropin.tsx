import React, { useState, useCallback, useRef, useEffect } from "react";

/**
 * Simulated Digital Multimeter — measures DC/AC voltage, current,
 * resistance, capacitance, continuity, and diode test.
 *
 * User enters values or connects to Signal Bus for live readings.
 * Display mimics a real DMM LCD with auto-ranging and unit display.
 */

type MeterMode = "DCV" | "ACV" | "DCA" | "ACA" | "OHM" | "CAP" | "CONT" | "DIODE";

interface Props {
  mode: MeterMode;
  inputValue: string;
  onChange: (updates: { mode?: MeterMode; inputValue?: string }) => void;
}

const MODES: { key: MeterMode; label: string; unit: string; icon: string }[] = [
  { key: "DCV", label: "DC V", unit: "V", icon: "⎓V" },
  { key: "ACV", label: "AC V", unit: "V", icon: "∿V" },
  { key: "DCA", label: "DC A", unit: "A", icon: "⎓A" },
  { key: "ACA", label: "AC A", unit: "A", icon: "∿A" },
  { key: "OHM", label: "Ω", unit: "Ω", icon: "Ω" },
  { key: "CAP", label: "Cap", unit: "F", icon: "⊣⊢" },
  { key: "CONT", label: "Cont", unit: "", icon: "🔊" },
  { key: "DIODE", label: "Diode", unit: "V", icon: "▷|" },
];

const PREFIXES = [
  { prefix: "G", mult: 1e9 },
  { prefix: "M", mult: 1e6 },
  { prefix: "k", mult: 1e3 },
  { prefix: "", mult: 1 },
  { prefix: "m", mult: 1e-3 },
  { prefix: "μ", mult: 1e-6 },
  { prefix: "n", mult: 1e-9 },
  { prefix: "p", mult: 1e-12 },
];

function autoRange(value: number, unit: string): string {
  if (value === 0) return `0.000 ${unit}`;
  const abs = Math.abs(value);
  for (const p of PREFIXES) {
    if (abs >= p.mult * 0.999) {
      const display = (value / p.mult).toFixed(abs >= p.mult * 100 ? 1 : abs >= p.mult * 10 ? 2 : 3);
      return `${display} ${p.prefix}${unit}`;
    }
  }
  return `${value.toExponential(3)} ${unit}`;
}

export default function MultimeterDropin({ mode, inputValue, onChange }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [editBuf, setEditBuf] = useState(inputValue);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentMode = MODES.find(m => m.key === mode) ?? MODES[0]!;
  const numVal = parseFloat(inputValue) || 0;

  // Continuity: beep indication
  const isContinuity = mode === "CONT";
  const contPass = isContinuity && numVal < 50; // < 50Ω = continuity

  // Diode test: forward voltage
  const isDiode = mode === "DIODE";

  // Display value
  let displayStr: string;
  if (isContinuity) {
    displayStr = contPass ? `${numVal.toFixed(1)} Ω  BEEP` : `O.L.`;
  } else if (isDiode) {
    displayStr = numVal > 0 ? `${numVal.toFixed(3)} V` : `O.L.`;
  } else {
    displayStr = autoRange(numVal, currentMode.unit);
  }

  const commitEdit = useCallback(() => {
    const v = parseFloat(editBuf);
    if (!isNaN(v)) onChange({ inputValue: String(v) });
    setEditMode(false);
  }, [editBuf, onChange]);

  useEffect(() => {
    if (editMode && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editMode]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#1a1a1a", color: "#e0e0e0", fontFamily: "var(--nm-font-mono, monospace)",
    }}>
      {/* LCD Display */}
      <div style={{
        margin: "8px", padding: "12px 16px",
        background: "#c8d8a0", borderRadius: "6px",
        border: "2px solid #888",
        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3)",
        textAlign: "right",
      }}>
        <div style={{
          fontSize: "10px", color: "#4a5a2a", fontWeight: 600,
          marginBottom: "2px", textTransform: "uppercase",
          letterSpacing: "1px",
        }}>
          {currentMode.label} {mode === "ACV" || mode === "ACA" ? "~" : "═"}
        </div>
        <div
          onClick={() => { setEditMode(true); setEditBuf(inputValue); }}
          title="Click to enter a value"
          style={{
            fontSize: "28px", fontWeight: 700, color: "#1a2a0a",
            fontFamily: "'Courier New', monospace",
            letterSpacing: "2px", cursor: "text",
            minHeight: "36px", lineHeight: "36px",
          }}
        >
          {editMode ? (
            <input
              ref={inputRef}
              value={editBuf}
              onChange={e => setEditBuf(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditMode(false); }}
              style={{
                width: "100%", background: "transparent", border: "none",
                fontSize: "28px", fontWeight: 700, color: "#1a2a0a",
                fontFamily: "'Courier New', monospace", textAlign: "right",
                outline: "none", letterSpacing: "2px",
              }}
            />
          ) : displayStr}
        </div>
        {isContinuity && contPass && (
          <div style={{ fontSize: "10px", color: "#2a6a0a", fontWeight: 700 }}>
            ● CONTINUITY
          </div>
        )}
      </div>

      {/* Mode selector rotary dial */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "2px",
        padding: "4px 8px", justifyContent: "center",
      }}>
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => onChange({ mode: m.key })}
            style={{
              width: "44px", height: "32px",
              border: mode === m.key ? "2px solid #f5a623" : "1px solid #444",
              borderRadius: "4px", cursor: "pointer",
              background: mode === m.key ? "#333" : "#222",
              color: mode === m.key ? "#f5a623" : "#999",
              fontSize: "11px", fontWeight: mode === m.key ? 700 : 400,
              fontFamily: "var(--nm-font-mono, monospace)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {m.icon}
          </button>
        ))}
      </div>

      {/* Quick value buttons */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "2px",
        padding: "4px 8px", justifyContent: "center", marginTop: "auto",
      }}>
        {["0", "1", "2.2", "3.3", "4.7", "10", "100", "1k", "10k", "100k", "1M"].map(v => {
          const num = v.includes("k") ? parseFloat(v) * 1000 : v.includes("M") ? parseFloat(v) * 1e6 : parseFloat(v);
          return (
            <button
              key={v}
              onClick={() => onChange({ inputValue: String(num) })}
              style={{
                padding: "2px 6px", fontSize: "10px",
                border: "1px solid #444", borderRadius: "3px",
                background: "#2a2a2a", color: "#ccc", cursor: "pointer",
                fontFamily: "var(--nm-font-mono, monospace)",
              }}
            >
              {v}
            </button>
          );
        })}
      </div>

      {/* Usage hint */}
      <div style={{
        padding: "4px 8px", fontSize: "9px", color: "#888",
        textAlign: "center", fontFamily: "var(--nm-font, sans-serif)",
        borderTop: "1px solid #333",
      }}>
        Pick a mode (top) · click LCD to type value · or tap a preset
      </div>

      {/* Probe terminals */}
      <div style={{
        display: "flex", justifyContent: "center", gap: "16px",
        padding: "8px", borderTop: "1px solid #333",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "16px", height: "16px", borderRadius: "50%",
            background: "#dc2626", border: "2px solid #666", margin: "0 auto 2px",
          }} />
          <span style={{ fontSize: "9px", color: "#999" }}>V/Ω</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "16px", height: "16px", borderRadius: "50%",
            background: "#1a1a1a", border: "2px solid #666", margin: "0 auto 2px",
          }} />
          <span style={{ fontSize: "9px", color: "#999" }}>COM</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "16px", height: "16px", borderRadius: "50%",
            background: "#f5a623", border: "2px solid #666", margin: "0 auto 2px",
          }} />
          <span style={{ fontSize: "9px", color: "#999" }}>A</span>
        </div>
      </div>
    </div>
  );
}
