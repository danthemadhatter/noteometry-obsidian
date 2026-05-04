import React, { useRef, useCallback, useState, useEffect } from "react";
import { Notice } from "obsidian";
import type { CanvasObject } from "../lib/canvasObjects";
import { defaultObjectName, createImageObject, createTextBox } from "../lib/canvasObjects";
import { shouldStartObjectDrag } from "../lib/objectDragHitTest";
import { shouldSkipBringToFront } from "../lib/dropinFocusGuards";
import { sanitizeDownloadName, htmlToPlainText, buildRichTextClipboardBlobs } from "../lib/dropinExport";
import { getTextBoxData, setTextBoxData } from "../lib/tableStore";
import { chatToHtml } from "../lib/chatToHtml";
import type { ChatMessage } from "../types";
import type { CanvasTool } from "./InkCanvas";
import type NoteometryPlugin from "../main";
import { loadImageFromVault, saveImageBytesTo } from "../lib/persistence";
import RichTextEditor from "./RichTextEditor";
import TableEditor from "./TableEditor";
import PdfViewer from "./PdfViewer";
import MathDropin from "./dropins/MathDropin";
import ChatDropin from "./dropins/ChatDropin";

/** Editable title input at the top of every canvas object. Click to
 * edit, Enter/blur to commit, Escape to revert. The input also doubles
 * as the drag handle — onPointerDown on the wrapper starts the drag
 * unless the input is focused for editing. */
/** Snapshot a DOM element to clipboard using html2canvas.
 *  Uses the same import that the lasso rasterizer uses. */
let _html2canvas: typeof import("html2canvas").default | null = null;
function getHtml2Canvas() {
  if (!_html2canvas) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _html2canvas = (require("html2canvas") as { default?: unknown }).default as typeof _html2canvas
      ?? require("html2canvas") as typeof _html2canvas;
  }
  return _html2canvas!;
}

/**
 * v1.6.12: rasterize a drop-in DOM subtree to a PNG data URL.
 *
 * Returns null (with a Notice) if rasterization fails — html2canvas can
 * trip on iframes, certain PDF renderers, and cross-origin images. The
 * caller decides what to do next: drop onto the canvas, download, or
 * show a pending design note.
 */
async function rasterizeDropin(el: HTMLElement): Promise<string | null> {
  try {
    const html2canvas = getHtml2Canvas();
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
      useCORS: true,
    });
    const dataURL = canvas.toDataURL("image/png");
    if (!dataURL || !dataURL.startsWith("data:image/")) {
      console.warn("[Noteometry] rasterize produced non-image payload");
      return null;
    }
    return dataURL;
  } catch (err) {
    console.error("[Noteometry] html2canvas failed:", err);
    return null;
  }
}

/** Canvas width/height of the decoded data URL, used to preserve aspect
 *  when writing the snapshot back into an image object. */
async function measureDataUrl(dataURL: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve(null);
    img.src = dataURL;
  });
}

/**
 * v1.6.12: Snapshot a drop-in onto the canvas.
 *
 * Before v1.6.11 the screenshot button rasterized the drop-in to a PNG
 * and wrote it to the system clipboard. v1.6.11 switched to "drop an
 * image object next to the source." The user reported this was still
 * not working reliably — html2canvas silently returns blank canvases
 * for iframe-backed drop-ins (PDFs) and certain SVG renderers.
 *
 * v1.6.12 wraps the rasterize call in a diagnostic path: on failure we
 * surface a Notice AND offer the download-PNG fallback when possible.
 */
