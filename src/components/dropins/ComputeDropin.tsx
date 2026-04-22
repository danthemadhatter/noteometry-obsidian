import React, { useState, useCallback } from "react";

interface Cell { name: string; expr: string; value: string; }
interface Props {
  cells: Cell[];
  resultExpr: string;
  onChange: (updates: { cells?: Cell[]; resultExpr?: string }) => void;
}

function evaluate(expr: string, vars: Record<string, number>): string {
  try {
    let e = expr;
    for (const [k, v] of Object.entries(vars)) {
      e = e.replace(new RegExp(`\\b${k}\\b`, "g"), String(v));
    }
    const fn = new Function("Math", `with(Math){return (${e})}`);
    const result = fn(Math);
    return typeof result === "number" ? String(result) : String(result);
  } catch { return "ERR"; }
}

export default function ComputeDropin({ cells, resultExpr, onChange }: Props) {
  const vars: Record<string, number> = {};
  const evaluatedCells = cells.map(c => {
    const val = evaluate(c.expr, vars);
    const num = parseFloat(val);
    if (!isNaN(num)) vars[c.name] = num;
    return { ...c, value: val };
  });

  const result = resultExpr ? evaluate(resultExpr, vars) : "";

  const addCell = useCallback(() => {
    const name = `x${cells.length + 1}`;
    onChange({ cells: [...cells, { name, expr: "0", value: "0" }] });
  }, [cells, onChange]);

  const addVar = useCallback(() => {
    const name = `v${cells.length + 1}`;
    onChange({ cells: [...cells, { name, expr: "", value: "" }] });
  }, [cells, onChange]);

  const updateCell = useCallback((i: number, updates: Partial<Cell>) => {
    const next = cells.map((c, j) => j === i ? { ...c, ...updates } : c);
    onChange({ cells: next });
  }, [cells, onChange]);

  const removeCell = useCallback((i: number) => {
    onChange({ cells: cells.filter((_, j) => j !== i) });
  }, [cells, onChange]);

  const isEmpty = cells.length === 0 && !resultExpr.trim();

  return (
    <div style={{ padding: "8px", fontSize: "12px", fontFamily: "var(--nm-font-mono, monospace)" }}>
      {isEmpty && (
        <div style={{
          padding: "6px 8px", marginBottom: "8px",
          background: "var(--nm-accent-light, rgba(74,144,217,0.12))",
          border: "1px dashed var(--nm-accent, #4a90d9)",
          borderRadius: "4px", fontSize: "11px",
          color: "var(--nm-ink)", fontFamily: "var(--nm-font, sans-serif)",
          lineHeight: 1.4,
        }}>
          <strong>Calculator:</strong> a named-variable scratchpad.
          Add a variable (e.g. <code>V = 12</code>, <code>R = 1000</code>),
          then write a result expression that uses them
          (e.g. <code>V / R</code>). <code>Math.*</code> is in scope —
          try <code>Math.sqrt(V / R)</code>.
        </div>
      )}
      <div style={{
        padding: "8px", marginBottom: "8px", background: "var(--nm-faceplate-alt, #F0F0F0)",
        borderRadius: "4px", fontSize: "14px", fontWeight: 700, color: "var(--nm-ink)",
        textAlign: "right",
      }}>
        {result || "$RESULT"}
      </div>
      <input
        value={resultExpr}
        onChange={e => onChange({ resultExpr: e.target.value })}
        placeholder="Result expression..."
        style={{
          width: "100%", boxSizing: "border-box", marginBottom: "8px", padding: "4px 6px",
          fontSize: "12px", border: "1px solid #E0E0E0", borderRadius: "4px",
          fontFamily: "inherit",
        }}
      />
      {evaluatedCells.map((c, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
          <input value={c.name}
            onChange={e => updateCell(i, { name: e.target.value })}
            style={{ width: "40px", fontSize: "11px", padding: "2px 4px", border: "1px solid #E0E0E0", borderRadius: "3px", fontFamily: "inherit" }}
          />
          <span style={{ color: "#999" }}>=</span>
          <input value={c.expr}
            onChange={e => updateCell(i, { expr: e.target.value })}
            style={{ flex: 1, fontSize: "11px", padding: "2px 4px", border: "1px solid #E0E0E0", borderRadius: "3px", fontFamily: "inherit" }}
          />
          <span style={{ color: "#999", minWidth: "40px", textAlign: "right" }}>{c.value}</span>
          <button onClick={() => removeCell(i)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "11px" }}
          >x</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
        <button onClick={addCell}
          style={{
            flex: 1, padding: "4px", fontSize: "11px", border: "1px solid #E0E0E0",
            borderRadius: "4px", cursor: "pointer", background: "var(--nm-faceplate)",
            color: "var(--nm-ink)",
          }}
        >+ Cell</button>
        <button onClick={addVar}
          style={{
            flex: 1, padding: "4px", fontSize: "11px", border: "1px solid var(--nm-accent)",
            borderRadius: "4px", cursor: "pointer", background: "var(--nm-accent-light, rgba(74,144,217,0.12))",
            color: "var(--nm-accent)",
          }}
        >+ Var</button>
      </div>
    </div>
  );
}
