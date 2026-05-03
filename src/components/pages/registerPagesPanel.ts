/**
 * v1.11.1 — Pages panel registration & helpers.
 *
 * The panel mounts as an Obsidian ItemView on the LEFT split (same
 * region as the file-explorer). Users can drag it to a different
 * split if they want; we just place it where their muscle memory
 * already expects "the navigator".
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import PagesPanel from "./PagesPanel";
import type NoteometryPlugin from "../../main";

export const PAGES_PANEL_VIEW_TYPE = "noteometry-pages-panel";

class NoteometryPagesPanelView extends ItemView {
  private root: Root | null = null;
  plugin: NoteometryPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: NoteometryPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return PAGES_PANEL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Noteometry pages";
  }

  getIcon(): string {
    return "folder-tree";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    if (!container) return;
    container.empty();
    container.addClass("noteometry-pages-root");
    this.root = createRoot(container);
    this.root.render(
      React.createElement(PagesPanel, { plugin: this.plugin }),
    );
  }

  async onClose(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

export function registerPagesPanelView(plugin: NoteometryPlugin): void {
  plugin.registerView(
    PAGES_PANEL_VIEW_TYPE,
    (leaf: WorkspaceLeaf) => new NoteometryPagesPanelView(leaf, plugin),
  );
}

/**
 * Open the pages panel on the LEFT split. If `reveal` is true, also
 * focus the leaf so the user sees it; if false, the panel attaches
 * silently (used by onLayoutReady so the side panel exists without
 * stealing focus from the canvas).
 */
export async function revealPagesPanel(
  plugin: NoteometryPlugin,
  reveal = true,
): Promise<void> {
  const ws = plugin.app.workspace;
  const existing = ws.getLeavesOfType(PAGES_PANEL_VIEW_TYPE)[0];
  if (existing) {
    if (reveal) void ws.revealLeaf(existing);
    return;
  }
  const leaf = ws.getLeftLeaf(false);
  if (!leaf) return;
  await leaf.setViewState({
    type: PAGES_PANEL_VIEW_TYPE,
    active: reveal,
  });
  if (reveal) void ws.revealLeaf(leaf);
}
