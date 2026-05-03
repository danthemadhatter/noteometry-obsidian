/**
 * Long-press recognizer — v1.11.0 phase-3 sub-PR 3.3.
 *
 * One source of truth for the pen-long-press gesture. Previously the
 * 550ms deadline and 8px movement slop were inlined in InkCanvas.tsx
 * with a dangling comment in NoteometryApp.tsx that quoted them. This
 * module pulls them into named constants and a pure state machine
 * the InkCanvas wires to its pointer events.
 *
 * Why pure: same pattern as `gestureRecognizer.ts` — vitest is node-env
 * (no jsdom), so the recognizer is a plain object that consumes
 * snapshots and emits "fire" / "cancel" verdicts. Tests run without
 * timers or DOM.
 *
 * State machine:
 *   idle ──pen-down──▶ armed ──hold 550ms idle──▶ fired
 *                       │
 *                       ├─move > 8px──▶ idle
 *                       └─pen-up──▶ idle
 *
 * Touch / mouse pointer types are explicitly NOT recognized. Long-press
 * on touch is owned by the LayerManager freeze gesture (4F-tap is the
 * kill switch); long-press on mouse is owned by right-click. Pen is
 * the only ambiguous surface (Apple Pencil has no reliable double-tap
 * web event).
 *
 * The 550ms timing matches iOS system long-press, and the 8px slop
 * matches iOS's own movement tolerance — so the gesture feels native
 * on iPad (the primary target).
 */

/** Long-press deadline in ms. Matches iOS system long-press. */
export const LONG_PRESS_MS = 550;

/** Movement slop in px. If pen drifts farther than this from the
 *  initial pointerdown, the press is cancelled. 8² = 64. */
export const LONG_PRESS_SLOP_PX = 8;

/** Squared slop (used in distance comparisons to avoid sqrt). */
export const LONG_PRESS_SLOP_SQ = LONG_PRESS_SLOP_PX * LONG_PRESS_SLOP_PX;

/** Pointer kinds that arm the long-press. Other types are ignored. */
export const LONG_PRESS_POINTER_TYPES = new Set<string>(["pen"]);

export interface PointerSnapshot {
  pointerType: string;
  clientX: number;
  clientY: number;
  /** Monotonic timestamp in ms (e.g. performance.now() or event.timeStamp). */
  t: number;
}

export interface LongPressVerdict {
  kind: "fire" | "cancel" | "noop";
  /** When kind === "fire": the original pointerdown coordinates. */
  origin?: { clientX: number; clientY: number };
}

export interface LongPressRecognizer {
  /** Pointerdown — arms the timer if the pointer type is recognized. */
  onPointerDown: (s: PointerSnapshot) => LongPressVerdict;
  /** Pointermove — emits "cancel" if movement exceeds slop. */
  onPointerMove: (s: PointerSnapshot) => LongPressVerdict;
  /** Pointerup — emits "cancel" if the timer was still armed. */
  onPointerUp: (s: PointerSnapshot) => LongPressVerdict;
  /** Tick — call when the deadline elapses; emits "fire" if still armed. */
  onTick: (now: number) => LongPressVerdict;
  /** Inspect raw state (test seam). */
  __peek: () => "idle" | "armed" | "fired";
}

interface ArmedState {
  startX: number;
  startY: number;
  startT: number;
  fired: boolean;
}

export interface LongPressConfig {
  /** Override the 550ms deadline (test seam). */
  deadlineMs?: number;
  /** Override the 8px slop (test seam). */
  slopPx?: number;
  /** Override the recognized pointer types (test seam). */
  pointerTypes?: ReadonlySet<string>;
}

/**
 * Create a long-press recognizer. Pure / no React / no DOM.
 *
 * The recognizer doesn't manage timers itself — the caller wires
 * `setTimeout(deadlineMs)` to `onTick`. This keeps the recognizer
 * synchronous and trivially fake-able in tests.
 */
export function createLongPressRecognizer(
  config: LongPressConfig = {},
): LongPressRecognizer {
  const deadline = config.deadlineMs ?? LONG_PRESS_MS;
  const slopSq = (config.slopPx ?? LONG_PRESS_SLOP_PX) ** 2;
  const types = config.pointerTypes ?? LONG_PRESS_POINTER_TYPES;

  let state: ArmedState | null = null;

  const reset = (): LongPressVerdict => {
    state = null;
    return { kind: "cancel" };
  };

  return {
    onPointerDown: (s) => {
      // Late pointerdown while already armed is treated as a fresh arm
      // (the user clearly started a new gesture); cancel the prior one
      // implicitly by overwriting state.
      if (!types.has(s.pointerType)) return { kind: "noop" };
      state = {
        startX: s.clientX,
        startY: s.clientY,
        startT: s.t,
        fired: false,
      };
      return { kind: "noop" };
    },

    onPointerMove: (s) => {
      if (!state || state.fired) return { kind: "noop" };
      const dx = s.clientX - state.startX;
      const dy = s.clientY - state.startY;
      if (dx * dx + dy * dy > slopSq) {
        return reset();
      }
      return { kind: "noop" };
    },

    onPointerUp: (_s) => {
      if (!state) return { kind: "noop" };
      // Pen lifted before the deadline — cancel.
      if (!state.fired) {
        return reset();
      }
      // Pen lifted AFTER fire (rare but possible on a slow lift): just
      // clear state, no extra verdict.
      state = null;
      return { kind: "noop" };
    },

    onTick: (now) => {
      if (!state || state.fired) return { kind: "noop" };
      if (now - state.startT < deadline) return { kind: "noop" };
      state.fired = true;
      return {
        kind: "fire",
        origin: { clientX: state.startX, clientY: state.startY },
      };
    },

    __peek: () => {
      if (!state) return "idle";
      return state.fired ? "fired" : "armed";
    },
  };
}
