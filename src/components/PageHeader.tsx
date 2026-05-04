import React, { useRef } from "react";
import type { App, TFile } from "obsidian";
import type NoteometryPlugin from "../main";
import type { ContextMenuItem } from "./ContextMenu";
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

interface AncestorSegment {
  /** Display label — the folder name. */
  name: string;
  /** Full vault-relative path of this ancestor folder. Used as the
   *  filter target when listing siblings. */
  path: string;
}

interface PathSegments {
  /** Folders above the file, ordered from outermost (notebook) to
   *  innermost (week). Excludes the configured root folder so the
   *  breadcrumb doesn't display "Noteometry / APUS / ..." every time.
   *
   *  Examples:
   *    Noteometry/APUS/ELEN201/Week 1/Lecture.nmpage
   *      → [APUS, ELEN201, Week 1]
   *    Noteometry/APUS/ELEN201/Week 1.nmpage
   *      → [APUS, ELEN201]
   *    Noteometry/Untitled.nmpage
   *      → []
   *    Outside-root/file.nmpage
   *      → [Outside-root]
   */
  ancestors: AncestorSegment[];
  /** File basename without .nmpage suffix. */
  page: string;
  /** Vault-relative path of the file's parent folder — used by the
   *  page-picker flyout to list siblings. */
  parentFolderPath: string;
}

/** "Week 2" before "Week 10". */
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

function parseSegments(file: TFile, root: string): PathSegments {
  const parts = file.path.split("/");
  const filenameWithExt = parts.pop()!;
  const page = filenameWithExt.replace(/\.nmpage$/, "");

  // Walk up the parent chain, building ancestor entries. Skip the
  // configured root folder so it doesn't clutter the breadcrumb.
  const ancestors: AncestorSegment[] = [];
  let acc = "";
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    if (acc === root) continue;
    ancestors.push({ name: part, path: acc });
  }
  return { ancestors, page, parentFolderPath: parts.join("/") };
}

/** All .nmpage files in the vault. Walking by path prefix in this
 *  component (instead of via findAllNmpages's scoping) avoids the
 *  rootFolder-prefix fallback that would mask vault-wide files. */
function allNmpages(app: App): TFile[] {
  return app.vault.getFiles().filter((f) => f.extension === "nmpage");
}

/** First .nmpage inside `folderPath` (depth-first), or null. Used as
 *  the landing page when the user picks a different ancestor. */
function firstPageIn(app: App, folderPath: string): TFile | null {
  const all = allNmpages(app);
  const prefix = folderPath ? `${folderPath}/` : "";
  const inFolder = all
    .filter((f) => (prefix === "" ? true : f.path.startsWith(prefix)))
    .sort((a, b) => naturalCompare(a.path, b.path));
  return inFolder[0] ?? null;
}

/** All .nmpage files whose parent folder path equals `folderPath` —
 *  i.e. the immediate siblings of any file at that depth. */
function pagesIn(app: App, folderPath: string): TFile[] {
  return allNmpages(app)
    .filter((f) => (f.parent?.path ?? "") === folderPath)
    .sort((a, b) => naturalCompare(a.basename, b.basename));
}

/** Distinct child folders that contain at least one .nmpage somewhere
 *  inside, given a parent folder path. Returns vault-relative paths. */
function subfoldersWithPages(app: App, parentFolderPath: string): { name: string; path: string }[] {
  const all = allNmpages(app);
  const prefix = parentFolderPath ? `${parentFolderPath}/` : "";
  const subs = new Map<string, string>();
  for (const f of all) {
    if (parentFolderPath && !f.path.startsWith(prefix)) continue;
    const rel = parentFolderPath ? f.path.slice(prefix.length) : f.path;
    const segs = rel.split("/");
    if (segs.length < 2) continue; // file directly inside parent — not a sub-folder
    const subName = segs[0]!;
    const subPath = parentFolderPath ? `${parentFolderPath}/${subName}` : subName;
    if (!subs.has(subPath)) subs.set(subPath, subName);
  }
  return [...subs.entries()]
    .map(([path, name]) => ({ name, path }))
    .sort((a, b) => naturalCompare(a.name, b.name));
}

/** Items to drop into the flyout when the user taps an ancestor button.
 *  Lists every sibling folder at that level (folders that have at
 *  least one .nmpage inside). Picking one navigates to its first
 *  depth-first leaf. */
