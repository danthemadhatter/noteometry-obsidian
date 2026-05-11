import { useCallback, useEffect, useMemo, useState } from "react";
import { App, EventRef, Notice, TFile, TFolder } from "obsidian";
import type NoteometryPlugin from "../../main";
import { rootDir, createNewPageFile } from "../../lib/persistence";
import { buildNav, sectionPathFor, NavPage, NavSection } from "../../lib/canvasNavTree";

/** v1.15.0: All nav state lives here so SectionTabsBar (horizontal,
 *  top) and PagesRail (vertical, right) share one source of truth.
 *  Replaces the v1.14.x CanvasNav slab. The presentational components
 *  are render-only; this hook owns selection, rename drafts, add/delete,
 *  and keyboard helpers. */

export type Renaming =
  | { kind: "section"; path: string; value: string }
  | { kind: "page"; path: string; value: string }
  | null;

export interface CanvasNavState {
  sections: NavSection[];
  activeSection: NavSection | null;
  activePagePath: string | null;
  focusedPagePath: string | null;
  setFocusedPagePath: (path: string | null) => void;
  selectSection: (path: string) => void;
  openFile: (file: TFile) => void;
  /** Inline draft input for new section. null = closed, "" = open empty. */
  newSectionDraft: string | null;
  openNewSection: () => void;
  setNewSectionDraft: (v: string) => void;
  commitNewSection: () => Promise<void>;
  cancelNewSection: () => void;
  addPage: () => Promise<void>;
  deleteSection: (section: NavSection) => Promise<void>;
  deletePage: (target: TFile) => Promise<void>;
  /** Inline rename state — used by both bar and rail. */
  renaming: Renaming;
  beginRenameSection: (section: NavSection) => void;
  beginRenamePage: (page: NavPage) => void;
  setRenameValue: (value: string) => void;
  commitRename: () => Promise<void>;
  cancelRename: () => void;
}

