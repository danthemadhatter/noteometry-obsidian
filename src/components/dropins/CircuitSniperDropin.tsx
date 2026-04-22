import React, {
  useReducer,
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactElement,
} from "react";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface Pin {
  id: string;
  x: number;
  y: number;
}

interface CompDef {
  pins: Pin[];
  draw: () => ReactElement;
}

interface Endpoint {
  elId?: string;
  pinId?: string;
  x: number;
  y: number;
}

interface CircuitElement {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation: number;
  label: string;
  value: string;
}

interface WireElement {
  id: string;
  type: "Wire";
  from: Endpoint;
  to: Endpoint;
}

type Element = CircuitElement | WireElement;

function isWire(el: Element): el is WireElement {
  return el.type === "Wire";
}

interface Props {
  circuitData: string;
  onChange: (updates: { circuitData: string }) => void;
}

/* ================================================================== */
/*  History reducer                                                    */
/* ================================================================== */

interface HistoryState {
  past: Element[][];
  present: Element[];
  future: Element[][];
}

type HistoryAction =
  | { type: "PUSH"; payload: Element[] }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_FULL_STATE"; payload: Element[] };

const initialHistoryState: HistoryState = {
  past: [],
  present: [],
  future: [],
};

function historyReducer(
  state: HistoryState,
  action: HistoryAction
): HistoryState {
  const { past, present, future } = state;
  switch (action.type) {
    case "PUSH":
      return {
        past: [...past, present],
        present: action.payload,
        future: [],
      };
    case "UNDO": {
      if (past.length === 0) return state;
      const prevState = past[past.length - 1]!;
      return {
        past: past.slice(0, -1),
        present: prevState,
        future: [present, ...future],
      };
    }
    case "REDO": {
      if (future.length === 0) return state;
      const nextState = future[0]!;
      return {
        past: [...past, present],
        present: nextState,
        future: future.slice(1),
      };
    }
    case "SET_FULL_STATE":
      return {
        past: [...past, present],
        present: action.payload,
        future: [],
      };
    default:
      return state;
  }
}

/* ================================================================== */
/*  Component Library - SVG symbols (viewBox 0 0 60 60)                */
/* ================================================================== */

