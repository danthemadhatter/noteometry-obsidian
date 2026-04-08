import React, { useState, useCallback } from "react";

interface Props {
  onInsert: (latex: string) => void;
  onDragStart?: (display: string) => void;
}

export interface SymbolItem {
  latex: string;
  display: string;
  /** Clean symbol for canvas stamp (no boxes/placeholders). Falls back to display. */
  stamp?: string;
  title?: string;
}

interface TabDef {
  id: string;
  label: string;
  items: SymbolItem[];
}

const TABS: TabDef[] = [
  {
    id: "numbers", label: "123",
    items: [
      { latex: "0", display: "0" }, { latex: "1", display: "1" },
      { latex: "2", display: "2" }, { latex: "3", display: "3" },
      { latex: "4", display: "4" }, { latex: "5", display: "5" },
      { latex: "6", display: "6" }, { latex: "7", display: "7" },
      { latex: "8", display: "8" }, { latex: "9", display: "9" },
      { latex: "+", display: "+" }, { latex: "-", display: "−" },
      { latex: "=", display: "=" }, { latex: "\\times ", display: "×" },
      { latex: "\\div ", display: "÷" }, { latex: "\\pm ", display: "±" },
      { latex: "x", display: "x" }, { latex: "y", display: "y" },
      { latex: "z", display: "z" }, { latex: "n", display: "n" },
    ],
  },
  {
    id: "basic", label: "√□",
    items: [
      { latex: "\\frac{}{}", display: "▫/▫", stamp: "⁄", title: "Fraction" },
      { latex: "\\sqrt{}", display: "√▫", stamp: "√", title: "Square root" },
      { latex: "\\sqrt[]{}", display: "ⁿ√▫", stamp: "√", title: "nth root" },
      { latex: "^{}", display: "▫ⁿ", stamp: "^", title: "Superscript" },
      { latex: "_{}", display: "▫ₙ", stamp: "_", title: "Subscript" },
      { latex: "()", display: "(▫)", stamp: "()", title: "Parentheses" },
      { latex: "\\left(\\right)", display: "(  )", stamp: "()", title: "Auto-size parens" },
      { latex: "[]", display: "[▫]", stamp: "[]", title: "Brackets" },
      { latex: "\\{\\}", display: "{▫}", stamp: "{}", title: "Braces" },
      { latex: "\\left|\\right|", display: "|▫|", stamp: "| |", title: "Absolute value" },
      { latex: "\\overline{}", display: "▫̄", stamp: "‾", title: "Overline" },
    ],
  },
  {
    id: "relational", label: "∈∞",
    items: [
      { latex: "\\neq ", display: "≠" }, { latex: "\\approx ", display: "≈" },
      { latex: "\\equiv ", display: "≡" }, { latex: "\\geq ", display: "≥" },
      { latex: "\\leq ", display: "≤" }, { latex: "\\in ", display: "∈" },
      { latex: "\\subset ", display: "⊂" }, { latex: "\\infty ", display: "∞" },
      { latex: "\\propto ", display: "∝" }, { latex: "\\therefore ", display: "∴" },
    ],
  },
  {
    id: "arrows", label: "→·",
    items: [
      { latex: "\\rightarrow ", display: "→" }, { latex: "\\leftarrow ", display: "←" },
      { latex: "\\Rightarrow ", display: "⇒" }, { latex: "\\Leftrightarrow ", display: "⇔" },
      { latex: "\\mapsto ", display: "↦" }, { latex: "\\cdot ", display: "·" },
      { latex: "\\cdots ", display: "⋯" }, { latex: "\\ldots ", display: "…" },
    ],
  },
  {
    id: "greek", label: "αΩ",
    items: [
      { latex: "\\alpha ", display: "α" }, { latex: "\\beta ", display: "β" },
      { latex: "\\gamma ", display: "γ" }, { latex: "\\delta ", display: "δ" },
      { latex: "\\epsilon ", display: "ε" }, { latex: "\\theta ", display: "θ" },
      { latex: "\\lambda ", display: "λ" }, { latex: "\\mu ", display: "μ" },
      { latex: "\\pi ", display: "π" }, { latex: "\\sigma ", display: "σ" },
      { latex: "\\tau ", display: "τ" }, { latex: "\\phi ", display: "φ" },
      { latex: "\\omega ", display: "ω" }, { latex: "\\Delta ", display: "Δ" },
      { latex: "\\Sigma ", display: "Σ" }, { latex: "\\Omega ", display: "Ω" },
    ],
  },
  {
    id: "matrices", label: "[ ]",
    items: [
      { latex: "\\begin{pmatrix}  &  \\\\  &  \\end{pmatrix}", display: "(2×2)", title: "2×2 matrix" },
      { latex: "\\begin{bmatrix}  &  \\\\  &  \\end{bmatrix}", display: "[2×2]", title: "2×2 brackets" },
      { latex: "\\begin{bmatrix}  &  &  \\\\  &  &  \\\\  &  &  \\end{bmatrix}", display: "[3×3]", title: "3×3" },
      { latex: "\\begin{vmatrix}  &  \\\\  &  \\end{vmatrix}", display: "|2×2|", title: "Determinant" },
      { latex: "\\begin{cases}  \\\\  \\end{cases}", display: "{cases", title: "Piecewise" },
    ],
  },
  {
    id: "calc", label: "∫lim",
    items: [
      { latex: "\\int ", display: "∫" }, { latex: "\\int_{a}^{b}", display: "∫ₐᵇ" },
      { latex: "\\iint ", display: "∬" }, { latex: "\\oint ", display: "∮" },
      { latex: "\\frac{d}{d}", display: "d/d", title: "Derivative" },
      { latex: "\\frac{\\partial}{\\partial}", display: "∂/∂", title: "Partial" },
      { latex: "\\lim_{\\to}", display: "lim" },
      { latex: "\\sum_{i=1}^{n}", display: "Σᵢⁿ" }, { latex: "\\prod_{i=1}^{n}", display: "Πᵢⁿ" },
      { latex: "\\nabla ", display: "∇" },
    ],
  },
  {
    id: "accents", label: "â",
    items: [
      { latex: "\\hat{}", display: "â" }, { latex: "\\bar{}", display: "ā" },
      { latex: "\\vec{}", display: "a⃗" }, { latex: "\\dot{}", display: "ȧ" },
      { latex: "\\ddot{}", display: "ä" }, { latex: "\\tilde{}", display: "ã" },
      { latex: "\\mathbf{}", display: "𝐚" }, { latex: "\\mathbb{}", display: "𝔸" },
      { latex: "\\cancel{}", display: "a̸" }, { latex: "\\boxed{}", display: "☐" },
    ],
  },
  {
    id: "trig", label: "sin",
    items: [
      { latex: "\\sin ", display: "sin" }, { latex: "\\cos ", display: "cos" },
      { latex: "\\tan ", display: "tan" }, { latex: "\\ln ", display: "ln" },
      { latex: "\\log ", display: "log" }, { latex: "\\log_{}", display: "log₍₎" },
      { latex: "e^{}", display: "eˣ" },
      { latex: "\\forall ", display: "∀" }, { latex: "\\exists ", display: "∃" },
      { latex: "\\neg ", display: "¬" }, { latex: "\\land ", display: "∧" }, { latex: "\\lor ", display: "∨" },
    ],
  },
];

