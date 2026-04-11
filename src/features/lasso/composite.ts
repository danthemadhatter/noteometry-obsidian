/**
 * Multi-region composite builder.
 *
 * Takes N rasterized region snapshots (base64 PNGs) and stacks them
 * vertically into a single tall image with labeled bands between them.
 * The composite is what gets sent to the vision model as a single call
 * so the AI can reason about multiple regions together.
 *
 * Labels are numbered "Region 1", "Region 2", etc. so the model can
 * refer back to specific regions in its response.
 *
 * Phase 3 Part 2: simple vertical stack. Phase 3 Part 3 may add spatial
 * composition mode (preserve relative canvas positions) as a per-batch
 * toggle, but vertical stack is the default.
 */

/** Load a base64 data URL into an HTMLImageElement. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export interface CompositeOptions {
  /** Label band height in pixels. Default 32. */
  labelHeight?: number;
  /** Gap between regions in pixels. Default 16. */
  gap?: number;
  /** Outer padding in pixels. Default 16. */
  padding?: number;
  /** Label band background color. Default vellum (#f1e7cd). */
  labelBg?: string;
  /** Label text color. Default ink navy (#1a2a4a). */
  labelFg?: string;
  /** Composite background color. Default white. */
  backgroundColor?: string;
}

/**
 * Composite N region images into a single tall labeled PNG.
 *
 * - 0 regions: returns null
 * - 1 region:  returns that region's image unchanged (fast path, no labels)
 * - N regions: returns a vertically-stacked PNG with "Region N" bands
 */
export async function compositeRegions(
  imageDataUrls: string[],
  options: CompositeOptions = {},
): Promise<string | null> {
  if (imageDataUrls.length === 0) return null;
  if (imageDataUrls.length === 1) return imageDataUrls[0] ?? null;

  const {
    labelHeight = 32,
    gap = 16,
    padding = 16,
    labelBg = "#f1e7cd",
    labelFg = "#1a2a4a",
    backgroundColor = "#ffffff",
  } = options;

  let images: HTMLImageElement[];
  try {
    images = await Promise.all(imageDataUrls.map(loadImage));
  } catch (e) {
    console.error("[Noteometry] composite: failed to load region images:", e);
    return null;
  }

  // Dimensions: wide enough for the widest region, tall enough for all
  // regions stacked with a label band above each one.
  const contentWidth = Math.max(...images.map((img) => img.width));
  const contentHeight = images.reduce(
    (sum, img) => sum + labelHeight + img.height + gap,
    0,
  ) - gap; // no trailing gap

  const canvas = document.createElement("canvas");
  canvas.width = contentWidth + padding * 2;
  canvas.height = contentHeight + padding * 2;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw each region with its label band
  let y = padding;
  images.forEach((img, i) => {
    // Label band
    ctx.fillStyle = labelBg;
    ctx.fillRect(padding, y, contentWidth, labelHeight);

    // Label text
    ctx.fillStyle = labelFg;
    ctx.font = "bold 15px 'IBM Plex Mono', 'Courier New', monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(`Region ${i + 1}`, padding + 12, y + labelHeight / 2);

    // Divider line under the label band
    ctx.strokeStyle = labelFg;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, y + labelHeight + 0.5);
    ctx.lineTo(padding + contentWidth, y + labelHeight + 0.5);
    ctx.stroke();

    y += labelHeight;

    // Region image (centered if narrower than the widest region)
    const imgX = padding + (contentWidth - img.width) / 2;
    ctx.drawImage(img, imgX, y);

    y += img.height + gap;
  });

  return canvas.toDataURL("image/png");
}
