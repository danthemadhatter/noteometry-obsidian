import html2canvas from "html2canvas";

/**
 * Lasso rasterizer — the "dumb pipe" that converts whatever is visible
 * in a canvas region into a base64 PNG, regardless of what data model
 * produced it.
 *
 * This is the architectural heart of the v2 Noteometry reframe: the
 * canvas is stupid on purpose, and the model does the interpretation.
 * The rasterizer does not know what a stroke is, what a text box is,
 * what a table is, or what an image is. It takes a DOM element and a
 * rectangle and hands the resulting pixels to the AI.
 *
 * Replaces the interpretive renderLassoRegionToImage path that used to
 * render "[Text Box]" and "[Table]" placeholders instead of the actual
 * rich content — a bug that silently discarded information before it
 * ever reached the model.
 */

export interface RasterizeRegion {
  /** Top-left x in container-relative CSS pixels (i.e. after any scroll) */
  minX: number;
  /** Top-left y in container-relative CSS pixels */
  minY: number;
  /** Bottom-right x in container-relative CSS pixels */
  maxX: number;
  /** Bottom-right y in container-relative CSS pixels */
  maxY: number;
}

export interface RasterizeOptions {
  /** Device-pixel scale factor. Default 2 (retina) for OCR clarity. */
  scale?: number;
  /** Background color under transparent pixels. Default white so the AI sees clean background. */
  backgroundColor?: string;
  /** Padding in CSS pixels added around the region before cropping. */
  padding?: number;
}

/**
 * Rasterize the visible contents of a region within a container element
 * to a PNG data URL. Works for ink canvas, DOM overlays (text boxes,
 * tables, images), and anything else that shows up in the container
 * — because it's just capturing pixels.
 *
 * Returns null on failure (caller should surface via Notice or fall back).
 */
export async function rasterizeRegion(
  container: HTMLElement,
  region: RasterizeRegion,
  options: RasterizeOptions = {},
): Promise<string | null> {
  const { scale = 2, backgroundColor = "#ffffff", padding = 8 } = options;

  const x = Math.max(0, Math.floor(region.minX - padding));
  const y = Math.max(0, Math.floor(region.minY - padding));
  const width = Math.ceil(region.maxX - region.minX + padding * 2);
  const height = Math.ceil(region.maxY - region.minY + padding * 2);

  if (width <= 0 || height <= 0) return null;

  try {
    const canvas = await html2canvas(container, {
      x,
      y,
      width,
      height,
      scale,
      backgroundColor,
      useCORS: true,
      allowTaint: false,
      logging: false,
      // html2canvas clones the DOM. For native <canvas> children (the ink
      // layer), we need to copy the bitmap content into the clone before
      // rendering. html2canvas v1.4.x handles this automatically for most
      // cases, but we add an onclone hook as belt-and-suspenders.
      onclone: (clonedDoc) => {
        const originalCanvases = container.querySelectorAll<HTMLCanvasElement>("canvas");
        const clonedRoot = clonedDoc.querySelector<HTMLElement>(
          // Find the cloned counterpart by class. The canvas area's root
          // will have a stable class name from NoteometryApp.
          ".noteometry-canvas-area"
        ) ?? clonedDoc.body;
        const clonedCanvases = clonedRoot.querySelectorAll<HTMLCanvasElement>("canvas");
        clonedCanvases.forEach((cloned, i) => {
          const original = originalCanvases[i];
          if (!original) return;
          const ctx = cloned.getContext("2d");
          if (!ctx) return;
          cloned.width = original.width;
          cloned.height = original.height;
          try {
            ctx.drawImage(original, 0, 0);
          } catch {
            /* ignore — tainted or oversized */
          }
        });
      },
    });
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.error("[Noteometry] rasterize failed:", e);
    return null;
  }
}
