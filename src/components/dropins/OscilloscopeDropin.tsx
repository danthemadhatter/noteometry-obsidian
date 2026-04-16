import React, { useRef, useEffect, useCallback, useState } from "react";
import { signalBus } from "../../lib/SignalBus";

interface ChannelConfig {
  waveform: "sine" | "square" | "triangle" | "sawtooth" | "pulse" | "noise" | "dc" | "off";
  frequency: number;
  amplitude: number;
  phase: number;
  offset: number;
}

interface Props {
  id: string;
  channelA: ChannelConfig;
  channelB: ChannelConfig;
  timeDiv: number;
  signalLinked: boolean;
  onChange: (updates: Partial<{ channelA: ChannelConfig; channelB: ChannelConfig; timeDiv: number }>) => void;
}

const WAVEFORMS = ["sine", "square", "triangle", "sawtooth", "pulse", "noise", "dc", "off"] as const;

function generateSample(cfg: ChannelConfig, t: number): number {
  if (cfg.waveform === "off") return 0;
  if (cfg.waveform === "dc") return cfg.amplitude + cfg.offset;
  if (cfg.waveform === "noise") return (Math.random() * 2 - 1) * cfg.amplitude + cfg.offset;

  const phase = t * cfg.frequency * 2 * Math.PI + cfg.phase;
  let v = 0;
  switch (cfg.waveform) {
    case "sine": v = Math.sin(phase); break;
    case "square": v = Math.sin(phase) >= 0 ? 1 : -1; break;
    case "triangle": v = 2 * Math.abs(2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + 0.5))) - 1; break;
    case "sawtooth": v = 2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + 0.5)); break;
    case "pulse": v = (phase % (2 * Math.PI)) < Math.PI * 0.2 ? 1 : -1; break;
  }
  return v * cfg.amplitude + cfg.offset;
}

export default function OscilloscopeDropin({ id, channelA, channelB, timeDiv, signalLinked, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState<"A" | "B">("A");
  const animRef = useRef<number>(0);

  // Signal Bus
  useEffect(() => {
    if (!signalLinked) return;
    signalBus.publish("frequency", channelA.frequency, id);
    signalBus.publish("amplitude", channelA.amplitude, id);
    signalBus.publish("phase", channelA.phase, id);
  }, [channelA.frequency, channelA.amplitude, channelA.phase, signalLinked, id]);

  // Animation loop
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    let t0 = performance.now();

    const draw = () => {
      const W = cvs.width, H = cvs.height;
      const elapsed = (performance.now() - t0) / 1000;

      // Phosphor background
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = "#1a3a1a";
      ctx.lineWidth = 0.5;
      const gx = W / 10, gy = H / 8;
      for (let i = 1; i < 10; i++) {
        ctx.beginPath(); ctx.moveTo(i * gx, 0); ctx.lineTo(i * gx, H); ctx.stroke();
      }
      for (let i = 1; i < 8; i++) {
        ctx.beginPath(); ctx.moveTo(0, i * gy); ctx.lineTo(W, i * gy); ctx.stroke();
      }

      // Center lines
      ctx.strokeStyle = "#2a5a2a";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();

      // Draw channels
      const drawChannel = (cfg: ChannelConfig, color: string) => {
        if (cfg.waveform === "off") return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        const totalTime = timeDiv * 10 / 1000; // 10 divisions
        for (let px = 0; px < W; px++) {
          const t = elapsed + (px / W) * totalTime;
          const v = generateSample(cfg, t);
          const sy = H / 2 - (v / 2) * H * 0.4;
          if (px === 0) ctx.moveTo(px, sy);
          else ctx.lineTo(px, sy);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      };

      drawChannel(channelA, "#22c55e");
      drawChannel(channelB, "#facc15");

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [channelA, channelB, timeDiv]);

  const activeCh = activeTab === "A" ? channelA : channelB;
  const setChannel = useCallback((updates: Partial<ChannelConfig>) => {
    if (activeTab === "A") {
      onChange({ channelA: { ...channelA, ...updates } });
    } else {
      onChange({ channelB: { ...channelB, ...updates } });
    }
  }, [activeTab, channelA, channelB, onChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0a0a0a" }}>
      <div style={{ display: "flex", gap: "4px", padding: "4px 8px" }}>
        {(["A", "B"] as const).map(ch => (
          <button key={ch} onClick={() => setActiveTab(ch)}
            style={{
              padding: "2px 12px", fontSize: "11px", fontWeight: 700, border: "none",
              borderRadius: "3px", cursor: "pointer",
              background: activeTab === ch ? (ch === "A" ? "#22c55e" : "#facc15") : "#333",
              color: activeTab === ch ? "#000" : "#999",
            }}
          >CH {ch}</button>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ color: "#22c55e", fontSize: "10px", fontFamily: "monospace" }}>
          {timeDiv}ms/div
        </span>
      </div>
      <canvas ref={canvasRef} width={460} height={280}
        style={{ width: "100%", flex: 1, minHeight: 0 }}
      />
      <div style={{ padding: "4px 8px", fontSize: "10px", color: "#22c55e", fontFamily: "monospace", borderTop: "1px solid #1a3a1a" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Freq: {activeCh.frequency}Hz</span>
          <span>Per: {(1000 / activeCh.frequency).toFixed(3)}ms</span>
          <span>Vpp: {(activeCh.amplitude * 2).toFixed(3)}</span>
          <span>Vrms: {(activeCh.amplitude * 0.7071).toFixed(3)}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "4px", padding: "4px 8px", flexWrap: "wrap" }}>
        <select value={activeCh.waveform}
          onChange={e => setChannel({ waveform: e.target.value as ChannelConfig["waveform"] })}
          style={{ fontSize: "10px", padding: "2px", background: "#222", color: "#ccc", border: "1px solid #444", borderRadius: "3px" }}
        >
          {WAVEFORMS.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <label style={{ color: "#999", fontSize: "10px" }}>f:
          <input type="number" value={activeCh.frequency}
            onChange={e => setChannel({ frequency: Number(e.target.value) || 1 })}
            style={{ width: "50px", fontSize: "10px", background: "#222", color: "#ccc", border: "1px solid #444", borderRadius: "3px", padding: "2px", marginLeft: "2px" }}
          />
        </label>
        <label style={{ color: "#999", fontSize: "10px" }}>A:
          <input type="number" value={activeCh.amplitude} step="0.1"
            onChange={e => setChannel({ amplitude: Number(e.target.value) || 0 })}
            style={{ width: "40px", fontSize: "10px", background: "#222", color: "#ccc", border: "1px solid #444", borderRadius: "3px", padding: "2px", marginLeft: "2px" }}
          />
        </label>
      </div>
    </div>
  );
}