const COMP_LIB: Record<string, CompDef> = {
  Resistor: {
    pins: [
      { id: "p1", x: 0, y: 30 },
      { id: "p2", x: 60, y: 30 },
    ],
    draw: () => (
      <path
        d="M 0 30 L 12 30 L 16 15 L 24 45 L 32 15 L 40 45 L 48 15 L 52 30 L 60 30"
        stroke="#1A1A2E"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
  Capacitor: {
    pins: [
      { id: "p1", x: 0, y: 30 },
      { id: "p2", x: 60, y: 30 },
    ],
    draw: () => (
      <path
        d="M 0 30 L 26 30 M 26 15 L 26 45 M 34 15 L 34 45 M 34 30 L 60 30"
        stroke="#1A1A2E"
        strokeWidth="2"
        fill="none"
      />
    ),
  },
  Inductor: {
    pins: [
      { id: "p1", x: 0, y: 30 },
      { id: "p2", x: 60, y: 30 },
    ],
    draw: () => (
      <path
        d="M 0 30 L 10 30 C 10 15, 22 15, 22 30 C 22 15, 34 15, 34 30 C 34 15, 46 15, 46 30 L 60 30"
        stroke="#1A1A2E"
        strokeWidth="2"
        fill="none"
      />
    ),
  },
  Diode: {
    pins: [
      { id: "p1", x: 0, y: 30 },
      { id: "p2", x: 60, y: 30 },
    ],
    draw: () => (
      <>
        <path
          d="M 0 30 L 20 30 M 20 15 L 20 45 L 40 30 Z M 40 15 L 40 45 M 40 30 L 60 30"
          stroke="#1A1A2E"
          strokeWidth="2"
          fill="none"
        />
        <path d="M 20 15 L 20 45 L 40 30 Z" fill="#1A1A2E" />
      </>
    ),
  },
  Ground: {
    pins: [{ id: "p1", x: 30, y: 0 }],
    draw: () => (
      <path
        d="M 30 0 L 30 30 M 15 30 L 45 30 M 22 40 L 38 40 M 28 50 L 32 50"
        stroke="#1A1A2E"
        strokeWidth="2"
        fill="none"
      />
    ),
  },
  "V-Source": {
    pins: [
      { id: "p1", x: 30, y: 0 },
      { id: "p2", x: 30, y: 60 },
    ],
    draw: () => (
      <>
        <circle
          cx="30"
          cy="30"
          r="18"
          stroke="#1A1A2E"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M 30 0 L 30 12 M 30 48 L 30 60 M 25 18 L 35 18 M 30 13 L 30 23 M 25 42 L 35 42"
          stroke="#1A1A2E"
          strokeWidth="2"
          fill="none"
        />
      </>
    ),
  },
  "Op-Amp": {
    pins: [
      { id: "in-", x: 0, y: 15 },
      { id: "in+", x: 0, y: 45 },
      { id: "out", x: 60, y: 30 },
    ],
    draw: () => (
      <>
        <path
          d="M 15 5 L 15 55 L 55 30 Z"
          stroke="#1A1A2E"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M 0 15 L 15 15 M 0 45 L 15 45 M 55 30 L 60 30 M 20 15 L 26 15 M 20 45 L 26 45 M 23 42 L 23 48"
          stroke="#1A1A2E"
          strokeWidth="2"
          fill="none"
        />
      </>
    ),
  },
  NPN: {
    pins: [
      { id: "B", x: 0, y: 30 },
      { id: "C", x: 45, y: 0 },
      { id: "E", x: 45, y: 60 },
    ],
    draw: () => (
      <>
        <path
          d="M 0 30 L 20 30 M 20 15 L 20 45 M 20 22 L 45 0 M 20 38 L 45 60 M 45 0 L 45 10 M 45 50 L 45 60"
          stroke="#1A1A2E"
          strokeWidth="2"
          fill="none"
        />
        <polygon points="38,53 45,60 33,58" fill="#1A1A2E" />
      </>
    ),
  },
  Switch: {
    pins: [
      { id: "p1", x: 0, y: 30 },
      { id: "p2", x: 60, y: 30 },
    ],
    draw: () => (
      <>
        <path
          d="M 0 30 L 15 30 M 45 30 L 60 30 M 15 30 L 40 15"
          stroke="#1A1A2E"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="15" cy="30" r="2" fill="#1A1A2E" />
        <circle cx="45" cy="30" r="2" fill="#1A1A2E" />
      </>
    ),
  },
  Relay: {
    pins: [
      { id: "coil1", x: 10, y: 0 },
      { id: "coil2", x: 10, y: 60 },
      { id: "com", x: 50, y: 0 },
      { id: "no", x: 40, y: 60 },
      { id: "nc", x: 60, y: 60 },
    ],
    draw: () => (
      <>
        <rect
          x="0"
          y="20"
          width="20"
          height="20"
          stroke="#1A1A2E"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M 10 0 L 10 20 M 10 40 L 10 60 M 50 0 L 50 25 L 40 45 M 40 60 L 40 45 M 60 60 L 60 45"
          stroke="#1A1A2E"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M 30 30 L 45 30"
          stroke="#1A1A2E"
          strokeWidth="1"
          strokeDasharray="2,2"
          fill="none"
        />
        <circle cx="40" cy="45" r="2" fill="#1A1A2E" />
        <circle cx="60" cy="45" r="2" fill="#1A1A2E" />
      </>
    ),
  },
};

/* ================================================================== */
/*  Geometry helpers                                                    */
/* ================================================================== */

const GRID = 15;

function snap(val: number): number {
  return Math.round(val / GRID) * GRID;
}

/** Snap wire angle to nearest 15° (covers 30°, 45°, 60°, 90° cleanly). */
function getSnap45(
  sx: number,
  sy: number,
  cx: number,
  cy: number
): { x: number; y: number } {
  const dx = cx - sx;
  const dy = cy - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 8) return { x: sx, y: sy };
  const angle = Math.atan2(dy, dx);
  // Snap to 15° increments (π/12) — cleanly hits 0, 30, 45, 60, 90, etc.
  const snapUnit = Math.PI / 12;
  const snappedAngle = Math.round(angle / snapUnit) * snapUnit;
  return {
    x: snap(sx + dist * Math.cos(snappedAngle)),
    y: snap(sy + dist * Math.sin(snappedAngle)),
  };
}

function getPinCoords(
  el: CircuitElement,
  pin: Pin
): { x: number; y: number } {
  const cx = 30,
    cy = 30;
  const rot = ((el.rotation || 0) % 360 + 360) % 360;
  const angle = (rot * Math.PI) / 180;
  const dx = pin.x - cx;
  const dy = pin.y - cy;
  const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
  const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
  const worldX = el.x + cx + rx;
  const worldY = el.y + cy + ry;
  // Only snap to grid when the component is axis-aligned (0/90/180/270).
  // At arbitrary angles (30/45/60…), grid-snapping pulls pins away from
  // their rendered rotated positions, so two angled components can never
  // line up. Preserve the exact rotated geometry instead so overlapping
  // components actually share pin locations.
  const axisAligned = rot % 90 === 0;
  if (axisAligned) {
    return { x: snap(worldX), y: snap(worldY) };
  }
  return { x: Math.round(worldX), y: Math.round(worldY) };
}

function resolveEndpoint(
  ep: Endpoint,
  elements: Element[]
): { x: number; y: number } {
  if (ep.elId && ep.pinId) {
    const el = elements.find((e) => e.id === ep.elId);
    if (el && !isWire(el)) {
      const def = COMP_LIB[el.type];
      if (def) {
        const pin = def.pins.find((p) => p.id === ep.pinId);
        if (pin) return getPinCoords(el as CircuitElement, pin);
      }
    }
  }
  return { x: ep.x, y: ep.y };
}

/* ================================================================== */
/*  CircuiTikz exporter                                                */
/* ================================================================== */

function generateCircuiTikz(elements: Element[]): string {
  const scale = 30;
  let tikz = "% Requires \\usepackage{circuitikz}\n\\begin{circuitikz}\n";

  const components = elements.filter((e) => !isWire(e)) as CircuitElement[];
  const wires = elements.filter(isWire);

  components.forEach((el) => {
    const cx = el.x / scale;
    const cy = -el.y / scale;

    const def = COMP_LIB[el.type];
    if (!def) return;
    const pin0 = def.pins[0];
    const pin1 = def.pins[1];

    if (
      ["Resistor", "Capacitor", "Inductor", "Diode", "V-Source", "Switch"].includes(
        el.type
      )
    ) {
      if (!pin0 || !pin1) return;
      const p1 = getPinCoords(el, pin0);
      const p2 = getPinCoords(el, pin1);

      let cType = "R";
      if (el.type === "Capacitor") cType = "C";
      if (el.type === "Inductor") cType = "L";
      if (el.type === "Diode") cType = "D";
      if (el.type === "V-Source") cType = "V";
      if (el.type === "Switch") cType = "spst";

      const props = [
        cType,
        el.label ? `l=${el.label}` : "",
        el.value ? `a=${el.value}` : "",
      ]
        .filter(Boolean)
        .join(", ");
      tikz += `  \\draw (${(p1.x / scale).toFixed(2)}, ${(-p1.y / scale).toFixed(2)}) to[${props}] (${(p2.x / scale).toFixed(2)}, ${(-p2.y / scale).toFixed(2)});\n`;
    } else if (el.type === "Ground") {
      if (!pin0) return;
      const p1 = getPinCoords(el, pin0);
      tikz += `  \\draw (${(p1.x / scale).toFixed(2)}, ${(-p1.y / scale).toFixed(2)}) node[ground] {};\n`;
    } else if (el.type === "Op-Amp") {
      tikz += `  \\draw (${cx.toFixed(2)}, ${cy.toFixed(2)}) node[op amp, rotate=${-el.rotation}] (${el.id}) {};\n`;
    } else if (el.type === "NPN") {
      tikz += `  \\draw (${cx.toFixed(2)}, ${cy.toFixed(2)}) node[npn, rotate=${-el.rotation}] (${el.id}) {};\n`;
    } else if (el.type === "Relay") {
      tikz += `  \\draw (${cx.toFixed(2)}, ${cy.toFixed(2)}) node[relay] (${el.id}) {};\n`;
    }
  });

  wires.forEach((wire) => {
    const p1 = resolveEndpoint(wire.from, elements);
    const p2 = resolveEndpoint(wire.to, elements);
    tikz += `  \\draw (${(p1.x / scale).toFixed(2)}, ${(-p1.y / scale).toFixed(2)}) to[short] (${(p2.x / scale).toFixed(2)}, ${(-p2.y / scale).toFixed(2)});\n`;
  });

  tikz += "\\end{circuitikz}";
  return tikz;
}

/* ================================================================== */
/*  Toolbar icon component                                             */
/* ================================================================== */

function CompIcon({ type }: { type: string }) {
  const def = COMP_LIB[type];
  if (!def) return null;
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 60 60"
      style={{ color: "var(--nm-ink, #333)", display: "block" }}
    >
      {def.draw()}
    </svg>
  );
}

