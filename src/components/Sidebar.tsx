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

interface Props {
  plugin: NoteometryPlugin;
  currentSection: string;
  currentPage: string;
  onSelect: (section: string, page: string) => void;
}

export default function Sidebar({ plugin, currentSection, currentPage, onSelect }: Props) {
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

  const refreshSections = useCallback(async () => {
    const s = await listSections(plugin);
    setSections(s);
  }, [plugin]);

  useEffect(() => { refreshSections(); }, [refreshSections]);

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
          // Rename folder by creating new, moving files, deleting old
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
    new Notice(`✅ Deleted section "${name}"`, 3000);
    await refreshSections();
    if (currentSection === name) onSelect("", "");
  } catch (err) {
    console.error("[Noteometry] deleteSection failed:", err);
    new Notice(`❌ Failed to delete section "${name}"`, 8000);
  }
};

const handleDeletePage = async (section: string, name: string) => {
  if (!confirm(`Delete "${name}"?`)) return;
  try {
    await deletePage(plugin, section, name);
    new Notice(`✅ Deleted page "${name}"`, 3000);
    const updated = await listPages(plugin, section);
    setPagesMap((prev) => ({ ...prev, [section]: updated }));
    if (currentPage === name) onSelect(section, updated[0] ?? "");
  } catch (err) {
    console.error("[Noteometry] deletePage failed:", err);
    new Notice(`❌ Failed to delete page "${name}"`, 8000);
  }
};

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

  return (
    <>
      <div className="noteometry-sidebar-backdrop" onClick={() => setOpen(false)} />
      <div className="noteometry-sidebar noteometry-sidebar-open">
        <div className="noteometry-sidebar-hdr">
          {toggleBtn}
          <span className="noteometry-sidebar-title">Notebooks</span>
        </div>

        {/* ── New Course button — above section list per plan ── */}
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
            const isExpanded = expandedSection === s;
            const sectionPages = pagesMap[s] ?? [];
            const isRenamingSection = renamingItem?.type === "section" && renamingItem.name === s;

            return (
              <div key={s} className="noteometry-sidebar-section">
                {isRenamingSection ? inlineInput(handleRename) : (
                  <div
                    className={`noteometry-sidebar-item noteometry-sidebar-section-item ${s === currentSection ? "active" : ""}`}
                    onClick={() => setExpandedSection(isExpanded ? "" : s)}
                  >
                    {isExpanded ? <IconChevDown /> : <IconChevRight />}
                    <IconFolder />
                    <span className="noteometry-sidebar-item-name">{s}</span>
                    <button
                      className="noteometry-sidebar-item-action"
                      onPointerUp={(e) => { e.stopPropagation(); startRename("section", s, s); }}
                      title="Rename"
                    >
                      <IconPen />
                    </button>
                    <button
                      className="noteometry-sidebar-item-del"
                      onPointerUp={(e) => { e.stopPropagation(); handleDeleteSection(s); }}
                      title="Delete"
                    >
                      <IconTrash />
                    </button>
                  </div>
                )}

                {isExpanded && (
                  <div className="noteometry-sidebar-pages">
                    {sectionPages.map((p) => {
                      const isRenamingPage = renamingItem?.type === "page" && renamingItem.section === s && renamingItem.name === p;
                      return isRenamingPage ? (
                        <div key={p}>{inlineInput(handleRename)}</div>
                      ) : (
                        <div
                          key={p}
                          className={`noteometry-sidebar-item noteometry-sidebar-page-item ${s === currentSection && p === currentPage ? "active" : ""}`}
                          onClick={() => selectPage(s, p)}
                        >
                          <IconFile />
                          <span className="noteometry-sidebar-item-name">{p}</span>
                          <button
                            className="noteometry-sidebar-item-action"
                            onPointerUp={(e) => { e.stopPropagation(); startRename("page", s, p); }}
                            title="Rename"
                          >
                            <IconPen />
                          </button>
                          <button
                            className="noteometry-sidebar-item-del"
                            onPointerUp={(e) => { e.stopPropagation(); handleDeletePage(s, p); }}
                            title="Delete"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      );
                    })}
                    {addingPage === s
                      ? inlineInput(() => handleAddPage(s))
                      : (
                        <button
                          className="noteometry-sidebar-add noteometry-sidebar-add-page"
                          onClick={() => { setAddingPage(s); setAddingSection(false); setRenamingItem(null); setNewName(""); }}
                        >
                          <IconPlus /> New page
                        </button>
                      )}
                  </div>
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
    </>
  );
}
