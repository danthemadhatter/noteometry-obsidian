import { describe, it, expect } from "vitest";
import { convertUnit, formatValue, UNITS, type UnitCategory } from "../../src/components/dropins/UnitConverter";

describe("UnitConverter conversion math", () => {
  it("converts kΩ to Ω", () => {
    expect(convertUnit(10, 1e3, 1)).toBe(10000);
  });

  it("converts Ω to kΩ", () => {
    expect(convertUnit(10000, 1, 1e3)).toBe(10);
  });

  it("converts MΩ to mΩ", () => {
    expect(convertUnit(1, 1e6, 1e-3)).toBe(1e9);
  });

  it("converts pF to F", () => {
    expect(convertUnit(100, 1e-12, 1)).toBeCloseTo(1e-10, 20);
  });

  it("converts μF to nF", () => {
    expect(convertUnit(4.7, 1e-6, 1e-9)).toBeCloseTo(4700, 6);
  });

  it("converts mH to μH", () => {
    expect(convertUnit(2.2, 1e-3, 1e-6)).toBeCloseTo(2200, 6);
  });

  it("converts kV to mV", () => {
    expect(convertUnit(1, 1e3, 1e-3)).toBe(1e6);
  });

  it("converts mA to μA", () => {
    expect(convertUnit(1, 1e-3, 1e-6)).toBeCloseTo(1000, 6);
  });

  it("converts GHz to Hz", () => {
    expect(convertUnit(2.4, 1e9, 1)).toBeCloseTo(2.4e9, 0);
  });

  it("round-trips 10 kΩ through SI base and back", () => {
    const siBase = convertUnit(10, 1e3, 1);       // 10 kΩ → 10000 Ω
    const roundTrip = convertUnit(siBase, 1, 1e3); // 10000 Ω → 10 kΩ
    expect(roundTrip).toBe(10);
  });

  it("handles negative values (signed voltage)", () => {
    expect(convertUnit(-5, 1, 1e-3)).toBe(-5000);
  });

  it("handles zero correctly", () => {
    expect(convertUnit(0, 1e3, 1)).toBe(0);
  });
});

describe("formatValue", () => {
  it("formats zero as '0'", () => {
    expect(formatValue(0)).toBe("0");
  });

  it("formats integers cleanly", () => {
    expect(formatValue(1000)).toBe("1000");
  });

  it("trims trailing zeros", () => {
    expect(formatValue(10.5)).toBe("10.5");
  });

  it("uses exponential notation for large values", () => {
    expect(formatValue(1e8)).toMatch(/e\+/);
  });

  it("uses exponential notation for tiny values", () => {
    expect(formatValue(1e-10)).toMatch(/e-/);
  });

  it("returns empty string for Infinity", () => {
    expect(formatValue(Infinity)).toBe("");
  });

  it("returns empty string for NaN", () => {
    expect(formatValue(NaN)).toBe("");
  });

  it("preserves 6 significant figures", () => {
    const result = formatValue(123456.789);
    expect(result).toBe("123457");
  });

  it("formats negative values correctly", () => {
    expect(formatValue(-5000)).toBe("-5000");
  });
});

describe("UNITS table completeness", () => {
  const categories: UnitCategory[] = [
    "resistance", "capacitance", "inductance", "voltage", "current", "frequency",
  ];

  it("has all 6 categories", () => {
    for (const cat of categories) {
      expect(UNITS[cat]).toBeDefined();
      expect(UNITS[cat].length).toBeGreaterThan(0);
    }
  });

  it("each unit has a label and positive multiplier", () => {
    for (const cat of categories) {
      for (const unit of UNITS[cat]) {
        expect(unit.label).toBeTruthy();
        expect(unit.multiplier).toBeGreaterThan(0);
      }
    }
  });
});
