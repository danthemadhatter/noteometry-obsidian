import { App, TFile } from "obsidian";

export interface RecentPage {
  file: TFile;
  path: string;
  basename: string;
  parentPath: string;
  mtime: number;
}

export function findAllNmpages(app: App, rootFolder: string): TFile[] {
  const prefix = rootFolder.replace(/\/+$/, "") + "/";
  const all = app.vault.getFiles().filter(f => f.extension === "nmpage");
  const scoped = all.filter(f => f.path === rootFolder || f.path.startsWith(prefix));
  return scoped.length > 0 ? scoped : all;
}

export function getRecentPages(app: App, rootFolder: string, limit = 6): RecentPage[] {
  const files = findAllNmpages(app, rootFolder);
  files.sort((a, b) => b.stat.mtime - a.stat.mtime);
  return files.slice(0, limit).map(file => ({
    file,
    path: file.path,
    basename: file.basename,
    parentPath: file.parent?.path ?? "",
    mtime: file.stat.mtime,
  }));
}

/** v1.11.1: most-recently-edited .nmpage, or null if none exist.
 *  Used by the new auto-open-on-launch flow that replaces the Home
 *  view as the default. */
export function getMostRecentNmpage(app: App, rootFolder: string): TFile | null {
  const files = findAllNmpages(app, rootFolder);
  if (files.length === 0) return null;
  let best = files[0]!;
  for (let i = 1; i < files.length; i++) {
    const f = files[i]!;
    if (f.stat.mtime > best.stat.mtime) best = f;
  }
  return best;
}

/** Coarse buckets, no false precision. "2 weeks ago" is intentionally
 *  absent — at that range an absolute date is more grounding than a
 *  relative offset. */
export function formatRelativeTime(mtimeMs: number, now = Date.now()): string {
  const diffMs = Math.max(0, now - mtimeMs);
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day} days ago`;
  return new Date(mtimeMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
