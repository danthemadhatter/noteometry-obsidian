import React, { useRef, useEffect, useCallback, useState } from "react";

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

const panBtn: React.CSSProperties = {
  width: "22px", height: "20px", padding: 0,
  border: "1px solid #E0E0E0", borderRadius: "3px",
  background: "var(--nm-faceplate)", color: "var(--nm-ink)",
  cursor: "pointer", fontSize: "11px", lineHeight: 1,
};

function evalExpr(expr: string, x: number): number {
  try {
    const fn = new Function("x", "Math",
      `with(Math){return (${expr})}`
    );
    return fn(x, Math);
  } catch { return NaN; }
}

export default function GraphPlotterDropin({ functions, viewX, viewY, viewW, viewH, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [addExpr, setAddExpr] = useState("");

  // Signal-bus subscription was a stub (empty callback) — removed in
  // v1.6.6 rather than left as dead wiring. The plotter is now purely
  // expression-driven; reintroduce when there's an actual signal shape
  // to consume.

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

  const panBy = useCallback((fracX: number, fracY: number) => {
    onChange({ viewX: viewX + viewW * fracX, viewY: viewY + viewH * fracY });
  }, [viewX, viewY, viewW, viewH, onChange]);

  const zoomBy = useCallback((factor: number) => {
    const cx = viewX + viewW / 2;
    const cy = viewY + viewH / 2;
    const nw = viewW * factor;
    const nh = viewH * factor;
    onChange({ viewX: cx - nw / 2, viewY: cy - nh / 2, viewW: nw, viewH: nh });
  }, [viewX, viewY, viewW, viewH, onChange]);

  const resetView = useCallback(() => {
    onChange({ viewX: -10, viewY: -2, viewW: 20, viewH: 4 });
  }, [onChange]);

  /* Direct canvas pan/zoom — users expect click-and-drag to pan and
   * wheel to zoom, in addition to the button row. Button-row fallback
   * remains for touch/pen. v1.6.6 patch: the view transform buttons
   * existed but users reported "pan/zoom does not work" because they
   * reached for mouse/wheel gestures first. */
  const dragStateRef = useRef<{ startX: number; startY: number; viewX0: number; viewY0: number } | null>(null);

  const onCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, viewX0: viewX, viewY0: viewY };
  }, [viewX, viewY]);

  const onCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const st = dragStateRef.current;
    if (!st) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dxScreen = e.clientX - st.startX;
    const dyScreen = e.clientY - st.startY;
    const worldDx = -(dxScreen / rect.width) * viewW;
    const worldDy = (dyScreen / rect.height) * viewH;
    onChange({ viewX: st.viewX0 + worldDx, viewY: st.viewY0 + worldDy });
  }, [viewW, viewH, onChange]);

  const onCanvasPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragStateRef.current) {
      try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch { /* empty */ }
    }
    dragStateRef.current = null;
  }, []);

  const onCanvasWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const cvs = canvasRef.current;
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    // Mouse position in world-space → keep it anchored after zoom.
    const mx = viewX + ((e.clientX - rect.left) / rect.width) * viewW;
    const my = viewY + (1 - (e.clientY - rect.top) / rect.height) * viewH;
    // Two-finger trackpad pinch reports ctrlKey=true in Chromium/Electron.
    // Small steps feel more natural at that granularity.
    const base = e.ctrlKey ? 0.01 : 0.0015;
    const factor = Math.exp(e.deltaY * base);
    const nw = viewW * factor;
    const nh = viewH * factor;
    const newViewX = mx - ((e.clientX - rect.left) / rect.width) * nw;
    const newViewY = my - (1 - (e.clientY - rect.top) / rect.height) * nh;
    onChange({ viewX: newViewX, viewY: newViewY, viewW: nw, viewH: nh });
  }, [viewX, viewY, viewW, viewH, onChange]);

  // Prevent passive default handler from swallowing the wheel event.
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const block = (ev: WheelEvent) => { ev.preventDefault(); };
    cvs.addEventListener("wheel", block, { passive: false });
    return () => cvs.removeEventListener("wheel", block);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          width={400} height={250}
          style={{ width: "100%", height: "100%", display: "block", cursor: dragStateRef.current ? "grabbing" : "grab", touchAction: "none" }}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
          onWheel={onCanvasWheel}
        />
      </div>
      <div style={{ padding: "4px 8px", fontSize: "11px", borderTop: "1px solid #E0E0E0" }}>
        <div style={{ display: "flex", gap: "2px", marginBottom: "4px", alignItems: "center" }}>
          <span style={{ fontWeight: 600, color: "var(--nm-ink)", marginRight: "4px" }}>View</span>
          <button onClick={() => panBy(-0.25, 0)} style={panBtn} title="Pan left">◀</button>
          <button onClick={() => panBy(0.25, 0)} style={panBtn} title="Pan right">▶</button>
          <button onClick={() => panBy(0, 0.25)} style={panBtn} title="Pan up">▲</button>
          <button onClick={() => panBy(0, -0.25)} style={panBtn} title="Pan down">▼</button>
          <span style={{ width: "6px" }} />
          <button onClick={() => zoomBy(0.8)} style={panBtn} title="Zoom in">＋</button>
          <button onClick={() => zoomBy(1.25)} style={panBtn} title="Zoom out">−</button>
          <button onClick={resetView} style={{ ...panBtn, width: "auto", padding: "1px 6px" }} title="Reset view">Reset</button>
        </div>
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
