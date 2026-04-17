import React, { useState, useEffect, useCallback, useRef } from "react";
import { Notice } from "obsidian";
import {
  IconPlus, IconFolder,
  IconMenu, IconX, IconBook, IconLayout, IconSparkles,
  iconFromName,
} from "./Icons";
import type NoteometryPlugin from "../main";
import {
  listSections,
  listPages,
  createSection,
  createPage,
  deletePage,
  deleteSection,
} from "../lib/persistence";

interface Props {
  plugin: NoteometryPlugin;
  currentSection: string;
  currentPage: string;
  onSelect: (section: string, page: string) => void;
}

export default function Sidebar({ plugin, currentSection, currentPage, onSelect }: Props) {
  const [sections, setSections] = useState<string[]>([]);
  const [pagesMap, setPagesMap] = useState<Record<string, string[]>>({});
  const [open, setOpen] = useState(() => window.innerWidth >= 768);

  /* Which section tab is active — follows currentSection from parent */
  const [activeTab, setActiveTab] = useState(currentSection);

  /* Inline editing state */
  const [renamingItem, setRenamingItem] = useState<{ type: "section" | "page"; section: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  /* Add-new state */
  const [addingPage, setAddingPage] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [addingCourse, setAddingCourse] = useState(false);
  const [newName, setNewName] = useState("");

  const submitting = useRef(false);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  /* ── Load sections on mount ── */
  const refreshSections = useCallback(async () => {
    const s = await listSections(plugin);
    setSections(s);
  }, [plugin]);

  useEffect(() => { refreshSections(); }, [refreshSections]);

  /* ── Load pages whenever activeTab changes ── */
  useEffect(() => {
    if (!activeTab) return;
    (async () => {
      const p = await listPages(plugin, activeTab);
      setPagesMap((prev) => ({ ...prev, [activeTab]: p }));
    })();
  }, [plugin, activeTab]);

  /* ── Sync activeTab when parent changes currentSection ── */
  useEffect(() => {
    if (currentSection) setActiveTab(currentSection);
  }, [currentSection]);

  /* ── Focus rename input when it appears ── */
  useEffect(() => {
    if (renamingItem && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingItem]);

  /* ── Scroll active tab into view ── */
  useEffect(() => {
    if (!tabBarRef.current || !activeTab) return;
    const activeEl = tabBarRef.current.querySelector(".nm-sidebar-tab.active") as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab, sections]);

  /* ════════════════════════════════════════════
     Section CRUD
     ════════════════════════════════════════════ */

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
      setActiveTab(name);
      const p = await listPages(plugin, name);
      setPagesMap((prev) => ({ ...prev, [name]: p }));
      onSelect(name, "Page 1");
    } finally { submitting.current = false; }
  };

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
      setAddingCourse(false);
      await refreshSections();
      setActiveTab(name);
      const p = await listPages(plugin, name);
      setPagesMap((prev) => ({ ...prev, [name]: p }));
      onSelect(name, "Week 1");
    } finally { submitting.current = false; }
  };

  const handleDeleteSection = async (name: string) => {
    if (!confirm(`Delete "${name}" and all its pages?`)) return;
    try {
      await deleteSection(plugin, name);
      new Notice(`Deleted section "${name}"`, 3000);
      await refreshSections();
      if (currentSection === name) {
        onSelect("", "");
        setActiveTab("");
      }
    } catch (err) {
      console.error("[Noteometry] deleteSection failed:", err);
      new Notice(`Failed to delete section "${name}"`, 8000);
    }
  };

  /* ════════════════════════════════════════════
     Page CRUD
     ════════════════════════════════════════════ */

  const handleAddPage = async () => {
    if (submitting.current || !activeTab) return;
    const name = newName.trim();
    if (!name) return;
    submitting.current = true;
    try {
      await createPage(plugin, activeTab, name);
      setNewName("");
      setAddingPage(false);
      const p = await listPages(plugin, activeTab);
      setPagesMap((prev) => ({ ...prev, [activeTab]: p }));
      onSelect(activeTab, name);
    } finally { submitting.current = false; }
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

  /* ════════════════════════════════════════════
     Rename (inline — double-click to activate)
     ════════════════════════════════════════════ */

  const startRename = (type: "section" | "page", section: string, name: string) => {
    setRenamingItem({ type, section, name });
    setRenameValue(name);
    setAddingSection(false);
    setAddingCourse(false);
    setAddingPage(false);
  };

  const cancelRename = () => {
    setRenamingItem(null);
    setRenameValue("");
  };

  const commitRename = async () => {
    if (submitting.current || !renamingItem) return;
    const name = renameValue.trim();
    if (!name || name === renamingItem.name) { cancelRename(); return; }
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
        setActiveTab(name);
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
      cancelRename();
    }
  };

  /* ════════════════════════════════════════════
     Page selection
     ════════════════════════════════════════════ */

  const selectPage = (section: string, page: string) => {
    onSelect(section, page);
    if (window.innerWidth < 768) setOpen(false);
  };

  /* ════════════════════════════════════════════
     Inline input (shared for add-page, add-section, add-course)
     ════════════════════════════════════════════ */

  const cancelAdding = () => {
    setAddingPage(false);
    setAddingSection(false);
    setAddingCourse(false);
    setNewName("");
  };

  const inlineInput = (onSubmit: () => void, placeholder = "Name...") => (
    <div className="noteometry-sidebar-add-row">
      <input
        className="noteometry-sidebar-input"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onSubmit(); }
          if (e.key === "Escape") { cancelAdding(); }
        }}
        autoFocus
        placeholder={placeholder}
        inputMode="text"
        enterKeyHint="done"
      />
      <button className="noteometry-sidebar-input-ok" onPointerUp={onSubmit}>OK</button>
    </div>
  );

  /* ════════════════════════════════════════════
     Rename input (for inline rename on double-click)
     ════════════════════════════════════════════ */

  const renameInput = () => (
    <input
      ref={renameInputRef}
      className="noteometry-sidebar-input nm-sidebar-rename-input"
      value={renameValue}
      onChange={(e) => setRenameValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commitRename(); }
        if (e.key === "Escape") { cancelRename(); }
      }}
      onBlur={commitRename}
      inputMode="text"
      enterKeyHint="done"
    />
  );

  /* ════════════════════════════════════════════
     Derived state
     ════════════════════════════════════════════ */

  const currentPages = activeTab ? (pagesMap[activeTab] ?? []) : [];

  /* ════════════════════════════════════════════
     Toggle button (hamburger / X)
     ════════════════════════════════════════════ */

  const toggleBtn = (
    <button
      className="noteometry-sidebar-toggle"
      onClick={() => setOpen(!open)}
      title={open ? "Close" : "Pages"}
    >
      {open ? <IconX /> : <IconMenu />}
    </button>
  );

  /* ════════════════════════════════════════════
     Closed state
     ════════════════════════════════════════════ */

  if (!open) {
    return (
      <div className="noteometry-sidebar noteometry-sidebar-closed">
        {toggleBtn}
      </div>
    );
  }

  /* ════════════════════════════════════════════
     Open state — tabbed layout
     ════════════════════════════════════════════ */

  return (
    <>
      <div className="noteometry-sidebar-backdrop" onClick={() => setOpen(false)} />
      <div className="noteometry-sidebar noteometry-sidebar-open">

        {/* ── Header ── */}
        <div className="noteometry-sidebar-hdr">
          {toggleBtn}
          <span className="noteometry-sidebar-brand">
            <span className="noteometry-sidebar-brand-mark"><IconLayout /></span>
            <span className="noteometry-sidebar-title">Notebooks</span>
          </span>
          <span className="noteometry-sidebar-hdr-count" title="Total sections">
            {sections.length}
          </span>
        </div>

        {/* ── Section tabs (vertical list, each row shows a folder glyph
               + a colored tone chip derived from the section index so it's
               visually distinct at a glance) ── */}
        <div className="nm-sidebar-tab-bar" ref={tabBarRef}>
          {sections.map((s, idx) => {
            const isActive = activeTab === s;
            const isRenaming = renamingItem?.type === "section" && renamingItem.name === s;
            const tone = (idx % 6) + 1;
            const pageCount = pagesMap[s]?.length;

            return (
              <div
                key={s}
                className={`nm-sidebar-tab nm-tone-${tone}${isActive ? " active" : ""}`}
                onClick={() => {
                  if (!isRenaming) setActiveTab(s);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename("section", s, s);
                }}
                title={s}
              >
                {isRenaming ? renameInput() : (
                  <>
                    <span className="nm-sidebar-tab-chip"><IconFolder /></span>
                    <span className="nm-sidebar-tab-label">{s}</span>
                    {typeof pageCount === "number" && (
                      <span className="nm-sidebar-tab-count">{pageCount}</span>
                    )}
                    <button
                      className="nm-sidebar-tab-del"
                      onPointerUp={(e) => { e.stopPropagation(); handleDeleteSection(s); }}
                      title={`Delete ${s}`}
                    >
                      <IconX />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Pages list (each row shows an auto-chosen icon based on
               page name keywords for faster visual scanning) ── */}
        <div className="nm-sidebar-page-list">
          {activeTab ? (
            currentPages.length > 0 ? (
              currentPages.map((p) => {
                const isActive = activeTab === currentSection && p === currentPage;
                const isRenaming = renamingItem?.type === "page" && renamingItem.section === activeTab && renamingItem.name === p;
                const PageIcon = iconFromName(p);

                return (
                  <div
                    key={p}
                    className={`noteometry-sidebar-item noteometry-sidebar-page-item${isActive ? " active" : ""}`}
                    onClick={() => { if (!isRenaming) selectPage(activeTab, p); }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startRename("page", activeTab, p);
                    }}
                  >
                    {isRenaming ? renameInput() : (
                      <>
                        <span className="noteometry-sidebar-item-icon"><PageIcon /></span>
                        <span className="noteometry-sidebar-item-name">{p}</span>
                        <button
                          className="noteometry-sidebar-item-del"
                          onPointerUp={(e) => { e.stopPropagation(); handleDeletePage(activeTab, p); }}
                          title={`Delete ${p}`}
                        >
                          <IconX />
                        </button>
                      </>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="nm-sidebar-empty">
                <IconSparkles />
                <span>No pages yet — tap <b>+ Page</b> below</span>
              </div>
            )
          ) : (
            <div className="nm-sidebar-empty">
              <IconFolder />
              <span>Select a section to see its pages</span>
            </div>
          )}
        </div>

        {/* ── Bottom action bar ── */}
        <div className="nm-sidebar-bottom-bar">
          {(addingPage || addingSection || addingCourse) ? (
            inlineInput(
              addingPage ? handleAddPage :
              addingCourse ? handleAddCourse :
              handleAddSection,
              addingCourse ? "Course name..." :
              addingSection ? "Section name..." :
              "Page name..."
            )
          ) : (
            <div className="nm-sidebar-action-buttons">
              <button
                className="nm-sidebar-action-btn nm-action-page"
                title="Add a new page to the active section"
                onClick={() => {
                  if (!activeTab) { new Notice("Select a section first"); return; }
                  setAddingPage(true);
                  setAddingSection(false);
                  setAddingCourse(false);
                  setRenamingItem(null);
                  setNewName("");
                }}
              >
                <span className="nm-action-icon"><IconPlus /></span>
                <span className="nm-action-label">Page</span>
              </button>
              <button
                className="nm-sidebar-action-btn nm-action-section"
                title="Create a new section (folder)"
                onClick={() => {
                  setAddingSection(true);
                  setAddingPage(false);
                  setAddingCourse(false);
                  setRenamingItem(null);
                  setNewName("");
                }}
              >
                <span className="nm-action-icon"><IconFolder /></span>
                <span className="nm-action-label">Section</span>
              </button>
              <button
                className="nm-sidebar-action-btn nm-sidebar-action-course"
                title="Create a 16-week course section"
                onClick={() => {
                  setAddingCourse(true);
                  setAddingSection(false);
                  setAddingPage(false);
                  setRenamingItem(null);
                  setNewName("APUS");
                }}
              >
                <span className="nm-action-icon"><IconBook /></span>
                <span className="nm-action-label">Course</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
