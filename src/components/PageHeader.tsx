import React, { useRef } from "react";
import type { App, TFile } from "obsidian";
import type NoteometryPlugin from "../main";
import type { ContextMenuItem } from "./ContextMenu";
import { findAllNmpages } from "../lib/recentPages";
import { rootDir } from "../lib/persistence";

interface Props {
  app: App;
  plugin: NoteometryPlugin;
  /** Bound page file. Null while the view is loading. */
  file: TFile | null;
  /** Caller renders the popover. Receives ContextMenuItem[] + viewport
   *  coordinates; parent reuses its existing ContextMenu component
   *  (handles outside-click, Esc, viewport clamping). */
  onShowFlyout: (items: ContextMenuItem[], x: number, y: number) => void;
}

interface PathSegments {
  /** Top-level folder under the vault's Noteometry root, e.g. "APUS". */
  notebook: string;
  /** Sub-folder under the notebook, e.g. "ELEN201". May contain "/"
   *  when the user nests deeper. */
  course: string;
  /** File basename without .nmpage suffix, e.g. "Week 1". */
  page: string;
  /** Vault-relative folder paths used to build flyout items. */
  notebookPath: string;
  coursePath: string;
}

/** "Week 2" before "Week 10". Splits on numeric runs and compares
 *  numerically when both sides are numeric, lexicographically
 *  otherwise. */
function naturalCompare(a: string, b: string): number {
  const ax = a.split(/(\d+)/);
  const bx = b.split(/(\d+)/);
  const len = Math.min(ax.length, bx.length);
  for (let i = 0; i < len; i++) {
    const aPart = ax[i]!;
    const bPart = bx[i]!;
    if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
      const diff = parseInt(aPart, 10) - parseInt(bPart, 10);
      if (diff !== 0) return diff;
    } else {
      const cmp = aPart.localeCompare(bPart, undefined, { sensitivity: "base" });
      if (cmp !== 0) return cmp;
    }
  }
  return ax.length - bx.length;
}

function parseSegments(file: TFile, root: string): PathSegments | null {
  // file.path = "Noteometry/APUS/ELEN201/Week 1.nmpage" → strip root,
  // split, drop filename. Files outside the root render with the
  // parent dir as the notebook so the header still has structure.
  const rel = file.path.startsWith(root + "/")
    ? file.path.slice(root.length + 1)
    : file.path;
  const parts = rel.split("/");
  if (parts.length === 0) return null;
  const filenameWithExt = parts.pop()!;
  const page = filenameWithExt.replace(/\.nmpage$/, "");

  if (parts.length === 0) {
    return { notebook: "", course: "", page, notebookPath: "", coursePath: "" };
  } else if (parts.length === 1) {
    return {
      notebook: parts[0]!, course: "", page,
      notebookPath: parts[0]!, coursePath: parts[0]!,
    };
  } else {
    const notebook = parts[0]!;
    const course = parts.slice(1).join("/");
    return {
      notebook, course, page,
      notebookPath: notebook,
      coursePath: parts.join("/"),
    };
  }
}

/** First .nmpage inside `folderPath` (depth-first), or null. Used as
 *  the landing page when the user picks a notebook or course. */
function firstPageIn(app: App, root: string, folderPath: string): TFile | null {
  const all = findAllNmpages(app, root);
  const fullPrefix = folderPath ? `${root}/${folderPath}/` : `${root}/`;
  const inFolder = all
    .filter((f) => f.path.startsWith(fullPrefix))
    .sort((a, b) => naturalCompare(a.path, b.path));
  return inFolder[0] ?? null;
}

function buildNotebookList(
  app: App,
  root: string,
  currentNotebook: string,
): ContextMenuItem[] {
  // A "notebook" = any top-level folder under root that contains at
  // least one .nmpage anywhere inside it. We derive the list from
  // findAllNmpages so we don't need to walk the vault separately.
  const all = findAllNmpages(app, root);
  const notebooks = new Set<string>();
  const rootPrefix = `${root}/`;
  for (const f of all) {
    if (!f.path.startsWith(rootPrefix)) continue;
    const rel = f.path.slice(rootPrefix.length);
    const top = rel.split("/")[0];
    if (top && top.endsWith(".nmpage")) {
      // File directly in root — register an unnamed-notebook bucket
      notebooks.add("");
    } else if (top) {
      notebooks.add(top);
    }
  }

  if (notebooks.size === 0) {
    return [{ label: "No pages anywhere", icon: "·", disabled: true }];
  }

  const sorted = [...notebooks].sort((a, b) => naturalCompare(a, b));
  return sorted.map((nb) => ({
    label: nb || "(root)",
    icon: nb === currentNotebook ? "✓" : "📚",
    onClick: () => {
      const target = firstPageIn(app, root, nb);
      if (target) void app.workspace.getLeaf(false).openFile(target);
    },
  }));
}

