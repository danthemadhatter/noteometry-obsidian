import { Plugin, WorkspaceLeaf, TAbstractFile } from "obsidian";
import { NoteometryView, VIEW_TYPE } from "./NoteometryView";
import { NoteometrySettingTab } from "./settings";
import { NoteometrySettings, DEFAULT_SETTINGS } from "./types";

export default class NoteometryPlugin extends Plugin {
  settings: NoteometrySettings = { ...DEFAULT_SETTINGS };

  /**
   * Timestamp of the most recent write performed by this plugin. Used to
   * distinguish our own saves from external modifications (Obsidian Sync).
   * A 2-second window prevents reload loops — if a 'modify' event fires
   * within 2s of our last write, we assume it's our own echo.
   */
  lastWriteTs = 0;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new NoteometrySettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new NoteometryView(leaf, this)
    );

    this.addRibbonIcon("pencil", "Open Noteometry", () => this.activateView());

    this.addCommand({
      id: "open-noteometry",
      name: "Open Noteometry canvas",
      callback: () => this.activateView(),
    });

    // File watcher for Obsidian Sync — when another device syncs a page
    // file, detect the change and signal the React app to reload.
    this.registerEvent(
      this.app.vault.on("modify", (file: TAbstractFile) => {
        // Only care about .md files inside the Noteometry vault folder
        const root = this.settings.vaultFolder || "Noteometry";
        if (!file.path.startsWith(root + "/") || !file.path.endsWith(".md")) return;

        // Skip if we just wrote this file ourselves (within 2s window)
        if (Date.now() - this.lastWriteTs < 2000) return;

        // Dispatch a custom event so NoteometryApp can pick it up
        window.dispatchEvent(
          new CustomEvent("noteometry:file-changed", {
            detail: { path: file.path },
          })
        );
      })
    );

    // On layout ready, auto-open Noteometry and kill empty tabs
    this.app.workspace.onLayoutReady(() => {
      // Delay to let Obsidian finish restoring workspace
      setTimeout(() => this.ensureNoteometryOnly(), 300);
    });
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      // Find an empty leaf to replace, or create a new one
      let emptyLeaf: WorkspaceLeaf | null = null;
      workspace.iterateAllLeaves((l: WorkspaceLeaf) => {
        if (!emptyLeaf && l.view.getViewType() === "empty") {
          emptyLeaf = l;
        }
      });
      const target = emptyLeaf ?? workspace.getLeaf(false);
      if (!target) return;
      await target.setViewState({ type: VIEW_TYPE, active: true });
      leaf = target;
    }
    workspace.revealLeaf(leaf);
    // Kill leftover empties after a tick
    setTimeout(() => this.ensureNoteometryOnly(), 100);
  }

  /** Make sure Noteometry is the only thing in the main area */
  private async ensureNoteometryOnly() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE);

    if (existing.length === 0) {
      // No Noteometry leaf — find an empty one and convert it
      let emptyLeaf: WorkspaceLeaf | null = null;
      workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
        if (!emptyLeaf && leaf.view.getViewType() === "empty") {
          emptyLeaf = leaf;
        }
      });
      if (emptyLeaf) {
        await (emptyLeaf as WorkspaceLeaf).setViewState({ type: VIEW_TYPE, active: true });
      }
    }

    // Now kill ALL remaining empty leaves
    const empties: WorkspaceLeaf[] = [];
    workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
      if (leaf.view.getViewType() === "empty") {
        empties.push(leaf);
      }
    });
    for (const leaf of empties) {
      leaf.detach();
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
