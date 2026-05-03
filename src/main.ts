import { Notice, Plugin, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import { NoteometryView, VIEW_TYPE } from "./NoteometryView";
import { NoteometryHomeView, HOME_VIEW_TYPE } from "./HomeView";
import { NoteometrySettingTab } from "./settings";
import { NoteometrySettings, DEFAULT_SETTINGS } from "./types";
import { logVersionBanner } from "./lib/version";
import {
  createNewPageFile,
  convertLegacyMdPagesToNmpage,
  findLegacyMdPages,
  rootDir,
} from "./lib/persistence";
import { getMostRecentNmpage } from "./lib/recentPages";
import {
  registerPagesPanelView,
  PAGES_PANEL_VIEW_TYPE,
  revealPagesPanel,
} from "./components/pages/registerPagesPanel";
import { applyGlobalTheme, removeGlobalTheme } from "./lib/globalTheme";

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

    this.registerView(
      HOME_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new NoteometryHomeView(leaf, this)
    );

    this.registerExtensions(["nmpage"], VIEW_TYPE);

    this.addRibbonIcon("pencil", "New Noteometry page", () => {
      void this.createAndOpenNewPage();
    });
    this.addRibbonIcon("home", "Noteometry home", () => {
      void this.openHome();
    });

    this.addCommand({
      id: "noteometry-new-page",
      name: "Noteometry: New page",
      callback: () => this.createAndOpenNewPage(),
    });

    this.addCommand({
      id: "noteometry-open-home",
      name: "Noteometry: Open home",
      callback: () => this.openHome(),
    });

    this.addCommand({
      id: "noteometry-convert-legacy-md",
      name: "Noteometry: Convert legacy .md pages to .nmpage",
      callback: () => this.runConvertLegacyCommand(),
    });

    // v1.11.1: register the new Pages panel view (custom file tree).
    registerPagesPanelView(this);

    // v1.11.1: "Open Pages panel" command + ribbon icon.
    this.addRibbonIcon("folder-tree", "Noteometry pages", () => {
      void revealPagesPanel(this);
    });
    this.addCommand({
      id: "noteometry-open-pages-panel",
      name: "Noteometry: Open pages panel",
      callback: () => void revealPagesPanel(this),
    });

    // v1.11.1: apply global theme if enabled.
    if (this.settings.globalThemeEnabled) {
      applyGlobalTheme();
    }

    this.app.workspace.onLayoutReady(() => {
      this.detachStaleNoteometryLeaves();
      // v1.11.3 Bug A cleanup: prior versions could land the canvas view
      // in the left sidebar (via revealPagesPanel displacing the file
      // explorer, or via getLeaf(false) when workspace.json restored a
      // blank leaf there). Once saved to workspace.json that state
      // persists. Relocate those leaves to the main editor area so the
      // sidebar goes back to the file explorer / pages panel.
      this.relocateNoteometryLeavesOutOfSidebar();
      void this.notifyIfLegacyPagesPresent();
      this.handleLaunchOpen();
      // v1.11.1: open the pages panel by default (left split, collapsed).
      if (this.settings.pagesPanelEnabled) {
        void revealPagesPanel(this, /*reveal*/ false);
      }
    });
  }

  onunload() {
    // v1.11.1: clean up global theme injection so toggling the plugin
    // off restores Obsidian's normal appearance.
    removeGlobalTheme();
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

  async openHome(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(HOME_VIEW_TYPE)[0];
    if (existing) {
      void this.app.workspace.revealLeaf(existing);
      return;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: HOME_VIEW_TYPE, active: true });
  }

  /** v1.11.1: replaces maybeAutoOpenHome. New default behavior:
   *    - if a Noteometry tab is already open (workspace.json restore),
   *      do nothing.
   *    - if homeViewOnLaunch === true, open the Home view (legacy).
   *    - else open the most-recently-edited .nmpage directly.
   *    - if there are no .nmpage files at all, do nothing (don't
   *      ambush a fresh vault).
   *
   *  Why the default flip: the user said "the opening file thing is
   *  stupid". The Home view added an extra tap to the most common
   *  intention (resume the page I was just on). We satisfy the
   *  intention directly; users who want the menu can re-enable it. */
  private handleLaunchOpen(): void {
    const hasPageTab = this.app.workspace.getLeavesOfType(VIEW_TYPE).length > 0;
    const hasHomeTab = this.app.workspace.getLeavesOfType(HOME_VIEW_TYPE).length > 0;
    if (hasPageTab || hasHomeTab) return;

    const root = rootDir(this);
    const mostRecent = getMostRecentNmpage(this.app, root);
    if (!mostRecent) return; // empty vault — don't ambush

    if (this.settings.homeViewOnLaunch) {
      void this.openHome();
      return;
    }

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
   *  opening canvas pages inside a narrow sidebar pane. */
  private isLeafInSidebar(leaf: WorkspaceLeaf): boolean {
    const ws = this.app.workspace as unknown as {
      leftSplit?: { containsLeaf?: (l: WorkspaceLeaf) => boolean } | null;
      rightSplit?: { containsLeaf?: (l: WorkspaceLeaf) => boolean } | null;
      rootSplit?: { containsLeaf?: (l: WorkspaceLeaf) => boolean } | null;
    };
    // Prefer the explicit containsLeaf check when Obsidian exposes it.
    if (ws.leftSplit?.containsLeaf?.(leaf)) return true;
    if (ws.rightSplit?.containsLeaf?.(leaf)) return true;
    // Fallback: walk up the leaf's parents and look for the sidebar
    // split classes Obsidian uses on the parent containers. This
    // survives Obsidian internals churn since `containsLeaf` is
    // technically private API.
    let node: { parent?: unknown; containerEl?: HTMLElement } | null =
      leaf as unknown as { parent?: unknown; containerEl?: HTMLElement };
    while (node) {
      const el = (node as { containerEl?: HTMLElement }).containerEl;
      if (el?.closest(".mod-left-split, .mod-right-split")) return true;
      node = (node as { parent?: typeof node }).parent ?? null;
    }
    return false;
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

  /** Tier 3 workspace restoration: the old plugin used a singleton
   *  ItemView, so saved workspace.json may have noteometry-view leaves
   *  that Obsidian restores without a bound file. A FileView without a
   *  file is a broken empty tab — detach them. */
  private detachStaleNoteometryLeaves(): void {
    const stale: WorkspaceLeaf[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view.getViewType() !== VIEW_TYPE) return;
      const view = leaf.view as { file?: TFile | null };
      if (!view.file) stale.push(leaf);
    });
    for (const leaf of stale) leaf.detach();
  }

  /** v1.11.3: if any canvas (noteometry-view or noteometry-home) leaf
   *  ended up in the left or right sidebar in a prior session, detach
   *  it and reopen the file in a fresh main-area tab. The sidebar pane
   *  is too narrow for canvas work and this is never what the user
   *  intended — it's always the result of a plugin bug (fixed in this
   *  release) or a workspace.json restore chain. */
  private relocateNoteometryLeavesOutOfSidebar(): void {
    const toRelocate: { leaf: WorkspaceLeaf; file: TFile | null; type: string }[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const type = leaf.view.getViewType();
      if (type !== VIEW_TYPE && type !== HOME_VIEW_TYPE) return;
      if (!this.isLeafInSidebar(leaf)) return;
      const view = leaf.view as { file?: TFile | null };
      toRelocate.push({ leaf, file: view.file ?? null, type });
    });
    for (const { leaf, file, type } of toRelocate) {
      leaf.detach();
      if (type === VIEW_TYPE && file) {
        void this.app.workspace.getLeaf("tab").openFile(file);
      } else if (type === HOME_VIEW_TYPE) {
        void this.app.workspace.getLeaf("tab").setViewState({
          type: HOME_VIEW_TYPE,
          active: true,
        });
      }
    }
  }

  /** On load, if the vault still has legacy .md pages containing
   *  Noteometry-page JSON, tell the user — otherwise they see an empty
   *  plugin and assume it's broken. Non-blocking, no auto-rename. */
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
    // Allow-list: only keys that exist in DEFAULT_SETTINGS survive. Unknown
    // fields (stale migrations, old plugin iterations) are dropped on next save.
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
