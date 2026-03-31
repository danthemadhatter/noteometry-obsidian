import React from "react";

const CircuitPalette: React.FC<{ onInsert: (symbol: string) => void }> = ({ onInsert }) => {
  const symbols = ["R", "C", "L", "D", "OpAmp", "GND", "V", "I", "Switch", "Transistor", "LED", "Battery"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px", padding: "8px", background: "#222" }}>
      {symbols.map((s) => (
        <button key={s} onClick={() => onInsert(s)} style={{ padding: "12px", fontSize: "16px", background: "#333", color: "#0ff", border: "2px solid #0ff", borderRadius: "4px" }}>
          {s}
        </button>
      ))}
    </div>
  );
};

export default CircuitPalette;
