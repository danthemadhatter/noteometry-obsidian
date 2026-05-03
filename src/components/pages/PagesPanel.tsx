/**
 * v1.11.1 — Pages panel React component.
 *
 * Custom file tree replacement for Obsidian's file-explorer, scoped
 * to .nmpage files only. Folder chips at top filter, search box
 * filters by name. Tap targets are 44px (iPad guideline). Recency
 * sort by default; name sort toggle in the header.
 *
 * Inline rename + delete are intentionally minimal: we use the same
 * Obsidian fileManager API the file-explorer uses, so the user gets
 * the standard rename modal and trash-vs-delete behavior.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { App, EventRef, Menu, TFile } from "obsidian";
import type NoteometryPlugin from "../../main";
import { findAllNmpages } from "../../lib/recentPages";
import { rootDir, createNewPageFile } from "../../lib/persistence";
import { formatRelativeTime } from "../../lib/recentPages";
import {
  chipLabel,
  filterAndSort,
  folderChips,
  PagePanelEntry,
  PagesPanelSort,
} from "./pagesPanelLogic";

interface Props {
  plugin: NoteometryPlugin;
}

function snapshotEntries(app: App, root: string): PagePanelEntry[] {
  return findAllNmpages(app, root).map((f) => ({
    path: f.path,
    basename: f.basename,
    parentPath: f.parent?.path ?? "",
    mtime: f.stat.mtime,
  }));
}

export default function PagesPanel({ plugin }: Props) {
  const app = plugin.app;
  const [entries, setEntries] = useState<PagePanelEntry[]>(() =>
    snapshotEntries(app, rootDir(plugin)),
  );
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [sort, setSort] = useState<PagesPanelSort>("recency");

  // Subscribe to vault events. We refresh on create/delete/rename and
  // also on modify so the recency order stays accurate while the user
  // draws on a page (autosave fires modify per stroke; debounced via
  // requestAnimationFrame so we don't thrash React).
  const refresh = useCallback(() => {
    setEntries(snapshotEntries(app, rootDir(plugin)));
  }, [app, plugin]);

  useEffect(() => {
    let raf = 0;
    const queue = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(refresh);
    };
    const refs: EventRef[] = [
      app.vault.on("create", queue),
      app.vault.on("delete", queue),
      app.vault.on("rename", queue),
      app.vault.on("modify", queue),
    ];
    return () => {
      cancelAnimationFrame(raf);
      for (const r of refs) app.vault.offref(r);
    };
  }, [app, refresh]);

  const chips = useMemo(() => folderChips(entries), [entries]);
  const filtered = useMemo(
    () => filterAndSort(entries, { query, folder, sort }),
    [entries, query, folder, sort],
  );

  const openByPath = useCallback(
    (path: string) => {
      const f = app.vault.getAbstractFileByPath(path);
      if (f instanceof TFile) {
        void app.workspace.getLeaf(false).openFile(f);
      }
    },
    [app],
  );

  const showContextMenu = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.preventDefault();
      const f = app.vault.getAbstractFileByPath(path);
      if (!(f instanceof TFile)) return;
      const menu = new Menu();
      menu.addItem((it) =>
        it
          .setTitle("Open")
          .setIcon("lucide-file")
          .onClick(() => openByPath(path)),
      );
      menu.addItem((it) =>
        it
          .setTitle("Open in new tab")
          .setIcon("lucide-file-plus")
          .onClick(() => {
            void app.workspace.getLeaf(true).openFile(f);
          }),
      );
      menu.addItem((it) =>
        it
          .setTitle("Rename…")
          .setIcon("lucide-pencil")
          .onClick(() => {
            // Obsidian's standard rename dialog — same UX as
            // file-explorer, no custom modal needed.
            // @ts-expect-error fileManager typings are private
            app.fileManager.promptForFileRename?.(f);
          }),
      );
      menu.addSeparator();
      menu.addItem((it) =>
        it
          .setTitle("Delete (trash)")
          .setIcon("lucide-trash")
          .onClick(() => {
            void app.vault.trash(f, /*system*/ true);
          }),
      );
      menu.showAtMouseEvent(e.nativeEvent);
    },
    [app, openByPath],
  );

  const handleNewPage = useCallback(async () => {
    const parent = folder ?? rootDir(plugin);
    const file = await createNewPageFile(app, parent);
    if (file) void app.workspace.getLeaf(false).openFile(file);
  }, [app, folder, plugin]);

  const toggleSort = useCallback(() => {
    setSort((s) =>
      s === "recency" ? "name" : s === "name" ? "name-desc" : "recency",
    );
  }, []);

  const sortLabel = sort === "recency" ? "Recent" : sort === "name" ? "A→Z" : "Z→A";

  return (
    <div className="nm-pages-panel">
      <div className="nm-pages-header">
        <span className="nm-pages-title">Noteometry pages</span>
        <button
          type="button"
          className="nm-pages-new"
          aria-label="New page"
          onClick={handleNewPage}
          title="New page"
        >
          + New
        </button>
      </div>

      <div className="nm-pages-search-row">
        <input
          type="search"
          className="nm-pages-search"
          placeholder="Search pages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search pages"
        />
        <button
          type="button"
          className="nm-pages-sort"
          onClick={toggleSort}
          aria-label={`Sort: ${sortLabel}`}
          title={`Sort: ${sortLabel}`}
        >
          {sortLabel}
        </button>
      </div>

      {chips.length > 1 && (
        <div className="nm-pages-chips" role="tablist" aria-label="Folders">
          <button
            type="button"
            role="tab"
            aria-selected={folder == null}
            className={`nm-pages-chip${folder == null ? " is-active" : ""}`}
            onClick={() => setFolder(null)}
            title="All folders"
          >
            All <span className="nm-pages-chip-count">{entries.length}</span>
          </button>
          {chips.map((c) => (
            <button
              key={c.folder || "/"}
              type="button"
              role="tab"
              aria-selected={folder === c.folder}
              className={`nm-pages-chip${folder === c.folder ? " is-active" : ""}`}
              onClick={() => setFolder(c.folder)}
              title={c.folder || "/"}
            >
              {chipLabel(c.folder)}
              <span className="nm-pages-chip-count">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="nm-pages-empty">
          {query
            ? "No pages match."
            : "No pages yet. Tap + New to create one."}
        </div>
      ) : (
        <ul className="nm-pages-list" role="list">
          {filtered.map((e) => (
            <li
              key={e.path}
              className="nm-pages-row"
              onClick={() => openByPath(e.path)}
              onContextMenu={(ev) => showContextMenu(ev, e.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  openByPath(e.path);
                }
              }}
            >
              <span className="nm-pages-row-name">{e.basename}</span>
              <span className="nm-pages-row-meta">
                {e.parentPath || "/"} · {formatRelativeTime(e.mtime)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
