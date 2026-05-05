import { FileView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import NoteometryApp from "./components/NoteometryApp";
import { AIActivityProvider } from "./features/aiActivity";
import { LayerManagerProvider } from "./features/layerManager";
import type { CanvasData } from "./lib/pageFormat";
import { packToV3, unpackFromV3, isV3Page } from "./lib/pageFormat";
import {
  loadPageFromFile,
  savePageToFile,
  EMPTY_PAGE,
  cachePageDataSync,
  getCachedPageData,
  clearPageCache,
} from "./lib/persistence";
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
  /** Per-view flush callback. NoteometryApp registers its own saveNow
   *  here so each tab flushes to its own bound file. */
  private flushMyTree: (() => Promise<void>) | null = null;
  /** v1.14.5: stable file reference for saves. Obsidian's FileView clears
   *  `this.file` between onUnloadFile and onClose, so handleSaveData
   *  needs a copy it controls. Set in onLoadFile, cleared AFTER the flush
   *  in onUnloadFile so the last save still has a target. */
  private lastFile: TFile | null = null;

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
    this.lastFile = file;
    let decoded = await loadPageFromFile(this.app, file);

    // v1.14.5: recover from emergency cache if a prior session's
    // vault.modify never completed (force reload, Obsidian quit, tab X
    // before async flush finished). The cache holds the exact v3 JSON
    // that was about to be written, keyed by file path.
    const cached = getCachedPageData(file.path);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (isV3Page(parsed)) {
          decoded = unpackFromV3(parsed);
          // Persist the recovery to disk right now so the cache is safe
          // to clear and the file reflects the recovered state.
          await savePageToFile(this.app, file, decoded);
          clearPageCache(file.path);
          new Notice(
            `Noteometry: Recovered unsaved changes for "${file.basename}" from previous session.`,
            6000,
          );
        } else {
          // Malformed cache — drop it so we don't loop.
          clearPageCache(file.path);
        }
      } catch {
        clearPageCache(file.path);
      }
    }

    this.currentData = decoded ?? { ...EMPTY_PAGE };
    this.dataToken += 1;
    if (this.reactSetInitialData) {
      this.reactSetInitialData(this.currentData, this.dataToken);
    }
    // Re-render so NoteometryApp sees the updated `file` prop. onOpen
    // often fires with this.file === null (new empty leaf), then
    // onLoadFile arrives with the real file; without re-rendering here,
    // drop-ins that key off the bound file (PDF insert, attachments)
    // think no page is open.
    this.rerenderReactTree();
  }

  /** Flush any pending autosaves for the PREVIOUS file before Obsidian
   *  rebinds the leaf. */
  async onUnloadFile(_file: TFile): Promise<void> {
    if (this.flushMyTree) {
      try { await this.flushMyTree(); } catch { /* best effort */ }
    }
    // Clear lastFile AFTER the flush so handleSaveData still had a
    // target while the async save was running.
    this.lastFile = null;
    this.currentData = null;
  }

  private async handleSaveData(data: CanvasData): Promise<void> {
    // v1.14.5: Obsidian's FileView nulls `this.file` between onUnloadFile
    // and onClose. Using lastFile as the primary source keeps saves
    // working across both lifecycle callbacks. Falls back to this.file
    // for the normal autosave path where lastFile is always populated.
    const f = this.lastFile ?? this.file;
    if (!f) return;
    // v1.14.5: synchronously cache the packed v3 BEFORE the async vault
    // write. If the window force-reloads or the tab is killed while
    // vault.modify is still in-flight, the next onLoadFile for this
    // file recovers from this cache. The cache is cleared after the
    // vault write resolves so normal saves leave no residue.
    try {
      const v3 = packToV3(data);
      cachePageDataSync(f.path, JSON.stringify(v3, null, 0));
    } catch { /* packing shouldn't throw, but don't block save if it does */ }

    await savePageToFile(this.app, f, data);
    clearPageCache(f.path);
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
    this.rerenderReactTree();
  }

  /** Single source of truth for rendering the React tree. Called from
   *  onOpen for the initial mount, and from onLoadFile whenever the
   *  bound file changes — React reconciles prop changes without
   *  tearing down the tree. */
  private rerenderReactTree(): void {
    if (!this.root) return;
    // v1.11.0 phase-0: AIActivityProvider wraps the entire app tree so any
    // drop-in (current and future) can ping begin/end on its AI calls and
    // observers like the upcoming AI activity ribbon can subscribe at the
    // app shell level. Provider is purely observation; cancellation stays
    // per-call-site (see features/aiActivity.tsx for the soft-abort note).
    //
    // v1.11.0 phase-1 sub-PR 1.2: LayerManagerProvider sits INSIDE
    // AIActivityProvider so the freeze gesture (phase-3) can read both —
    // freeze flips its own state AND iterates active AI tokens. Layer
    // chrome is no-op until the gesture hooks land in sub-PR 1.3.
    this.root.render(
      React.createElement(
        AIActivityProvider,
        null,
        React.createElement(
          LayerManagerProvider,
          null,
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
          registerFlushSave: (fn: (() => Promise<void>) | null) => {
            this.flushMyTree = fn;
          },
          }),
        ),
      )
    );
  }

  async onClose(): Promise<void> {
    if (this.flushMyTree) {
      try { await this.flushMyTree(); } catch { /* best effort */ }
    }
    this.reactSetInitialData = null;
    this.flushMyTree = null;
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
