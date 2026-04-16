import React, { useState, useCallback } from "react";

interface Props {
  category: string;
  inputValue: string;
  onChange: (updates: { category?: string; inputValue?: string }) => void;
}

const CATEGORIES = [
  { key: "resistance", label: "Ω", unit: "Ω" },
  { key: "capacitance", label: "C", unit: "F" },
  { key: "inductance", label: "L", unit: "H" },
  { key: "voltage", label: "V", unit: "V" },
  { key: "current", label: "A", unit: "A" },
  { key: "frequency", label: "Hz", unit: "Hz" },
] as const;

const PREFIXES = [
  { label: "M", mult: 1e6 },
  { label: "k", mult: 1e3 },
  { label: "", mult: 1 },
  { label: "m", mult: 1e-3 },
  { label: "μ", mult: 1e-6 },
  { label: "n", mult: 1e-9 },
  { label: "p", mult: 1e-12 },
];

function formatSig(val: number, digits = 6): string {
  if (val === 0) return "0";
  return Number(val.toPrecision(digits)).toString();
}

export default function UnitConverterDropin({ category, inputValue, onChange }: Props) {
  const [baseValue, setBaseValue] = useState(() => parseFloat(inputValue) || 1);
  const [editingPrefix, setEditingPrefix] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState("");

  const cat = CATEGORIES.find(c => c.key === category) ?? CATEGORIES[0];

  const handleBaseChange = useCallback((val: number) => {
    setBaseValue(val);
    onChange({ inputValue: String(val) });
  }, [onChange]);

  const handlePrefixInput = useCallback((prefix: typeof PREFIXES[number], raw: string) => {
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      handleBaseChange(num * prefix.mult);
    }
    setEditingPrefix(null);
  }, [handleBaseChange]);

  return (
    <div style={{ padding: "8px", fontSize: "13px", fontFamily: "var(--nm-font)" }}>
      <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => onChange({ category: c.key })}
            style={{
              flex: 1, padding: "4px 0", border: "1px solid #E0E0E0",
              borderRadius: "4px", cursor: "pointer", fontSize: "12px",
              fontWeight: category === c.key ? 700 : 400,
              background: category === c.key ? "var(--nm-accent)" : "var(--nm-faceplate)",
              color: category === c.key ? "#fff" : "var(--nm-ink)",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div>
        {PREFIXES.map(p => {
          const display = baseValue / p.mult;
          const label = p.label + cat.unit;
          const isEditing = editingPrefix === p.label;
          return (
            <div key={p.label} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "4px 8px", borderBottom: "1px solid #F0F0F0",
            }}>
              <span style={{ fontWeight: 600, minWidth: "40px", color: "var(--nm-ink)" }}>{label}</span>
              {isEditing ? (
                <input
                  autoFocus
                  value={editBuffer}
                  onChange={e => setEditBuffer(e.target.value)}
                  onBlur={() => handlePrefixInput(p, editBuffer)}
                  onKeyDown={e => { if (e.key === "Enter") handlePrefixInput(p, editBuffer); }}
                  style={{ width: "100px", textAlign: "right", fontSize: "13px", border: "1px solid var(--nm-accent)", borderRadius: "3px", padding: "2px 4px" }}
                />
              ) : (
                <span
                  onClick={() => { setEditingPrefix(p.label); setEditBuffer(formatSig(display)); }}
                  style={{ cursor: "text", color: "var(--nm-ink)" }}
                >
                  {formatSig(display)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={() => { handleBaseChange(0); setEditingPrefix(null); }}
        style={{
          marginTop: "8px", width: "100%", padding: "6px", border: "1px solid #E0E0E0",
          borderRadius: "4px", background: "var(--nm-faceplate)", cursor: "pointer",
          fontSize: "12px", color: "var(--nm-ink)",
        }}
      >
        Clear
      </button>
    </div>
  );
}
