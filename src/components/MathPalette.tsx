import React from "react";

const MathPalette: React.FC<{ onInsert: (symbol: string) => void }> = ({ onInsert }) => {
  const symbols = ["∫", "∑", "√", "∞", "π", "±", "∂", "Δ", "≈", "≠", "≤", "≥", "×", "÷"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px", padding: "8px", background: "#222" }}>
      {symbols.map((s) => (
        <button key={s} onClick={() => onInsert(s)} style={{ padding: "8px", fontSize: "18px", background: "#333", color: "#fff", border: "none" }}>
          {s}
        </button>
      ))}
    </div>
  );
};

export default MathPalette;
