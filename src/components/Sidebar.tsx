import React, { useState, useEffect, useCallback, useRef } from "react";
import { Notice } from "obsidian";
import {
  IconPlus, IconTrash, IconFolder, IconFile,
  IconChevDown, IconChevRight, IconMenu, IconX, IconPen, IconBook,
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
import { revealFolder, createSixteenWeekCourse } from "../lib/sidebarActions";
import { validateRename } from "../lib/renameValidation";

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
    submitting.current = true;
    try {
      const result = await createSixteenWeekCourse(plugin, newName);
      if (!result) return;
      setNewName("");
      setAddingCourse(false);
      await refreshSections();
      // v1.7.2 course template returns 3-level paths
      // ("Course/Week 1/Lecture"). The legacy 2-level Sidebar doesn't
      // visualize weeks, so we point active tab at the course root and
      // fall back to whatever 2-level pages exist directly under it.
      // The new SidebarTree (replacing this file in step 9) renders
      // the full tree natively.
      setActiveTab(result.coursePath);
      const p = await listPages(plugin, result.coursePath);
      setPagesMap((prev) => ({ ...prev, [result.coursePath]: p }));
      onSelect(result.coursePath, result.firstPagePath.split("/").pop() ?? "");
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

    // v1.6.11: gather siblings so validateRename can detect collisions,
    // and surface all rejection reasons through a Notice. Pre-v1.6.11
    // the rename silently cancelled on any edge (blank, collision, FS
    // character) and the user reported "rename doesn't work" with no
    // explanation.
    const siblings = renamingItem.type === "section"
      ? sections
      : (pagesMap[renamingItem.section] ?? []);
    const v = validateRename(renameValue, renamingItem.name, siblings);
    if (!v.ok) {
      if (v.error !== "unchanged") new Notice(`Rename: ${v.error}`, 5000);
      cancelRename();
      return;
    }
    const name = v.name;

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
          // Move the attachments folder too (v1.6.11): pre-fix, a
          // section rename left images/PDFs stranded under the old
          // folder and drop-ins broke with "file not found."
          const oldAttach = `${oldPath}/attachments`;
          if (await adapter.exists(oldAttach)) {
            const newAttach = `${newPath}/attachments`;
            if (!(await adapter.exists(newAttach))) await adapter.mkdir(newAttach);
            const listed = await adapter.list(oldAttach);
            for (const f of listed.files) {
              const base = f.split("/").pop()!;
              const buf = await adapter.readBinary(f);
              await adapter.writeBinary(`${newAttach}/${base}`, buf);
              await adapter.remove(f);
            }
            try { await adapter.rmdir(oldAttach, false); } catch { /* empty */ }
          }
          try { await adapter.rmdir(oldPath, false); } catch (e) {
            console.warn("[Noteometry] could not remove old section folder:", e);
          }
        }
        await refreshSections();
        // Refresh the pages map entry keyed under the new name.
        try {
          const p = await listPages(plugin, name);
          setPagesMap((prev) => {
            const next = { ...prev };
            delete next[renamingItem.name];
            next[name] = p;
            return next;
          });
        } catch { /* non-fatal */ }
        setActiveTab(name);
        if (currentSection === renamingItem.name) onSelect(name, currentPage);
        new Notice(`Renamed section to "${name}"`, 3000);
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
        new Notice(`Renamed page to "${name}"`, 3000);
      }
    } catch (e) {
      console.error("[Noteometry] rename failed:", e);
      new Notice("Rename failed — see console", 6000);
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
          <span className="noteometry-sidebar-title">Notebooks</span>
          {activeTab && (
            <button
              className="nm-sidebar-reveal-btn"
              title={`Reveal "${activeTab}" folder in system explorer (or copy vault path on mobile)`}
              onClick={(e) => { e.stopPropagation(); revealFolder(plugin, activeTab); }}
            >
              <IconFolder />
            </button>
          )}
        </div>

        {/* ── Section tabs (horizontal, scrollable) ── */}
        <div className="nm-sidebar-tab-bar" ref={tabBarRef}>
          {sections.map((s) => {
            const isActive = activeTab === s;
            const isRenaming = renamingItem?.type === "section" && renamingItem.name === s;

            return (
              <div
                key={s}
                className={`nm-sidebar-tab${isActive ? " active" : ""}`}
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
                    <span className="nm-sidebar-tab-label">{s}</span>
                    <button
                      className="nm-sidebar-tab-rename"
                      onPointerUp={(e) => { e.stopPropagation(); startRename("section", s, s); }}
                      title={`Rename ${s}`}
                    >
                      <IconPen />
                    </button>
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

        {/* ── Pages list ── */}
        <div className="nm-sidebar-page-list">
          {activeTab ? (
            currentPages.length > 0 ? (
              currentPages.map((p) => {
                const isActive = activeTab === currentSection && p === currentPage;
                const isRenaming = renamingItem?.type === "page" && renamingItem.section === activeTab && renamingItem.name === p;

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
                        <span className="noteometry-sidebar-item-name">{p}</span>
                        <button
                          className="noteometry-sidebar-item-rename"
                          onPointerUp={(e) => { e.stopPropagation(); startRename("page", activeTab, p); }}
                          title={`Rename ${p}`}
                        >
                          <IconPen />
                        </button>
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
              <div className="nm-sidebar-empty">No pages yet</div>
            )
          ) : (
            <div className="nm-sidebar-empty">Select a section</div>
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
                className="nm-sidebar-action-btn"
                onClick={() => {
                  if (!activeTab) { new Notice("Select a section first"); return; }
                  setAddingPage(true);
                  setAddingSection(false);
                  setAddingCourse(false);
                  setRenamingItem(null);
                  setNewName("");
                }}
              >
                <IconPlus /> Page
              </button>
              <button
                className="nm-sidebar-action-btn"
                onClick={() => {
                  setAddingSection(true);
                  setAddingPage(false);
                  setAddingCourse(false);
                  setRenamingItem(null);
                  setNewName("");
                }}
              >
                <IconPlus /> Section
              </button>
              <button
                className="nm-sidebar-action-btn nm-sidebar-action-course"
                onClick={() => {
                  setAddingCourse(true);
                  setAddingSection(false);
                  setAddingPage(false);
                  setRenamingItem(null);
                  setNewName("APUS");
                }}
                title="Create a new course with Week 1–16 pages"
              >
                <IconBook /> 16-week course
              </button>
            </div>
          )}
        </div>

        {/* ── Footer: vault path hint ──
            Shows the user where pages actually live on disk. This is
            intentionally always visible so it's obvious each page is a
            real .md file inside the vault — Obsidian file/folder
            operations (copy, move, sync) all work on it. */}
        <div className="nm-sidebar-footer" title="Each page is a .md file in this vault folder">
          <IconFolder />
          <span className="nm-sidebar-footer-path">
            {plugin.settings.vaultFolder || "Noteometry"}/
            {activeTab ? <strong>{activeTab}</strong> : "…"}
          </span>
        </div>

      </div>
    </>
  );
}
