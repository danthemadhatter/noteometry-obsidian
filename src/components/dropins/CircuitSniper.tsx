import React, { useState, useReducer, useRef, useEffect, useCallback } from "react";
import { requestUrl } from "obsidian";
import katex from "katex";
import type { CircuitSniperObject, CircuitElement } from "../../lib/canvasObjects";
import type NoteometryPlugin from "../../main";

/* ── Component Library ──────────────────────────────── */

interface PinDef {
  id: string;
  x: number;
  y: number;
}

interface CompDef {
  pins: PinDef[];
  draw: () => React.ReactElement;
}

const COMP_LIB: Record<string, CompDef> = {
  Resistor: {
    pins: [{ id: "p1", x: 0, y: 30 }, { id: "p2", x: 60, y: 30 }],
    draw: () => (
      <path d="M 0 30 L 12 30 L 16 15 L 24 45 L 32 15 L 40 45 L 48 15 L 52 30 L 60 30"
        stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
    ),
  },
  Capacitor: {
    pins: [{ id: "p1", x: 0, y: 30 }, { id: "p2", x: 60, y: 30 }],
    draw: () => (
      <path d="M 0 30 L 26 30 M 26 15 L 26 45 M 34 15 L 34 45 M 34 30 L 60 30"
        stroke="currentColor" strokeWidth="2" fill="none" />
    ),
  },
  Inductor: {
    pins: [{ id: "p1", x: 0, y: 30 }, { id: "p2", x: 60, y: 30 }],
    draw: () => (
      <path d="M 0 30 L 10 30 C 10 15, 22 15, 22 30 C 22 15, 34 15, 34 30 C 34 15, 46 15, 46 30 L 60 30"
        stroke="currentColor" strokeWidth="2" fill="none" />
    ),
  },
  Diode: {
    pins: [{ id: "p1", x: 0, y: 30 }, { id: "p2", x: 60, y: 30 }],
    draw: () => (
      <>
        <path d="M 0 30 L 20 30 M 20 15 L 20 45 L 40 30 Z M 40 15 L 40 45 M 40 30 L 60 30"
          stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M 20 15 L 20 45 L 40 30 Z" fill="currentColor" />
      </>
    ),
  },
  Ground: {
    pins: [{ id: "p1", x: 30, y: 0 }],
    draw: () => (
      <path d="M 30 0 L 30 30 M 15 30 L 45 30 M 22 40 L 38 40 M 28 50 L 32 50"
        stroke="currentColor" strokeWidth="2" fill="none" />
    ),
  },
  "V-Source": {
    pins: [{ id: "p1", x: 30, y: 0 }, { id: "p2", x: 30, y: 60 }],
    draw: () => (
      <>
        <circle cx="30" cy="30" r="18" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M 30 0 L 30 12 M 30 48 L 30 60 M 25 18 L 35 18 M 30 13 L 30 23 M 25 42 L 35 42"
          stroke="currentColor" strokeWidth="2" fill="none" />
      </>
    ),
  },
  "Op-Amp": {
    pins: [{ id: "in-", x: 0, y: 15 }, { id: "in+", x: 0, y: 45 }, { id: "out", x: 60, y: 30 }],
    draw: () => (
      <>
        <path d="M 15 5 L 15 55 L 55 30 Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M 0 15 L 15 15 M 0 45 L 15 45 M 55 30 L 60 30 M 20 15 L 26 15 M 20 45 L 26 45 M 23 42 L 23 48"
          stroke="currentColor" strokeWidth="2" fill="none" />
      </>
    ),
  },
  NPN: {
    pins: [{ id: "B", x: 0, y: 30 }, { id: "C", x: 45, y: 0 }, { id: "E", x: 45, y: 60 }],
    draw: () => (
      <>
        <path d="M 0 30 L 20 30 M 20 15 L 20 45 M 20 22 L 45 0 M 20 38 L 45 60 M 45 0 L 45 10 M 45 50 L 45 60"
          stroke="currentColor" strokeWidth="2" fill="none" />
        <polygon points="38,53 45,60 33,58" fill="currentColor" />
      </>
    ),
  },
  Switch: {
    pins: [{ id: "p1", x: 0, y: 30 }, { id: "p2", x: 60, y: 30 }],
    draw: () => (
      <>
        <path d="M 0 30 L 15 30 M 45 30 L 60 30 M 15 30 L 40 15"
          stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="15" cy="30" r="2" fill="currentColor" />
        <circle cx="45" cy="30" r="2" fill="currentColor" />
      </>
    ),
  },
  Relay: {
    pins: [
      { id: "coil1", x: 10, y: 0 }, { id: "coil2", x: 10, y: 60 },
      { id: "com", x: 50, y: 0 }, { id: "no", x: 40, y: 60 }, { id: "nc", x: 60, y: 60 },
    ],
    draw: () => (
      <>
        <rect x="0" y="20" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M 10 0 L 10 20 M 10 40 L 10 60 M 50 0 L 50 25 L 40 45 M 40 60 L 40 45 M 60 60 L 60 45"
          stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M 30 30 L 45 30" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" fill="none" />
        <circle cx="40" cy="45" r="2" fill="currentColor" />
        <circle cx="60" cy="45" r="2" fill="currentColor" />
      </>
    ),
  },
  "I-Source": {
    pins: [{ id: "p1", x: 30, y: 0 }, { id: "p2", x: 30, y: 60 }],
    draw: () => (
      <>
        <circle cx="30" cy="30" r="18" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M 30 0 L 30 12 M 30 48 L 30 60 M 30 20 L 30 40 M 26 36 L 30 40 L 34 36"
          stroke="currentColor" strokeWidth="2" fill="none" />
      </>
    ),
  },
};

