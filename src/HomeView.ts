import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import Home from "./components/Home";
import type NoteometryPlugin from "./main";

export const HOME_VIEW_TYPE = "noteometry-home";

export class NoteometryHomeView extends ItemView {
  private root: Root | null = null;
  plugin: NoteometryPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: NoteometryPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return HOME_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Noteometry";
  }

  getIcon(): string {
    return "home";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    if (!container) return;
    container.empty();
    container.addClass("noteometry-home-root");
    this.root = createRoot(container);
    this.root.render(React.createElement(Home, { plugin: this.plugin }));
  }

  async onClose(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
