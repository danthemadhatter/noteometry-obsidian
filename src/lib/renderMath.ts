/**
 * v1.14.2 — Render LaTeX to HTML wrapped in a tagged, non-editable span.
 *
 * The wrapper `<span class="nm-math …" data-latex="…" data-display="…"
 * contenteditable="false">` does three jobs that bare KaTeX output can't:
 *
 *  1. Round-trip editable. The original LaTeX is preserved as a
 *     `data-latex` attribute, so the RichTextEditor click handler can
 *     re-prompt with the source string and replace the rendered atom
 *     with a freshly-rendered one.
 *  2. Single atom inside contenteditable. `contenteditable="false"`
 *     stops the user from accidentally typing into the KaTeX DOM (which
 *     would corrupt the rendering); cursor navigates around the math
 *     block as a unit, and Backspace deletes the whole thing cleanly.
 *  3. Display-mode aware. Inline (default) flows with the text; display
 *     gets its own block via `nm-math-display` styling.
 *
 * Used by:
 *  - `chatToHtml` — chat-exported math arrives as editable atoms.
 *  - `RichTextEditor` insert-math toolbar buttons + click-to-edit.
 */

import katex from "katex";

export function renderMathHtml(latex: string, displayMode: boolean): string {
  const src = latex ?? "";
  let inner: string;
  try {
    inner = katex.renderToString(src, {
      displayMode,
      throwOnError: false,
      output: "html",
    });
  } catch {
    inner = `<span class="katex-error">${escapeText(src)}</span>`;
  }
  const cls = displayMode ? "nm-math nm-math-display" : "nm-math nm-math-inline";
  return `<span class="${cls}" data-latex="${escapeAttr(src)}" data-display="${displayMode}" contenteditable="false">${inner}</span>`;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
