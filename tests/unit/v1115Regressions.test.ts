/**
 * v1.11.5 regression guards.
 *
 * Code-shape assertions for what v1.11.4 left broken:
 *   1. Duplicate pages-panel leaves stacked on every plugin reload.
 *   2. Manual setViewState for file-explorer produced orphan leaves.
 *   3. Those orphans had no cleanup path.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const MAIN = readFileSync("src/main.ts", "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function extractMethod(src: string, name: string): string {
  // Find the DECLARATION not a call site. Class methods either start
  // with `private `/`public `/etc, or directly with `<name>(...)` after
  // a newline + indentation — NEVER preceded by `this.` or `void this.`.
  const re = new RegExp(
    `(?:private|public|protected|static)\\s+(?:async\\s+)?${name}\\s*\\(`,
  );
  const m = re.exec(src);
  if (!m) return "";
  const start = m.index;
  let depth = 0;
  const i = src.indexOf("{", start);
  if (i < 0) return "";
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  return "";
}

describe("v1.11.5 — duplicate pages-panel detach", () => {
  it("declares detachDuplicatePagesPanelLeaves", () => {
    expect(MAIN).toMatch(/detachDuplicatePagesPanelLeaves/);
  });

  it("iterates getLeavesOfType(PAGES_PANEL_VIEW_TYPE) starting at index 1", () => {
    const body = extractMethod(MAIN, "detachDuplicatePagesPanelLeaves");
    expect(body).toBeTruthy();
    expect(body).toMatch(/getLeavesOfType\([\s\n]*PAGES_PANEL_VIEW_TYPE/);
    expect(body).toMatch(/let i = 1/);
    expect(body).toMatch(/\.detach\(\)/);
  });

  it("is wired into onLayoutReady", () => {
    const onReady = MAIN.match(/onLayoutReady\([\s\S]*?\}\);/)!;
    expect(onReady[0]).toMatch(/detachDuplicatePagesPanelLeaves\(\)/);
  });

  it("guards the startup auto-reveal with a getLeavesOfType === 0 check", () => {
    const onReady = MAIN.match(/onLayoutReady\([\s\S]*?\}\);/)!;
    expect(onReady[0]).toMatch(
      /getLeavesOfType\([\s\S]*?PAGES_PANEL_VIEW_TYPE[\s\S]*?\)[\s\S]*?\.length\s*===\s*0[\s\S]*?revealPagesPanel/,
    );
  });
});

describe("v1.11.5 — dead empty-view leaf sweep", () => {
  it("declares detachDeadEmptyLeavesInSidebar", () => {
    expect(MAIN).toMatch(/detachDeadEmptyLeavesInSidebar/);
  });

  it("matches view type 'empty' and restricts to sidebar leaves", () => {
    const body = extractMethod(MAIN, "detachDeadEmptyLeavesInSidebar");
    expect(body).toBeTruthy();
    expect(body).toMatch(/getViewType\(\)/);
    expect(body).toMatch(/["']empty["']/);
    expect(body).toMatch(/isLeafInSidebar/);
  });

  it("is wired into onLayoutReady", () => {
    const onReady = MAIN.match(/onLayoutReady\([\s\S]*?\}\);/)!;
    expect(onReady[0]).toMatch(/detachDeadEmptyLeavesInSidebar\(\)/);
  });
});

describe("v1.11.5 — file-explorer fallback removed", () => {
  it("ensureFileExplorerVisible no longer sets the file-explorer view manually", () => {
    const code = stripComments(MAIN);
    const body = extractMethod(code, "ensureFileExplorerVisible");
    expect(body).toBeTruthy();
    // No setViewState({ type: 'file-explorer' }) call remains.
    expect(body).not.toMatch(/setViewState\s*\(/);
    // And no manual getLeftLeaf fallback inside the function.
    expect(body).not.toMatch(/getLeftLeaf/);
  });

  it("still attempts the file-explorer:open command", () => {
    expect(MAIN).toMatch(/file-explorer:open/);
  });
});
