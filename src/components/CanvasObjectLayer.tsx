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
  tool: CanvasTool;
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  plugin?: NoteometryPlugin;
}

/** Resolves vault image paths to data URLs with caching */
function useResolvedImageSrc(plugin: NoteometryPlugin | undefined, src: string): string {
  const [resolved, setResolved] = useState(src);
  const cacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
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
      if (!cancelled) setResolved(src);
    });
    return () => { cancelled = true; };
  }, [plugin, src]);

  return resolved;
}

function VaultImage({ src, plugin }: { src: string; plugin?: NoteometryPlugin }) {
  const resolved = useResolvedImageSrc(plugin, src);
  return (
    <img src={resolved} alt="Inserted image"
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
      draggable={false} />
  );
}

export default function CanvasObjectLayer({
  objects, onObjectsChange, scrollX, scrollY,
  tool, selectedObjectId, onSelectObject, plugin,
}: Props) {
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
    if (dragState.current) {
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      const id = dragState.current.id;
      onObjectsChange(objects.map(o =>
        o.id === id ? { ...o, x: dragState.current!.objStartX + dx, y: dragState.current!.objStartY + dy } : o
      ));
    }
    if (resizeState.current) {
      const dx = e.clientX - resizeState.current.startX;
      const dy = e.clientY - resizeState.current.startY;
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
