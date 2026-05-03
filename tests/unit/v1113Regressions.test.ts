/**
 * v1.11.3 regression guards.
 *
 * These tests are "code-shape" assertions rather than DOM integration
 * tests — our vitest setup runs in node without jsdom and Obsidian's
 * Workspace / Leaf APIs are not mockable without a large harness. The
 * goal here is to prevent the two specific regressions that shipped in
 * v1.11.1/v1.11.2 from coming back:
 *
 *   Bug A — revealPagesPanel used `getLeftLeaf(false)` which reused
 *           Obsidian's existing left leaf (the file explorer), replacing
 *           it with the pages panel and making the file tree disappear.
 *
 *   Bug B — `.noteometry-richtext-content` and `.noteometry-table-cell`
 *           routed their text color through `var(--text-normal)`. A
 *           chain through a user-theme-owned variable occasionally
 *           resolved to the wrong value and text rendered white-on-white
 *           in dark mode.
 *
 *   Bug C — handleLaunchOpen used `getLeaf(false)` without checking if
 *           the returned leaf lived in the sidebar; workspace.json
 *           restore could place the canvas in the narrow sidebar pane.
 *
 *   Bug D — cream-surface scope set `--text-faint` to a dark-navy
 *           semi-transparent value that was invisible on dark surfaces.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const STYLES = readFileSync("styles.css", "utf8");
const REGISTER_PAGES = readFileSync(
  "src/components/pages/registerPagesPanel.ts",
  "utf8",
);
const MAIN = readFileSync("src/main.ts", "utf8");

describe("v1.11.3 Bug A — revealPagesPanel must not displace the file explorer", () => {
  it("uses getLeftLeaf(true) so Obsidian creates a new leaf instead of reusing the file-explorer leaf", () => {
    // getLeftLeaf(false) is the regression — it returns the existing
    // left leaf (the file explorer) and setViewState then overwrites
    // that leaf's view, which is why the tree disappeared. Strip line
    // comments before checking so the historical reference in the
    // fix-comment doesn't cause a false positive.
    const codeOnly = REGISTER_PAGES
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(codeOnly).not.toMatch(/getLeftLeaf\(\s*false\s*\)/);
    expect(codeOnly).toMatch(/getLeftLeaf\(\s*true\s*\)/);
  });

  it("still short-circuits when a pages-panel leaf already exists", () => {
    // The de-dup check is important — without it every call creates a
    // new panel leaf in the sidebar.
    expect(REGISTER_PAGES).toMatch(
      /getLeavesOfType\(\s*PAGES_PANEL_VIEW_TYPE\s*\)/,
    );
  });
});

describe("v1.11.3 Bug B — dropin text colors resolve through --nm-paper-ink directly", () => {
  it(".noteometry-table-cell pulls color from --nm-paper-ink, not --text-normal", () => {
    // Walk the whole rule block and assert the color declaration.
    const block = STYLES.match(/\.noteometry-table-cell\s*\{[^}]*\}/);
    expect(block, "table-cell rule must exist").toBeTruthy();
    expect(block![0]).toMatch(/color:\s*var\(--nm-paper-ink\)\s*!important/);
    expect(block![0]).not.toMatch(/color:\s*var\(--text-normal\)\s*;/);
  });

  it(".noteometry-richtext-content pulls color from --nm-paper-ink, not --text-normal", () => {
    // First matching rule only — :empty::before is a separate selector.
    const block = STYLES.match(/\.noteometry-richtext-content\s*\{[^}]*\}/);
    expect(block, "richtext-content rule must exist").toBeTruthy();
    expect(block![0]).toMatch(/color:\s*var\(--nm-paper-ink\)\s*!important/);
    expect(block![0]).not.toMatch(/color:\s*var\(--text-normal\)\s*;/);
  });

  it("applies -webkit-text-fill-color so macOS input/contenteditable defaults can't override", () => {
    // Without -webkit-text-fill-color, Electron on macOS can paint
    // selection/composition text in the system tint, which in dark mode
    // is near-white and reintroduces the white-on-white issue.
    expect(STYLES).toMatch(
      /\.noteometry-table-cell\s*\{[\s\S]*?-webkit-text-fill-color/,
    );
    expect(STYLES).toMatch(
      /\.noteometry-richtext-content\s*\{[\s\S]*?-webkit-text-fill-color/,
    );
  });
});

describe("v1.11.3 Bug C — handleLaunchOpen must not open a canvas in the sidebar", () => {
  it("checks if getLeaf(false) returned a sidebar leaf before opening the file", () => {
    expect(MAIN).toMatch(/isLeafInSidebar/);
  });

  it("has a helper that inspects leftSplit / rightSplit", () => {
    expect(MAIN).toMatch(/leftSplit/);
    expect(MAIN).toMatch(/rightSplit/);
    expect(MAIN).toMatch(/mod-left-split|mod-right-split/);
  });

  it("relocates canvas leaves out of the sidebar on layout ready", () => {
    // This cleans up broken workspace.json from users upgrading from
    // v1.11.0–v1.11.2 where the canvas may already be stuck in the
    // sidebar. Without relocation, the first launch after upgrade
    // still shows the bug.
    expect(MAIN).toMatch(/relocateNoteometryLeavesOutOfSidebar/);
  });
});

describe("v1.11.3 Bug D — dark-mode --text-faint override for cream-surface scope", () => {
  it("defines a .theme-dark override for the cream-surface --text-faint", () => {
    // Must override in dark mode or placeholder / muted text inside
    // canvas objects is effectively invisible (dark navy at 0.52 on a
    // near-black background).
    expect(STYLES).toMatch(
      /\.theme-dark \.noteometry-canvas-object[\s\S]*?--text-faint:\s*rgba\(232,\s*232,\s*236/,
    );
  });

  it("light-mode --text-faint value is unchanged (dark navy for light surfaces)", () => {
    // Belt check: the original light-mode value is still present in
    // the non-theme-dark rule, so light-mode contrast isn't affected
    // by the fix.
    expect(STYLES).toMatch(/--text-faint:\s*rgba\(26,\s*35,\s*53,\s*0\.52\)/);
  });
});