// Export tabs for use in floating palette
export { TABS };
export type { TabDef };

export default function MathPalette({ onInsert, onDragStart }: Props) {
  const [openTab, setOpenTab] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, item: SymbolItem) => {
    const stampText = item.stamp ?? item.display;
    e.dataTransfer.setData("text/plain", stampText);
    e.dataTransfer.setData("application/x-noteometry-symbol", JSON.stringify({ ...item, stamp: stampText }));
    e.dataTransfer.effectAllowed = "copy";
    onDragStart?.(stampText);
  }, [onDragStart]);

  return (
    <div className="noteometry-mathpal">
      <div className="noteometry-mathpal-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`noteometry-mathpal-tab ${openTab === t.id ? "active" : ""}`}
            onClick={() => setOpenTab(openTab === t.id ? null : t.id)}
            title={t.id}
          >
            {t.label}
          </button>
        ))}
      </div>
      {openTab && (() => {
        const tab = TABS.find((t) => t.id === openTab);
        if (!tab) return null;
        return (
          <div className="noteometry-mathpal-grid">
            {tab.items.map((item, i) => (
              <button
                key={`${tab.id}-${i}`}
                className="noteometry-mathpal-btn"
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onClick={() => onInsert(item.latex)}
                title={item.title ?? item.latex}
              >
                {item.display}
              </button>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