export function useCanvasNavState(
  app: App,
  plugin: NoteometryPlugin,
  file: TFile | null
): CanvasNavState {
  const [tick, setTick] = useState(0);
  const [selectedSectionPath, setSelectedSectionPath] = useState<string | null>(null);
  const [focusedPagePath, setFocusedPagePath] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Renaming>(null);
  const [newSectionDraft, setNewSectionDraftRaw] = useState<string | null>(null);

  const root = rootDir(plugin);
  const sections = useMemo<NavSection[]>(() => buildNav(app, root), [app, root, tick]);

  // Rebuild on vault structure changes. We don't react to "modify" —
  // per-stroke autosave would thrash render every 50ms while drawing.
  useEffect(() => {
    const refs: EventRef[] = [
      app.vault.on("create", () => setTick(n => n + 1)),
      app.vault.on("delete", () => setTick(n => n + 1)),
      app.vault.on("rename", () => setTick(n => n + 1)),
    ];
    return () => { for (const r of refs) app.vault.offref(r); };
  }, [app]);

  // Auto-select the section containing the open file on first mount,
  // but don't yank a user-chosen tab when they switch files manually.
  useEffect(() => {
    if (selectedSectionPath !== null) return;
    const auto = sectionPathFor(file, sections);
    if (auto) setSelectedSectionPath(auto);
    else if (sections[0]) setSelectedSectionPath(sections[0].folderPath);
  }, [file, sections, selectedSectionPath]);

  const activeSection = sections.find(s => s.folderPath === selectedSectionPath) ?? sections[0] ?? null;
  const activePagePath = file?.path ?? null;

  const selectSection = useCallback((path: string) => setSelectedSectionPath(path), []);

  const openFile = useCallback((target: TFile) => {
    void app.workspace.getLeaf(false).openFile(target);
  }, [app]);

  const openNewSection = useCallback(() => setNewSectionDraftRaw(""), []);
  const setNewSectionDraft = useCallback((v: string) => setNewSectionDraftRaw(v), []);
  const cancelNewSection = useCallback(() => setNewSectionDraftRaw(null), []);

  const commitNewSection = useCallback(async () => {
    if (newSectionDraft === null) return;
    const trimmed = newSectionDraft.trim();
    setNewSectionDraftRaw(null);
    if (!trimmed) return;
    const path = `${root.replace(/\/+$/, "")}/${trimmed}`;
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing) {
      new Notice(`Section "${trimmed}" already exists.`);
      if (existing instanceof TFolder) setSelectedSectionPath(path);
      return;
    }
    try {
      await app.vault.createFolder(path);
      setSelectedSectionPath(path);
      setTick(n => n + 1);
    } catch (err) {
      new Notice(`Couldn't create section: ${(err as Error).message ?? err}`);
    }
  }, [app, root, newSectionDraft]);

  const addPage = useCallback(async () => {
    const target = activeSection?.folderPath ?? root;
    const created = await createNewPageFile(app, target);
    if (created) {
      setSelectedSectionPath(activeSection?.folderPath ?? null);
      void app.workspace.getLeaf(false).openFile(created);
    }
  }, [app, activeSection, root]);

  const deleteSection = useCallback(async (section: NavSection) => {
    if (section.isRootBucket) {
      new Notice("Can't delete the root bucket — it's your Noteometry folder. Delete individual pages instead.");
      return;
    }
    if (!confirm(`Delete section "${section.name}" and all ${section.pages.length} page${section.pages.length === 1 ? "" : "s"} inside it? This cannot be undone except via Obsidian's trash.`)) return;
    const folder = app.vault.getAbstractFileByPath(section.folderPath);
    if (folder instanceof TFolder) {
      try {
        await app.vault.trash(folder, true);
        if (selectedSectionPath === section.folderPath) setSelectedSectionPath(null);
        setTick(n => n + 1);
      } catch (err) {
        new Notice(`Couldn't delete section: ${(err as Error).message ?? err}`);
      }
    }
  }, [app, selectedSectionPath]);

  const deletePage = useCallback(async (target: TFile) => {
    if (!confirm(`Delete page "${target.basename}"? This cannot be undone except via Obsidian's trash.`)) return;
    try {
      await app.vault.trash(target, true);
      setTick(n => n + 1);
    } catch (err) {
      new Notice(`Couldn't delete page: ${(err as Error).message ?? err}`);
    }
  }, [app]);

  const beginRenameSection = useCallback((section: NavSection) => {
    if (section.isRootBucket) {
      new Notice("Can't rename the root bucket from here — it reflects your Noteometry folder. Change it in Settings → Vault folder.");
      return;
    }
    setRenaming({ kind: "section", path: section.folderPath, value: section.name });
  }, []);

  const beginRenamePage = useCallback((page: NavPage) => {
    setRenaming({ kind: "page", path: page.path, value: page.label });
  }, []);

  const setRenameValue = useCallback((value: string) => {
    setRenaming(prev => (prev ? { ...prev, value } : prev));
  }, []);

  const cancelRename = useCallback(() => setRenaming(null), []);

  const commitRename = useCallback(async () => {
    if (!renaming) return;
    const next = renaming.value.trim();
    setRenaming(null);
    if (!next) return;
    const target = app.vault.getAbstractFileByPath(renaming.path);
    if (!target) return;
    const parent = target.parent?.path ?? "";
    const newPath = renaming.kind === "page"
      ? (parent ? `${parent}/${next}.nmpage` : `${next}.nmpage`)
      : (parent ? `${parent}/${next}` : next);
    if (newPath === renaming.path) return;
    try {
      await app.fileManager.renameFile(target, newPath);
      setTick(n => n + 1);
    } catch (err) {
      new Notice(`Couldn't rename: ${(err as Error).message ?? err}`);
    }
  }, [app, renaming]);

  return {
    sections,
    activeSection,
    activePagePath,
    focusedPagePath,
    setFocusedPagePath,
    selectSection,
    openFile,
    newSectionDraft,
    openNewSection,
    setNewSectionDraft,
    commitNewSection,
    cancelNewSection,
    addPage,
    deleteSection,
    deletePage,
    renaming,
    beginRenameSection,
    beginRenamePage,
    setRenameValue,
    commitRename,
    cancelRename,
  };
}

/** v1.15.0: Stable color hash for a section folder path. Mirrors
 *  OneNote's per-section tab color — same section path always
 *  produces the same hue, so users learn "blue tab = ELEN201". */
const SECTION_HUES = [205, 145, 35, 285, 0, 175, 50, 320, 100, 250];
export function sectionHue(folderPath: string): number {
  let h = 0;
  for (let i = 0; i < folderPath.length; i++) h = (h * 31 + folderPath.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % SECTION_HUES.length;
  return SECTION_HUES[idx]!;
}
