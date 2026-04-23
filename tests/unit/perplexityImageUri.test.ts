import { describe, it, expect } from "vitest";
import { toImageMediaType } from "../../src/lib/aiImageFormat";

/**
 * v1.6.11 regression: Perplexity returned
 *   HTTP 400: data URI must start with 'data:image/'
 * when a user attached an image whose mimeType was empty or not an
 * image/* type (e.g. paste with `mimeType: ""`, or a file picker
 * reporting `application/octet-stream`). toImageMediaType coerces
 * those cases to `image/png` so the request is structurally valid.
 *
 * If the bytes aren't actually PNG the provider will still reject —
 * but now with a useful error rather than a silent malformed payload.
 */

describe("toImageMediaType", () => {
  it("passes through a valid image/* mime type", () => {
    expect(toImageMediaType("image/png")).toBe("image/png");
    expect(toImageMediaType("image/jpeg")).toBe("image/jpeg");
    expect(toImageMediaType("image/webp")).toBe("image/webp");
  });

  it("lowercases the media type for predictability", () => {
    expect(toImageMediaType("IMAGE/PNG")).toBe("image/png");
  });

  it("falls back to image/png for empty / undefined mime type", () => {
    expect(toImageMediaType("")).toBe("image/png");
    expect(toImageMediaType(undefined)).toBe("image/png");
  });

  it("falls back to image/png for non-image mime types", () => {
    expect(toImageMediaType("application/octet-stream")).toBe("image/png");
    expect(toImageMediaType("application/pdf")).toBe("image/png");
    expect(toImageMediaType("text/plain")).toBe("image/png");
  });

  it("guarantees the result starts with 'image/' (the Perplexity invariant)", () => {
    for (const input of ["", "foo", "application/pdf", "image/png", "IMAGE/JPEG"]) {
      expect(toImageMediaType(input).startsWith("image/")).toBe(true);
    }
  });
});
