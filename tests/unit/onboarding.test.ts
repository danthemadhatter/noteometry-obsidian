/**
 * v1.11.0 phase-4 sub-PR 4.2: onboarding cheatsheet tests.
 *
 * Vitest is node-env (no jsdom, no React rendering), so we test the
 * pure module that backs the modal: visibility predicate, content
 * shape, family grouping, and copy strings. The React shell is a
 * thin wrapper over this module.
 */

import { describe, it, expect } from "vitest";
import {
  CHEATSHEET,
  ONBOARDING_DISMISS_LABEL,
  ONBOARDING_RESET_HINT,
  ONBOARDING_SUBTITLE,
  ONBOARDING_TITLE,
  groupByFamily,
  shouldShowOnboarding,
  type CheatsheetEntry,
} from "../../src/components/onboarding/onboardingContent";

describe("shouldShowOnboarding", () => {
  it("returns true for fresh install (gestureTutorialSeen === false)", () => {
    expect(shouldShowOnboarding({ gestureTutorialSeen: false })).toBe(true);
  });

  it("returns false once the user has dismissed", () => {
    expect(shouldShowOnboarding({ gestureTutorialSeen: true })).toBe(false);
  });
});

describe("CHEATSHEET", () => {
  it("contains both 3-finger swipe directions (down + up)", () => {
    const ids = CHEATSHEET.map((e) => e.id);
    expect(ids).toContain("tool-down");
    expect(ids).toContain("tool-up");
  });

  it("contains both meta-layer directions (right + left)", () => {
    const ids = CHEATSHEET.map((e) => e.id);
    expect(ids).toContain("meta-right");
    expect(ids).toContain("meta-left");
  });

  it("contains the 4-finger freeze entry", () => {
    const freeze = CHEATSHEET.find((e) => e.id === "freeze");
    expect(freeze).toBeDefined();
    expect(freeze!.family).toBe("4-finger");
    expect(freeze!.gesture.toLowerCase()).toContain("4 finger");
  });

  it("contains the long-press entry mentioning 550 ms (matches recognizer)", () => {
    const lp = CHEATSHEET.find((e) => e.id === "long-press");
    expect(lp).toBeDefined();
    expect(lp!.family).toBe("long-press");
    expect(lp!.gesture).toContain("550");
  });

  it("contains the lasso entry", () => {
    const lasso = CHEATSHEET.find((e) => e.id === "lasso");
    expect(lasso).toBeDefined();
    expect(lasso!.family).toBe("lasso");
  });

  it("entries have non-empty glyph + gesture + effect", () => {
    for (const e of CHEATSHEET) {
      expect(e.glyph.length).toBeGreaterThan(0);
      expect(e.gesture.length).toBeGreaterThan(0);
      expect(e.effect.length).toBeGreaterThan(0);
      expect(e.id.length).toBeGreaterThan(0);
    }
  });

  it("entry ids are unique", () => {
    const ids = CHEATSHEET.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("stays under design doc §6b's 12-gesture vocabulary ceiling", () => {
    // 11 locked gestures total; cheatsheet shouldn't introduce more.
    expect(CHEATSHEET.length).toBeLessThanOrEqual(12);
  });
});

describe("groupByFamily", () => {
  it("groups all CHEATSHEET entries with no loss", () => {
    const grouped = groupByFamily();
    const total =
      grouped["3-finger"].length +
      grouped["4-finger"].length +
      grouped["long-press"].length +
      grouped.lasso.length;
    expect(total).toBe(CHEATSHEET.length);
  });

  it("places 3-finger swipes in the 3-finger bucket", () => {
    const grouped = groupByFamily();
    const ids = grouped["3-finger"].map((e) => e.id);
    expect(ids).toContain("tool-down");
    expect(ids).toContain("tool-up");
    expect(ids).toContain("meta-right");
    expect(ids).toContain("meta-left");
  });

  it("places freeze in the 4-finger bucket exclusively", () => {
    const grouped = groupByFamily();
    expect(grouped["4-finger"].map((e) => e.id)).toEqual(["freeze"]);
  });

  it("returns all four bucket keys even on empty input", () => {
    const grouped = groupByFamily([]);
    expect(Object.keys(grouped).sort()).toEqual([
      "3-finger",
      "4-finger",
      "lasso",
      "long-press",
    ]);
    expect(grouped["3-finger"]).toEqual([]);
    expect(grouped["4-finger"]).toEqual([]);
    expect(grouped["long-press"]).toEqual([]);
    expect(grouped.lasso).toEqual([]);
  });

  it("respects custom entry lists (testability)", () => {
    const custom: CheatsheetEntry[] = [
      {
        id: "x",
        glyph: "?",
        gesture: "test",
        effect: "test",
        family: "lasso",
      },
    ];
    const grouped = groupByFamily(custom);
    expect(grouped.lasso).toHaveLength(1);
    expect(grouped.lasso[0].id).toBe("x");
  });
});

describe("copy strings", () => {
  it("title mentions 1.11", () => {
    expect(ONBOARDING_TITLE).toContain("1.11");
  });

  it("subtitle is non-empty", () => {
    expect(ONBOARDING_SUBTITLE.length).toBeGreaterThan(0);
  });

  it("dismiss label is short and affirmative", () => {
    expect(ONBOARDING_DISMISS_LABEL.length).toBeLessThanOrEqual(20);
    expect(ONBOARDING_DISMISS_LABEL.length).toBeGreaterThan(0);
  });

  it("reset hint mentions Settings (so user knows where to find it)", () => {
    expect(ONBOARDING_RESET_HINT).toMatch(/Settings/i);
  });
});
