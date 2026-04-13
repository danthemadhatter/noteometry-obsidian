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
  createSection,
  createPage,
  deletePage,
  deleteSection,
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

export default function Sidebar({ plugin, currentSection, currentPage, onSelect, app }: Props) {
  const [sections, setSections] = useState<string[]>([]);
  const [pagesMap, setPagesMap] = useState<Record<string, string[]>>({});
  const [expandedSection, setExpandedSection] = useState(currentSection);
  const [open, setOpen] = useState(() => window.innerWidth >= 768);
  const [addingSection, setAddingSection] = useState(false);
  const [addingCourse, setAddingCourse] = useState(false);
  const [addingPage, setAddingPage] = useState("");
  const [renamingItem, setRenamingItem] = useState<{ type: "section" | "page"; section: string; name: string } | null>(null);
  const [newName, setNewName] = useState("");
  const submitting = useRef(false);
  const [sidebarCtxMenu, setSidebarCtxMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  const refreshSections = useCallback(async () => {
    const s = await listSections(plugin);
    setSections(s);
  }, [plugin]);

  useEffect(() => { refreshSections(); }, [refreshSections]);

  // Load pages for expanded section
  useEffect(() => {
    if (!expandedSection) return;
    (async () => {
      const p = await listPages(plugin, expandedSection);
      setPagesMap((prev) => ({ ...prev, [expandedSection]: p }));
    })();
  }, [plugin, expandedSection]);

  useEffect(() => {
    if (currentSection) setExpandedSection(currentSection);
  }, [currentSection]);

  /* ── Add section ── */
  const handleAddSection = async () => {
    if (submitting.current) return;
    const name = newName.trim();
    if (!name) return;
    submitting.current = true;
    try {
      await createSection(plugin, name);
      setNewName("");
      setAddingSection(false);
      await refreshSections();
      await createPage(plugin, name, "Page 1");
      setExpandedSection(name);
      const p = await listPages(plugin, name);
      setPagesMap((prev) => ({ ...prev, [name]: p }));
      onSelect(name, "Page 1");
    } finally { submitting.current = false; }
  };

  /* ── Add course (section + 16 week pages) ── */
  const handleAddCourse = async () => {
    if (submitting.current) return;
    const name = newName.trim();
    if (!name) return;
    submitting.current = true;
    try {
      await createSection(plugin, name);
      for (let i = 1; i <= 16; i++) {
        await createPage(plugin, name, `Week ${i}`);
      }
      setNewName("");
      setAddingSection(false);
      await refreshSections();
      setExpandedSection(name);
      const p = await listPages(plugin, name);
      setPagesMap((prev) => ({ ...prev, [name]: p }));
      onSelect(name, "Week 1");
    } finally { submitting.current = false; }
  };

  /* ── Add page ── */
  const handleAddPage = async (section: string) => {
    if (submitting.current) return;
    const name = newName.trim();
    if (!name) return;
    submitting.current = true;
    try {
      await createPage(plugin, section, name);
      setNewName("");
      setAddingPage("");
      const p = await listPages(plugin, section);
      setPagesMap((prev) => ({ ...prev, [section]: p }));
      onSelect(section, name);
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
      if (renamingItem.type === "section") {
        const oldPath = `${root}/${renamingItem.name}`;
        const newPath = `${root}/${name}`;
        if (await adapter.exists(oldPath)) {
          if (!(await adapter.exists(newPath))) await adapter.mkdir(newPath);
          const pages = await listPages(plugin, renamingItem.name);
          for (const p of pages) {
            const data = await adapter.read(`${oldPath}/${p}.md`);
            await adapter.write(`${newPath}/${p}.md`, data);
            await adapter.remove(`${oldPath}/${p}.md`);
          }
          await adapter.rmdir(oldPath, false);
        }
        await refreshSections();
        if (currentSection === renamingItem.name) onSelect(name, currentPage);
      } else {
        const sec = renamingItem.section;
        const oldPath = `${root}/${sec}/${renamingItem.name}.md`;
        const newPath = `${root}/${sec}/${name}.md`;
        if (await adapter.exists(oldPath)) {
          const data = await adapter.read(oldPath);
          await adapter.write(newPath, data);
          await adapter.remove(oldPath);
        }
        const p = await listPages(plugin, sec);
        setPagesMap((prev) => ({ ...prev, [sec]: p }));
        if (currentPage === renamingItem.name) onSelect(sec, name);
      }
    } finally {
      submitting.current = false;
      setRenamingItem(null);
      setNewName("");
    }
  };

  const handleDeleteSection = async (name: string) => {
    if (!confirm(`Delete "${name}" and all its pages?`)) return;
    try {
      await deleteSection(plugin, name);
      new Notice(`Deleted section "${name}"`, 3000);
      await refreshSections();
      if (expandedSection === name) setExpandedSection("");
      if (currentSection === name) onSelect("", "");
    } catch (err) {
      console.error("[Noteometry] deleteSection failed:", err);
      new Notice(`Failed to delete section "${name}"`, 8000);
    }
  };

  const handleDeletePage = async (section: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await deletePage(plugin, section, name);
      new Notice(`Deleted page "${name}"`, 3000);
      const updated = await listPages(plugin, section);
      setPagesMap((prev) => ({ ...prev, [section]: updated }));
      if (currentPage === name) onSelect(section, updated[0] ?? "");
    } catch (err) {
      console.error("[Noteometry] deletePage failed:", err);
      new Notice(`Failed to delete page "${name}"`, 8000);
    }
  };

  /* ── Duplicate section as template ── */
  const handleDuplicateAsTemplate = async (sectionName: string) => {
    try {
      const adapter = plugin.app.vault.adapter;
      const root = plugin.settings.vaultFolder || "Noteometry";
      const sourcePath = `${root}/${sectionName}`;

      let copyName = `${sectionName} (Copy)`;
      let counter = 2;
      while (await adapter.exists(`${root}/${copyName}`)) {
        copyName = `${sectionName} (Copy ${counter})`;
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
      await refreshSections();
      setExpandedSection(copyName);
      const p = await listPages(plugin, copyName);
      setPagesMap((prev) => ({ ...prev, [copyName]: p }));
    } catch (err) {
      console.error("[Noteometry] Duplicate as template failed:", err);
      new Notice("Failed to duplicate as template", 8000);
    }
  };

  /* ── Long-press context menus ── */
  const openSectionCtxMenu = useCallback((section: string, x: number, y: number) => {
    const items: ContextMenuItem[] = [
      { label: "Rename", onClick: () => { startRename("section", section, section); setSidebarCtxMenu(null); } },
      { label: "Duplicate as Template", onClick: () => { handleDuplicateAsTemplate(section); setSidebarCtxMenu(null); } },
      { label: "", separator: true },
      { label: "Delete", danger: true, onClick: () => { handleDeleteSection(section); setSidebarCtxMenu(null); } },
    ];
    setSidebarCtxMenu({ x, y, items });
  }, [handleDuplicateAsTemplate, handleDeleteSection]);

  const openPageCtxMenu = useCallback((section: string, page: string, x: number, y: number) => {
    const items: ContextMenuItem[] = [
      { label: "Rename", onClick: () => { startRename("page", section, page); setSidebarCtxMenu(null); } },
      { label: "", separator: true },
      { label: "Delete", danger: true, onClick: () => { handleDeletePage(section, page); setSidebarCtxMenu(null); } },
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
          if (e.key === "Escape") { setAddingPage(""); setAddingSection(false); setAddingCourse(false); setRenamingItem(null); setNewName(""); }
        }}
        autoFocus
        placeholder="Name..."
        inputMode="text"
        enterKeyHint="done"
      />
      <button className="noteometry-sidebar-input-ok" onPointerUp={onSubmit}>OK</button>
    </div>
  );

  const startRename = (type: "section" | "page", section: string, name: string) => {
    setRenamingItem({ type, section, name });
    setNewName(name);
    setAddingSection(false);
    setAddingPage("");
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

  const sectionPages = expandedSection ? (pagesMap[expandedSection] ?? []) : [];
  const showPageColumn = !!expandedSection;
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <>
      <div className="noteometry-sidebar-backdrop" onClick={() => setOpen(false)} />
      <div className={`noteometry-sidebar noteometry-sidebar-open ${showPageColumn ? "nm-sidebar-two-col" : ""}`}>
        {/* ── Column 1: Sections ── */}
        <div className={`nm-sidebar-col nm-sidebar-sections-col ${showPageColumn && isMobile ? "nm-sidebar-col-hidden" : ""}`}>
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
                onClick={() => { setAddingCourse(true); setAddingSection(false); setAddingPage(""); setRenamingItem(null); setNewName("APUS"); }}
              >
                <IconBook /> New Course
              </button>
            )}

          <div className="noteometry-sidebar-list">
            {sections.map((s) => {
              const isRenamingSection = renamingItem?.type === "section" && renamingItem.name === s;
              return (
                <div key={s} className="noteometry-sidebar-section">
                  {isRenamingSection ? inlineInput(handleRename) : (
                    <LongPressDiv
                      className={`noteometry-sidebar-item noteometry-sidebar-section-item ${s === expandedSection ? "active" : ""}`}
                      onClick={() => {
                        setExpandedSection(s === expandedSection ? "" : s);
                      }}
                      onLongPress={(pos) => openSectionCtxMenu(s, pos.x, pos.y)}
                    >
                      <IconFolder />
                      <span className="noteometry-sidebar-item-name">{s}</span>
                      <IconChevRight />
                    </LongPressDiv>
                  )}
                </div>
              );
            })}
          </div>

          {addingSection
            ? inlineInput(handleAddSection)
            : (
              <button
                className="noteometry-sidebar-add"
                onClick={() => { setAddingSection(true); setAddingCourse(false); setAddingPage(""); setRenamingItem(null); setNewName(""); }}
              >
                <IconPlus /> New section
              </button>
            )}
        </div>

        {/* ── Column 2: Pages (slides in from right) ── */}
        {showPageColumn && (
          <div className="nm-sidebar-col nm-sidebar-pages-col">
            <div className="nm-sidebar-pages-hdr">
              {isMobile && (
                <button
                  className="noteometry-sidebar-toggle"
                  onClick={() => setExpandedSection("")}
                  title="Back"
                  style={{ transform: "rotate(180deg)" }}
                >
                  <IconChevRight />
                </button>
              )}
              <span className="noteometry-sidebar-title">{expandedSection}</span>
            </div>
            <div className="noteometry-sidebar-list">
              {sectionPages.map((p) => {
                const isRenamingPage = renamingItem?.type === "page" && renamingItem.section === expandedSection && renamingItem.name === p;
                return isRenamingPage ? (
                  <div key={p}>{inlineInput(handleRename)}</div>
                ) : (
                  <LongPressDiv
                    key={p}
                    className={`noteometry-sidebar-item noteometry-sidebar-page-item ${expandedSection === currentSection && p === currentPage ? "active" : ""}`}
                    onClick={() => selectPage(expandedSection, p)}
                    onLongPress={(pos) => openPageCtxMenu(expandedSection, p, pos.x, pos.y)}
                  >
                    <IconFile />
                    <span className="noteometry-sidebar-item-name">{p}</span>
                  </LongPressDiv>
                );
              })}
              {addingPage === expandedSection
                ? inlineInput(() => handleAddPage(expandedSection))
                : (
                  <button
                    className="noteometry-sidebar-add noteometry-sidebar-add-page"
                    onClick={() => { setAddingPage(expandedSection); setAddingSection(false); setRenamingItem(null); setNewName(""); }}
                  >
                    <IconPlus /> New page
                  </button>
                )}
            </div>
          </div>
        )}
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
