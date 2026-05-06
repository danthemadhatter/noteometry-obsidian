import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rootSectionLabel } from "../../src/lib/canvasNavTree";

/**
 * v1.14.10: CanvasNav accessibility + intuitiveness pass per Dan's
 * feedback ("not intuitive. It's very unclear- even more from an
 * accessibility standpoint").
 *
 * These tests pin the accessibility contract at the source level so
 * regressions land loudly: a future refactor can't silently strip the
 * role attributes, the keyboard-nav handlers, or the focus-visible
 * outline without deleting these tests on purpose.
 */

const ROOT = join(__dirname, "..", "..");

describe("v1.14.10 — rootSectionLabel", () => {
  it("returns the trailing folder name from the configured root path", () => {
    expect(rootSectionLabel("Noteometry")).toBe("Noteometry");
    expect(rootSectionLabel("Noteometry/APUS")).toBe("APUS");
    expect(rootSectionLabel("a/b/c")).toBe("c");
  });

  it("trims trailing slashes before extracting the tail", () => {
    expect(rootSectionLabel("Noteometry/")).toBe("Noteometry");
    expect(rootSectionLabel("Noteometry/APUS/")).toBe("APUS");
  });

  it("falls back to 'Noteometry' for the empty / vault-root configuration", () => {
    expect(rootSectionLabel("")).toBe("Noteometry");
    expect(rootSectionLabel("/")).toBe("Noteometry");
  });

  it("never returns the opaque (root) jargon", () => {
    // Regression pin: v1.14.9 used "(root)" as a hardcoded label,
    // which Dan flagged as unclear.
    expect(rootSectionLabel("Noteometry/APUS")).not.toBe("(root)");
    expect(rootSectionLabel("")).not.toBe("(root)");
  });
});

describe("v1.14.10 — CanvasNav a11y contract (source-level)", () => {
  const src = readFileSync(join(ROOT, "src", "components", "CanvasNav.tsx"), "utf8");

  it("renders both columns as ARIA listboxes with labels", () => {
    expect(src).toMatch(/role="listbox"/);
    expect(src).toMatch(/aria-label="Sections"/);
    expect(src).toMatch(/aria-label="Pages"/);
  });

  it("rows are role=option with aria-selected reflecting the active state", () => {
    expect(src).toMatch(/role="option"/);
    expect(src).toMatch(/aria-selected=\{isActive\}/);
  });

  it("registers keydown handlers for arrow / Enter / F2 / Delete", () => {
    expect(src).toMatch(/onSectionsKeyDown/);
    expect(src).toMatch(/onPagesKeyDown/);
    // Each key the contract advertises must show up in at least one
    // handler — otherwise the keyboard shortcut is dead.
    expect(src).toMatch(/"ArrowDown"/);
    expect(src).toMatch(/"ArrowUp"/);
    expect(src).toMatch(/"Enter"/);
    expect(src).toMatch(/"F2"/);
    expect(src).toMatch(/"Delete"/);
  });

  it("guards delete/rename on the synthetic root bucket", () => {
    // Without this guard, deleting the bucket would trash the entire
    // Noteometry root folder.
    expect(src).toMatch(/section\.isRootBucket/);
    expect(src).toMatch(/Can't delete the root bucket/);
  });

  it("does not show the dead 'Click + Add page' instruction in empty states", () => {
    // v1.14.9's empty-state copy duplicated the button right above it.
    // v1.14.10 trims to "No pages yet." — the button is the call to
    // action, not the prose.
    expect(src).not.toMatch(/Click \+ Add page/);
    expect(src).not.toMatch(/Click \+ Add section/);
  });
});

describe("v1.14.10 — CanvasNav a11y contract (CSS)", () => {
  const css = readFileSync(join(ROOT, "styles.css"), "utf8");

  it("ships a :focus-visible outline on nav rows for keyboard users", () => {
    expect(css).toMatch(/\.noteometry-nav-row:focus-visible\s*\{/);
  });

  it("active row uses a filled accent background, not just a left border", () => {
    // Pin the contrast fix. The block we want must contain a
    // background that resolves to the accent color, not just the
    // tinted hover background.
    const block = /\.noteometry-nav-row\.active\s*\{[^}]*\}/m.exec(css)?.[0] ?? "";
    expect(block).toMatch(/background:\s*var\(--nm-accent/);
    expect(block).toMatch(/color:\s*var\(--text-on-accent/);
  });
});
