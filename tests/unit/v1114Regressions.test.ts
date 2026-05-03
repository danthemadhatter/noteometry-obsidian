/**
 * v1.11.4 regression guards.
 *
 * Code-shape assertions for the two issues that v1.11.3 left unfixed:
 *
 *   1. isLeafInSidebar relied on `containsLeaf` which doesn't exist as a
 *      public Obsidian API in current builds, so sidebar leaves slipped
 *      through and the relocation pass was a no-op.
 *
 *   2. Once the file-explorer leaf was overwritten by the pages panel
 *      (Bug A in v1.11.3), workspace.json had no file-explorer leaf and
 *      Obsidian didn't recreate one. Plugin must.
 *
 *   3. ChatDropin was only spawnable from Lasso\u2192ABC or Math\u2192Solve. The
 *      right-click insert hub must surface Chat directly.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const MAIN = readFileSync("src/main.ts", "utf8");
const APP = readFileSync("src/components/NoteometryApp.tsx", "utf8");

describe("v1.11.4 \u2014 sidebar detection uses leaf.getRoot()", () => {
  it("isLeafInSidebar checks leaf.getRoot() against workspace.leftSplit/rightSplit", () => {
    expect(MAIN).toMatch(/isLeafInSidebar/);
    expect(MAIN).toMatch(/getRoot\(\)/);
    expect(MAIN).toMatch(/leftSplit/);
    expect(MAIN).toMatch(/rightSplit/);
  });

  it("does not rely on the non-existent containsLeaf API", () => {
    // Strip line + block comments so a historical mention in the
    // change-comment doesn't trigger a false positive.
    const codeOnly = MAIN.replace(/\/\*[\s\S]*?\*\//g, "").replace(
      /\/\/.*$/gm,
      "",
    );
    expect(codeOnly).not.toMatch(/containsLeaf/);
  });

  it("retains the DOM-class fallback for headless Obsidian builds", () => {
    expect(MAIN).toMatch(/mod-left-split|mod-right-split/);
  });
});

describe("v1.11.4 \u2014 file explorer auto-restore", () => {
  it("registers ensureFileExplorerVisible on layout-ready", () => {
    expect(MAIN).toMatch(/ensureFileExplorerVisible/);
  });

  it("only acts when zero file-explorer leaves exist (no trampling)", () => {
    expect(MAIN).toMatch(
      /getLeavesOfType\(\s*["']file-explorer["']\s*\)/,
    );
  });

  it("prefers the file-explorer:open command before manually creating a leaf", () => {
    expect(MAIN).toMatch(/file-explorer:open/);
  });
});

describe("v1.11.4 \u2014 Chat tool surfaced in the right-click insert hub", () => {
  it("declares a handleInsertChat callback", () => {
    expect(APP).toMatch(/const handleInsertChat\s*=\s*useCallback/);
  });

  it("calls createChatObject from handleInsertChat", () => {
    // Match within the handleInsertChat block specifically.
    const match = APP.match(
      /const handleInsertChat[\s\S]*?\}\,\s*\[[^\]]*\]\)/,
    );
    expect(match, "handleInsertChat should exist").toBeTruthy();
    expect(match![0]).toMatch(/createChatObject\(/);
  });

  it("includes a Chat entry in the right-click insert section", () => {
    expect(APP).toMatch(/label:\s*["']Chat["'][^}]*onClick:\s*handleInsertChat/);
  });

  it("includes handleInsertChat in the context menu deps array", () => {
    // Ensures the menu rebuilds when the handler identity changes.
    const depsMatch = APP.match(
      /handleInsertTextBox,\s*handleInsertTable,\s*handleInsertChat,/,
    );
    expect(depsMatch).toBeTruthy();
  });
});
