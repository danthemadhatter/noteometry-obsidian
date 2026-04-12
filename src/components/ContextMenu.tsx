import React, { useEffect, useRef } from "react";

export interface ContextMenuItem {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Render a thin separator line instead of a clickable row. */
  separator?: boolean;
  /** Optional keyboard shortcut hint shown on the right. */
  shortcut?: string;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/**
 * Right-click context menu for the canvas. Positioned absolutely at the
 * click coordinates and clamped to the viewport so it doesn't clip off
 * the bottom-right edge. Closes on Escape, outside click, or item pick.
 */
export default function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close on outside click. Use capture so we fire before any handler
    // that would eat the event.
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  // Clamp to viewport so the menu never clips off the right or bottom
  // edge. Measured after first render via the ref.
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) el.style.left = `${Math.max(8, vw - rect.width - 8)}px`;
    if (rect.bottom > vh) el.style.top = `${Math.max(8, vh - rect.height - 8)}px`;
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="noteometry-ctx-menu"
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 10000,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={i} className="noteometry-ctx-sep" />;
        }
        return (
          <button
            key={i}
            className={`noteometry-ctx-item ${item.disabled ? "disabled" : ""} ${item.danger ? "danger" : ""}`}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              item.onClick?.();
              onClose();
            }}
          >
            <span className="noteometry-ctx-label">{item.label}</span>
            {item.shortcut && (
              <span className="noteometry-ctx-shortcut">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
