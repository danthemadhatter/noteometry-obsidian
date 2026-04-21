import { describe, it, expect } from "vitest";
import { DEFAULT_PRESETS, DEFAULT_PRESET_ID, getPresetById } from "../../src/features/pipeline/presets";

/**
 * Guardrail tests for the Math v12 / Deterministic Linear Protocol preset.
 *
 * The Math v12 prompt is load-bearing: the MathML -> Copy-to-Word pipeline
 * and the whole "Solve" UX depend on the exact section order and syntax
 * requirements it enforces. These tests fail loudly if anyone edits the
 * prompt in a way that drops a section heading, reorders them, or removes
 * one of the syntax rules the pipeline relies on.
 *
 * DO NOT relax these assertions to make a preset change pass. If the prompt
 * is intentionally being rewritten, update the tests in the same commit and
 * call out the behavior change in the PR.
 */

const solve = getPresetById("solve");

describe("Math v12 preset — identity and registration", () => {
  it("defaults to the 'solve' preset", () => {
    expect(DEFAULT_PRESET_ID).toBe("solve");
  });

  it("solve preset is registered with expected label/badge", () => {
    expect(solve.id).toBe("solve");
    expect(solve.label).toBe("Solve");
    expect(solve.badge).toBe("=");
  });

  it("description references Math v12 / DLP", () => {
    expect(solve.description).toMatch(/Math v12/i);
    expect(solve.description).toMatch(/Deterministic Linear Protocol/i);
  });

  it("system prompt declares the Math v12 protocol name", () => {
    expect(solve.system).toContain("Math v12");
    expect(solve.system).toContain("Deterministic Linear Protocol");
  });
});

describe("Math v12 preset — invariant section headings and order", () => {
  const SECTION_ORDER = [
    "Problem",
    "Given",
    "Equations",
    "Where",
    "Solution",
    "Answer",
  ];

  it("document structure block contains all six section headings", () => {
    for (const heading of SECTION_ORDER) {
      expect(solve.system).toContain(heading);
    }
  });

  it("section headings appear in the authoritative order", () => {
    const positions = SECTION_ORDER.map((h) => {
      const marker = `## DOCUMENT STRUCTURE`;
      const start = solve.system.indexOf(marker);
      expect(start).toBeGreaterThan(-1);
      return solve.system.indexOf(`\n${h}\n`, start);
    });
    // Every heading must be found AFTER the DOCUMENT STRUCTURE marker
    for (const p of positions) expect(p).toBeGreaterThan(-1);
    // Ordering check
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]!);
    }
  });

  it("declares the six-section document structure as exact order, no additions", () => {
    expect(solve.system).toMatch(/exact order, no additions, no removals/i);
  });
});

describe("Math v12 preset — critical syntax requirements", () => {
  it("mandates inline single-dollar math and forbids display-block", () => {
    expect(solve.system).toMatch(/single-dollar inline math/i);
    expect(solve.system).toMatch(/never/i);
  });

  it("uses \\rightarrow for algebraic transformations", () => {
    expect(solve.system).toContain("\\\\rightarrow");
  });

  it("requires \\boxed{} for final answers", () => {
    expect(solve.system).toContain("\\\\boxed{");
  });

  it("mentions \\text{} usage for prose/units in equations", () => {
    expect(solve.system).toContain("\\\\text{");
  });

  it("forbids markdown bullet lists", () => {
    expect(solve.system).toMatch(/No bullet lists/i);
  });

  it("requires one-item-per-line in Given / Equations / Where", () => {
    expect(solve.system).toMatch(/ONE ITEM PER LINE/);
  });

  it("requires LaTeX-only output (no MathML, no plain-text math)", () => {
    expect(solve.system).toMatch(/NO MathML/);
    expect(solve.system).toMatch(/NO plain-text math/);
  });

  it("includes the Gold Example with boxed answers", () => {
    expect(solve.system).toMatch(/GOLD EXAMPLE/);
    // Canonical Week 1 Problem 1 answers — act as a content fingerprint
    expect(solve.system).toContain("\\\\boxed{I_1 = 0.746");
    expect(solve.system).toContain("\\\\boxed{I_2 = -0.551");
    expect(solve.system).toContain("\\\\boxed{V = 7.78");
  });
});

describe("DEFAULT_PRESETS registry", () => {
  it("contains all expected preset ids", () => {
    const ids = DEFAULT_PRESETS.map((p) => p.id).sort();
    expect(ids).toEqual(["ask", "circuit", "explain", "homework", "solve", "transcribe"].sort());
  });

  it("getPresetById falls back to default for unknown ids", () => {
    const p = getPresetById("definitely-not-a-real-id");
    expect(p.id).toBe(DEFAULT_PRESET_ID);
  });
});
