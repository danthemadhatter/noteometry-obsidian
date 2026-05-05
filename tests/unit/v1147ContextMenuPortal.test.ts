import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * v1.14.7 regression: ContextMenu MUST portal to document.body so that
 * `position: fixed` resolves to the viewport, not to whatever Obsidian
 * ancestor (workspace-leaf, view-container) has set transform/contain/
 * will-change. Without the portal, the menu paints at (x,y) inside the
 * leaf instead of the screen and looks invisible.
 *
 * Symptom we're guarding against: showFlyoutAt fires with valid coords
 * (e.g. x:264, y:132, both inside the viewport) but no menu appears.
 *
 * We can't easily mount React without jsdom in this test setup, so we
 * pin the contract at the source level: the module imports createPortal
 * from react-dom and uses it. A future "simplify" diff that drops the
 * portal will fail this test loudly.
 */

const SOURCE = readFileSync(
  join(__dirname, "..", "..", "src", "components", "ContextMenu.tsx"),
  "utf8",
);

describe("v1.14.7 \u2014 ContextMenu portal contract", () => {
  it("imports createPortal from react-dom", () => {
    expect(SOURCE).toMatch(/import\s*\{\s*createPortal\s*\}\s*from\s*["']react-dom["']/);
  });

  it("invokes createPortal in the render path", () => {
    expect(SOURCE).toMatch(/createPortal\s*\(/);
  });

  it("portals to document.body, not some intermediate container", () => {
    // The portal target MUST be document.body. Anchoring to a
    // workspace-leaf descendant defeats the entire fix because Obsidian
    // sets stacking contexts higher up the tree.
    expect(SOURCE).toMatch(/document\.body/);
  });

  it("guards against SSR / no-document environments", () => {
    // Plugin code can be evaluated by tests that don't have a document
    // global. The component must not throw \u2014 it should bail with null
    // when document is undefined.
    expect(SOURCE).toMatch(/typeof document !==\s*["']undefined["']/);
  });
});
