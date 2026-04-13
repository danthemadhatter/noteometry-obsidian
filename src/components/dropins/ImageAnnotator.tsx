import React, { useRef, useEffect, useCallback, useState } from "react";
import type { ImageAnnotatorObject, RelativeStroke } from "../../lib/canvasObjects";
import type NoteometryPlugin from "../../main";
import { loadImageFromVault } from "../../lib/persistence";
import { smoothPoints } from "../../lib/inkEngine";

const ANNOTATION_COLORS = [
  { color: "#FF3B30", label: "Red" },
  { color: "#007AFF", label: "Blue" },
  { color: "#34C759", label: "Green" },
  { color: "#1C1C1E", label: "Black" },
];

const MIN_PRESSURE_WIDTH = 1.5;
const MAX_PRESSURE_WIDTH = 6;

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];

interface Props {
  obj: ImageAnnotatorObject;
  onChange: (patch: Partial<ImageAnnotatorObject>) => void;
  plugin?: NoteometryPlugin;
  onSendToAI?: (dataUrl: string) => void;
}

export default function ImageAnnotator({ obj, onChange, plugin, onSendToAI }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string>(obj.imagePath);
  const [imgError, setImgError] = useState(false);
  const [strokeColor, setStrokeColor] = useState(ANNOTATION_COLORS[0]!.color);
  const activeStrokeRef = useRef<{ x: number; y: number; pressure: number }[]>([]);
  const isDrawingRef = useRef(false);

  // Vault picker state
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  // Resolve vault path to data URL
  useEffect(() => {
    setImgError(false);
    if (!obj.imagePath || obj.imagePath.startsWith("data:") || !plugin) {
      setResolvedSrc(obj.imagePath);
      return;
    }
    let cancelled = false;
    loadImageFromVault(plugin, obj.imagePath)
      .then((dataUrl) => { if (!cancelled) setResolvedSrc(dataUrl); })
      .catch(() => { if (!cancelled) setImgError(true); });
    return () => { cancelled = true; };
  }, [plugin, obj.imagePath]);

  // Redraw all strokes whenever strokes or canvas size changes
  const redrawStrokes = useCallback(() => {
    const canvas = inkCanvasRef.current;
    const container = contentRef.current;
    if (!canvas || !container) return;
    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    for (const stroke of obj.strokes) {
      drawStroke(ctx, stroke, width, height);
    }
  }, [obj.strokes]);

  // ResizeObserver to keep canvas synced
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => redrawStrokes());
    ro.observe(container);
    redrawStrokes();
    return () => ro.disconnect();
  }, [redrawStrokes]);

  // Draw a single relative stroke onto the canvas context
  function drawStroke(
    ctx: CanvasRenderingContext2D,
    stroke: RelativeStroke,
    w: number, h: number
  ) {
    const smoothed = smoothPoints(
      stroke.points.map((p) => ({
        x: p.x * w,
        y: p.y * h,
        pressure: p.pressure,
      }))
    );
    if (smoothed.length === 0) return;

    ctx.strokeStyle = stroke.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 0; i < smoothed.length - 1; i++) {
      const p0 = smoothed[i]!;
      const p1 = smoothed[i + 1]!;
      const avgPressure = (p0.pressure + p1.pressure) / 2;
      ctx.lineWidth = MIN_PRESSURE_WIDTH + avgPressure * (MAX_PRESSURE_WIDTH - MIN_PRESSURE_WIDTH);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }

  // Pointer handlers for annotation drawing
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Apple Pencil (pen) or mouse draws — touch is reserved for pan/scroll
    if (e.pointerType === "touch") return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    activeStrokeRef.current = [{ x, y, pressure: e.pressure }];
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || e.pointerType === "touch") return;
    e.preventDefault();
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    activeStrokeRef.current.push({ x, y, pressure: e.pressure });

    // Live preview: draw the in-progress stroke
    const canvas = inkCanvasRef.current;
    const container = contentRef.current;
    if (!canvas || !container) return;
    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Draw just the last segment for performance
    const pts = activeStrokeRef.current;
    if (pts.length < 2) return;
    const p0 = pts[pts.length - 2]!;
    const p1 = pts[pts.length - 1]!;
    const avgPressure = (p0.pressure + p1.pressure) / 2;
    ctx.strokeStyle = strokeColor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = MIN_PRESSURE_WIDTH + avgPressure * (MAX_PRESSURE_WIDTH - MIN_PRESSURE_WIDTH);
    ctx.beginPath();
    ctx.moveTo(p0.x * width, p0.y * height);
    ctx.lineTo(p1.x * width, p1.y * height);
    ctx.stroke();
  }, [strokeColor]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || e.pointerType === "touch") return;
    isDrawingRef.current = false;
    if (activeStrokeRef.current.length > 0) {
      const newStroke: RelativeStroke = {
        points: activeStrokeRef.current,
        color: strokeColor,
        width: MAX_PRESSURE_WIDTH,
      };
      onChange({ strokes: [...obj.strokes, newStroke] });
      activeStrokeRef.current = [];
    }
  }, [strokeColor, obj.strokes, onChange]);

  const handleClearInk = useCallback(() => {
    onChange({ strokes: [] });
  }, [onChange]);

  const handleRead = useCallback(() => {
    if (!onSendToAI) return;
    const container = contentRef.current;
    const img = imgRef.current;
    const inkCanvas = inkCanvasRef.current;
    if (!container || !inkCanvas) return;

    const { offsetWidth: w, offsetHeight: h } = container;
    const dpr = window.devicePixelRatio || 1;
    const offscreen = document.createElement("canvas");
    offscreen.width = w * dpr * 2;
    offscreen.height = h * dpr * 2;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr * 2, dpr * 2);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, w, h);
    }
    ctx.drawImage(inkCanvas, 0, 0, w, h);
    onSendToAI(offscreen.toDataURL("image/png"));
  }, [onSendToAI]);

  // Load image from a vault file path
  const loadFromVault = useCallback(async (filePath: string) => {
    setShowVaultPicker(false);
    setPickerSearch("");
    onChange({ imagePath: filePath, strokes: [] });
  }, [onChange]);

  // Load image from blob URL (clipboard)
  const loadFromBlob = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      // Convert to data URL for persistence
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      URL.revokeObjectURL(url);
      onChange({
        imagePath: dataUrl,
        imageAspectRatio: img.naturalWidth / img.naturalHeight,
        strokes: [],
      });
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [onChange]);

  // Paste from clipboard handler
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            loadFromBlob(blob);
            return;
          }
        }
      }
    } catch {
      // Fallback: ignored — clipboard may not have image data
    }
  }, [loadFromBlob]);

  // Get filtered image files from vault
  const getImageFiles = useCallback(() => {
    if (!plugin) return [];
    return plugin.app.vault.getFiles()
      .filter(f => IMAGE_EXTENSIONS.includes(f.extension.toLowerCase()))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [plugin]);

  const hasImage = !!obj.imagePath;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "4px",
        padding: "2px 6px", flexShrink: 0,
        borderBottom: "1px solid var(--nm-paper-border, #ddd)",
        background: "var(--nm-faceplate-recessed, #f5f2ea)",
        minHeight: "36px",
      }}>
        {ANNOTATION_COLORS.map((c) => (
          <button
            key={c.color}
            title={c.label}
            onClick={() => setStrokeColor(c.color)}
            style={{
              width: 28, height: 28, minWidth: 28, borderRadius: "50%",
              background: c.color, border: strokeColor === c.color ? "2px solid #333" : "2px solid transparent",
              cursor: "pointer", padding: 0, flexShrink: 0,
            }}
          />
        ))}
        <div style={{ flex: 1 }} />
        {hasImage && (
          <button
            onClick={() => setShowVaultPicker(true)}
            title="Change Image"
            style={{
              padding: "4px 10px", fontSize: "12px", fontWeight: 600,
              background: "none", border: "1px solid var(--nm-paper-border, #ccc)",
              borderRadius: "4px", cursor: "pointer", minHeight: "32px", minWidth: "44px",
            }}
          >
            Change
          </button>
        )}
        <button
          onClick={handleClearInk}
          title="Clear Ink"
          style={{
            padding: "4px 10px", fontSize: "12px", fontWeight: 600,
            background: "none", border: "1px solid var(--nm-paper-border, #ccc)",
            borderRadius: "4px", cursor: "pointer", minHeight: "32px", minWidth: "44px",
          }}
        >
          Clear Ink
        </button>
        <button
          onClick={handleRead}
          title="Read — send snapshot to AI"
          style={{
            padding: "4px 10px", fontSize: "12px", fontWeight: 600,
            background: "var(--nm-accent, #4a6fa5)", color: "#fff",
            border: "none", borderRadius: "4px", cursor: "pointer",
            minHeight: "32px", minWidth: "44px",
          }}
        >
          Read
        </button>
      </div>
      {/* Content: image + ink overlay, or file picker */}
      <div
        ref={contentRef}
        style={{ flex: 1, position: "relative", overflow: "hidden", touchAction: "none" }}
      >
        {hasImage ? (
          imgError ? (
            <div style={{
              width: "100%", height: "100%", display: "flex",
              alignItems: "center", justifyContent: "center",
              background: "#f4e9d0", color: "#c8382c", fontSize: "12px",
              fontFamily: "monospace", textAlign: "center", padding: "8px",
            }}>
              Image not found: {obj.imagePath}
            </div>
          ) : (
            <img
              ref={imgRef}
              src={resolvedSrc}
              alt="Annotator image"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              draggable={false}
            />
          )
        ) : (
          /* ── Empty state: vault picker + clipboard buttons ── */
          <div style={{
            width: "100%", height: "100%", display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: "12px", padding: "16px",
          }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
              <button
                onClick={() => setShowVaultPicker(true)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", fontSize: "13px", fontWeight: 600,
                  background: "var(--nm-accent, #4a6fa5)", color: "#fff",
                  border: "none", borderRadius: "6px", cursor: "pointer",
                  minHeight: "44px", minWidth: "44px",
                }}
              >
                Choose Image from Vault
              </button>
              <button
                onClick={handlePasteFromClipboard}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", fontSize: "13px", fontWeight: 600,
                  background: "var(--nm-panel-bg, #fff)", color: "var(--nm-text, #333)",
                  border: "1px solid var(--nm-paper-border, #ccc)", borderRadius: "6px",
                  cursor: "pointer", minHeight: "44px", minWidth: "44px",
                }}
              >
                Paste from Clipboard
              </button>
            </div>
          </div>
        )}
        <canvas
          ref={inkCanvasRef}
          style={{
            position: "absolute", top: 0, left: 0,
            width: "100%", height: "100%",
            pointerEvents: "all", touchAction: "none",
            background: "transparent",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {/* ── Vault image picker dropdown ── */}
        {showVaultPicker && (() => {
          const allFiles = getImageFiles();
          const query = pickerSearch.toLowerCase();
          const filtered = query
            ? allFiles.filter(f => f.name.toLowerCase().includes(query))
            : allFiles;
          return (
            <div
              style={{
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 50, display: "flex", flexDirection: "column",
                background: "var(--nm-panel-bg, #fff)",
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "6px", borderBottom: "1px solid var(--nm-paper-border, #ddd)",
              }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search images..."
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{
                    flex: 1, padding: "6px 8px", fontSize: "12px",
                    border: "1px solid var(--nm-paper-border, #ccc)",
                    borderRadius: "4px", minHeight: "36px",
                    background: "var(--nm-canvas-bg, #fff)",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => { setShowVaultPicker(false); setPickerSearch(""); }}
                  style={{
                    padding: "4px 10px", fontSize: "12px", fontWeight: 600,
                    background: "none", border: "1px solid var(--nm-paper-border, #ccc)",
                    borderRadius: "4px", cursor: "pointer",
                    minHeight: "36px", minWidth: "44px",
                  }}
                >
                  Cancel
                </button>
              </div>
              <div style={{ flex: 1, overflow: "auto", maxHeight: 200 }}>
                {filtered.length === 0 ? (
                  <div style={{
                    textAlign: "center", color: "var(--nm-text, #aaa)",
                    padding: "20px", fontSize: "12px",
                  }}>
                    No image files found.
                  </div>
                ) : (
                  filtered.map(f => {
                    const folder = f.path.includes("/")
                      ? f.path.slice(0, f.path.lastIndexOf("/"))
                      : "";
                    return (
                      <div
                        key={f.path}
                        onClick={() => loadFromVault(f.path)}
                        style={{
                          padding: "6px 8px", cursor: "pointer",
                          borderBottom: "1px solid var(--nm-paper-border, #eee)",
                          display: "flex", alignItems: "center", gap: "6px",
                          minHeight: "36px",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "var(--nm-accent, #4a6fa5)";
                          (e.currentTarget as HTMLElement).style.color = "#fff";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "";
                          (e.currentTarget as HTMLElement).style.color = "";
                        }}
                      >
                        <span style={{ fontSize: "12px", fontWeight: 600 }}>{f.name}</span>
                        {folder && (
                          <span style={{ fontSize: "10px", color: "inherit", opacity: 0.6 }}>
                            {folder}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
