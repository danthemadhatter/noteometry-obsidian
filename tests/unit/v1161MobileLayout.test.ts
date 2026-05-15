import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * v1.16.1: iPad / mobile layout regression fix.
 *
 * v1.15.0 reshaped the chrome into the OneNote shell — SectionTabsBar
 * along the top + PagesRail down the right edge, both siblings inside
 * `.noteometry-split`. The legacy mobile rule (written for the v1.10
 * canvas + right-panel split) forced `.noteometry-split` to
 * `flex-direction: column !important` on every touch device. That now
 * stacks the canvas-area above a 100%-wide PagesRail, squashing the
 * canvas into a sliver on iPad. This test pins the two pieces of the
 * fix so a future refactor can't silently regress the layout.
 */

const ROOT = join(__dirname, "..", "..");
const STYLES = readFileSync(join(ROOT, "styles.css"), "utf8");
const RAIL_SRC = readFileSync(
  join(ROOT, "src/components/canvasNav/PagesRail.tsx"),
  "utf8",
);

describe("v1.16.1 — iPad / mobile layout regression fix", () => {
  it("the touch-device split-stack rule excludes the OneNote-shell body", () => {
    // The OneNote shell repurposed .noteometry-split to hold
    // canvas-area + PagesRail. Stacking those vertically destroys the
    // canvas. The legacy rule must NOT match .nm-onenote-body.
    expect(STYLES).toMatch(
      /\.noteometry-split:not\(\.nm-onenote-body\)\s*\{\s*flex-direction:\s*column\s*!important/,
    );
    // And the unscoped variant must be gone.
    expect(STYLES).not.toMatch(
      /^\s*\.noteometry-split\s*\{\s*flex-direction:\s*column\s*!important/m,
    );
  });

  it("PagesRail defaults to collapsed on Platform.isMobile", () => {
    // Even with the row layout restored, expanding the rail eats canvas
    // width on iPad portrait. Auto-collapse so the canvas is dominant
    // and the user can re-open the rail explicitly via the handle.
    expect(RAIL_SRC).toMatch(/from\s+["']obsidian["']/);
    expect(RAIL_SRC).toMatch(/Platform\.isMobile/);
    expect(RAIL_SRC).toMatch(
      /useState<boolean>\(\(\)\s*=>\s*Platform\.isMobile\)/,
    );
  });
});
