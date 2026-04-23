import { FileView, TFile, WorkspaceLeaf } from "obsidian";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import NoteometryApp, { flushSave } from "./components/NoteometryApp";
import type { CanvasData } from "./lib/pageFormat";
import { loadPageFromFile, savePageToFile, EMPTY_PAGE } from "./lib/persistence";
import type NoteometryPlugin from "./main";

export const VIEW_TYPE = "noteometry-view";

/** Tier 3 native-explorer: NoteometryView is now a FileView, bound to a
 *  single .nmpage TFile. Obsidian's own file explorer is the page
 *  navigator. Each open page is its own tab.
 *
 *  We render a single React tree per view instance. When the bound file
 *  changes (Obsidian rebinds the same leaf to a different file), we feed
 *  the new initial CanvasData through a ref that NoteometryApp listens
 *  to, so we don't tear down and recreate the whole React tree.
 */
export class NoteometryView extends FileView {
  private root: Root | null = null;
  plugin: NoteometryPlugin;
  /** Latest decoded CanvasData for the bound file. Null while loading or
   *  when the file hasn't been decoded yet. */
  private currentData: CanvasData | null = null;
  /** Token that NoteometryApp reads via `initialDataToken` to re-hydrate
   *  when a new file is bound. */
  private dataToken = 0;
  /** Bridge functions the React tree assigns on mount so the view can
   *  push new initial data into it on subsequent file loads. */
  private reactSetInitialData:
    | ((data: CanvasData | null, token: number) => void)
    | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: NoteometryPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file?.basename ?? "Noteometry";
  }

  getIcon(): string {
    return "pencil";
  }

  /** Tell Obsidian we own the .nmpage extension. */
  canAcceptExtension(extension: string): boolean {
    return extension === "nmpage";
  }

  /** Called by Obsidian when the leaf's file changes — including the
   *  initial bind on open. Reads + decodes + hands off to React. */
  async onLoadFile(file: TFile): Promise<void> {
    const decoded = await loadPageFromFile(this.app, file);
    this.currentData = decoded ?? { ...EMPTY_PAGE };
    this.dataToken += 1;
    if (this.reactSetInitialData) {
      this.reactSetInitialData(this.currentData, this.dataToken);
    }
  }

  /** Flush any pending autosaves for the PREVIOUS file before Obsidian
   *  rebinds the leaf. */
  async onUnloadFile(_file: TFile): Promise<void> {
    if (flushSave) {
      try { await flushSave(); } catch { /* best effort */ }
    }
    this.currentData = null;
  }

  private async handleSaveData(data: CanvasData): Promise<void> {
    const f = this.file;
    if (!f) return;
    await savePageToFile(this.app, f, data);
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    if (!container) return;
    container.empty();
    container.addClass("noteometry-root");

    // Block swipe gestures from reaching Obsidian (kept from pre-refactor —
    // useful on iPad where two-finger swipes can steal the pen stream).
    const blockSwipe = (e: TouchEvent) => {
      e.stopPropagation();
    };
    container.addEventListener("touchstart", blockSwipe, false);
    container.addEventListener("touchmove", blockSwipe, false);
    container.addEventListener("touchend", blockSwipe, false);

    this.root = createRoot(container);
    this.root.render(
      React.createElement(NoteometryApp, {
        plugin: this.plugin,
        app: this.app,
        file: this.file ?? null,
        initialData: this.currentData,
        initialDataToken: this.dataToken,
        onSaveData: (data: CanvasData) => this.handleSaveData(data),
        registerInitialDataSetter: (
          setter: (data: CanvasData | null, token: number) => void,
        ) => {
          this.reactSetInitialData = setter;
        },
      })
    );
  }

  async onClose(): Promise<void> {
    if (flushSave) {
      try { await flushSave(); } catch { /* best effort */ }
    }
    this.reactSetInitialData = null;
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
