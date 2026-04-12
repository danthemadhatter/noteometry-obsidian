import React, { useState, useCallback, useRef } from "react";

interface Props {
  onInsert: (latex: string) => void;
  onDragStart?: (display: string) => void;
  /** Place a stamp directly at screen coordinates (for touch drag) */
  onDropStamp?: (display: string, screenX: number, screenY: number) => void;
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
      { latex: "\\tan ", display: "tan" }, { latex: "\\sec ", display: "sec" },
      { latex: "\\csc ", display: "csc" }, { latex: "\\cot ", display: "cot" },
      { latex: "\\arcsin ", display: "sin⁻¹" }, { latex: "\\arccos ", display: "cos⁻¹" },
      { latex: "\\arctan ", display: "tan⁻¹" },
      { latex: "\\ln ", display: "ln" }, { latex: "\\log ", display: "log" },
      { latex: "\\log_{}", display: "log₍₎" }, { latex: "e^{}", display: "eˣ" },
    ],
  },
  {
    id: "diffeq", label: "y′",
    items: [
      { latex: "y'", display: "y′", title: "First derivative" },
      { latex: "y''", display: "y″", title: "Second derivative" },
      { latex: "\\dot{y}", display: "ẏ", title: "Time derivative" },
      { latex: "\\ddot{y}", display: "ÿ", title: "Second time derivative" },
      { latex: "\\frac{dy}{dx}", display: "dy/dx", title: "Derivative" },
      { latex: "\\frac{d^2y}{dx^2}", display: "d²y/dx²", title: "Second derivative" },
      { latex: "\\frac{\\partial f}{\\partial x}", display: "∂f/∂x", title: "Partial derivative" },
      { latex: "\\frac{\\partial^2 f}{\\partial x^2}", display: "∂²f/∂x²", title: "Second partial" },
      { latex: "\\mathcal{L}\\{\\}", display: "ℒ{ }", title: "Laplace transform" },
      { latex: "\\mathcal{L}^{-1}\\{\\}", display: "ℒ⁻¹{ }", title: "Inverse Laplace" },
      { latex: "\\mathcal{F}\\{\\}", display: "ℱ{ }", title: "Fourier transform" },
      { latex: "s", display: "s", title: "Laplace variable" },
      { latex: "\\delta(t)", display: "δ(t)", title: "Dirac delta" },
      { latex: "u(t)", display: "u(t)", title: "Unit step" },
    ],
  },
  {
    id: "ee", label: "⚡",
    items: [
      { latex: "V", display: "V", title: "Voltage" },
      { latex: "I", display: "I", title: "Current" },
      { latex: "R", display: "R", title: "Resistance" },
      { latex: "Z", display: "Z", title: "Impedance" },
      { latex: "j\\omega", display: "jω", title: "Complex frequency" },
      { latex: "\\angle ", display: "∠", title: "Phasor angle" },
      { latex: "\\vec{E}", display: "E⃗", title: "Electric field" },
      { latex: "\\vec{B}", display: "B⃗", title: "Magnetic field" },
      { latex: "\\vec{H}", display: "H⃗", title: "H field" },
      { latex: "\\epsilon_0", display: "ε₀", title: "Permittivity" },
      { latex: "\\mu_0", display: "μ₀", title: "Permeability" },
      { latex: "\\nabla \\times ", display: "∇×", title: "Curl" },
      { latex: "\\nabla \\cdot ", display: "∇·", title: "Divergence" },
      { latex: "\\oint \\vec{E} \\cdot d\\vec{l}", display: "∮E⃗·dl⃗", title: "Line integral" },
      { latex: "\\oiint \\vec{B} \\cdot d\\vec{A}", display: "∯B⃗·dA⃗", title: "Surface integral" },
      { latex: "\\frac{1}{j\\omega C}", display: "1/jωC", title: "Capacitor impedance" },
      { latex: "j\\omega L", display: "jωL", title: "Inductor impedance" },
      { latex: "\\Omega ", display: "Ω", title: "Ohms" },
      { latex: "\\text{dB}", display: "dB", title: "Decibels" },
      { latex: "H(s)", display: "H(s)", title: "Transfer function" },
    ],
  },
  {
    // Circuit schematic helpers — component label prefixes, supply rail
    // names, transistor terminal symbols, and drop-on-canvas symbols
    // (ground, AC/DC markers) that survive as text stamps on the canvas.
    id: "circuit", label: "⎓",
    items: [
      // ── Ground / reference symbols (drop these on the canvas) ──
      { latex: "\\text{GND}", display: "⏚", stamp: "⏚", title: "Earth ground" },
      { latex: "\\text{CGND}", display: "⏛", stamp: "⏛", title: "Chassis ground" },
      { latex: "\\text{DC}", display: "⎓", stamp: "⎓", title: "DC supply marker" },
      { latex: "\\text{AC}", display: "∿", stamp: "∿", title: "AC source marker" },
      // ── Current source markers (dot-in-circle / cross-in-circle) ──
      { latex: "\\odot ", display: "⊙", stamp: "⊙", title: "Current out of page" },
      { latex: "\\otimes ", display: "⊗", stamp: "⊗", title: "Current into page" },
      { latex: "\\oplus ", display: "⊕", stamp: "⊕", title: "Positive / source" },
      { latex: "\\ominus ", display: "⊖", stamp: "⊖", title: "Negative / sink" },
      // ── Component label prefixes (click to insert into input) ──
      { latex: "R_{}", display: "R₁", title: "Resistor label" },
      { latex: "C_{}", display: "C₁", title: "Capacitor label" },
      { latex: "L_{}", display: "L₁", title: "Inductor label" },
      { latex: "Q_{}", display: "Q₁", title: "Transistor label" },
      { latex: "D_{}", display: "D₁", title: "Diode label" },
      { latex: "M_{}", display: "M₁", title: "MOSFET label" },
      // ── Thevenin / Norton equivalents ──
      { latex: "V_{Th}", display: "V_Th", title: "Thevenin voltage" },
      { latex: "R_{Th}", display: "R_Th", title: "Thevenin resistance" },
      { latex: "I_{N}", display: "I_N", title: "Norton current" },
      { latex: "R_{N}", display: "R_N", title: "Norton resistance" },
      { latex: "R_{eq}", display: "R_eq", title: "Equivalent resistance" },
      // ── Supply rails ──
      { latex: "V_{CC}", display: "V_CC", title: "Collector supply" },
      { latex: "V_{EE}", display: "V_EE", title: "Emitter supply" },
      { latex: "V_{DD}", display: "V_DD", title: "Drain supply" },
      { latex: "V_{SS}", display: "V_SS", title: "Source supply" },
      { latex: "V_{ref}", display: "V_ref", title: "Reference voltage" },
      { latex: "V_{in}", display: "V_in", title: "Input voltage" },
      { latex: "V_{out}", display: "V_out", title: "Output voltage" },
      // ── BJT terminal voltages and currents ──
      { latex: "V_{BE}", display: "V_BE", title: "Base-emitter voltage" },
      { latex: "V_{CE}", display: "V_CE", title: "Collector-emitter voltage" },
      { latex: "I_{C}", display: "I_C", title: "Collector current" },
      { latex: "I_{B}", display: "I_B", title: "Base current" },
      { latex: "I_{E}", display: "I_E", title: "Emitter current" },
      // ── MOSFET terminal voltages and currents ──
      { latex: "V_{GS}", display: "V_GS", title: "Gate-source voltage" },
      { latex: "V_{DS}", display: "V_DS", title: "Drain-source voltage" },
      { latex: "V_{TH}", display: "V_th", title: "Threshold voltage" },
      { latex: "I_{D}", display: "I_D", title: "Drain current" },
      { latex: "g_{m}", display: "g_m", title: "Transconductance" },
      // ── Unit prefixes ──
      { latex: "\\text{k}", display: "k", title: "kilo (10³)" },
      { latex: "\\text{M}", display: "M", title: "mega (10⁶)" },
      { latex: "\\mu ", display: "µ", title: "micro (10⁻⁶)" },
      { latex: "\\text{n}", display: "n", title: "nano (10⁻⁹)" },
      { latex: "\\text{p}", display: "p", title: "pico (10⁻¹²)" },
      { latex: "\\text{f}", display: "f", title: "femto (10⁻¹⁵)" },
    ],
  },
];

