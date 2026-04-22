import React, { useRef, useCallback, useState, useEffect } from "react";
import type { CanvasObject } from "../lib/canvasObjects";
import { defaultObjectName } from "../lib/canvasObjects";
import { shouldStartObjectDrag } from "../lib/objectDragHitTest";
import type { CanvasTool } from "./InkCanvas";
import type NoteometryPlugin from "../main";
import { loadImageFromVault } from "../lib/persistence";
import RichTextEditor from "./RichTextEditor";
import TableEditor from "./TableEditor";
import PdfViewer from "./PdfViewer";
import UnitConverterDropin from "./dropins/UnitConverterDropin";
import GraphPlotterDropin from "./dropins/GraphPlotterDropin";
import UnitCircleDropin from "./dropins/UnitCircleDropin";
import OscilloscopeDropin from "./dropins/OscilloscopeDropin";
import ComputeDropin from "./dropins/ComputeDropin";
import AnimationCanvasDropin from "./dropins/AnimationCanvasDropin";
import StudyGanttDropin from "./dropins/StudyGanttDropin";
import CircuitSniperDropin from "./dropins/CircuitSniperDropin";
import AIDropin from "./dropins/AIDropin";
import MultimeterDropin from "./dropins/MultimeterDropin";

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

async function snapshotElement(el: HTMLElement): Promise<void> {
  try {
    const html2canvas = getHtml2Canvas();
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
      useCORS: true,
    });
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
      } catch {
        // Fallback: download as file
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "snapshot.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    }, "image/png");
  } catch (e) {
    console.error("[Noteometry] Snapshot failed:", e);
  }
}

function EditableObjectTitle({
  value,
  onChange,
  onDragStart,
  onSnapshot,
}: {
  value: string;
  onChange: (next: string) => void;
  onDragStart: (e: React.PointerEvent) => void;
  onSnapshot: () => void;
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
      <button
        className="noteometry-canvas-action-btn"
        title="Snapshot to clipboard"
        onClick={(e) => { e.stopPropagation(); onSnapshot(); }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: "20px", height: "20px", padding: 0, margin: "0 2px",
          background: "none", border: "none", cursor: "pointer",
          fontSize: "13px", opacity: 0.5, flexShrink: 0,
        }}
      >
        📷
      </button>
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
          {/* Title bar — editable name that doubles as drag handle + snapshot */}
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
              if (el) snapshotElement(el);
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
            {obj.type === "textbox" && <RichTextEditor textBoxId={obj.id} />}
            {obj.type === "table" && <TableEditor tableId={obj.id} />}
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
            {obj.type === "circuit-sniper" && (
              <CircuitSniperDropin
                circuitData={obj.circuitData}
                onChange={(u) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id && o.type === "circuit-sniper" ? { ...o, ...u } : o
                  ));
                }}
              />
            )}
            {obj.type === "unit-converter" && (
              <UnitConverterDropin
                category={obj.category}
                inputValue={obj.inputValue}
                onChange={(u) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id && o.type === "unit-converter" ? { ...o, ...u } : o
                  ));
                }}
              />
            )}
            {obj.type === "graph-plotter" && (
              <GraphPlotterDropin
                id={obj.id}
                functions={obj.functions}
                viewX={obj.viewX} viewY={obj.viewY} viewW={obj.viewW} viewH={obj.viewH}
                signalLinked={obj.signalLinked ?? false}
                onChange={(u) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id && o.type === "graph-plotter" ? { ...o, ...u } : o
                  ));
                }}
              />
            )}
            {obj.type === "unit-circle" && (
              <UnitCircleDropin
                id={obj.id}
                angleDeg={obj.angleDeg}
                signalLinked={obj.signalLinked ?? false}
                onChange={(u) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id && o.type === "unit-circle" ? { ...o, ...u } : o
                  ));
                }}
              />
            )}
            {obj.type === "oscilloscope" && (
              <OscilloscopeDropin
                id={obj.id}
                channelA={obj.channelA}
                channelB={obj.channelB}
                timeDiv={obj.timeDiv}
                signalLinked={obj.signalLinked ?? false}
                onChange={(u) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id && o.type === "oscilloscope" ? { ...o, ...u } : o
                  ));
                }}
              />
            )}
            {obj.type === "compute" && (
              <ComputeDropin
                cells={obj.cells}
                resultExpr={obj.resultExpr}
                onChange={(u) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id && o.type === "compute" ? { ...o, ...u } : o
                  ));
                }}
              />
            )}
            {obj.type === "animation-canvas" && (
              <AnimationCanvasDropin
                frames={obj.frames}
                currentFrame={obj.currentFrame}
                fps={obj.fps}
                onChange={(u) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id && o.type === "animation-canvas" ? { ...o, ...u } : o
                  ));
                }}
              />
            )}
            {obj.type === "study-gantt" && (
              <StudyGanttDropin
                startDate={obj.startDate}
                tasks={obj.tasks}
                onChange={(u) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id && o.type === "study-gantt" ? { ...o, ...u } : o
                  ));
                }}
              />
            )}
            {obj.type === "ai-dropin" && (
              <AIDropin
                mode={obj.mode}
                onChange={(u) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id && o.type === "ai-dropin" ? { ...o, ...u } : o
                  ));
                }}
              />
            )}
            {obj.type === "multimeter" && (
              <MultimeterDropin
                mode={obj.meterMode}
                inputValue={obj.inputValue}
                onChange={(u) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id && o.type === "multimeter"
                      ? { ...o, meterMode: u.mode ?? obj.meterMode, inputValue: u.inputValue ?? obj.inputValue }
                      : o
                  ));
                }}
              />
            )}
          </div>

          {/* Resize handles — all 4 edges + 4 corners */}
          {(["n","s","e","w","ne","nw","se","sw"] as ResizeEdge[]).map(edge => {
            const isCorner = edge.length === 2;
            const cursor = ({n:"ns",s:"ns",e:"ew",w:"ew",ne:"nesw",nw:"nwse",se:"nwse",sw:"nesw"} as Record<string,string>)[edge] + "-resize";
            const pos: React.CSSProperties = {};
            if (edge.includes("n")) { pos.top = -3; pos.height = 6; }
            if (edge.includes("s")) { pos.bottom = -3; pos.height = 6; }
            if (edge.includes("e")) { pos.right = -3; pos.width = 6; }
            if (edge.includes("w")) { pos.left = -3; pos.width = 6; }
            if (edge === "n" || edge === "s") { pos.left = 6; pos.right = 6; }
            if (edge === "e" || edge === "w") { pos.top = 6; pos.bottom = 6; }
            if (isCorner) { pos.width = 10; pos.height = 10; }
            return (
              <div key={edge} style={{
                position: "absolute", ...pos,
                cursor, zIndex: 60,
                background: isCorner ? "var(--nm-accent, #4A90D9)" : "transparent",
                borderRadius: isCorner ? "2px" : 0,
                opacity: isCorner ? 0.6 : 0,
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
