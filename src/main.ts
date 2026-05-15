import { Notice, Plugin, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import { NoteometryView, VIEW_TYPE } from "./NoteometryView";
import { NoteometrySettingTab } from "./settings";
import { NoteometrySettings, DEFAULT_SETTINGS } from "./types";
import { logVersionBanner } from "./lib/version";
import {
  createNewPageFile,
  convertLegacyMdPagesToNmpage,
  findLegacyMdPages,
  duplicateFolder,
  rootDir,
} from "./lib/persistence";
import { getMostRecentNmpage } from "./lib/recentPages";
import { applyGlobalTheme, removeGlobalTheme } from "./lib/globalTheme";

/** v1.14.10: HomeView scrapped. The house-icon "wonder" was
 *  out-of-sight/out-of-mind — Dan never opened it, thirty revisions
 *  proved it, and the v1.14.9 on-canvas CanvasNav replaces every job
 *  Home was supposed to do (see Resume / Recents / New page). Legacy
 *  workspace.json entries from old sessions still list a
 *  noteometry-home leaf though, so Obsidian will restore a
 *  "Plugin no longer active" ghost tab unless we sweep on onLayoutReady.
 *  That sweep is sweepLegacyHomeLeaves() below. */
const LEGACY_HOME_VIEW_TYPE = "noteometry-home";

export default class NoteometryPlugin extends Plugin {
  settings: NoteometrySettings = { ...DEFAULT_SETTINGS };

  async onload() {
    logVersionBanner();
    await this.loadSettings();
    this.addSettingTab(new NoteometrySettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new NoteometryView(leaf, this)
    );

    this.registerExtensions(["nmpage"], VIEW_TYPE);

    this.addRibbonIcon("pencil", "New Noteometry page", () => {
      void this.createAndOpenNewPage();
    });

    this.addCommand({
      id: "noteometry-new-page",
      name: "Noteometry: New page",
      callback: () => this.createAndOpenNewPage(),
    });

    this.addCommand({
      id: "noteometry-convert-legacy-md",
      name: "Noteometry: Convert legacy .md pages to .nmpage",
      callback: () => this.runConvertLegacyCommand(),
    });

    // v1.16.3: copy/paste an entire folder hierarchy so a user can reuse
    // a semester scaffold (e.g. a 16-week course skeleton) without
    // recreating sections by hand. Default source is the section
    // containing the active page; default destination name is "<name> Copy".
    this.addCommand({
      id: "noteometry-duplicate-section",
      name: "Noteometry: Duplicate section (folder) and its pages",
      callback: () => this.runDuplicateSectionCommand(),
    });

    // v1.11.1: apply global theme if enabled.
    if (this.settings.globalThemeEnabled) {
      applyGlobalTheme();
    }

    // v1.16.0: scoped CAD treatment lives behind a body class so the
    // styles.css block stays a single :where() opt-in instead of
    // duplicating every rule. Removed on unload below.
    if (this.settings.terminalCadTheme) {
      document.body.classList.add("nm-terminal-cad");
    }

    this.app.workspace.onLayoutReady(() => {
      this.detachStaleNoteometryLeaves();
      // v1.11.3+1.11.4: rescue any canvas leaves stuck in the sidebar
      // from prior buggy sessions.
      this.relocateNoteometryLeavesOutOfSidebar();
      // v1.12.0: sweep historical noteometry-pages-panel leaves.
      this.detachLegacyPagesPanelLeaves();
      // v1.14.10: sweep historical noteometry-home leaves.
      this.sweepLegacyHomeLeaves();
      this.detachDeadEmptyLeavesInSidebar();
      void this.ensureFileExplorerVisible();
      void this.notifyIfLegacyPagesPresent();
      this.handleLaunchOpen();
    });
  }

  onunload() {
    // v1.11.1: clean up global theme injection so toggling the plugin
    // off restores Obsidian's normal appearance.
    removeGlobalTheme();
    // v1.16.0: drop the CAD body class so disabling the plugin leaves
    // Obsidian visually pristine.
    document.body.classList.remove("nm-terminal-cad");
  }

  private resolveNewPageParentFolder(): string {
    const active = this.app.workspace.getActiveFile();
    if (active && active.parent instanceof TFolder) {
      return active.parent.path;
    }
    return rootDir(this);
  }

  async createAndOpenNewPage(): Promise<void> {
    const parent = this.resolveNewPageParentFolder();
    const file = await createNewPageFile(this.app, parent);
    if (!file) return;
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
  }

  /** v1.14.10: launch behavior simplified. Home view is gone, so the
   *  only two states are:
   *    - if a Noteometry page tab is already restored by workspace.json,
   *      do nothing (don't stack a second one).
   *    - else open the most-recently-edited .nmpage directly.
   *    - if there are no .nmpage files at all, do nothing (don't
   *      ambush a fresh vault — the CanvasNav will render empty and
   *      Dan can create a section + page from there). */
  private handleLaunchOpen(): void {
    const hasPageTab = this.app.workspace.getLeavesOfType(VIEW_TYPE).length > 0;
    if (hasPageTab) return;

    const root = rootDir(this);
    const mostRecent = getMostRecentNmpage(this.app, root);
    if (!mostRecent) return; // empty vault — don't ambush

    // Open the most-recent page directly. getLeaf(false) reuses an
    // existing empty leaf when possible; if Obsidian restored a blank
    // tab, we land in it instead of stacking a second one.
    //
    // v1.11.3 Bug C fix: workspace.json from a prior session can place
    // an empty noteometry-view leaf in the left or right sidebar. When
    // that happens, getLeaf(false) returns the sidebar leaf and the
    // canvas opens inside the narrow sidebar pane instead of the main
    // editor area. Detect that case and force a new tab in the main
    // (root) split.
    const leaf = this.app.workspace.getLeaf(false);
    if (this.isLeafInSidebar(leaf)) {
      void this.app.workspace.getLeaf("tab").openFile(mostRecent);
      return;
    }
    void leaf.openFile(mostRecent);
  }

  /** Return true when `leaf` lives in the left or right sidebar split
   *  (i.e. NOT in the main editor area / rootSplit). Used to avoid
   *  opening canvas pages inside a narrow sidebar pane.
   *
   *  v1.11.4: previous version used `leftSplit.containsLeaf()` which
   *  isn't a real Obsidian API; the reliable signal is `leaf.getRoot()`.
   *  DOM-class fallback (.mod-left-split / .mod-right-split) stays for
   *  headless Obsidian builds where getRoot() may be missing. */
  private isLeafInSidebar(leaf: WorkspaceLeaf): boolean {
    const ws = this.app.workspace as unknown as {
      leftSplit?: unknown;
      rightSplit?: unknown;
      rootSplit?: unknown;
    };
    const leafWithRoot = leaf as unknown as { getRoot?: () => unknown };
    const root = leafWithRoot.getRoot?.();
    if (root) {
      if (root === ws.leftSplit) return true;
      if (root === ws.rightSplit) return true;
      if (ws.rootSplit && root === ws.rootSplit) return false;
    }
    const containerEl = (leaf as unknown as { containerEl?: HTMLElement })
      .containerEl;
    if (containerEl?.closest?.(".mod-left-split, .mod-right-split")) {
      return true;
    }
    return false;
  }

  /** v1.12.0: detach every leftover noteometry-pages-panel leaf from
   *  the v1.11.x cycle. Idempotent — once the leaves are gone,
   *  subsequent calls find nothing and no-op. */
  private detachLegacyPagesPanelLeaves(): void {
    const LEGACY_PANEL_VIEW_TYPE = "noteometry-pages-panel";
    const leaves = this.app.workspace.getLeavesOfType(
      LEGACY_PANEL_VIEW_TYPE,
    );
    for (const leaf of leaves) leaf.detach();
  }

  /** v1.14.10: sweep any historical noteometry-home leaves. The view
   *  type is no longer registered, so restored leaves paint as the
   *  "Plugin no longer active" placeholder — which is exactly the
   *  always-open tab Dan flagged. Detaching them on layout-ready
   *  removes the ghost permanently; workspace.json won't serialize a
   *  detached leaf, so the sweep is a one-time cost per upgrade. */
  private sweepLegacyHomeLeaves(): void {
    const leaves = this.app.workspace.getLeavesOfType(LEGACY_HOME_VIEW_TYPE);
    for (const leaf of leaves) leaf.detach();
  }

  /** v1.11.5: detach "Plugin no longer active" / empty-view leaves
   *  in the sidebar. Main-area empty leaves (e.g. the New Tab page)
   *  are left alone. */
  private detachDeadEmptyLeavesInSidebar(): void {
    const dead: WorkspaceLeaf[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const type = leaf.view.getViewType();
      if (type !== "empty") return;
      if (!this.isLeafInSidebar(leaf)) return;
      dead.push(leaf);
    });
    for (const leaf of dead) leaf.detach();
  }

  /** v1.11.4 (rewritten in v1.11.5): restore Obsidian's file-explorer
   *  leaf if no file-explorer view is currently mounted. */
  private async ensureFileExplorerVisible(): Promise<void> {
    const ws = this.app.workspace;
    const existing = ws.getLeavesOfType("file-explorer");
    if (existing.length > 0) return;
    const cmd = (this.app as unknown as {
      commands?: { executeCommandById?: (id: string) => boolean };
    }).commands;
    cmd?.executeCommandById?.("file-explorer:open");
  }

  /** v1.16.3: duplicate a section (a folder under the Noteometry root).
   *  All .nmpage files are copied with fresh attachment IDs so editing
   *  the copy never mutates the original's PDFs or images. Default
   *  source = the section containing the active page; default name =
   *  "<source> Copy". Uses `window.prompt` for the destination name —
   *  same affordance the rest of the plugin uses for one-shot text
   *  input. */
  private async runDuplicateSectionCommand(): Promise<void> {
    const active = this.app.workspace.getActiveFile();
    let sourceFolder: TFolder | null = null;

    // Walk up from the active file until we hit a folder directly under
    // the Noteometry root — that's the "section" the user thinks of as
    // a course folder. If no Noteometry page is open, fall back to the
    // root folder so users can duplicate the entire Noteometry tree.
    const root = rootDir(this).replace(/\/+$/, "");
    if (active) {
      let cursor: TFolder | null = active.parent;
      while (cursor) {
        const parentPath = cursor.parent?.path ?? "";
        if (parentPath.replace(/\/+$/, "") === root) {
          sourceFolder = cursor;
          break;
        }
        cursor = cursor.parent;
      }
    }
    if (!sourceFolder) {
      const rootAbstract = this.app.vault.getAbstractFileByPath(root);
      if (rootAbstract instanceof TFolder) {
        // Use the first immediate sub-folder as a hint; if there is none,
        // bail with a clear message rather than copying the whole root.
        const firstChild = rootAbstract.children.find(c => c instanceof TFolder) as TFolder | undefined;
        if (firstChild) {
          sourceFolder = firstChild;
        }
      }
    }
    if (!sourceFolder) {
      new Notice("Noteometry: open a page inside a section first, or create a section to duplicate.", 8000);
      return;
    }

    const suggested = `${sourceFolder.name} Copy`;
    const destName = window.prompt(
      `Duplicate "${sourceFolder.name}" — what should the new section be named?`,
      suggested,
    );
    if (!destName || !destName.trim()) return;

    const parentPath = sourceFolder.parent?.path ?? "";
    try {
      const res = await duplicateFolder(this.app, sourceFolder, parentPath, destName.trim());
      new Notice(
        `Noteometry: duplicated "${sourceFolder.name}" → "${res.destinationPath}" ` +
        `(${res.pages} page${res.pages === 1 ? "" : "s"}, ${res.attachments} attachment${res.attachments === 1 ? "" : "s"}).`,
        8000,
      );
    } catch (e) {
      console.error("[Noteometry] duplicate section failed:", e);
      new Notice(`Couldn't duplicate section: ${(e as Error).message ?? e}`, 10000);
    }
  }

  private async runConvertLegacyCommand(): Promise<void> {
    const root = rootDir(this);
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(root))) {
      new Notice(`Noteometry: folder "${root}" doesn't exist — nothing to convert.`, 6000);
      return;
    }
    const { converted, collisions } = await convertLegacyMdPagesToNmpage(this.app, root);
    if (converted === 0) {
      new Notice("Noteometry: no legacy .md pages found.", 5000);
      return;
    }
    const base = `Noteometry: converted ${converted} .md page${converted === 1 ? "" : "s"} to .nmpage`;
    const suffix = collisions > 0
      ? ` (${collisions} renamed with a numeric suffix to avoid collision with existing .nmpage files)`
      : "";
    new Notice(`${base}${suffix}.`, 6000);
  }

  /** Tier 3 workspace restoration: detach any noteometry-view leaves
   *  that Obsidian restored without a bound file. */
  private detachStaleNoteometryLeaves(): void {
    const stale: WorkspaceLeaf[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view.getViewType() !== VIEW_TYPE) return;
      const view = leaf.view as { file?: TFile | null };
      if (!view.file) stale.push(leaf);
    });
    for (const leaf of stale) leaf.detach();
  }

  /** v1.11.3: if any canvas leaf ended up in the left or right sidebar
   *  in a prior session, detach it and reopen the file in a fresh
   *  main-area tab. */
  private relocateNoteometryLeavesOutOfSidebar(): void {
    const toRelocate: { leaf: WorkspaceLeaf; file: TFile | null }[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const type = leaf.view.getViewType();
      if (type !== VIEW_TYPE) return;
      if (!this.isLeafInSidebar(leaf)) return;
      const view = leaf.view as { file?: TFile | null };
      toRelocate.push({ leaf, file: view.file ?? null });
    });
    for (const { leaf, file } of toRelocate) {
      leaf.detach();
      if (file) {
        void this.app.workspace.getLeaf("tab").openFile(file);
      }
    }
  }

  /** On load, if the vault still has legacy .md pages containing
   *  Noteometry-page JSON, tell the user. */
  private async notifyIfLegacyPagesPresent(): Promise<void> {
    const root = rootDir(this);
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(root))) return;
    try {
      const legacy = await findLegacyMdPages(this.app, root);
      if (legacy.length === 0) return;
      const msg =
        `Noteometry: ${legacy.length} legacy .md page${legacy.length === 1 ? "" : "s"} found. ` +
        `Run "Noteometry: Convert legacy .md pages to .nmpage" from the command palette to migrate.`;
      new Notice(msg, 12000);
    } catch (e) {
      console.error("[Noteometry] legacy scan failed:", e);
    }
  }

  async loadSettings() {
    const data = ((await this.loadData()) ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (key in data) {
        next[key] = data[key];
      }
    }
    this.settings = next as unknown as NoteometrySettings;
  }

  async saveSettings() {
    await this.saveData({ ...this.settings });
  }
}
