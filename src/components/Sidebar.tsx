import React, { useState, useEffect, useCallback } from "react";
import {
  IconPlus, IconTrash, IconFolder, IconFile,
  IconChevDown, IconChevRight, IconMenu, IconX,
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
  const [addingPage, setAddingPage] = useState("");
  const [newName, setNewName] = useState("");

  /* ── Load sections ── */
  const refreshSections = useCallback(async () => {
    const s = await listSections(plugin);
    setSections(s);
  }, [plugin]);

  useEffect(() => { refreshSections(); }, [refreshSections]);

  /* ── Load pages for expanded section ── */
  useEffect(() => {
    if (!expandedSection) return;
    (async () => {
      const p = await listPages(plugin, expandedSection);
      setPagesMap((prev) => ({ ...prev, [expandedSection]: p }));
    })();
  }, [plugin, expandedSection]);

  /* ── Keep expanded in sync with current ── */
  useEffect(() => {
    if (currentSection) setExpandedSection(currentSection);
  }, [currentSection]);

  /* ── Actions ── */
  const handleAddSection = async () => {
    const name = newName.trim();
    if (!name) return;
    await createSection(plugin, name);
    setNewName("");
    setAddingSection(false);
    await refreshSections();
    await createPage(plugin, name, "Page 1");
    setExpandedSection(name);
    onSelect(name, "Page 1");
  };

  const handleAddPage = async (section: string) => {
    const name = newName.trim();
    if (!name) return;
    await createPage(plugin, section, name);
    setNewName("");
    setAddingPage("");
    const p = await listPages(plugin, section);
    setPagesMap((prev) => ({ ...prev, [section]: p }));
    onSelect(section, name);
  };

  const handleDeleteSection = async (name: string) => {
    if (!confirm(`Delete "${name}" and all its pages?`)) return;
    await deleteSection(plugin, name);
    await refreshSections();
    if (currentSection === name) onSelect("", "");
  };

  const handleDeletePage = async (section: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await deletePage(plugin, section, name);
    const updated = await listPages(plugin, section);
    setPagesMap((prev) => ({ ...prev, [section]: updated }));
    if (currentPage === name) onSelect(section, updated[0] ?? "");
  };

  const selectPage = (section: string, page: string) => {
    onSelect(section, page);
    // Auto-close on mobile
    if (window.innerWidth < 768) setOpen(false);
  };

  /* ── Toggle button (always visible) ── */
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
      {/* Backdrop overlay on mobile */}
      <div className="noteometry-sidebar-backdrop" onClick={() => setOpen(false)} />

      <div className="noteometry-sidebar noteometry-sidebar-open">
        <div className="noteometry-sidebar-hdr">
          {toggleBtn}
          <span className="noteometry-sidebar-title">Notebooks</span>
        </div>

        <div className="noteometry-sidebar-list">
          {sections.map((s) => {
            const isExpanded = expandedSection === s;
            const sectionPages = pagesMap[s] ?? [];
            return (
              <div key={s} className="noteometry-sidebar-section">
                {/* Section row */}
                <div
                  className={`noteometry-sidebar-item noteometry-sidebar-section-item ${s === currentSection ? "active" : ""}`}
                  onClick={() => setExpandedSection(isExpanded ? "" : s)}
                >
                  {isExpanded ? <IconChevDown /> : <IconChevRight />}
                  <IconFolder />
                  <span className="noteometry-sidebar-item-name">{s}</span>
                  <button
                    className="noteometry-sidebar-item-del"
                    onClick={(e) => { e.stopPropagation(); handleDeleteSection(s); }}
                  >
                    <IconTrash />
                  </button>
                </div>

                {/* Pages under this section */}
                {isExpanded && (
                  <div className="noteometry-sidebar-pages">
                    {sectionPages.map((p) => (
                      <div
                        key={p}
                        className={`noteometry-sidebar-item noteometry-sidebar-page-item ${s === currentSection && p === currentPage ? "active" : ""}`}
                        onClick={() => selectPage(s, p)}
                      >
                        <IconFile />
                        <span className="noteometry-sidebar-item-name">{p}</span>
                        <button
                          className="noteometry-sidebar-item-del"
                          onClick={(e) => { e.stopPropagation(); handleDeletePage(s, p); }}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    ))}
                    {addingPage === s ? (
                      <div className="noteometry-sidebar-add-row">
                        <input
                          className="noteometry-sidebar-input"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddPage(s);
                            if (e.key === "Escape") { setAddingPage(""); setNewName(""); }
                          }}
                          autoFocus
                          placeholder="Page name..."
                          inputMode="text"
                        />
                      </div>
                    ) : (
                      <button
                        className="noteometry-sidebar-add noteometry-sidebar-add-page"
                        onClick={() => { setAddingPage(s); setAddingSection(false); setNewName(""); }}
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

        {/* Add section */}
        {addingSection ? (
          <div className="noteometry-sidebar-add-row" style={{ padding: "0 12px 12px" }}>
            <input
              className="noteometry-sidebar-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddSection();
                if (e.key === "Escape") { setAddingSection(false); setNewName(""); }
              }}
              autoFocus
              placeholder="Section name..."
              inputMode="text"
            />
          </div>
        ) : (
          <button
            className="noteometry-sidebar-add"
            onClick={() => { setAddingSection(true); setAddingPage(""); setNewName(""); }}
          >
            <IconPlus /> New section
          </button>
        )}
      </div>
    </>
  );
}
