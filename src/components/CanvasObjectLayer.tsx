import React, { useRef, useCallback, useState, useEffect } from "react";
import type { CanvasObject } from "../lib/canvasObjects";
import { defaultObjectName } from "../lib/canvasObjects";
import type { CanvasTool } from "./InkCanvas";
import type NoteometryPlugin from "../main";
import { loadImageFromVault } from "../lib/persistence";
import { useLongPress } from "../hooks/useLongPress";
import RichTextEditor from "./RichTextEditor";
import TableEditor from "./TableEditor";
import PdfViewer from "./PdfViewer";
import ImageAnnotator from "./dropins/ImageAnnotator";
import FormulaCard from "./dropins/FormulaCard";
import UnitConverter from "./dropins/UnitConverter";
import CircuitSniper from "./dropins/CircuitSniper";
import GraphPlotter from "./dropins/GraphPlotter";
import UnitCircle from "./dropins/UnitCircle";
import Oscilloscope from "./dropins/Oscilloscope";
import AnimationCanvas from "./dropins/AnimationCanvas";
import StudyGantt from "./dropins/StudyGantt";
import Compute from "./dropins/Compute";
import type {
  ImageAnnotatorObject,
  FormulaCardObject,
  UnitConverterObject,
  CircuitSniperObject,
  GraphPlotterObject,
  UnitCircleObject,
  OscilloscopeObject,
  AnimationCanvasObject,
  StudyGanttObject,
  ComputeObject,
} from "../lib/canvasObjects";

/* ── Signal Bus link helpers ──────────────────────────────────── */

const SIGNAL_LINKABLE_TYPES = new Set(["graph-plotter", "unit-circle", "oscilloscope"]);

function isSignalLinkable(obj: CanvasObject): obj is GraphPlotterObject | UnitCircleObject | OscilloscopeObject {
  return SIGNAL_LINKABLE_TYPES.has(obj.type);
}

