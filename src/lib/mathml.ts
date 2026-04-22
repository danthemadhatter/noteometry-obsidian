import katex from "katex";

/**
 * Render content with LaTeX as pure MathML (no KaTeX wrapper spans).
 * This produces bare <math> elements that Safari renders natively
 * and that copy-paste into Word as real equations.
 *
 * Extracted from ChatPanel.tsx so the conversion pipeline can be
 * unit-tested without mounting React. Runtime behavior is identical
 * to the original inline implementation.
 */
export function renderAsMathML(text: string): string {
  if (!text) return "";
  let result = text;

  const toMath = (tex: string, display: boolean): string => {
    try {
      const html = katex.renderToString(tex.trim(), {
        output: "mathml",
        displayMode: display,
        throwOnError: false,
      });
      const match = html.match(/<math[\s\S]*?<\/math>/);
      if (match) {
        return display
          ? `<div style="text-align:center;margin:8px 0">${match[0]}</div>`
          : match[0];
      }
      return html;
    } catch { return tex; }
  };

  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_m, tex) => toMath(tex, true));
  result = result.replace(/\$([^$]+?)\$/g, (_m, tex) => toMath(tex, false));
  result = result.replace(/\n/g, "<br>");
  return result;
}

/** Same as renderAsMathML but with <p> wrapping for Word clipboard. */
export function toMathMLForClipboard(text: string): string {
  const lines = text.split(/\n/);
  return lines
    .map((line) => {
      if (!line.trim()) return "";
      return `<p>${renderAsMathML(line)}</p>`;
    })
    .join("\n");
}

/**
 * Build the two MIME payloads that the primary Copy-to-Word path writes
 * via ClipboardItem: HTML (MathML-bearing) and plain text (raw LaTeX).
 *
 * This is a pure, DOM-free function so unit tests can assert the exact
 * shape of what lands on the clipboard. The live ChatPanel path wraps
 * these in Blobs — it does NOT call this helper yet by design, because
 * the runtime path must stay byte-identical. Treat this helper as the
 * contract the runtime path is expected to honor.
 */
export function buildClipboardPayload(text: string): { html: string; plain: string } {
  return {
    html: toMathMLForClipboard(text),
    plain: text,
  };
}