const COMP_KEYS = Object.keys(COMP_LIB);

/* ── Geometry helpers ───────────────────────────────── */

const snap = (val: number) => Math.round(val / 15) * 15;

const getSnap45 = (sx: number, sy: number, cx: number, cy: number) => {
  const dx = cx - sx;
  const dy = cy - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 8) return { x: sx, y: sy };
  const angle = Math.atan2(dy, dx);
  const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return { x: snap(sx + dist * Math.cos(snappedAngle)), y: snap(sy + dist * Math.sin(snappedAngle)) };
};

const getPinCoords = (el: CircuitElement, pin: PinDef) => {
  const cx = 30, cy = 30;
  const angle = (el.rotation || 0) * (Math.PI / 180);
  const dx = pin.x - cx;
  const dy = pin.y - cy;
  const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
  const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
  return { x: el.x + cx + rx, y: el.y + cy + ry };
};

interface Endpoint {
  elId?: string;
  pinId?: string;
  x: number;
  y: number;
}

const resolveEndpoint = (ep: Endpoint, elements: CircuitElement[]) => {
  if (ep.elId && ep.pinId) {
    const el = elements.find(e => e.id === ep.elId);
    const compDef = el ? COMP_LIB[el.type] : undefined;
    if (el && compDef) {
      const pin = compDef.pins.find(p => p.id === ep.pinId);
      if (pin) return getPinCoords(el, pin);
    }
  }
  return { x: ep.x, y: ep.y };
};

/* ── CircuiTikz exporter ────────────────────────────── */

const generateCircuiTikz = (elements: CircuitElement[]) => {
  const scale = 30;
  let tikz = "% Requires \\usepackage{circuitikz}\n\\begin{circuitikz}\n";

  const components = elements.filter(e => e.type !== "Wire");
  const wires = elements.filter(e => e.type === "Wire");

  components.forEach(el => {
    const compDef = COMP_LIB[el.type];
    if (!compDef) return;
    if (["Resistor", "Capacitor", "Inductor", "Diode", "V-Source", "Switch"].includes(el.type)) {
      if (compDef.pins.length < 2) return;
      const p1 = getPinCoords(el, compDef.pins[0]!);
      const p2 = getPinCoords(el, compDef.pins[1]!);
      let cType = "R";
      if (el.type === "Capacitor") cType = "C";
      if (el.type === "Inductor") cType = "L";
      if (el.type === "Diode") cType = "D";
      if (el.type === "V-Source") cType = "V";
      if (el.type === "Switch") cType = "spst";
      const props = [cType, el.label ? `l=${el.label}` : "", el.value ? `a=${el.value}` : ""].filter(Boolean).join(", ");
      tikz += `  \\draw (${(p1.x / scale).toFixed(2)}, ${(-p1.y / scale).toFixed(2)}) to[${props}] (${(p2.x / scale).toFixed(2)}, ${(-p2.y / scale).toFixed(2)});\n`;
    } else if (el.type === "Ground") {
      if (compDef.pins.length < 1) return;
      const p1 = getPinCoords(el, compDef.pins[0]!);
      tikz += `  \\draw (${(p1.x / scale).toFixed(2)}, ${(-p1.y / scale).toFixed(2)}) node[ground] {};\n`;
    } else if (el.type === "Op-Amp") {
      const cx = el.x / scale;
      const cy = -el.y / scale;
      tikz += `  \\draw (${cx.toFixed(2)}, ${cy.toFixed(2)}) node[op amp, rotate=${-el.rotation}] (${el.id.slice(0, 8)}) {};\n`;
    } else if (el.type === "NPN") {
      const cx = el.x / scale;
      const cy = -el.y / scale;
      tikz += `  \\draw (${cx.toFixed(2)}, ${cy.toFixed(2)}) node[npn, rotate=${-el.rotation}] (${el.id.slice(0, 8)}) {};\n`;
    }
  });

  wires.forEach(wire => {
    const p1 = resolveEndpoint(wire.from!, elements);
    const p2 = resolveEndpoint(wire.to!, elements);
    tikz += `  \\draw (${(p1.x / scale).toFixed(2)}, ${(-p1.y / scale).toFixed(2)}) to[short] (${(p2.x / scale).toFixed(2)}, ${(-p2.y / scale).toFixed(2)});\n`;
  });

  tikz += "\\end{circuitikz}";
  return tikz;
};

/* ── History reducer (undo/redo) ────────────────────── */

interface HistoryState {
  past: CircuitElement[][];
  present: CircuitElement[];
  future: CircuitElement[][];
}

