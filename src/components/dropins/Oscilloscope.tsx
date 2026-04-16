import React, { useState, useRef, useEffect, useCallback } from "react";
import type { OscilloscopeObject, ChannelConfig } from "../../lib/canvasObjects";
import { getSignalBus } from "../../services/SignalBus";
import type { SignalState, WaveformType } from "../../services/SignalBus";

const TIME_DIVS = [10e-6, 50e-6, 100e-6, 500e-6, 1e-3, 5e-3, 10e-3, 50e-3, 100e-3];
const TIME_DIV_LABELS = ["10µs", "50µs", "100µs", "500µs", "1ms", "5ms", "10ms", "50ms", "100ms"];
const VOLTS_DIVS = [0.1, 0.2, 0.5, 1, 2, 5];
const VOLTS_DIV_LABELS = ["0.1V", "0.2V", "0.5V", "1V", "2V", "5V"];
const WAVEFORM_TYPES: ChannelConfig["waveform"][] = ["sine", "square", "sawtooth", "triangle", "pulse", "dc", "off"];

const CHA_COLOR = "#00FF41";
const CHB_COLOR = "#FF9500";
const BG_COLOR = "#0a1628";
const GRID_COLOR = "#1a3a5c";
const GRID_MAJOR = "#2a5a8c";

const SAMPLES = 1000;
const GRID_X = 10;
const GRID_Y = 8;

export function generateSample(t: number, ch: ChannelConfig): number {
  const { waveform, frequency, amplitude, phase, dcOffset } = ch;
  if (waveform === "off") return 0;
  if (waveform === "dc") return amplitude + dcOffset;

  const omega = 2 * Math.PI * frequency;
  const phi = phase * Math.PI / 180;
  const tMod = ((t * frequency % 1) + 1) % 1;

  let val = 0;
  switch (waveform) {
    case "sine":     val = amplitude * Math.sin(omega * t + phi); break;
    case "square":   val = amplitude * (Math.sin(omega * t + phi) >= 0 ? 1 : -1); break;
    case "sawtooth": val = amplitude * (2 * tMod - 1); break;
    case "triangle": val = amplitude * (4 * Math.abs(tMod - 0.5) - 1); break;
    case "pulse":    val = amplitude * (tMod < 0.1 ? 1 : 0); break;
    default:         val = 0;
  }
  return val + dcOffset;
}

interface Props {
  obj: OscilloscopeObject;
  onChange: (patch: Partial<OscilloscopeObject>) => void;
  onSendToAI?: (dataUrl: string) => void;
}

