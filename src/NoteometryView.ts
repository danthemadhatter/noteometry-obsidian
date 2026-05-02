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
    // v1.8.5: combat-mode class mirrors the persisted setting so the
    // intensified chrome reads on next open without needing a manual
    // re-toggle. The settings tab updates the class live for already-
    // open views.
    if (this.plugin.settings.combatMode) {
      container.addClass("noteometry-combat-mode");
    }

    // ── Block swipe gestures from reaching Obsidian ──
    // Use BUBBLE phase — events still reach child elements normally,
    // but get stopped before they bubble up to Obsidian's gesture handlers.
    const blockSwipe = (e: TouchEvent) => {
      e.stopPropagation();
    };
    container.addEventListener("touchstart", blockSwipe, false);
    container.addEventListener("touchmove", blockSwipe, false);
    container.addEventListener("touchend", blockSwipe, false);

    // v1.7.4: do NOT auto-collapse Obsidian's left/right sidebars.
    // Pre-v1.7.4 we did, which made Noteometry feel like its own app
    // and hid the rest of the user's Obsidian setup. Now we leave the
    // sidebars in whatever state the user left them; the SidebarTree
    // header has explicit toggles to collapse / expand them on demand.

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
