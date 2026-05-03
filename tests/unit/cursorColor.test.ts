/**
 * v1.11.0 phase-2 sub-PR 2.2: cursor-color indicator tests.
 *
 * Pure module — exercise:
 *   - `isPaintTool` set membership
 *   - `sanitizeCssColor` strips quote / bracket characters
 *   - `buildPenCursorUri` produces a well-formed `url("data:...") 8 8, crosshair`
 *     and embeds the color in the central `<circle fill="...">`
 *   - `resolveInkCursor` mirrors historical behavior for non-paint tools
 *     and routes paint tools through the SVG cursor builder
 */

import { describe, it, expect } from "vitest";
import {
  buildPenCursorUri,
  isPaintTool,
  resolveInkCursor,
  sanitizeCssColor,
} from "../../src/features/ink/cursorColor";

describe("isPaintTool", () => {
  it("returns true for pen / line / arrow / rect / circle", () => {
    expect(isPaintTool("pen")).toBe(true);
    expect(isPaintTool("line")).toBe(true);
    expect(isPaintTool("arrow")).toBe(true);
    expect(isPaintTool("rect")).toBe(true);
    expect(isPaintTool("circle")).toBe(true);
  });

  it("returns false for non-paint tools", () => {
    expect(isPaintTool("grab")).toBe(false);
    expect(isPaintTool("eraser")).toBe(false);
    expect(isPaintTool("select")).toBe(false);
    expect(isPaintTool("default")).toBe(false);
    expect(isPaintTool("")).toBe(false);
  });
});

describe("sanitizeCssColor", () => {
  it("preserves hex colors", () => {
    expect(sanitizeCssColor("#ff0000")).toBe("#ff0000");
    expect(sanitizeCssColor("#abc")).toBe("#abc");
    expect(sanitizeCssColor("#aabbccdd")).toBe("#aabbccdd");
  });

  it("preserves functional colors with parens / commas / percent", () => {
    expect(sanitizeCssColor("rgb(255, 0, 0)")).toBe("rgb(255, 0, 0)");
    expect(sanitizeCssColor("hsl(120, 50%, 50%)")).toBe("hsl(120, 50%, 50%)");
    expect(sanitizeCssColor("oklch(0.7 0.2 30)")).toBe("oklch(0.7 0.2 30)");
  });

  it("strips quote and bracket characters that could break attributes", () => {
    expect(sanitizeCssColor('"red"')).toBe("red");
    expect(sanitizeCssColor("red'")).toBe("red");
    expect(sanitizeCssColor("<red>")).toBe("red");
  });

  it("trims whitespace", () => {
    expect(sanitizeCssColor("   #abc   ")).toBe("#abc");
  });
});

describe("buildPenCursorUri", () => {
  it("produces a url(data:image/svg+xml;utf8,...) 8 8, crosshair value", () => {
    const cur = buildPenCursorUri("#ff00aa");
    expect(cur).toMatch(/^url\("data:image\/svg\+xml;utf8,/);
    expect(cur).toContain('") 8 8, crosshair');
  });

  it("embeds the color (URL-encoded) in the SVG fill attribute", () => {
    const cur = buildPenCursorUri("#ff00aa");
    // # is URL-encoded as %23.
    expect(cur).toContain("%23ff00aa");
  });

  it("embeds functional colors verbatim (encodeURIComponent leaves () and , alone)", () => {
    const cur = buildPenCursorUri("rgb(255,0,170)");
    // encodeURIComponent does not encode ( ) , — they're attribute-safe inside the URI.
    expect(cur).toContain("rgb(255%2C0%2C170)");
  });

  it("falls back to a still-valid URI when color is sanitized away", () => {
    const cur = buildPenCursorUri('">');
    // Sanitized to empty; we still produce a parseable cursor string.
    expect(cur).toMatch(/^url\("data:image\/svg\+xml;utf8,/);
    expect(cur).toContain('") 8 8, crosshair');
  });
});

describe("resolveInkCursor", () => {
  it("returns 'grab' for grab tool regardless of color", () => {
    expect(resolveInkCursor("grab", "#fff")).toBe("grab");
  });

  it("returns 'cell' for eraser", () => {
    expect(resolveInkCursor("eraser", "#fff")).toBe("cell");
  });

  it("returns 'default' for select / unknown / default tools", () => {
    expect(resolveInkCursor("select", "#fff")).toBe("default");
    expect(resolveInkCursor("default", "#fff")).toBe("default");
    expect(resolveInkCursor("whatever" as any, "#fff")).toBe("default");
  });

  it("paint tools route through buildPenCursorUri (color in URI)", () => {
    const penCur = resolveInkCursor("pen", "#123abc");
    expect(penCur).toMatch(/^url\("data:image\/svg\+xml;utf8,/);
    expect(penCur).toContain("%23123abc");

    const lineCur = resolveInkCursor("line", "#deadbe");
    expect(lineCur).toContain("%23deadbe");

    const arrowCur = resolveInkCursor("arrow", "#abcdef");
    expect(arrowCur).toContain("%23abcdef");

    const rectCur = resolveInkCursor("rect", "#000000");
    expect(rectCur).toContain("%23000000");

    const circleCur = resolveInkCursor("circle", "#ffffff");
    expect(circleCur).toContain("%23ffffff");
  });

  it("changing color changes the cursor URI (cue 2 fires)", () => {
    const a = resolveInkCursor("pen", "#ff0000");
    const b = resolveInkCursor("pen", "#00ff00");
    expect(a).not.toBe(b);
  });
});
