import React, { useRef, useEffect, useCallback } from "react";
import { signalBus } from "../../lib/SignalBus";

interface Props {
  id: string;
  angleDeg: number;
  signalLinked: boolean;
  onChange: (updates: { angleDeg: number }) => void;
}

const SNAP_ANGLES = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const SNAP_THRESHOLD = 5;

function snapAngle(deg: number): number {
  for (const sa of SNAP_ANGLES) {
    if (Math.abs(deg - sa) < SNAP_THRESHOLD) return sa % 360;
  }
  return deg;
}

function fmt(v: number, decimals = 4): string {
  return v.toFixed(decimals);
}

export default function UnitCircleDropin({ id, angleDeg, signalLinked, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);

  // Signal Bus
  useEffect(() => {
    if (!signalLinked) return;
    return signalBus.subscribe("theta", (rad) => {
      onChange({ angleDeg: (rad * RAD2DEG + 360) % 360 });
    }, id);
  }, [signalLinked, id, onChange]);

  useEffect(() => {
    if (signalLinked) {
      signalBus.publish("theta", angleDeg * DEG2RAD, id);
    }
  }, [angleDeg, signalLinked, id]);

  // Draw circle
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const W = cvs.width, H = cvs.height;
    const cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) * 0.38;
    const rad = angleDeg * DEG2RAD;
    const px = cx + r * Math.cos(rad);
    const py = cy - r * Math.sin(rad);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#FAFAFA";
    ctx.fillRect(0, 0, W, H);

    // Axes
    ctx.strokeStyle = "#D0D0D0";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();

    // Circle
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

    // Angle arc
    ctx.strokeStyle = "var(--nm-accent, #4A90D9)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.2, 0, -rad, rad > 0); ctx.stroke();

    // Radius line
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();

    // cos/sin projections
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#DC2626"; // sin = red
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, cy); ctx.stroke();
    ctx.strokeStyle = "#2563EB"; // cos = blue
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx, py); ctx.stroke();
    ctx.setLineDash([]);

    // Point
    ctx.fillStyle = "#F59E0B";
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [angleDeg]);

  // Drag handler
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const mx = e.clientX - rect.left - cx;
    const my = -(e.clientY - rect.top - cy);
    let deg = Math.atan2(my, mx) * RAD2DEG;
    if (deg < 0) deg += 360;
    onChange({ angleDeg: snapAngle(deg) });
  }, [onChange]);

  const handlePointerUp = useCallback(() => { dragging.current = false; }, []);

  const rad = angleDeg * DEG2RAD;
  const cosV = Math.cos(rad), sinV = Math.sin(rad), tanV = Math.tan(rad);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: "11px", fontFamily: "var(--nm-font-mono, monospace)" }}>
      <canvas
        ref={canvasRef} width={240} height={240}
        style={{ width: "100%", aspectRatio: "1", cursor: "crosshair" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <div style={{ padding: "6px 8px", borderTop: "1px solid #E0E0E0", lineHeight: 1.6 }}>
        <div><b>θ</b> {fmt(angleDeg, 1)}°</div>
        <div><b>θ</b> {fmt(rad, 4)} rad</div>
        <div style={{ color: "#DC2626" }}><b>sin</b> {fmt(sinV)}</div>
        <div style={{ color: "#2563EB" }}><b>cos</b> {fmt(cosV)}</div>
        <div><b>tan</b> {fmt(tanV)}</div>
        <div style={{ marginTop: "4px" }}>
          <b>z</b> = {fmt(cosV)}+j{fmt(sinV)}
        </div>
        <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
          {[1, 2, 3, 4].map(q => (
            <button key={q} onClick={() => onChange({ angleDeg: (q - 1) * 90 + 45 })}
              style={{
                flex: 1, padding: "4px", fontSize: "11px", border: "1px solid #E0E0E0",
                borderRadius: "4px", cursor: "pointer",
                background: "var(--nm-faceplate)", color: "var(--nm-ink)",
              }}
            >Q{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
