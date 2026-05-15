import React, { useCallback, useRef, useState } from "react";
import { Platform } from "obsidian";
import { CanvasNavState } from "./useCanvasNavState";

interface Props {
  nav: CanvasNavState;
}

/** v1.15.0: Vertical right-rail list of pages in the active section.
 *  OneNote-shaped: skinny strip on the right edge, "+ Add page" at
 *  top, pages stacked vertically. Collapsible to a thin handle.
 *  Replaces the Pages column of the v1.14.x slab.
 *
 *  Keyboard: ↑/↓ to walk, Enter to open, F2 to rename, Delete to
 *  trash. Click to open. Double-click to rename. Right-click to
 *  delete (v1.14.6 confirm pattern). */
export default function PagesRail({ nav }: Props) {
  const {
    activeSection, activePagePath, focusedPagePath, setFocusedPagePath,
    openFile, addPage, renaming, beginRenamePage, deletePage,
    setRenameValue, commitRename, cancelRename,
  } = nav;

  // v1.16.1: default to collapsed on mobile/iPad. The expanded rail is
  // 200px+ wide which on iPad portrait leaves the canvas as a sliver
  // between the SectionTabsBar and the rail. Users can still expand it
  // explicitly via the handle. Same Platform.isMobile gate the Tools FAB
  // uses in NoteometryApp — reliable inside Obsidian's webview where
  // CSS media queries misfire when a paired Apple Pencil reports as a
  // fine pointer.
  const [collapsed, setCollapsed] = useState<boolean>(() => Platform.isMobile);
  const listRef = useRef<HTMLUListElement | null>(null);

  const onPagesKeyDown = useCallback((e: React.KeyboardEvent<HTMLUListElement>) => {
    if (renaming) return;
    const pages = activeSection?.pages ?? [];
    const first = pages[0];
    if (!first) return;
    const currentPath = focusedPagePath ?? activePagePath ?? first.path;
    const idx = pages.findIndex(p => p.path === currentPath);
    const focusRow = (path: string) => {
      setFocusedPagePath(path);
      queueMicrotask(() => {
        const el = listRef.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
        el?.focus();
      });
    };
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = pages[Math.min(pages.length - 1, idx + 1)];
      if (next) focusRow(next.path);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = pages[Math.max(0, idx - 1)];
      if (prev) focusRow(prev.path);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const page = pages[idx];
      if (page) openFile(page.file);
    } else if (e.key === "F2") {
      e.preventDefault();
      const page = pages[idx];
      if (page) beginRenamePage(page);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const page = pages[idx];
      if (page) void deletePage(page.file);
    }
  }, [activeSection, activePagePath, focusedPagePath, renaming, openFile, beginRenamePage, deletePage, setFocusedPagePath]);

  const stopBubble = (e: React.MouseEvent) => e.stopPropagation();

  if (collapsed) {
    return (
      <div
        className="nm-onenote-rail nm-onenote-rail-collapsed"
        onClick={stopBubble}
        onContextMenu={stopBubble}
        onMouseDown={stopBubble}
      >
        <button
          type="button"
          className="nm-onenote-rail-toggle"
          onClick={() => setCollapsed(false)}
          title="Show pages"
          aria-label="Show pages"
        >
          <span aria-hidden="true">{"\u2039"}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="nm-onenote-rail"
      onClick={stopBubble}
      onDoubleClick={stopBubble}
      onContextMenu={stopBubble}
      onMouseDown={stopBubble}
    >
      <div className="nm-onenote-rail-hdr">
        <button
          type="button"
          className="nm-onenote-rail-add"
          onClick={() => void addPage()}
          disabled={!activeSection}
          title="Add page"
          aria-label="Add page"
        >
          <span aria-hidden="true">+</span> Add page
        </button>
        <button
          type="button"
          className="nm-onenote-rail-toggle"
          onClick={() => setCollapsed(true)}
          title="Hide pages"
          aria-label="Hide pages"
        >
          <span aria-hidden="true">{"\u203a"}</span>
        </button>
      </div>
      <ul
        ref={listRef}
        className="nm-onenote-rail-list"
        role="listbox"
        aria-label="Pages"
        aria-activedescendant={
          focusedPagePath ? `nm-page-${focusedPagePath}`
          : (activePagePath ? `nm-page-${activePagePath}` : undefined)
        }
        onKeyDown={onPagesKeyDown}
      >
        {!activeSection && (
          <li className="nm-onenote-rail-empty">Pick a section above.</li>
        )}
        {activeSection && activeSection.pages.length === 0 && (
          <li className="nm-onenote-rail-empty">No pages yet.</li>
        )}
        {activeSection && activeSection.pages.map(page => {
          const isActive = page.path === activePagePath;
          const isFocused = page.path === focusedPagePath;
          const isRenaming = renaming?.kind === "page" && renaming.path === page.path;
          return (
            <li key={page.path}>
              <button
                type="button"
                id={`nm-page-${page.path}`}
                role="option"
                aria-selected={isActive}
                tabIndex={isActive || isFocused ? 0 : -1}
                data-path={page.path}
                className={`nm-onenote-rail-row${isActive ? " active" : ""}`}
                onClick={() => { setFocusedPagePath(page.path); openFile(page.file); }}
                onDoubleClick={() => beginRenamePage(page)}
                onContextMenu={(e) => { e.preventDefault(); void deletePage(page.file); }}
                title={`Click to open · double-click to rename · right-click to delete — ${page.subPath ? `${page.subPath}/` : ""}${page.label}`}
              >
                {isRenaming ? (
                  <input
                    autoFocus
                    className="nm-onenote-rail-rename"
                    value={renaming.value}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => void commitRename()}
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); void commitRename(); }
                      if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                    }}
                    onClick={e => e.stopPropagation()}
                    aria-label="Rename page"
                  />
                ) : (
                  <>
                    <span className="nm-onenote-rail-label">{page.label}</span>
                    {page.subPath && (
                      <span className="nm-onenote-rail-sub">{page.subPath}</span>
                    )}
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
