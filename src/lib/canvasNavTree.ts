import { App, TFile, TFolder } from "obsidian";
import { findAllNmpages } from "./recentPages";

/** v1.14.9: OneNote-style two-column nav. The vault layout is
 *  <root>/<Section>/[<sub-folder>/]*<Page>.nmpage. We collapse all
 *  sub-folders into a flat page list per section so the user sees
 *  the same shape OneNote does: pick a section, see every page in it.
 *
 *  Sections = first-level child folders of the Noteometry root.
 *  Pages    = every .nmpage that lives anywhere underneath a section.
 *  Loose .nmpage files directly in the root land in a synthetic
 *  section labeled with the root folder name (e.g. "Noteometry")
 *  so the bucket reads as a real place instead of the opaque
 *  "(root)" jargon Dan flagged in v1.14.10. */

export interface NavSection {
  /** Display name shown in the Sections column. */
  name: string;
  /** Vault path of the section folder. Empty string for the
   *  synthetic root section that holds loose .nmpage files. */
  folderPath: string;
  /** Pages inside this section, sorted by name. */
  pages: NavPage[];
  /** v1.14.10: true for the synthetic bucket that holds loose
   *  .nmpage files directly under the Noteometry root. CanvasNav
   *  uses this to (a) render a different glyph (\ud83d\udcd2 notebook)
   *  and (b) refuse rename/delete on the bucket itself, which would
   *  blow away the entire root folder. */
  isRootBucket?: boolean;
}

export interface NavPage {
  file: TFile;
  /** Display label shown in the Pages column. Page basename. */
  label: string;
  /** Full path inside the vault. Used as a stable key. */
  path: string;
  /** Sub-folder relative to the section, or "" if directly under
   *  the section. Useful for tooltips so users can tell two
   *  same-named pages apart without us inventing extra UI. */
  subPath: string;
  mtime: number;
}

/** v1.14.10: derive the synthetic-section label from the root path.
 *  "Noteometry" reads as a place; the previous "(root)" was opaque
 *  jargon. Falls back to the literal "Noteometry" for the empty
 *  string (vault-root configurations). */
export function rootSectionLabel(rootFolder: string): string {
  const trimmed = rootFolder.replace(/\/+$/, "");
  if (!trimmed) return "Noteometry";
  const tail = trimmed.slice(trimmed.lastIndexOf("/") + 1);
  return tail || "Noteometry";
}

export function buildNav(app: App, rootFolder: string): NavSection[] {
  const root = (app.vault.getAbstractFileByPath(rootFolder) ?? null) as TFolder | null;
  const sections: NavSection[] = [];
  const looseRoot: NavPage[] = [];

  // Collect direct child folders as sections (in vault order, then
  // alpha-stable). If the root folder doesn't exist yet, fall back
  // to bucketing every .nmpage by its first-segment folder.
  if (root && root.children) {
    for (const child of root.children) {
      if (child instanceof TFolder) {
        sections.push({
          name: child.name,
          folderPath: child.path,
          pages: collectPagesUnder(child),
        });
      } else if (child instanceof TFile && child.extension === "nmpage") {
        looseRoot.push(toNavPage(child, ""));
      }
    }
  } else {
    // Fallback: group all .nmpage files in the vault by their
    // first-segment folder under rootFolder. Keeps nav alive even
    // if the root folder isn't registered yet.
    const files = findAllNmpages(app, rootFolder);
    const prefix = rootFolder.replace(/\/+$/, "") + "/";
    const buckets = new Map<string, NavPage[]>();
    for (const f of files) {
      const rel = f.path.startsWith(prefix) ? f.path.slice(prefix.length) : f.path;
      const slash = rel.indexOf("/");
      if (slash === -1) {
        looseRoot.push(toNavPage(f, ""));
      } else {
        const sectionName = rel.slice(0, slash);
        const subPath = rel.slice(slash + 1).split("/").slice(0, -1).join("/");
        const sectionPath = (prefix + sectionName).replace(/\/+$/, "");
        const arr = buckets.get(sectionPath) ?? [];
        arr.push(toNavPage(f, subPath));
        buckets.set(sectionPath, arr);
      }
    }
    for (const [path, pages] of buckets) {
      const name = path.slice(path.lastIndexOf("/") + 1);
      sections.push({ name, folderPath: path, pages });
    }
  }

  for (const s of sections) s.pages.sort(byLabel);
  sections.sort((a, b) => a.name.localeCompare(b.name));

  if (looseRoot.length > 0) {
    looseRoot.sort(byLabel);
    sections.unshift({
      name: rootSectionLabel(rootFolder),
      folderPath: rootFolder,
      pages: looseRoot,
      isRootBucket: true,
    });
  }

  return sections;
}

function collectPagesUnder(folder: TFolder): NavPage[] {
  const out: NavPage[] = [];
  const walk = (node: TFolder, sub: string) => {
    if (!node.children) return;
    for (const child of node.children) {
      if (child instanceof TFile && child.extension === "nmpage") {
        out.push(toNavPage(child, sub));
      } else if (child instanceof TFolder) {
        walk(child, sub ? `${sub}/${child.name}` : child.name);
      }
    }
  };
  walk(folder, "");
  return out;
}

function toNavPage(file: TFile, subPath: string): NavPage {
  return {
    file,
    label: file.basename,
    path: file.path,
    subPath,
    mtime: file.stat.mtime,
  };
}

function byLabel(a: NavPage, b: NavPage): number {
  return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
}

/** Find which section the currently-open file belongs to. Returns
 *  the folderPath of the matching section, or null if no match. */
export function sectionPathFor(file: TFile | null, sections: NavSection[]): string | null {
  if (!file) return null;
  for (const s of sections) {
    if (s.pages.some(p => p.path === file.path)) return s.folderPath;
  }
  return null;
}
