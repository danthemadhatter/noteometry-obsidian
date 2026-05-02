import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Notice, Menu } from "obsidian";
import {
  IconPlus,
  IconFolder,
  IconChevDown,
  IconChevRight,
  IconMenu,
  IconX,
  IconPen,
  IconBook,
  IconSliders,
} from "./Icons";
import type NoteometryPlugin from "../main";
import {
  createPageAt,
  createFolderAt,
  renameNode,
  deleteNode,
  type TreeNode,
} from "../lib/persistence";
import { ancestorPaths, walkLeaves } from "../lib/treeHelpers";
import { createSixteenWeekCourse, revealFolder } from "../lib/sidebarActions";
import { validateRename } from "../lib/renameValidation";

interface Props {
  plugin: NoteometryPlugin;
  tree: TreeNode[];
  currentPath: string;
  onSelect: (path: string) => void;
  onTreeChanged: () => Promise<TreeNode[]>;
}

const dirOf = (p: string): string => {
  const idx = p.lastIndexOf("/");
  return idx === -1 ? "" : p.slice(0, idx);
};
const baseOf = (p: string): string => {
  const idx = p.lastIndexOf("/");
  return idx === -1 ? p : p.slice(idx + 1);
};

/** localStorage key for expand-state persistence. Keyed by vault-folder
 *  setting so two vaults don't share their expansion. */
function expandStorageKey(plugin: NoteometryPlugin): string {
  const vault = plugin.settings.vaultFolder || "Noteometry";
  return `noteometry-tree-expanded:${vault}`;
}

