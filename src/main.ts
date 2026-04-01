import { Plugin, WorkspaceLeaf } from "obsidian";
import { NoteometryView, VIEW_TYPE } from "./NoteometryView";
import { NoteometrySettingTab } from "./settings";
import { NoteometrySettings, DEFAULT_SETTINGS } from "./types";

export default class NoteometryPlugin extends Plugin {
  settings: NoteometrySettings = { ...DEFAULT_SETTINGS };

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

    // On layout ready, auto-open Noteometry into any empty leaf
    this.app.workspace.onLayoutReady(() => {
      const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
      if (existing.length > 0) {
        // Already open — just clean up empties
        this.cleanupEmptyLeaves();
        return;
      }
      // Find the empty "New tab" leaf and convert it to Noteometry
      let emptyLeaf: WorkspaceLeaf | null = null;
      this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
        if (!emptyLeaf && leaf.view.getViewType() === "empty") {
          emptyLeaf = leaf;
        }
      });
      if (emptyLeaf) {
        (emptyLeaf as WorkspaceLeaf).setViewState({ type: VIEW_TYPE, active: true });
      }
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
    this.cleanupEmptyLeaves();
  }

  private cleanupEmptyLeaves() {
    const leaves: WorkspaceLeaf[] = [];
    this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
      if (leaf.view.getViewType() === "empty") {
        leaves.push(leaf);
      }
    });
    for (const leaf of leaves) {
      leaf.detach();
    }
  }

  async loadSettings() {
    const data = (await this.loadData()) ?? {};
    this.settings = { ...DEFAULT_SETTINGS, ...data };
  }

  async saveSettings() {
    await this.saveData({ ...this.settings });
  }
}
