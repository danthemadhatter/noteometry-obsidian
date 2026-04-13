import React, { useEffect, useRef, useState, useCallback } from "react";
import type { App } from "obsidian";

// pdfjs-dist v2.x legacy build — designed for environments without worker support.
// CRITICAL: disable worker entirely — Obsidian blocks web workers.
// @ts-ignore — pdfjs-dist@2 legacy CJS; TS may or may not resolve the module but esbuild bundles it fine.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

// Disable worker via BOTH available knobs
(pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = "";
(pdfjsLib as any).GlobalWorkerOptions.workerPort = null;

interface Props {
  app: App;
  vaultPath: string;
  page: number;
  onPageChange: (page: number) => void;
}

/**
 * Resolve a vault path by trying multiple strategies.
 * Returns the resolved path or throws with details of all attempts.
 */
async function resolveVaultPath(
  app: App,
  vaultPath: string,
): Promise<string> {
  const attempts: string[] = [];

  // Strategy 1: path as-is
  try {
    if (await app.vault.adapter.exists(vaultPath)) return vaultPath;
  } catch { /* continue */ }
  attempts.push(vaultPath);

  // Strategy 2: strip first path segment (vault name prefix)
  const stripped = vaultPath.split("/").slice(1).join("/");
  if (stripped) {
    try {
      if (await app.vault.adapter.exists(stripped)) return stripped;
    } catch { /* continue */ }
    attempts.push(stripped);
  }

  // Strategy 3: search all vault files for matching filename
  const filename = vaultPath.split("/").pop() ?? "";
  if (filename) {
    const match = app.vault.getFiles().find(f => f.name === filename);
    if (match) return match.path;
    attempts.push(`(filename search: ${filename})`);
  }

  throw new Error(
    `PDF not found. Tried:\n${attempts.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}`
  );
}

async function loadAndRenderPdf(
  app: App,
  vaultPath: string,
  canvasEl: HTMLCanvasElement,
  pageNum: number,
): Promise<{ numPages: number; resolvedPath: string }> {
  const resolvedPath = await resolveVaultPath(app, vaultPath);

  // Read raw bytes from vault — this is the ONLY safe way in Obsidian
  const arrayBuffer = await app.vault.adapter.readBinary(resolvedPath);

  // Load with ALL worker/fetch options disabled for Obsidian compatibility
  const loadingTask = (pdfjsLib as unknown as {
    getDocument: (opts: unknown) => { promise: Promise<unknown> };
  }).getDocument({
    data: new Uint8Array(arrayBuffer),
    disableWorker: true,
    disableRange: true,
    disableStream: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = (pdf as { numPages: number }).numPages;
  const safePage = Math.max(1, Math.min(numPages, pageNum));

  const page = await (pdf as {
    getPage: (n: number) => Promise<unknown>;
  }).getPage(safePage);

  // Scale to fit canvas width
  const viewport = (page as any).getViewport({ scale: 1.0 });
  const scale = canvasEl.width / viewport.width;
  const scaledViewport = (page as any).getViewport({ scale });

  canvasEl.height = scaledViewport.height;
  canvasEl.style.width = "100%";
  canvasEl.style.height = "auto";

  const ctx = canvasEl.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, scaledViewport.width, scaledViewport.height);

  await (page as {
    render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
  }).render({ canvasContext: ctx, viewport: scaledViewport }).promise;

  return { numPages, resolvedPath };
}

export default function PdfViewer({ app, vaultPath, page, onPageChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    setError(null);

    try {
      // Set initial canvas width from container
      const containerWidth = containerRef.current?.clientWidth || 400;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(containerWidth * dpr);

      const result = await loadAndRenderPdf(app, vaultPath, canvas, page);
      setPageCount(result.numPages);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load PDF";
      console.error("[Noteometry PDF] Load failed:", e);
      console.error("[Noteometry PDF] Attempted path:", vaultPath);
      console.error("[Noteometry PDF] pdfjs version:", (pdfjsLib as any).version);
      setError(`PDF load failed: ${msg}\nPath tried: ${vaultPath}`);
    } finally {
      setLoading(false);
    }
  }, [app, vaultPath, page]);

  // Render on mount, page change, or path change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await render();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [render]);

  // Re-render when the container is resized
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      render();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [render]);

  const prev = useCallback(() => {
    if (page > 1) onPageChange(page - 1);
  }, [page, onPageChange]);

  const next = useCallback(() => {
    if (page < pageCount) onPageChange(page + 1);
  }, [page, pageCount, onPageChange]);

  if (error) {
    return (
      <div className="noteometry-pdf-error">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 12 }}>
          <span style={{ fontWeight: 600 }}>PDF load failed</span>
          <span style={{ fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="noteometry-pdf-viewer">
      <div className="noteometry-pdf-toolbar">
        <button
          className="noteometry-pdf-nav"
          onClick={prev}
          disabled={loading || page <= 1}
          title="Previous page"
        >
          ◀
        </button>
        <span className="noteometry-pdf-page">
          {loading ? "Loading…" : `${page} / ${pageCount}`}
        </span>
        <button
          className="noteometry-pdf-nav"
          onClick={next}
          disabled={loading || page >= pageCount}
          title="Next page"
        >
          ▶
        </button>
      </div>
      <div ref={containerRef} className="noteometry-pdf-canvas-wrap">
        <canvas ref={canvasRef} className="noteometry-pdf-canvas" />
      </div>
    </div>
  );
}
