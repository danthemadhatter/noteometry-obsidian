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
      // v1.11.3+1.11.4: rescue any canvas leaves stuck in the sidebar
      // from prior buggy sessions, then restore the file explorer if
      // it was displaced by the pages panel before the v1.11.3 fix.
      this.relocateNoteometryLeavesOutOfSidebar();
      // v1.11.5: aggressive cleanup of accumulated junk leaves.
      // Multiple plugin reloads through v1.11.1–v1.11.4 stacked extra
      // pages-panel leaves and a dead "Plugin no longer active"
      // file-explorer leaf in workspace.json. Detach duplicates and
      // empty-view leaves in the sidebar before doing anything else.
      this.detachDuplicatePagesPanelLeaves();
      this.detachDeadEmptyLeavesInSidebar();
      void this.ensureFileExplorerVisible();
      void this.notifyIfLegacyPagesPresent();
      this.handleLaunchOpen();
      // v1.11.1: open the pages panel by default (left split, collapsed).
      // v1.11.5: only reveal IF none exists yet — the de-dup check
      // inside revealPagesPanel does this too, but we keep it explicit
      // here so the auto-reveal stops adding leaves once we have one.
      if (this.settings.pagesPanelEnabled) {
        const existing = this.app.workspace.getLeavesOfType(
          PAGES_PANEL_VIEW_TYPE,
        );
        if (existing.length === 0) {
          void revealPagesPanel(this, /*reveal*/ false);
        }
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
   *  opening canvas pages inside a narrow sidebar pane.
   *
   *  v1.11.4: previous version used `leftSplit.containsLeaf()` which
   *  isn't a real Obsidian API in current builds, so the check always
   *  returned false and sidebar leaves slipped through. The reliable
   *  signal is `leaf.getRoot()` — every leaf reports its split root,
   *  and we compare against the three known roots. The DOM-walk
   *  fallback stays as belt-and-braces for headless Obsidian versions
   *  where getRoot() may be missing. */
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
      // If we know rootSplit and the leaf's root matches, it's in the
      // main area — trust that and short-circuit the DOM walk.
      if (ws.rootSplit && root === ws.rootSplit) return false;
    }
    // DOM fallback: walk up from the leaf's container element looking
    // for Obsidian's sidebar split class. This survives churn in the
    // workspace internals since the class names have been stable.
    const containerEl = (leaf as unknown as { containerEl?: HTMLElement })
      .containerEl;
    if (containerEl?.closest?.(".mod-left-split, .mod-right-split")) {
      return true;
    }
    return false;
  }

  /** v1.11.5: detach extra pages-panel leaves so at most ONE remains.
   *  Multiple plugin reloads through v1.11.1–1.11.4 stacked duplicates
   *  in the sidebar (every onLayoutReady created another one because
   *  the de-dup check raced with workspace.json restore). Keep the
   *  first leaf so the user's chosen position is preserved; drop the
   *  rest. */
  private detachDuplicatePagesPanelLeaves(): void {
    const leaves = this.app.workspace.getLeavesOfType(
      PAGES_PANEL_VIEW_TYPE,
    );
    // Keep [0], detach [1..n].
    for (let i = 1; i < leaves.length; i++) {
      leaves[i]!.detach();
    }
  }

  /** v1.11.5: detach "Plugin no longer active" / empty-view leaves
   *  that v1.11.4's manual file-explorer creation accidentally left
   *  behind. setViewState({ type: "file-explorer" }) on a fresh leaf
   *  in the left split, before the file-explorer core plugin had
   *  registered its view type, produced an orphan leaf that Obsidian
   *  paints as the "Plugin no longer active" placeholder. We detect
   *  these leaves by view type — "empty" is what Obsidian uses for
   *  any leaf whose view type isn't registered. We only touch leaves
   *  in the SIDEBAR; empty leaves in the main area are normal (e.g.
   *  the New Tab page) and must be left alone. */
  private detachDeadEmptyLeavesInSidebar(): void {
    const dead: WorkspaceLeaf[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const type = leaf.view.getViewType();
      // "empty" is Obsidian's fallback for unregistered/missing view
      // types AND for the New Tab page — hence the sidebar guard.
      if (type !== "empty") return;
      if (!this.isLeafInSidebar(leaf)) return;
      dead.push(leaf);
    });
    for (const leaf of dead) leaf.detach();
  }

  /** v1.11.4 (rewritten in v1.11.5): restore Obsidian's file-explorer
   *  leaf if no file-explorer view is currently mounted.
   *
   *  v1.11.4 originally tried `setViewState({ type: "file-explorer" })`
   *  on a fresh leaf as a fallback when the `file-explorer:open` command
   *  wasn't available. That produced "Plugin no longer active" orphan
   *  leaves because Obsidian only mounts the file-explorer view through
   *  its core-plugin lifecycle, not through `setViewState` on an
   *  arbitrary leaf. v1.11.5 drops the manual fallback entirely — the
   *  only safe path is the command. If the command isn't registered
   *  (the user disabled the file-explorer core plugin), we leave it
   *  alone; users who deliberately disabled it don't want us re-enabling
   *  it on their behalf. */
  private async ensureFileExplorerVisible(): Promise<void> {
    const ws = this.app.workspace;
    const existing = ws.getLeavesOfType("file-explorer");
    if (existing.length > 0) return;
    const cmd = (this.app as unknown as {
      commands?: { executeCommandById?: (id: string) => boolean };
    }).commands;
    cmd?.executeCommandById?.("file-explorer:open");
    // Intentionally no fallback. See doc comment above.
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
