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
    const data = (await this.loadData()) ?? {};
    this.settings = { ...DEFAULT_SETTINGS, ...data };
  }

  async saveSettings() {
    await this.saveData({ ...this.settings });
  }
}
