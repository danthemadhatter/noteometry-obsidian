import { describe, it, expect } from "vitest";
import {
  sanitizeDownloadName,
  htmlToPlainText,
  buildRichTextClipboardBlobs,
} from "../../src/lib/dropinExport";

/**
 * v1.6.12: contract tests for the drop-in export helpers. These keep the
 * download-PNG and rich-text copy paths honest by pinning the pure
 * transformations that sit in front of the DOM/clipboard APIs. The
 * html2canvas + ClipboardItem calls themselves live in CanvasObjectLayer
 * and are not covered here.
 */

describe("sanitizeDownloadName", () => {
  it("strips path/reserved characters and keeps ascii", () => {
    expect(sanitizeDownloadName("my/drop:in*?<name>")).toBe("my_drop_in_name_");
  });

  it("collapses leading dots that would hide the file on unix", () => {
    expect(sanitizeDownloadName("...hidden")).toBe("_hidden");
  });

  it("caps length at 120 chars so long names don't explode the path", () => {
    const long = "a".repeat(500);
    expect(sanitizeDownloadName(long).length).toBe(120);
  });

  it("returns the fallback when the cleaned name is empty", () => {
    // Whitespace-only input trims to empty, no sanitize-substitution triggers.
    expect(sanitizeDownloadName("   ", "fallback")).toBe("fallback");
  });

  it("defaults to drop-in when no fallback supplied", () => {
    expect(sanitizeDownloadName("")).toBe("drop-in");
  });
});

describe("htmlToPlainText", () => {
  it("turns <br> and block closers into newlines", () => {
    const html = "<p>one</p><p>two</p>line<br>break";
    expect(htmlToPlainText(html)).toBe("one\ntwo\nline\nbreak");
  });

  it("strips tags but keeps text content", () => {
    expect(htmlToPlainText("<b>bold</b> and <i>italic</i>")).toBe("bold and italic");
  });

  it("decodes basic entities", () => {
    expect(htmlToPlainText("a&nbsp;b &amp; c &lt;d&gt; &quot;e&quot; &#39;f&#39;"))
      .toBe("a b & c <d> \"e\" 'f'");
  });

  it("collapses runs of 3+ newlines to a paragraph break", () => {
    expect(htmlToPlainText("<p>a</p><p></p><p></p><p>b</p>")).toBe("a\n\nb");
  });

  it("empty input yields empty string", () => {
    expect(htmlToPlainText("")).toBe("");
  });
});

describe("buildRichTextClipboardBlobs", () => {
  it("emits exactly two MIME keys wired for ClipboardItem", () => {
    const blobs = buildRichTextClipboardBlobs("<p>hi</p>");
    expect(Object.keys(blobs).sort()).toEqual(["text/html", "text/plain"]);
  });

  it("html blob preserves the source markup", async () => {
    const blobs = buildRichTextClipboardBlobs("<p>hi <b>there</b></p>");
    const text = await blobs["text/html"].text();
    expect(text).toBe("<p>hi <b>there</b></p>");
  });

  it("plain blob is the stripped projection of the html", async () => {
    const blobs = buildRichTextClipboardBlobs("<p>hi <b>there</b></p>");
    const text = await blobs["text/plain"].text();
    expect(text).toBe("hi there");
  });

  it("both blobs declare the matching MIME type on the Blob itself", () => {
    const blobs = buildRichTextClipboardBlobs("<p>x</p>");
    expect(blobs["text/html"].type).toBe("text/html");
    expect(blobs["text/plain"].type).toBe("text/plain");
  });
});
