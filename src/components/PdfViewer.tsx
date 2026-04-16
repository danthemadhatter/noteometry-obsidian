import React, { useEffect, useRef, useState, useCallback } from "react";
import type NoteometryPlugin from "../main";
import { loadPdfFromVault } from "../lib/persistence";

/* ── PDF Viewer — Chromium native renderer ─────────────────
 * pdfjs-dist is PERMANENTLY broken in Obsidian's esbuild pipeline.
 * The `GlobalWorkerOptions.workerSrc` error cannot be fixed because
 * esbuild hoists and evaluates the pdfjs module before any user code
 * runs — no amount of require(), lazy-load, or pre-assignment tricks
 * survive the bundler.
 *
 * Solution: bypass pdfjs entirely. Obsidian runs on Electron, which
 * is Chromium, which has a built-in PDF viewer. We read the binary
 * from the vault, create a Blob URL, and render it in an <iframe>.
 * Chromium's native PDF viewer handles rendering, zoom, scroll, and
 * text selection. Page navigation uses the #page=N URL fragment.
 *
 * Advantages over pdfjs:
 *   - Zero bundling issues (no external module)
 *   - Faster rendering (native C++ vs JS canvas)
 *   - Text selection, built-in search, zoom all work for free
 *   - No worker thread needed
 * ─────────────────────────────────────────────────────────── */

interface Props {
  fileRef: string;
  page: number;
  onPageChange: (page: number) => void;
  plugin?: NoteometryPlugin;
}

export default function PdfViewer({ fileRef, page, onPageChange, plugin }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const blobUrlRef = useRef<string | null>(null);

  // ── Load PDF binary and create Blob URL ────────────────
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);

    // Clean up previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setBlobUrl(null);
    }

    const timeout = setTimeout(() => {
      if (!cancelled && !blobUrl) {
        setError("Timed out loading PDF (15s)");
        setLoading(false);
      }
    }, 15_000);

    (async () => {
      try {
        let data: ArrayBuffer;

        if (fileRef.startsWith("data:")) {
          // Legacy data URL fallback
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

        if (cancelled) return;

        const blob = new Blob([data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load PDF";
          setError(msg);
          console.error("[Noteometry] PDF load failed:", e);
        }
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [fileRef, plugin, retryCount]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  // Page navigation buttons
  const prev = useCallback(() => {
    if (page > 1) onPageChange(page - 1);
  }, [page, onPageChange]);

  const next = useCallback(() => {
    onPageChange(page + 1);
  }, [page, onPageChange]);

  // ── Error state ────────────────────────────────────────
  if (error) {
    return (
      <div className="noteometry-pdf-error" style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", gap: "6px", padding: "16px",
        textAlign: "center",
      }}>
        <span style={{ color: "#DC2626", fontWeight: 600 }}>PDF load failed</span>
        <span style={{ fontSize: "10px", color: "#999", wordBreak: "break-all" }}>
          {error}
        </span>
        <button
          onClick={() => { setError(null); setRetryCount(c => c + 1); }}
          style={{
            marginTop: "8px", padding: "4px 12px", fontSize: "12px",
            border: "1px solid #E0E0E0", borderRadius: "4px", cursor: "pointer",
            background: "var(--nm-faceplate, #F5F5F5)",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────
  if (loading || !blobUrl) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", color: "#999", fontSize: "12px",
      }}>
        Loading PDF...
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────
  // Chromium's built-in PDF viewer supports #page=N for navigation.
  // We use a key to force iframe remount on page change since changing
  // the hash alone doesn't trigger navigation in blob URLs.
  const iframeSrc = `${blobUrl}#page=${page}`;

  return (
    <div className="noteometry-pdf-viewer" style={{
      display: "flex", flexDirection: "column", height: "100%",
    }}>
      <div className="noteometry-pdf-toolbar" style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: "8px", padding: "4px 8px", borderBottom: "1px solid #E0E0E0",
        background: "var(--nm-faceplate, #F5F5F5)", flexShrink: 0,
      }}>
        <button className="noteometry-pdf-nav" onClick={prev}
          disabled={page <= 1} title="Previous page"
          style={{
            padding: "2px 8px", border: "1px solid #E0E0E0", borderRadius: "4px",
            background: "var(--nm-faceplate, #F5F5F5)", cursor: page <= 1 ? "default" : "pointer",
            opacity: page <= 1 ? 0.4 : 1,
          }}
        >
          ◀
        </button>
        <span className="noteometry-pdf-page" style={{
          fontSize: "11px", color: "var(--nm-ink, #1A1A2E)",
          fontFamily: "var(--nm-font-mono, monospace)",
        }}>
          Page {page}
        </span>
        <button className="noteometry-pdf-nav" onClick={next}
          title="Next page"
          style={{
            padding: "2px 8px", border: "1px solid #E0E0E0", borderRadius: "4px",
            background: "var(--nm-faceplate, #F5F5F5)", cursor: "pointer",
          }}
        >
          ▶
        </button>
      </div>
      <iframe
        key={`pdf-page-${page}`}
        src={iframeSrc}
        style={{
          flex: 1, width: "100%", border: "none",
          background: "#ffffff",
        }}
        title="PDF Viewer"
      />
    </div>
  );
}
