/**
 * LayerManager — v1.11.0 phase-1 sub-PR 1.2.
 *
 * Owns the chrome state for the 3D-layers redesign:
 *   - Which layer is currently up: `paper | tool | meta | frozen`
 *   - `dirty` (was on NoteometryApp; moves here so SaveDot can subscribe
 *     without prop-drilling)
 *   - `pageId` — per-page frozen scope. When it changes, frozen clears.
 *     Otherwise users freeze on Page A, navigate to Page B, and the
 *     invisible frozen state strands them.
 *
 * Why a pure store + React wrapper:
 *   Same pattern as `aiActivity.tsx`. The state machine is a tiny pure
 *   reducer; mixing React in just buries it. Tests exercise the store
 *   directly without jsdom.
 *
 * State machine:
 *
 *     paper ──swipe-down──▶ tool ──swipe-up / tap-canvas / idle──▶ paper
 *       │
 *       └─swipe-right─▶ meta ──swipe-left / tap-canvas──▶ paper
 *
 *     {paper,tool,meta} ──4F-tap──▶ frozen ──resume──▶ paper
 *
 * Only one non-paper layer at a time. Swiping to a new layer while
 * another is up is intentionally a no-op (locked: the design doc
 * §5 is explicit that layers come to you one at a time; we don't
 * crossfade).
 *
 * Freeze always wins:
 *   4F-tap from any state goes to `frozen`. Resume always returns to
 *   `paper`. The previous tool/meta selection is NOT remembered —
 *   freeze is a kill-switch, not a pause-and-resume of UI state.
 *
 * Ghost-echo dismissal events:
 *   When tool or meta is dismissed, the manager emits a
 *   `LayerDismissedEvent` carrying the origin (gesture centroid, or
 *   last-known summon centroid as fallback). The future
 *   `<GhostEcho />` component subscribes to these.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type LayerState = "paper" | "tool" | "meta" | "frozen";

export interface DismissOrigin {
  x: number;
  y: number;
}

export interface LayerDismissedEvent {
  /** Which layer was just dismissed. Frozen does NOT emit (no echo for unfreeze). */
  kind: "tool" | "meta";
  /** Centroid of the dismiss gesture, or last-known summon centroid. */
  origin: DismissOrigin;
  /** performance.now()-style timestamp. */
  t: number;
}

export interface LayerManagerSnapshot {
  layer: LayerState;
  dirty: boolean;
  pageId: string | null;
}

export interface LayerManagerStore {
  /** Snapshot of current state. */
  getState: () => LayerManagerSnapshot;
  /** Subscribe to state changes. Returns unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** Subscribe to layer-dismissal events (for ghost-echo). Returns unsubscribe. */
  onDismissed: (listener: (ev: LayerDismissedEvent) => void) => () => void;

  // --- Layer transitions -----------------------------------------------
  /** Summon the tool layer (paper → tool). No-op from non-paper states.
   *  `origin` is the gesture centroid; cached for ghost-echo on dismiss. */
  summonTool: (origin?: DismissOrigin) => void;
  /** Dismiss the tool layer (tool → paper). No-op from non-tool states. */
  dismissTool: (origin?: DismissOrigin) => void;
  /** Summon the meta layer (paper → meta). No-op from non-paper states. */
  summonMeta: (origin?: DismissOrigin) => void;
  /** Dismiss the meta layer (meta → paper). No-op from non-meta states. */
  dismissMeta: (origin?: DismissOrigin) => void;

  /** Freeze from any state (any → frozen). Idempotent. */
  freeze: () => void;
  /** Unfreeze (frozen → paper). Idempotent. */
  unfreeze: () => void;

  /**
   * Convenience: dispatch a swipe-3f recognizer result based on current
   * state. Returns true if the swipe was consumed, false if no-op.
   */
  handleSwipe3F: (
    direction: "up" | "down" | "left" | "right",
    origin: DismissOrigin,
  ) => boolean;

  // --- Auxiliary state --------------------------------------------------
  /** Mark canvas dirty/clean. Drives <SaveDot />. */
  setDirty: (dirty: boolean) => void;
  /** Set the active page id. When this changes, frozen state clears
   *  (per-page scope). Pass null on app boot before any page is loaded. */
  setPageId: (pageId: string | null) => void;

  /** Test-only: peek raw internal state. */
  __peek: () => LayerManagerSnapshot;
}

interface InternalState {
  layer: LayerState;
  dirty: boolean;
  pageId: string | null;
  /** Last summon origin per layer, used as fallback ghost-echo origin. */
  lastToolOrigin: DismissOrigin | null;
  lastMetaOrigin: DismissOrigin | null;
}

const DEFAULT_ORIGIN: DismissOrigin = { x: 0, y: 0 };

/**
 * Pure (non-React) store for LayerManager. Use this in tests; the
 * `LayerManagerProvider` below wraps it for React subscribers.
 */
