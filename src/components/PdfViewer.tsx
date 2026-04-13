import React, { useEffect, useRef, useState, useCallback } from "react";
import type NoteometryPlugin from "../main";
import { loadPdfFromVault } from "../lib/persistence";

// pdfjs-dist v2.x — the last version that supports disableWorker: true
// in getDocument(). v3+ requires an explicit worker URL which doesn't
// reliably resolve inside Obsidian's Electron/mobile sandbox. v2 runs
// everything on the main thread when disableWorker is set, which is
// slower for huge PDFs but works on every platform without any worker
// bundling gymnastics.
// @ts-expect-error — pdfjs-dist@2 ships untyped CJS; TS can't resolve the module but esbuild bundles it fine.
import * as pdfjsLib from "pdfjs-dist/build/pdf";
(pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = "";

interface Props {
  fileRef: string;
  page: number;
  /** Called whenever the user navigates to a different page so the parent
   * can persist the new page into the canvas object. */
  onPageChange: (page: number) => void;
  plugin?: NoteometryPlugin;
  onRelink?: () => void;
}

interface PdfState {
  doc: unknown; // pdfjs PDFDocumentProxy
  pageCount: number;
}

/**
 * Renders a single PDF page to a <canvas> element. The canvas is a
 * native DOM canvas, so html2canvas (the lasso rasterizer) can capture
 * its pixels directly — which is the whole point of this component.
 * Iframes would have been simpler but cross-origin sandboxing would
 * have broken the rect-lasso → vision-model OCR pipeline.
 */
export default function PdfViewer({ fileRef, page, onPageChange, plugin, onRelink }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PdfState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderSize, setRenderSize] = useState(0);

  // Load the document once per fileRef. Re-reads if the path changes
  // (e.g. if the user replaces the PDF via some future feature).
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setState(null);
    (async () => {
      try {
        let data: ArrayBuffer;
        if (fileRef.startsWith("data:")) {
          // Data URL fallback — decode inline.
          const base64 = fileRef.replace(/^data:application\/pdf;base64,/, "");
          const binary = atob(base64);
          const buf = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
          data = buf.buffer;
        } else if (plugin) {
          data = await loadPdfFromVault(plugin, fileRef);
        } else {
          throw new Error("No plugin available to read vault file");
        }
        const loadingTask = (pdfjsLib as unknown as {
          getDocument: (opts: unknown) => { promise: Promise<unknown> };
        }).getDocument({ data, disableWorker: true });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        const pageCount = (doc as { numPages: number }).numPages;
        setState({ doc, pageCount });
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load PDF";
          setError(msg);
          console.error("[Noteometry] PDF load failed:", e);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [fileRef, plugin]);

  // Track container width so we can re-render when the element resizes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setRenderSize(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Render the requested page any time the doc OR the page changes.
  useEffect(() => {
    if (!state || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const safePage = Math.max(1, Math.min(state.pageCount, page));
    let cancelled = false;
    setRendering(true);

    (async () => {
      try {
        const pdfPage = await (state.doc as {
          getPage: (n: number) => Promise<unknown>;
        }).getPage(safePage);
        if (cancelled) return;
        // Scale the page to fill the container width. Fall back to 400px
        // if the container hasn't been measured yet.
        const containerWidth = containerRef.current?.clientWidth || 400;
        const baseViewport = (pdfPage as any).getViewport({ scale: 1 });
        const scale = (containerWidth / baseViewport.width) * (window.devicePixelRatio || 1);
        const viewport = (pdfPage as any).getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Could not get 2D context for PDF canvas");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, viewport.width, viewport.height);
        await (pdfPage as {
          render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
        }).render({ canvasContext: ctx, viewport }).promise;
      } catch (e) {
        if (!cancelled) {
          console.error("[Noteometry] PDF render failed:", e);
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => { cancelled = true; };
  }, [state, page, renderSize]);

  const prev = useCallback(() => {
    if (!state) return;
    if (page > 1) onPageChange(page - 1);
  }, [state, page, onPageChange]);

  const next = useCallback(() => {
    if (!state) return;
    if (page < state.pageCount) onPageChange(page + 1);
  }, [state, page, onPageChange]);

  if (error) {
    return (
      <div className="noteometry-pdf-error">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span>PDF not found: {fileRef}</span>
          {onRelink && (
            <button className="noteometry-pdf-relink" onClick={onRelink}>
              Re-link PDF
            </button>
          )}
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
          disabled={!state || page <= 1}
          title="Previous page"
        >
          ◀
        </button>
        <span className="noteometry-pdf-page">
          {state ? `${page} / ${state.pageCount}` : rendering ? "…" : "loading"}
        </span>
        <button
          className="noteometry-pdf-nav"
          onClick={next}
          disabled={!state || page >= (state?.pageCount ?? 1)}
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
