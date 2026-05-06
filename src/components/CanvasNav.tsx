import React, { useCallback, useEffect, useMemo, useState } from "react";
import { App, EventRef, Notice, TFile, TFolder } from "obsidian";
import type NoteometryPlugin from "../main";
import { rootDir, createNewPageFile } from "../lib/persistence";
import { buildNav, sectionPathFor, NavSection } from "../lib/canvasNavTree";

interface Props {
  app: App;
  plugin: NoteometryPlugin;
  /** Currently-open file, used to highlight the active section + page
   *  and to default the "+ Add page" target to the active section. */
  file: TFile | null;
}

/** v1.14.9: OneNote-style two-column nav, ON the canvas. Replaces the
 *  scrapped PageHeader band and the out-of-sight Pages sidebar. The
 *  rule from Dan: "I have been bitching about the importance of the
 *  file tree the file tree the file tree, and it was never opened
 *  because its not on the FUCKING canvas." This is the file tree.
 *
 *  Sections column = first-level folders under the Noteometry root
 *  (courses). Pages column = every .nmpage in the selected section
 *  (collapsed across any sub-folders so 16 weeks of pages all show
 *  as one flat list, OneNote-style).
 *
 *  Always visible. Click to load. Right-click for rename/delete with
 *  the v1.14.6 confirm pattern. Add buttons inline at the top of each
 *  column. No drag-reorder yet \u2014 add later if it earns its keep. */
