/**
 * Gesture recognizers for v1.11 3D-layers — pure logic, no React.
 *
 * Why pure logic:
 *   - Testable without jsdom + React Testing Library
 *   - The four guardrails from the design doc §2 are all pure
 *     state-machine decisions; mixing React in just buries them
 *   - Future non-React call sites (e.g. a global window listener
 *     for diagnostics) can reuse the same recognizer
 *
 * Recognized gestures:
 *   - 3-finger swipe (down/right/up/left) — ToolLayer / MetaLayer
 *     summon and dismiss
 *   - 4-finger tap (any direction, low movement) — racing-fuel
 *     freeze gesture
 *
 * Both share the same four guardrails:
 *   1. 50ms debounce: don't classify until the finger count has been
 *      stable for 50ms. Prevents pop-on-touch when fingers land in
 *      rapid succession (palm + index on iPad).
 *   2. Pencil-active lockout: if a Pencil pointer event fired in the
 *      last 250ms, ignore all multi-finger gestures. Palm-during-Pencil
 *      will not summon layers.
 *   3. Peak finger count over the first 80ms: a sloppy 4-finger tap
 *      that started as 3 still classifies as freeze, not as 3-finger
 *      swipe. Peak rules.
 *   4. Velocity floor (trackpad): for swipe gestures only, require
 *      the swipe's average velocity to exceed a floor. A slow
 *      two-finger rest on the MBP trackpad must NOT register.
 *
 * The recognizer is fed via `feed(ev)` (touch + mouse + pen via
 * PointerEvent). It returns a small classification object when a
 * gesture commits, or null otherwise. Callers do not need to track
 * timing themselves.
 *
 * iPad / Z Fold quirks acknowledged:
 *   - Samsung 3-finger swipe-down captures a screenshot at the OS
 *     level on Z Fold; not our problem to detect, just need to know
 *     the recognizer's swipe-down may never fire on Samsung devices
 *     (mitigation: 3-finger swipe-up = tool layer dismiss is
 *     reachable; 3-finger swipe-right = meta layer is unaffected).
 *   - WebKit on iPadOS occasionally fires extra pointerdown for the
 *     same logical touch; idempotency on `pointerId` handles this.
 */

/** Swipe directions. The recognizer reports the direction; the
 *  LayerManager decides what to do with each one. */
export type SwipeDirection = "up" | "down" | "left" | "right";

export interface Swipe3FResult {
  kind: "swipe-3f";
  direction: SwipeDirection;
  /** Centroid of the gesture (end position) in viewport coords. Used by ghost-echo. */
  origin: { x: number; y: number };
  /** Average pixels per second across the gesture. */
  velocity: number;
  /** End timestamp (performance.now() compatible). */
  endTime: number;
}

export interface Tap4FResult {
  kind: "tap-4f";
  origin: { x: number; y: number };
  endTime: number;
}

export type GestureResult = Swipe3FResult | Tap4FResult;

export interface PointerSnapshot {
  /** Pointer id from PointerEvent.pointerId (or synthesized for touch). */
  pointerId: number;
  /** "mouse" | "pen" | "touch" from PointerEvent.pointerType. */
  pointerType: "mouse" | "pen" | "touch";
  /** Viewport x. */
  x: number;
  /** Viewport y. */
  y: number;
  /** Phase. */
  phase: "down" | "move" | "up" | "cancel";
  /** Timestamp (performance.now() ms). */
  t: number;
}

export interface RecognizerConfig {
  /** Min swipe distance in pixels. Default 60. */
  swipeMinDistance: number;
  /** Max swipe duration in ms. Default 250. */
  swipeMaxDuration: number;
  /** Min swipe velocity in px/sec. Default 240 (60px / 250ms). */
  swipeMinVelocity: number;
  /** Stability window: count must hold for this long before classification commits. Default 50ms. */
  stabilityWindowMs: number;
  /** Window during which we track peak finger count. Default 80ms. */
  peakWindowMs: number;
  /** After a pen pointer event, ignore multi-finger for this long. Default 250ms. */
  pencilLockoutMs: number;
  /** Max movement allowed for a tap (4F) gesture in pixels. Default 30. */
  tapMaxMovement: number;
  /** Max duration for a tap gesture in ms. Default 250. */
  tapMaxDuration: number;
}

