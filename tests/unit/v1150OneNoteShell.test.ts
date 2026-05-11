import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sectionHue } from "../../src/components/canvasNav/useCanvasNavState";

/**
 * v1.15.0: OneNote-shell rework.
 *
 * Dan, with three v1.14.12 screenshots:
 *   "I'd rather you accomplish one goal. stop development of
 *    noteometry as we have and make it almost exactly like OneNote..."
 *   "...I want it to look and operate LIKE OneNote, not ditch Noteometry"
 *
 * Root cause of the bad feel in v1.14.x: the CanvasNav slab was a
 * horizontal 240px-tall band with Sections column (30%) + Pages
 * column (70%) side-by-side. That ate the top third of the canvas
 * AND read as a spreadsheet header, not a notebook. OneNote's actual
 * spatial layout is:
 *   - thin horizontal section tabs strip across the top, colored
 *   - vertical pages rail on the right edge, collapsible
 *   - canvas dominant in the middle
 *
 * v1.15.0 reshapes the chrome to that layout without touching the
 * Noteometry engine (custom canvas, lasso → LaTeX, KaTeX, MathML,
 * SOLVE, .nmpage). This test pins the new contract at the source
 * level so a future refactor can't silently slide back into a slab.
 */

const ROOT = join(__dirname, "..", "..");
const TABS_SRC = readFileSync(join(ROOT, "src/components/canvasNav/SectionTabsBar.tsx"), "utf8");
const RAIL_SRC = readFileSync(join(ROOT, "src/components/canvasNav/PagesRail.tsx"), "utf8");
const HOOK_SRC = readFileSync(join(ROOT, "src/components/canvasNav/useCanvasNavState.ts"), "utf8");
const APP_SRC = readFileSync(join(ROOT, "src/components/NoteometryApp.tsx"), "utf8");
const STYLES = readFileSync(join(ROOT, "styles.css"), "utf8");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("v1.15.0 — OneNote shell: slab is gone", () => {
  it("the old CanvasNav.tsx slab component is deleted", () => {
    // The v1.14.x two-column slab is replaced by SectionTabsBar +
    // PagesRail + useCanvasNavState. Deleting the old file is part of
    // the contract — if it comes back, someone is rebuilding the slab.
    expect(existsSync(join(ROOT, "src/components/CanvasNav.tsx"))).toBe(false);
  });

  it("NoteometryApp uses SectionTabsBar at top and PagesRail in the body", () => {
    expect(APP_SRC).toMatch(/import\s+SectionTabsBar\s+from\s+["']\.\/canvasNav\/SectionTabsBar["']/);
    expect(APP_SRC).toMatch(/import\s+PagesRail\s+from\s+["']\.\/canvasNav\/PagesRail["']/);
    expect(APP_SRC).toMatch(/<SectionTabsBar[^>]*nav=\{canvasNav\}/);
    expect(APP_SRC).toMatch(/<PagesRail\s+nav=\{canvasNav\}\s*\/>/);
    // The old import is gone.
    expect(APP_SRC).not.toMatch(/import\s+CanvasNav\s+from\s+["']\.\/CanvasNav["']/);
  });

  it("the old .noteometry-nav* CSS slab rules are not in styles.css", () => {
    // Source of the old visual problem. The class names belonged to
    // the slab. New classes are .nm-onenote-tab* and .nm-onenote-rail*.
    expect(STYLES).not.toMatch(/\.noteometry-nav\s*\{/);
    expect(STYLES).not.toMatch(/\.noteometry-nav-col\b/);
    expect(STYLES).not.toMatch(/\.noteometry-nav-sections\b/);
    expect(STYLES).not.toMatch(/\.noteometry-nav-pages\b/);
  });
});

describe("v1.15.0 — section tabs strip is horizontal and lives above the canvas", () => {
  it(".nm-onenote-tabs rule is flex-direction: row", () => {
    // Tabs ARE the horizontal strip. If anyone flips this to column,
    // we're back to a slab.
    const match = STYLES.match(/\.nm-onenote-tabs\s*\{([\s\S]*?)\}/);
    expect(match, ".nm-onenote-tabs missing").toBeTruthy();
    const body = (match?.[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(body).toMatch(/flex-direction:\s*row/);
  });

  it("section tabs render with role=tablist and tabs have role=tab", () => {
    expect(TABS_SRC).toMatch(/role=["']tablist["']/);
    expect(TABS_SRC).toMatch(/role=["']tab["']/);
    expect(TABS_SRC).toMatch(/aria-selected=\{isActive\}/);
  });

  it("section tabs are keyboard-navigable: ArrowLeft / ArrowRight / F2 / Delete", () => {
    expect(TABS_SRC).toMatch(/"ArrowRight"/);
    expect(TABS_SRC).toMatch(/"ArrowLeft"/);
    expect(TABS_SRC).toMatch(/"F2"/);
    expect(TABS_SRC).toMatch(/"Delete"/);
  });

  it("section tabs do not use window.prompt for + Add section", () => {
    // Same Obsidian-renderer footgun fixed in v1.14.12. Inline draft
    // tab via newSectionDraft is the right pattern.
    const stripped = stripComments(TABS_SRC);
    expect(stripped).not.toMatch(/window\.prompt\(/);
    expect(TABS_SRC).toMatch(/newSectionDraft/);
    expect(TABS_SRC).toMatch(/commitNewSection/);
  });

  it("section tabs stop mouse events from bubbling into the canvas area", () => {
    // Otherwise clicking a tab deselects canvas objects (the v1.14.11
    // leak) and right-click delete pops the big tools menu on top.
    expect(TABS_SRC).toMatch(/onClick=\{stopBubble\}/);
    expect(TABS_SRC).toMatch(/onDoubleClick=\{stopBubble\}/);
    expect(TABS_SRC).toMatch(/onContextMenu=\{stopBubble\}/);
    expect(TABS_SRC).toMatch(/onMouseDown=\{stopBubble\}/);
  });
});

describe("v1.15.0 — pages rail is vertical and lives on the right edge", () => {
  it(".nm-onenote-rail rule is flex-direction: column", () => {
    const match = STYLES.match(/\.nm-onenote-rail\s*\{([\s\S]*?)\}/);
    expect(match, ".nm-onenote-rail missing").toBeTruthy();
    const body = (match?.[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(body).toMatch(/flex-direction:\s*column/);
    // Bounded width so it can't grow into a slab.
    expect(body).toMatch(/width:\s*\d+px/);
    expect(body).toMatch(/max-width:\s*\d+px/);
  });

  it(".nm-onenote-rail uses border-LEFT, not border-bottom (proves it's on the right edge, not the top)", () => {
    const match = STYLES.match(/\.nm-onenote-rail\s*\{([\s\S]*?)\}/);
    const body = (match?.[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(body).toMatch(/border-left:/);
    expect(body).not.toMatch(/border-bottom:\s*\d/);
  });

  it("pages rail renders role=listbox and rows are role=option, with ArrowUp/Down keyboard nav", () => {
    expect(RAIL_SRC).toMatch(/role=["']listbox["']/);
    expect(RAIL_SRC).toMatch(/role=["']option["']/);
    expect(RAIL_SRC).toMatch(/"ArrowDown"/);
    expect(RAIL_SRC).toMatch(/"ArrowUp"/);
    expect(RAIL_SRC).toMatch(/"Enter"/);
    expect(RAIL_SRC).toMatch(/"F2"/);
    expect(RAIL_SRC).toMatch(/"Delete"/);
  });

  it("pages rail is collapsible to a thin handle", () => {
    expect(RAIL_SRC).toMatch(/nm-onenote-rail-collapsed/);
    expect(RAIL_SRC).toMatch(/setCollapsed/);
  });

  it("pages rail stops mouse events from bubbling into the canvas area", () => {
    expect(RAIL_SRC).toMatch(/onClick=\{stopBubble\}/);
    expect(RAIL_SRC).toMatch(/onContextMenu=\{stopBubble\}/);
    expect(RAIL_SRC).toMatch(/onMouseDown=\{stopBubble\}/);
  });

  it(".nm-onenote-rail-add is content-sized (flex: 0 0 auto), like the v1.14.12 fix", () => {
    // Same width-mismatch trap. If anyone makes this flex: 1 the
    // button will stretch to fill the rail width and look wrong.
    const match = STYLES.match(/\.nm-onenote-rail-add\s*\{([\s\S]*?)\}/);
    expect(match, ".nm-onenote-rail-add missing").toBeTruthy();
    const body = (match?.[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(body).toMatch(/flex:\s*0\s+0\s+auto/);
    expect(body).not.toMatch(/flex:\s*1\b/);
  });
});

describe("v1.15.0 — nav state hook owns one source of truth", () => {
  it("useCanvasNavState exposes sections, activeSection, renaming, draft, and the action set", () => {
    expect(HOOK_SRC).toMatch(/export function useCanvasNavState/);
    expect(HOOK_SRC).toMatch(/sections,/);
    expect(HOOK_SRC).toMatch(/activeSection,/);
    expect(HOOK_SRC).toMatch(/renaming,/);
    expect(HOOK_SRC).toMatch(/newSectionDraft/);
    expect(HOOK_SRC).toMatch(/commitNewSection/);
    expect(HOOK_SRC).toMatch(/addPage/);
    expect(HOOK_SRC).toMatch(/deleteSection/);
    expect(HOOK_SRC).toMatch(/deletePage/);
    expect(HOOK_SRC).toMatch(/beginRenameSection/);
    expect(HOOK_SRC).toMatch(/beginRenamePage/);
    expect(HOOK_SRC).toMatch(/commitRename/);
  });

  it("sectionHue is stable per folderPath and returns a valid hue", () => {
    expect(sectionHue("APUS/ELEN201")).toBe(sectionHue("APUS/ELEN201"));
    expect(sectionHue("APUS/ELEN201")).not.toBe(sectionHue("APUS/MATH240"));
    for (const path of ["", "Noteometry", "APUS/ELEN201", "deeply/nested/path"]) {
      const hue = sectionHue(path);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it("hook does not use window.prompt for new sections", () => {
    const stripped = stripComments(HOOK_SRC);
    expect(stripped).not.toMatch(/window\.prompt\(/);
    expect(HOOK_SRC).toMatch(/app\.vault\.createFolder\(/);
  });
});
