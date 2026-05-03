/**
 * v1.11.1 — Pages panel pure logic.
 *
 * Filtering, sorting, grouping. No React, no Obsidian. Lets us pin
 * the file-tree behavior with vitest in node-env without needing to
 * stand up the React tree.
 *
 * Why a custom panel: Obsidian's file-explorer shows .md, .canvas,
 * .pdf, attachments — for an ADHD-tuned EE workstation that's noise.
 * The user only cares about .nmpage. We narrow the surface, give it
 * iPad-friendly tap targets, and put recency at the top because that
 * is the actual mental model ("the page I just had open").
 */

export interface PagePanelEntry {
  path: string;
  basename: string;
  parentPath: string; // "" for vault root, no trailing slash otherwise
  mtime: number;
}

export type PagesPanelSort = "recency" | "name" | "name-desc";

export interface FilterOptions {
  query?: string; // case-insensitive substring on basename + parent
  folder?: string | null; // null/undefined = all folders
  sort?: PagesPanelSort;
}

/**
 * Apply the active query and folder filter, then sort.
 * Recency is the default — it matches the user's "open the page I
 * just had" mental model. Name sorts are deterministic and stable.
 */
export function filterAndSort(
  entries: ReadonlyArray<PagePanelEntry>,
  opts: FilterOptions = {},
): PagePanelEntry[] {
  const { query, folder, sort = "recency" } = opts;

  let out: PagePanelEntry[] = entries.slice();

  if (folder != null) {
    // exact-match folder; sub-folders are NOT included so the chip's
    // count is honest (clicking "lecture" doesn't grab "lecture/exam-prep").
    // folder === "" is the vault-root chip and is intentionally a valid
    // filter value (matches entries whose parentPath is "").
    out = out.filter((e) => e.parentPath === folder);
  }

  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    out = out.filter(
      (e) =>
        e.basename.toLowerCase().includes(q) ||
        e.parentPath.toLowerCase().includes(q),
    );
  }

  if (sort === "recency") {
    out.sort((a, b) => b.mtime - a.mtime);
  } else if (sort === "name") {
    out.sort((a, b) => a.basename.localeCompare(b.basename));
  } else if (sort === "name-desc") {
    out.sort((a, b) => b.basename.localeCompare(a.basename));
  }

  return out;
}

/**
 * Folder chips with counts, sorted by descending count then alpha.
 * The most-used folder ends up first — same reasoning as recency-by-
 * default for pages.
 */
export interface FolderChip {
  folder: string; // "" for vault root
  count: number;
}

export function folderChips(
  entries: ReadonlyArray<PagePanelEntry>,
): FolderChip[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    counts.set(e.parentPath, (counts.get(e.parentPath) ?? 0) + 1);
  }
  const chips: FolderChip[] = [];
  for (const [folder, count] of counts) chips.push({ folder, count });
  chips.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.folder.localeCompare(b.folder);
  });
  return chips;
}

/**
 * Display label for a folder chip. Vault root becomes "/" so it's
 * visually distinct from missing labels.
 */
export function chipLabel(folder: string): string {
  if (!folder) return "/";
  // last path segment only — full path on hover via title attr
  const parts = folder.split("/");
  return parts[parts.length - 1] || folder;
}
