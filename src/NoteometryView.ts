import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import NoteometryApp, { flushSave } from "./components/NoteometryApp";
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

    // ── Block swipe gestures from reaching Obsidian ──
    // Use BUBBLE phase — events still reach child elements normally,
    // but get stopped before they bubble up to Obsidian's gesture handlers.
    const blockSwipe = (e: TouchEvent) => {
      e.stopPropagation();
    };
    container.addEventListener("touchstart", blockSwipe, false);
    container.addEventListener("touchmove", blockSwipe, false);
    container.addEventListener("touchend", blockSwipe, false);

    // Also collapse sidebars on open
    try {
      (this.app.workspace as any).leftSplit?.collapse();
      (this.app.workspace as any).rightSplit?.collapse();
    } catch { /* ignore */ }

    this.root = createRoot(container);
    this.root.render(
      React.createElement(NoteometryApp, {
        plugin: this.plugin,
        app: this.app,
      })
    );
  }

  async onClose(): Promise<void> {
    // Flush any pending saves before unmounting
    if (flushSave) {
      try { await flushSave(); } catch { /* best effort */ }
    }
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
