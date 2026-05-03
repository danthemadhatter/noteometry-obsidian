/**
 * v1.11.0 phase-5: ink palette module tests.
 *
 * Pure data + cycling helpers. Both the right-click context menu's
 * cycling shortcuts and the new ToolLayer toolbar consume these, so
 * pinning the shape + cycle semantics here prevents drift.
 */

import { describe, it, expect } from "vitest";
import {
  INK_COLORS,
  STROKE_WIDTHS,
  nextColor,
  nextWidth,
} from "../../src/features/ink/palettes";

describe("INK_COLORS", () => {
  it("contains Black as the first entry (default ink)", () => {
    expect(INK_COLORS[0]!.label).toBe("Black");
    expect(INK_COLORS[0]!.color).toBe("#202124");
  });

  it("contains 6 distinct colors", () => {
    expect(INK_COLORS.length).toBe(6);
    const set = new Set(INK_COLORS.map((c) => c.color));
    expect(set.size).toBe(6);
  });

  it("every entry has a non-empty label and a hex color", () => {
    for (const c of INK_COLORS) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("STROKE_WIDTHS", () => {
  it("contains 4 entries: Fine, Medium, Thick, Marker", () => {
    expect(STROKE_WIDTHS.map((w) => w.label)).toEqual([
      "Fine",
      "Medium",
      "Thick",
      "Marker",
    ]);
  });

  it("widths are strictly increasing", () => {
    for (let i = 1; i < STROKE_WIDTHS.length; i++) {
      expect(STROKE_WIDTHS[i]!.width).toBeGreaterThan(
        STROKE_WIDTHS[i - 1]!.width,
      );
    }
  });

  it("Medium (default) is 3px", () => {
    const medium = STROKE_WIDTHS.find((w) => w.label === "Medium");
    expect(medium?.width).toBe(3);
  });
});

describe("nextColor", () => {
  it("advances to the next entry", () => {
    const first = INK_COLORS[0]!.color;
    const second = INK_COLORS[1]!.color;
    expect(nextColor(first).color).toBe(second);
  });

  it("wraps from the last entry back to the first", () => {
    const last = INK_COLORS[INK_COLORS.length - 1]!.color;
    const first = INK_COLORS[0]!.color;
    expect(nextColor(last).color).toBe(first);
  });

  it("when current is unknown, defaults to first (idx -1 + 1 = 0)", () => {
    expect(nextColor("#ffffff").color).toBe(INK_COLORS[0]!.color);
  });
});

describe("nextWidth", () => {
  it("advances to the next entry", () => {
    expect(nextWidth(STROKE_WIDTHS[0]!.width).width).toBe(
      STROKE_WIDTHS[1]!.width,
    );
  });

  it("wraps from last to first", () => {
    const last = STROKE_WIDTHS[STROKE_WIDTHS.length - 1]!.width;
    expect(nextWidth(last).width).toBe(STROKE_WIDTHS[0]!.width);
  });

  it("when current is unknown, defaults to first", () => {
    expect(nextWidth(99).width).toBe(STROKE_WIDTHS[0]!.width);
  });
});
