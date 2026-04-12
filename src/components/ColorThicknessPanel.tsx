import React, { useEffect, useRef } from "react";

export interface PenColor {
  color: string;
  label: string;
}

export interface PenWidth {
  width: number;
  label: string;
}

export const PEN_COLORS: PenColor[] = [
  { color: "#1A1A2E", label: "Dark Navy" },
  { color: "#2563EB", label: "Blue" },
  { color: "#DC2626", label: "Red" },
  { color: "#16A34A", label: "Green" },
  { color: "#F59E0B", label: "Amber" },
  { color: "#6B7280", label: "Graphite" },
];

export const PEN_WIDTHS: PenWidth[] = [
  { width: 1, label: "Fine" },
  { width: 2.5, label: "Medium" },
  { width: 5, label: "Bold" },
  { width: 10, label: "Thick" },
];

interface Props {
  activeColor: string;
  activeWidth: number;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  anchorX: number;
  anchorY: number;
}

export default function ColorThicknessPanel({
  activeColor, activeWidth, onColorChange, onWidthChange, onClose,
  anchorX, anchorY,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Position to the left of the anchor point so it doesn't go off-screen on iPad
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) el.style.left = `${Math.max(8, vw - rect.width - 8)}px`;
    if (rect.bottom > vh) el.style.top = `${Math.max(8, vh - rect.height - 8)}px`;
  }, [anchorX, anchorY]);

  return (
    <div
      ref={panelRef}
      className="nm-pen-panel"
      style={{
        position: "fixed",
        left: Math.max(8, anchorX - 220),
        top: anchorY,
        zIndex: 10001,
      }}
    >
      <div className="nm-pen-section-label">Color</div>
      <div className="nm-pen-colors">
        {PEN_COLORS.map((c) => (
          <button
            key={c.color}
            className={`nm-pen-color-swatch ${activeColor === c.color ? "nm-pen-active" : ""}`}
            style={{ backgroundColor: c.color }}
            title={c.label}
            aria-label={c.label}
            onClick={() => {
              onColorChange(c.color);
              onClose();
            }}
          />
        ))}
      </div>
      <div className="nm-pen-section-label">Width</div>
      <div className="nm-pen-widths">
        {PEN_WIDTHS.map((w) => (
          <button
            key={w.width}
            className={`nm-pen-width-option ${activeWidth === w.width ? "nm-pen-active" : ""}`}
            title={w.label}
            aria-label={`${w.label} (${w.width}px)`}
            onClick={() => {
              onWidthChange(w.width);
              onClose();
            }}
          >
            <svg width="48" height="12" viewBox="0 0 48 12">
              <line x1="4" y1="6" x2="44" y2="6" stroke="var(--nm-text)" strokeWidth={w.width} strokeLinecap="round" />
            </svg>
            <span className="nm-pen-width-label">{w.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
