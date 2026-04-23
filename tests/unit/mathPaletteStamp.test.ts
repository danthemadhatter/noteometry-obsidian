import { describe, it, expect } from "vitest";
import { shouldArmStamp, TABS } from "../../src/components/MathPalette";

/**
 * v1.6.9 regression guardrail.
 *
 * Dan reported the math palette as "super janky" when adding text. The
 * old behavior dumped every tap into the Input textarea, even for single
 * glyphs like π or ⊕, so the user had to switch modes and drag to put
 * anything on the canvas itself. v1.6.9 routes pure-glyph taps to a
 * "pending stamp" (next canvas tap drops it) while keeping structural
 * LaTeX (fractions, matrices, \sum, \lim…) going to Input, because
 * those need editing before they render.
 *
 * These tests pin the routing rule so a future palette edit can't
 * silently regress the behavior.
 */

describe("shouldArmStamp — math palette tap routing", () => {
  const cases: Array<[string, boolean, string]> = [
    // Pure-glyph tabs — should ALL arm stamps.
    ["\\alpha ",        true,  "Greek letter alpha"],
    ["\\omega ",        true,  "Greek letter omega"],
    ["\\rightarrow ",   true,  "Right arrow"],
    ["\\in ",           true,  "Member-of"],
    ["\\infty ",        true,  "Infinity"],
    ["\\pm ",           true,  "Plus-minus"],
    ["\\nabla ",        true,  "Nabla"],
    ["s",               true,  "Laplace variable literal"],
    ["V_{CC}",          true,  "Circuit supply rail (label pattern)"],
    // Structural LaTeX — should stay in Input.
    ["\\frac{}{}",               false, "Fraction template"],
    ["\\sqrt{}",                 false, "Square root template"],
    ["^{}",                      false, "Superscript placeholder"],
    ["_{}",                      false, "Subscript placeholder"],
    ["\\int_{a}^{b}",            false, "Definite integral with bounds"],
    ["\\sum_{i=1}^{n}",          false, "Summation"],
    ["\\lim_{\\to}",             false, "Limit template"],
    ["\\begin{pmatrix}  &  \\\\  &  \\end{pmatrix}", false, "pmatrix environment"],
    ["\\begin{cases}  \\\\  \\end{cases}",          false, "cases environment"],
    ["\\hat{}",                  false, "Accent template"],
    ["\\mathbf{}",               false, "Bold template"],
  ];

  it.each(cases)(
    "latex=%s routes to armStamp=%s (%s)",
    (latex, expected) => {
      expect(shouldArmStamp({ latex, display: "" })).toBe(expected);
    },
  );

  it("explicit stamp field always arms (e.g. circuit markers)", () => {
    // Earth ground, DC supply marker: these come from the circuit tab
    // with an explicit `stamp` character. They must ALWAYS go to the
    // canvas — otherwise the user taps ⏚ from the palette and nothing
    // visible happens, which is the exact bug v1.6.9 is fixing.
    expect(shouldArmStamp({ latex: "\\text{GND}", display: "⏚", stamp: "⏚" })).toBe(true);
    expect(shouldArmStamp({ latex: "\\text{DC}",  display: "⎓", stamp: "⎓" })).toBe(true);
  });

  it("most tabs have at least one entry that routes to the canvas", () => {
    // Each palette tab should surface AT LEAST one tap-to-place symbol
    // so the tab isn't a dead end on touch devices. Pre-1.6.9 tabs like
    // "calc" (∫, ∫ₐᵇ, ∑, ∂…) were all input-only on tap — Dan couldn't
    // stamp a summation sign without dragging. After the router split,
    // the simple glyphs in each tab go to canvas and the templates stay
    // in Input.
    //
    // Structural-only tabs (matrices: pmatrix/bmatrix/… are all
    // environments) are allowed to be all-input because you genuinely
    // need to edit them before they render. They're explicitly allowed
    // here rather than silently ignored so a future tab that drifts to
    // all-templates is still caught by this invariant.
    // "accents" is also all-template: \hat{}, \bar{}, \vec{}… every entry
    // needs a base letter, so they legitimately go to Input for editing.
    const ALL_TEMPLATE_TABS_OK = new Set(["matrices", "accents"]);
    for (const tab of TABS) {
      if (ALL_TEMPLATE_TABS_OK.has(tab.id)) continue;
      const hasStampable = tab.items.some((it) => shouldArmStamp(it));
      expect(hasStampable, `tab "${tab.id}" needs at least one stamp-capable entry`).toBe(true);
    }
  });
});
