import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import NoteometryApp from "./components/NoteometryApp";
import type NoteometryPlugin from "./main";

export const VIEW_TYPE = "noteometry-view";

export class NoteometryView extends ItemView {
  private root: Root | null = null;
  plugin: NoteometryPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: NoteometryPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Noteometry";
  }

  getIcon(): string {
    return "pencil";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    if (!container) return;
    container.empty();
    container.addClass("noteometry-root");
    this.root = createRoot(container);
    this.root.render(
      React.createElement(NoteometryApp, {
        plugin: this.plugin,
        app: this.app,
      })
    );
  }

  async onClose(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