async function snapshotElementToCanvas(
  el: HTMLElement,
  source: CanvasObject,
  plugin: NoteometryPlugin | undefined,
  parentFolder: string | undefined,
  addObject: (obj: CanvasObject) => void,
  onSelect?: (id: string) => void,
): Promise<void> {
  const dataURL = await rasterizeDropin(el);
  if (!dataURL) {
    new Notice("Snapshot failed — this drop-in can't be rasterized in-place. Try the Download option.", 7000);
    return;
  }
  const measured = await measureDataUrl(dataURL);
  if (!measured) {
    new Notice("Snapshot failed — rasterized image was unreadable", 6000);
    return;
  }
  try {
    // Scale the on-canvas image so it matches the drop-in's apparent
    // width (html2canvas gives us a 2× backing store, so the natural
    // pixel size is double the DOM width).
    const targetW = Math.min(Math.round(source.w * 0.9), 520);
    const aspect = measured.h / Math.max(1, measured.w);
    const targetH = Math.round(targetW * aspect);
    const newObj = createImageObject(
      source.x + 40,
      source.y + source.h + 16,
      dataURL,
      targetW,
      targetH,
      `${source.name ?? "Snapshot"} · snapshot`,
    );
    // Persist to the vault if we have a plugin + parent folder so the
    // image survives reloads and syncs across devices.
    if (plugin && parentFolder) {
      try {
        const vaultPath = await saveImageBytesTo(plugin.app, parentFolder, newObj.id, dataURL);
        newObj.dataURL = vaultPath;
      } catch (err) {
        console.error("[Noteometry] snapshot vault save failed:", err);
        new Notice("Snapshot saved in-memory only — vault write failed", 6000);
      }
    }
    addObject(newObj);
    // v1.6.13: select the new snapshot and surface an explicit success
    // Notice. v1.6.12 dropped the image below the source without any
    // visible feedback, so the user reported "screenshot works but is
    // awkward — nothing tells me anything happened."
    if (onSelect) onSelect(newObj.id);
    new Notice("Snapshot added to canvas", 2500);
  } catch (e) {
    console.error("[Noteometry] Snapshot failed:", e);
    new Notice("Snapshot failed — see console", 6000);
  }
}

/** Download a rasterized drop-in as a .png — works even when the
 *  in-canvas drop fails (iframe / PDF / CORS drop-ins). */
async function downloadDropinAsPng(el: HTMLElement, filename: string): Promise<void> {
  const dataURL = await rasterizeDropin(el);
  if (!dataURL) {
    new Notice("Download failed — this drop-in can't be rasterized. Try the OS screenshot tool.", 7000);
    return;
  }
  const link = document.createElement("a");
  link.download = `${sanitizeDownloadName(filename)}.png`;
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Download a vault-backed image as-is (preserves original resolution). */
async function downloadImageDataUrl(dataURL: string, filename: string): Promise<void> {
  const link = document.createElement("a");
  // Detect extension from the data URL mime; default to png.
  const match = /^data:image\/([a-zA-Z0-9+.-]+);/.exec(dataURL);
  const ext = match?.[1]?.toLowerCase() === "jpeg" ? "jpg" : (match?.[1] ?? "png");
  link.download = `${sanitizeDownloadName(filename)}.${ext}`;
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** v1.6.12: copy text-box contents to the system clipboard as both
 *  text/html and text/plain. Falls back to text/plain on browsers that
 *  don't support rich clipboard writes. */
async function copyTextBoxToClipboard(html: string): Promise<boolean> {
  const payload = buildRichTextClipboardBlobs(html);
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard && "write" in navigator.clipboard) {
      await navigator.clipboard.write([new ClipboardItem(payload)]);
      return true;
    }
  } catch (err) {
    console.warn("[Noteometry] Rich clipboard write failed, falling back to plain text:", err);
  }
  try {
    await navigator.clipboard.writeText(htmlToPlainText(html));
    return true;
  } catch (err) {
    console.error("[Noteometry] Plain clipboard write failed:", err);
    return false;
  }
}