export default function Oscilloscope({ obj, onChange, onSendToAI }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const timeOffsetRef = useRef(0);
  const lastFrameRef = useRef(0);
  /** Suppresses bus subscription callbacks when we are the publisher. */
  const suppressBusRef = useRef(false);

  const timeDiv = TIME_DIVS[obj.timeDivIndex] ?? 1e-3;
  const totalTime = GRID_X * timeDiv;

  const chA = obj.channelA;
  const chB = obj.channelB;
  const linked = !!obj.signalLinked;

  const updateChA = useCallback((patch: Partial<ChannelConfig>) => {
    onChange({ channelA: { ...chA, ...patch } });
    // Publish relevant fields to signal bus when linked
    if (linked) {
      const busPatch: Partial<SignalState> = {};
      if (patch.frequency !== undefined) busPatch.frequency = patch.frequency;
      if (patch.amplitude !== undefined) busPatch.amplitude = patch.amplitude;
      if (patch.phase !== undefined) busPatch.phase = patch.phase * Math.PI / 180; // deg→rad
      if (patch.waveform !== undefined && patch.waveform !== "off") busPatch.waveformType = patch.waveform as WaveformType;
      if (Object.keys(busPatch).length > 0) {
        getSignalBus().update(busPatch, obj.id);
      }
    }
  }, [chA, onChange, linked, obj.id]);

  const updateChB = useCallback((patch: Partial<ChannelConfig>) => {
    onChange({ channelB: { ...chB, ...patch } });
  }, [chB, onChange]);

  /* ── Signal Bus: publish isPlaying when Run/Stop is toggled ── */
  const handleRunStop = useCallback(() => {
    const next = !obj.running;
    onChange({ running: next });
    if (linked) {
      getSignalBus().update({ isPlaying: next }, obj.id);
    }
  }, [obj.running, onChange, linked, obj.id]);

  /* ── Signal Bus: subscribe when linked ── */
  useEffect(() => {
    if (!linked) return;
    const bus = getSignalBus();
    // Seed bus with current oscilloscope state
    bus.update({
      frequency: chA.frequency,
      amplitude: chA.amplitude,
      phase: chA.phase * Math.PI / 180,
      waveformType: (chA.waveform !== "off" ? chA.waveform : "sine") as WaveformType,
      isPlaying: obj.running,
      theta: timeOffsetRef.current * 2 * Math.PI * chA.frequency,
    }, obj.id);

    const unsub = bus.subscribe(obj.id, (state: SignalState) => {
      if (suppressBusRef.current) return;
      // External theta: if we are playing, pause and snap
      const patch: Partial<OscilloscopeObject> = {};
      let chAPatch: Partial<ChannelConfig> | null = null;

      if (state.frequency !== chA.frequency) {
        chAPatch = { ...(chAPatch ?? {}), frequency: state.frequency };
      }
      if (state.amplitude !== chA.amplitude) {
        chAPatch = { ...(chAPatch ?? {}), amplitude: state.amplitude };
      }
      const busPhase = state.phase * 180 / Math.PI;
      if (Math.abs(busPhase - chA.phase) > 0.01) {
        chAPatch = { ...(chAPatch ?? {}), phase: busPhase };
      }
      if (state.waveformType !== chA.waveform && chA.waveform !== "off") {
        chAPatch = { ...(chAPatch ?? {}), waveform: state.waveformType };
      }
      if (chAPatch) {
        patch.channelA = { ...chA, ...chAPatch };
      }

      // Theta → time offset: θ = 2πft → t = θ/(2πf)
      const f = state.frequency || 1;
      const newTimeOffset = state.theta / (2 * Math.PI * f);
      timeOffsetRef.current = newTimeOffset;

      // If receiving external theta while playing, pause
      if (obj.running && !state.isPlaying) {
        patch.running = false;
      }

      if (Object.keys(patch).length > 0) {
        onChange(patch);
      }
    });
    return unsub;
  }, [linked, obj.id]); // intentionally light deps — refs handle rest

  // Draw a frame
  const drawFrame = useCallback((timestamp?: number) => {
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

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Grid
    const cellW = width / GRID_X;
    const cellH = height / GRID_Y;

    // Minor grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let i = 1; i < GRID_X; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellW, 0);
      ctx.lineTo(i * cellW, height);
      ctx.stroke();
    }
    for (let j = 1; j < GRID_Y; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * cellH);
      ctx.lineTo(width, j * cellH);
      ctx.stroke();
    }

    // Major grid lines (center lines)
    ctx.strokeStyle = GRID_MAJOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Grid dots at intersections
    ctx.fillStyle = GRID_MAJOR;
    for (let i = 0; i <= GRID_X; i++) {
      for (let j = 0; j <= GRID_Y; j++) {
        ctx.beginPath();
        ctx.arc(i * cellW, j * cellH, 1, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    const t0 = timeOffsetRef.current;

    // Draw traces
    const drawTrace = (ch: ChannelConfig, color: string) => {
      if (!ch.visible || ch.waveform === "off") return;
      const voltsDiv = VOLTS_DIVS[ch.voltsDivIndex] ?? 1;
      const pixPerVolt = cellH / voltsDiv;
      const yCenter = height / 2 - ch.yOffset * pixPerVolt;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let first = true;
      for (let i = 0; i <= SAMPLES; i++) {
        const t = t0 + (i / SAMPLES) * totalTime;
        const v = generateSample(t, ch);
        const sx = (i / SAMPLES) * width;
        const sy = yCenter - v * pixPerVolt;
        if (first) { ctx.moveTo(sx, sy); first = false; }
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    };

    drawTrace(chA, CHA_COLOR);
    drawTrace(chB, CHB_COLOR);
  }, [chA, chB, totalTime]);

  // Animation loop
  useEffect(() => {
    if (!obj.running) {
      drawFrame();
      return;
    }
    lastFrameRef.current = performance.now();
    let frameCount = 0;
    const animate = (timestamp: number) => {
      const dt = (timestamp - lastFrameRef.current) / 1000;
      lastFrameRef.current = timestamp;
      timeOffsetRef.current += dt * 0.1; // slow scroll
      drawFrame(timestamp);
      // Publish theta to signal bus at ~30fps (every other rAF at 60fps)
      if (linked && (frameCount++ % 2 === 0)) {
        const theta = timeOffsetRef.current * 2 * Math.PI * (chA.frequency || 1);
        getSignalBus().update({ theta, isPlaying: true }, obj.id);
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [obj.running, drawFrame, linked, obj.id, chA.frequency]);

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => drawFrame());
    ro.observe(container);
    return () => ro.disconnect();
  }, [drawFrame]);

  // Measurements for CH A
  const measurements = computeMeasurements(chA, totalTime);

  const handleSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onSendToAI) return;
    onSendToAI(canvas.toDataURL("image/png"));
  }, [onSendToAI]);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* Channel controls */}
      <div style={{
        display: "flex", alignItems: "center", gap: "6px",
        padding: "4px 6px", flexShrink: 0,
        borderBottom: "1px solid rgba(0,0,0,0.1)",
        flexWrap: "wrap",
      }}>
        <button
          onClick={() => updateChA({ visible: !chA.visible })}
          style={{
            padding: "3px 8px", fontSize: "11px", fontWeight: 600,
            background: chA.visible ? CHA_COLOR : "transparent",
            color: chA.visible ? "#000" : "#666",
            border: `1px solid ${CHA_COLOR}`, borderRadius: "3px",
            cursor: "pointer", minHeight: "28px",
          }}
        >
          CH A
        </button>
        <button
          onClick={() => updateChB({ visible: !chB.visible })}
          style={{
            padding: "3px 8px", fontSize: "11px", fontWeight: 600,
            background: chB.visible ? CHB_COLOR : "transparent",
            color: chB.visible ? "#000" : "#666",
            border: `1px solid ${CHB_COLOR}`, borderRadius: "3px",
            cursor: "pointer", minHeight: "28px",
          }}
        >
          CH B
        </button>
        <select
          value={obj.timeDivIndex}
          onChange={(e) => onChange({ timeDivIndex: parseInt(e.target.value) })}
          onPointerDown={(e) => e.stopPropagation()}
          style={{ fontSize: "11px", padding: "2px 4px", minHeight: "28px", borderRadius: "3px", border: "1px solid rgba(0,0,0,0.15)" }}
        >
          {TIME_DIV_LABELS.map((label, i) => (
            <option key={i} value={i}>{label}/div</option>
          ))}
        </select>
        <button
          onClick={handleRunStop}
          style={{
            padding: "3px 8px", fontSize: "11px", fontWeight: 600,
            background: obj.running ? "#E53935" : "#43A047",
            color: "#fff", border: "none", borderRadius: "3px",
            cursor: "pointer", minHeight: "28px", marginLeft: "auto",
          }}
        >
          {obj.running ? "Stop" : "Run"}
        </button>
        {onSendToAI && (
          <button
            onClick={handleSnapshot}
            title="Send to AI"
            style={{
              padding: "3px 6px", fontSize: "11px", background: "none",
              border: "1px solid rgba(0,0,0,0.15)", borderRadius: "3px",
              cursor: "pointer", minHeight: "28px",
            }}
          >
            snapshot
          </button>
        )}
      </div>

      {/* Scope display */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: "relative", background: BG_COLOR, minHeight: 0 }}
      >
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        />
      </div>

      {/* Measurements */}
      <div style={{
        display: "flex", gap: "8px", padding: "2px 6px", fontSize: "10px",
        color: CHA_COLOR, background: "#0d1e33", flexShrink: 0, flexWrap: "wrap",
        fontFamily: "monospace",
      }}>
        <span>Freq: {measurements.freq}</span>
        <span>Per: {measurements.period}</span>
        <span>Vpp: {measurements.vpp}</span>
        <span>Vrms: {measurements.vrms}</span>
      </div>

      {/* Signal config */}
      <div style={{
        display: "flex", flexDirection: "column", gap: "3px",
        padding: "4px 6px", flexShrink: 0,
        borderTop: "1px solid rgba(0,0,0,0.1)",
        fontSize: "11px",
      }}>
        <ChannelRow label="CHA" color={CHA_COLOR} ch={chA} onUpdate={updateChA} />
        <ChannelRow label="CHB" color={CHB_COLOR} ch={chB} onUpdate={updateChB} />
      </div>
    </div>
  );
}

