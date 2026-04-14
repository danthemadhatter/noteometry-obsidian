import React, { useState, useRef, useEffect, useCallback } from "react";
import { compile } from "mathjs";
import type { GraphPlotterObject } from "../../lib/canvasObjects";

interface FuncEntry {
  expr: string;
  color: string;
  enabled: boolean;
}

const COLORS = ["#4A90D9", "#E53935", "#43A047", "#F5A623", "#9C27B0", "#00BCD4"];
const MAX_FUNCTIONS = 6;
const SAMPLES = 800;

interface Props {
  obj: GraphPlotterObject;
  onChange: (patch: Partial<GraphPlotterObject>) => void;
  onSendToAI?: (dataUrl: string) => void;
}

/** Safely evaluate an expression string at x using mathjs. */
function evalExpr(exprStr: string, x: number): number | null {
  try {
    const node = compile(exprStr);
    const result = node.evaluate({ x, pi: Math.PI, e: Math.E, Inf: Infinity });
    if (typeof result === "number" && isFinite(result)) return result;
    return null;
  } catch {
    return null;
  }
}

/** Register step(x) as a custom function — unit step. */
function evalExprWithStep(exprStr: string, x: number): number | null {
  // Replace step(…) with a ternary before compiling
  const replaced = exprStr.replace(/\bstep\(([^)]*)\)/g, "($1 >= 0 ? 1 : 0)");
  return evalExpr(replaced, x);
}

