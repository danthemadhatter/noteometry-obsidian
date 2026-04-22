import { useState, useRef, useCallback, useEffect, Dispatch, SetStateAction } from "react";
import type { Stroke, Stamp } from "../../lib/inkEngine";
import type { CanvasTool } from "../../components/InkCanvas";

/**
 * Ink feature hook. Owns strokes, stamps, active tool, color, stroke width,
 * stamp selection, pending symbol placement, and undo/redo history for
 * stroke/stamp mutations.
 *
 * Canvas objects (text boxes, tables, images) are owned by useObjects and
 * are NOT part of ink undo/redo. Cross-feature operations like lasso move
 * are coordinated at the composition layer (NoteometryApp).
 */

interface UndoSnapshot {
  strokes: Stroke[];
  stamps: Stamp[];
}

export interface UseInkReturn {
  // State
  strokes: Stroke[];
  stamps: Stamp[];
  tool: CanvasTool;
  activeColor: string;
  strokeWidth: number;
  selectedStampId: string | null;
  pendingSymbol: string | null;
  canUndo: boolean;
  canRedo: boolean;

  // Actions (React Dispatch types accept both direct values and functional updates)
  setStrokes: Dispatch<SetStateAction<Stroke[]>>;
  setStamps: Dispatch<SetStateAction<Stamp[]>>;
  handleStrokesChange: (strokes: Stroke[]) => void;
  handleStampsChange: (stamps: Stamp[]) => void;
  setTool: Dispatch<SetStateAction<CanvasTool>>;
  setActiveColor: Dispatch<SetStateAction<string>>;
  setStrokeWidth: Dispatch<SetStateAction<number>>;
  setSelectedStampId: Dispatch<SetStateAction<string | null>>;
  setPendingSymbol: Dispatch<SetStateAction<string | null>>;
  pushUndo: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  onEraseStart: () => void;
  onEraseEnd: () => void;
  hydrate: (strokes: Stroke[], stamps: Stamp[]) => void;
  clearUndoHistory: () => void;
}

export function useInk(): UseInkReturn {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  // v1.6.9: default to "pen" so Apple Pencil / mouse can draw as soon as
  // the view opens. Pre-1.6.9 the default was "select", which silently
  // disabled the ink layer (pointer-events:none) and was the reason Dan
  // reported "Apple Pencil does not work on iPad" — the ink canvas wasn't
  // listening. Objects are now always selectable/draggable regardless of
  // the ink tool, so "select" is no longer needed as a discrete mode for
  // the basic tap-to-select / drag-to-move flow.
  const [tool, setToolState] = useState<CanvasTool>("pen");
  // Fountain pen navy — reads as "black enough" on the pale canvas, less
  // harsh than pure #000, consistent with the military palette's ink tone.
  const [activeColor, setActiveColor] = useState("#1a2a4a");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const [pendingSymbol, setPendingSymbol] = useState<string | null>(null);

  // Mirror refs: let stable callbacks read latest state without re-creating.
  // This is the "stale closure prevention" pattern documented in DEVELOPMENT.md.
  const strokesRef = useRef(strokes);
  const stampsRef = useRef(stamps);
  strokesRef.current = strokes;
  stampsRef.current = stamps;

  // Eraser session tracking: we want one undo entry per eraser drag,
  // not one per stroke erased.
  const erasingRef = useRef(false);

  const undoStackRef = useRef<UndoSnapshot[]>([]);
  const redoStackRef = useRef<UndoSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Clear stamp selection when switching away from select tool.
  // (Canvas object selection is cleared by the composition layer since it
  // belongs to a different feature.)
  useEffect(() => {
    if (tool !== "select") {
      setSelectedStampId(null);
    }
  }, [tool]);

  const setTool: Dispatch<SetStateAction<CanvasTool>> = useCallback((next) => {
    setToolState(next);
  }, []);

  const pushUndo = useCallback(() => {
    undoStackRef.current.push({
      strokes: strokesRef.current,
      stamps: stampsRef.current,
    });
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const handleStrokesChange = useCallback((newStrokes: Stroke[]) => {
    if (!erasingRef.current) pushUndo();
    setStrokes(newStrokes);
  }, [pushUndo]);

  const handleStampsChange = useCallback((newStamps: Stamp[]) => {
    if (!erasingRef.current) pushUndo();
    setStamps(newStamps);
  }, [pushUndo]);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop()!;
    redoStackRef.current.push({
      strokes: strokesRef.current,
      stamps: stampsRef.current,
    });
    setStrokes(prev.strokes);
    setStamps(prev.stamps);
    setSelectedStampId(null);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  }, []);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push({
      strokes: strokesRef.current,
      stamps: stampsRef.current,
    });
    setStrokes(next.strokes);
    setStamps(next.stamps);
    setSelectedStampId(null);
    setCanRedo(redoStackRef.current.length > 0);
    setCanUndo(true);
  }, []);

  const onEraseStart = useCallback(() => {
    erasingRef.current = true;
    pushUndo();
  }, [pushUndo]);

  const onEraseEnd = useCallback(() => {
    erasingRef.current = false;
  }, []);

  const clearUndoHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const hydrate = useCallback((nextStrokes: Stroke[], nextStamps: Stamp[]) => {
    setStrokes(nextStrokes);
    setStamps(nextStamps);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setSelectedStampId(null);
  }, []);

  return {
    strokes,
    stamps,
    tool,
    activeColor,
    strokeWidth,
    selectedStampId,
    pendingSymbol,
    canUndo,
    canRedo,
    setStrokes,
    setStamps,
    handleStrokesChange,
    handleStampsChange,
    setTool,
    setActiveColor,
    setStrokeWidth,
    setSelectedStampId,
    setPendingSymbol,
    pushUndo,
    handleUndo,
    handleRedo,
    onEraseStart,
    onEraseEnd,
    hydrate,
    clearUndoHistory,
  };
}