/* ================================================================== */
/*  Inline style constants                                             */
/* ================================================================== */

const S = {
  root: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    width: "100%",
    overflow: "hidden",
    touchAction: "none" as const,
    fontFamily: "var(--nm-font, system-ui, sans-serif)",
    color: "var(--nm-ink, #333)",
    background: "var(--nm-faceplate, #FAFAFA)",
  },
  toolbar: {
    display: "flex",
    gap: "3px",
    padding: "4px 6px",
    borderBottom: "1px solid var(--nm-paper-border, #E0E0E0)",
    flexWrap: "wrap" as const,
    alignItems: "center",
    background: "var(--nm-faceplate, #FAFAFA)",
    minHeight: "38px",
  },
  compBtn: (active: boolean) => ({
    display: "flex",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    width: "32px",
    height: "28px",
    border: active
      ? "2px solid var(--nm-accent, #4285F4)"
      : "1px solid var(--nm-paper-border, #D0D0D0)",
    borderRadius: "4px",
    cursor: "pointer",
    background: active
      ? "var(--nm-accent-light, #E8F0FE)"
      : "var(--nm-faceplate, #FFF)",
    padding: 0,
    flexShrink: 0,
  }),
  actionBtn: (disabled: boolean) => ({
    fontSize: "10px",
    padding: "2px 8px",
    border: "1px solid var(--nm-paper-border, #D0D0D0)",
    borderRadius: "4px",
    cursor: disabled ? "default" : "pointer",
    background: "var(--nm-faceplate, #FFF)",
    color: "var(--nm-ink, #333)",
    opacity: disabled ? 0.4 : 1,
    whiteSpace: "nowrap" as const,
  }),
  exportBtn: (disabled: boolean) => ({
    fontSize: "10px",
    padding: "2px 8px",
    border: "1px solid var(--nm-accent, #4285F4)",
    borderRadius: "4px",
    cursor: disabled ? "default" : "pointer",
    background: "var(--nm-accent-light, #E8F0FE)",
    color: "var(--nm-accent, #4285F4)",
    opacity: disabled ? 0.4 : 1,
    whiteSpace: "nowrap" as const,
  }),
  canvasWrap: {
    flex: 1,
    position: "relative" as const,
    overflow: "hidden",
    cursor: "crosshair",
    background:
      "radial-gradient(var(--nm-paper-border, #cbd5e1) 1px, transparent 1px)",
    backgroundSize: "15px 15px",
  },
  svgLayer: {
    position: "absolute" as const,
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none" as const,
  },
  statusBar: {
    padding: "2px 8px",
    borderTop: "1px solid var(--nm-paper-border, #E0E0E0)",
    background: "var(--nm-faceplate, #FAFAFA)",
    fontSize: "10px",
    color: "var(--nm-ink, #888)",
    minHeight: "18px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  tikzOverlay: {
    position: "absolute" as const,
    inset: 0,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.45)",
    backdropFilter: "blur(4px)",
  },
  tikzModal: {
    background: "var(--nm-faceplate, #FFF)",
    borderRadius: "8px",
    border: "1px solid var(--nm-paper-border, #ccc)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
    width: "90%",
    maxWidth: "560px",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    maxHeight: "80%",
  },
  tikzHeader: {
    padding: "10px 14px",
    borderBottom: "1px solid var(--nm-paper-border, #ddd)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--nm-faceplate, #F6F6F6)",
  },
  tikzTextarea: {
    width: "100%",
    height: "200px",
    fontFamily: "monospace",
    fontSize: "11px",
    padding: "10px",
    background: "#1e293b",
    color: "#4ade80",
    border: "none",
    resize: "none" as const,
    outline: "none",
  },
  tikzFooter: {
    padding: "10px 14px",
    borderTop: "1px solid var(--nm-paper-border, #ddd)",
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    background: "var(--nm-faceplate, #F6F6F6)",
  },
};

