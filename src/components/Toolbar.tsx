import React from "react";

interface ToolbarProps {
  mode: string;
  setMode: (mode: "text" | "math" | "circuits") => void;
  onReadInk: () => void;
  onSolve: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ mode, setMode, onReadInk, onSolve }) => {
  return (
    <div style={{
      background: "#111",
      color: "#fff",
      padding: "8px 12px",
      display: "flex",
      gap: "12px",
      alignItems: "center",
      borderBottom: "2px solid #333",
      fontFamily: "system-ui",
    }}>
      <button onClick={() => setMode("text")} style={{ background: mode === "text" ? "#0a0" : "#222", padding: "6px 12px", border: "none", color: "#fff" }}>
        📝 Text
      </button>
      <button onClick={() => setMode("math")} style={{ background: mode === "math" ? "#0a0" : "#222", padding: "6px 12px", border: "none", color: "#fff" }}>
        ➗ Math
      </button>
      <button onClick={() => setMode("circuits")} style={{ background: mode === "circuits" ? "#0a0" : "#222", padding: "6px 12px", border: "none", color: "#fff" }}>
        ⚡ Circuits
      </button>

      <div style={{ flex: 1 }}></div>

      <button onClick={onReadInk} style={{ background: "#0066ff", padding: "6px 12px", border: "none", color: "#fff", fontWeight: "bold" }}>
        📸 READ INK
      </button>
      <button onClick={onSolve} style={{ background: "#00cc00", padding: "6px 12px", border: "none", color: "#fff", fontWeight: "bold" }}>
        🧠 SOLVE
      </button>
    </div>
  );
};

export default Toolbar;
