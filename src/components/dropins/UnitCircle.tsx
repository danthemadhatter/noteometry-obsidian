import React, { useState, useRef, useEffect, useCallback } from "react";
import type { UnitCircleObject } from "../../lib/canvasObjects";
import { getSignalBus } from "../../services/SignalBus";
import type { SignalState } from "../../services/SignalBus";

const COMMON_ANGLES = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
const SNAP_THRESHOLD = 3; // degrees
const DEG_TO_RAD = Math.PI / 180;

/** Map snapped degree values to exact radian fraction strings. */
const RADIAN_FRACTIONS: Record<number, string> = {
  0: "0",
  30: "\u03C0/6",
  45: "\u03C0/4",
  60: "\u03C0/3",
  90: "\u03C0/2",
  120: "2\u03C0/3",
  135: "3\u03C0/4",
  150: "5\u03C0/6",
  180: "\u03C0",
  210: "7\u03C0/6",
  225: "5\u03C0/4",
  240: "4\u03C0/3",
  270: "3\u03C0/2",
  300: "5\u03C0/3",
  315: "7\u03C0/4",
  330: "11\u03C0/6",
  360: "2\u03C0",
};

interface Props {
  obj: UnitCircleObject;
  onChange: (patch: Partial<UnitCircleObject>) => void;
}

