/**
 * Cursor-color indicator — v1.11.0 phase-2 sub-PR 2.2.
 *
 * Design doc §4 cue 2: the canvas cursor recolors based on the active
 * pen color so the user can confirm "what am I about to draw with?"
 * without opening any toolbar layer. ADHD-friendly: zero clicks, zero
 * memory load — the answer is under your finger.
 *
 * We build a tiny SVG dot data-URI cursor. It's a 16×16 hotspot-
 * centered crosshair-with-dot that picks up the active color. Tools
 * that don't paint (grab, eraser, default) keep their existing
 * cursor strings; only "pen", "line", "arrow", "rect", "circle"
 * use the colored crosshair.
 *
 * Why not CSS `caret-color` or filters: the canvas cursor is a CSS
 * `cursor:` value — it accepts `url(...)` data-URIs directly. No
 * canvas tinting needed.
 */

export type PaintTool = "pen" | "line" | "arrow" | "rect" | "circle";
export type AnyTool =
  | PaintTool
  | "grab"
  | "eraser"
  | "select"
  | "default"
  | (string & {});

const PAINT_TOOLS = new Set<string>([
  "pen",
  "line",
  "arrow",
  "rect",
  "circle",
]);

export function isPaintTool(tool: string): tool is PaintTool {
  return PAINT_TOOLS.has(tool);
}

/**
 * Sanitize a CSS color so it's safe to embed in an SVG attribute. We
 * accept hex (#rgb, #rrggbb, #rrggbbaa) and named colors / functional
 * notations like `rgb(...)`, `hsl(...)`, `oklch(...)`. We strip any
 * characters that could break out of an attribute.
 */
export function sanitizeCssColor(color: string): string {
  // Drop quotes and angle brackets defensively. Keep parentheses,
  // commas, percent, decimal point, hex/letter/digit.
  return color.replace(/["'<>]/g, "").trim();
}

/**
 * Build an SVG data-URI cursor with a colored crosshair dot.
 * 16×16, hotspot at center.
 */
export function buildPenCursorUri(color: string): string {
  const safe = sanitizeCssColor(color);
  // Crosshair lines in a neutral mid-tone for visibility on both light
  // and dark canvas; central dot uses the active color.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">` +
      `<line x1="8" y1="1" x2="8" y2="6" stroke="#888" stroke-width="1"/>` +
      `<line x1="8" y1="10" x2="8" y2="15" stroke="#888" stroke-width="1"/>` +
      `<line x1="1" y1="8" x2="6" y2="8" stroke="#888" stroke-width="1"/>` +
      `<line x1="10" y1="8" x2="15" y2="8" stroke="#888" stroke-width="1"/>` +
      `<circle cx="8" cy="8" r="2.5" fill="${safe}" stroke="#222" stroke-width="0.75"/>` +
    `</svg>`;
  const encoded = encodeURIComponent(svg);
  return `url("data:image/svg+xml;utf8,${encoded}") 8 8, crosshair`;
}

/**
 * Resolve the CSS `cursor` value for the ink canvas given the active
 * tool and pen color. Mirrors the historical inline expression in
 * InkCanvas.tsx but routes paint tools through `buildPenCursorUri` so
 * cue 2 fires without any other change.
 */
export function resolveInkCursor(tool: AnyTool, color: string): string {
  if (tool === "grab") return "grab";
  if (tool === "eraser") return "cell";
  if (typeof tool === "string" && isPaintTool(tool)) {
    return buildPenCursorUri(color);
  }
  return "default";
}
