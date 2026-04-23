/**
 * v1.6.12: export helpers for drop-in chrome.
 *
 * These live in a separate file so their behavior (filename sanitization,
 * text-vs-html payload choice) can be pinned by unit tests without having
 * to mount the whole canvas object layer. The DOM rasterization itself
 * still lives in CanvasObjectLayer.tsx because it needs html2canvas and
 * the vault adapter.
 */

/** Strip characters that aren't safe on Windows / macOS / iOS file systems
 *  and cap length so a runaway drop-in name can't produce a rejected path.
 *  Returns a fallback name when the sanitized result is empty. */
export function sanitizeDownloadName(raw: string, fallback = "drop-in"): string {
  const cleaned = raw
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
    .replace(/^\.+/, "_")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

/** Plain-text projection of a HTML fragment — used as the copy-to-Word
 *  fallback when the system clipboard can't accept text/html. Strips tags,
 *  collapses whitespace, decodes basic entities. No attempt at rich
 *  formatting; Word users who want that paste the HTML path instead. */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  // `<br>` / `<p>` / `</div>` → newline before we strip the rest.
  const withBreaks = html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/(p|div|li|tr|h[1-6])\s*>/gi, "\n");
  const noTags = withBreaks.replace(/<[^>]+>/g, "");
  const decoded = noTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded.replace(/\n{3,}/g, "\n\n").trim();
}

/** Build the ClipboardItem blob map for Copy-as-HTML on rich text
 *  drop-ins. Returns both MIME types so the target app (Word, Google
 *  Docs, plain text field) can pick whichever it understands.
 *
 *  Named distinctly from mathml.ts::buildClipboardPayload — that helper
 *  returns a {html, plain} string pair for the Math v12 copy path and
 *  must not be touched. This helper returns Blobs wired to MIME keys
 *  that `new ClipboardItem(...)` consumes directly. */
export function buildRichTextClipboardBlobs(html: string): Record<string, Blob> {
  const plain = htmlToPlainText(html);
  return {
    "text/html": new Blob([html], { type: "text/html" }),
    "text/plain": new Blob([plain], { type: "text/plain" }),
  };
}
