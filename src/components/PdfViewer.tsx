import React, { useEffect, useRef, useState, useCallback } from "react";
import type { App } from "obsidian";

// pdfjs-dist v2.x legacy build — designed for environments without worker support.
// CRITICAL: disable worker entirely — Obsidian blocks web workers.
// @ts-ignore — pdfjs-dist@2 legacy CJS; TS may or may not resolve the module but esbuild bundles it fine.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

// Use a data URL for the fake worker — Blob URLs can hang in Obsidian's sandbox.
const FAKE_WORKER = `data:text/javascript,/* Fake pdfjs worker */self.addEventListener('message',function(e){self.postMessage({type:'ready'})})`;
(pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = FAKE_WORKER;
(pdfjsLib as any).GlobalWorkerOptions.workerPort = null;

interface Props {
  app: App;
  vaultPath: string;
  page: number;
  onPageChange: (page: number) => void;
  /** Optional: called when user re-links to a new PDF file */
  onRelink?: (newPath: string) => void;
}

/**
 * Resolve a vault path by trying multiple strategies.
 */
async function resolveVaultPath(
  app: App,
  storedPath: string,
): Promise<string | null> {
  // Try 1: exact path
  try {
    if (await app.vault.adapter.exists(storedPath)) return storedPath;
  } catch { /* continue */ }

  // Try 2: strip first segment (vault name prefix)
  const withoutFirst = storedPath.split("/").slice(1).join("/");
  if (withoutFirst) {
    try {
      if (await app.vault.adapter.exists(withoutFirst)) return withoutFirst;
    } catch { /* continue */ }
  }

  // Try 3: strip two segments
  const withoutTwo = storedPath.split("/").slice(2).join("/");
  if (withoutTwo) {
    try {
      if (await app.vault.adapter.exists(withoutTwo)) return withoutTwo;
    } catch { /* continue */ }
  }

  // Try 4: filename search across all vault files
  const filename = storedPath.split("/").pop();
  if (filename) {
    const match = app.vault.getFiles().find(
      f => f.name === filename || f.path.endsWith("/" + filename)
    );
    if (match) return match.path;
  }

  return null;
}

async function loadPdfDocument(
  app: App,
  vaultPath: string,
): Promise<{ pdf: any; resolvedPath: string }> {
  const resolvedPath = await resolveVaultPath(app, vaultPath);
  if (!resolvedPath) {
    throw new Error(
      `PDF not found. Tried:\n  1. ${vaultPath}\n  2. strip 1 segment\n  3. strip 2 segments\n  4. filename search`
    );
  }

  const arrayBuffer = await app.vault.adapter.readBinary(resolvedPath);
  const loadingTask = (pdfjsLib as unknown as {
    getDocument: (opts: unknown) => { promise: Promise<unknown>; destroy?: () => void };
  }).getDocument({
    data: new Uint8Array(arrayBuffer),
    disableWorker: true,
    disableRange: true,
    disableStream: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await Promise.race([
    loadingTask.promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("PDF load timeout after 15s")), 15000)
    ),
  ]);

  return { pdf, resolvedPath };
}

async function renderPage(
  pdf: any,
  pageNum: number,
  canvasEl: HTMLCanvasElement,
  containerWidth: number,
): Promise<void> {
  const numPages = (pdf as { numPages: number }).numPages;
  const safePage = Math.max(1, Math.min(numPages, pageNum));
  const page = await pdf.getPage(safePage);

  const dpr = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: 1.0 });
  const scale = (containerWidth * dpr) / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  canvasEl.width = scaledViewport.width;
  canvasEl.height = scaledViewport.height;
  canvasEl.style.width = "100%";
  canvasEl.style.height = "auto";

  const ctx = canvasEl.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, scaledViewport.width, scaledViewport.height);

  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
}

export default function PdfViewer({ app, vaultPath, page, onPageChange, onRelink }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [renderingPage, setRenderingPage] = useState(false);

  // Load the PDF document once
  const loadDoc = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { pdf } = await loadPdfDocument(app, vaultPath);
      pdfRef.current = pdf;
      setPageCount(pdf.numPages);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load PDF";
      console.error("[Noteometry PDF] Load failed:", e);
      setError(msg);
      pdfRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [app, vaultPath]);

  // Render the current page
  const renderCurrentPage = useCallback(async () => {
    const canvas = canvasRef.current;
    const pdf = pdfRef.current;
    if (!canvas || !pdf) return;

    setRenderingPage(true);
    try {
      const containerWidth = containerRef.current?.clientWidth || 400;
      await renderPage(pdf, page, canvas, containerWidth);
    } catch (e) {
      console.error("[Noteometry PDF] Page render failed:", e);
    } finally {
      setRenderingPage(false);
    }
  }, [page]);

  // Load doc on mount / path change
  useEffect(() => {
    loadDoc();
  }, [loadDoc]);

  // Render page when doc is loaded or page changes
  useEffect(() => {
    if (pdfRef.current && !loading) {
      renderCurrentPage();
    }
  }, [loading, page, renderCurrentPage]);

  // Re-render on container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (pdfRef.current) renderCurrentPage();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [renderCurrentPage]);

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
          <button
            className="noteometry-pdf-relink"
            onClick={() => {
              // Re-trigger load — the file may have synced since the last attempt
              loadDoc();
            }}
          >
            Retry
          </button>
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
          disabled={loading || renderingPage || page <= 1}
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
          disabled={loading || renderingPage || page >= pageCount}
          title="Next page"
        >
          ▶
        </button>
      </div>
      <div ref={containerRef} className="noteometry-pdf-canvas-wrap">
        {(loading || renderingPage) && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.6)", zIndex: 2,
          }}>
            <span className="noteometry-pulse" style={{ fontSize: 13, color: "var(--nm-ink-muted)" }}>
              {loading ? "Loading PDF…" : "Rendering…"}
            </span>
          </div>
        )}
        <canvas ref={canvasRef} className="noteometry-pdf-canvas" />
      </div>
    </div>
  );
}
