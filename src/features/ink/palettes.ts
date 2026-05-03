/**
 * Ink color + stroke width palettes.
 *
 * Extracted from NoteometryApp in v1.11.0 phase-5 so the ToolLayer
 * (and any future surface) can render the same palette without
 * duplicating the source of truth. The right-click context menu and
 * the tool layer toolbar both consume these arrays.
 *
 * No React, no Obsidian — pure data, fully testable.
 */

export interface InkColorEntry {
  color: string;
  label: string;
}

export interface StrokeWidthEntry {
  width: number;
  label: string;
}

export const INK_COLORS: ReadonlyArray<InkColorEntry> = [
  { color: "#202124", label: "Black" },
  { color: "#d93025", label: "Red" },
  { color: "#1a73e8", label: "Blue" },
  { color: "#188038", label: "Green" },
  { color: "#e8710a", label: "Orange" },
  { color: "#9334e6", label: "Purple" },
];

export const STROKE_WIDTHS: ReadonlyArray<StrokeWidthEntry> = [
  { width: 1.5, label: "Fine" },
  { width: 3, label: "Medium" },
  { width: 5, label: "Thick" },
  { width: 8, label: "Marker" },
];

/** Cycle helper used by both context menu and tool layer keyboard
 *  shortcuts. Returns the next entry; wraps at the end. */
export function nextColor(current: string): InkColorEntry {
  const idx = INK_COLORS.findIndex((c) => c.color === current);
  return INK_COLORS[(idx + 1) % INK_COLORS.length]!;
}

export function nextWidth(current: number): StrokeWidthEntry {
  const idx = STROKE_WIDTHS.findIndex((w) => w.width === current);
  return STROKE_WIDTHS[(idx + 1) % STROKE_WIDTHS.length]!;
}
