import React, { useEffect, useRef, useState, useCallback } from "react";

export interface ContextMenuItem {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Render a thin separator line instead of a clickable row. */
  separator?: boolean;
  /** Optional keyboard shortcut hint shown on the right. */
  shortcut?: string;
  /** Optional icon (emoji or short string) shown on the left. */
  icon?: string;
  /** v1.12.0: nested items. When present, the row renders a chevron on
   *  the right and spawns a child menu on hover/click positioned to the
   *  right of the parent (or to the left if it would overflow the
   *  viewport). The child supports its own submenu, etc. — arbitrary
   *  depth. Items with a submenu still get the click-target padding +
   *  hover affordance, but their own onClick is ignored unless the
   *  submenu is empty. */
  submenu?: ContextMenuItem[];
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

interface SubMenuState {
  parentRect: DOMRect;
  items: ContextMenuItem[];
  /** Synthetic id derived from the parent row so we can detect "hover
   *  another item and replace this submenu" without leaking timeouts. */
  ownerKey: string;
}

/**
 * Right-click context menu for the canvas. Positioned absolutely at the
 * click coordinates and clamped to the viewport so it doesn't clip off
 * the bottom-right edge. Closes on Escape, outside click, or item pick.
 *
 * v1.12.0: submenu support. Items can carry a `submenu` array; rows
 * with a submenu show a chevron on the right and spawn a child menu
 * on hover (or tap, on touch). Submenus position themselves to the
 * right of the parent row, flipping to the left if they'd overflow.
 * Recursive — each submenu can carry its own submenu.
 */
export default function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenu, setSubmenu] = useState<SubMenuState | null>(null);

  useEffect(() => {
    // Close on outside click. Use capture so we fire before any handler
    // that would eat the event. Walk up from the target to make sure we
    // don't close when the user clicks inside an open submenu.
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      const root = menuRef.current;
      if (!root) return;
      // Inside the root menu: keep open.
      if (target && root.contains(target)) return;
      // Inside any descendant submenu rendered into the same React tree:
      // submenus mount as siblings (positioned absolutely), so we have
      // to test by class instead of contains().
      if (target instanceof Element && target.closest(".noteometry-ctx-menu")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (submenu) {
          setSubmenu(null);
          return;
        }
        onClose();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, submenu]);

  // Clamp the root menu to the viewport so it never clips off the right
  // or bottom edge. Measured after first render via the ref.
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) el.style.left = `${Math.max(8, vw - rect.width - 8)}px`;
    if (rect.bottom > vh) el.style.top = `${Math.max(8, vh - rect.height - 8)}px`;
  }, [x, y]);

  const openSubmenu = useCallback((parentEl: HTMLElement, child: ContextMenuItem[], ownerKey: string) => {
    if (child.length === 0) return;
    const rect = parentEl.getBoundingClientRect();
    setSubmenu({ parentRect: rect, items: child, ownerKey });
  }, []);

  const handleRowEnter = useCallback((e: React.PointerEvent, item: ContextMenuItem, key: string) => {
    if (item.submenu && item.submenu.length > 0) {
      openSubmenu(e.currentTarget as HTMLElement, item.submenu, key);
    } else {
      // Hovering a non-submenu row dismisses any open child.
      setSubmenu(null);
    }
  }, [openSubmenu]);

  const handleRowClick = useCallback((e: React.PointerEvent, item: ContextMenuItem, key: string) => {
    if (item.disabled) return;
    e.stopPropagation();
    if (item.submenu && item.submenu.length > 0) {
      // Touch path: tap on a submenu row opens it, doesn't close the parent.
      openSubmenu(e.currentTarget as HTMLElement, item.submenu, key);
      return;
    }
    item.onClick?.();
    onClose();
  }, [openSubmenu, onClose]);

  return (
    <>
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
          const key = `r${i}`;
          const hasSubmenu = !!item.submenu && item.submenu.length > 0;
          const isOpen = hasSubmenu && submenu?.ownerKey === key;
          return (
            <button
              key={i}
              className={[
                "noteometry-ctx-item",
                item.disabled ? "disabled" : "",
                item.danger ? "danger" : "",
                hasSubmenu ? "has-submenu" : "",
                isOpen ? "submenu-open" : "",
              ].filter(Boolean).join(" ")}
              disabled={item.disabled}
              onPointerEnter={(e) => handleRowEnter(e, item, key)}
              onPointerUp={(e) => handleRowClick(e, item, key)}
            >
              {item.icon && <span style={{ width: "20px", textAlign: "center", fontSize: "14px", flexShrink: 0 }}>{item.icon}</span>}
              <span className="noteometry-ctx-label">{item.label}</span>
              {item.shortcut && !hasSubmenu && (
                <span className="noteometry-ctx-shortcut">{item.shortcut}</span>
              )}
              {hasSubmenu && (
                <span className="noteometry-ctx-chevron" aria-hidden="true">›</span>
              )}
            </button>
          );
        })}
      </div>
      {submenu && (
        <SubMenu
          parentRect={submenu.parentRect}
          items={submenu.items}
          onClose={() => setSubmenu(null)}
          onPick={onClose}
        />
      )}
    </>
  );
}

