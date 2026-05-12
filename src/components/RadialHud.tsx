import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ContextMenu, { ContextMenuItem } from "./ContextMenu";

/**
 * Cursor-anchored radial HUD (v1.16.0).
 *
 * Renders up to 6 "quick" actions arranged around the cursor and
 * delegates the rest to the standard ContextMenu via a "More" center
 * button. The quick set is derived from the full items list by name:
 * Paste, Text Box, Math Palette, Image — and we add a "Gemini" entry
 * if the items list contains anything Gemini-related (none today, but
 * the slot is reserved so future AI drop-ins can plug in without a
 * second radial revision). Items that aren't present in the source
 * menu are rendered disabled rather than omitted, so the HUD layout
 * is consistent across contexts.
 *
 * Falls back to ContextMenu automatically when items are <= 2 (e.g.
 * stamp-context menus) so we don't waste a radial on a tiny menu.
 */
export interface RadialHudProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

interface Slot {
  key: string;
  label: string;
  icon: string;
  /** Pulled from the items list by display label or label prefix. */
  match: (item: ContextMenuItem) => boolean;
}

/**
 * Slot order is clockwise from top. Each slot is a "kind of action"
 * rather than a specific menu entry, so the radial works for both
 * the empty-canvas hub and per-object menus.
 */
const SLOTS: readonly Slot[] = [
  { key: "text", label: "Text", icon: "📝", match: (i) => i.label === "Text Box" || i.label === "Rename…" },
  { key: "math", label: "Math", icon: "🧮", match: (i) => i.label === "Math Palette" || i.label.startsWith("Math") },
  { key: "paste", label: "Paste", icon: "📋", match: (i) => i.label === "Paste" },
  { key: "gemini", label: "Gemini", icon: "✨", match: (i) => /gemini/i.test(i.label) },
  { key: "image", label: "Image", icon: "🖼️", match: (i) => i.label === "Image" },
  { key: "undo", label: "Undo", icon: "↩️", match: (i) => i.label === "Undo" },
] as const;

/** Pull the best-matching item out of `items` for a given slot. */
function resolveSlot(slot: Slot, items: ContextMenuItem[]): ContextMenuItem | null {
  for (const item of items) {
    if (!item || item.separator) continue;
    if (slot.match(item)) return item;
  }
  return null;
}

export default function RadialHud({ x, y, items, onClose }: RadialHudProps) {
  const [fallback, setFallback] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const portalTarget = typeof document !== "undefined" ? document.body : null;

  const resolved = useMemo(
    () => SLOTS.map((s) => ({ slot: s, item: resolveSlot(s, items) })),
    [items],
  );

  // If the menu is tiny (e.g. stamp-only menu), don't bother with the
  // radial — fall straight through to the list. Threshold is 3 to
  // include a typical 2-item stamp menu without dropping into radial.
  const tooSmall = items.filter((i) => !i.separator && !i.disabled).length <= 2;

  useEffect(() => {
    // Outside-click + Escape close the HUD itself. Children handle
    // their own pick → close via onClose.
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target && ref.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".noteometry-radial-hud")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Defer one tick so the pointerup that opened the HUD doesn't
    // immediately close it. Mirrors ContextMenu's own one-tick guard.
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", onDown, true);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!portalTarget) return null;

  if (tooSmall || fallback) {
    // Standard list menu — preserves existing behavior whenever the
    // radial wouldn't add value, and provides the "more" affordance.
    return <ContextMenu x={x} y={y} items={items} onClose={onClose} />;
  }

  // Clamp the disc into the viewport so the cursor click near a corner
  // doesn't paint half the wheel off-screen.
  const RADIUS = 130;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const cx = clamp(x, RADIUS + 8, window.innerWidth - RADIUS - 8);
  const cy = clamp(y, RADIUS + 8, window.innerHeight - RADIUS - 8);

  const itemRadius = 88; // distance from center to each slot button center
  const count = SLOTS.length;
  const startAngle = -Math.PI / 2; // first slot at 12 o'clock

  return createPortal(
    <div
      ref={ref}
      className="noteometry-radial-hud"
      style={{ left: cx, top: cy }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="noteometry-radial-hud-disc" />
      {resolved.map(({ slot, item }, i) => {
        const angle = startAngle + (i * 2 * Math.PI) / count;
        const dx = Math.cos(angle) * itemRadius;
        const dy = Math.sin(angle) * itemRadius;
        const disabled = !item || item.disabled;
        return (
          <button
            key={slot.key}
            className="noteometry-radial-hud-item"
            disabled={disabled}
            style={{ transform: `translate(${dx}px, ${dy}px)` }}
            onPointerUp={(e) => {
              if (disabled || !item) return;
              e.stopPropagation();
              item.onClick?.();
              onClose();
            }}
            title={item ? item.label : `${slot.label} (no action available)`}
          >
            <span className="nm-radial-icon" aria-hidden="true">{slot.icon}</span>
            <span className="nm-radial-label">{slot.label}</span>
          </button>
        );
      })}
      <button
        className="noteometry-radial-hud-center"
        onPointerUp={(e) => {
          e.stopPropagation();
          // Drop to the standard list so the user can reach actions
          // not bound to a radial slot.
          setFallback(true);
        }}
        title="More actions"
      >
        More
      </button>
    </div>,
    portalTarget,
  );
}
