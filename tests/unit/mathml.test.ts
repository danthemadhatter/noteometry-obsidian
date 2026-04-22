import { describe, it, expect } from "vitest";
import { renderAsMathML, toMathMLForClipboard } from "../../src/lib/mathml";

/**
 * Regression fixtures for the LaTeX -> MathML pipeline used by the
 * "Copy to Word" feature. These tests assert that representative Math v12
 * fragments (units, subscripts, arrows, boxed answers) survive the
 * KaTeX-to-pure-MathML extraction with the shape Word actually renders.
 *
 * If a KaTeX upgrade or a rewrite of renderAsMathML changes the element
 * names below, Copy-to-Word will silently degrade. Do not update the
 * assertions to mask that — investigate the regression first.
 */

describe("renderAsMathML — empty and trivial input", () => {
  it("returns empty string for empty input", () => {
    expect(renderAsMathML("")).toBe("");
  });

  it("leaves plain prose untouched except for <br> conversion", () => {
    expect(renderAsMathML("Apply mesh analysis.")).toBe("Apply mesh analysis.");
  });

  it("converts literal newlines to <br>", () => {
    expect(renderAsMathML("line one\nline two")).toBe("line one<br>line two");
  });

  it("text outside $...$ is preserved verbatim", () => {
    const out = renderAsMathML("Given the value $V=1$ we proceed.");
    expect(out.startsWith("Given the value ")).toBe(true);
    expect(out.endsWith(" we proceed.")).toBe(true);
  });
});

describe("renderAsMathML — inline math produces bare <math>", () => {
  it("wraps inline math in a <math> element (no KaTeX span wrapper)", () => {
    const out = renderAsMathML("$V_a = 13$");
    expect(out).toMatch(/^<math[\s>]/);
    expect(out).toMatch(/<\/math>$/);
    expect(out).not.toContain('class="katex"');
  });

  it("uses xmlns MathML namespace for Word interop", () => {
    const out = renderAsMathML("$x=1$");
    expect(out).toContain('xmlns="http://www.w3.org/1998/Math/MathML"');
  });

  it("renders subscripts with <msub>", () => {
    const out = renderAsMathML("$V_a = 13$");
    expect(out).toContain("<msub>");
  });

  it("renders units via \\text{} as <mtext>", () => {
    const out = renderAsMathML("$V_a = 13\\,\\text{V}$");
    expect(out).toContain("<mtext>V</mtext>");
  });

  it("renders \\rightarrow as the arrow operator", () => {
    const out = renderAsMathML("$a \\rightarrow b$");
    // KaTeX maps \rightarrow to the U+2192 arrow inside an <mo>
    expect(out).toContain("→");
    expect(out).toMatch(/<mo>(?:&#x2192;|→)<\/mo>/);
  });

  it("renders \\boxed{} with a box-notation wrapper", () => {
    const out = renderAsMathML("$\\boxed{V = 7.78\\,\\text{V}}$");
    // KaTeX emits <menclose notation="box"> for \boxed{}
    expect(out).toContain("<menclose");
    expect(out.toLowerCase()).toContain('notation="box"');
  });
});

describe("renderAsMathML — display math $$...$$", () => {
  it("wraps display math in a centered div", () => {
    const out = renderAsMathML("$$x = 1$$");
    expect(out).toMatch(/^<div style="text-align:center/);
    expect(out).toContain("<math");
  });
});

describe("renderAsMathML — malformed input does not throw", () => {
  it("leaves unmatched $ alone without throwing", () => {
    expect(() => renderAsMathML("This has a lone $ sign.")).not.toThrow();
  });

  it("returns something for syntactically bad LaTeX (throwOnError: false)", () => {
    expect(() => renderAsMathML("$\\notacommand{foo}$")).not.toThrow();
  });
});

describe("toMathMLForClipboard — Word-shaped HTML", () => {
  it("wraps each non-empty line in <p>", () => {
    const out = toMathMLForClipboard("$x=1$\n$y=2$");
    const paragraphs = out.split("\n").filter(Boolean);
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0]!.startsWith("<p>")).toBe(true);
    expect(paragraphs[0]!.endsWith("</p>")).toBe(true);
  });

  it("drops (empties) whitespace-only lines so blanks do not become <p></p>", () => {
    const out = toMathMLForClipboard("$x=1$\n   \n$y=2$");
    // The blank line becomes an empty string, kept as a line separator
    const lines = out.split("\n");
    expect(lines.length).toBe(3);
    expect(lines[1]).toBe("");
  });

  it("each paragraph contains a <math> for a line with inline math", () => {
    const out = toMathMLForClipboard("$V_a = 13\\,\\text{V}$");
    expect(out).toContain("<p><math");
    expect(out).toContain("</math></p>");
  });
});

describe("Math v12 Week 1 Problem 1 regression fixture", () => {
  // Canonical fragments from the Gold Example in the Math v12 preset.
  // If any of these lose their MathML shape, Copy-to-Word breaks.
  const GIVEN_LINES = [
    "$V_a = 13\\,\\text{V}$",
    "$V_b = 21\\,\\text{V}$",
    "$R_1 = 7\\,\\Omega$",
  ];

  const EQUATION_LINES = [
    "$R_1 I_1 + R_2 (I_1 - I_2) = V_a$",
    "$R_3 I_2 + R_4 I_2 + R_2 (I_2 - I_1) + V_b = 0$",
    "$V = R_2 (I_1 - I_2)$",
  ];

  const SOLUTION_ARROW_LINE =
    "$\\text{Mesh 1: } 7 I_1 + 6 (I_1 - I_2) = 13 \\rightarrow 13 I_1 - 6 I_2 = 13$";

  const BOXED_ANSWER_LINES = [
    "$\\boxed{I_1 = 0.746\\,\\text{A}}$",
    "$\\boxed{I_2 = -0.551\\,\\text{A}}$",
    "$\\boxed{V = 7.78\\,\\text{V}}$",
  ];

  it("Given lines render with units", () => {
    for (const line of GIVEN_LINES) {
      const out = renderAsMathML(line);
      expect(out).toMatch(/<math[\s>]/);
      // Units ultimately show up as <mtext>X</mtext> or the actual Ω char
      expect(out).toMatch(/<mtext>|Ω|Ω/);
    }
  });

  it("Equations lines render with subscripted resistors/currents", () => {
    for (const line of EQUATION_LINES) {
      const out = renderAsMathML(line);
      expect(out).toContain("<msub>");
      expect(out).toMatch(/<math[\s>]/);
    }
  });

  it("Solution arrow line preserves both equality and right-arrow", () => {
    const out = renderAsMathML(SOLUTION_ARROW_LINE);
    expect(out).toContain("→");
    // Both equals signs should still appear as <mo>=</mo>
    const eqMatches = out.match(/<mo>=<\/mo>/g) ?? [];
    expect(eqMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("Answer lines render with <menclose notation='box'>", () => {
    for (const line of BOXED_ANSWER_LINES) {
      const out = renderAsMathML(line);
      expect(out).toContain("<menclose");
      expect(out.toLowerCase()).toContain('notation="box"');
    }
  });

  it("full Answer block wraps each boxed answer in its own <p>", () => {
    const block = BOXED_ANSWER_LINES.join("\n");
    const out = toMathMLForClipboard(block);
    const pCount = (out.match(/<p>/g) ?? []).length;
    expect(pCount).toBe(3);
    const menCount = (out.match(/<menclose/g) ?? []).length;
    expect(menCount).toBe(3);
  });
});
