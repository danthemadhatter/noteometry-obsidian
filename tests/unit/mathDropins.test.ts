import { describe, it, expect } from "vitest";
import {
  createGraphPlotter,
  createUnitCircle,
  createOscilloscope,
} from "../../src/lib/canvasObjects";
import { generateSample } from "../../src/components/dropins/Oscilloscope";
import type { ChannelConfig } from "../../src/lib/canvasObjects";

/* ── Factory function tests ──────────────────────────── */

describe("createGraphPlotter", () => {
  it("returns correct defaults", () => {
    const obj = createGraphPlotter(100, 200);
    expect(obj.type).toBe("graph-plotter");
    expect(obj.x).toBe(100);
    expect(obj.y).toBe(200);
    expect(obj.w).toBe(480);
    expect(obj.h).toBe(380);
    expect(obj.xMin).toBe(-10);
    expect(obj.xMax).toBe(10);
    expect(obj.yMin).toBeNull();
    expect(obj.yMax).toBeNull();
    expect(obj.functions).toHaveLength(1);
    expect(obj.functions[0]!.expr).toBe("sin(x)");
    expect(obj.id).toBeTruthy();
  });
});

describe("createUnitCircle", () => {
  it("returns correct defaults", () => {
    const obj = createUnitCircle(50, 75);
    expect(obj.type).toBe("unit-circle");
    expect(obj.x).toBe(50);
    expect(obj.y).toBe(75);
    expect(obj.w).toBe(380);
    expect(obj.h).toBe(320);
    expect(obj.angleDeg).toBe(45);
  });
});

describe("createOscilloscope", () => {
  it("returns correct defaults", () => {
    const obj = createOscilloscope(10, 20);
    expect(obj.type).toBe("oscilloscope");
    expect(obj.w).toBe(520);
    expect(obj.h).toBe(420);
    expect(obj.running).toBe(true);
    expect(obj.channelA.waveform).toBe("sine");
    expect(obj.channelA.frequency).toBe(1000);
    expect(obj.channelB.waveform).toBe("off");
    expect(obj.timeDivIndex).toBe(4);
  });
});

/* ── Signal generation math tests ───────────────────── */

describe("generateSample", () => {
  const baseCh: ChannelConfig = {
    waveform: "sine",
    frequency: 1000,
    amplitude: 1.0,
    phase: 0,
    dcOffset: 0,
    voltsDivIndex: 3,
    visible: true,
    yOffset: 0,
  };

  it("sine at t=0 is 0", () => {
    const v = generateSample(0, baseCh);
    expect(Math.abs(v)).toBeLessThan(1e-10);
  });

  it("sine at quarter period is amplitude", () => {
    const T = 1 / baseCh.frequency;
    const v = generateSample(T / 4, baseCh);
    expect(v).toBeCloseTo(1.0, 5);
  });

  it("sine with phase offset", () => {
    const ch = { ...baseCh, phase: 90 };
    const v = generateSample(0, ch);
    expect(v).toBeCloseTo(1.0, 5);
  });

  it("square wave positive half", () => {
    const ch = { ...baseCh, waveform: "square" as const };
    const T = 1 / ch.frequency;
    const v = generateSample(T * 0.1, ch);
    expect(v).toBe(1.0);
  });

  it("square wave negative half", () => {
    const ch = { ...baseCh, waveform: "square" as const };
    const T = 1 / ch.frequency;
    const v = generateSample(T * 0.6, ch);
    expect(v).toBe(-1.0);
  });

  it("dc returns amplitude + offset", () => {
    const ch = { ...baseCh, waveform: "dc" as const, amplitude: 3.5, dcOffset: 1.5 };
    const v = generateSample(42, ch);
    expect(v).toBe(5.0);
  });

  it("off returns 0", () => {
    const ch = { ...baseCh, waveform: "off" as const };
    const v = generateSample(42, ch);
    expect(v).toBe(0);
  });

  it("dc offset is added", () => {
    const ch = { ...baseCh, dcOffset: 2 };
    const T = 1 / ch.frequency;
    // At quarter period, sine = 1, total = 1 + 2 = 3
    const v = generateSample(T / 4, ch);
    expect(v).toBeCloseTo(3.0, 5);
  });

  it("triangle wave at midpoint is -1", () => {
    const ch = { ...baseCh, waveform: "triangle" as const };
    // tMod = 0 → 4*|0-0.5|-1 = 4*0.5-1 = 1
    const v = generateSample(0, ch);
    expect(v).toBeCloseTo(1.0, 5);
  });

  it("sawtooth at start is -1", () => {
    const ch = { ...baseCh, waveform: "sawtooth" as const };
    // tMod = 0 → 2*0-1 = -1
    const v = generateSample(0, ch);
    expect(v).toBeCloseTo(-1.0, 5);
  });

  it("pulse fires at start of period", () => {
    const ch = { ...baseCh, waveform: "pulse" as const };
    // tMod ≈ 0 < 0.1, should be amplitude
    const v = generateSample(0, ch);
    expect(v).toBe(1.0);
  });

  it("pulse off after 10% of period", () => {
    const ch = { ...baseCh, waveform: "pulse" as const };
    const T = 1 / ch.frequency;
    const v = generateSample(T * 0.5, ch);
    expect(v).toBe(0);
  });
});
