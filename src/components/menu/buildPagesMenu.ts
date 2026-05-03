/**
 * v1.12.0 — Build the Pages submenu tree for the canvas right-click hub.
 *
 * Data source: every .nmpage file under the configured rootDir, grouped
 * by parent folder (the "course"), sorted recency-first within each
 * group. Top section is "Recent" (last 5 across all folders).
 *
 * This replaces the leaf-based PagesPanel as the primary navigation
 * surface. Same data, same grouping logic — just rendered as a
 * ContextMenu tree instead of a sidebar React component.
 *
 * Pure-ish: takes an App + rootDir + a couple of callback hooks and
 * returns a ContextMenuItem[]. No React, no state.
 */

import type { App, TFile } from "obsidian";
import type { ContextMenuItem } from "../ContextMenu";
import { findAllNmpages, formatRelativeTime } from "../../lib/recentPages";
import { filterAndSort, type PagePanelEntry } from "../pages/pagesPanelLogic";

const RECENT_COUNT = 6;

export interface BuildPagesMenuOptions {
  app: App;
  rootDir: string;
  /** Currently-open page (highlighted with a checkmark in the menu). */
  currentPath?: string | null;
  /** Called when the user picks a page. The caller is responsible for
   *  opening it in the right leaf. */
  onPick: (file: TFile) => void;
  /** Called when the user picks "+ New page" — caller decides where. */
  onCreateNew?: () => void;
}

function entryFromFile(f: TFile): PagePanelEntry {
  return {
    path: f.path,
    basename: f.basename,
    parentPath: f.parent?.path ?? "",
    mtime: f.stat.mtime,
  };
}

function makePageItem(
  app: App,
  entry: PagePanelEntry,
  currentPath: string | null | undefined,
  onPick: (file: TFile) => void,
): ContextMenuItem {
  const isCurrent = entry.path === currentPath;
  return {
    label: entry.basename,
    icon: isCurrent ? "✓" : "📄",
    shortcut: formatRelativeTime(entry.mtime),
    onClick: () => {
      const f = app.vault.getAbstractFileByPath(entry.path);
      if (f && (f as TFile).stat) onPick(f as TFile);
    },
  };
}

/**
 * Group entries by parentPath (the folder), preserving the "vault root"
 * bucket as "/". Returns an array of folder buckets sorted by descending
 * page-count (most-used folder first), each containing its pages sorted
 * by recency.
 */
function groupByFolder(entries: PagePanelEntry[]): Array<{ folder: string; pages: PagePanelEntry[] }> {
  const buckets = new Map<string, PagePanelEntry[]>();
  for (const e of entries) {
    const arr = buckets.get(e.parentPath) ?? [];
    arr.push(e);
    buckets.set(e.parentPath, arr);
  }
  const out: Array<{ folder: string; pages: PagePanelEntry[] }> = [];
  for (const [folder, pages] of buckets) {
    out.push({
      folder,
      pages: filterAndSort(pages, { sort: "recency" }),
    });
  }
  out.sort((a, b) => {
    if (b.pages.length !== a.pages.length) return b.pages.length - a.pages.length;
    return a.folder.localeCompare(b.folder);
  });
  return out;
}

function folderLabel(folder: string): string {
  if (!folder) return "/";
  // Last path segment only — keeps the menu narrow. Full path is
  // implicit from the parent → child nesting in the menu.
  const parts = folder.split("/");
  return parts[parts.length - 1] || folder;
}

export function buildPagesMenu(opts: BuildPagesMenuOptions): ContextMenuItem[] {
  const { app, rootDir, currentPath, onPick, onCreateNew } = opts;
  const files = findAllNmpages(app, rootDir);
  const entries = files.map(entryFromFile);

  const items: ContextMenuItem[] = [];

  // Recent — last N across all folders.
  const byMtime = filterAndSort(entries, { sort: "recency" });
  const recent = byMtime.slice(0, RECENT_COUNT);
  if (recent.length > 0) {
    items.push({
      label: "Recent",
      icon: "🕒",
      submenu: recent.map((e) => makePageItem(app, e, currentPath, onPick)),
    });
    items.push({ separator: true, label: "" });
  }

  // Folders → pages within. If there's only the vault-root bucket and
  // it's tiny, flatten — no point in nesting one folder.
  const grouped = groupByFolder(entries);
  const onlyRoot = grouped[0];
  if (grouped.length === 1 && onlyRoot && onlyRoot.folder === "" && onlyRoot.pages.length <= RECENT_COUNT) {
    for (const e of onlyRoot.pages) {
      items.push(makePageItem(app, e, currentPath, onPick));
    }
  } else {
    for (const { folder, pages } of grouped) {
      items.push({
        label: folderLabel(folder),
        icon: "📁",
        shortcut: `${pages.length}`,
        submenu: pages.map((e) => makePageItem(app, e, currentPath, onPick)),
      });
    }
  }

  // "+ New page" at the bottom.
  if (onCreateNew) {
    if (items.length > 0) items.push({ separator: true, label: "" });
    items.push({
      label: "New page",
      icon: "➕",
      onClick: onCreateNew,
    });
  }

  // Empty-vault fallback.
  if (items.length === 0) {
    items.push({
      label: "No pages yet",
      icon: "·",
      disabled: true,
    });
  }

  return items;
}