function ChannelRow({ label, color, ch, onUpdate }: {
  label: string;
  color: string;
  ch: ChannelConfig;
  onUpdate: (patch: Partial<ChannelConfig>) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
      <span style={{ fontWeight: 600, color, width: 32, flexShrink: 0 }}>{label}</span>
      <select
        value={ch.waveform}
        onChange={(e) => onUpdate({ waveform: e.target.value as ChannelConfig["waveform"] })}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ fontSize: "11px", padding: "1px 2px", minHeight: "28px", borderRadius: "3px", border: "1px solid rgba(0,0,0,0.15)" }}
      >
        {WAVEFORM_TYPES.map((w) => (
          <option key={w} value={w}>{w}</option>
        ))}
      </select>
      <NumInput label="f" value={ch.frequency} unit="Hz" onChange={(v) => onUpdate({ frequency: v })} />
      <NumInput label="A" value={ch.amplitude} unit="V" onChange={(v) => onUpdate({ amplitude: v })} />
      <NumInput label="φ" value={ch.phase} unit="°" onChange={(v) => onUpdate({ phase: v })} />
      <select
        value={ch.voltsDivIndex}
        onChange={(e) => onUpdate({ voltsDivIndex: parseInt(e.target.value) })}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ fontSize: "10px", padding: "1px 2px", minHeight: "28px", borderRadius: "3px", border: "1px solid rgba(0,0,0,0.15)" }}
      >
        {VOLTS_DIV_LABELS.map((label, i) => (
          <option key={i} value={i}>{label}</option>
        ))}
      </select>
    </div>
  );
}