// Export tabs for use in floating palette
export { TABS };
export type { TabDef };

export default function MathPalette({ onInsert, onDragStart, onDropStamp }: Props) {
  const [openTab, setOpenTab] = useState<string | null>(null);
  const dragRef = useRef<{
    item: SymbolItem;
    ghost: HTMLElement | null;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  // Desktop HTML5 drag — stamp on canvas ONLY, no Input insertion
  const handleDragStart = useCallback((e: React.DragEvent, item: SymbolItem) => {
    const stampText = item.stamp ?? item.display;
    e.dataTransfer.setData("text/plain", stampText);
    e.dataTransfer.setData("application/x-noteometry-symbol", JSON.stringify({ ...item, stamp: stampText }));
    e.dataTransfer.effectAllowed = "copy";
    onDragStart?.(stampText);
  }, [onDragStart]);

  // ── Touch drag for iPad ──
  // Attach touchmove/touchend to DOCUMENT so they fire even after
  // the finger leaves the original button element.
  const onTouchStart = useCallback((e: React.TouchEvent, item: SymbolItem) => {
    const t = e.touches[0];
    if (!t) return;
    dragRef.current = {
      item,
      ghost: null,
      startX: t.clientX,
      startY: t.clientY,
      moved: false,
    };

    const onTouchMove = (ev: TouchEvent) => {
      const state = dragRef.current;
      const touch = ev.touches[0];
      if (!state || !touch) return;

      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;

      if (!state.moved && Math.abs(dx) + Math.abs(dy) > 12) {
        state.moved = true;
        // Create ghost — drag only places on canvas, no Input insertion
        const ghost = document.createElement("div");
        ghost.textContent = state.item.stamp ?? state.item.display;
        ghost.style.cssText =
          "position:fixed;z-index:99999;pointer-events:none;" +
          "font-size:24px;padding:6px 10px;" +
          "background:rgba(74,124,155,0.15);border:2px solid #4a7c9b;" +
          "border-radius:10px;transform:translate(-50%,-110%);";
        document.body.appendChild(ghost);
        state.ghost = ghost;
      }

      if (state.ghost) {
        state.ghost.style.left = touch.clientX + "px";
        state.ghost.style.top = touch.clientY + "px";
      }

      if (state.moved) {
        ev.preventDefault(); // prevent scroll while dragging
      }
    };

    const onTouchEnd = (ev: TouchEvent) => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);

      const state = dragRef.current;
      dragRef.current = null;
      if (!state) return;

      if (state.ghost) {
        state.ghost.remove();
        // Check if finger ended over the canvas → place stamp directly
        const touch = ev.changedTouches[0];
        if (touch) {
          const el = document.elementFromPoint(touch.clientX, touch.clientY);
          if (el?.closest(".noteometry-canvas-area") && onDropStamp) {
            const stampText = state.item.stamp ?? state.item.display;
            onDropStamp(stampText, touch.clientX, touch.clientY);
          }
        }
      } else if (!state.moved) {
        // Pure tap — insert into Input only
        onInsert(state.item.latex);
      }
    };

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
  }, [onInsert, onDragStart]);

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
                onClick={() => onInsert(item.latex)}
                onDragStart={(e) => handleDragStart(e, item)}
                onTouchStart={(e) => onTouchStart(e, item)}
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