type HistoryAction =
  | { type: "PUSH"; payload: CircuitElement[] }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_FULL_STATE"; payload: CircuitElement[] }
  | { type: "INIT"; payload: CircuitElement[] };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  const { past, present, future } = state;
  switch (action.type) {
    case "PUSH":
      return { past: [...past, present], present: action.payload, future: [] };
    case "UNDO":
      return past.length === 0 ? state : { past: past.slice(0, -1), present: past[past.length - 1]!, future: [present, ...future] };
    case "REDO":
      return future.length === 0 ? state : { past: [...past, present], present: future[0]!, future: future.slice(1) };
    case "SET_FULL_STATE":
      return { past: [...past, present], present: action.payload, future: [] };
    case "INIT":
      return { past: [], present: action.payload, future: [] };
    default:
      return state;
  }
}

/* ── KaTeX governing equations ──────────────────────── */

function LatexEquations({ components }: { components: CircuitElement[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const types = new Set(components.map(c => c.type));
    const eq: string[] = [];
    if (types.has("Resistor")) eq.push("V = I \\cdot R");
    if (types.has("Capacitor")) eq.push("I = C \\frac{dV}{dt}");
    if (types.has("Inductor")) eq.push("V = L \\frac{dI}{dt}");
    if (types.has("Op-Amp")) eq.push("V_{out} = A_{ol}(V_{+} - V_{-})");

    if (eq.length === 0) {
      ref.current.innerHTML = '<div style="color: var(--nm-text, #888); font-size: 11px;">Add components to derive governing equations...</div>';
      return;
    }
    try {
      ref.current.innerHTML = eq.map(e => katex.renderToString(e, { displayMode: true, throwOnError: false })).join("");
    } catch {
      ref.current.innerHTML = '<div style="color: #c00; font-size: 11px;">LaTeX Syntax Error</div>';
    }
  }, [components]);

  return <div ref={ref} style={{ fontSize: "13px", overflowX: "auto" }} />;
}

/* ── Render LLM response with KaTeX math ────────────── */

function renderLLMResponseWithMath(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  return parts.map((part, index) => {
    try {
      if (part.startsWith("$$") && part.endsWith("$$")) {
        return <div key={index} dangerouslySetInnerHTML={{ __html: katex.renderToString(part.slice(2, -2), { displayMode: true, throwOnError: false }) }} />;
      }
      if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
        return <span key={index} dangerouslySetInnerHTML={{ __html: katex.renderToString(part.slice(1, -1), { displayMode: false, throwOnError: false }) }} />;
      }
    } catch {
      return <span key={index} style={{ color: "#c00", fontFamily: "monospace" }}>{part}</span>;
    }
    return <span key={index} style={{ whiteSpace: "pre-wrap" }}>{part}</span>;
  });
}

/* ── Props ──────────────────────────────────────────── */

interface Props {
  obj: CircuitSniperObject;
  onChange: (patch: Partial<CircuitSniperObject>) => void;
  plugin?: NoteometryPlugin;
  onSendToAI?: (dataUrl: string) => void;
}

/* ── Main Component ─────────────────────────────────── */

