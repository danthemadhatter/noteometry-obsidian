import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * v1.14.10: HomeView scrapped. Dan: "The Home icon and all it's wonder
 * need to be gone." The on-canvas CanvasNav (v1.14.9) replaces every job
 * the Home tab was supposed to do — Resume / Recents / New page — and
 * the Home tab itself was out-of-sight/out-of-mind (proven by 30+
 * revisions where Dan never opened it).
 *
 * This test pins the removal at the source-tree + workspace-launch level
 * so a future "let's bring back the home tab" diff that doesn't address
 * the underlying nav model has to delete this test out loud.
 *
 * In addition to deleting the view, we must also:
 *   - remove the "home" ribbon icon
 *   - remove the "noteometry-open-home" command
 *   - remove the `homeViewOnLaunch` setting from DEFAULT_SETTINGS
 *   - sweep legacy `noteometry-home` leaves from workspace.json on
 *     layout-ready so restored sessions don't paint a "Plugin no
 *     longer active" ghost tab (that's the "always a tab open" thing
 *     Dan flagged).
 */

const ROOT = join(__dirname, "..", "..");

describe("v1.14.10 — HomeView removed", () => {
  it("HomeView.ts no longer exists in src/", () => {
    expect(existsSync(join(ROOT, "src", "HomeView.ts"))).toBe(false);
  });

  it("Home.tsx no longer exists in src/components/", () => {
    expect(existsSync(join(ROOT, "src", "components", "Home.tsx"))).toBe(false);
  });

  it("main.ts does not import HomeView or HOME_VIEW_TYPE", () => {
    const src = readFileSync(join(ROOT, "src", "main.ts"), "utf8");
    expect(src).not.toMatch(/from\s+"\.\/HomeView"/);
    expect(src).not.toMatch(/NoteometryHomeView/);
    // The module-level LEGACY_HOME_VIEW_TYPE constant is the one
    // allowed reference — it exists ONLY for sweeping stale leaves.
    // Anything else would mean a live registration slipped back in.
    expect(src).not.toMatch(/this\.registerView\(\s*HOME_VIEW_TYPE/);
  });

  it("main.ts does not add a 'home' ribbon icon or open-home command", () => {
    const src = readFileSync(join(ROOT, "src", "main.ts"), "utf8");
    expect(src).not.toMatch(/addRibbonIcon\(\s*"home"/);
    expect(src).not.toMatch(/noteometry-open-home/);
    expect(src).not.toMatch(/openHome\s*\(/);
  });

  it("main.ts sweeps legacy noteometry-home leaves on layout-ready", () => {
    // The sweep is what makes v1.14.10 safe for users with saved
    // workspace.json from prior versions — without it Obsidian
    // restores a noteometry-home leaf and paints it as the
    // "Plugin no longer active" dead tab.
    const src = readFileSync(join(ROOT, "src", "main.ts"), "utf8");
    expect(src).toMatch(/noteometry-home/);
    expect(src).toMatch(/sweepLegacyHomeLeaves/);
  });

  it("types.ts no longer declares homeViewOnLaunch in DEFAULT_SETTINGS", () => {
    const src = readFileSync(join(ROOT, "src", "types.ts"), "utf8");
    expect(src).not.toMatch(/homeViewOnLaunch/);
  });

  it("settings.ts no longer exposes the home-view-on-launch toggle", () => {
    const src = readFileSync(join(ROOT, "src", "settings.ts"), "utf8");
    expect(src).not.toMatch(/Show home view on launch/);
    expect(src).not.toMatch(/homeViewOnLaunch/);
  });

  it("styles.css no longer ships .noteometry-home* selectors", () => {
    const css = readFileSync(join(ROOT, "styles.css"), "utf8");
    // Live CSS rules (selectors followed by `{`) must be gone.
    expect(css).not.toMatch(/\.noteometry-home-root\s*\{/);
    expect(css).not.toMatch(/\.noteometry-home\s*\{/);
    expect(css).not.toMatch(/\.noteometry-home-resume\s*\{/);
    expect(css).not.toMatch(/\.noteometry-home-recent\s*\{/);
  });
});
