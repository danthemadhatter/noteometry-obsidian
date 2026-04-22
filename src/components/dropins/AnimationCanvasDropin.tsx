import React, { useRef, useEffect, useState, useCallback } from "react";

interface Props {
  frames: string[];
  currentFrame: number;
  fps: number;
  onChange: (updates: { frames?: string[]; currentFrame?: number; fps?: number }) => void;
}

export default function AnimationCanvasDropin({ frames, currentFrame, fps, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const frameRef = useRef(currentFrame);
  frameRef.current = currentFrame;
  const framesLenRef = useRef(frames.length);
  framesLenRef.current = frames.length;

  // Draw current frame
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    const frameData = frames[currentFrame];
    if (frameData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = frameData;
    }
  }, [currentFrame, frames]);

  // Play/pause — use refs to avoid effect re-triggering on every frame advance
  useEffect(() => {
    if (playing && framesLenRef.current > 1) {
      intervalRef.current = setInterval(() => {
        const next = (frameRef.current + 1) % framesLenRef.current;
        onChangeRef.current({ currentFrame: next });
      }, 1000 / fps);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, fps]);

  // Save frame
  const saveFrame = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const dataUrl = cvs.toDataURL("image/png");
    const next = [...frames];
    next[currentFrame] = dataUrl;
    onChange({ frames: next });
  }, [currentFrame, frames, onChange]);

  // Drawing handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (playing) return;
    setDrawing(true);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    lastPoint.current = {
      x: (e.clientX - rect.left) * (400 / rect.width),
      y: (e.clientY - rect.top) * (300 / rect.height),
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [playing]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawing || !lastPoint.current) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const rect = cvs.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (400 / rect.width);
    const y = (e.clientY - rect.top) * (300 / rect.height);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPoint.current = { x, y };
  }, [drawing]);

  const handlePointerUp = useCallback(() => {
    setDrawing(false);
    lastPoint.current = null;
    saveFrame();
  }, [saveFrame]);

  const addFrame = useCallback(() => {
    const next = [...frames, ""];
    onChange({ frames: next, currentFrame: next.length - 1 });
  }, [frames, onChange]);

  const showHint = frames.length <= 1 && !(frames[0] && frames[0].length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef} width={400} height={300}
        style={{ width: "100%", flex: 1, minHeight: 0, cursor: playing ? "default" : "crosshair" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {showHint && (
        <div style={{
          position: "absolute", top: "8px", left: "8px", right: "8px",
          padding: "6px 8px",
          background: "var(--nm-accent-light, rgba(74,144,217,0.12))",
          border: "1px dashed var(--nm-accent, #4a90d9)",
          borderRadius: "4px", fontSize: "10px",
          color: "var(--nm-ink)", fontFamily: "var(--nm-font, sans-serif)",
          lineHeight: 1.35, pointerEvents: "none",
        }}>
          <strong>Animation:</strong> draw on this frame, then +Frame to add another.
          Play cycles through them. Per-frame onion-style sketching.
        </div>
      )}
      <div style={{
        display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px",
        borderTop: "1px solid #E0E0E0", fontSize: "11px", background: "var(--nm-faceplate)",
      }}>
        <button onClick={() => setPlaying(!playing)}
          style={{ padding: "2px 8px", fontSize: "11px", border: "1px solid #E0E0E0", borderRadius: "4px", cursor: "pointer", background: playing ? "#DC2626" : "var(--nm-accent)", color: "#fff" }}
        >{playing ? "Stop" : "Play"}</button>
        <button onClick={() => onChange({ currentFrame: Math.max(0, currentFrame - 1) })}
          style={{ padding: "2px 6px", border: "1px solid #E0E0E0", borderRadius: "4px", cursor: "pointer", background: "var(--nm-faceplate)", fontSize: "11px" }}
        >&#9664;</button>
        <button onClick={() => onChange({ currentFrame: Math.min(frames.length - 1, currentFrame + 1) })}
          style={{ padding: "2px 6px", border: "1px solid #E0E0E0", borderRadius: "4px", cursor: "pointer", background: "var(--nm-faceplate)", fontSize: "11px" }}
        >&#9654;</button>
        <span style={{ color: "var(--nm-ink)" }}>{currentFrame + 1}/{frames.length}</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: "#999" }}>{fps}fps</span>
        <button onClick={addFrame}
          style={{ padding: "2px 8px", fontSize: "11px", border: "1px solid #E0E0E0", borderRadius: "4px", cursor: "pointer", background: "var(--nm-faceplate)", color: "var(--nm-ink)" }}
        >+ Frame</button>
      </div>
    </div>
  );
}
