import React, { useCallback, useRef } from "react";
import { CanvasNavState, sectionHue } from "./useCanvasNavState";
import { rootDir } from "../../lib/persistence";
import type { App } from "obsidian";
import type NoteometryPlugin from "../../main";

interface Props {
  app: App;
  plugin: NoteometryPlugin;
  nav: CanvasNavState;
}

/** v1.15.0: Horizontal section tabs across the top of the canvas.
 *  OneNote-shaped: thin strip, colored tabs, active tab connects
 *  visually to the page area below. Replaces the Sections column of
 *  the v1.14.x slab. Click to switch, double-click to rename, +Add
 *  opens an inline draft tab. Keyboard: ←/→ to walk, Enter to switch,
 *  F2 to rename, Delete to trash. */
export default function SectionTabsBar({ app, plugin, nav }: Props) {
  const {
    sections, activeSection, renaming, newSectionDraft,
    selectSection, beginRenameSection, deleteSection,
    setRenameValue, commitRename, cancelRename,
    openNewSection, setNewSectionDraft, commitNewSection, cancelNewSection,
  } = nav;

  const barRef = useRef<HTMLDivElement | null>(null);
  const rootLabel = rootDir(plugin);

  const onTabsKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (renaming) return;
    const idx = sections.findIndex(s => s.folderPath === activeSection?.folderPath);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = sections[Math.min(sections.length - 1, idx + 1)];
      if (next) selectSection(next.folderPath);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = sections[Math.max(0, idx - 1)];
      if (prev) selectSection(prev.folderPath);
    } else if (e.key === "F2" && activeSection) {
      e.preventDefault();
      beginRenameSection(activeSection);
    } else if ((e.key === "Delete" || e.key === "Backspace") && activeSection) {
      e.preventDefault();
      void deleteSection(activeSection);
    }
  }, [sections, activeSection, renaming, selectSection, beginRenameSection, deleteSection]);

  // Stop mouse events from bubbling to the canvas area's click /
  // contextmenu handlers (which deselect / open the tools menu).
  const stopBubble = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      ref={barRef}
      className="nm-onenote-tabs"
      role="tablist"
      aria-label="Sections"
      onKeyDown={onTabsKeyDown}
      onClick={stopBubble}
      onDoubleClick={stopBubble}
      onContextMenu={stopBubble}
      onMouseDown={stopBubble}
    >
      {sections.map(section => {
        const isActive = section.folderPath === activeSection?.folderPath;
        const isRenaming = renaming?.kind === "section" && renaming.path === section.folderPath;
        const hue = sectionHue(section.folderPath);
        const style: React.CSSProperties = {
          // Color the tab edge — OneNote's most recognizable nav cue.
          // Active tab gets the full color; inactive tabs get a thin
          // top stripe so users can see all section colors at once.
          ["--nm-section-hue" as string]: String(hue),
        };
        return (
          <button
            key={section.folderPath || "root"}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`nm-onenote-tab${isActive ? " active" : ""}${section.isRootBucket ? " is-root-bucket" : ""}`}
            style={style}
            onClick={() => selectSection(section.folderPath)}
            onDoubleClick={() => beginRenameSection(section)}
            onContextMenu={(e) => { e.preventDefault(); void deleteSection(section); }}
            title={`Click to open · double-click to rename · right-click to delete — ${section.folderPath || rootLabel}`}
          >
            {isRenaming ? (
              <input
                autoFocus
                className="nm-onenote-tab-rename"
                value={renaming.value}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); void commitRename(); }
                  if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                }}
                onClick={e => e.stopPropagation()}
                aria-label="Rename section"
              />
            ) : (
              <>
                <span className="nm-onenote-tab-label">{section.name}</span>
                <span className="nm-onenote-tab-count" aria-label={`${section.pages.length} pages`}>
                  {section.pages.length}
                </span>
              </>
            )}
          </button>
        );
      })}

      {/* Inline draft tab for new section — same pattern as v1.14.12
          inline rename. window.prompt is dead in Obsidian's renderer. */}
      {newSectionDraft !== null && (
        <div className="nm-onenote-tab nm-onenote-tab-draft" role="presentation">
          <input
            autoFocus
            className="nm-onenote-tab-rename"
            value={newSectionDraft}
            placeholder="Section name"
            onChange={e => setNewSectionDraft(e.target.value)}
            onBlur={() => void commitNewSection()}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); void commitNewSection(); }
              if (e.key === "Escape") { e.preventDefault(); cancelNewSection(); }
            }}
            onClick={e => e.stopPropagation()}
            aria-label="New section name"
          />
        </div>
      )}

      <button
        type="button"
        className="nm-onenote-tab-add"
        onClick={openNewSection}
        disabled={newSectionDraft !== null}
        title="Add section"
        aria-label="Add section"
      >
        <span aria-hidden="true">+</span>
      </button>

      {sections.length === 0 && newSectionDraft === null && (
        <span className="nm-onenote-tabs-empty">No sections yet — click + to add one.</span>
      )}
    </div>
  );
}
