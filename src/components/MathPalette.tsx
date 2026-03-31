import React from "react";

const SYMBOLS = [
  "∫", "∑", "√", "∞", "π", "±", "∂",
  "Δ", "≈", "≠", "≤", "≥", "×", "÷",
  "α", "β", "γ", "θ", "ω", "Ω", "μ",
];

export default function MathPalette({ onInsert }: { onInsert: (s: string) => void }) {
  return (
    <div className="noteometry-palette noteometry-palette-math">
      {SYMBOLS.map((s) => (
        <button key={s} onClick={() => onInsert(s)} title={s}>
          {s}
        </button>
      ))}
    </div>
  );
}
