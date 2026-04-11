import React, { useRef, useCallback, useState, useEffect } from "react";
import type { CanvasObject } from "../lib/canvasObjects";
import type { CanvasTool } from "./InkCanvas";
import type NoteometryPlugin from "../main";
import { loadImageFromVault } from "../lib/persistence";
import RichTextEditor from "./RichTextEditor";
import TableEditor from "./TableEditor";

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
  objects, onObjectsChange, scrollX, scrollY,
  zoom = 1,
  tool, selectedObjectId, onSelectObject, plugin,
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

  const resizeState = useRef<{
    id: string;
    startX: number; startY: number;
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
      const dx = (e.clientX - resizeState.current.startX) / z;
      const dy = (e.clientY - resizeState.current.startY) / z;
      const id = resizeState.current.id;
      onObjectsChange(objects.map(o =>
        o.id === id ? {
          ...o,
          w: Math.max(150, resizeState.current!.objStartW + dx),
          h: Math.max(100, resizeState.current!.objStartH + dy),
        } : o
      ));
    }
  }, [objects, onObjectsChange]);

  const handleDragEnd = useCallback(() => {
    dragState.current = null;
    resizeState.current = null;
  }, []);

  const handleResizeStart = useCallback((e: React.PointerEvent, obj: CanvasObject) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeState.current = {
      id: obj.id,
      startX: e.clientX, startY: e.clientY,
      objStartW: obj.w, objStartH: obj.h,
    };
  }, []);

  const handleObjectClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onSelectObject(id);
  }, [onSelectObject]);

  // Only individual objects are interactive in select mode.
  // Parent div is ALWAYS pointerEvents: none so it never blocks
  // drag-and-drop, wheel scroll, or canvas click-to-deselect.
  const objectsInteractive = tool === "select";

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
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
        >
          {/* Drag handle */}
          <div
            className="noteometry-object-drag-handle"
            onPointerDown={(e) => handleDragStart(e, obj)}
          >
            <span className="noteometry-object-drag-label">
              {obj.type === "textbox" ? "Text" : obj.type === "table" ? "Table" : "Image"}
            </span>
            <button
              className="noteometry-object-delete"
              onPointerUp={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const label = obj.type === "textbox" ? "text box" : obj.type === "table" ? "table" : "image";
                if (confirm(`Delete this ${label}?`)) {
                  onObjectsChange(objects.filter(o => o.id !== obj.id));
                  if (selectedObjectId === obj.id) onSelectObject(null);
                }
              }}
              title="Delete"
            >&times;</button>
          </div>

          {/* Content — stop propagation so drag handler doesn't steal focus */}
          <div
            className="noteometry-object-content"
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              // Focus the first editable element inside (keyboard popup on iPad)
              const editable = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
                '[contenteditable], input, textarea'
              );
              if (editable) editable.focus();
            }}
          >
            {obj.type === "textbox" && <RichTextEditor textBoxId={obj.id} />}
            {obj.type === "table" && <TableEditor tableId={obj.id} />}
            {obj.type === "image" && (
              <VaultImage src={obj.dataURL} plugin={plugin} />
            )}
          </div>

          {/* Resize handle */}
          <div
            className="noteometry-object-resize-handle"
            onPointerDown={(e) => handleResizeStart(e, obj)}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          />
        </div>
      ))}
    </div>
  );
}
