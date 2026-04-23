/**
 * Pure helpers for AI-provider image payload formatting. Extracted from
 * `ai.ts` so the unit test can import them without pulling in the
 * `obsidian` runtime (`requestUrl` etc.). The live provider-call code
 * in `ai.ts` re-exports these and uses them at the boundary.
 */

/**
 * Normalise a media type so the resulting data URI starts with `data:image/`.
 * Perplexity rejects anything that doesn't (HTTP 400: "data URI must start
 * with 'data:image/'"), which previously bit users when an attachment
 * arrived with an empty or non-image mime type (e.g. a paste with
 * `mimeType: ""` or a file picker that reported `application/octet-stream`).
 * This helper coerces those cases to `image/png` so the request is at
 * least structurally valid; if the bytes aren't actually PNG the
 * provider will still reject, but now with a useful error instead of a
 * silent malformed payload.
 */
export function toImageMediaType(mediaType: string | undefined): string {
  const m = (mediaType || "").trim().toLowerCase();
  if (m.startsWith("image/")) return m;
  return "image/png";
}