export default function CircuitSniper({ obj, onChange, plugin, onSendToAI }: Props) {
  const initialState: HistoryState = { past: [], present: obj.elements || [], future: [] };
  const [state, dispatch] = useReducer(historyReducer, initialState);
  const elements = state.present;

  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [dragNode, setDragNode] = useState<{
    id: string; offsetX: number; offsetY: number;
    x: number; y: number; startX: number; startY: number; isDragging: boolean;
  } | null>(null);
  const [drawWire, setDrawWire] = useState<{
    start: Endpoint; currentX: number; currentY: number;
  } | null>(null);
  const [editWire, setEditWire] = useState<{
    id: string; endKey: "from" | "to"; currentX: number; currentY: number;
  } | null>(null);
  const [hoverPin, setHoverPin] = useState<{
    elId: string; pinId: string; x: number; y: number;
  } | null>(null);

  const [llmQuery, setLlmQuery] = useState("");
  const [llmResponse, setLlmResponse] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [tikzModal, setTikzModal] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showBOM, setShowBOM] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);

  // Debounced persistence
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ elements: state.present });
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [state.present]);

  // Sync from parent if elements changed externally (e.g. undo at page level)
  const prevObjElements = useRef(obj.elements);
  useEffect(() => {
    if (obj.elements !== prevObjElements.current) {
      prevObjElements.current = obj.elements;
      // Only re-init if substantially different (avoid loop from our own onChange)
      if (JSON.stringify(obj.elements) !== JSON.stringify(state.present)) {
        dispatch({ type: "INIT", payload: obj.elements || [] });
      }
    }
  }, [obj.elements]);

  /* ── Element operations ───────────────────────────── */

  const addElement = useCallback((type: string) => {
    const typeCount = elements.filter(e => e.type === type).length + 1;
    dispatch({
      type: "PUSH",
      payload: [
        ...elements,
        {
          id: crypto.randomUUID(), type,
          x: 120, y: 120, rotation: 0,
          label: `${type.charAt(0)}${typeCount}`, value: "",
        },
      ],
    });
  }, [elements]);

  const updateElement = useCallback((id: string, field: string, value: string | number) => {
    dispatch({
      type: "PUSH",
      payload: elements.map(el => el.id === id ? { ...el, [field]: value } : el),
    });
  }, [elements]);

  const deleteElement = useCallback((id: string) => {
    dispatch({
      type: "PUSH",
      payload: elements.filter(el =>
        el.id !== id && !(el.type === "Wire" && (el.from?.elId === id || el.to?.elId === id))
      ),
    });
  }, [elements]);

  /* ── Drag / wire handlers ─────────────────────────── */

  const startNodeMove = useCallback((e: React.PointerEvent, el: CircuitElement) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragNode({
      id: el.id,
      offsetX: el.x - (e.clientX - rect.left),
      offsetY: el.y - (e.clientY - rect.top),
      x: el.x, y: el.y,
      startX: e.clientX, startY: e.clientY,
      isDragging: false,
    });
  }, []);

  const startWireDraw = useCallback((e: React.PointerEvent, el: CircuitElement, pin: PinDef) => {
    e.stopPropagation();
    const coords = getPinCoords(el, pin);
    setDrawWire({
      start: { elId: el.id, pinId: pin.id, x: coords.x, y: coords.y },
      currentX: coords.x, currentY: coords.y,
    });
  }, []);

  const startWireEdit = useCallback((e: React.PointerEvent, wire: CircuitElement, endKey: "from" | "to") => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const ep = wire[endKey];
    if (!ep) return;
    const coords = resolveEndpoint(ep, elements);
    setEditWire({ id: wire.id, endKey, currentX: coords.x, currentY: coords.y });
  }, [elements]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (dragNode) {
      const dist = Math.hypot(e.clientX - dragNode.startX, e.clientY - dragNode.startY);
      if (!dragNode.isDragging && dist > 5) setDragNode(prev => prev ? { ...prev, isDragging: true } : null);
      if (dragNode.isDragging) setDragNode(prev => prev ? { ...prev, x: snap(mouseX + prev.offsetX), y: snap(mouseY + prev.offsetY) } : null);
    } else if (drawWire) {
      const snapped = getSnap45(drawWire.start.x, drawWire.start.y, mouseX, mouseY);
      setDrawWire(prev => prev ? { ...prev, currentX: snapped.x, currentY: snapped.y } : null);
    } else if (editWire) {
      const wire = elements.find(w => w.id === editWire.id);
      if (!wire) return;
      const otherEnd = resolveEndpoint(wire[editWire.endKey === "from" ? "to" : "from"]!, elements);
      const snapped = getSnap45(otherEnd.x, otherEnd.y, mouseX, mouseY);
      setEditWire(prev => prev ? { ...prev, currentX: snapped.x, currentY: snapped.y } : null);
    }
  }, [dragNode, drawWire, editWire, elements]);

  const handlePointerUp = useCallback(() => {
    if (dragNode) {
      if (dragNode.isDragging) {
        dispatch({ type: "PUSH", payload: elements.map(el => el.id === dragNode.id ? { ...el, x: dragNode.x, y: dragNode.y } : el) });
      }
      setDragNode(null);
    } else if (drawWire) {
      const endTarget: Endpoint = hoverPin
        ? { elId: hoverPin.elId, pinId: hoverPin.pinId, x: hoverPin.x, y: hoverPin.y }
        : { x: drawWire.currentX, y: drawWire.currentY };
      dispatch({
        type: "PUSH",
        payload: [...elements, { id: crypto.randomUUID(), type: "Wire", x: 0, y: 0, rotation: 0, label: "", value: "", from: drawWire.start, to: endTarget }],
      });
      setDrawWire(null);
    } else if (editWire) {
      const endTarget: Endpoint = hoverPin
        ? { elId: hoverPin.elId, pinId: hoverPin.pinId, x: hoverPin.x, y: hoverPin.y }
        : { x: editWire.currentX, y: editWire.currentY };
      dispatch({
        type: "PUSH",
        payload: elements.map(el => el.id === editWire.id ? { ...el, [editWire.endKey]: endTarget } : el),
      });
      setEditWire(null);
    }
  }, [dragNode, drawWire, editWire, hoverPin, elements]);

  /* ── Vault image picker for vision scan ───────────── */

  const scanFromVaultImage = useCallback(async (filePath: string) => {
    if (!plugin) return;
    setShowImagePicker(false);
    setIsScanning(true);
    setLlmResponse("Reading image from vault...");
    setShowAnalysis(true);
    try {
      const ab = await plugin.app.vault.adapter.readBinary(filePath);
      const ext = filePath.split(".").pop()?.toLowerCase() || "png";
      const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
      const b64 = `data:${mime};base64,` + Buffer.from(new Uint8Array(ab)).toString("base64");
      await scanSchematicWithVision(b64);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLlmResponse(`Failed to read image: ${msg}`);
      setIsScanning(false);
    }
  }, [plugin]);

  /* ── LM Studio Vision API ─────────────────────────── */

  const scanSchematicWithVision = useCallback(async (base64Image: string) => {
    setIsScanning(true);
    setLlmResponse("Transmitting image to LM Studio vision model...");
    setShowAnalysis(true);
    const lmUrl = plugin?.settings.lmStudioUrl || "http://localhost:1234";
    const visionModel = plugin?.settings.lmStudioVisionModel || "local-model";
    try {
      const res = await requestUrl({
        url: `${lmUrl}/v1/chat/completions`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: visionModel,
          messages: [
            {
              role: "system",
              content: `You are a strict, deterministic schematic extraction engine.
Analyze the image and return ONLY raw JSON. No markdown, no explanations.
[{"id": "<generate-uuid>", "type": "Resistor", "x": 120, "y": 120, "rotation": 0, "label": "R1", "value": "10k"}]`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Scan this schematic and return the JSON array of components." },
                { type: "image_url", image_url: { url: base64Image } },
              ],
            },
          ],
          temperature: 0.1,
        }),
      });

      if (res.status !== 200) throw new Error(`HTTP Status: ${res.status}`);
      const data = res.json;
      const rawText = data.choices?.[0]?.message?.content || "[]";
      const jsonString = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      const newComponents = JSON.parse(jsonString);
      if (!Array.isArray(newComponents)) throw new Error("Model did not return a valid JSON array.");

      const validated: CircuitElement[] = newComponents.map((c: Record<string, unknown>) => ({
        id: (c.id as string) || crypto.randomUUID(),
        type: (c.type as string) || "Resistor",
        x: snap((c.x as number) || 120),
        y: snap((c.y as number) || 120),
        rotation: (c.rotation as number) || 0,
        label: (c.label as string) || "",
        value: (c.value as string) || "",
      }));

      dispatch({ type: "SET_FULL_STATE", payload: validated });
      setLlmResponse("Scan complete. Components imported.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLlmResponse(`Vision Scan Failed: ${msg}\nEnsure LM Studio is running and a Vision model is loaded.`);
    } finally {
      setIsScanning(false);
    }
  }, [plugin]);

  /* ── LM Studio Text Analysis ──────────────────────── */

  const analyzeCircuitWithLLM = useCallback(async () => {
    setIsAnalyzing(true);
    setLlmResponse("Connecting to LM Studio...");
    setShowAnalysis(true);
    const lmUrl = plugin?.settings.lmStudioUrl || "http://localhost:1234";
    const textModel = plugin?.settings.lmStudioTextModel || "local-model";
    try {
      const res = await requestUrl({
        url: `${lmUrl}/v1/chat/completions`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: textModel,
          messages: [
            { role: "system", content: "You are an expert electrical engineering calculator. Analyze the provided circuit state. Answer the user's specific question. Use strict LaTeX formatting ($...$ for inline, $$...$$ for block) for ALL math." },
            { role: "user", content: `Circuit State: ${JSON.stringify(elements, null, 2)}\n\nUser Question: ${llmQuery || "Provide a general analysis and calculate relevant parameters."}` },
          ],
          temperature: 0.2,
        }),
      });
      if (res.status !== 200) throw new Error(`HTTP Status: ${res.status}`);
      const data = res.json;
      setLlmResponse(data.choices?.[0]?.message?.content || "No response.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLlmResponse(`Error: ${msg}\nEnsure LM Studio is running.`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [elements, llmQuery, plugin]);

  /* ── Export snapshot (for lasso capture) ───────────── */

  const exportSnapshot = useCallback(() => {
    if (!svgRef.current || !onSendToAI) return;
    const svgEl = svgRef.current;
    const bbox = svgEl.getBBox();
    const pad = 20;
    const w = Math.max(bbox.width + pad * 2, 200);
    const h = Math.max(bbox.height + pad * 2, 200);
    const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute("viewBox", `${bbox.x - pad} ${bbox.y - pad} ${w} ${h}`);
    svgClone.setAttribute("width", String(w * 2));
    svgClone.setAttribute("height", String(h * 2));
    svgClone.style.background = "white";
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      onSendToAI(canvas.toDataURL("image/png"));
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }, [onSendToAI]);

  /* ── CircuiTikz export ────────────────────────────── */

  const handleExportTikz = useCallback(() => {
    setTikzModal(generateCircuiTikz(elements));
  }, [elements]);

  const handleCopyTikz = useCallback(() => {
    if (tikzModal) {
      navigator.clipboard.writeText(tikzModal);
    }
  }, [tikzModal]);

  /* ── Derived ──────────────────────────────────────── */

  const components = elements.filter(e => e.type !== "Wire");
  const wires = elements.filter(e => e.type === "Wire");

  /* ── Image picker files ───────────────────────────── */

  const imageFiles = plugin
    ? plugin.app.vault.getFiles().filter(f => ["png", "jpg", "jpeg", "gif", "webp"].includes(f.extension))
    : [];

  /* ── Inline styles (no Tailwind) ──────────────────── */

  const S = {
    root: {
      display: "flex", flexDirection: "column" as const,
      width: "100%", height: "100%",
      background: "var(--nm-canvas-bg, var(--nm-panel-bg, #f8f7f4))",
      color: "var(--nm-text, #333)",
      fontFamily: "inherit", fontSize: "13px",
      overflow: "hidden", position: "relative" as const,
    },
    topBar: {
      display: "flex", alignItems: "center", gap: "4px",
      padding: "4px 6px", flexShrink: 0,
      borderBottom: "1px solid var(--nm-border, #ddd)",
      background: "var(--nm-panel-bg, #f5f2ea)",
      overflowX: "auto" as const, overflowY: "hidden" as const,
      whiteSpace: "nowrap" as const,
    },
    compBtn: (active = false) => ({
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: "44px", minHeight: "44px", height: "36px",
      padding: "2px 6px", border: "1px solid var(--nm-border, #ccc)",
      borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: 600 as const,
      background: active ? "var(--nm-accent, #4a6fa5)" : "var(--nm-panel-bg, #fff)",
      color: active ? "#fff" : "var(--nm-text, #333)",
      flexShrink: 0,
    }),
    actionBtn: (variant: "default" | "accent" | "danger" = "default") => ({
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: "44px", minHeight: "44px", height: "36px",
      padding: "2px 8px", border: "1px solid var(--nm-border, #ccc)",
      borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: 600 as const,
      background: variant === "accent" ? "var(--nm-accent, #4a6fa5)" :
        variant === "danger" ? "#c44" : "var(--nm-panel-bg, #fff)",
      color: variant === "default" ? "var(--nm-text, #333)" : "#fff",
      flexShrink: 0,
    }),
    canvas: {
      flex: 1, position: "relative" as const,
      background: "radial-gradient(var(--nm-border, #cbd5e1) 1px, transparent 1px)",
      backgroundSize: "15px 15px",
      overflow: "hidden", cursor: "crosshair",
      touchAction: "none" as const,
    },
    analysisPanel: {
      borderTop: "1px solid var(--nm-border, #ddd)",
      background: "var(--nm-panel-bg, #f5f2ea)",
      maxHeight: "180px", overflow: "auto",
      padding: "8px", flexShrink: 0,
    },
    bomPanel: {
      position: "absolute" as const, top: 0, right: 0,
      width: "260px", height: "100%",
      background: "var(--nm-panel-bg, #f5f2ea)",
      borderLeft: "1px solid var(--nm-border, #ddd)",
      display: "flex", flexDirection: "column" as const,
      zIndex: 100, overflow: "hidden",
    },
    modal: {
      position: "absolute" as const, inset: 0, zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.4)", padding: "16px",
    },
    modalCard: {
      background: "var(--nm-panel-bg, #fff)",
      border: "1px solid var(--nm-border, #ccc)",
      borderRadius: "8px", maxWidth: "500px", width: "100%",
      display: "flex", flexDirection: "column" as const,
      overflow: "hidden",
    },
    input: {
      padding: "4px 6px", fontSize: "12px", fontFamily: "monospace",
      border: "1px solid var(--nm-border, #ccc)", borderRadius: "3px",
      background: "var(--nm-canvas-bg, #fff)",
      minHeight: "36px", boxSizing: "border-box" as const,
    },
  };

  return (
    <div style={S.root}>
      {/* ── Top bar: component library + actions ──── */}
      <div style={S.topBar}>
        {COMP_KEYS.map(type => (
          <button
            key={type}
            style={S.compBtn()}
            onClick={() => addElement(type)}
            title={type}
          >
            <svg width="20" height="20" viewBox="0 0 60 60" style={{ color: "var(--nm-text, #333)" }}>
              {COMP_LIB[type]!.draw()}
            </svg>
          </button>
        ))}
        <div style={{ width: 1, height: 28, background: "var(--nm-border, #ccc)", flexShrink: 0 }} />
        <button style={S.actionBtn()} onClick={() => dispatch({ type: "UNDO" })} disabled={state.past.length === 0} title="Undo">
          Undo
        </button>
        <button style={S.actionBtn()} onClick={() => dispatch({ type: "REDO" })} disabled={state.future.length === 0} title="Redo">
          Redo
        </button>
        <div style={{ width: 1, height: 28, background: "var(--nm-border, #ccc)", flexShrink: 0 }} />
        <button style={S.actionBtn()} onClick={() => setShowImagePicker(true)} disabled={isScanning} title="Vision Scan">
          {isScanning ? "Scanning..." : "Scan"}
        </button>
        <button style={S.actionBtn()} onClick={handleExportTikz} title="Export CircuiTikz">
          TikZ
        </button>
        {onSendToAI && (
          <button style={S.actionBtn()} onClick={exportSnapshot} title="Send snapshot to AI">
            AI
          </button>
        )}
        <button
          style={S.actionBtn(showBOM ? "accent" : "default")}
          onClick={() => setShowBOM(v => !v)}
          title="Bill of Materials"
        >
          BOM
        </button>
        <button
          style={S.actionBtn(showAnalysis ? "accent" : "default")}
          onClick={() => setShowAnalysis(v => !v)}
          title="Analysis Panel"
        >
          Analysis
        </button>
      </div>

      {/* ── Middle: schematic canvas ────────────── */}
      <div style={{ flex: 1, position: "relative", display: "flex", minHeight: 0 }}>
        <div
          ref={canvasRef}
          style={S.canvas}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
        >
          <svg
            ref={svgRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          >
            {/* Wires */}
            {wires.map(wire => {
              const p1 = (editWire?.id === wire.id && editWire.endKey === "from")
                ? { x: editWire.currentX, y: editWire.currentY }
                : resolveEndpoint(wire.from!, elements);
              const p2 = (editWire?.id === wire.id && editWire.endKey === "to")
                ? { x: editWire.currentX, y: editWire.currentY }
                : resolveEndpoint(wire.to!, elements);
              return (
                <g key={wire.id}>
                  <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke="var(--nm-accent, #2563eb)" strokeWidth="2" strokeLinecap="round" />
                  <circle cx={p1.x} cy={p1.y} r="10" fill="transparent"
                    style={{ cursor: "move", pointerEvents: "auto" }}
                    onPointerDown={(e) => startWireEdit(e, wire, "from")} />
                  <circle cx={p2.x} cy={p2.y} r="10" fill="transparent"
                    style={{ cursor: "move", pointerEvents: "auto" }}
                    onPointerDown={(e) => startWireEdit(e, wire, "to")} />
                </g>
              );
            })}
            {/* Wire-in-progress */}
            {drawWire && (
              <line
                x1={drawWire.start.x} y1={drawWire.start.y}
                x2={drawWire.currentX} y2={drawWire.currentY}
                stroke="var(--nm-accent, #2563eb)" strokeWidth="2"
                strokeDasharray="4" strokeLinecap="round"
              />
            )}
          </svg>

          {/* Components */}
          {components.map(el => {
            const compDef = COMP_LIB[el.type];
            if (!compDef) return null;
            const activeEl = dragNode?.id === el.id ? { ...el, x: dragNode.x, y: dragNode.y } : el;
            const isSelected = selectedId === el.id;
            return (
              <div
                key={el.id}
                className="nm-circuit-component"
                onPointerDown={(e) => {
                  setSelectedId(el.id);
                  startNodeMove(e, activeEl);
                }}
                style={{
                  position: "absolute", left: activeEl.x, top: activeEl.y,
                  width: 60, height: 60, zIndex: 10,
                  cursor: "move", opacity: dragNode?.id === el.id ? 0.8 : 1,
                  touchAction: "none",
                }}
              >
                {/* Rotate button — hidden by default, visible on hover (desktop) or selection (touch) */}
                <div
                  className="nm-circuit-rotate-btn"
                  style={{
                    position: "absolute", top: -28, right: -8,
                    width: 22, height: 22, borderRadius: "50%",
                    background: "var(--nm-panel-bg, #fff)",
                    border: "1px solid var(--nm-border, #ccc)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", fontSize: "12px", zIndex: 30,
                    opacity: isSelected ? 1 : 0,
                    transition: "opacity 0.15s",
                    pointerEvents: isSelected ? "auto" : undefined,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    updateElement(el.id, "rotation", ((el.rotation || 0) + 45) % 360);
                  }}
                  title="Rotate 45 deg"
                >
                  &#x21bb;
                </div>
                <div style={{ transform: `rotate(${activeEl.rotation || 0}deg)`, transformOrigin: "30px 30px", width: 60, height: 60, color: "var(--nm-text, #333)" }}>
                  <svg width="60" height="60" viewBox="0 0 60 60" style={{ pointerEvents: "none" }}>
                    {compDef.draw()}
                  </svg>
                  {/* Pins — 20×20 invisible hit target, 8px visible dot */}
                  {compDef.pins.map(pin => {
                    const pinCoords = getPinCoords(activeEl, pin);
                    const isTarget = hoverPin?.elId === el.id && hoverPin?.pinId === pin.id;
                    const isSoldered = wires.some(w =>
                      (w.from?.elId === el.id && w.from?.pinId === pin.id) ||
                      (w.to?.elId === el.id && w.to?.pinId === pin.id)
                    );
                    return (
                      <div
                        key={pin.id}
                        onPointerDown={(e) => startWireDraw(e, activeEl, pin)}
                        onPointerEnter={() => setHoverPin({ elId: el.id, pinId: pin.id, x: pinCoords.x, y: pinCoords.y })}
                        onPointerLeave={() => setHoverPin(null)}
                        style={{
                          position: "absolute", left: pin.x - 10, top: pin.y - 10,
                          width: 20, height: 20,
                          cursor: "crosshair", zIndex: 20,
                          pointerEvents: "auto",
                          background: "transparent",
                        }}
                      >
                        {/* Visible 8px pin dot */}
                        <div style={{
                          position: "absolute", top: 6, left: 6,
                          width: 8, height: 8, borderRadius: "50%",
                          background: isTarget || drawWire
                            ? "var(--nm-accent, #60a5fa)"
                            : isSoldered ? "var(--nm-text, #333)" : "var(--nm-panel-bg, #fff)",
                          border: isTarget || drawWire
                            ? "2px solid #fff"
                            : isSoldered ? "2px solid var(--nm-text, #333)" : "2px solid var(--nm-border, #94a3b8)",
                          transition: "all 0.15s",
                          boxSizing: "border-box",
                        }} />
                      </div>
                    );
                  })}
                </div>
                {/* Label & value below component — positioned at top: 64px for pin clearance */}
                <div style={{ position: "absolute", top: 64, left: "50%", transform: "translateX(-50%)", textAlign: "center", pointerEvents: "none", whiteSpace: "nowrap" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--nm-text, #333)" }}>{el.label}</div>
                  <div style={{ fontSize: "10px", color: "var(--nm-text, #888)" }}>{el.value}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── BOM side panel ──────────────────────── */}
        {showBOM && (
          <div style={S.bomPanel}>
            <div style={{
              padding: "8px", borderBottom: "1px solid var(--nm-border, #ddd)",
              fontWeight: 700, fontSize: "11px", textTransform: "uppercase" as const,
              letterSpacing: "0.05em",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span>Bill of Materials</span>
              <button style={{ ...S.actionBtn(), minWidth: "36px", minHeight: "36px", height: "28px" }} onClick={() => setShowBOM(false)}>X</button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "6px" }}>
              {components.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--nm-text, #aaa)", marginTop: 12, fontSize: "12px" }}>
                  Canvas empty.
                </div>
              )}
              {components.map(el => (
                <div key={el.id} style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "4px", marginBottom: "4px",
                  background: "var(--nm-canvas-bg, #fff)",
                  border: "1px solid var(--nm-border, #ddd)",
                  borderRadius: "4px",
                }}>
                  <svg width="16" height="16" viewBox="0 0 60 60" style={{ color: "var(--nm-text, #333)", flexShrink: 0 }}>
                    {COMP_LIB[el.type]?.draw()}
                  </svg>
                  <input
                    value={el.label}
                    onChange={(e) => updateElement(el.id, "label", e.target.value)}
                    placeholder="LBL"
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ ...S.input, width: "50px", minHeight: "36px" }}
                  />
                  <input
                    value={el.value}
                    onChange={(e) => updateElement(el.id, "value", e.target.value)}
                    placeholder="VAL"
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ ...S.input, width: "60px", minHeight: "36px" }}
                  />
                  <select
                    value={el.rotation}
                    onChange={(e) => updateElement(el.id, "rotation", parseInt(e.target.value))}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ ...S.input, width: "50px", fontSize: "10px", minHeight: "36px" }}
                  >
                    {[0, 45, 90, 135, 180, 225, 270, 315].map(r => (
                      <option key={r} value={r}>{r}°</option>
                    ))}
                  </select>
                  <button
                    onClick={() => deleteElement(el.id)}
                    style={{
                      ...S.actionBtn("danger"),
                      minWidth: "36px", minHeight: "44px",
                      height: "28px", padding: "0 6px",
                    }}
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom: collapsible analysis panel ──── */}
      {showAnalysis && (
        <div style={S.analysisPanel}>
          <div style={{ marginBottom: "6px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "4px" }}>
              Governing Math
            </div>
            <LatexEquations components={components} />
          </div>
          {llmResponse && (
            <div style={{ borderTop: "1px solid var(--nm-border, #ddd)", paddingTop: "6px", marginTop: "6px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--nm-accent, #2563eb)", textTransform: "uppercase" as const, marginBottom: "4px" }}>
                System Output
              </div>
              <div style={{ fontSize: "12px", lineHeight: 1.5 }}>
                {renderLLMResponseWithMath(llmResponse)}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
            <textarea
              value={llmQuery}
              onChange={(e) => setLlmQuery(e.target.value)}
              placeholder="Ask LM Studio to calculate..."
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              style={{ ...S.input, flex: 1, resize: "none", height: "44px", fontFamily: "inherit" }}
            />
            <button
              onClick={analyzeCircuitWithLLM}
              disabled={isAnalyzing || elements.length === 0}
              style={S.actionBtn("accent")}
            >
              {isAnalyzing ? "..." : "Calc"}
            </button>
          </div>
        </div>
      )}

      {/* ── TikZ export modal ──────────────────── */}
      {tikzModal && (
        <div style={S.modal} onClick={() => setTikzModal(null)}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--nm-border, #ddd)",
              fontWeight: 700, fontSize: "14px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span>CircuiTikz Export</span>
              <button style={S.actionBtn()} onClick={() => setTikzModal(null)}>X</button>
            </div>
            <textarea
              readOnly value={tikzModal}
              style={{
                margin: "12px", padding: "10px", fontFamily: "monospace", fontSize: "11px",
                height: "200px", resize: "none", border: "1px solid var(--nm-border, #ccc)",
                borderRadius: "4px", background: "#1e1e1e", color: "#4ade80",
              }}
            />
            <div style={{
              padding: "10px 14px", display: "flex", justifyContent: "flex-end", gap: "8px",
              borderTop: "1px solid var(--nm-border, #ddd)",
            }}>
              <button style={S.actionBtn()} onClick={() => setTikzModal(null)}>Close</button>
              <button style={S.actionBtn("accent")} onClick={handleCopyTikz}>Copy to Clipboard</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Vault image picker modal ───────────── */}
      {showImagePicker && (
        <div style={S.modal} onClick={() => setShowImagePicker(false)}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--nm-border, #ddd)",
              fontWeight: 700, fontSize: "14px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span>Select Schematic Image</span>
              <button style={S.actionBtn()} onClick={() => setShowImagePicker(false)}>X</button>
            </div>
            <div style={{ padding: "12px", maxHeight: "300px", overflow: "auto" }}>
              {imageFiles.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--nm-text, #aaa)", padding: "20px" }}>
                  No image files found in vault.
                </div>
              ) : (
                <select
                  size={Math.min(imageFiles.length, 10)}
                  style={{ width: "100%", padding: "6px", fontSize: "13px", minHeight: "44px" }}
                  onChange={(e) => {
                    if (e.target.value) scanFromVaultImage(e.target.value);
                  }}
                >
                  <option value="">Choose an image...</option>
                  {imageFiles.map(f => (
                    <option key={f.path} value={f.path}>{f.path}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