export default function CanvasNav({ app, plugin, file }: Props) {
  const [tick, setTick] = useState(0);
  const [selectedSectionPath, setSelectedSectionPath] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState<{ kind: "section" | "page"; path: string; value: string } | null>(null);

  const root = rootDir(plugin);
  const sections = useMemo<NavSection[]>(() => buildNav(app, root), [app, root, tick]);

  // Rebuild on vault structure changes. Modify (per-stroke autosave)
  // is intentionally NOT included \u2014 it would thrash render every
  // 50ms while drawing. mtime updates aren't shown in the nav anyway.
  useEffect(() => {
    const refs: EventRef[] = [
      app.vault.on("create", () => setTick(n => n + 1)),
      app.vault.on("delete", () => setTick(n => n + 1)),
      app.vault.on("rename", () => setTick(n => n + 1)),
    ];
    return () => { for (const r of refs) app.vault.offref(r); };
  }, [app]);

  // Default the selected section to whichever one contains the
  // currently-open file. If the user explicitly picked a section,
  // respect that and don't yank them around when they switch tabs.
  useEffect(() => {
    if (selectedSectionPath !== null) return;
    const auto = sectionPathFor(file, sections);
    if (auto) setSelectedSectionPath(auto);
    else if (sections[0]) setSelectedSectionPath(sections[0].folderPath);
  }, [file, sections, selectedSectionPath]);

  const activeSection = sections.find(s => s.folderPath === selectedSectionPath) ?? sections[0] ?? null;
  const activePagePath = file?.path ?? null;

  const openFile = useCallback((target: TFile) => {
    void app.workspace.getLeaf(false).openFile(target);
  }, [app]);

  const onAddSection = useCallback(async () => {
    const name = window.prompt("New section name (e.g. ELEN201):");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const path = `${root.replace(/\/+$/, "")}/${trimmed}`;
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing) {
      new Notice(`Section "${trimmed}" already exists.`);
      if (existing instanceof TFolder) setSelectedSectionPath(path);
      return;
    }
    try {
      await app.vault.createFolder(path);
      setSelectedSectionPath(path);
      setTick(n => n + 1);
    } catch (err) {
      new Notice(`Couldn't create section: ${(err as Error).message ?? err}`);
    }
  }, [app, root]);

  const onAddPage = useCallback(async () => {
    const target = activeSection?.folderPath ?? root;
    const created = await createNewPageFile(app, target);
    if (created) {
      setSelectedSectionPath(activeSection?.folderPath ?? null);
      void app.workspace.getLeaf(false).openFile(created);
    }
  }, [app, activeSection, root]);

  const onDeleteSection = useCallback(async (section: NavSection) => {
    if (!confirm(`Delete section "${section.name}" and all ${section.pages.length} page${section.pages.length === 1 ? "" : "s"} inside it? This cannot be undone except via Obsidian's trash.`)) return;
    const folder = app.vault.getAbstractFileByPath(section.folderPath);
    if (folder instanceof TFolder) {
      try {
        await app.vault.trash(folder, true);
        if (selectedSectionPath === section.folderPath) setSelectedSectionPath(null);
        setTick(n => n + 1);
      } catch (err) {
        new Notice(`Couldn't delete section: ${(err as Error).message ?? err}`);
      }
    }
  }, [app, selectedSectionPath]);

  const onDeletePage = useCallback(async (target: TFile) => {
    if (!confirm(`Delete page "${target.basename}"? This cannot be undone except via Obsidian's trash.`)) return;
    try {
      await app.vault.trash(target, true);
      setTick(n => n + 1);
    } catch (err) {
      new Notice(`Couldn't delete page: ${(err as Error).message ?? err}`);
    }
  }, [app]);

  const beginRenameSection = (section: NavSection) =>
    setRenaming({ kind: "section", path: section.folderPath, value: section.name });
  const beginRenamePage = (page: { path: string; label: string }) =>
    setRenaming({ kind: "page", path: page.path, value: page.label });

  const commitRename = useCallback(async () => {
    if (!renaming) return;
    const next = renaming.value.trim();
    setRenaming(null);
    if (!next) return;
    const target = app.vault.getAbstractFileByPath(renaming.path);
    if (!target) return;
    const parent = target.parent?.path ?? "";
    const newPath = renaming.kind === "page"
      ? (parent ? `${parent}/${next}.nmpage` : `${next}.nmpage`)
      : (parent ? `${parent}/${next}` : next);
    if (newPath === renaming.path) return;
    try {
      await app.fileManager.renameFile(target, newPath);
      setTick(n => n + 1);
    } catch (err) {
      new Notice(`Couldn't rename: ${(err as Error).message ?? err}`);
    }
  }, [app, renaming]);

  if (collapsed) {
    return (
      <div className="noteometry-nav noteometry-nav-collapsed">
        <button
          type="button"
          className="noteometry-nav-toggle"
          onClick={() => setCollapsed(false)}
          title="Show file tree"
          aria-label="Show file tree"
        >
          <span aria-hidden="true">{"\u203a"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="noteometry-nav" role="navigation" aria-label="Noteometry pages">
      {/* Sections column */}
      <div className="noteometry-nav-col noteometry-nav-sections">
        <div className="noteometry-nav-col-hdr">
          <button
            type="button"
            className="noteometry-nav-add"
            onClick={onAddSection}
            title="Add section"
          >
            <span aria-hidden="true">+</span> Add section
          </button>
        </div>
        <ul className="noteometry-nav-list">
          {sections.length === 0 && (
            <li className="noteometry-nav-empty">No sections yet. Click + Add section.</li>
          )}
          {sections.map(section => {
            const isActive = section.folderPath === activeSection?.folderPath;
            const isRenaming = renaming?.kind === "section" && renaming.path === section.folderPath;
            return (
              <li key={section.folderPath || "(root)"}>
                <button
                  type="button"
                  className={`noteometry-nav-row noteometry-nav-section${isActive ? " active" : ""}`}
                  onClick={() => setSelectedSectionPath(section.folderPath)}
                  onDoubleClick={() => beginRenameSection(section)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    void onDeleteSection(section);
                  }}
                  title={`Click to open · double-click to rename · right-click to delete — ${section.folderPath}`}
                >
                  <span className="noteometry-nav-glyph" aria-hidden="true">{"\uD83D\uDCC1"}</span>
                  {isRenaming ? (
                    <input
                      autoFocus
                      className="noteometry-nav-rename-input"
                      value={renaming.value}
                      onChange={e => setRenaming({ ...renaming, value: e.target.value })}
                      onBlur={commitRename}
                      onKeyDown={e => {
                        if (e.key === "Enter") { e.preventDefault(); void commitRename(); }
                        if (e.key === "Escape") { e.preventDefault(); setRenaming(null); }
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="noteometry-nav-label">{section.name}</span>
                  )}
                  <span className="noteometry-nav-count">{section.pages.length}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Pages column */}
      <div className="noteometry-nav-col noteometry-nav-pages">
        <div className="noteometry-nav-col-hdr">
          <button
            type="button"
            className="noteometry-nav-add"
            onClick={onAddPage}
            title="Add page"
            disabled={!activeSection && sections.length > 0}
          >
            <span aria-hidden="true">+</span> Add page
          </button>
          <button
            type="button"
            className="noteometry-nav-toggle"
            onClick={() => setCollapsed(true)}
            title="Hide file tree"
            aria-label="Hide file tree"
          >
            <span aria-hidden="true">{"\u2039"}</span>
          </button>
        </div>
        <ul className="noteometry-nav-list">
          {!activeSection && (
            <li className="noteometry-nav-empty">Pick a section on the left.</li>
          )}
          {activeSection && activeSection.pages.length === 0 && (
            <li className="noteometry-nav-empty">No pages in this section. Click + Add page.</li>
          )}
          {activeSection && activeSection.pages.map(page => {
            const isActive = page.path === activePagePath;
            const isRenaming = renaming?.kind === "page" && renaming.path === page.path;
            return (
              <li key={page.path}>
                <button
                  type="button"
                  className={`noteometry-nav-row noteometry-nav-page${isActive ? " active" : ""}`}
                  onClick={() => openFile(page.file)}
                  onDoubleClick={() => beginRenamePage(page)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    void onDeletePage(page.file);
                  }}
                  title={`Click to open · double-click to rename · right-click to delete — ${page.subPath ? `${page.subPath}/` : ""}${page.label}`}
                >
                  {isRenaming ? (
                    <input
                      autoFocus
                      className="noteometry-nav-rename-input"
                      value={renaming.value}
                      onChange={e => setRenaming({ ...renaming, value: e.target.value })}
                      onBlur={commitRename}
                      onKeyDown={e => {
                        if (e.key === "Enter") { e.preventDefault(); void commitRename(); }
                        if (e.key === "Escape") { e.preventDefault(); setRenaming(null); }
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className="noteometry-nav-label">{page.label}</span>
                      {page.subPath && (
                        <span className="noteometry-nav-sub">{page.subPath}</span>
                      )}
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