function EditableObjectTitle({
  value,
  onChange,
  onDragStart,
  onSnapshot,
  onDownload,
  downloadLabel,
  onDuplicate,
  onDelete,
}: {
  value: string;
  onChange: (next: string) => void;
  onDragStart: (e: React.PointerEvent) => void;
  onSnapshot: () => void;
  onDownload?: () => void;
  downloadLabel?: string;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onChange(trimmed);
    setEditing(false);
  };

  return (
    <div
      className="noteometry-object-title-bar"
      onPointerDown={(e) => {
        if (!editing) onDragStart(e);
      }}
    >
      <input
        ref={inputRef}
        className="noteometry-object-title-input"
        value={editing ? draft : value}
        readOnly={!editing}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (!editing) return;
          e.stopPropagation();
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); setDraft(value); setEditing(false); }
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!editing) setEditing(true);
        }}
        onPointerDown={(e) => {
          if (editing) e.stopPropagation();
        }}
      />
      {/* v1.6.13: visible icon chrome. v1.6.12 shipped these at 55%
       *   opacity with a transparent background, so on a paper-colored
       *   title bar Dan literally couldn't see them and reported "no
       *   GUI changes." Now they always render at full strength with a
       *   subtle faceplate so the icons are immediately visible — plus
       *   Duplicate and Delete so common operations are one tap away
       *   instead of requiring a right-click. */}
      <div
        className="nm-object-chrome-icons"
        onPointerDown={(e) => e.stopPropagation()}
        // v1.11.2 Fix 5: preventDefault on mousedown stops the browser from
        // moving focus to the BUTTON. Without this, clicking a chrome icon
        // (Snapshot/Download/Duplicate/Delete) yanks focus out of the
        // contenteditable RichTextEditor inside the dropin, which then
        // (a) collapses the selection — making text dropins look broken —
        // and (b) lets a subsequent Backspace nuke the dropin (Bug 1).
        // Click still fires because click != mousedown.
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) e.preventDefault();
        }}
      >
        <button
          className="nm-object-chrome-btn"
          title="Snapshot to canvas"
          aria-label="Snapshot to canvas"
          onClick={(e) => { e.stopPropagation(); onSnapshot(); }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        {onDownload && (
          <button
            className="nm-object-chrome-btn"
            title={downloadLabel ?? "Download"}
            aria-label={downloadLabel ?? "Download"}
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
        )}
        {onDuplicate && (
          <button
            className="nm-object-chrome-btn"
            title="Duplicate drop-in"
            aria-label="Duplicate drop-in"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        )}
        {onDelete && (
          <button
            className="nm-object-chrome-btn nm-object-chrome-btn-danger"
            title="Delete drop-in"
            aria-label="Delete drop-in"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

interface Props {
  objects: CanvasObject[];
  onObjectsChange: (objects: CanvasObject[]) => void;
  scrollX: number;
  scrollY: number;
  /** Canvas zoom scale (1.0 = 100%). Applied as a CSS transform on the
   *  scaled container so DOM overlays scale with the ink canvas. */
  zoom?: number;
  tool: CanvasTool;
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  plugin?: NoteometryPlugin;
  /** Vault-relative parent folder path of the bound page file. Used to
   *  route snapshot-to-canvas image writes into "<parent>/attachments".
   *  When absent the snapshot still renders but won't sync to the vault. */
  parentFolder?: string;
  /** Per-page scope for the table/textbox store. Derived from the bound
   *  file path so multiple .nmpage tabs don't share data. */
  scope: string;
  /** v1.10: called when the user clicks Solve on a math drop-in.
   *  Parent spawns a chat drop-in seeded with that drop-in's LaTeX. */
  onSolveMath?: (mathDropinId: string) => void;
}

/** Resolves vault image paths to data URLs with caching. Reports error when the file is missing. */
function useResolvedImageSrc(plugin: NoteometryPlugin | undefined, src: string): { src: string; error: boolean } {
  const [resolved, setResolved] = useState(src);
  const [error, setError] = useState(false);
  const cacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    setError(false);
    if (!src || src.startsWith("data:") || !plugin) {
      setResolved(src);
      return;
    }
    // Check if it's a vault path (starts with Noteometry/ or similar)
    if (!src.includes("/")) {
      setResolved(src);
      return;
    }
    const cached = cacheRef.current.get(src);
    if (cached) {
      setResolved(cached);
      return;
    }
    let cancelled = false;
    loadImageFromVault(plugin, src).then((dataUrl) => {
      if (!cancelled) {
        cacheRef.current.set(src, dataUrl);
        setResolved(dataUrl);
      }
    }).catch(() => {
      if (!cancelled) setError(true);
    });
    return () => { cancelled = true; };
  }, [plugin, src]);

  return { src: resolved, error };
}

function VaultImage({ src, plugin }: { src: string; plugin?: NoteometryPlugin }) {
  const { src: resolved, error } = useResolvedImageSrc(plugin, src);
  if (error) {
    const filename = src.split("/").pop() ?? src;
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          background: "repeating-linear-gradient(45deg, #f4e9d0, #f4e9d0 8px, #e8dcbf 8px, #e8dcbf 16px)",
          border: "1px dashed #c8382c",
          color: "#c8382c",
          fontSize: "12px",
          fontFamily: "monospace",
          textAlign: "center",
          padding: "8px",
          boxSizing: "border-box",
          userSelect: "none",
        }}
        title={`Missing file: ${src}`}
      >
        <span style={{ fontWeight: 700, letterSpacing: "0.05em" }}>MISSING</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
          {filename}
        </span>
      </div>
    );
  }
  return (
    <img src={resolved} alt="Inserted image"
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
      draggable={false} />
  );
}

