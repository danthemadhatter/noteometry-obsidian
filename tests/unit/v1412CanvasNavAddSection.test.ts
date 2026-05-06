import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * v1.14.12: "+ Add section" was dead because onAddSection called
 * window.prompt(), which Obsidian's Electron renderer suppresses on
 * desktop and doesn't exist on iPad. Dan: "The Add Section section
 * doesnt work."
 *
 * Same release also fixes the Add-button width mismatch — both
 * "+ Add section" and "+ Add page" use .noteometry-nav-add. With
 * flex: 1 the button stretched to fill its column header, and since
 * the columns are very different widths, the same class rendered at
 * very different sizes. Dan: "add page need to be the same column
 * width as the section."
 *
 * Source-level pins so a future refactor can't silently re-introduce
 * either failure.
 */

const ROOT = join(__dirname, "..", "..");
const NAV_SRC = readFileSync(join(ROOT, "src/components/CanvasNav.tsx"), "utf8");
const STYLES = readFileSync(join(ROOT, "styles.css"), "utf8");

describe("v1.14.12 — CanvasNav + Add section + add-button widths", () => {
  it("CanvasNav.tsx must not call window.prompt", () => {
    // window.prompt is suppressed in Obsidian's renderer (desktop) and
    // doesn't exist on iPad. Any usage in CanvasNav means a click
    // path will look dead. The fix is an inline draft input.
    //
    // Strip JS line + block comments before checking — our own
    // "replaces window.prompt" comments would otherwise self-match.
    const stripped = NAV_SRC
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    expect(
      stripped.includes("window.prompt("),
      "CanvasNav.tsx still calls window.prompt — this is the bug Dan reported as 'The Add Section section doesnt work.'"
    ).toBe(false);
  });

  it("CanvasNav.tsx wires the inline new-section draft state and commit callback", () => {
    // The inline-rename pattern is the right replacement for prompt().
    // Both pieces must be present: the state setter and the commit
    // callback that actually creates the folder.
    expect(NAV_SRC).toMatch(/setNewSectionDraft\(/);
    expect(NAV_SRC).toMatch(/const commitNewSection\s*=\s*useCallback/);
    expect(NAV_SRC).toMatch(/app\.vault\.createFolder\(/);
  });

  it(".noteometry-nav-add is content-sized, not flex: 1", () => {
    // flex: 1 made the same class render at very different widths in
    // the two columns (Sections is 30% capped 140-240px; Pages is
    // flex: 1). The fix pins the rule to flex: 0 0 auto so both
    // buttons size to their content and end up matching.
    const ruleMatch = STYLES.match(/\.noteometry-nav-add\s*\{([\s\S]*?)\}/);
    expect(ruleMatch, ".noteometry-nav-add rule missing from styles.css").toBeTruthy();
    // Strip /* ... */ comments before checking declarations — the
    // rule body has a v1.14.12 "was flex: 1" comment that would
    // false-match the negative assertion below.
    const body = (ruleMatch?.[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(body).toMatch(/flex:\s*0\s+0\s+auto/);
    expect(body).not.toMatch(/flex:\s*1\b/);
  });
});