export function createLayerManagerStore(
  initial?: Partial<LayerManagerSnapshot>,
): LayerManagerStore {
  const state: InternalState = {
    layer: initial?.layer ?? "paper",
    dirty: initial?.dirty ?? false,
    pageId: initial?.pageId ?? null,
    lastToolOrigin: null,
    lastMetaOrigin: null,
  };
  const listeners = new Set<() => void>();
  const dismissListeners = new Set<(ev: LayerDismissedEvent) => void>();

  const notify = (): void => listeners.forEach((l) => l());
  const emitDismissed = (ev: LayerDismissedEvent): void =>
    dismissListeners.forEach((l) => l(ev));

  const now = (): number =>
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();

  const summonTool = (origin?: DismissOrigin): void => {
    if (state.layer !== "paper") return;
    state.layer = "tool";
    state.lastToolOrigin = origin ?? null;
    notify();
  };

  const dismissTool = (origin?: DismissOrigin): void => {
    if (state.layer !== "tool") return;
    state.layer = "paper";
    const echo = origin ?? state.lastToolOrigin ?? DEFAULT_ORIGIN;
    notify();
    emitDismissed({ kind: "tool", origin: echo, t: now() });
  };

  const summonMeta = (origin?: DismissOrigin): void => {
    if (state.layer !== "paper") return;
    state.layer = "meta";
    state.lastMetaOrigin = origin ?? null;
    notify();
  };

  const dismissMeta = (origin?: DismissOrigin): void => {
    if (state.layer !== "meta") return;
    state.layer = "paper";
    const echo = origin ?? state.lastMetaOrigin ?? DEFAULT_ORIGIN;
    notify();
    emitDismissed({ kind: "meta", origin: echo, t: now() });
  };

  const freeze = (): void => {
    if (state.layer === "frozen") return;
    state.layer = "frozen";
    notify();
  };

  const unfreeze = (): void => {
    if (state.layer !== "frozen") return;
    state.layer = "paper";
    notify();
  };

  const handleSwipe3F = (
    direction: "up" | "down" | "left" | "right",
    origin: DismissOrigin,
  ): boolean => {
    // While frozen, all 3F swipes are ignored (freeze blocks layer chrome).
    if (state.layer === "frozen") return false;

    switch (direction) {
      case "down":
        // Summon tool from paper. From tool/meta: no-op (only one layer
        // at a time; user must dismiss first).
        if (state.layer === "paper") {
          summonTool(origin);
          return true;
        }
        return false;
      case "up":
        if (state.layer === "tool") {
          dismissTool(origin);
          return true;
        }
        return false;
      case "right":
        if (state.layer === "paper") {
          summonMeta(origin);
          return true;
        }
        return false;
      case "left":
        if (state.layer === "meta") {
          dismissMeta(origin);
          return true;
        }
        return false;
    }
  };

  const setDirty = (dirty: boolean): void => {
    if (state.dirty === dirty) return;
    state.dirty = dirty;
    notify();
  };

  const setPageId = (pageId: string | null): void => {
    if (state.pageId === pageId) return;
    state.pageId = pageId;
    // Per-page frozen scope: navigating clears frozen. Other layer
    // states also collapse back to paper on navigation — a tool/meta
    // layer summoned for Page A's context shouldn't carry over.
    if (state.layer !== "paper") {
      state.layer = "paper";
    }
    notify();
  };

  const snapshot = (): LayerManagerSnapshot => ({
    layer: state.layer,
    dirty: state.dirty,
    pageId: state.pageId,
  });

  return {
    getState: snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    onDismissed: (listener) => {
      dismissListeners.add(listener);
      return () => {
        dismissListeners.delete(listener);
      };
    },
    summonTool,
    dismissTool,
    summonMeta,
    dismissMeta,
    freeze,
    unfreeze,
    handleSwipe3F,
    setDirty,
    setPageId,
    __peek: snapshot,
  };
}

// ---------------------------------------------------------------------------
// React wrapper
// ---------------------------------------------------------------------------

export interface LayerManagerContextValue extends LayerManagerSnapshot {
  store: LayerManagerStore;
}

const NOOP_STORE: LayerManagerStore = createLayerManagerStore();

const LayerManagerContext = createContext<LayerManagerContextValue>({
  layer: "paper",
  dirty: false,
  pageId: null,
  store: NOOP_STORE,
});

/**
 * Top-level provider. Wrap NoteometryApp in this (inside
 * AIActivityProvider — the freeze gesture in phase-3 will need both).
 */
export function LayerManagerProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<LayerManagerStore | null>(null);
  if (!storeRef.current) storeRef.current = createLayerManagerStore();
  const store = storeRef.current;

  const [snapshot, setSnapshot] = useState<LayerManagerSnapshot>(() =>
    store.getState(),
  );
  useEffect(
    () => store.subscribe(() => setSnapshot(store.getState())),
    [store],
  );

  const value = useMemo<LayerManagerContextValue>(
    () => ({
      ...snapshot,
      store,
    }),
    [snapshot, store],
  );

  return (
    <LayerManagerContext.Provider value={value}>
      {children}
    </LayerManagerContext.Provider>
  );
}

/**
 * Subscribe to LayerManager state. Outside of the provider, returns a
 * no-op default — call sites won't crash in tests that don't mount the
 * provider; they just won't observe.
 */
export function useLayerManager(): LayerManagerContextValue {
  return useContext(LayerManagerContext);
}

/** Test-only context export. */
export const __LayerManagerContext = LayerManagerContext;