export const DEFAULT_RECOGNIZER_CONFIG: RecognizerConfig = {
  swipeMinDistance: 60,
  swipeMaxDuration: 250,
  swipeMinVelocity: 240,
  stabilityWindowMs: 50,
  peakWindowMs: 80,
  pencilLockoutMs: 250,
  tapMaxMovement: 30,
  tapMaxDuration: 250,
};

/** Per-pointer record kept for the entire session (NOT cleared on up). */
interface PointerHistory {
  pointerId: number;
  startX: number;
  startY: number;
  startT: number;
  /** Latest seen position (updated on move and up). */
  curX: number;
  curY: number;
  /** True once we've seen up/cancel for this pointer. */
  ended: boolean;
}

export interface GestureRecognizer {
  /** Feed a pointer event. Returns a result if a gesture committed
   *  this frame, otherwise null. */
  feed: (ev: PointerSnapshot) => GestureResult | null;
  /** Reset all state — useful when the user navigates away. */
  reset: () => void;
  /** Test-only: peek live (non-ended) pointer count. */
  __peekActiveCount: () => number;
}

/**
 * Build a unified recognizer that emits both swipe-3f and tap-4f
 * results. One recognizer handles both because they share state
 * (active pointers, pencil lockout, peak count).
 *
 * Lifetime model:
 *   - A "session" begins on the first pointer-down after the
 *     recognizer is empty (no live touch pointers).
 *   - The session collects every touch/mouse pointer that goes down
 *     during it, in `history`.
 *   - When all live pointers have ended (up/cancel), classification
 *     runs once against the session's peak finger count and centroid
 *     start→end vector.
 *   - History is then cleared, ready for a fresh session.
 *
 * Pen events never enter the session; they only update lastPenT for
 * the pencil-lockout guardrail.
 */
