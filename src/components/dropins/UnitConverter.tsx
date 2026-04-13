import React, { useState, useCallback, useRef } from "react";
import type { UnitConverterObject } from "../../lib/canvasObjects";

export type UnitCategory = "resistance" | "capacitance" | "inductance" | "voltage" | "current" | "frequency";

export interface UnitDef {
  label: string;
  multiplier: number;
}

export const UNITS: Record<UnitCategory, UnitDef[]> = {
  resistance: [
    { label: "MΩ", multiplier: 1e6 },
    { label: "kΩ", multiplier: 1e3 },
    { label: "Ω", multiplier: 1 },
    { label: "mΩ", multiplier: 1e-3 },
  ],
  capacitance: [
    { label: "F", multiplier: 1 },
    { label: "mF", multiplier: 1e-3 },
    { label: "μF", multiplier: 1e-6 },
    { label: "nF", multiplier: 1e-9 },
    { label: "pF", multiplier: 1e-12 },
  ],
  inductance: [
    { label: "H", multiplier: 1 },
    { label: "mH", multiplier: 1e-3 },
    { label: "μH", multiplier: 1e-6 },
    { label: "nH", multiplier: 1e-9 },
  ],
  voltage: [
    { label: "kV", multiplier: 1e3 },
    { label: "V", multiplier: 1 },
    { label: "mV", multiplier: 1e-3 },
    { label: "μV", multiplier: 1e-6 },
  ],
  current: [
    { label: "A", multiplier: 1 },
    { label: "mA", multiplier: 1e-3 },
    { label: "μA", multiplier: 1e-6 },
    { label: "nA", multiplier: 1e-9 },
  ],
  frequency: [
    { label: "GHz", multiplier: 1e9 },
    { label: "MHz", multiplier: 1e6 },
    { label: "kHz", multiplier: 1e3 },
    { label: "Hz", multiplier: 1 },
  ],
};

const CATEGORY_TABS: { key: UnitCategory; symbol: string }[] = [
  { key: "resistance", symbol: "Ω" },
  { key: "capacitance", symbol: "C" },
  { key: "inductance", symbol: "L" },
  { key: "voltage", symbol: "V" },
  { key: "current", symbol: "A" },
  { key: "frequency", symbol: "Hz" },
];

export function convertUnit(
  sourceValue: number,
  sourceMultiplier: number,
  targetMultiplier: number,
): number {
  return (sourceValue * sourceMultiplier) / targetMultiplier;
}

export function formatValue(v: number): string {
  if (!isFinite(v)) return "";
  const abs = Math.abs(v);
  if (abs === 0) return "0";
  if (abs >= 1e7 || (abs < 1e-5 && abs > 0)) {
    return v.toExponential(5);
  }
  return parseFloat(v.toPrecision(6)).toString();
}

interface Props {
  obj: UnitConverterObject;
  onChange: (patch: Partial<UnitConverterObject>) => void;
}

export default function UnitConverter({ obj, onChange }: Props) {
  const activeCategory = (obj.activeCategory || "resistance") as UnitCategory;
  const [focusedLabel, setFocusedLabel] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Compute SI base value from stored values
  const siValue = obj.values[activeCategory] ?? null;

  const handleTabChange = useCallback((cat: UnitCategory) => {
    onChange({ activeCategory: cat });
    setFocusedLabel(null);
    setFieldValues({});
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange({ values: { ...obj.values, [activeCategory]: null } });
    setFieldValues({});
    setFocusedLabel(null);
  }, [onChange, obj.values, activeCategory]);

  const handleInput = useCallback((unitLabel: string, unitMultiplier: number, rawValue: string) => {
    setFieldValues((prev) => ({ ...prev, [unitLabel]: rawValue }));

    const parsed = parseFloat(rawValue);
    if (isNaN(parsed)) {
      // Clear all other fields
      onChange({ values: { ...obj.values, [activeCategory]: null } });
      return;
    }
    // Store SI base value
    const siBase = parsed * unitMultiplier;
    onChange({ values: { ...obj.values, [activeCategory]: siBase } });
  }, [onChange, obj.values, activeCategory]);

  const units = UNITS[activeCategory];

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
      {/* Tab strip */}
      <div style={{
        display: "flex", flexShrink: 0,
        borderBottom: "1px solid var(--nm-paper-border, #ddd)",
        background: "var(--nm-faceplate-recessed, #f5f2ea)",
      }}>
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            style={{
              flex: 1, padding: "6px 2px", fontSize: "13px", fontWeight: 600,
              background: activeCategory === tab.key ? "var(--nm-accent, #4a6fa5)" : "transparent",
              color: activeCategory === tab.key ? "#fff" : "var(--nm-paper-ink, #333)",
              border: "none", cursor: "pointer",
              minHeight: "36px", minWidth: 0,
            }}
          >
            {tab.symbol}
          </button>
        ))}
      </div>

      {/* Unit fields */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
        {units.map((unit) => {
          const isFocused = focusedLabel === unit.label;
          let displayValue = "";
          if (isFocused) {
            displayValue = fieldValues[unit.label] ?? "";
          } else if (siValue !== null && siValue !== undefined) {
            displayValue = formatValue(convertUnit(siValue, 1, unit.multiplier));
          }

          return (
            <div key={unit.label} style={{
              display: "flex", alignItems: "center", gap: "8px",
              marginBottom: "6px",
            }}>
              <label style={{
                width: "40px", textAlign: "right", fontSize: "13px",
                fontWeight: 600, flexShrink: 0, color: "var(--nm-paper-ink, #333)",
              }}>
                {unit.label}
              </label>
              <input
                ref={(el) => { inputRefs.current[unit.label] = el; }}
                type="text"
                inputMode="decimal"
                value={displayValue}
                onChange={(e) => handleInput(unit.label, unit.multiplier, e.target.value)}
                onFocus={() => {
                  setFocusedLabel(unit.label);
                  // Initialize field value from current display
                  if (siValue !== null && siValue !== undefined) {
                    setFieldValues((prev) => ({
                      ...prev,
                      [unit.label]: formatValue(convertUnit(siValue, 1, unit.multiplier)),
                    }));
                  }
                }}
                onBlur={() => {
                  setFocusedLabel(null);
                  setFieldValues({});
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                style={{
                  flex: 1, padding: "6px 8px", fontSize: "14px",
                  border: "1px solid var(--nm-paper-border, #ccc)",
                  borderRadius: "4px", fontVariantNumeric: "tabular-nums",
                  background: "var(--nm-paper, #fff)",
                  minHeight: "36px", boxSizing: "border-box",
                  minWidth: 0,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Clear button */}
      <div style={{
        padding: "6px 8px", borderTop: "1px solid var(--nm-paper-border, #ddd)",
        flexShrink: 0,
      }}>
        <button
          onClick={handleClear}
          style={{
            width: "100%", padding: "6px", fontSize: "13px", fontWeight: 600,
            background: "none", border: "1px solid var(--nm-paper-border, #ccc)",
            borderRadius: "4px", cursor: "pointer", minHeight: "36px",
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
