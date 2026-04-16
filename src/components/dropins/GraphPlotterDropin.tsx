import React, { useRef, useEffect, useCallback, useState } from "react";
import { signalBus, type SignalChannel } from "../../lib/SignalBus";

interface FnDef { expr: string; color: string; enabled: boolean; }
interface Props {
  id: string;
  functions: FnDef[];
  viewX: number; viewY: number; viewW: number; viewH: number;
  signalLinked: boolean;
  onChange: (updates: Partial<{
    functions: FnDef[]; viewX: number; viewY: number; viewW: number; viewH: number;
  }>) => void;
}

const COLORS = ["#7C3AED", "#2563EB", "#DC2626", "#16A34A", "#F59E0B", "#EC4899"];

function evalExpr(expr: string, x: number): number {
  try {
    const fn = new Function("x", "Math",
      `with(Math){return (${expr})}`
    );
    return fn(x, Math);
  } catch { return NaN; }
}

export default function GraphPlotterDropin({ id, functions, viewX, viewY, viewW, viewH, signalLinked, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [addExpr, setAddExpr] = useState("");

  // Signal Bus
  useEffect(() => {
    if (!signalLinked) return;
    const unsub = signalBus.subscribe("frequency", (f) => {
      // Could update view or highlight
    }, id);
    return unsub;
  }, [signalLinked, id]);

  // Draw
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const W = cvs.width;
    const H = cvs.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#FAFAFA";
    ctx.fillRect(0, 0, W, H);

    const toScreenX = (wx: number) => ((wx - viewX) / viewW) * W;
    const toScreenY = (wy: number) => H - ((wy - viewY) / viewH) * H;

    // Grid
    ctx.strokeStyle = "#E8E8E8";
    ctx.lineWidth = 1;
    const gridStep = Math.pow(10, Math.floor(Math.log10(viewW / 5)));
    for (let gx = Math.floor(viewX / gridStep) * gridStep; gx <= viewX + viewW; gx += gridStep) {
      const sx = toScreenX(gx);
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
    }
    for (let gy = Math.floor(viewY / gridStep) * gridStep; gy <= viewY + viewH; gy += gridStep) {
      const sy = toScreenY(gy);
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1.5;
    const ax = toScreenX(0), ay = toScreenY(0);
    ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(W, ay); ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#666";
    ctx.font = "10px var(--nm-font-mono, monospace)";
    ctx.textAlign = "center";
    ctx.fillText(`x: ${viewX.toFixed(1)}`, 30, H - 4);
    ctx.fillText(`${(viewX + viewW).toFixed(1)}`, W - 30, H - 4);
    ctx.textAlign = "left";
    ctx.fillText(`y: ${(viewY + viewH).toFixed(1)}`, 4, 12);

    // Functions
    for (const fn of functions) {
      if (!fn.enabled || !fn.expr.trim()) continue;
      ctx.strokeStyle = fn.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      for (let px = 0; px < W; px++) {
        const wx = viewX + (px / W) * viewW;
        const wy = evalExpr(fn.expr, wx);
        if (isNaN(wy) || !isFinite(wy)) { started = false; continue; }
        const sy = toScreenY(wy);
        if (!started) { ctx.moveTo(px, sy); started = true; }
        else ctx.lineTo(px, sy);
      }
      ctx.stroke();
    }
  }, [functions, viewX, viewY, viewW, viewH]);

  const addFunction = useCallback(() => {
    if (!addExpr.trim()) return;
    const color = COLORS[functions.length % COLORS.length] ?? "#7C3AED";
    onChange({ functions: [...functions, { expr: addExpr.trim(), color, enabled: true }] });
    setAddExpr("");
  }, [addExpr, functions, onChange]);

  const toggleFn = useCallback((i: number) => {
    const next = functions.map((f, j) => j === i ? { ...f, enabled: !f.enabled } : f);
    onChange({ functions: next });
  }, [functions, onChange]);

  const removeFn = useCallback((i: number) => {
    onChange({ functions: functions.filter((_, j) => j !== i) });
  }, [functions, onChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          width={400} height={250}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>
      <div style={{ padding: "4px 8px", fontSize: "11px", borderTop: "1px solid #E0E0E0" }}>
        <div style={{ fontWeight: 600, marginBottom: "2px", color: "var(--nm-ink)" }}>Functions</div>
        {functions.map((fn, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
            <span
              onClick={() => toggleFn(i)}
              style={{ width: "10px", height: "10px", borderRadius: "50%", background: fn.enabled ? fn.color : "#ccc", cursor: "pointer", flexShrink: 0 }}
            />
            <span style={{ flex: 1, fontFamily: "var(--nm-font-mono)", color: fn.enabled ? "var(--nm-ink)" : "#999" }}>{fn.expr}</span>
            <button onClick={() => removeFn(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "11px" }}>x</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
          <input
            value={addExpr}
            onChange={e => setAddExpr(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addFunction(); }}
            placeholder="+ Add function"
            style={{ flex: 1, fontSize: "11px", padding: "2px 4px", border: "1px solid #E0E0E0", borderRadius: "3px" }}
          />
        </div>
      </div>
    </div>
  );
}