/* ================================================================== */
/*  Drag state types                                                   */
/* ================================================================== */

interface DragNodeState {
  id: string;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  isDragging: boolean;
}

interface DrawWireState {
  start: Endpoint;
  currentX: number;
  currentY: number;
}

interface EditWireState {
  id: string;
  endKey: "from" | "to";
  currentX: number;
  currentY: number;
}

interface HoverPinState {
  elId: string;
  pinId: string;
  x: number;
  y: number;
}

/* ================================================================== */
/*  Main drop-in component                                             */
/* ================================================================== */

const COMP_TYPES = Object.keys(COMP_LIB);

export default function CircuitSniperDropin({
  circuitData,
  onChange,
}: Props) {
  /* -- Ref for onChange to avoid render loops -- */
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /* -- Parse initial state from circuitData (lazy, runs once) -- */
  const [initState] = useState<HistoryState>(() => {
    let els: Element[] = [];
    try {
      const parsed = JSON.parse(circuitData);
      if (Array.isArray(parsed)) els = parsed as Element[];
    } catch { /* empty */ }
    return { past: [], present: els, future: [] };
  });

  const [state, rawDispatch] = useReducer(historyReducer, initState);
  const elements = state.present;

  /* -- Sync to parent on dispatch, never in useEffect -- */
  const prevJson = useRef(circuitData);

  const dispatch = useCallback(
    (action: HistoryAction) => {
      rawDispatch(action);
      // We need the new state after dispatch. Since React batches, we use a
      // microtask to read the new elements from the reducer's result.
      // However, we can compute the result inline for PUSH/SET_FULL_STATE:
      let newElements: Element[] | null = null;
      if (action.type === "PUSH" || action.type === "SET_FULL_STATE") {
        newElements = action.payload;
      }
      // For UNDO/REDO we defer to a post-dispatch check
      if (newElements) {
        const json = JSON.stringify(newElements);
        if (json !== prevJson.current) {
          prevJson.current = json;
          onChangeRef.current({ circuitData: json });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* Persist on element change. Moved out of render phase into useEffect
     in v1.6.6 so React doesn't see side-effects-in-render during
     reconciliation (previous Promise.resolve().then(...) trick worked
     but was fragile). */
  useEffect(() => {
    const json = JSON.stringify(elements);
    if (json !== prevJson.current) {
      prevJson.current = json;
      onChangeRef.current({ circuitData: json });
    }
  }, [elements]);

  /* -- Interaction state -- */
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragNode, setDragNode] = useState<DragNodeState | null>(null);
  const [drawWire, setDrawWire] = useState<DrawWireState | null>(null);
  const [editWire, setEditWire] = useState<EditWireState | null>(null);
  const [hoverPin, setHoverPin] = useState<HoverPinState | null>(null);
  const [tikzModal, setTikzModal] = useState<string | null>(null);

  /* ---- Derived ---- */
  const components = elements.filter((e) => !isWire(e)) as CircuitElement[];
  const wires = elements.filter(isWire) as WireElement[];

  /* ---- Actions ---- */
  const addElement = useCallback(
    (type: string) => {
      const typeCount =
        elements.filter((e) => !isWire(e) && e.type === type).length + 1;
      // Stagger placement so new components don't all stack
      const compCount = elements.filter((e) => !isWire(e)).length;
      const col = compCount % 4;
      const row = Math.floor(compCount / 4);
      dispatch({
        type: "PUSH",
        payload: [
          ...elements,
          {
            id: crypto.randomUUID(),
            type,
            x: snap(75 + col * 90),
            y: snap(60 + row * 90),
            label: `${type.charAt(0)}${typeCount}`,
            value: "",
            rotation: 0,
          },
        ],
      });
    },
    [elements, dispatch]
  );

  const updateElement = useCallback(
    (id: string, field: string, value: string | number) => {
      dispatch({
        type: "PUSH",
        payload: elements.map((el) =>
          el.id === id ? { ...el, [field]: value } : el
        ),
      });
    },
    [elements, dispatch]
  );

  const deleteElement = useCallback(
    (id: string) => {
      dispatch({
        type: "PUSH",
        payload: elements.filter(
          (el) =>
            el.id !== id &&
            !(
              isWire(el) &&
              (el.from?.elId === id || el.to?.elId === id)
            )
        ),
      });
    },
    [elements, dispatch]
  );

  /* ---- Pointer handlers ---- */
  const startNodeMove = useCallback(
    (e: React.PointerEvent, el: CircuitElement) => {
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const rect = canvasRef.current!.getBoundingClientRect();
      setDragNode({
        id: el.id,
        offsetX: el.x - (e.clientX - rect.left),
        offsetY: el.y - (e.clientY - rect.top),
        x: el.x,
        y: el.y,
        startX: e.clientX,
        startY: e.clientY,
        isDragging: false,
      });
    },
    []
  );

  const startWireDraw = useCallback(
    (e: React.PointerEvent, el: CircuitElement, pin: Pin) => {
      e.stopPropagation();
      const coords = getPinCoords(el, pin);
      setDrawWire({
        start: { elId: el.id, pinId: pin.id, x: coords.x, y: coords.y },
        currentX: coords.x,
        currentY: coords.y,
      });
    },
    []
  );

  const startWireEdit = useCallback(
    (e: React.PointerEvent, wire: WireElement, endKey: "from" | "to") => {
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const coords = resolveEndpoint(wire[endKey], elements);
      setEditWire({
        id: wire.id,
        endKey,
        currentX: coords.x,
        currentY: coords.y,
      });
    },
    [elements]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (dragNode) {
        const dist = Math.hypot(
          e.clientX - dragNode.startX,
          e.clientY - dragNode.startY
        );
        if (!dragNode.isDragging && dist > 5)
          setDragNode((prev) => (prev ? { ...prev, isDragging: true } : prev));
        if (dragNode.isDragging || dist > 5)
          setDragNode((prev) =>
            prev
              ? {
                  ...prev,
                  isDragging: true,
                  x: snap(mouseX + prev.offsetX),
                  y: snap(mouseY + prev.offsetY),
                }
              : prev
          );
      } else if (drawWire) {
        const snapped = getSnap45(
          drawWire.start.x,
          drawWire.start.y,
          mouseX,
          mouseY
        );
        setDrawWire((prev) =>
          prev
            ? { ...prev, currentX: snapped.x, currentY: snapped.y }
            : prev
        );
      } else if (editWire) {
        const wire = elements.find((w) => w.id === editWire.id) as WireElement;
        if (wire) {
          const otherEnd = resolveEndpoint(
            wire[editWire.endKey === "from" ? "to" : "from"],
            elements
          );
          const snapped = getSnap45(otherEnd.x, otherEnd.y, mouseX, mouseY);
          setEditWire((prev) =>
            prev
              ? { ...prev, currentX: snapped.x, currentY: snapped.y }
              : prev
          );
        }
      }
    },
    [dragNode, drawWire, editWire, elements]
  );

  const handlePointerUp = useCallback(() => {
    if (dragNode) {
      if (dragNode.isDragging) {
        dispatch({
          type: "PUSH",
          payload: elements.map((el) =>
            el.id === dragNode.id
              ? { ...el, x: dragNode.x, y: dragNode.y }
              : el
          ),
        });
      }
      setDragNode(null);
    } else if (drawWire) {
      const endTarget: Endpoint = hoverPin
        ? {
            elId: hoverPin.elId,
            pinId: hoverPin.pinId,
            x: hoverPin.x,
            y: hoverPin.y,
          }
        : { x: drawWire.currentX, y: drawWire.currentY };
      dispatch({
        type: "PUSH",
        payload: [
          ...elements,
          {
            id: crypto.randomUUID(),
            type: "Wire" as const,
            from: drawWire.start,
            to: endTarget,
          },
        ],
      });
      setDrawWire(null);
    } else if (editWire) {
      const endTarget: Endpoint = hoverPin
        ? {
            elId: hoverPin.elId,
            pinId: hoverPin.pinId,
            x: hoverPin.x,
            y: hoverPin.y,
          }
        : { x: editWire.currentX, y: editWire.currentY };
      dispatch({
        type: "PUSH",
        payload: elements.map((el) =>
          el.id === editWire.id
            ? { ...el, [editWire.endKey]: endTarget }
            : el
        ),
      });
      setEditWire(null);
    }
  }, [dragNode, drawWire, editWire, hoverPin, elements, dispatch]);

  const handleExportTikz = useCallback(() => {
    const code = generateCircuiTikz(elements);
    setTikzModal(code);
  }, [elements]);

  const handleCopyTikz = useCallback(() => {
    if (tikzModal) {
      navigator.clipboard.writeText(tikzModal).catch(() => {
        // Clipboard API may not be available in Obsidian; fall back silently
      });
    }
  }, [tikzModal]);

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  const isRouting = drawWire !== null || editWire !== null;

  return (
    <div style={S.root}>
      {/* ============ Toolbar ============ */}
      <div style={S.toolbar}>
        {COMP_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => addElement(type)}
            title={`Add ${type}`}
            style={S.compBtn(false)}
          >
            <CompIcon type={type} />
          </button>
        ))}

        <span style={{ flex: 1 }} />

        <button
          onClick={() => dispatch({ type: "UNDO" })}
          disabled={state.past.length === 0}
          title="Undo"
          style={S.actionBtn(state.past.length === 0)}
        >
          Undo
        </button>
        <button
          onClick={() => dispatch({ type: "REDO" })}
          disabled={state.future.length === 0}
          title="Redo"
          style={S.actionBtn(state.future.length === 0)}
        >
          Redo
        </button>
        <button
          onClick={handleExportTikz}
          disabled={elements.length === 0}
          title="Export CircuiTikz to clipboard"
          style={S.exportBtn(elements.length === 0)}
        >
          Export
        </button>
      </div>

      {/* ============ Canvas ============ */}
      <div
        ref={canvasRef}
        style={S.canvasWrap}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* SVG layer for wires */}
        <svg style={S.svgLayer as React.CSSProperties}>
          {wires.map((wire) => {
            const p1 =
              editWire?.id === wire.id && editWire.endKey === "from"
                ? { x: editWire.currentX, y: editWire.currentY }
                : resolveEndpoint(wire.from, elements);
            const p2 =
              editWire?.id === wire.id && editWire.endKey === "to"
                ? { x: editWire.currentX, y: editWire.currentY }
                : resolveEndpoint(wire.to, elements);
            return (
              <g key={wire.id}>
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="var(--nm-accent, #2563eb)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                {/* Endpoint grab handles */}
                <circle
                  cx={p1.x}
                  cy={p1.y}
                  r="8"
                  fill="transparent"
                  stroke="transparent"
                  strokeWidth="2"
                  style={{ cursor: "move", pointerEvents: "auto" }}
                  onPointerDown={(e) => startWireEdit(e, wire, "from")}
                />
                <circle
                  cx={p2.x}
                  cy={p2.y}
                  r="8"
                  fill="transparent"
                  stroke="transparent"
                  strokeWidth="2"
                  style={{ cursor: "move", pointerEvents: "auto" }}
                  onPointerDown={(e) => startWireEdit(e, wire, "to")}
                />
                {/* Delete button at midpoint */}
                <g
                  style={{ cursor: "pointer", pointerEvents: "auto" }}
                  onClick={() => deleteElement(wire.id)}
                >
                  <circle
                    cx={(p1.x + p2.x) / 2}
                    cy={(p1.y + p2.y) / 2}
                    r="6"
                    fill="var(--nm-faceplate, #fff)"
                    stroke="var(--nm-paper-border, #ccc)"
                    strokeWidth="1"
                    opacity="0"
                  >
                    <set attributeName="opacity" to="1" begin="mouseover" end="mouseout" />
                  </circle>
                  <text
                    x={(p1.x + p2.x) / 2}
                    y={(p1.y + p2.y) / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="9"
                    fill="#ef4444"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                    opacity="0"
                  >
                    <set attributeName="opacity" to="1" begin="mouseover" end="mouseout" />
                    x
                  </text>
                </g>
              </g>
            );
          })}
          {/* Active wire being drawn */}
          {drawWire && (
            <line
              x1={drawWire.start.x}
              y1={drawWire.start.y}
              x2={drawWire.currentX}
              y2={drawWire.currentY}
              stroke="var(--nm-accent, #2563eb)"
              strokeWidth="2"
              strokeDasharray="4"
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Component DOM nodes */}
        {components.map((el) => {
          const compDef = COMP_LIB[el.type];
          if (!compDef) return null;
          const activeEl =
            dragNode?.id === el.id
              ? { ...el, x: dragNode.x, y: dragNode.y }
              : el;

          return (
            <div
              key={el.id}
              onPointerDown={(e) => startNodeMove(e, activeEl)}
              onContextMenu={(e) => {
                e.preventDefault();
                deleteElement(el.id);
              }}
              style={{
                left: activeEl.x - 10,
                top: activeEl.y - 10,
                position: "absolute",
                width: "80px",
                height: "80px",
                zIndex: 10,
                cursor: "move",
                opacity: dragNode?.id === el.id ? 0.8 : 1,
              }}
            >
              {/* Rotate button (top-right corner) */}
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  // Cycle: 0→30→45→60→90→120→135→150→180→210→225→240→270→300→315→330→0
                  const ANGLES = [0,30,45,60,90,120,135,150,180,210,225,240,270,300,315,330];
                  const cur = el.rotation || 0;
                  const idx = ANGLES.indexOf(cur);
                  const next = idx >= 0 ? ANGLES[(idx + 1) % ANGLES.length]! : 30;
                  updateElement(el.id, "rotation", next);
                }}
                title="Rotate (30/45/60° steps)"
                style={{
                  position: "absolute",
                  top: "-14px",
                  right: "-14px",
                  width: "22px",
                  height: "22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--nm-faceplate, #fff)",
                  border: "1px solid var(--nm-paper-border, #ccc)",
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "var(--nm-ink, #555)",
                  zIndex: 30,
                  opacity: 0,
                  transition: "opacity 0.15s",
                  pointerEvents: "auto",
                  lineHeight: 1,
                }}
                className="cs-rotate-btn"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M13 3v4h-4M13 7A6 6 0 1 0 11.5 12.5"
                    stroke="#1A1A2E"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Delete button (top-left corner) */}
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  deleteElement(el.id);
                }}
                title="Delete"
                style={{
                  position: "absolute",
                  top: "-14px",
                  left: "-14px",
                  width: "22px",
                  height: "22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--nm-faceplate, #fff)",
                  border: "1px solid var(--nm-paper-border, #ccc)",
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "#ef4444",
                  zIndex: 30,
                  opacity: 0,
                  transition: "opacity 0.15s",
                  pointerEvents: "auto",
                  lineHeight: 1,
                }}
                className="cs-delete-btn"
              >
                x
              </div>

              {/* Rotated SVG symbol — centered in 80x80 div with 10px padding */}
              <div
                style={{
                  transform: `rotate(${activeEl.rotation || 0}deg)`,
                  transformOrigin: "40px 40px",
                  width: "100%",
                  height: "100%",
                  color: "var(--nm-ink, #333)",
                  padding: "10px",
                  boxSizing: "border-box",
                }}
              >
                <svg
                  width="60"
                  height="60"
                  viewBox="0 0 60 60"
                  style={{ pointerEvents: "none", overflow: "visible" }}
                >
                  {compDef.draw()}
                </svg>

              </div>

              {/* Pins — positioned in WORLD space (outside rotation transform)
                  so hit targets match visual positions at any angle */}
              {compDef.pins.map((pin) => {
                const pinCoords = getPinCoords(activeEl, pin);
                // Pin position relative to component's top-left (accounting for 10px padding)
                const relX = pinCoords.x - activeEl.x + 10;
                const relY = pinCoords.y - activeEl.y + 10;
                const isTarget =
                  hoverPin?.elId === el.id &&
                  hoverPin?.pinId === pin.id;
                const isSoldered = wires.some(
                  (w) =>
                    (w.from.elId === el.id && w.from.pinId === pin.id) ||
                    (w.to.elId === el.id && w.to.pinId === pin.id)
                );

                let pinBg = "var(--nm-faceplate, #fff)";
                let pinBorder = "var(--nm-paper-border, #aaa)";
                let pinScale = "scale(1)";
                let pinSize = 12;

                if (isTarget || isRouting) {
                  pinBg = "var(--nm-accent-light, #93c5fd)";
                  pinBorder = "var(--nm-accent, #2563eb)";
                  pinScale = "scale(1.8)";
                  pinSize = 16;
                } else if (isSoldered) {
                  pinBg = "var(--nm-ink, #333)";
                  pinBorder = "var(--nm-ink, #333)";
                  pinScale = "scale(1.25)";
                }

                return (
                  <div
                    key={pin.id}
                    onPointerDown={(e) =>
                      startWireDraw(e, activeEl, pin)
                    }
                    onPointerEnter={() =>
                      setHoverPin({
                        elId: el.id,
                        pinId: pin.id,
                        x: pinCoords.x,
                        y: pinCoords.y,
                      })
                    }
                    onPointerLeave={() => setHoverPin(null)}
                    style={{
                      position: "absolute",
                      left: relX - pinSize / 2,
                      top: relY - pinSize / 2,
                      width: `${pinSize}px`,
                      height: `${pinSize}px`,
                      borderRadius: "50%",
                      cursor: "crosshair",
                      transition: "all 0.15s",
                      zIndex: 25,
                      pointerEvents: "auto",
                      background: pinBg,
                      border: `2px solid ${pinBorder}`,
                      transform: pinScale,
                    }}
                  />
                );
              })}

              {/* Label and value below component */}
              <div
                style={{
                  position: "absolute",
                  bottom: "-22px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  textAlign: "center",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: "bold",
                    color: "var(--nm-ink, #444)",
                  }}
                >
                  {el.label}
                </div>
                {el.value && (
                  <div
                    style={{
                      fontSize: "9px",
                      color: "var(--nm-ink, #888)",
                      opacity: 0.7,
                    }}
                  >
                    {el.value}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ============ Status bar ============ */}
      <div style={S.statusBar}>
        {isRouting ? (
          <span style={{ color: "var(--nm-accent, #2563eb)", fontWeight: 600 }}>
            Routing trace...
          </span>
        ) : (
          <span>
            Drag pins to solder traces. Hover for rotate/delete.
          </span>
        )}
        <span style={{ marginLeft: "auto" }}>
          {components.length} comp, {wires.length} wire
        </span>
      </div>

      {/* ============ Bill of Materials panel ============ */}
      {components.length > 0 && (
        <div style={{
          borderTop: "1px solid var(--nm-paper-border, #E0E0E0)",
          maxHeight: "160px", overflowY: "auto",
          background: "var(--nm-faceplate-light, #FAFAFA)",
          padding: "4px",
        }}>
          <div style={{
            fontSize: "9px", fontWeight: 700, textTransform: "uppercase" as const,
            letterSpacing: "0.5px", color: "var(--nm-ink-muted, #999)",
            padding: "2px 4px 4px", borderBottom: "1px solid var(--nm-paper-border, #E0E0E0)",
          }}>
            Bill of Materials
          </div>
          {components.map((el) => {
            const compDef = COMP_LIB[el.type];
            return (
              <div key={el.id} style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "3px 4px", borderBottom: "1px solid rgba(0,0,0,0.04)",
                fontSize: "11px",
              }}>
                {/* Component icon */}
                {compDef && (
                  <svg width="16" height="16" viewBox="0 0 60 60"
                    style={{ flexShrink: 0, color: "var(--nm-ink, #333)" }}>
                    {compDef.draw()}
                  </svg>
                )}
                {/* Label */}
                <input
                  value={el.label}
                  onChange={(e) => updateElement(el.id, "label", e.target.value)}
                  placeholder="LBL"
                  style={{
                    width: "42px", padding: "1px 3px", fontSize: "10px",
                    fontFamily: "var(--nm-font-mono, monospace)",
                    border: "1px solid var(--nm-paper-border, #ddd)", borderRadius: "3px",
                    background: "#fff", color: "var(--nm-ink, #333)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                />
                {/* Value */}
                <input
                  value={el.value}
                  onChange={(e) => updateElement(el.id, "value", e.target.value)}
                  placeholder="VAL"
                  style={{
                    width: "52px", padding: "1px 3px", fontSize: "10px",
                    fontFamily: "var(--nm-font-mono, monospace)",
                    border: "1px solid var(--nm-paper-border, #ddd)", borderRadius: "3px",
                    background: "#fff", color: "var(--nm-ink, #333)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                />
                {/* Rotation */}
                <select
                  value={el.rotation}
                  onChange={(e) => updateElement(el.id, "rotation", parseInt(e.target.value))}
                  style={{
                    width: "46px", padding: "1px 2px", fontSize: "9px",
                    fontFamily: "var(--nm-font-mono, monospace)",
                    border: "1px solid var(--nm-paper-border, #ddd)", borderRadius: "3px",
                    background: "#fff", color: "var(--nm-ink, #333)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {[0,30,45,60,90,120,135,150,180,210,225,240,270,300,315,330].map((deg) => (
                    <option key={deg} value={deg}>{deg}°</option>
                  ))}
                </select>
                {/* Delete */}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    marginLeft: "auto", background: "none", border: "none",
                    cursor: "pointer", color: "#ccc", fontSize: "12px",
                    padding: "0 4px",
                  }}
                  title="Delete component"
                >
                  x
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ============ TikZ Export Modal ============ */}
      {tikzModal && (
        <div style={S.tikzOverlay}>
          <div style={S.tikzModal}>
            <div style={S.tikzHeader}>
              <span style={{ fontWeight: 600, fontSize: "13px" }}>
                CircuiTikz Export
              </span>
              <button
                onClick={() => setTikzModal(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "16px",
                  color: "var(--nm-ink, #888)",
                }}
              >
                x
              </button>
            </div>
            <div style={{ padding: "0" }}>
              <textarea
                readOnly
                value={tikzModal}
                style={S.tikzTextarea}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            </div>
            <div style={S.tikzFooter}>
              <button
                onClick={() => setTikzModal(null)}
                style={{
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "1px solid var(--nm-paper-border, #ccc)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  background: "var(--nm-faceplate, #fff)",
                  color: "var(--nm-ink, #555)",
                }}
              >
                Close
              </button>
              <button
                onClick={handleCopyTikz}
                style={{
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  background: "var(--nm-accent, #2563eb)",
                  color: "#fff",
                }}
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hover styles injected inline via a <style> tag for .cs-rotate-btn and .cs-delete-btn */}
      <style>{`
        div:hover > .cs-rotate-btn,
        div:hover > .cs-delete-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