function loadExpandedFromStorage(plugin: NoteometryPlugin): Set<string> {
  try {
    const raw = localStorage.getItem(expandStorageKey(plugin));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveExpandedToStorage(plugin: NoteometryPlugin, expanded: Set<string>): void {
  try {
    localStorage.setItem(expandStorageKey(plugin), JSON.stringify([...expanded]));
  } catch { /* localStorage full or unavailable — ignore */ }
}

/** Collect sibling names under a given parent path (for rename collision
 *  detection). dirPath="" means top-level. */
/** OneNote-flavored per-course color band. Hashes the course name into
 *  one of eight evenly-spaced hues so renames/reorders are stable and
 *  no two adjacent courses collide on hue by coincidence. */
const COURSE_HUES = [210, 25, 145, 285, 340, 55, 175, 305];
function colorForCourse(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % COURSE_HUES.length;
  return `hsl(${COURSE_HUES[idx]}, 62%, 52%)`;
}

/** Resolve the top-level course color for any node by walking up to the
 *  root segment of its path. Sub-folders and pages inherit their
 *  course's color so the whole subtree reads as one OneNote section. */
function nodeColor(node: TreeNode): string {
  const root = node.path.split("/")[0] ?? node.name;
  return colorForCourse(root);
}

function collectSiblings(tree: TreeNode[], dirPath: string): string[] {
  if (dirPath === "") return tree.map((n) => n.name);
  const parts = dirPath.split("/");
  let current: TreeNode[] | undefined = tree;
  for (const part of parts) {
    const node: TreeNode | undefined = current?.find((n) => n.name === part && n.kind === "folder");
    current = node?.children;
    if (!current) return [];
  }
  return current.map((n) => n.name);
}

interface NewInputState {
  parentPath: string;
  kind: "folder" | "page";
}

export default function SidebarTree({
  plugin,
  tree,
  currentPath,
  onSelect,
  onTreeChanged,
}: Props) {
  const [open, setOpen] = useState(() => window.innerWidth >= 768);
  const [expanded, setExpanded] = useState<Set<string>>(() => loadExpandedFromStorage(plugin));
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newInput, setNewInput] = useState<NewInputState | null>(null);
  const [newName, setNewName] = useState("");
  const [addingCourse, setAddingCourse] = useState(false);
  const [addingSixteenWeek, setAddingSixteenWeek] = useState(false);

  const renameInputRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);

  // Auto-expand the ancestors of the active page so it's visible.
  useEffect(() => {
    if (!currentPath) return;
    const ancestors = ancestorPaths(currentPath);
    if (ancestors.length === 0) return;
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const a of ancestors) {
        if (!next.has(a)) { next.add(a); changed = true; }
      }
      if (changed) saveExpandedToStorage(plugin, next);
      return changed ? next : prev;
    });
  }, [currentPath, plugin]);

  // Focus rename input when it appears.
  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPath]);

  /* ── Expand / collapse ── */

  const toggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      saveExpandedToStorage(plugin, next);
      return next;
    });
  }, [plugin]);

  /* ── CRUD ── */

  const refreshAndMaybeReselect = useCallback(async (newCurrent?: string) => {
    await onTreeChanged();
    if (newCurrent !== undefined) onSelect(newCurrent);
  }, [onTreeChanged, onSelect]);

  // v1.8.6: clicking a folder now expands AND navigates to a page
  // inside it, matching OneNote-style behaviour. Resolves the
  // "switching weeks doesn't change canvases" symptom Dan reported
  // after the v1.8.x ships, which was rooted in the v1.8.5 course
  // template only seeding Week 1's Lecture: every other week was an
  // empty folder that clicked but went nowhere.
  //
  // - Folder with pages: navigate to the first depth-first leaf.
  // - Empty folder: auto-create 'Lecture' and navigate to it. The
  //   auto-create is a one-time onboarding fix; users with the older
  //   single-Lecture template don't have to manually seed every
  //   week — just click the empty week and get one.
  const handleFolderClick = useCallback(async (node: TreeNode) => {
    toggleExpand(node.path);

    const firstLeaf = node.children ? walkLeaves(node.children)[0] : undefined;
    if (firstLeaf) {
      onSelect(firstLeaf.path);
      return;
    }

    if (submitting.current) return;
    submitting.current = true;
    try {
      const createdPath = await createPageAt(plugin, node.path, "Lecture");
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add(node.path);
        saveExpandedToStorage(plugin, next);
        return next;
      });
      await refreshAndMaybeReselect(createdPath);
      new Notice(`Created "Lecture" in "${node.name}"`, 2500);
    } catch (e) {
      console.error("[Noteometry] auto-seed page failed:", e);
      new Notice(`Couldn't create starter page in "${node.name}"`, 6000);
    } finally {
      submitting.current = false;
    }
  }, [plugin, onSelect, toggleExpand, refreshAndMaybeReselect]);

  const handleRename = useCallback(async (node: TreeNode, raw: string) => {
    if (submitting.current) return;
    const siblings = collectSiblings(tree, dirOf(node.path)).filter((n) => n !== node.name);
    const v = validateRename(raw, node.name, siblings);
    if (!v.ok) {
      if (v.error !== "unchanged") new Notice(`Rename: ${v.error}`, 5000);
      setRenamingPath(null);
      return;
    }
    submitting.current = true;
    try {
      const newPath = dirOf(node.path) ? `${dirOf(node.path)}/${v.name}` : v.name;
      await renameNode(plugin, node.path, newPath, node.kind);
      // If the active page was inside the renamed subtree, rewrite
      // currentPath to point at the new location.
      let nextCurrent: string | undefined;
      if (currentPath === node.path) {
        nextCurrent = newPath;
      } else if (node.kind === "folder" && currentPath.startsWith(`${node.path}/`)) {
        nextCurrent = newPath + currentPath.slice(node.path.length);
      }
      await refreshAndMaybeReselect(nextCurrent);
      new Notice(`Renamed to "${v.name}"`, 3000);
    } catch (e) {
      console.error("[Noteometry] rename failed:", e);
      new Notice("Rename failed — see console", 6000);
    } finally {
      submitting.current = false;
      setRenamingPath(null);
    }
  }, [plugin, tree, currentPath, refreshAndMaybeReselect]);

  const handleDelete = useCallback(async (node: TreeNode) => {
    const label = node.kind === "folder" ? `"${node.name}" and everything inside it` : `"${node.name}"`;
    if (!confirm(`Delete ${label}?`)) return;
    try {
      await deleteNode(plugin, node.path, node.kind);
      new Notice(`Deleted "${node.name}"`, 3000);
      // If the active page was inside the deleted subtree, drop the
      // selection — the upstream onEmptyState handler clears the canvas.
      let nextCurrent: string | undefined;
      const activeWasUnderNode =
        currentPath === node.path ||
        (node.kind === "folder" && currentPath.startsWith(`${node.path}/`));
      if (activeWasUnderNode) nextCurrent = "";
      await refreshAndMaybeReselect(nextCurrent);
    } catch (e) {
      console.error("[Noteometry] delete failed:", e);
      new Notice(`Failed to delete "${node.name}"`, 8000);
    }
  }, [plugin, currentPath, refreshAndMaybeReselect]);

  const submitNewInput = useCallback(async () => {
    if (submitting.current || !newInput) return;
    const name = newName.trim();
    if (!name) { setNewInput(null); setNewName(""); return; }
    const siblings = collectSiblings(tree, newInput.parentPath);
    const v = validateRename(name, "", siblings);
    if (!v.ok) {
      if (v.error !== "unchanged") new Notice(`New ${newInput.kind}: ${v.error}`, 5000);
      return;
    }
    submitting.current = true;
    try {
      let createdPath: string;
      if (newInput.kind === "page") {
        createdPath = await createPageAt(plugin, newInput.parentPath, v.name);
      } else {
        createdPath = await createFolderAt(plugin, newInput.parentPath, v.name);
      }
      // Make sure the parent is expanded so the new node is visible.
      if (newInput.parentPath) {
        setExpanded((prev) => {
          const next = new Set(prev);
          next.add(newInput.parentPath);
          saveExpandedToStorage(plugin, next);
          return next;
        });
      }
      await refreshAndMaybeReselect(newInput.kind === "page" ? createdPath : undefined);
      setNewName("");
      setNewInput(null);
    } catch (e) {
      console.error("[Noteometry] create failed:", e);
      new Notice(`Failed to create ${newInput.kind}`, 8000);
    } finally {
      submitting.current = false;
    }
  }, [plugin, newInput, newName, tree, refreshAndMaybeReselect]);

  const submitNewCourse = useCallback(async () => {
    if (submitting.current) return;
    const name = newName.trim();
    if (!name) { setAddingCourse(false); setNewName(""); return; }
    const siblings = collectSiblings(tree, "");
    const v = validateRename(name, "", siblings);
    if (!v.ok) {
      if (v.error !== "unchanged") new Notice(`New course: ${v.error}`, 5000);
      return;
    }
    submitting.current = true;
    try {
      const createdPath = await createFolderAt(plugin, "", v.name);
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add(createdPath);
        saveExpandedToStorage(plugin, next);
        return next;
      });
      await refreshAndMaybeReselect();
      setNewName("");
      setAddingCourse(false);
    } catch (e) {
      console.error("[Noteometry] new course failed:", e);
      new Notice("Failed to create course", 8000);
    } finally {
      submitting.current = false;
    }
  }, [plugin, newName, tree, refreshAndMaybeReselect]);

  const submitSixteenWeek = useCallback(async () => {
    if (submitting.current) return;
    const name = newName.trim();
    if (!name) { setAddingSixteenWeek(false); setNewName(""); return; }
    submitting.current = true;
    try {
      const result = await createSixteenWeekCourse(plugin, name);
      if (!result) {
        new Notice("Course name required", 5000);
        return;
      }
      // Expand the course AND Week 1 so the seeded Lecture is visible.
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add(result.coursePath);
        next.add(`${result.coursePath}/Week 1`);
        saveExpandedToStorage(plugin, next);
        return next;
      });
      await refreshAndMaybeReselect(result.firstPagePath);
      setNewName("");
      setAddingSixteenWeek(false);
    } catch (e) {
      console.error("[Noteometry] 16-week course failed:", e);
      new Notice("Failed to create 16-week course", 8000);
    } finally {
      submitting.current = false;
    }
  }, [plugin, newName, refreshAndMaybeReselect]);

  /* ── Context menu (right-click + the touch "⋯" button) ── */

  const showNodeMenu = useCallback((node: TreeNode, target: MouseEvent | React.MouseEvent | { clientX: number; clientY: number }) => {
    const menu = new Menu();
    menu.addItem((item) =>
      item.setTitle("Rename")
        .setIcon("pencil")
        .onClick(() => {
          setRenamingPath(node.path);
          setRenameValue(node.name);
          setNewInput(null);
        }),
    );
    menu.addItem((item) =>
      item.setTitle("Delete")
        .setIcon("trash")
        .onClick(() => { void handleDelete(node); }),
    );
    if (node.kind === "folder") {
      menu.addSeparator();
      menu.addItem((item) =>
        item.setTitle("New page")
          .setIcon("file-plus")
          .onClick(() => {
            setNewInput({ parentPath: node.path, kind: "page" });
            setNewName("");
            setRenamingPath(null);
          }),
      );
      menu.addItem((item) =>
        item.setTitle("New subfolder")
          .setIcon("folder-plus")
          .onClick(() => {
            setNewInput({ parentPath: node.path, kind: "folder" });
            setNewName("");
            setRenamingPath(null);
          }),
      );
      // Sugar for course-level nodes: pre-name the new folder Week N+1.
      if (node.depth === 0) {
        const weekChildren = (node.children ?? []).filter((c) => c.kind === "folder" && /^Week\s+\d+/.test(c.name));
        const nextWeek = weekChildren.length + 1;
        menu.addItem((item) =>
          item.setTitle(`New Week ${nextWeek}`)
            .setIcon("calendar-plus")
            .onClick(() => {
              setNewInput({ parentPath: node.path, kind: "folder" });
              setNewName(`Week ${nextWeek}`);
              setRenamingPath(null);
            }),
        );
      }
    }
    menu.addSeparator();
    menu.addItem((item) =>
      item.setTitle("Reveal in finder")
        .setIcon("folder-open")
        .onClick(() => {
          const target = node.kind === "page" ? dirOf(node.path) : node.path;
          void revealFolder(plugin, target);
        }),
    );
    if ("clientX" in target && "clientY" in target) {
      menu.showAtPosition({ x: target.clientX, y: target.clientY });
    }
  }, [plugin, handleDelete]);

  /* ── Render ── */

  const isExpanded = useCallback((path: string) => expanded.has(path), [expanded]);

  const renderRow = useCallback((node: TreeNode): React.ReactNode => {
    const isActive = node.kind === "page" && currentPath === node.path;
    const isRenaming = renamingPath === node.path;
    const isFolder = node.kind === "folder";
    const expandedHere = isFolder && isExpanded(node.path);
    const indent = node.depth * 14 + 4;

    const rowClass = [
      "noteometry-tree-row",
      isFolder ? "noteometry-tree-row--folder" : "noteometry-tree-row--page",
      node.depth === 0 ? "noteometry-tree-row--course" : "",
      isActive ? "noteometry-tree-row--active" : "",
    ].filter(Boolean).join(" ");

    const accent = nodeColor(node);
    const rowStyle: React.CSSProperties = {
      paddingLeft: `${indent}px`,
      // Color the inset left bar via a CSS variable so SidebarTree CSS
      // can render it without per-row inline backgrounds.
      ["--noteometry-row-accent" as keyof React.CSSProperties]: accent,
    } as React.CSSProperties;

    return (
      <div key={node.path} className="noteometry-tree-node">
        <div
          className={rowClass}
          style={rowStyle}
          onClick={() => {
            if (isRenaming) return;
            if (isFolder) void handleFolderClick(node);
            else onSelect(node.path);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isRenaming) return;
            showNodeMenu(node, e);
          }}
          title={node.path}
        >
          <span className="noteometry-tree-twisty">
            {isFolder ? (expandedHere ? <IconChevDown /> : <IconChevRight />) : <span aria-hidden="true" style={{ display: "inline-block", width: 12 }} />}
          </span>
          <span className="noteometry-tree-icon">
            {isFolder ? <IconFolder /> : <IconBook />}
          </span>
          {isRenaming ? (
            <input
              ref={renameInputRef}
              className="noteometry-tree-rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void handleRename(node, renameValue); }
                if (e.key === "Escape") { setRenamingPath(null); }
              }}
              onBlur={() => { void handleRename(node, renameValue); }}
              onClick={(e) => e.stopPropagation()}
              inputMode="text"
              enterKeyHint="done"
            />
          ) : (
            <>
              <span className="noteometry-tree-label">{node.name}</span>
              <button
                className="noteometry-tree-row-menu"
                aria-label="Actions"
                onPointerUp={(e) => {
                  e.stopPropagation();
                  showNodeMenu(node, { clientX: (e as React.PointerEvent).clientX, clientY: (e as React.PointerEvent).clientY });
                }}
              >
                <IconMenu />
              </button>
            </>
          )}
        </div>

        {/* Inline new-input as a child of this folder */}
        {isFolder && expandedHere && newInput?.parentPath === node.path && (
          <div
            className="noteometry-tree-new-input"
            style={{ paddingLeft: `${indent + 14 + 18}px` }}
          >
            <input
              autoFocus
              className="noteometry-tree-rename-input"
              value={newName}
              placeholder={newInput.kind === "page" ? "New page name…" : "New subfolder name…"}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void submitNewInput(); }
                if (e.key === "Escape") { setNewInput(null); setNewName(""); }
              }}
              onBlur={() => { void submitNewInput(); }}
              inputMode="text"
              enterKeyHint="done"
            />
          </div>
        )}

        {isFolder && expandedHere && node.children?.map(renderRow)}
      </div>
    );
  }, [
    currentPath, renamingPath, renameValue, newInput, newName,
    isExpanded, toggleExpand, onSelect, showNodeMenu, handleRename, submitNewInput,
    handleFolderClick,
  ]);

  const rootRows = useMemo(() => tree.map(renderRow), [tree, renderRow]);

  /* ── Toggle (mobile) ── */

  const toggleBtn = (
    <button
      className="noteometry-sidebar-toggle"
      onClick={() => setOpen(!open)}
      title={open ? "Close" : "Notebooks"}
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
      <div className="noteometry-sidebar noteometry-sidebar-open noteometry-sidebar--tree">
        {/* Header */}
        <div className="noteometry-sidebar-hdr">
          {toggleBtn}
          <span className="noteometry-sidebar-title">Notebooks</span>
          <span className="noteometry-tree-hdr-spacer" />
          <button
            className="noteometry-tree-hdr-btn"
            title="Toggle Obsidian's left sidebar (file explorer, search, other plugins)"
            aria-label="Toggle Obsidian sidebar"
            onClick={() => {
              try {
                const ws = plugin.app.workspace as unknown as {
                  leftSplit?: { toggle?: () => void; collapsed?: boolean; expand?: () => void; collapse?: () => void };
                };
                if (ws.leftSplit?.toggle) ws.leftSplit.toggle();
                else if (ws.leftSplit?.collapsed && ws.leftSplit.expand) ws.leftSplit.expand();
                else if (ws.leftSplit?.collapse) ws.leftSplit.collapse();
              } catch (e) {
                console.warn("[Noteometry] toggle leftSplit failed:", e);
              }
            }}
          >
            <IconMenu />
          </button>
          <button
            className="noteometry-tree-hdr-btn"
            title="Open Obsidian Settings"
            aria-label="Open settings"
            onClick={() => {
              try {
                const app = plugin.app as unknown as { setting?: { open?: () => void } };
                app.setting?.open?.();
              } catch (e) {
                console.warn("[Noteometry] open settings failed:", e);
              }
            }}
          >
            <IconSliders />
          </button>
        </div>

        {/* Tree */}
        <div className="noteometry-tree-scroll">
          {tree.length === 0 ? (
            <div className="noteometry-tree-empty">
              No courses yet. Click "+ New Course" or "16-Week Course" below to get started.
            </div>
          ) : rootRows}
        </div>

        {/* Bottom action bar */}
        <div className="noteometry-tree-bottom-bar">
          {addingCourse ? (
            <div className="noteometry-sidebar-add-row">
              <input
                autoFocus
                className="noteometry-tree-rename-input"
                value={newName}
                placeholder="Course name…"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); void submitNewCourse(); }
                  if (e.key === "Escape") { setAddingCourse(false); setNewName(""); }
                }}
                onBlur={() => { void submitNewCourse(); }}
                inputMode="text"
                enterKeyHint="done"
              />
            </div>
          ) : addingSixteenWeek ? (
            <div className="noteometry-sidebar-add-row">
              <input
                autoFocus
                className="noteometry-tree-rename-input"
                value={newName}
                placeholder="Course name (16 weeks)…"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); void submitSixteenWeek(); }
                  if (e.key === "Escape") { setAddingSixteenWeek(false); setNewName(""); }
                }}
                onBlur={() => { void submitSixteenWeek(); }}
                inputMode="text"
                enterKeyHint="done"
              />
            </div>
          ) : (
            <div className="noteometry-tree-actions">
              <button
                className="noteometry-tree-action-btn"
                onClick={() => {
                  setAddingCourse(true);
                  setAddingSixteenWeek(false);
                  setNewInput(null);
                  setRenamingPath(null);
                  setNewName("");
                }}
                title="Create an empty course folder"
              >
                <IconPlus /> New Course
              </button>
              <button
                className="noteometry-tree-action-btn noteometry-tree-action-course"
                onClick={() => {
                  setAddingSixteenWeek(true);
                  setAddingCourse(false);
                  setNewInput(null);
                  setRenamingPath(null);
                  setNewName("APUS");
                }}
                title="Create a course with Week 1–16 folders, Lecture seeded in Week 1"
              >
                <IconBook /> 16-Week Course
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="noteometry-tree-footer"
          title="Each page is a .md file in this vault folder"
        >
          <IconFolder />
          <span className="noteometry-tree-footer-path">
            {plugin.settings.vaultFolder || "Noteometry"}/
            {currentPath ? <strong>{dirOf(currentPath) || baseOf(currentPath)}</strong> : "…"}
          </span>
        </div>
      </div>
    </>
  );
}