export default function CanvasObjectLayer({
  objects, onObjectsChange, scrollX, scrollY, onSolveMath,
  zoom = 1,
  tool, selectedObjectId, onSelectObject, plugin, parentFolder, scope,
}: Props) {
  // Mirror zoom into a ref so the drag/resize handlers (which close over
  // stale values) always read the latest scale.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const dragState = useRef<{
    id: string;
    startX: number; startY: number;
    objStartX: number; objStartY: number;
  } | null>(null);

  type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
  const resizeState = useRef<{
    id: string;
    edge: ResizeEdge;
    startX: number; startY: number;
    objStartX: number; objStartY: number;
    objStartW: number; objStartH: number;
  } | null>(null);

  const handleDragStart = useCallback((e: React.PointerEvent, obj: CanvasObject) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      id: obj.id,
      startX: e.clientX, startY: e.clientY,
      objStartX: obj.x, objStartY: obj.y,
    };
    onSelectObject(obj.id);
  }, [onSelectObject]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    // Screen-space delta → world-space delta: divide by zoom.
    // This makes a 100px screen drag at 2x zoom move the object by
    // 50 world units (which visually is 100 screen pixels).
    const z = zoomRef.current;
    if (dragState.current) {
      const dx = (e.clientX - dragState.current.startX) / z;
      const dy = (e.clientY - dragState.current.startY) / z;
      const id = dragState.current.id;
      onObjectsChange(objects.map(o =>
        o.id === id ? { ...o, x: dragState.current!.objStartX + dx, y: dragState.current!.objStartY + dy } : o
      ));
    }
    if (resizeState.current) {
      const rs = resizeState.current;
      const dx = (e.clientX - rs.startX) / z;
      const dy = (e.clientY - rs.startY) / z;
      const edge = rs.edge;
      onObjectsChange(objects.map(o => {
        if (o.id !== rs.id) return o;
        let { x, y, w, h } = { x: rs.objStartX, y: rs.objStartY, w: rs.objStartW, h: rs.objStartH };
        // Horizontal
        if (edge.includes("e")) w = Math.max(120, w + dx);
        if (edge.includes("w")) { x = x + dx; w = Math.max(120, w - dx); }
        // Vertical
        if (edge.includes("s")) h = Math.max(80, h + dy);
        if (edge === "n" || edge === "ne" || edge === "nw") { y = y + dy; h = Math.max(80, h - dy); }
        return { ...o, x, y, w, h };
      }));
    }
  }, [objects, onObjectsChange]);

  const handleDragEnd = useCallback(() => {
    dragState.current = null;
    resizeState.current = null;
  }, []);

  const handleResizeStart = useCallback((e: React.PointerEvent, obj: CanvasObject, edge: ResizeEdge = "se") => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeState.current = {
      id: obj.id,
      edge,
      startX: e.clientX, startY: e.clientY,
      objStartX: obj.x, objStartY: obj.y,
      objStartW: obj.w, objStartH: obj.h,
    };
  }, []);

  const handleObjectClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onSelectObject(id);
  }, [onSelectObject]);

  /* Bring an object to the top of the z-order by moving it to the end
   * of the objects array. Fires on pointer-down capture so that any
   * interaction inside a drop-in — even ones that stopPropagation — still
   * raises that drop-in above others. */
  const bringToFront = useCallback((id: string) => {
    const idx = objects.findIndex(o => o.id === id);
    if (idx === -1 || idx === objects.length - 1) return;
    // v1.11.2 Fix 3: skip the reorder when an editable inside THIS dropin
    // currently has focus. Reordering changes React key positions, which
    // unmounts/remounts the wrapper subtree — RichTextEditor remounts and
    // its useEffect rehydrates innerHTML, blowing away the caret/selection
    // mid-keystroke. Symptom: text dropin appears to "disappear" or lose
    // what was just typed when you click around inside it.
    if (typeof document !== "undefined" && shouldSkipBringToFront(document, id)) return;
    const next = objects.slice();
    const [obj] = next.splice(idx, 1);
    if (!obj) return;
    next.push(obj);
    onObjectsChange(next);
  }, [objects, onObjectsChange]);

  // v1.6.9: objects are ALWAYS interactive — classic direct manipulation.
  // Dan's feedback: "objects should be selectable and movable directly by
  // tapping/clicking and dragging. Should NOT have to lasso to move."
  // The parent div stays pointer-events:none so pen strokes fall through
  // to the ink canvas on empty space; each object's own wrapper turns
  // pointer-events back on so tap/drag over a drop-in grabs it, even
  // while the pen tool is active.
  //
  // `tool` is kept as a prop for future per-tool behavior (e.g. eraser
  // could elect to skip object capture) but no longer gates selectability.
  void tool;
  const objectsInteractive = true;

  return (
    <div
      className="noteometry-object-layer"
      style={{
        position: "absolute", top: 0, left: 0,
        width: "100%", height: "100%",
        pointerEvents: "none",
        zIndex: 50,
        // Apply zoom directly to the layer so child overlays scale
        // together with the ink canvas's ctx.scale. transformOrigin 0 0
        // matches the ink canvas's origin. At zoom === 1 this is a no-op
        // transform; children render exactly as they did pre-Phase-4.
        transformOrigin: "0 0",
        transform: zoom === 1 ? undefined : `scale(${zoom})`,
      }}
    >
      {objects.map(obj => (
        <div
          key={obj.id}
          className={`noteometry-canvas-object ${selectedObjectId === obj.id ? "noteometry-object-selected" : ""}`}
          style={{
            position: "absolute",
            left: obj.x - scrollX,
            top: obj.y - scrollY,
            width: obj.w,
            height: obj.h,
            pointerEvents: objectsInteractive ? "auto" : "none",
          }}
          onClick={(e) => handleObjectClick(e, obj.id)}
          onPointerDownCapture={() => bringToFront(obj.id)}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
        >
          {/* Title bar — editable name that doubles as drag handle +
           *   snapshot/download chrome (v1.6.12 icon-first pass). */}
          <EditableObjectTitle
            value={defaultObjectName(obj)}
            onChange={(next) => {
              onObjectsChange(objects.map(o =>
                o.id === obj.id ? { ...o, name: next } : o
              ));
            }}
            onDragStart={(e) => handleDragStart(e, obj)}
            onSnapshot={() => {
              const el = document.querySelector(`[data-dropin-id="${obj.id}"]`) as HTMLElement | null;
              if (!el) {
                new Notice("Snapshot failed — drop-in not found in DOM", 5000);
                return;
              }
              snapshotElementToCanvas(
                el, obj, plugin, parentFolder,
                (newObj) => { onObjectsChange([...objects, newObj]); },
                (newId) => { onSelectObject(newId); },
              );
            }}
            downloadLabel={
              obj.type === "textbox" ? "Copy rich text" :
              obj.type === "image" ? "Download image" :
              obj.type === "table" ? "Download table PNG" :
              "Download PNG"
            }
            onDownload={() => {
              const el = document.querySelector(`[data-dropin-id="${obj.id}"]`) as HTMLElement | null;
              const name = defaultObjectName(obj);
              // Text boxes: offer rich-text copy as the primary "export"
              // path (matches Dan's OneNote/Word ask); fall back to
              // .txt download when the clipboard is unavailable.
              if (obj.type === "textbox") {
                const html = getTextBoxData(scope, obj.id) ?? "";
                if (!html.trim()) {
                  new Notice("Text box is empty — nothing to copy", 4000);
                  return;
                }
                void copyTextBoxToClipboard(html).then((ok) => {
                  if (ok) new Notice("Copied rich text — paste into Word / Google Docs", 4000);
                  else new Notice("Clipboard unavailable — see console", 6000);
                });
                return;
              }
              // Images: download the underlying dataURL (preserves the
              // source resolution instead of re-rasterizing through DOM).
              if (obj.type === "image" && typeof obj.dataURL === "string" && obj.dataURL.startsWith("data:")) {
                void downloadImageDataUrl(obj.dataURL, name);
                return;
              }
              if (!el) {
                new Notice("Download failed — drop-in not found in DOM", 5000);
                return;
              }
              void downloadDropinAsPng(el, name);
            }}
            onDuplicate={() => {
              // v1.6.13: visible-chrome duplicate. Same semantics as the
              // right-click Duplicate entry — new id, offset 24/24 — but
              // reachable from the drop-in header without a right-click.
              const dup: CanvasObject = {
                ...obj,
                id: crypto.randomUUID(),
                x: obj.x + 24,
                y: obj.y + 24,
              };
              onObjectsChange([...objects, dup]);
              onSelectObject(dup.id);
              new Notice("Drop-in duplicated", 2000);
            }}
            onDelete={() => {
              if (!window.confirm(`Delete "${defaultObjectName(obj)}"?`)) return;
              onObjectsChange(objects.filter((o) => o.id !== obj.id));
              if (selectedObjectId === obj.id) onSelectObject(null);
            }}
          />

          {/* Content — v1.6.9: body is now a secondary drag handle.
           * If the pointer lands on an interactive control (input, button,
           * textarea, contenteditable, anything with role=button) we let
           * the control receive the event normally. Otherwise we start a
           * classic drag on the object, matching Figma/Notion behavior.
           *
           * Pre-1.6.9 the body always stopped propagation, so dragging a
           * drop-in required either the small title-bar handle or the
           * lasso flow. Dan's feedback was explicit: "objects should be
           * selectable and movable directly by tapping/clicking and
           * dragging. Should NOT have to lasso to move." */}
          <div
            className="noteometry-object-content"
            data-dropin-id={obj.id}
            onPointerDown={(e) => {
              if (!shouldStartObjectDrag(e.target as HTMLElement)) {
                // Let the control handle the event; don't bubble to drag.
                e.stopPropagation();
                return;
              }
              // Non-interactive body — treat as drag handle.
              handleDragStart(e, obj);
            }}
            onTouchStart={(e) => e.stopPropagation()}
            // v1.11.2 Fix 2: stop wheel events from bubbling to the canvas
            // pan/zoom. Without this, scrolling chat history or a long
            // RichTextEditor body also scrolls the canvas underneath —
            // disorienting and looks like a bug.
            onWheel={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              // Only auto-focus the first editable when the user clicked empty
              // space inside the wrapper (i.e. NOT on an already-interactive
              // control). Otherwise clicking the duration / progress field in
              // dropins like StudyGantt would steal focus back to the title,
              // making those fields effectively uneditable.
              const target = e.target as HTMLElement;
              const onInteractive =
                target.closest("input, textarea, select, button, [contenteditable='true']");
              if (onInteractive) return;
              const editable = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
                '[contenteditable], input, textarea'
              );
              if (editable) editable.focus();
            }}
          >
            {obj.type === "textbox" && <RichTextEditor textBoxId={obj.id} scope={scope} />}
            {obj.type === "table" && <TableEditor tableId={obj.id} scope={scope} />}
            {obj.type === "image" && (
              <VaultImage src={obj.dataURL} plugin={plugin} />
            )}
            {obj.type === "pdf" && (
              <PdfViewer
                fileRef={obj.fileRef}
                page={obj.page}
                plugin={plugin}
                onPageChange={(newPage) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id && o.type === "pdf" ? { ...o, page: newPage } : o
                  ));
                }}
              />
            )}
            {obj.type === "math" && (
              <MathDropin
                latex={obj.latex}
                pending={obj.pending}
                onChange={(u) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id && o.type === "math" ? { ...o, ...u } : o
                  ));
                }}
                onSolve={() => onSolveMath?.(obj.id)}
              />
            )}
            {obj.type === "chat" && plugin && (
              <ChatDropin
                plugin={plugin}
                messages={obj.messages}
                attachedImage={obj.attachedImage}
                seedLatex={obj.seedLatex}
                seedText={obj.seedText}
                pending={obj.pending}
                onChange={(u) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id && o.type === "chat" ? { ...o, ...u } : o
                  ));
                }}
                onExportToTextBox={(messages: ChatMessage[]) => {
                  const html = chatToHtml(messages);
                  if (!html) {
                    new Notice("Nothing to export yet.");
                    return;
                  }
                  // Drop the new TextBox just to the right of the chat,
                  // vertically aligned with its top edge. The user can
                  // drag it wherever afterwards.
                  const tb = createTextBox(obj.x + obj.w + 24, obj.y, "Chat export");
                  setTextBoxData(scope, tb.id, html);
                  onObjectsChange([...objects, tb]);
                  onSelectObject(tb.id);
                  new Notice("Exported chat to text box.");
                }}
              />
            )}
          </div>

          {/* Resize handles — all 4 edges + 4 corners.
           *
           * v1.6.12: edges widened from 6px → 10px so they're actually
           * grabbable on trackpads / stylus without falling off onto the
           * ink canvas underneath. `touch-action: none` keeps the pen
           * tool from starting an ink stroke when the user drags a
           * handle on iPad, and the `data-resize-handle` attribute lets
           * the ink canvas pointerdown guard recognise handles in the
           * native event target chain.
           */}
          {(["n","s","e","w","ne","nw","se","sw"] as ResizeEdge[]).map(edge => {
            const isCorner = edge.length === 2;
            const cursor = ({n:"ns",s:"ns",e:"ew",w:"ew",ne:"nesw",nw:"nwse",se:"nwse",sw:"nesw"} as Record<string,string>)[edge] + "-resize";
            const pos: React.CSSProperties = {};
            const edgeSize = 10;
            const offset = -Math.floor(edgeSize / 2);
            if (edge.includes("n")) { pos.top = offset; pos.height = edgeSize; }
            if (edge.includes("s")) { pos.bottom = offset; pos.height = edgeSize; }
            if (edge.includes("e")) { pos.right = offset; pos.width = edgeSize; }
            if (edge.includes("w")) { pos.left = offset; pos.width = edgeSize; }
            if (edge === "n" || edge === "s") { pos.left = 10; pos.right = 10; }
            if (edge === "e" || edge === "w") { pos.top = 10; pos.bottom = 10; }
            if (isCorner) { pos.width = 14; pos.height = 14; }
            return (
              <div key={edge}
                data-resize-handle={edge}
                style={{
                  position: "absolute", ...pos,
                  cursor, zIndex: 60,
                  background: isCorner ? "var(--nm-accent, #4A90D9)" : "transparent",
                  borderRadius: isCorner ? "3px" : 0,
                  opacity: isCorner ? 0.7 : 0,
                  touchAction: "none",
                }}
                onPointerDown={(e) => handleResizeStart(e, obj, edge)}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
