/**
 * GhostEcho — v1.11.0 phase-2 sub-PR 2.2.
 *
 * When a tool/meta layer is dismissed, a 12px translucent emblem fades in
 * at the swipe-origin coordinate. Holds 400ms at 25% opacity, then fades
 * over 800ms (design doc §6, Q3 locked). Aborts immediately on first ink
 * event — the ADHD object-permanence anchor only persists when the user
 * is idle; the moment they touch ink they've moved on.
 *
 * Emblems:
 *   tool → ☰
 *   meta → ▤
 *
 * Pure subscription model: subscribes to `LayerManagerStore.onDismissed`.
 * Aborts via window-level `pointerdown` (any pointerdown on the page
 * means user is moving on — simplest correct heuristic). The CSS keyframe
 * does the visual; we only manage entry/exit.
 */

import React, {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  useLayerManager,
  type LayerDismissedEvent,
} from "../../features/layerManager";

export const GHOST_HOLD_MS = 400;
export const GHOST_FADE_MS = 800;
export const GHOST_TOTAL_MS = GHOST_HOLD_MS + GHOST_FADE_MS;
export const GHOST_PEAK_OPACITY = 0.25;
export const GHOST_SIZE_PX = 12;

export interface GhostEchoEntry {
  id: number;
  kind: "tool" | "meta";
  x: number;
  y: number;
  bornAt: number;
}

export const EMBLEM_BY_KIND: Record<"tool" | "meta", string> = {
  tool: "☰",
  meta: "▤",
};

let _ghostId = 0;
const nextId = (): number => ++_ghostId;

/**
 * Pure entry factory — exposed for unit tests. The component below uses
 * it via `eventToEntry`.
 */
export function eventToEntry(ev: LayerDismissedEvent): GhostEchoEntry {
  return {
    id: nextId(),
    kind: ev.kind,
    x: ev.origin.x,
    y: ev.origin.y,
    bornAt: ev.t,
  };
}

/**
 * GhostEcho mount. Renders a fixed-position absolute layer of fading
 * emblems, anchored to the nearest positioned ancestor (NoteometryApp
 * root has `position: relative`). Subscribes to LayerManager dismissals.
 */
export default function GhostEcho(): ReactNode {
  const { store } = useLayerManager();
  const [entries, setEntries] = useState<GhostEchoEntry[]>([]);
  const entriesRef = useRef<GhostEchoEntry[]>([]);
  entriesRef.current = entries;

  // Subscribe to dismissals.
  useEffect(() => {
    return store.onDismissed((ev) => {
      const entry = eventToEntry(ev);
      setEntries((prev) => [...prev, entry]);
      // Auto-cleanup after total duration.
      window.setTimeout(() => {
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      }, GHOST_TOTAL_MS);
    });
  }, [store]);

  // Abort on first ink event — any pointerdown clears all active echoes.
  useEffect(() => {
    const onPointerDown = (): void => {
      if (entriesRef.current.length === 0) return;
      setEntries([]);
    };
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => {
      window.removeEventListener(
        "pointerdown",
        onPointerDown,
        { capture: true } as EventListenerOptions,
      );
    };
  }, []);

  if (entries.length === 0) return null;

  return (
    <div className="noteometry-ghost-echo-layer" aria-hidden="true">
      {entries.map((e) => (
        <span
          key={e.id}
          className="noteometry-ghost-echo"
          data-kind={e.kind}
          style={{
            left: `${e.x}px`,
            top: `${e.y}px`,
          }}
        >
          {EMBLEM_BY_KIND[e.kind]}
        </span>
      ))}
    </div>
  );
}