function NumInput({ label, value, unit, onChange }: {
  label: string;
  value: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
      <span style={{ fontSize: "10px", color: "#888" }}>{label}:</span>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (isFinite(v)) onChange(v);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        style={{
          width: 52, padding: "1px 3px", fontSize: "11px",
          border: "1px solid rgba(0,0,0,0.15)", borderRadius: "3px",
          minHeight: "28px", boxSizing: "border-box",
          background: "var(--nm-paper, #fff)",
        }}
      />
      <span style={{ fontSize: "10px", color: "#888" }}>{unit}</span>
    </div>
  );
}

function computeMeasurements(ch: ChannelConfig, totalTime: number) {
  if (ch.waveform === "off" || ch.waveform === "dc") {
    return { freq: "--", period: "--", vpp: ch.waveform === "dc" ? "0.00V" : "--", vrms: ch.waveform === "dc" ? `${ch.amplitude.toFixed(2)}V` : "--" };
  }

  const freq = ch.frequency;
  const period = 1 / freq;
  const amp = ch.amplitude;

  // Vpp = 2 * amplitude for sine/square/sawtooth/triangle
  let vpp = 2 * amp;
  if (ch.waveform === "pulse") vpp = amp;

  // Vrms
  let vrms = 0;
  switch (ch.waveform) {
    case "sine": vrms = amp / Math.sqrt(2); break;
    case "square": vrms = amp; break;
    case "sawtooth": vrms = amp / Math.sqrt(3); break;
    case "triangle": vrms = amp / Math.sqrt(3); break;
    case "pulse": vrms = amp * Math.sqrt(0.1); break;
    default: vrms = 0;
  }

  return {
    freq: formatFreq(freq),
    period: formatTime(period),
    vpp: `${vpp.toFixed(2)}V`,
    vrms: `${vrms.toFixed(3)}V`,
  };
}

function formatFreq(hz: number): string {
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)}MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(2)}kHz`;
  return `${hz.toFixed(2)}Hz`;
}

function formatTime(s: number): string {
  if (s < 1e-6) return `${(s * 1e9).toFixed(1)}ns`;
  if (s < 1e-3) return `${(s * 1e6).toFixed(1)}µs`;
  if (s < 1) return `${(s * 1e3).toFixed(2)}ms`;
  return `${s.toFixed(4)}s`;
}