export default function UnitCircle({ obj, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapped, setIsSnapped] = useState(false);
  const [busFrequency, setBusFrequency] = useState<number | null>(null);

  const angleDeg = obj.angleDeg;
  const angleRad = angleDeg * DEG_TO_RAD;
  const cosVal = Math.cos(angleRad);
  const sinVal = Math.sin(angleRad);
  const linked = !!obj.signalLinked;

  /** Snap to common angle if within threshold. */
  const snapAngle = useCallback((deg: number): { deg: number; snapped: boolean } => {
    for (const ca of COMMON_ANGLES) {
      let diff = Math.abs(deg - ca);
      if (diff > 180) diff = 360 - diff;
      if (diff <= SNAP_THRESHOLD) return { deg: ca, snapped: true };
    }
    return { deg, snapped: false };
  }, []);

  /* ── Signal Bus: subscribe when linked ── */
  useEffect(() => {
    if (!linked) { setBusFrequency(null); return; }
    const bus = getSignalBus();
    // Seed bus with our current theta
    bus.update({ theta: angleDeg * DEG_TO_RAD }, obj.id);
    const unsub = bus.subscribe(obj.id, (state: SignalState) => {
      // Move our point to match incoming theta
      let deg = (state.theta * (180 / Math.PI)) % 360;
      if (deg < 0) deg += 360;
      onChange({ angleDeg: deg });
      // Track frequency from bus for display
      setBusFrequency(state.frequency);
    });
    return unsub;
  }, [linked, obj.id]); // light deps — onChange is stable via parent

  // Draw the unit circle
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    const size = Math.min(width, height);
    if (size === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.38;
    const margin = size * 0.08;

    // White background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, size, size);

    // Axes
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, cy);
    ctx.lineTo(size - margin, cy);
    ctx.moveTo(cx, margin);
    ctx.lineTo(cx, size - margin);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#999";
    ctx.font = `${Math.max(10, size * 0.04)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("1", cx + r, cy + size * 0.05);
    ctx.fillText("-1", cx - r, cy + size * 0.05);
    ctx.fillText("1", cx + size * 0.02, cy - r);
    ctx.fillText("-1", cx + size * 0.03, cy + r + size * 0.04);

    // Unit circle
    ctx.strokeStyle = "#bbb";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();

    // Quadrant reference angles (0, 90, 180, 270)
    ctx.fillStyle = "#aaa";
    for (const a of [0, 90, 180, 270]) {
      const rad = a * DEG_TO_RAD;
      const px = cx + r * Math.cos(rad);
      const py = cy - r * Math.sin(rad);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Common angle dots
    ctx.fillStyle = "#ccc";
    for (const a of COMMON_ANGLES) {
      if (a % 90 === 0) continue;
      const rad = a * DEG_TO_RAD;
      const px = cx + r * Math.cos(rad);
      const py = cy - r * Math.sin(rad);
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Current point
    const px = cx + r * cosVal;
    const py = cy - r * sinVal;

    // Right triangle: base + height
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, cy);
    ctx.lineTo(px, py);
    ctx.closePath();
    ctx.stroke();

    // Cos projection (dashed red horizontal)
    ctx.strokeStyle = "#E53935";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(cx, py);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sin projection (dashed blue vertical)
    ctx.strokeStyle = "#4A90D9";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hypotenuse
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Angle arc
    ctx.strokeStyle = "#4A90D9";
    ctx.lineWidth = 2;
    const arcR = r * 0.2;
    ctx.beginPath();
    // Canvas arc goes clockwise, our angles are counter-clockwise
    ctx.arc(cx, cy, arcR, -angleRad, 0, angleDeg > 0);
    ctx.stroke();

    // Draggable point
    ctx.fillStyle = isSnapped ? "#FF9500" : "#4A90D9";
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Snap indicator
    if (isSnapped) {
      ctx.strokeStyle = "rgba(255,149,0,0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }, [angleDeg, angleRad, cosVal, sinVal, isSnapped]);

  useEffect(() => { draw(); }, [draw]);

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  // Pointer drag handling
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.38;

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const px = cx + r * cosVal;
    const py = cy - r * sinVal;

    // Check if click is on the point (with 30px touch target)
    const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
    if (dist <= 30) {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
    }
  }, [cosVal, sinVal]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height);
      const cx = size / 2;
      const cy = size / 2;

      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // atan2 with y inverted (canvas y goes down)
      let deg = Math.atan2(-(my - cy), mx - cx) * (180 / Math.PI);
      if (deg < 0) deg += 360;

      const { deg: snappedDeg, snapped } = snapAngle(deg);
      setIsSnapped(snapped);
      onChange({ angleDeg: snappedDeg });
      // Publish theta to signal bus when linked
      if (linked) {
        getSignalBus().update({ theta: snappedDeg * DEG_TO_RAD }, obj.id);
      }
    };
    const onUp = () => {
      setIsDragging(false);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [isDragging, onChange, snapAngle]);

  // Compute display values
  const tanVal = Math.abs(angleDeg % 180 - 90) < 0.01 ? null : Math.tan(angleRad);
  const radianStr = RADIAN_FRACTIONS[angleDeg] ?? `${(angleRad).toFixed(4)} rad`;
  const isExactFraction = RADIAN_FRACTIONS[angleDeg] !== undefined;

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* Circle canvas — left panel ~60% */}
      <div
        ref={containerRef}
        style={{ flex: "0 0 60%", position: "relative", minWidth: 0, minHeight: 0 }}
        onPointerDown={handlePointerDown}
      >
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      </div>

      {/* Right panel — values */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        padding: "8px", fontSize: "12px", gap: "3px",
        borderLeft: "1px solid rgba(0,0,0,0.1)",
        overflow: "auto",
        minWidth: 0,
      }}>
        <ValueRow label="\u03B8" value={`${angleDeg.toFixed(1)}\u00B0`} />
        <ValueRow label="\u03B8" value={isExactFraction ? `${radianStr} rad` : radianStr} />
        <div style={{ height: 4 }} />
        <ValueRow label="sin" value={sinVal.toFixed(4)} color="#4A90D9" />
        <ValueRow label="cos" value={cosVal.toFixed(4)} color="#E53935" />
        <ValueRow label="tan" value={tanVal !== null ? tanVal.toFixed(4) : "undefined"} />
        <div style={{ height: 4 }} />
        <ValueRow label="z" value={`${cosVal.toFixed(3)}+j\u00B7${sinVal.toFixed(3)}`} />
        <ValueRow label="|z|" value="1.000" />
        <ValueRow label="\u2220z" value={`${angleDeg.toFixed(1)}\u00B0`} />
        {linked && busFrequency !== null && (
          <>
            <div style={{ height: 4 }} />
            <ValueRow label="f" value={`${busFrequency.toFixed(1)} Hz`} color="#4A90D9" />
          </>
        )}

        {/* Quadrant presets */}
        <div style={{ display: "flex", gap: "4px", marginTop: "auto", paddingTop: "6px", flexWrap: "wrap" }}>
          {[
            { label: "Q1", deg: 45 },
            { label: "Q2", deg: 135 },
            { label: "Q3", deg: 225 },
            { label: "Q4", deg: 315 },
          ].map((q) => (
            <button
              key={q.label}
              onClick={() => {
                onChange({ angleDeg: q.deg });
                setIsSnapped(true);
                if (linked) getSignalBus().update({ theta: q.deg * DEG_TO_RAD }, obj.id);
              }}
              style={{
                flex: 1, minWidth: 0, padding: "4px", fontSize: "11px",
                fontWeight: 600, background: "none",
                border: "1px solid rgba(0,0,0,0.15)", borderRadius: "3px",
                cursor: "pointer", minHeight: "32px",
              }}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ValueRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{ fontWeight: 600, width: 28, textAlign: "right", flexShrink: 0, color: color || "inherit" }}>{label}</span>
      <span style={{ fontFamily: "monospace", fontSize: "12px" }}>{value}</span>
    </div>
  );
}
