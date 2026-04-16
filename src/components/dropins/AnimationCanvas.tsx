import React, { useRef, useEffect, useState, useCallback } from "react";
import type { AnimationCanvasObject } from "../../lib/canvasObjects";

interface Props {
  obj: AnimationCanvasObject;
  onChange: (patch: Partial<AnimationCanvasObject>) => void;
}

const FRAME_COLORS = ["#4A90D9", "#F5A623", "#DC2626", "#16A34A", "#7C3AED"];

export default function AnimationCanvas({ obj, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(obj.playing);
  const animRef = useRef<number>(0);
  const frameRef = useRef(obj.currentFrame);

  const drawFrame = useCallback((frameIdx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // Draw frame indicator
    const frames = obj.frames;
    if (frames.length === 0) {
      ctx.fillStyle = "var(--nm-ink-muted, #999)";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No frames — click + to add", w / 2, h / 2);
      return;
    }

    const frame = frames[frameIdx % frames.length];
    if (!frame) return;

    // Draw each path in the frame
    for (const path of frame.paths) {
      if (path.points.length < 2) continue;
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(path.points[0]!.x * w, path.points[0]!.y * h);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i]!.x * w, path.points[i]!.y * h);
      }
      ctx.stroke();
    }

    // Frame number badge
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${frameIdx + 1}/${frames.length}`, 6, 14);
  }, [obj.frames]);

  // Playback loop
  useEffect(() => {
    if (!playing || obj.frames.length <= 1) return;
    const interval = 1000 / obj.fps;
    const tick = () => {
      frameRef.current = (frameRef.current + 1) % obj.frames.length;
      drawFrame(frameRef.current);
      animRef.current = window.setTimeout(tick, interval);
    };
    animRef.current = window.setTimeout(tick, interval);
    return () => clearTimeout(animRef.current);
  }, [playing, obj.fps, obj.frames.length, drawFrame]);

  // Draw on mount + frame changes
  useEffect(() => {
    drawFrame(obj.currentFrame);
  }, [obj.currentFrame, drawFrame]);

  const addFrame = () => {
    const newFrame = { paths: [], id: crypto.randomUUID() };
    const frames = [...obj.frames, newFrame];
    onChange({ frames, currentFrame: frames.length - 1 });
  };

  const deleteFrame = () => {
    if (obj.frames.length <= 1) return;
    const frames = obj.frames.filter((_, i) => i !== obj.currentFrame);
    const cf = Math.min(obj.currentFrame, frames.length - 1);
    onChange({ frames, currentFrame: cf });
  };

  const togglePlay = () => {
    const next = !playing;
    setPlaying(next);
    onChange({ playing: next });
  };

  const prevFrame = () => {
    const cf = (obj.currentFrame - 1 + obj.frames.length) % obj.frames.length;
    frameRef.current = cf;
    onChange({ currentFrame: cf });
  };

  const nextFrame = () => {
    const cf = (obj.currentFrame + 1) % obj.frames.length;
    frameRef.current = cf;
    onChange({ currentFrame: cf });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fafafa" }}>
      <canvas
        ref={canvasRef}
        style={{ flex: 1, width: "100%", cursor: "crosshair" }}
      />
      <div style={{
        display: "flex", alignItems: "center", gap: 4, padding: "4px 6px",
        borderTop: "1px solid var(--nm-paper-border, #e0e0e0)",
        fontSize: 11, fontWeight: 600,
      }}>
        <button onClick={prevFrame} style={btnStyle} title="Previous frame">◀</button>
        <button onClick={togglePlay} style={btnStyle} title={playing ? "Pause" : "Play"}>
          {playing ? "⏸" : "▶"}
        </button>
        <button onClick={nextFrame} style={btnStyle} title="Next frame">▶</button>
        <span style={{ margin: "0 4px", color: "#666" }}>
          {obj.currentFrame + 1}/{obj.frames.length} @ {obj.fps}fps
        </span>
        <button onClick={addFrame} style={btnStyle} title="Add frame">+</button>
        <button onClick={deleteFrame} style={{ ...btnStyle, color: "var(--nm-danger, #dc2626)" }} title="Delete frame">−</button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  border: "1px solid var(--nm-paper-border, #e0e0e0)",
  borderRadius: 4,
  background: "white",
  cursor: "pointer",
  padding: "2px 6px",
  fontSize: 11,
};
