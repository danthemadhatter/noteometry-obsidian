/**
 * AIActivityContext — v1.11.0 phase-0 refactor.
 *
 * Why this exists:
 *   In v1.10 the AI lifecycle lived as ad-hoc booleans on each drop-in.
 *   ChatDropin had its own `pending`, MathDropin had its own spinner,
 *   the lasso vision call (handleProcess123) had no UI signal at all
 *   beyond the spawned drop-in's local state. Nothing could observe
 *   "is ANY AI call in flight right now?" — which is what the v1.11
 *   AI activity ribbon and the freeze gesture's soft-abort both need.
 *
 * What this is:
 *   A single React context that aggregates active AI calls across the
 *   whole app. Each call site grabs a unique callId and pings
 *   begin(callId) / end(callId). The context tracks the live set; UI
 *   components subscribe to `count` (number of in-flight calls) or
 *   `isActive` (count > 0).
 *
 * What this is NOT (and the v1.11 phase-1 freeze gesture wires this in):
 *   It does not own AbortControllers itself. The actual cancellation
 *   path is per-call-site: ChatDropin / processCrop each carry their
 *   own cancel token. When LayerManager.freeze() lands in phase 1, it
 *   will iterate the active tokens (a separate registry) and flip
 *   them. This context is purely the OBSERVATION layer — "is anything
 *   happening" — not the control layer.
 *
 * Soft-abort note (per design doc §1b):
 *   `requestUrl` (Claude / Perplexity / OpenAI on iPad — load-bearing
 *   for CORS) cannot be aborted at the network layer. Soft-abort means
 *   the call completes over the wire, but its result is dropped via a
 *   token check. This context's `count` correctly drops to zero when
 *   the call site flips its cancel token AND calls end(callId), even
 *   though the bytes are still inbound. Don't conflate.
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export interface AIActivityState {
  /** Number of AI calls currently in flight (vision + chat aggregated). */
  count: number;
  /** Convenience: count > 0. Use this for ribbon visibility. */
  isActive: boolean;
  /**
   * Mark a call started. Returns the same callId so you can chain:
   *   const id = ai.begin();
   *   try { ... } finally { ai.end(id); }
   * Each callId is opaque; do not parse it. The provider rejects empty
   * IDs and treats double-begins on the same ID as no-ops.
   */
  begin: (callId?: string) => string;
  /**
   * Mark a call complete. No-op if the ID was never begun or has
   * already ended. Safe to call from finally blocks even when the
   * call site is uncertain whether begin() ran.
   */
  end: (callId: string) => void;
}

/** A vanilla (non-React) store. The React provider is a thin wrapper.
 *  Extracted so that unit tests can exercise the aggregation logic
 *  without mounting a React tree, and so that future non-React call
 *  sites (e.g. a Settings tab status indicator) can subscribe directly. */
export interface AIActivityStore {
  /** Snapshot of count right now. */
  getCount: () => number;
  /** Same as `count > 0`. */
  getIsActive: () => boolean;
  begin: (callId?: string) => string;
  end: (callId: string) => void;
  /** Subscribe to count changes. Returns an unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
  /** Test-only: snapshot the live id set. */
  __peekLiveSet: () => Set<string>;
}

export function createAIActivityStore(): AIActivityStore {
  const liveSet = new Set<string>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const begin = (callId?: string): string => {
    const id =
      callId && callId.length > 0
        ? callId
        : `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (liveSet.has(id)) return id;
    liveSet.add(id);
    notify();
    return id;
  };

  const end = (callId: string): void => {
    if (!callId) return;
    if (!liveSet.has(callId)) return;
    liveSet.delete(callId);
    notify();
  };

  return {
    getCount: () => liveSet.size,
    getIsActive: () => liveSet.size > 0,
    begin,
    end,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    __peekLiveSet: () => new Set(liveSet),
  };
}

const NOOP: AIActivityState = {
  count: 0,
  isActive: false,
  begin: (id) => id ?? "",
  end: () => {},
};

const AIActivityContext = createContext<AIActivityState>(NOOP);

/**
 * Top-level provider. Wrap NoteometryApp in this. The provider holds
 * the live-call set in a ref and a derived count in state — the ref
 * is the source of truth (so begin/end during async callbacks don't
 * race state setters), and the count is mirrored into React state so
 * subscribers re-render.
 */
export function AIActivityProvider({ children }: { children: ReactNode }) {
  // Store is created once per provider mount and persists for the
  // lifetime of the tree. Listeners (the React effect below) re-render
  // on every begin/end so subscribers see the new count.
  const storeRef = useRef<AIActivityStore | null>(null);
  if (!storeRef.current) storeRef.current = createAIActivityStore();
  const store = storeRef.current;

  const [count, setCount] = useState(0);
  useEffect(() => store.subscribe(() => setCount(store.getCount())), [store]);

  const value = useMemo<AIActivityState>(
    () => ({
      count,
      isActive: count > 0,
      begin: store.begin,
      end: store.end,
    }),
    [count, store],
  );

  return (
    <AIActivityContext.Provider value={value}>
      {children}
    </AIActivityContext.Provider>
  );
}

/**
 * Subscribe to the AI activity state. Outside of the provider this
 * returns the no-op default — call sites can call begin/end without
 * crashing in tests that don't mount the provider; they just won't
 * be observable.
 */
export function useAIActivity(): AIActivityState {
  return useContext(AIActivityContext);
}

/**
 * Test-only: expose the raw context for advanced subscribers (e.g.
 * the future <AIActivityRibbon /> may want to peek the live set).
 * Kept narrow to discourage misuse.
 */
export const __AIActivityContext = AIActivityContext;