export function createGestureRecognizer(
  config: Partial<RecognizerConfig> = {},
): GestureRecognizer {
  const cfg: RecognizerConfig = { ...DEFAULT_RECOGNIZER_CONFIG, ...config };

  /** Every touch/mouse pointer seen this session, keyed by id.
   *  Pointers stay in the map after `up`; we use them to compute
   *  start/end centroids at classification time. Pen events are
   *  excluded. */
  const history = new Map<number, PointerHistory>();
  /** Live (non-ended) pointer count. Cheaper than scanning history. */
  let liveCount = 0;
  /** Last time we saw a pen pointer (any phase). Used for pencil lockout. */
  let lastPenT = -Infinity;
  /** When the current session started — first pointer-down after empty. */
  let sessionStartT = 0;
  /** Peak live count observed in this session within the peak window. */
  let peakCount = 0;
  /** When we last observed a count change. Used for stability window. */
  let lastCountChangeT = 0;
  /** Whether this session has already classified (we don't fire twice). */
  let classified = false;
  /** True when there's an active session in flight. */
  let inSession = false;

  const clearSession = (): void => {
    history.clear();
    liveCount = 0;
    sessionStartT = 0;
    peakCount = 0;
    lastCountChangeT = 0;
    classified = false;
    inSession = false;
  };

  const startSession = (t: number): void => {
    history.clear();
    liveCount = 0;
    sessionStartT = t;
    peakCount = 0;
    lastCountChangeT = t;
    classified = false;
    inSession = true;
  };

  const feed = (ev: PointerSnapshot): GestureResult | null => {
    // Pencil branch: never enters the session; only updates the
    // lockout clock so subsequent multi-finger gestures get suppressed.
    if (ev.pointerType === "pen") {
      lastPenT = ev.t;
      return null;
    }

    if (ev.phase === "down") {
      if (!inSession) startSession(ev.t);
      // Idempotent: WebKit can re-fire pointerdown for the same id.
      if (!history.has(ev.pointerId)) {
        history.set(ev.pointerId, {
          pointerId: ev.pointerId,
          startX: ev.x,
          startY: ev.y,
          startT: ev.t,
          curX: ev.x,
          curY: ev.y,
          ended: false,
        });
        liveCount += 1;
        // Track peak only within the peak window.
        if (ev.t - sessionStartT <= cfg.peakWindowMs) {
          peakCount = Math.max(peakCount, liveCount);
        }
        lastCountChangeT = ev.t;
      }
      return null;
    }

    if (ev.phase === "move") {
      const ptr = history.get(ev.pointerId);
      if (ptr && !ptr.ended) {
        ptr.curX = ev.x;
        ptr.curY = ev.y;
      }
      return null;
    }

    // up | cancel — classification happens on the LAST pointer up of a session.
    if (ev.phase === "up" || ev.phase === "cancel") {
      const ptr = history.get(ev.pointerId);
      if (ptr && !ptr.ended) {
        ptr.curX = ev.x;
        ptr.curY = ev.y;
        ptr.ended = true;
        liveCount -= 1;
      }

      // Wait for the session to fully complete before classifying.
      if (liveCount > 0) return null;
      if (!inSession) return null;
      if (classified) {
        // Already fired; reset for next session.
        clearSession();
        return null;
      }

      const sessionEnd = ev.t;

      // --- Guardrail 2: Pencil lockout ---------------------------------
      // If a pen event fired in the lockout window before or during
      // this session, suppress multi-finger classification.
      if (sessionEnd - lastPenT < cfg.pencilLockoutMs) {
        clearSession();
        return null;
      }

      // --- Guardrail 3: Peak finger count ------------------------------
      // Use peak count (within peak window) for the gesture decision,
      // NOT current count. A sloppy 4F-as-3F-then-4F still classifies
      // as freeze.
      const fingers = peakCount;
      if (fingers !== 3 && fingers !== 4) {
        clearSession();
        return null;
      }

      // --- Guardrail 1: Stability window -------------------------------
      // The most recent count change must be at least stabilityWindowMs
      // before sessionEnd. Guards against flicker at the start of the
      // session (count thrash on landing).
      if (sessionEnd - lastCountChangeT < cfg.stabilityWindowMs) {
        clearSession();
        return null;
      }

      // --- Centroid + vector -------------------------------------------
      // Average start position and average end position across every
      // pointer in this session's history.
      let sumStartX = 0;
      let sumStartY = 0;
      let sumEndX = 0;
      let sumEndY = 0;
      const n = history.size;
      for (const p of history.values()) {
        sumStartX += p.startX;
        sumStartY += p.startY;
        sumEndX += p.curX;
        sumEndY += p.curY;
      }
      const startCx = sumStartX / n;
      const startCy = sumStartY / n;
      const endCx = sumEndX / n;
      const endCy = sumEndY / n;

      const dx = endCx - startCx;
      const dy = endCy - startCy;
      const distance = Math.hypot(dx, dy);
      const duration = sessionEnd - sessionStartT;
      const velocity = duration > 0 ? (distance / duration) * 1000 : 0;
      const origin = { x: endCx, y: endCy };

      classified = true;

      if (fingers === 4) {
        // Tap: low movement + short duration.
        if (distance > cfg.tapMaxMovement) {
          clearSession();
          return null;
        }
        if (duration > cfg.tapMaxDuration) {
          clearSession();
          return null;
        }
        const result: Tap4FResult = {
          kind: "tap-4f",
          origin,
          endTime: sessionEnd,
        };
        clearSession();
        return result;
      }

      // fingers === 3: swipe.
      if (distance < cfg.swipeMinDistance) {
        clearSession();
        return null;
      }
      if (duration > cfg.swipeMaxDuration) {
        clearSession();
        return null;
      }
      // --- Guardrail 4: Velocity floor (trackpad) ----------------------
      if (velocity < cfg.swipeMinVelocity) {
        clearSession();
        return null;
      }

      const direction: SwipeDirection =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
            ? "down"
            : "up";

      const result: Swipe3FResult = {
        kind: "swipe-3f",
        direction,
        origin,
        velocity,
        endTime: sessionEnd,
      };
      clearSession();
      return result;
    }

    return null;
  };

  return {
    feed,
    reset: clearSession,
    __peekActiveCount: () => liveCount,
  };
}
