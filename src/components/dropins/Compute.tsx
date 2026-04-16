import React, { useState, useCallback, useRef } from "react";
import type { ComputeObject } from "../../lib/canvasObjects";

interface Props {
  obj: ComputeObject;
  onChange: (patch: Partial<ComputeObject>) => void;
}

/** Simple expression evaluator using Function constructor.
 *  Supports basic math: +, -, *, /, **, %, Math.*, etc. */
function safeEval(expr: string, vars: Record<string, number>): string {
  try {
    if (!expr.trim()) return "";
    // Build a scope of user-defined variables
    const keys = Object.keys(vars);
    const vals = keys.map(k => vars[k]);
    // Expose Math functions as globals
    const mathKeys = Object.getOwnPropertyNames(Math);
    const mathVals = mathKeys.map(k => (Math as any)[k]);
    const fn = new Function(...keys, ...mathKeys, `"use strict"; return (${expr});`);
    const result = fn(...vals, ...mathVals);
    if (typeof result === "number") {
      return Number.isFinite(result) ? String(result) : "Infinity";
    }
    return String(result);
  } catch (e) {
    return `Error: ${(e as Error).message}`;
  }
}

export default function Compute({ obj, onChange }: Props) {
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const cells = obj.cells;
  const vars = obj.variables;

  // Build a lookup of resolved variable values for expression evaluation
  const resolvedVars: Record<string, number> = {};
  for (const [k, v] of Object.entries(vars)) {
    const num = parseFloat(v);
    if (!isNaN(num)) resolvedVars[k] = num;
  }

  const addCell = () => {
    onChange({ cells: [...cells, { id: crypto.randomUUID(), label: `Cell ${cells.length + 1}`, expr: "" }] });
  };

  const updateCell = (id: string, patch: Partial<{ label: string; expr: string }>) => {
    onChange({ cells: cells.map(c => c.id === id ? { ...c, ...patch } : c) });
  };

  const removeCell = (id: string) => {
    onChange({ cells: cells.filter(c => c.id !== id) });
  };

  const setVar = (name: string, value: string) => {
    onChange({ variables: { ...vars, [name]: value } });
  };

  const addVar = () => {
    const name = `x${Object.keys(vars).length + 1}`;
    onChange({ variables: { ...vars, [name]: "0" } });
  };

  const removeVar = (name: string) => {
    const next = { ...vars };
    delete next[name];
    onChange({ variables: next });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: 12, fontFamily: "var(--nm-font-mono, monospace)" }}>
      {/* Variables section */}
      <div style={{
        padding: "4px 8px",
        borderBottom: "1px solid var(--nm-paper-border, #e0e0e0)",
        background: "var(--nm-faceplate-recessed, #e8e8e8)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--nm-ink-muted, #6b7280)" }}>Variables</span>
          <button onClick={addVar} style={smallBtnStyle}>+ Var</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {Object.entries(vars).map(([name, val]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 2, background: "white", border: "1px solid var(--nm-paper-border)", borderRadius: 3, padding: "1px 4px" }}>
              <span style={{ fontWeight: 600, color: "var(--nm-accent, #4A90D9)" }}>{name}</span>
              <span>=</span>
              <input
                value={val}
                onChange={(e) => setVar(name, e.target.value)}
                style={{ width: 50, border: "none", outline: "none", fontSize: 11, fontFamily: "inherit", background: "transparent" }}
              />
              <button onClick={() => removeVar(name)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--nm-danger, #dc2626)", fontSize: 10, padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Cells */}
      <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
        {cells.length === 0 && (
          <div style={{ textAlign: "center", padding: 16, color: "var(--nm-ink-muted, #999)" }}>
            No cells. Click "+ Cell" to add an expression.
          </div>
        )}
        {cells.map((cell, idx) => {
          const result = safeEval(cell.expr, resolvedVars);
          return (
            <div key={cell.id} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "3px 8px",
              borderBottom: "1px solid rgba(0,0,0,0.04)",
              minHeight: 26,
            }}>
              <span style={{ width: 60, flexShrink: 0, fontSize: 10, fontWeight: 600, color: "var(--nm-ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {cell.label}
              </span>
              <input
                value={cell.expr}
                onChange={(e) => updateCell(cell.id, { expr: e.target.value })}
                placeholder="expression..."
                style={{ flex: 1, fontSize: 11, fontFamily: "inherit", border: "1px solid var(--nm-paper-border)", borderRadius: 3, padding: "2px 4px", outline: "none" }}
              />
              <span style={{ fontWeight: 700, color: result.startsWith("Error") ? "var(--nm-danger)" : "var(--nm-accent)", minWidth: 40, textAlign: "right", fontSize: 11 }}>
                = {result || "—"}
              </span>
              <button onClick={() => removeCell(cell.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--nm-danger, #dc2626)", fontSize: 12, padding: "0 2px" }}>×</button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", justifyContent: "flex-end", gap: 4,
        padding: "4px 8px",
        borderTop: "1px solid var(--nm-paper-border, #e0e0e0)",
      }}>
        <button onClick={addCell} style={smallBtnStyle}>+ Cell</button>
      </div>
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  border: "1px solid var(--nm-accent, #4A90D9)",
  borderRadius: 4,
  background: "var(--nm-accent-light, rgba(74,144,217,0.12))",
  color: "var(--nm-accent, #4A90D9)",
  cursor: "pointer",
  padding: "2px 8px",
  fontSize: 10,
  fontWeight: 600,
};
