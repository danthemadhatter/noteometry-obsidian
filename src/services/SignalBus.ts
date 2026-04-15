/**
 * SignalBus — singleton pub/sub hub that links the Graph Plotter,
 * Unit Circle, and Oscilloscope drop-ins so they can visualize
 * the same signal simultaneously with bidirectional control.
 *
 * Key design decisions:
 *   - Throttled to ~30fps (33ms) to avoid feedback loops
 *   - Publisher ID exclusion: when a drop-in publishes, it doesn't
 *     receive its own update back
 *   - Partial updates: callers can publish any subset of SignalState
 */

export type WaveformType = "sine" | "square" | "sawtooth" | "triangle" | "pulse" | "dc";

export interface SignalState {
  frequency: number;      // Hz, default 1
  amplitude: number;      // default 1
  phase: number;          // radians offset, default 0
  theta: number;          // current angle in radians (the "playhead")
  waveformType: WaveformType;
  isPlaying: boolean;     // whether the oscilloscope animation is running
}

export type SignalSubscriber = (state: SignalState) => void;

const DEFAULT_STATE: SignalState = {
  frequency: 1,
  amplitude: 1,
  phase: 0,
  theta: 0,
  waveformType: "sine",
  isPlaying: false,
};

const THROTTLE_MS = 33; // ~30fps

export class SignalBus {
  private state: SignalState = { ...DEFAULT_STATE };
  private subscribers = new Map<string, SignalSubscriber>();
  private lastDispatchTime = 0;
  private pendingUpdate: { patch: Partial<SignalState>; publisherId: string } | null = null;
  private rafId = 0;

  /** Current snapshot (read-only). */
  getState(): Readonly<SignalState> {
    return this.state;
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(id: string, callback: SignalSubscriber): () => void {
    this.subscribers.set(id, callback);
    return () => { this.subscribers.delete(id); };
  }

  /**
   * Publish a partial update. The update is delivered to all subscribers
   * EXCEPT the publisher (identified by `publisherId`), throttled to ~30fps.
   */
  update(patch: Partial<SignalState>, publisherId: string): void {
    // Merge into current state immediately so getState() is always fresh
    Object.assign(this.state, patch);

    // Throttle dispatching to subscribers
    const now = performance.now();
    const elapsed = now - this.lastDispatchTime;

    if (elapsed >= THROTTLE_MS) {
      this.dispatchToSubscribers(publisherId);
    } else {
      // Coalesce: store the latest patch and schedule a flush
      this.pendingUpdate = { patch, publisherId };
      if (!this.rafId) {
        this.rafId = requestAnimationFrame(() => {
          this.rafId = 0;
          if (this.pendingUpdate) {
            this.dispatchToSubscribers(this.pendingUpdate.publisherId);
            this.pendingUpdate = null;
          }
        });
      }
    }
  }

  /** Reset to defaults (useful when all drop-ins unlink). */
  reset(): void {
    this.state = { ...DEFAULT_STATE };
  }

  /** Clean up any pending rAF on plugin unload. */
  destroy(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.subscribers.clear();
    this.pendingUpdate = null;
  }

  private dispatchToSubscribers(publisherId: string): void {
    this.lastDispatchTime = performance.now();
    const snapshot = { ...this.state };
    for (const [id, cb] of this.subscribers) {
      if (id !== publisherId) {
        try { cb(snapshot); } catch { /* swallow per-subscriber errors */ }
      }
    }
  }
}

// Module-level singleton — one per plugin load
let instance: SignalBus | null = null;

export function getSignalBus(): SignalBus {
  if (!instance) instance = new SignalBus();
  return instance;
}

export function destroySignalBus(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