function buildCourseList(
  app: App,
  root: string,
  notebookPath: string,
  currentCoursePath: string,
): ContextMenuItem[] {
  // A "course" = the immediate sub-folder of the notebook that
  // contains the .nmpage. Walk findAllNmpages, filter to those under
  // the notebook, group by their immediate-after-notebook segment.
  const all = findAllNmpages(app, root);
  const notebookPrefix = notebookPath
    ? `${root}/${notebookPath}/`
    : `${root}/`;
  const courses = new Set<string>();
  for (const f of all) {
    if (!f.path.startsWith(notebookPrefix)) continue;
    const rel = f.path.slice(notebookPrefix.length);
    const top = rel.split("/")[0];
    if (top && top.endsWith(".nmpage")) {
      courses.add(""); // root of notebook
    } else if (top) {
      courses.add(top);
    }
  }

  if (courses.size === 0) {
    return [{ label: "No courses in this notebook", icon: "·", disabled: true }];
  }

  const currentCourseSegment = currentCoursePath
    ? currentCoursePath.split("/").slice(notebookPath ? 1 : 0).join("/")
    : "";

  const sorted = [...courses].sort((a, b) => naturalCompare(a, b));
  return sorted.map((c) => {
    const fullPath = notebookPath ? `${notebookPath}/${c}` : c;
    return {
      label: c || "(notebook root)",
      icon: c === currentCourseSegment ? "✓" : "📁",
      onClick: () => {
        const target = firstPageIn(app, root, fullPath);
        if (target) void app.workspace.getLeaf(false).openFile(target);
      },
    };
  });
}

function buildPageList(
  app: App,
  root: string,
  coursePath: string,
  currentFilePath: string,
): ContextMenuItem[] {
  // The page-picker popover — the high-frequency switch. Lists ONLY
  // the .nmpage files in the current course folder (siblings of the
  // active page), naturally sorted so "Week 2" lands before "Week 10".
  const all = findAllNmpages(app, root);
  const fullFolderPath = coursePath ? `${root}/${coursePath}` : root;
  const inFolder = all
    .filter((f) => (f.parent?.path ?? "") === fullFolderPath)
    .sort((a, b) => naturalCompare(a.basename, b.basename));

  if (inFolder.length === 0) {
    return [{ label: "No pages in this folder", icon: "·", disabled: true }];
  }

  return inFolder.map((f) => ({
    label: f.basename,
    icon: f.path === currentFilePath ? "●" : "○",
    onClick: () => {
      void app.workspace.getLeaf(false).openFile(f);
    },
  }));
}

/**
 * v1.13.0 — Page header band, anchored above the canvas in its own
 * row. Replaces the v1.12 floating PageBreadcrumb pill that was
 * sitting on the canvas. Contains:
 *
 *   • Left side: small breadcrumb of the upper levels — notebook ·
 *     course. Each segment is a button; tap → flyout listing the
 *     siblings at that level. Picking lands on the first page in
 *     that notebook / course (depth-first).
 *
 *   • Right side: the page-picker button. Label = current page name +
 *     a chevron, clearly a dropdown affordance. Tap → flyout listing
 *     all pages in the current course folder, naturally sorted.
 *
 * The popovers are rendered by the parent's existing ContextMenu
 * component (passed via onShowFlyout) so outside-click, Esc, and
 * viewport clamping all work for free.
 */
export default function PageHeader({ app, plugin, file, onShowFlyout }: Props) {
  const notebookBtnRef = useRef<HTMLButtonElement>(null);
  const courseBtnRef = useRef<HTMLButtonElement>(null);
  const pageBtnRef = useRef<HTMLButtonElement>(null);

  if (!file) return null;
  const root = rootDir(plugin);
  const segs = parseSegments(file, root);
  if (!segs) return null;

  const showFlyoutAt = (
    btn: HTMLButtonElement | null,
    items: ContextMenuItem[],
  ) => {
    if (items.length === 0) return;
    const rect = btn?.getBoundingClientRect();
    const x = rect ? rect.left : 0;
    const y = rect ? rect.bottom + 4 : 0;
    onShowFlyout(items, x, y);
  };

  return (
    <div className="noteometry-page-header">
      <div className="noteometry-page-header-breadcrumb">
        {segs.notebook && (
          <>
            <button
              ref={notebookBtnRef}
              className="noteometry-page-header-segment"
              onClick={() => showFlyoutAt(
                notebookBtnRef.current,
                buildNotebookList(app, root, segs.notebook),
              )}
              title={`Switch notebook (current: ${segs.notebook})`}
            >
              {segs.notebook}
            </button>
            {segs.course && <span className="noteometry-page-header-sep">·</span>}
          </>
        )}
        {segs.course && (
          <button
            ref={courseBtnRef}
            className="noteometry-page-header-segment"
            onClick={() => showFlyoutAt(
              courseBtnRef.current,
              buildCourseList(app, root, segs.notebookPath, segs.coursePath),
            )}
            title={`Switch course (current: ${segs.course})`}
          >
            {segs.course}
          </button>
        )}
      </div>
      <button
        ref={pageBtnRef}
        className="noteometry-page-header-picker"
        onClick={() => showFlyoutAt(
          pageBtnRef.current,
          buildPageList(app, root, segs.coursePath, file.path),
        )}
        title="Switch page"
      >
        <span className="noteometry-page-header-picker-label">{segs.page}</span>
        <span className="noteometry-page-header-picker-chevron" aria-hidden="true">▾</span>
      </button>
    </div>
  );
}
