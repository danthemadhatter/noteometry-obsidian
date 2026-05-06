import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App, EventRef, Notice, TFile, TFolder } from "obsidian";
import type NoteometryPlugin from "../main";
import { rootDir, createNewPageFile } from "../lib/persistence";
import { buildNav, sectionPathFor, NavSection, NavPage } from "../lib/canvasNavTree";

interface Props {
  app: App;
  plugin: NoteometryPlugin;
  /** Currently-open file, used to highlight the active section + page
   *  and to default the "+ Add page" target to the active section. */
  file: TFile | null;
}

/** v1.14.9: OneNote-style two-column nav, ON the canvas.
 *  v1.14.10: a11y + intuitiveness pass per Dan's feedback
 *    ("not intuitive. It's very unclear- even more from an accessibility
 *    standpoint"). Changes:
 *      - the synthetic "(root)" bucket now reads with the real folder
 *        name (e.g. "Noteometry") and a notebook glyph so it looks
 *        like a place, not jargon.
 *      - full keyboard nav: Arrow keys move focus+selection inside a
 *        column, Enter opens (pages) / switches (sections), F2 renames,
 *        Delete triggers the v1.14.6 confirm, Tab moves between columns.
 *      - role=listbox / role=option + aria-selected + aria-activedescendant
 *        so screen readers announce selection correctly.
 *      - higher-contrast active row: filled accent background, not the
 *        near-invisible 3px left border we had in v1.14.9.
 *      - root-bucket rename/delete guarded (used to trash the whole
 *        Noteometry folder). */
export default function CanvasNav({ app, plugin, file }: Props) {
  const [tick, setTick] = useState(0);
  const [selectedSectionPath, setSelectedSectionPath] = useState<string | null>(null);
  const [focusedPagePath, setFocusedPagePath] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState<{ kind: "section" | "page"; path: string; value: string } | null>(null);

  const sectionsListRef = useRef<HTMLUListElement | null>(null);
  const pagesListRef = useRef<HTMLUListElement | null>(null);

  const root = rootDir(plugin);
  const sections = useMemo<NavSection[]>(() => buildNav(app, root), [app, root, tick]);

  // Rebuild on vault structure changes. Modify (per-stroke autosave)
  // is intentionally NOT included — it would thrash render every
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
    // v1.14.10: guard the synthetic root bucket. Deleting it would
    // trash the entire Noteometry root folder along with every
    // section inside it — never what the user wants.
    if (section.isRootBucket) {
      new Notice("Can't delete the root bucket — it's your Noteometry folder. Delete individual pages instead.");
      return;
    }
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

  const beginRenameSection = (section: NavSection) => {
    if (section.isRootBucket) {
      new Notice("Can't rename the root bucket from here — it reflects your Noteometry folder. Change it in Settings → Vault folder.");
      return;
    }
    setRenaming({ kind: "section", path: section.folderPath, value: section.name });
  };
  const beginRenamePage = (page: NavPage) =>
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

  // v1.14.10: keyboard nav for the sections column.
  const onSectionsKeyDown = useCallback((e: React.KeyboardEvent<HTMLUListElement>) => {
    if (renaming) return;
    const idx = sections.findIndex(s => s.folderPath === activeSection?.folderPath);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = sections[Math.min(sections.length - 1, idx + 1)];
      if (next) setSelectedSectionPath(next.folderPath);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = sections[Math.max(0, idx - 1)];
      if (prev) setSelectedSectionPath(prev.folderPath);
    } else if (e.key === "ArrowRight" || e.key === "Tab") {
      if (e.key === "Tab" && e.shiftKey) return;
      e.preventDefault();
      // Focus the pages column so the user can arrow down into pages.
      const first = pagesListRef.current?.querySelector<HTMLElement>('[role="option"]');
      first?.focus();
    } else if (e.key === "F2" && activeSection) {
      e.preventDefault();
      beginRenameSection(activeSection);
    } else if ((e.key === "Delete" || e.key === "Backspace") && activeSection) {
      e.preventDefault();
      void onDeleteSection(activeSection);
    }
  }, [sections, activeSection, renaming, onDeleteSection]);

  // v1.14.10: keyboard nav for the pages column.
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
        const el = pagesListRef.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
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
    } else if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      const section = sectionsListRef.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')
        ?? sectionsListRef.current?.querySelector<HTMLElement>('[role="option"]');
      section?.focus();
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
      if (page) void onDeletePage(page.file);
    }
  }, [activeSection, activePagePath, focusedPagePath, renaming, openFile, onDeletePage]);

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
            aria-label="Add section"
          >
            <span aria-hidden="true">+</span> Add section
          </button>
        </div>
        <ul
          ref={sectionsListRef}
          className="noteometry-nav-list"
          role="listbox"
          aria-label="Sections"
          aria-activedescendant={activeSection ? `nm-section-${activeSection.folderPath || "root"}` : undefined}
          onKeyDown={onSectionsKeyDown}
        >
          {sections.length === 0 && (
            <li className="noteometry-nav-empty">No sections yet.</li>
          )}
          {sections.map(section => {
            const isActive = section.folderPath === activeSection?.folderPath;
            const isRenaming = renaming?.kind === "section" && renaming.path === section.folderPath;
            const glyph = section.isRootBucket ? "\uD83D\uDCD2" : "\uD83D\uDCC1";
            return (
              <li key={section.folderPath || "root"}>
                <button
                  type="button"
                  id={`nm-section-${section.folderPath || "root"}`}
                  role="option"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  className={`noteometry-nav-row noteometry-nav-section${isActive ? " active" : ""}${section.isRootBucket ? " is-root-bucket" : ""}`}
                  onClick={() => setSelectedSectionPath(section.folderPath)}
                  onDoubleClick={() => beginRenameSection(section)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    void onDeleteSection(section);
                  }}
                  title={`Click to open · double-click to rename · right-click to delete — ${section.folderPath || root}`}
                >
                  <span className="noteometry-nav-glyph" aria-hidden="true">{glyph}</span>
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
                      aria-label="Rename section"
                    />
                  ) : (
                    <span className="noteometry-nav-label">{section.name}</span>
                  )}
                  <span className="noteometry-nav-count" aria-label={`${section.pages.length} pages`}>
                    {section.pages.length}
                  </span>
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
            aria-label="Add page"
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
        <ul
          ref={pagesListRef}
          className="noteometry-nav-list"
          role="listbox"
          aria-label="Pages"
          aria-activedescendant={focusedPagePath ? `nm-page-${focusedPagePath}` : (activePagePath ? `nm-page-${activePagePath}` : undefined)}
          onKeyDown={onPagesKeyDown}
        >
          {!activeSection && (
            <li className="noteometry-nav-empty">Pick a section on the left.</li>
          )}
          {activeSection && activeSection.pages.length === 0 && (
            <li className="noteometry-nav-empty">No pages yet.</li>
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
                  className={`noteometry-nav-row noteometry-nav-page${isActive ? " active" : ""}`}
                  onClick={() => { setFocusedPagePath(page.path); openFile(page.file); }}
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
                      aria-label="Rename page"
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