function buildAncestorFlyout(
  app: App,
  grandparentPath: string,
  currentPath: string,
): ContextMenuItem[] {
  const siblings = subfoldersWithPages(app, grandparentPath);
  if (siblings.length === 0) {
    return [{ label: "No siblings at this level", icon: "·", disabled: true }];
  }
  return siblings.map((s) => ({
    label: s.name,
    icon: s.path === currentPath ? "✓" : "📁",
    onClick: () => {
      const target = firstPageIn(app, s.path);
      if (target) void app.workspace.getLeaf(false).openFile(target);
    },
  }));
}

/** The page-picker popover. Lists every .nmpage in the current
 *  parent folder, naturally sorted. The high-frequency switch
 *  (Week N → Week N+1). */
function buildPagePickerFlyout(
  app: App,
  parentFolderPath: string,
  currentFilePath: string,
): ContextMenuItem[] {
  const inFolder = pagesIn(app, parentFolderPath);
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
 * v1.13.3 — Page header band, anchored above the canvas.
 *
 *   APUS · ELEN201 · Week 1                    [ Lecture ▾ ]
 *   └────────── ancestors ──────────┘            └─ picker ─┘
 *
 * Renders one button per ancestor folder (any depth, supports the
 * APUS/Course/Week/Page convention Dan asked for) plus a page-picker
 * button on the right. Each control opens a flyout via the parent's
 * ContextMenu host.
 *
 * Ancestor button → flyout listing siblings at that level.
 * Pick → opens first depth-first leaf inside that subtree.
 *
 * Page picker → flyout listing pages in the current parent folder.
 * Pick → loads in current tab.
 */
export default function PageHeader({ app, plugin, file, onShowFlyout }: Props) {
  const ancestorBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pageBtnRef = useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    console.log("[Noteometry] PageHeader mounted", { hasFile: !!file, filePath: file?.path });
  }, [file]);

  const root = rootDir(plugin);
  const segs = file ? parseSegments(file, root) : null;

  const showFlyoutAt = (
    btn: HTMLButtonElement | null,
    items: ContextMenuItem[],
  ) => {
    console.log("[Noteometry] PageHeader.showFlyoutAt", { itemCount: items.length, hasButton: !!btn });
    if (items.length === 0) return;
    const rect = btn?.getBoundingClientRect();
    const x = rect ? rect.left : 0;
    const y = rect ? rect.bottom + 4 : 0;
    onShowFlyout(items, x, y);
  };

  if (!segs || !file) {
    return (
      <div className="noteometry-page-header">
        <div className="noteometry-page-header-breadcrumb">
          <span className="noteometry-page-header-segment" style={{ opacity: 0.55, cursor: "default" }}>
            NOTEOMETRY
          </span>
        </div>
        <span className="noteometry-page-header-picker" style={{ opacity: 0.55, cursor: "default" }}>
          <span className="noteometry-page-header-picker-label">No page open</span>
        </span>
      </div>
    );
  }

  return (
    <div className="noteometry-page-header">
      <div className="noteometry-page-header-breadcrumb">
        {segs.ancestors.map((anc, i) => {
          const isFirst = i === 0;
          // Sibling flyout pivots around this ancestor's PARENT folder.
          // For the outermost (i=0), parent is the configured root.
          const parentPath = i === 0 ? root : segs.ancestors[i - 1]!.path;
          return (
            <React.Fragment key={anc.path}>
              {!isFirst && <span className="noteometry-page-header-sep">·</span>}
              <button
                ref={(el) => { ancestorBtnRefs.current[i] = el; }}
                className="noteometry-page-header-segment"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  showFlyoutAt(
                    ancestorBtnRefs.current[i] ?? null,
                    buildAncestorFlyout(app, parentPath, anc.path),
                  );
                }}
                title={`Switch ${anc.name} (tap to see siblings)`}
              >
                {anc.name}
              </button>
            </React.Fragment>
          );
        })}
      </div>
      <button
        ref={pageBtnRef}
        className="noteometry-page-header-picker"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => {
          e.stopPropagation();
          showFlyoutAt(
            pageBtnRef.current,
            buildPagePickerFlyout(app, segs.parentFolderPath, file.path),
          );
        }}
        title="Switch page"
      >
        <span className="noteometry-page-header-picker-label">{segs.page}</span>
        <span className="noteometry-page-header-picker-chevron" aria-hidden="true">▾</span>
      </button>
    </div>
  );
}
