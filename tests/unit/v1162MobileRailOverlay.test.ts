import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * v1.16.2: On touch devices the PagesRail must overlay the canvas,
 * not consume a flex column next to it.
 *
 * v1.16.1 restored the row layout and auto-collapsed the rail on
 * Platform.isMobile, but the rail (collapsed or expanded) was still
 * an in-flow flex sibling of .noteometry-canvas-area — so it reserved
 * its own width and left a blank strip / clipped canvas on iPad. The
 * fix anchors the rail absolutely against .nm-onenote-body on touch.
 * This test pins the contract so a future CSS refactor can't silently
 * regress it.
 */

const ROOT = join(__dirname, "..", "..");
const STYLES = readFileSync(join(ROOT, "styles.css"), "utf8");

describe("v1.16.2 — mobile rail overlays the canvas instead of taking a flex column", () => {
  it("touch-shell block makes .nm-onenote-body a positioning context", () => {
    // The body needs position:relative so the rail (position:absolute)
    // anchors to it rather than to the viewport / a distant ancestor.
    expect(STYLES).toMatch(
      /\.noteometry-container\s+\.noteometry-split\.nm-onenote-body\s*\{[^}]*position:\s*relative/,
    );
  });

  it("touch-shell block absolutely positions the expanded rail on the right edge", () => {
    // Expanded rail must overlay, not push canvas-area aside.
    expect(STYLES).toMatch(
      /\.noteometry-container\s+\.nm-onenote-rail\s*\{[^}]*position:\s*absolute[^}]*right:\s*0/s,
    );
  });

  it("touch-shell block absolutely positions the collapsed rail handle", () => {
    // Collapsed rail must NOT reserve a flex column either — only the
    // handle should be a pointer target.
    expect(STYLES).toMatch(
      /\.noteometry-container\s+\.nm-onenote-rail-collapsed\s*\{[^}]*position:\s*absolute/s,
    );
    expect(STYLES).toMatch(
      /\.noteometry-container\s+\.nm-onenote-rail-collapsed\s*\{[^}]*pointer-events:\s*none/s,
    );
    expect(STYLES).toMatch(
      /\.noteometry-container\s+\.nm-onenote-rail-collapsed\s+\.nm-onenote-rail-toggle\s*\{[^}]*pointer-events:\s*auto/s,
    );
  });

  it("the overlay rules are scoped to touch / narrow viewports only", () => {
    // The whole block lives inside `@media (max-width: 768px), (pointer: coarse)`.
    // Find the media block that contains the .nm-onenote-rail position:absolute
    // declaration and confirm the query matches one of the two touch forms.
    const mediaBlock = STYLES.match(
      /@media\s+([^{]+)\{[^@]*\.noteometry-container\s+\.nm-onenote-rail\s*\{[^}]*position:\s*absolute/s,
    );
    expect(mediaBlock).not.toBeNull();
    const query = mediaBlock![1];
    expect(query).toMatch(/pointer:\s*coarse|max-width:\s*768px/);
  });
});
