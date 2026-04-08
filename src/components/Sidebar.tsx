import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, FolderOpen, FileText, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [pages, setPages] = useState<string[]>([]);
  const [addingSection, setAddingSection] = useState(false);
  const [addingPage, setAddingPage] = useState(false);
  const [newName, setNewName] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  /* ── Load sections ─────────────────────────────────── */
  const refreshSections = useCallback(async () => {
    const s = await listSections(plugin);
    setSections(s);
  }, [plugin]);

  useEffect(() => { refreshSections(); }, [refreshSections]);

  /* ── Load pages when section changes ───────────────── */
  const refreshPages = useCallback(async () => {
    if (!currentSection) { setPages([]); return; }
    const p = await listPages(plugin, currentSection);
    setPages(p);
  }, [plugin, currentSection]);

  useEffect(() => { refreshPages(); }, [refreshPages]);

  /* ── Add section ───────────────────────────────────── */
  const handleAddSection = async () => {
    const name = newName.trim();
    if (!name) return;
    await createSection(plugin, name);
    setNewName("");
    setAddingSection(false);
    await refreshSections();
    // Auto-select and create first page
    await createPage(plugin, name, "Page 1");
    onSelect(name, "Page 1");
  };

  /* ── Add page ──────────────────────────────────────── */
  const handleAddPage = async () => {
    const name = newName.trim();
    if (!name || !currentSection) return;
    await createPage(plugin, currentSection, name);
    setNewName("");
    setAddingPage(false);
    await refreshPages();
    onSelect(currentSection, name);
  };

  /* ── Delete section ────────────────────────────────── */
  const handleDeleteSection = async (name: string) => {
    if (!confirm(`Delete section "${name}" and all its pages? This cannot be undone.`)) return;
    await deleteSection(plugin, name);
    await refreshSections();
    if (currentSection === name) {
      onSelect("", "");
    }
  };

  /* ── Delete page ───────────────────────────────────── */
  const handleDeletePage = async (name: string) => {
    if (!confirm(`Delete page "${name}"? This cannot be undone.`)) return;
    await deletePage(plugin, currentSection, name);
    const updated = await listPages(plugin, currentSection);
    setPages(updated);
    if (currentPage === name) {
      onSelect(currentSection, updated[0] ?? "");
    }
  };

  /* ── Inline name input ─────────────────────────────── */
  const nameInput = (onSubmit: () => void, onCancel: () => void) => (
    <div className="noteometry-sidebar-add-row">
      <input
        className="noteometry-sidebar-input"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
        placeholder="Name..."
      />
    </div>
  );

  if (collapsed) {
    return (
      <div className="noteometry-sidebar noteometry-sidebar-collapsed">
        <button
          className="noteometry-sidebar-toggle"
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="noteometry-sidebar">
      {/* ── Sections column ── */}
      <div className="noteometry-sidebar-sections">
        <div className="noteometry-sidebar-hdr">
          <button
            className="noteometry-sidebar-toggle"
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
          >
            <ChevronLeft size={14} />
          </button>
          <FolderOpen size={14} />
          <span>Sections</span>
        </div>
        <div className="noteometry-sidebar-list">
          {sections.map((s) => (
            <div
              key={s}
              className={`noteometry-sidebar-item ${s === currentSection ? "active" : ""}`}
              onClick={() => onSelect(s, "")}
            >
              <span className="noteometry-sidebar-item-name">{s}</span>
              <button
                className="noteometry-sidebar-item-del"
                onClick={(e) => { e.stopPropagation(); handleDeleteSection(s); }}
                title="Delete section"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        {addingSection
          ? nameInput(handleAddSection, () => { setAddingSection(false); setNewName(""); })
          : (
            <button
              className="noteometry-sidebar-add"
              onClick={() => { setAddingSection(true); setAddingPage(false); setNewName(""); }}
            >
              <Plus size={14} /> Add section
            </button>
          )}
      </div>

      {/* ── Pages column ── */}
      <div className="noteometry-sidebar-pages">
        <div className="noteometry-sidebar-hdr">
          <FileText size={14} />
          <span>{currentSection || "Pages"}</span>
        </div>
        <div className="noteometry-sidebar-list">
          {pages.map((p) => (
            <div
              key={p}
              className={`noteometry-sidebar-item ${p === currentPage ? "active" : ""}`}
              onClick={() => onSelect(currentSection, p)}
            >
              <span className="noteometry-sidebar-item-name">{p}</span>
              <button
                className="noteometry-sidebar-item-del"
                onClick={(e) => { e.stopPropagation(); handleDeletePage(p); }}
                title="Delete page"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {!currentSection && (
            <div className="noteometry-placeholder" style={{ padding: "12px" }}>
              Select a section
            </div>
          )}
        </div>
        {currentSection && (
          addingPage
            ? nameInput(handleAddPage, () => { setAddingPage(false); setNewName(""); })
            : (
              <button
                className="noteometry-sidebar-add"
                onClick={() => { setAddingPage(true); setAddingSection(false); setNewName(""); }}
              >
                <Plus size={14} /> Add page
              </button>
            )
        )}
      </div>
    </div>
  );
}