/** Inline SVG chain-link icon (16×16, stroke-only, no external imports). */
function ChainLinkIcon({ linked }: { linked: boolean }) {
  return (
    <svg
      width={16} height={16} viewBox="0 0 24 24"
      fill="none"
      stroke={linked ? "var(--nm-accent, #4A90D9)" : "#666666"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

/* ── Drop-in SVG icons (14×14, stroke=currentColor, fill=none) ─── */

const iconProps = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function DropinIcon({ type }: { type: string }) {
  switch (type) {
    case "textbox":
      return <svg {...iconProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>;
    case "table":
      return <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>;
    case "image":
      return <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>;
    case "image-annotator":
      return <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><path d="M18.37 3.63a1 1 0 0 1 1.41 0l.59.59a1 1 0 0 1 0 1.41L14 12l-2.5.5L12 10l6.37-6.37z"/></svg>;
    case "formula-card":
      return <svg {...iconProps}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 9l2 3-2 3" strokeWidth="1.5"/><line x1="14" y1="15" x2="17" y2="15"/></svg>;
    case "unit-converter":
      return <svg {...iconProps}><path d="M7 16l-4-4 4-4"/><path d="M17 8l4 4-4 4"/><line x1="3" y1="12" x2="21" y2="12"/></svg>;
    case "pdf":
      return <svg {...iconProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="8" y="17" fontSize="6" fontWeight="700" fill="currentColor" stroke="none" fontFamily="sans-serif">PDF</text></svg>;
    case "circuit-sniper":
      return <svg {...iconProps}><path d="M2 12h4l2-5 2 10 2-10 2 5h4"/><circle cx="20" cy="12" r="2"/></svg>;
    case "graph-plotter":
      return <svg {...iconProps}><polyline points="3 20 3 4"/><polyline points="3 20 21 20"/><path d="M6 17 C9 6, 14 6, 18 10" strokeWidth="2"/></svg>;
    case "unit-circle":
      return <svg {...iconProps}><circle cx="12" cy="12" r="8"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="12" y1="4" x2="12" y2="20"/><circle cx="17" cy="8" r="2" fill="currentColor"/></svg>;
    case "oscilloscope":
      return <svg {...iconProps}><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M5 12 C7 6, 9 6, 11 12 C13 18, 15 18, 17 12" strokeWidth="2"/></svg>;
    case "animation-canvas":
      return <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="2"/><polygon points="10 8 10 16 16 12" fill="currentColor" stroke="none"/></svg>;
    case "study-gantt":
      return <svg {...iconProps}><rect x="3" y="4" width="10" height="3" rx="1"/><rect x="7" y="10" width="12" height="3" rx="1"/><rect x="5" y="16" width="8" height="3" rx="1"/></svg>;
    case "compute":
      return <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="2"/><text x="12" y="15" fontSize="10" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="monospace">fx</text></svg>;
    default:
      return <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>;
  }
}

/** Editable title input at the top of every canvas object. Click to
 * edit, Enter/blur to commit, Escape to revert. The input also doubles
 * as the drag handle — onPointerDown on the wrapper starts the drag
 * unless the input is focused for editing. */
function EditableObjectTitle({
  value,
  onChange,
  onDragStart,
  icon,
  linkButton,
}: {
  value: string;
  onChange: (next: string) => void;
  onDragStart: (e: React.PointerEvent) => void;
  icon?: React.ReactNode;
  linkButton?: React.ReactNode;
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
      {icon && <span className="noteometry-object-title-icon" style={{ display: "inline-flex", alignItems: "center", marginRight: 4, flexShrink: 0 }}>{icon}</span>}
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
      {linkButton}
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
  /** Called when the user long-presses / right-clicks on an object.
   *  Parent builds the context menu items. */
  onObjectContextMenu?: (objId: string, clientX: number, clientY: number) => void;
  /** Called when a drop-in (e.g. Image Annotator) wants to send a
   *  vision snapshot to the AI pipeline. */
  onSendToAI?: (dataUrl: string) => void;
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

/** Per-object wrapper that applies useLongPress for context menu on touch. */
function ObjectLongPressWrapper({
  objId,
  onObjectContextMenu,
  children,
  ...rest
}: {
  objId: string;
  onObjectContextMenu?: (objId: string, clientX: number, clientY: number) => void;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "onContextMenu">) {
  const handlers = useLongPress(
    useCallback((pos: { x: number; y: number }) => {
      onObjectContextMenu?.(objId, pos.x, pos.y);
    }, [objId, onObjectContextMenu]),
  );
  return (
    <div {...rest} {...handlers}>
      {children}
    </div>
  );
}

export default function CanvasObjectLayer({
  objects, onObjectsChange, scrollX, scrollY,
  zoom = 1,
  tool, selectedObjectId, onSelectObject, plugin,
  onObjectContextMenu, onSendToAI,
}: Props) {
  // Mirror zoom and objects into refs so drag/resize handlers always
  // read the latest values without stale closures.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const objectsRef = useRef(objects);
  objectsRef.current = objects;
  const onObjectsChangeRef = useRef(onObjectsChange);
  onObjectsChangeRef.current = onObjectsChange;

  const dragState = useRef<{
    id: string;
    startX: number; startY: number;
    objStartX: number; objStartY: number;
  } | null>(null);

  // Resize state — uses React state to drive a useEffect that attaches
  // document-level listeners, avoiding stale closures when pages change.
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ id: string; x: number; y: number; w: number; h: number }>({ id: "", x: 0, y: 0, w: 0, h: 0 });

  // Document-level resize listeners — re-attached when isResizing changes,
  // always reads fresh state via refs.
  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: PointerEvent) => {
      const z = zoomRef.current;
      const dx = (e.clientX - resizeStartRef.current.x) / z;
      const dy = (e.clientY - resizeStartRef.current.y) / z;
      const id = resizeStartRef.current.id;
      const newW = Math.max(150, resizeStartRef.current.w + dx);
      const newH = Math.max(100, resizeStartRef.current.h + dy);
      onObjectsChangeRef.current(objectsRef.current.map(o =>
        o.id === id ? { ...o, w: newW, h: newH } : o
      ));
    };
    const onUp = () => setIsResizing(false);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [isResizing]);

  // Track whether a drag is active via React state so we can attach
  // document-level listeners (same pattern as resize). This avoids stale
  // closures from onPointerMove on individual elements.
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback((e: React.PointerEvent, obj: CanvasObject) => {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      id: obj.id,
      startX: e.clientX, startY: e.clientY,
      objStartX: obj.x, objStartY: obj.y,
    };
    onSelectObject(obj.id);
    setIsDragging(true);
  }, [onSelectObject]);

  // Document-level drag listeners — re-attached when isDragging changes,
  // always reads fresh state via refs to avoid stale closures.
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      const z = zoomRef.current;
      const ds = dragState.current;
      if (!ds) return;
      const dx = (e.clientX - ds.startX) / z;
      const dy = (e.clientY - ds.startY) / z;
      onObjectsChangeRef.current(objectsRef.current.map(o =>
        o.id === ds.id ? { ...o, x: ds.objStartX + dx, y: ds.objStartY + dy } : o
      ));
    };
    const onUp = () => {
      dragState.current = null;
      setIsDragging(false);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [isDragging]);

  const handleResizeStart = useCallback((e: React.PointerEvent, obj: CanvasObject) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStartRef.current = { id: obj.id, x: e.clientX, y: e.clientY, w: obj.w, h: obj.h };
    setIsResizing(true);
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
        <ObjectLongPressWrapper
          key={obj.id}
          objId={obj.id}
          onObjectContextMenu={onObjectContextMenu}
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
        >
          {/* Title bar — editable name that doubles as drag handle */}
          <EditableObjectTitle
            value={defaultObjectName(obj)}
            onChange={(next) => {
              onObjectsChange(objects.map(o =>
                o.id === obj.id ? { ...o, name: next } : o
              ));
            }}
            onDragStart={(e) => handleDragStart(e, obj)}
            icon={<DropinIcon type={obj.type} />}
            linkButton={isSignalLinkable(obj) ? (
              <button
                className={`noteometry-signal-link-btn${obj.signalLinked ? " noteometry-signal-linked" : ""}`}
                title={obj.signalLinked ? "Unlink from signal bus" : "Link to signal bus"}
                onClick={(e) => {
                  e.stopPropagation();
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id ? { ...o, signalLinked: !(o as GraphPlotterObject | UnitCircleObject | OscilloscopeObject).signalLinked } : o
                  ));
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <ChainLinkIcon linked={!!obj.signalLinked} />
              </button>
            ) : undefined}
          />

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
            {obj.type === "pdf" && plugin && (
              <PdfViewer
                app={plugin.app}
                vaultPath={obj.fileRef}
                page={obj.page}
                onPageChange={(newPage) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id && o.type === "pdf" ? { ...o, page: newPage } : o
                  ));
                }}
              />
            )}
            {obj.type === "image-annotator" && (
              <ImageAnnotator
                obj={obj as ImageAnnotatorObject}
                plugin={plugin}
                onSendToAI={onSendToAI}
                onChange={(patch) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id ? { ...o, ...patch } as CanvasObject : o
                  ));
                }}
              />
            )}
            {obj.type === "formula-card" && (
              <FormulaCard
                obj={obj as FormulaCardObject}
                onChange={(patch) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id ? { ...o, ...patch } as CanvasObject : o
                  ));
                }}
              />
            )}
            {obj.type === "unit-converter" && (
              <UnitConverter
                obj={obj as UnitConverterObject}
                onChange={(patch) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id ? { ...o, ...patch } as CanvasObject : o
                  ));
                }}
              />
            )}
            {obj.type === "circuit-sniper" && (
              <CircuitSniper
                obj={obj as CircuitSniperObject}
                plugin={plugin}
                onSendToAI={onSendToAI}
                onChange={(patch) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id ? { ...o, ...patch } as CanvasObject : o
                  ));
                }}
              />
            )}
            {obj.type === "graph-plotter" && (
              <GraphPlotter
                obj={obj as GraphPlotterObject}
                onSendToAI={onSendToAI}
                onChange={(patch) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id ? { ...o, ...patch } as CanvasObject : o
                  ));
                }}
              />
            )}
            {obj.type === "unit-circle" && (
              <UnitCircle
                obj={obj as UnitCircleObject}
                onChange={(patch) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id ? { ...o, ...patch } as CanvasObject : o
                  ));
                }}
              />
            )}
            {obj.type === "oscilloscope" && (
              <Oscilloscope
                obj={obj as OscilloscopeObject}
                onSendToAI={onSendToAI}
                onChange={(patch) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id ? { ...o, ...patch } as CanvasObject : o
                  ));
                }}
              />
            )}
            {obj.type === "animation-canvas" && (
              <AnimationCanvas
                obj={obj as AnimationCanvasObject}
                onChange={(patch) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id ? { ...o, ...patch } as CanvasObject : o
                  ));
                }}
              />
            )}
            {obj.type === "study-gantt" && (
              <StudyGantt
                obj={obj as StudyGanttObject}
                onChange={(patch) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id ? { ...o, ...patch } as CanvasObject : o
                  ));
                }}
              />
            )}
            {obj.type === "compute" && (
              <Compute
                obj={obj as ComputeObject}
                onChange={(patch) => {
                  onObjectsChange(objects.map(o =>
                    o.id === obj.id ? { ...o, ...patch } as CanvasObject : o
                  ));
                }}
              />
            )}
          </div>

          {/* Resize handle — position:absolute to avoid layout shift */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 16,
              height: 16,
              cursor: 'nwse-resize',
              zIndex: 10,
              background: 'linear-gradient(135deg, transparent 50%, var(--nm-border, #ccc) 50%)',
            }}
            onPointerDown={(e) => handleResizeStart(e, obj)}
          />
        </ObjectLongPressWrapper>
      ))}
    </div>
  );
}
