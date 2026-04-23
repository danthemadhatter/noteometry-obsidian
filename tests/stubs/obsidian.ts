/**
 * Test-only stub for the "obsidian" package. Vitest swaps this in via an
 * alias in vitest.config.ts so unit tests that import from modules that
 * in turn import Obsidian can run under plain Node.
 *
 * Only the symbols the test code actually touches are implemented; the
 * rest are tiny placeholder classes/functions that exist for typechecks.
 */

export class Notice {
  constructor(_message?: string, _timeoutMs?: number) { /* no-op */ }
}

export class FileSystemAdapter {}

export class TFile {
  path = "";
  basename = "";
  extension = "";
  parent: TFolder | null = null;
}

export class TFolder {
  path = "";
  children: Array<TFile | TFolder> = [];
}

export class Plugin {}
export class PluginSettingTab {}
export class ItemView {}
export class FileView {}
export class Setting {
  constructor(_el: unknown) { return this; }
  setName() { return this; }
  setDesc() { return this; }
  addText() { return this; }
  addToggle() { return this; }
  addDropdown() { return this; }
}

// App / WorkspaceLeaf are consumed as types only by anything the tests reach.
export type App = unknown;
export type WorkspaceLeaf = unknown;
