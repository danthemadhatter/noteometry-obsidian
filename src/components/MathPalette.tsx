import React, { useState } from "react";

interface Props {
  onInsert: (latex: string) => void;
}

interface SymbolItem {
  latex: string;
  display: string;
  title?: string;
}

interface TabDef {
  id: string;
  label: string;
  items: SymbolItem[];
}

const TABS: TabDef[] = [
  {
    id: "basic",
    label: "√□",
    items: [
      { latex: "\\frac{}{}", display: "▫/▫", title: "Fraction" },
      { latex: "\\sqrt{}", display: "√▫", title: "Square root" },
      { latex: "\\sqrt[]{}", display: "ⁿ√▫", title: "nth root" },
      { latex: "^{}", display: "▫ⁿ", title: "Superscript" },
      { latex: "_{}", display: "▫ₙ", title: "Subscript" },
      { latex: "^{}_{}", display: "▫ⁿₘ", title: "Super+subscript" },
      { latex: "()", display: "(▫)", title: "Parentheses" },
      { latex: "\\left(\\right)", display: "(  )", title: "Auto-size parens" },
      { latex: "[]", display: "[▫]", title: "Brackets" },
      { latex: "\\{\\}", display: "{▫}", title: "Braces" },
      { latex: "\\left|\\right|", display: "|▫|", title: "Absolute value" },
      { latex: "\\left\\|\\right\\|", display: "‖▫‖", title: "Norm" },
      { latex: "\\overline{}", display: "▫̄", title: "Overline" },
      { latex: "\\underline{}", display: "▫̲", title: "Underline" },
      { latex: "\\overbrace{}", display: "⏞", title: "Overbrace" },
    ],
  },
  {
    id: "relational",
    label: "∈∞",
    items: [
      { latex: "=", display: "=", title: "Equals" },
      { latex: "\\neq ", display: "≠", title: "Not equal" },
      { latex: "\\approx ", display: "≈", title: "Approximately" },
      { latex: "\\equiv ", display: "≡", title: "Equivalent" },
      { latex: "\\sim ", display: "∼", title: "Similar" },
      { latex: "> ", display: ">", title: "Greater than" },
      { latex: "< ", display: "<", title: "Less than" },
      { latex: "\\geq ", display: "≥", title: "Greater or equal" },
      { latex: "\\leq ", display: "≤", title: "Less or equal" },
      { latex: "\\gg ", display: "≫", title: "Much greater" },
      { latex: "\\ll ", display: "≪", title: "Much less" },
      { latex: "\\in ", display: "∈", title: "Element of" },
      { latex: "\\notin ", display: "∉", title: "Not element of" },
      { latex: "\\subset ", display: "⊂", title: "Subset" },
      { latex: "\\supset ", display: "⊃", title: "Superset" },
      { latex: "\\subseteq ", display: "⊆", title: "Subset or equal" },
      { latex: "\\supseteq ", display: "⊇", title: "Superset or equal" },
      { latex: "\\infty ", display: "∞", title: "Infinity" },
      { latex: "\\propto ", display: "∝", title: "Proportional" },
      { latex: "\\therefore ", display: "∴", title: "Therefore" },
    ],
  },
  {
    id: "arrows",
    label: "→·",
    items: [
      { latex: "\\rightarrow ", display: "→", title: "Right arrow" },
      { latex: "\\leftarrow ", display: "←", title: "Left arrow" },
      { latex: "\\leftrightarrow ", display: "↔", title: "Left-right arrow" },
      { latex: "\\Rightarrow ", display: "⇒", title: "Double right arrow" },
      { latex: "\\Leftarrow ", display: "⇐", title: "Double left arrow" },
      { latex: "\\Leftrightarrow ", display: "⇔", title: "Double left-right" },
      { latex: "\\uparrow ", display: "↑", title: "Up arrow" },
      { latex: "\\downarrow ", display: "↓", title: "Down arrow" },
      { latex: "\\mapsto ", display: "↦", title: "Maps to" },
      { latex: "\\longrightarrow ", display: "⟶", title: "Long right arrow" },
      { latex: "\\cdot ", display: "·", title: "Center dot" },
      { latex: "\\cdots ", display: "⋯", title: "Center dots" },
      { latex: "\\ldots ", display: "…", title: "Low dots" },
      { latex: "\\vdots ", display: "⋮", title: "Vertical dots" },
      { latex: "\\ddots ", display: "⋱", title: "Diagonal dots" },
    ],
  },
  {
    id: "greek",
    label: "αΩ",
    items: [
      { latex: "\\alpha ", display: "α", title: "alpha" },
      { latex: "\\beta ", display: "β", title: "beta" },
      { latex: "\\gamma ", display: "γ", title: "gamma" },
      { latex: "\\delta ", display: "δ", title: "delta" },
      { latex: "\\epsilon ", display: "ε", title: "epsilon" },
      { latex: "\\zeta ", display: "ζ", title: "zeta" },
      { latex: "\\eta ", display: "η", title: "eta" },
      { latex: "\\theta ", display: "θ", title: "theta" },
      { latex: "\\iota ", display: "ι", title: "iota" },
      { latex: "\\kappa ", display: "κ", title: "kappa" },
      { latex: "\\lambda ", display: "λ", title: "lambda" },
      { latex: "\\mu ", display: "μ", title: "mu" },
      { latex: "\\nu ", display: "ν", title: "nu" },
      { latex: "\\xi ", display: "ξ", title: "xi" },
      { latex: "\\pi ", display: "π", title: "pi" },
      { latex: "\\rho ", display: "ρ", title: "rho" },
      { latex: "\\sigma ", display: "σ", title: "sigma" },
      { latex: "\\tau ", display: "τ", title: "tau" },
      { latex: "\\phi ", display: "φ", title: "phi" },
      { latex: "\\chi ", display: "χ", title: "chi" },
      { latex: "\\psi ", display: "ψ", title: "psi" },
      { latex: "\\omega ", display: "ω", title: "omega" },
      { latex: "\\Gamma ", display: "Γ", title: "Gamma" },
      { latex: "\\Delta ", display: "Δ", title: "Delta" },
      { latex: "\\Theta ", display: "Θ", title: "Theta" },
      { latex: "\\Lambda ", display: "Λ", title: "Lambda" },
      { latex: "\\Pi ", display: "Π", title: "Pi" },
      { latex: "\\Sigma ", display: "Σ", title: "Sigma" },
      { latex: "\\Phi ", display: "Φ", title: "Phi" },
      { latex: "\\Psi ", display: "Ψ", title: "Psi" },
      { latex: "\\Omega ", display: "Ω", title: "Omega" },
    ],
  },
  {
    id: "matrices",
    label: "[ ]",
    items: [
      { latex: "\\begin{pmatrix}  &  \\\\  &  \\end{pmatrix}", display: "(2×2)", title: "2x2 matrix (parens)" },
      { latex: "\\begin{bmatrix}  &  \\\\  &  \\end{bmatrix}", display: "[2×2]", title: "2x2 matrix (brackets)" },
      { latex: "\\begin{pmatrix}  &  &  \\\\  &  &  \\\\  &  &  \\end{pmatrix}", display: "(3×3)", title: "3x3 matrix (parens)" },
      { latex: "\\begin{bmatrix}  &  &  \\\\  &  &  \\\\  &  &  \\end{bmatrix}", display: "[3×3]", title: "3x3 matrix (brackets)" },
      { latex: "\\begin{vmatrix}  &  \\\\  &  \\end{vmatrix}", display: "|2×2|", title: "2x2 determinant" },
      { latex: "\\begin{cases}  \\\\  \\end{cases}", display: "{cases", title: "Piecewise / cases" },
      { latex: "\\begin{pmatrix}  \\\\  \\\\  \\end{pmatrix}", display: "(col)", title: "Column vector" },
      { latex: "\\begin{bmatrix}  \\\\  \\\\  \\end{bmatrix}", display: "[col]", title: "Column vector (brackets)" },
    ],
  },
  {
    id: "fractions",
    label: "▫ᵃ",
    items: [
      { latex: "\\frac{}{}", display: "▫/▫", title: "Fraction" },
      { latex: "\\dfrac{}{}", display: "▫/▫ₗ", title: "Display fraction" },
      { latex: "\\tfrac{}{}", display: "▫/▫ₛ", title: "Text fraction" },
      { latex: "\\sqrt{}", display: "√", title: "Square root" },
      { latex: "\\sqrt[3]{}", display: "³√", title: "Cube root" },
      { latex: "\\sqrt[n]{}", display: "ⁿ√", title: "nth root" },
      { latex: "^{2}", display: "□²", title: "Squared" },
      { latex: "^{3}", display: "□³", title: "Cubed" },
      { latex: "^{n}", display: "□ⁿ", title: "Power n" },
      { latex: "^{-1}", display: "□⁻¹", title: "Inverse" },
      { latex: "e^{}", display: "eˣ", title: "Exponential" },
      { latex: "10^{}", display: "10ˣ", title: "Power of 10" },
    ],
  },
  {
    id: "accents",
    label: "â",
    items: [
      { latex: "\\hat{}", display: "â", title: "Hat" },
      { latex: "\\bar{}", display: "ā", title: "Bar" },
      { latex: "\\vec{}", display: "a⃗", title: "Vector arrow" },
      { latex: "\\dot{}", display: "ȧ", title: "Dot" },
      { latex: "\\ddot{}", display: "ä", title: "Double dot" },
      { latex: "\\tilde{}", display: "ã", title: "Tilde" },
      { latex: "\\mathbf{}", display: "𝐚", title: "Bold" },
      { latex: "\\mathcal{}", display: "𝒜", title: "Calligraphic" },
      { latex: "\\mathbb{}", display: "𝔸", title: "Blackboard bold" },
      { latex: "\\cancel{}", display: "a̸", title: "Cancel/strikethrough" },
      { latex: "\\boxed{}", display: "☐", title: "Boxed" },
    ],
  },
  {
    id: "sums",
    label: "ΣU",
    items: [
      { latex: "\\sum ", display: "Σ", title: "Sum" },
      { latex: "\\sum_{i=1}^{n}", display: "Σᵢ₌₁ⁿ", title: "Sum i=1 to n" },
      { latex: "\\sum_{k=0}^{\\infty}", display: "Σₖ₌₀∞", title: "Sum k=0 to inf" },
      { latex: "\\prod ", display: "Π", title: "Product" },
      { latex: "\\prod_{i=1}^{n}", display: "Πᵢ₌₁ⁿ", title: "Product i=1 to n" },
      { latex: "\\bigcup ", display: "⋃", title: "Big union" },
      { latex: "\\bigcap ", display: "⋂", title: "Big intersection" },
      { latex: "\\cup ", display: "∪", title: "Union" },
      { latex: "\\cap ", display: "∩", title: "Intersection" },
      { latex: "\\setminus ", display: "∖", title: "Set minus" },
      { latex: "\\emptyset ", display: "∅", title: "Empty set" },
      { latex: "\\forall ", display: "∀", title: "For all" },
      { latex: "\\exists ", display: "∃", title: "Exists" },
      { latex: "\\neg ", display: "¬", title: "Not" },
      { latex: "\\land ", display: "∧", title: "And" },
      { latex: "\\lor ", display: "∨", title: "Or" },
    ],
  },
  {
    id: "calculus",
    label: "∫lim",
    items: [
      { latex: "\\int ", display: "∫", title: "Integral" },
      { latex: "\\int_{a}^{b}", display: "∫ₐᵇ", title: "Definite integral" },
      { latex: "\\int_{0}^{\\infty}", display: "∫₀∞", title: "Integral 0 to inf" },
      { latex: "\\iint ", display: "∬", title: "Double integral" },
      { latex: "\\iiint ", display: "∭", title: "Triple integral" },
      { latex: "\\oint ", display: "∮", title: "Contour integral" },
      { latex: "\\frac{d}{d}", display: "d/d", title: "Derivative" },
      { latex: "\\frac{\\partial}{\\partial}", display: "∂/∂", title: "Partial derivative" },
      { latex: "\\partial ", display: "∂", title: "Partial" },
      { latex: "\\lim_{\\to}", display: "lim", title: "Limit" },
      { latex: "\\lim_{x\\to 0}", display: "lim₀", title: "Limit x→0" },
      { latex: "\\lim_{x\\to\\infty}", display: "lim∞", title: "Limit x→∞" },
      { latex: "\\nabla ", display: "∇", title: "Nabla/gradient" },
      { latex: "\\nabla\\times ", display: "∇×", title: "Curl" },
      { latex: "\\nabla\\cdot ", display: "∇·", title: "Divergence" },
      { latex: "\\Delta ", display: "Δ", title: "Laplacian" },
      { latex: "\\sin ", display: "sin", title: "Sine" },
      { latex: "\\cos ", display: "cos", title: "Cosine" },
      { latex: "\\tan ", display: "tan", title: "Tangent" },
      { latex: "\\ln ", display: "ln", title: "Natural log" },
      { latex: "\\log ", display: "log", title: "Logarithm" },
      { latex: "\\log_{}", display: "log₍₎", title: "Log base" },
    ],
  },
];

export default function MathPalette({ onInsert }: Props) {
  const [activeTab, setActiveTab] = useState("basic");
  const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0]!;

  return (
    <div className="noteometry-mathpal">
      {/* Tab bar */}
      <div className="noteometry-mathpal-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`noteometry-mathpal-tab ${t.id === activeTab ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
            title={t.id}
          >
            <span className="noteometry-mathpal-tab-icon">{t.label}</span>
          </button>
        ))}
      </div>
      {/* Symbol grid */}
      <div className="noteometry-mathpal-grid">
        {tab.items.map((item, i) => (
          <button
            key={`${tab.id}-${i}`}
            className="noteometry-mathpal-btn"
            onClick={() => onInsert(item.latex)}
            title={item.title ?? item.latex}
          >
            <span className="noteometry-mathpal-btn-sym">{item.display}</span>
            {item.title && <span className="noteometry-mathpal-btn-label">{item.title}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