export default function GraphPlotter({ obj, onChange, onSendToAI }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ mx: number; my: number; xMin: number; xMax: number; yMin: number | null; yMax: number | null }>({ mx: 0, my: 0, xMin: -10, xMax: 10, yMin: null, yMax: null });

  const funcs = obj.functions;
  const xMin = obj.xMin;
  const xMax = obj.xMax;

  const updateFunc = useCallback((index: number, patch: Partial<FuncEntry>) => {
    const next = funcs.map((f, i) => i === index ? { ...f, ...patch } : f);
    onChange({ functions: next });
  }, [funcs, onChange]);

  const addFunc = useCallback(() => {
    if (funcs.length >= MAX_FUNCTIONS) return;
    const color = COLORS[funcs.length % COLORS.length]!;
    onChange({ functions: [...funcs, { expr: "", color, enabled: true }] });
  }, [funcs, onChange]);

  const removeFunc = useCallback((index: number) => {
    onChange({ functions: funcs.filter((_, i) => i !== index) });
  }, [funcs, onChange]);

  // Draw the plot
  const drawPlot = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // White background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    const xRange = xMax - xMin;
    if (xRange <= 0) return;

    // Compute y range (auto or manual)
    let yMinVal = obj.yMin;
    let yMaxVal = obj.yMax;

    if (yMinVal === null || yMaxVal === null) {
      // Auto-scale: compute y range from all function values
      let autoMin = Infinity;
      let autoMax = -Infinity;
      for (const f of funcs) {
        if (!f.enabled || !f.expr.trim()) continue;
        for (let i = 0; i <= SAMPLES; i++) {
          const x = xMin + (i / SAMPLES) * xRange;
          const y = evalExprWithStep(f.expr, x);
          if (y !== null) {
            if (y < autoMin) autoMin = y;
            if (y > autoMax) autoMax = y;
          }
        }
      }
      if (!isFinite(autoMin) || !isFinite(autoMax)) {
        autoMin = -10;
        autoMax = 10;
      }
      const padding = (autoMax - autoMin) * 0.1 || 1;
      yMinVal = autoMin - padding;
      yMaxVal = autoMax + padding;
    }

    const yRange = yMaxVal - yMinVal;
    if (yRange <= 0) return;

    // Coordinate transforms
    const toScreenX = (x: number) => ((x - xMin) / xRange) * width;
    const toScreenY = (y: number) => height - ((y - yMinVal!) / yRange) * height;

    // Grid
    const gridStepX = niceStep(xRange / 8);
    const gridStepY = niceStep(yRange / 6);

    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 0.5;

    // Vertical grid lines
    const gxStart = Math.ceil(xMin / gridStepX) * gridStepX;
    for (let gx = gxStart; gx <= xMax; gx += gridStepX) {
      const sx = toScreenX(gx);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();
    }

    // Horizontal grid lines
    const gyStart = Math.ceil(yMinVal / gridStepY) * gridStepY;
    for (let gy = gyStart; gy <= yMaxVal; gy += gridStepY) {
      const sy = toScreenY(gy);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
    }

    // Axes (x=0, y=0)
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    // y-axis (x=0)
    if (xMin <= 0 && xMax >= 0) {
      const sx = toScreenX(0);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();
    }
    // x-axis (y=0)
    if (yMinVal <= 0 && yMaxVal >= 0) {
      const sy = toScreenY(0);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
    }

    // Axis tick labels
    ctx.fillStyle = "#888";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    for (let gx = gxStart; gx <= xMax; gx += gridStepX) {
      const sx = toScreenX(gx);
      const label = formatTickLabel(gx, gridStepX);
      if (label === "0") continue;
      ctx.fillText(label, sx, Math.min(height - 4, Math.max(12, toScreenY(0) + 14)));
    }
    ctx.textAlign = "right";
    for (let gy = gyStart; gy <= yMaxVal; gy += gridStepY) {
      const sy = toScreenY(gy);
      const label = formatTickLabel(gy, gridStepY);
      if (label === "0") continue;
      ctx.fillText(label, Math.min(width - 4, Math.max(30, toScreenX(0) - 6)), sy + 3);
    }

    // Plot functions
    for (const f of funcs) {
      if (!f.enabled || !f.expr.trim()) continue;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let penDown = false;
      let prevY: number | null = null;

      for (let i = 0; i <= SAMPLES; i++) {
        const x = xMin + (i / SAMPLES) * xRange;
        const y = evalExprWithStep(f.expr, x);
        if (y === null) {
          penDown = false;
          prevY = null;
          continue;
        }
        // Discontinuity detection
        if (prevY !== null && Math.abs(y - prevY) > 10 * yRange) {
          penDown = false;
        }
        const sx = toScreenX(x);
        const sy = toScreenY(y);
        if (!penDown) {
          ctx.moveTo(sx, sy);
          penDown = true;
        } else {
          ctx.lineTo(sx, sy);
        }
        prevY = y;
      }
      ctx.stroke();
    }
  }, [funcs, xMin, xMax, obj.yMin, obj.yMax]);

  // Redraw on changes
  useEffect(() => { drawPlot(); }, [drawPlot]);

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => drawPlot());
    ro.observe(container);
    return () => ro.disconnect();
  }, [drawPlot]);

  // Pan handling
  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const { width, height } = container.getBoundingClientRect();
      const ps = panStartRef.current;
      const dx = e.clientX - ps.mx;
      const dy = e.clientY - ps.my;
      const xRange = ps.xMax - ps.xMin;

      // Compute yRange for panning
      let yMinP = ps.yMin;
      let yMaxP = ps.yMax;
      let yRange = 20; // default
      if (yMinP !== null && yMaxP !== null) {
        yRange = yMaxP - yMinP;
      }

      const xShift = -(dx / width) * xRange;
      const yShift = (dy / height) * yRange;

      onChange({
        xMin: ps.xMin + xShift,
        xMax: ps.xMax + xShift,
        yMin: yMinP !== null ? yMinP + yShift : null,
        yMax: yMaxP !== null ? yMaxP + yShift : null,
      });
    };
    const onUp = () => setIsPanning(false);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [isPanning, onChange]);

  // Zoom via wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const xRange = xMax - xMin;
    const newRange = xRange * factor;
    const centerX = xMin + mx * xRange;
    const newXMin = centerX - mx * newRange;
    const newXMax = centerX + (1 - mx) * newRange;
    onChange({ xMin: newXMin, xMax: newXMax });
  }, [xMin, xMax, onChange]);

  const handlePanStart = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    panStartRef.current = { mx: e.clientX, my: e.clientY, xMin, xMax, yMin: obj.yMin, yMax: obj.yMax };
    setIsPanning(true);
  }, [xMin, xMax, obj.yMin, obj.yMax]);

  const handleReset = useCallback(() => {
    onChange({ xMin: -10, xMax: 10, yMin: null, yMax: null });
  }, [onChange]);

  const handleSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onSendToAI) return;
    onSendToAI(canvas.toDataURL("image/png"));
  }, [onSendToAI]);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "4px",
        padding: "4px 6px", flexShrink: 0,
        borderBottom: "1px solid rgba(0,0,0,0.1)",
      }}>
        <span style={{ fontSize: "12px", fontWeight: 600, marginRight: "auto" }}>Functions</span>
        {onSendToAI && (
          <button
            onClick={handleSnapshot}
            title="Send to AI"
            style={{
              padding: "2px 6px", fontSize: "11px", background: "none",
              border: "1px solid rgba(0,0,0,0.15)", borderRadius: "3px",
              cursor: "pointer", minHeight: "28px",
            }}
          >
            snapshot
          </button>
        )}
      </div>

      {/* Function list */}
      <div style={{ flexShrink: 0, padding: "4px 6px", maxHeight: "120px", overflowY: "auto" }}>
        {funcs.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "3px" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: f.color, flexShrink: 0 }} />
            <input
              type="text"
              value={f.expr}
              placeholder="e.g. sin(x)"
              onChange={(e) => updateFunc(i, { expr: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              style={{
                flex: 1, padding: "3px 6px", fontSize: "12px",
                fontFamily: "monospace",
                border: "1px solid rgba(0,0,0,0.15)", borderRadius: "3px",
                minHeight: "28px", boxSizing: "border-box", minWidth: 0,
                background: "var(--nm-paper, #fff)",
              }}
            />
            <input
              type="color"
              value={f.color}
              onChange={(e) => updateFunc(i, { color: e.target.value })}
              style={{ width: 24, height: 24, border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}
              title="Color"
            />
            <button
              onClick={() => removeFunc(i)}
              style={{
                width: 24, height: 24, fontSize: "14px", fontWeight: 700,
                background: "none", border: "none", cursor: "pointer",
                color: "#999", lineHeight: "24px", flexShrink: 0,
              }}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
        {funcs.length < MAX_FUNCTIONS && (
          <button
            onClick={addFunc}
            style={{
              padding: "3px 8px", fontSize: "11px", background: "none",
              border: "1px dashed rgba(0,0,0,0.2)", borderRadius: "3px",
              cursor: "pointer", width: "100%", minHeight: "28px",
            }}
          >
            + Add function
          </button>
        )}
      </div>

      {/* Plot canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: "relative", cursor: isPanning ? "grabbing" : "grab", minHeight: 0 }}
        onPointerDown={handlePanStart}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        />
      </div>

      {/* Axis controls */}
      <div style={{
        display: "flex", alignItems: "center", gap: "4px",
        padding: "4px 6px", flexShrink: 0,
        borderTop: "1px solid rgba(0,0,0,0.1)",
        fontSize: "11px",
        flexWrap: "wrap",
      }}>
        <span>x:</span>
        <input
          type="number"
          value={Math.round(xMin * 100) / 100}
          onChange={(e) => onChange({ xMin: parseFloat(e.target.value) || -10 })}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{ width: 50, padding: "2px 4px", fontSize: "11px", border: "1px solid rgba(0,0,0,0.15)", borderRadius: "3px", minHeight: "28px" }}
        />
        <span>to</span>
        <input
          type="number"
          value={Math.round(xMax * 100) / 100}
          onChange={(e) => onChange({ xMax: parseFloat(e.target.value) || 10 })}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{ width: 50, padding: "2px 4px", fontSize: "11px", border: "1px solid rgba(0,0,0,0.15)", borderRadius: "3px", minHeight: "28px" }}
        />
        <span style={{ marginLeft: 4 }}>y:auto</span>
        <button
          onClick={handleReset}
          title="Reset axes"
          style={{
            marginLeft: "auto", padding: "2px 8px", fontSize: "13px",
            background: "none", border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: "3px", cursor: "pointer", minHeight: "28px",
          }}
        >
          ⟳
        </button>
      </div>
    </div>
  );
}

/** Choose a "nice" step size for grid lines. */
function niceStep(rough: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.abs(rough) || 1)));
  const norm = rough / pow;
  if (norm <= 1.5) return pow;
  if (norm <= 3.5) return 2 * pow;
  if (norm <= 7.5) return 5 * pow;
  return 10 * pow;
}

function formatTickLabel(val: number, step: number): string {
  if (Math.abs(val) < step * 0.01) return "0";
  if (step >= 1) return Math.round(val).toString();
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return val.toFixed(decimals);
}