interface SubMenuProps {
  parentRect: DOMRect;
  items: ContextMenuItem[];
  /** Close just this submenu (caller intends to keep root menu open). */
  onClose: () => void;
  /** Close the entire menu chain (called when a leaf item fires). */
  onPick: () => void;
}

/**
 * A submenu rendered to the right of its parent row, flipping to the
 * left when it would overflow. Reuses the same row markup as the root
 * menu so styling is shared. Recursive: items in here can have their
 * own `submenu` and the recursion drops in naturally.
 */
function SubMenu({ parentRect, items, onClose, onPick }: SubMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [child, setChild] = useState<SubMenuState | null>(null);
  const [computedX, setComputedX] = useState<number>(parentRect.right);
  const [computedY, setComputedY] = useState<number>(parentRect.top);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nextX = parentRect.right;
    let nextY = parentRect.top;
    // Flip to the left if we'd overflow the viewport on the right.
    if (nextX + rect.width > vw - 8) {
      nextX = Math.max(8, parentRect.left - rect.width);
    }
    // Pull up if we'd overflow the bottom.
    if (nextY + rect.height > vh - 8) {
      nextY = Math.max(8, vh - rect.height - 8);
    }
    setComputedX(nextX);
    setComputedY(nextY);
  }, [parentRect, items]);

  const handleRowEnter = useCallback((e: React.PointerEvent, item: ContextMenuItem, key: string) => {
    if (item.submenu && item.submenu.length > 0) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setChild({ parentRect: rect, items: item.submenu, ownerKey: key });
    } else {
      setChild(null);
    }
  }, []);

  const handleRowClick = useCallback((e: React.PointerEvent, item: ContextMenuItem, key: string) => {
    if (item.disabled) return;
    e.stopPropagation();
    if (item.submenu && item.submenu.length > 0) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setChild({ parentRect: rect, items: item.submenu, ownerKey: key });
      return;
    }
    item.onClick?.();
    onPick();
  }, [onPick]);

  // Outside-click for this submenu closes only it. Parent's outside-
  // click handler will catch clicks outside the entire menu chain.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target && target.closest(".noteometry-ctx-menu")) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [onClose]);

  return (
    <>
      <div
        ref={ref}
        className="noteometry-ctx-menu noteometry-ctx-submenu"
        style={{
          position: "fixed",
          left: computedX,
          top: computedY,
          zIndex: 10001,
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((item, i) => {
          if (item.separator) {
            return <div key={i} className="noteometry-ctx-sep" />;
          }
          const key = `s${i}`;
          const hasSubmenu = !!item.submenu && item.submenu.length > 0;
          const isOpen = hasSubmenu && child?.ownerKey === key;
          return (
            <button
              key={i}
              className={[
                "noteometry-ctx-item",
                item.disabled ? "disabled" : "",
                item.danger ? "danger" : "",
                hasSubmenu ? "has-submenu" : "",
                isOpen ? "submenu-open" : "",
              ].filter(Boolean).join(" ")}
              disabled={item.disabled}
              onPointerEnter={(e) => handleRowEnter(e, item, key)}
              onPointerUp={(e) => handleRowClick(e, item, key)}
            >
              {item.icon && <span style={{ width: "20px", textAlign: "center", fontSize: "14px", flexShrink: 0 }}>{item.icon}</span>}
              <span className="noteometry-ctx-label">{item.label}</span>
              {item.shortcut && !hasSubmenu && (
                <span className="noteometry-ctx-shortcut">{item.shortcut}</span>
              )}
              {hasSubmenu && (
                <span className="noteometry-ctx-chevron" aria-hidden="true">›</span>
              )}
            </button>
          );
        })}
      </div>
      {child && (
        <SubMenu
          parentRect={child.parentRect}
          items={child.items}
          onClose={() => setChild(null)}
          onPick={onPick}
        />
      )}
    </>
  );
}
