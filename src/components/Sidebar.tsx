import React, { useState, useEffect, useCallback, useRef } from "react";
import { App, Notice, TFolder, TFile } from "obsidian";
import {
  IconPlus, IconTrash, IconFolder, IconFile,
  IconChevRight, IconMenu, IconX, IconPen, IconBook, IconCopy,
} from "./Icons";
import ContextMenu from "./ContextMenu";
import type { ContextMenuItem } from "./ContextMenu";
import { useLongPress } from "../hooks/useLongPress";
import type NoteometryPlugin from "../main";
import {
  listSections,
  listPages,
  listWeeks,
  listWeekPages,
  createSection,
  createPage,
  createWeek,
  createWeekPage,
  deletePage,
  deleteSection,
  deleteWeek,
  deleteWeekPage,
} from "../lib/persistence";

/** Small wrapper that applies useLongPress to a div rendered inside a map. */
function LongPressDiv({
  onLongPress,
  children,
  ...rest
}: {
  onLongPress: (pos: { x: number; y: number }) => void;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "onContextMenu">) {
  const handlers = useLongPress(
    useCallback((pos: { x: number; y: number }) => onLongPress(pos), [onLongPress]),
  );
  return (
    <div {...rest} {...handlers}>
      {children}
    </div>
  );
}

interface Props {
  plugin: NoteometryPlugin;
  currentSection: string;
  currentPage: string;
  onSelect: (section: string, page: string) => void;
  app?: App;
}

/** 3-level sidebar: Notebook > Week > Page
 *
 * The `section` prop passed to onSelect encodes the full path:
 *   - For 3-level pages: "Notebook/Week"
 *   - For 2-level compat (old pages at Section/Page.md): "Section"
 *
 * This way NoteometryApp doesn't need any changes to its page-loading logic. */
export default function Sidebar({ plugin, currentSection, currentPage, onSelect, app }: Props) {
  const [notebooks, setNotebooks] = useState<string[]>([]);
  const [weeksMap, setWeeksMap] = useState<Record<string, string[]>>({});
  const [pagesMap, setPagesMap] = useState<Record<string, string[]>>({});
  // Top-level pages in a notebook (2-level compat)
  const [topPagesMap, setTopPagesMap] = useState<Record<string, string[]>>({});
  const [expandedNotebook, setExpandedNotebook] = useState("");
  const [expandedWeek, setExpandedWeek] = useState("");
  const [open, setOpen] = useState(() => window.innerWidth >= 768);
  const [addingNotebook, setAddingNotebook] = useState(false);
  const [addingCourse, setAddingCourse] = useState(false);
  const [addingWeek, setAddingWeek] = useState("");
  const [addingPage, setAddingPage] = useState("");
  const [renamingItem, setRenamingItem] = useState<{ type: "notebook" | "week" | "page"; notebook: string; week?: string; name: string } | null>(null);
  const [newName, setNewName] = useState("");
  const submitting = useRef(false);
  const [sidebarCtxMenu, setSidebarCtxMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  // Parse current section to get notebook/week
  const currentNotebook = currentSection.includes("/") ? currentSection.split("/")[0]! : currentSection;
  const currentWeek = currentSection.includes("/") ? currentSection.split("/").slice(1).join("/") : "";

  const refreshNotebooks = useCallback(async () => {
    const s = await listSections(plugin);
    setNotebooks(s);
  }, [plugin]);

  useEffect(() => { refreshNotebooks(); }, [refreshNotebooks]);

  // Load weeks + top-level pages when notebook expands
  useEffect(() => {
    if (!expandedNotebook) return;
    (async () => {
      const wks = await listWeeks(plugin, expandedNotebook);
      setWeeksMap((prev) => ({ ...prev, [expandedNotebook]: wks }));
      // Also load top-level pages for backwards compatibility
      const tp = await listPages(plugin, expandedNotebook);
      setTopPagesMap((prev) => ({ ...prev, [expandedNotebook]: tp }));
    })();
  }, [plugin, expandedNotebook]);

  // Load pages when a week expands
  useEffect(() => {
    if (!expandedNotebook || !expandedWeek) return;
    const key = `${expandedNotebook}/${expandedWeek}`;
    (async () => {
      const p = await listWeekPages(plugin, expandedNotebook, expandedWeek);
      setPagesMap((prev) => ({ ...prev, [key]: p }));
    })();
  }, [plugin, expandedNotebook, expandedWeek]);

  // Auto-expand to match current selection
  useEffect(() => {
    if (currentNotebook) setExpandedNotebook(currentNotebook);
    if (currentWeek) setExpandedWeek(currentWeek);
  }, [currentNotebook, currentWeek]);

  /* ── Add notebook ── */
  const handleAddNotebook = async () => {
    if (submitting.current) return;
    const name = newName.trim();
    if (!name) return;
    submitting.current = true;
    try {
      await createSection(plugin, name);
      setNewName("");
      setAddingNotebook(false);
      await refreshNotebooks();
      // Create a default page at notebook level
      await createPage(plugin, name, "Page 1");
      setExpandedNotebook(name);
      const tp = await listPages(plugin, name);
      setTopPagesMap((prev) => ({ ...prev, [name]: tp }));
      onSelect(name, "Page 1");
    } finally { submitting.current = false; }
  };

  /* ── Add course (notebook + 16 week sub-folders with Notes.md) ── */
  const handleAddCourse = async () => {
    if (submitting.current) return;
    const name = newName.trim();
    if (!name) return;
    submitting.current = true;
    try {
      await createSection(plugin, name);
      for (let i = 1; i <= 16; i++) {
        await createWeek(plugin, name, `Week ${i}`);
        await createWeekPage(plugin, name, `Week ${i}`, "Notes");
      }
      setNewName("");
      setAddingCourse(false);
      await refreshNotebooks();
      setExpandedNotebook(name);
      setExpandedWeek("Week 1");
      const wks = await listWeeks(plugin, name);
      setWeeksMap((prev) => ({ ...prev, [name]: wks }));
      const p = await listWeekPages(plugin, name, "Week 1");
      setPagesMap((prev) => ({ ...prev, [`${name}/Week 1`]: p }));
      onSelect(`${name}/Week 1`, "Notes");
    } finally { submitting.current = false; }
  };

  /* ── Add week ── */
  const handleAddWeek = async (notebook: string) => {
    if (submitting.current) return;
    const name = newName.trim();
    if (!name) return;
    submitting.current = true;
    try {
      await createWeek(plugin, notebook, name);
      setNewName("");
      setAddingWeek("");
      const wks = await listWeeks(plugin, notebook);
      setWeeksMap((prev) => ({ ...prev, [notebook]: wks }));
      setExpandedWeek(name);
    } finally { submitting.current = false; }
  };

  /* ── Add page (into a week) ── */
  const handleAddPage = async (notebook: string, week: string) => {
    if (submitting.current) return;
    const name = newName.trim();
    if (!name) return;
    submitting.current = true;
    try {
      await createWeekPage(plugin, notebook, week, name);
      setNewName("");
      setAddingPage("");
      const key = `${notebook}/${week}`;
      const p = await listWeekPages(plugin, notebook, week);
      setPagesMap((prev) => ({ ...prev, [key]: p }));
      onSelect(key, name);
    } finally { submitting.current = false; }
  };

  /* ── Add page at notebook level (2-level compat) ── */
  const handleAddTopPage = async (notebook: string) => {
    if (submitting.current) return;
    const name = newName.trim();
    if (!name) return;
    submitting.current = true;
    try {
      await createPage(plugin, notebook, name);
      setNewName("");
      setAddingPage("");
      const tp = await listPages(plugin, notebook);
      setTopPagesMap((prev) => ({ ...prev, [notebook]: tp }));
      onSelect(notebook, name);
    } finally { submitting.current = false; }
  };

  /* ── Rename ── */
  const handleRename = async () => {
    if (submitting.current || !renamingItem) return;
    const name = newName.trim();
    if (!name || name === renamingItem.name) { setRenamingItem(null); return; }
    submitting.current = true;
    try {
      const adapter = plugin.app.vault.adapter;
      const root = plugin.settings.vaultFolder || "Noteometry";
      if (renamingItem.type === "notebook") {
        const oldPath = `${root}/${renamingItem.name}`;
        const newPath = `${root}/${name}`;
        if (await adapter.exists(oldPath)) {
          // Recursively copy everything
          if (!(await adapter.exists(newPath))) await adapter.mkdir(newPath);
          const listing = await adapter.list(oldPath);
          // Copy sub-folders (weeks)
          for (const folder of listing.folders) {
            const folderName = folder.split("/").pop() ?? "";
            if (!folderName) continue;
            const destFolder = `${newPath}/${folderName}`;
            if (!(await adapter.exists(destFolder))) await adapter.mkdir(destFolder);
            const subListing = await adapter.list(folder);
            for (const f of subListing.files) {
              const fname = f.split("/").pop() ?? "";
              const data = await adapter.read(f);
              await adapter.write(`${destFolder}/${fname}`, data);
              await adapter.remove(f);
            }
            try { await adapter.rmdir(folder, false); } catch { /* ignore */ }
          }
          // Copy top-level files
          for (const f of listing.files) {
            const fname = f.split("/").pop() ?? "";
            const data = await adapter.read(f);
            await adapter.write(`${newPath}/${fname}`, data);
            await adapter.remove(f);
          }
          try { await adapter.rmdir(oldPath, false); } catch { /* ignore */ }
        }
        await refreshNotebooks();
        if (currentNotebook === renamingItem.name) {
          onSelect(currentWeek ? `${name}/${currentWeek}` : name, currentPage);
        }
      } else if (renamingItem.type === "week" && renamingItem.week) {
        const notebook = renamingItem.notebook;
        const oldPath = `${root}/${notebook}/${renamingItem.name}`;
        const newPath = `${root}/${notebook}/${name}`;
        if (await adapter.exists(oldPath)) {
          if (!(await adapter.exists(newPath))) await adapter.mkdir(newPath);
          const listing = await adapter.list(oldPath);
          for (const f of listing.files) {
            const fname = f.split("/").pop() ?? "";
            const data = await adapter.read(f);
            await adapter.write(`${newPath}/${fname}`, data);
            await adapter.remove(f);
          }
          try { await adapter.rmdir(oldPath, false); } catch { /* ignore */ }
        }
        const wks = await listWeeks(plugin, notebook);
        setWeeksMap((prev) => ({ ...prev, [notebook]: wks }));
        if (currentWeek === renamingItem.name && currentNotebook === notebook) {
          onSelect(`${notebook}/${name}`, currentPage);
        }
      } else if (renamingItem.type === "page") {
        const notebook = renamingItem.notebook;
        const week = renamingItem.week;
        if (week) {
          const oldPath = `${root}/${notebook}/${week}/${renamingItem.name}.md`;
          const newPath = `${root}/${notebook}/${week}/${name}.md`;
          if (await adapter.exists(oldPath)) {
            const data = await adapter.read(oldPath);
            await adapter.write(newPath, data);
            await adapter.remove(oldPath);
          }
          const key = `${notebook}/${week}`;
          const p = await listWeekPages(plugin, notebook, week);
          setPagesMap((prev) => ({ ...prev, [key]: p }));
          if (currentPage === renamingItem.name) onSelect(key, name);
        } else {
          const oldPath = `${root}/${notebook}/${renamingItem.name}.md`;
          const newPath = `${root}/${notebook}/${name}.md`;
          if (await adapter.exists(oldPath)) {
            const data = await adapter.read(oldPath);
            await adapter.write(newPath, data);
            await adapter.remove(oldPath);
          }
          const tp = await listPages(plugin, notebook);
          setTopPagesMap((prev) => ({ ...prev, [notebook]: tp }));
          if (currentPage === renamingItem.name) onSelect(notebook, name);
        }
      }
    } finally {
      submitting.current = false;
      setRenamingItem(null);
      setNewName("");
    }
  };

  const handleDeleteNotebook = async (name: string) => {
    if (!confirm(`Delete "${name}" and all its weeks/pages?`)) return;
    try {
      await deleteSection(plugin, name);
      new Notice(`Deleted notebook "${name}"`, 3000);
      await refreshNotebooks();
      if (expandedNotebook === name) { setExpandedNotebook(""); setExpandedWeek(""); }
      if (currentNotebook === name) onSelect("", "");
    } catch (err) {
      console.error("[Noteometry] deleteNotebook failed:", err);
      new Notice(`Failed to delete notebook "${name}"`, 8000);
    }
  };

  const handleDeleteWeek = async (notebook: string, week: string) => {
    if (!confirm(`Delete "${week}" and all its pages?`)) return;
    try {
      await deleteWeek(plugin, notebook, week);
      new Notice(`Deleted week "${week}"`, 3000);
      const wks = await listWeeks(plugin, notebook);
      setWeeksMap((prev) => ({ ...prev, [notebook]: wks }));
      if (expandedWeek === week) setExpandedWeek("");
      if (currentWeek === week && currentNotebook === notebook) onSelect(notebook, "");
    } catch (err) {
      console.error("[Noteometry] deleteWeek failed:", err);
      new Notice(`Failed to delete week "${week}"`, 8000);
    }
  };

  const handleDeletePage = async (notebook: string, week: string | undefined, page: string) => {
    if (!confirm(`Delete "${page}"?`)) return;
    try {
      if (week) {
        await deleteWeekPage(plugin, notebook, week, page);
        new Notice(`Deleted page "${page}"`, 3000);
        const key = `${notebook}/${week}`;
        const updated = await listWeekPages(plugin, notebook, week);
        setPagesMap((prev) => ({ ...prev, [key]: updated }));
        if (currentPage === page) onSelect(key, updated[0] ?? "");
      } else {
        await deletePage(plugin, notebook, page);
        new Notice(`Deleted page "${page}"`, 3000);
        const updated = await listPages(plugin, notebook);
        setTopPagesMap((prev) => ({ ...prev, [notebook]: updated }));
        if (currentPage === page) onSelect(notebook, updated[0] ?? "");
      }
    } catch (err) {
      console.error("[Noteometry] deletePage failed:", err);
      new Notice(`Failed to delete page "${page}"`, 8000);
    }
  };

  /* ── Duplicate notebook as template ── */
  const handleDuplicateAsTemplate = async (notebookName: string) => {
    try {
      const adapter = plugin.app.vault.adapter;
      const root = plugin.settings.vaultFolder || "Noteometry";
      const sourcePath = `${root}/${notebookName}`;

      let copyName = `${notebookName} (Copy)`;
      let counter = 2;
      while (await adapter.exists(`${root}/${copyName}`)) {
        copyName = `${notebookName} (Copy ${counter})`;
        counter++;
      }

      await adapter.mkdir(`${root}/${copyName}`);

      const duplicateDir = async (srcDir: string, destDir: string) => {
        const listing = await adapter.list(srcDir);
        for (const folder of listing.folders) {
          const folderName = folder.split("/").pop() ?? "";
          if (!folderName || folderName === "attachments") continue;
          const newSubDir = `${destDir}/${folderName}`;
          await adapter.mkdir(newSubDir);
          await duplicateDir(folder, newSubDir);
        }
        for (const file of listing.files) {
          const fileName = file.split("/").pop() ?? "";
          if (!fileName) continue;
          const destFile = `${destDir}/${fileName}`;
          if (fileName.endsWith(".canvas")) {
            await adapter.write(destFile, '{"nodes":[],"edges":[]}');
          } else if (fileName.endsWith(".md")) {
            await adapter.write(destFile, "");
          }
        }
      };

      await duplicateDir(sourcePath, `${root}/${copyName}`);

      new Notice(`Template created: ${copyName}`);
      await refreshNotebooks();
      setExpandedNotebook(copyName);
    } catch (err) {
      console.error("[Noteometry] Duplicate as template failed:", err);
      new Notice("Failed to duplicate as template", 8000);
    }
  };

  /* ── Long-press context menus ── */
  const openNotebookCtxMenu = useCallback((notebook: string, x: number, y: number) => {
    const items: ContextMenuItem[] = [
      { label: "Rename", onClick: () => { startRename("notebook", notebook, undefined, notebook); setSidebarCtxMenu(null); } },
      { label: "Add Week", onClick: () => { setAddingWeek(notebook); setNewName(""); setSidebarCtxMenu(null); } },
      { label: "Duplicate as Template", onClick: () => { handleDuplicateAsTemplate(notebook); setSidebarCtxMenu(null); } },
      { label: "", separator: true },
      { label: "Delete", danger: true, onClick: () => { handleDeleteNotebook(notebook); setSidebarCtxMenu(null); } },
    ];
    setSidebarCtxMenu({ x, y, items });
  }, [handleDuplicateAsTemplate, handleDeleteNotebook]);

  const openWeekCtxMenu = useCallback((notebook: string, week: string, x: number, y: number) => {
    const items: ContextMenuItem[] = [
      { label: "Rename", onClick: () => { startRename("week", notebook, week, week); setSidebarCtxMenu(null); } },
      { label: "Add Page", onClick: () => { setAddingPage(`${notebook}/${week}`); setNewName(""); setSidebarCtxMenu(null); } },
      { label: "", separator: true },
      { label: "Delete", danger: true, onClick: () => { handleDeleteWeek(notebook, week); setSidebarCtxMenu(null); } },
    ];
    setSidebarCtxMenu({ x, y, items });
  }, [handleDeleteWeek]);

  const openPageCtxMenu = useCallback((notebook: string, week: string | undefined, page: string, x: number, y: number) => {
    const items: ContextMenuItem[] = [
      { label: "Rename", onClick: () => { startRename("page", notebook, week, page); setSidebarCtxMenu(null); } },
      { label: "", separator: true },
      { label: "Delete", danger: true, onClick: () => { handleDeletePage(notebook, week, page); setSidebarCtxMenu(null); } },
    ];
    setSidebarCtxMenu({ x, y, items });
  }, [handleDeletePage]);

  const selectPage = (section: string, page: string) => {
    onSelect(section, page);
    if (window.innerWidth < 768) setOpen(false);
  };

  /* ── Inline input (for add and rename) ── */
  const inlineInput = (onSubmit: () => void) => (
    <div className="noteometry-sidebar-add-row">
      <input
        className="noteometry-sidebar-input"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onSubmit(); }
          if (e.key === "Escape") { setAddingPage(""); setAddingWeek(""); setAddingNotebook(false); setAddingCourse(false); setRenamingItem(null); setNewName(""); }
        }}
        autoFocus
        placeholder="Name..."
        inputMode="text"
        enterKeyHint="done"
      />
      <button className="noteometry-sidebar-input-ok" onPointerUp={onSubmit}>OK</button>
    </div>
  );

  const startRename = (type: "notebook" | "week" | "page", notebook: string, week: string | undefined, name: string) => {
    setRenamingItem({ type, notebook, week, name });
    setNewName(name);
    setAddingNotebook(false);
    setAddingPage("");
    setAddingWeek("");
  };

  /* ── Toggle button ── */
  const toggleBtn = (
    <button
      className="noteometry-sidebar-toggle"
      onClick={() => setOpen(!open)}
      title={open ? "Close" : "Pages"}
    >
      {open ? <IconX /> : <IconMenu />}
    </button>
  );

  if (!open) {
    return (
      <div className="noteometry-sidebar noteometry-sidebar-closed">
        {toggleBtn}
      </div>
    );
  }

  const weeks = expandedNotebook ? (weeksMap[expandedNotebook] ?? []) : [];
  const topPages = expandedNotebook ? (topPagesMap[expandedNotebook] ?? []) : [];

  return (
    <>
      <div className="noteometry-sidebar-backdrop" onClick={() => setOpen(false)} />
      <div className="noteometry-sidebar noteometry-sidebar-open">
        <div className="nm-sidebar-col">
          <div className="noteometry-sidebar-hdr">
            {toggleBtn}
            <span className="noteometry-sidebar-title">Notebooks</span>
          </div>

          {/* New Course button */}
          {addingCourse
            ? inlineInput(handleAddCourse)
            : (
              <button
                className="noteometry-sidebar-add noteometry-sidebar-add-course"
                onClick={() => { setAddingCourse(true); setAddingNotebook(false); setAddingPage(""); setAddingWeek(""); setRenamingItem(null); setNewName("APUS"); }}
              >
                <IconBook /> New Course
              </button>
            )}

          <div className="noteometry-sidebar-list" style={{ overflow: "auto", flex: 1 }}>
            {notebooks.map((nb) => {
              const isRenamingNb = renamingItem?.type === "notebook" && renamingItem.name === nb;
              const isExpanded = nb === expandedNotebook;
              const nbWeeks = weeksMap[nb] ?? [];
              const nbTopPages = topPagesMap[nb] ?? [];

              return (
                <div key={nb} className="noteometry-sidebar-section">
                  {isRenamingNb ? inlineInput(handleRename) : (
                    <LongPressDiv
                      className={`noteometry-sidebar-item noteometry-sidebar-section-item ${isExpanded ? "active" : ""}`}
                      style={{ fontWeight: 700, minHeight: 28 }}
                      onClick={() => setExpandedNotebook(isExpanded ? "" : nb)}
                      onLongPress={(pos) => openNotebookCtxMenu(nb, pos.x, pos.y)}
                    >
                      <span style={{ fontSize: 12, marginRight: 4, transition: "transform 0.15s", display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>&#9654;</span>
                      <span style={{ marginRight: 4 }}>&#128193;</span>
                      <span className="noteometry-sidebar-item-name">{nb}</span>
                    </LongPressDiv>
                  )}

                  {/* Expanded notebook content */}
                  {isExpanded && (
                    <div style={{ paddingLeft: 12 }}>
                      {/* Weeks */}
                      {nbWeeks.map((wk) => {
                        const isRenamingWeek = renamingItem?.type === "week" && renamingItem.notebook === nb && renamingItem.name === wk;
                        const isWeekExpanded = expandedWeek === wk;
                        const weekKey = `${nb}/${wk}`;
                        const weekPages = pagesMap[weekKey] ?? [];

                        return (
                          <div key={wk}>
                            {isRenamingWeek ? inlineInput(handleRename) : (
                              <LongPressDiv
                                className={`noteometry-sidebar-item ${isWeekExpanded ? "active" : ""}`}
                                style={{ minHeight: 26 }}
                                onClick={() => {
                                  setExpandedWeek(isWeekExpanded ? "" : wk);
                                }}
                                onLongPress={(pos) => openWeekCtxMenu(nb, wk, pos.x, pos.y)}
                              >
                                <span style={{ fontSize: 10, marginRight: 4, transition: "transform 0.15s", display: "inline-block", transform: isWeekExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>&#9654;</span>
                                <span style={{ marginRight: 4 }}>&#128193;</span>
                                <span className="noteometry-sidebar-item-name">{wk}</span>
                              </LongPressDiv>
                            )}

                            {/* Pages inside the week */}
                            {isWeekExpanded && (
                              <div style={{ paddingLeft: 12 }}>
                                {weekPages.map((pg) => {
                                  const isRenamingPage = renamingItem?.type === "page" && renamingItem.notebook === nb && renamingItem.week === wk && renamingItem.name === pg;
                                  const isActive = currentSection === weekKey && pg === currentPage;
                                  return isRenamingPage ? (
                                    <div key={pg}>{inlineInput(handleRename)}</div>
                                  ) : (
                                    <LongPressDiv
                                      key={pg}
                                      className={`noteometry-sidebar-item noteometry-sidebar-page-item ${isActive ? "active" : ""}`}
                                      style={{ minHeight: 24 }}
                                      onClick={() => selectPage(weekKey, pg)}
                                      onLongPress={(pos) => openPageCtxMenu(nb, wk, pg, pos.x, pos.y)}
                                    >
                                      <span style={{ marginRight: 4 }}>&#128196;</span>
                                      <span className="noteometry-sidebar-item-name">{pg}</span>
                                    </LongPressDiv>
                                  );
                                })}
                                {addingPage === weekKey
                                  ? inlineInput(() => handleAddPage(nb, wk))
                                  : (
                                    <button
                                      className="noteometry-sidebar-add noteometry-sidebar-add-page"
                                      onClick={() => { setAddingPage(weekKey); setAddingNotebook(false); setAddingWeek(""); setRenamingItem(null); setNewName(""); }}
                                    >
                                      <IconPlus /> New page
                                    </button>
                                  )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Top-level pages (2-level compat) */}
                      {nbTopPages.map((pg) => {
                        const isRenamingPage = renamingItem?.type === "page" && renamingItem.notebook === nb && !renamingItem.week && renamingItem.name === pg;
                        const isActive = currentSection === nb && pg === currentPage;
                        return isRenamingPage ? (
                          <div key={pg}>{inlineInput(handleRename)}</div>
                        ) : (
                          <LongPressDiv
                            key={pg}
                            className={`noteometry-sidebar-item noteometry-sidebar-page-item ${isActive ? "active" : ""}`}
                            style={{ minHeight: 24 }}
                            onClick={() => selectPage(nb, pg)}
                            onLongPress={(pos) => openPageCtxMenu(nb, undefined, pg, pos.x, pos.y)}
                          >
                            <span style={{ marginRight: 4 }}>&#128196;</span>
                            <span className="noteometry-sidebar-item-name">{pg}</span>
                          </LongPressDiv>
                        );
                      })}

                      {/* Add Week button */}
                      {addingWeek === nb
                        ? inlineInput(() => handleAddWeek(nb))
                        : (
                          <button
                            className="noteometry-sidebar-add"
                            style={{ fontSize: 12 }}
                            onClick={() => { setAddingWeek(nb); setAddingNotebook(false); setAddingPage(""); setRenamingItem(null); setNewName(""); }}
                          >
                            <IconPlus /> New week
                          </button>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {addingNotebook
            ? inlineInput(handleAddNotebook)
            : (
              <button
                className="noteometry-sidebar-add"
                onClick={() => { setAddingNotebook(true); setAddingCourse(false); setAddingPage(""); setAddingWeek(""); setRenamingItem(null); setNewName(""); }}
              >
                <IconPlus /> New notebook
              </button>
            )}
        </div>
      </div>
      {sidebarCtxMenu && (
        <ContextMenu
          x={sidebarCtxMenu.x}
          y={sidebarCtxMenu.y}
          items={sidebarCtxMenu.items}
          onClose={() => setSidebarCtxMenu(null)}
        />
      )}
    </>
  );
}
