import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * v1.14.8: PageHeader band scrapped after four releases of attempted
 * fixes (v1.14.5 onClick swap, v1.14.6 viewport clamps + zero-rect
 * guard, v1.14.7 portal-to-body) failed to make the Notebooks pill
 * functional, and the breadcrumb/page-picker pills were redundant with
 * the left-pane Pages sidebar which already lists every page and
 * switches the current tab on click.
 *
 * This test pins the removal at the source-tree level so a future
 * "let's bring back the breadcrumb" diff that doesn't address the
 * underlying nav model has to delete this test out loud.
 */

const ROOT = join(__dirname, "..", "..");

describe("v1.14.8 \u2014 PageHeader band removed", () => {
  it("PageHeader.tsx no longer exists in src/components", () => {
    expect(existsSync(join(ROOT, "src", "components", "PageHeader.tsx"))).toBe(false);
  });

  it("NoteometryApp.tsx does not import PageHeader", () => {
    const src = readFileSync(join(ROOT, "src", "components", "NoteometryApp.tsx"), "utf8");
    expect(src).not.toMatch(/^import\s+PageHeader\s+from/m);
    expect(src).not.toMatch(/<PageHeader[\s>]/);
  });

  it("styles.css no longer ships PageHeader-specific selectors", () => {
    const css = readFileSync(join(ROOT, "styles.css"), "utf8");
    // The class selectors must be gone. References inside /* comments */
    // are fine \u2014 we only care about live CSS rules.
    expect(css).not.toMatch(/\.noteometry-page-header\s*\{/);
    expect(css).not.toMatch(/\.noteometry-page-header-segment\s*\{/);
    expect(css).not.toMatch(/\.noteometry-page-header-picker\s*\{/);
  });
});
