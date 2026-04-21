import { describe, it, expect } from "vitest";
import { buildClipboardPayload } from "../../src/lib/mathml";

/**
 * Contract tests for the Copy-to-Word clipboard payload.
 *
 * The live path in ChatPanel's copyAsMathML writes two MIME parts via
 * ClipboardItem:
 *   - text/html  — the MathML-bearing paragraphs that Word consumes
 *   - text/plain — the raw LaTeX source for editors that can't parse HTML
 *
 * These tests pin the shape of both payloads so a refactor cannot drop
 * the plaintext fallback or change the HTML structure in a way that
 * breaks Word paste.
 */

describe("buildClipboardPayload — shape of the two MIME parts", () => {
  it("returns both html and plain keys", () => {
    const p = buildClipboardPayload("$x=1$");
    expect(Object.keys(p).sort()).toEqual(["html", "plain"]);
  });

  it("plain payload is the raw source text (LaTeX preserved)", () => {
    const src = "$V_a = 13\\,\\text{V}$\n$\\boxed{I = 1\\,\\text{A}}$";
    const p = buildClipboardPayload(src);
    expect(p.plain).toBe(src);
  });

  it("html payload contains MathML <math> for Word", () => {
    const p = buildClipboardPayload("$V_a = 13$");
    expect(p.html).toContain("<math");
    expect(p.html).toContain('xmlns="http://www.w3.org/1998/Math/MathML"');
  });

  it("html payload wraps each non-empty line in <p>", () => {
    const p = buildClipboardPayload("$x=1$\n$y=2$");
    const pCount = (p.html.match(/<p>/g) ?? []).length;
    expect(pCount).toBe(2);
  });

  it("empty input yields empty html and empty plain", () => {
    const p = buildClipboardPayload("");
    expect(p.plain).toBe("");
    expect(p.html).toBe("");
  });

  it("plain stays distinct from html (never collapses to html-only)", () => {
    const src = "$x=1$";
    const p = buildClipboardPayload(src);
    expect(p.plain).not.toBe(p.html);
    expect(p.plain).toBe(src);
  });
});

describe("buildClipboardPayload — Math v12 Answer block fixture", () => {
  const ANSWER_BLOCK = [
    "$\\boxed{I_1 = 0.746\\,\\text{A}}$",
    "$\\boxed{I_2 = -0.551\\,\\text{A}}$",
    "$\\boxed{V = 7.78\\,\\text{V}}$",
  ].join("\n");

  it("html payload has exactly three boxed answers", () => {
    const p = buildClipboardPayload(ANSWER_BLOCK);
    const boxed = (p.html.match(/<menclose/g) ?? []).length;
    expect(boxed).toBe(3);
  });

  it("html payload has three <p> wrappers, one per boxed answer", () => {
    const p = buildClipboardPayload(ANSWER_BLOCK);
    const pCount = (p.html.match(/<p>/g) ?? []).length;
    expect(pCount).toBe(3);
  });

  it("plain payload is the raw LaTeX with \\boxed{} markers intact", () => {
    const p = buildClipboardPayload(ANSWER_BLOCK);
    expect(p.plain).toBe(ANSWER_BLOCK);
    expect(p.plain).toContain("\\boxed{I_1 = 0.746");
    expect(p.plain).toContain("\\boxed{V = 7.78");
  });
});
