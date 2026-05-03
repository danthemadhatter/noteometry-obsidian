/**
 * v1.11.0 phase-2 sub-PR 2.2: GhostEcho integration tests.
 *
 * Vitest is node-env (no jsdom, no React rendering), so we test:
 *   - `eventToEntry` produces well-formed entries with unique ids
 *   - `EMBLEM_BY_KIND` covers the locked design (☰ / ▤)
 *   - End-to-end through `createLayerManagerStore.onDismissed`:
 *       · summon + dismiss tool emits one event with matching origin
 *       · summon + dismiss meta emits one event with matching origin
 *       · multiple subscribers all receive each event
 *       · unsubscribe stops further deliveries
 *       · freeze does NOT emit a dismiss event (kill-switch, not a layer)
 *   - Timing constants match design doc §6 (400ms + 800ms = 1200ms).
 */

import { describe, it, expect } from "vitest";
import { createLayerManagerStore } from "../../src/features/layerManager";
import {
  eventToEntry,
  EMBLEM_BY_KIND,
  GHOST_HOLD_MS,
  GHOST_FADE_MS,
  GHOST_TOTAL_MS,
  GHOST_PEAK_OPACITY,
  GHOST_SIZE_PX,
} from "../../src/components/ambient/GhostEcho";

describe("GhostEcho timing constants (design doc §6 Q3 lock)", () => {
  it("hold = 400ms, fade = 800ms, total = 1200ms", () => {
    expect(GHOST_HOLD_MS).toBe(400);
    expect(GHOST_FADE_MS).toBe(800);
    expect(GHOST_TOTAL_MS).toBe(1200);
  });

  it("peak opacity = 25%, size = 12px", () => {
    expect(GHOST_PEAK_OPACITY).toBe(0.25);
    expect(GHOST_SIZE_PX).toBe(12);
  });
});

describe("EMBLEM_BY_KIND", () => {
  it("tool = ☰, meta = ▤", () => {
    expect(EMBLEM_BY_KIND.tool).toBe("☰");
    expect(EMBLEM_BY_KIND.meta).toBe("▤");
  });
});

describe("eventToEntry", () => {
  it("forwards kind, origin, t and assigns a unique id", () => {
    const a = eventToEntry({ kind: "tool", origin: { x: 100, y: 200 }, t: 5 });
    const b = eventToEntry({ kind: "meta", origin: { x: 50, y: 75 }, t: 6 });
    expect(a.kind).toBe("tool");
    expect(a.x).toBe(100);
    expect(a.y).toBe(200);
    expect(a.bornAt).toBe(5);
    expect(b.kind).toBe("meta");
    expect(b.x).toBe(50);
    expect(b.y).toBe(75);
    expect(a.id).not.toBe(b.id);
  });
});

describe("LayerManager.onDismissed → GhostEcho integration", () => {
  it("emits a tool dismiss with the swipe-up origin", () => {
    const store = createLayerManagerStore();
    const seen: any[] = [];
    store.onDismissed((ev) => seen.push(ev));

    store.summonTool({ x: 10, y: 20 });
    store.dismissTool({ x: 11, y: 22 });

    expect(seen).toHaveLength(1);
    expect(seen[0].kind).toBe("tool");
    expect(seen[0].origin).toEqual({ x: 11, y: 22 });
    expect(typeof seen[0].t).toBe("number");
  });

  it("falls back to summon origin when dismiss origin is omitted", () => {
    const store = createLayerManagerStore();
    const seen: any[] = [];
    store.onDismissed((ev) => seen.push(ev));

    store.summonMeta({ x: 7, y: 9 });
    store.dismissMeta(); // no explicit origin

    expect(seen).toHaveLength(1);
    expect(seen[0].kind).toBe("meta");
    expect(seen[0].origin).toEqual({ x: 7, y: 9 });
  });

  it("delivers events to multiple subscribers", () => {
    const store = createLayerManagerStore();
    const a: any[] = [];
    const b: any[] = [];
    store.onDismissed((ev) => a.push(ev));
    store.onDismissed((ev) => b.push(ev));

    store.summonTool({ x: 1, y: 1 });
    store.dismissTool({ x: 1, y: 1 });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it("unsubscribe stops further deliveries", () => {
    const store = createLayerManagerStore();
    const seen: any[] = [];
    const off = store.onDismissed((ev) => seen.push(ev));

    store.summonTool({ x: 1, y: 1 });
    store.dismissTool({ x: 1, y: 1 });
    expect(seen).toHaveLength(1);

    off();

    store.summonMeta({ x: 2, y: 2 });
    store.dismissMeta({ x: 2, y: 2 });
    expect(seen).toHaveLength(1);
  });

  it("freeze/unfreeze emits NO dismiss events (kill switch, not a layer)", () => {
    const store = createLayerManagerStore();
    const seen: any[] = [];
    store.onDismissed((ev) => seen.push(ev));

    store.freeze();
    store.unfreeze();

    expect(seen).toHaveLength(0);
  });

  it("converted entries flow through eventToEntry with unique ids per dismiss", () => {
    const store = createLayerManagerStore();
    const entries: ReturnType<typeof eventToEntry>[] = [];
    store.onDismissed((ev) => entries.push(eventToEntry(ev)));

    store.summonTool({ x: 1, y: 1 });
    store.dismissTool({ x: 1, y: 1 });
    store.summonMeta({ x: 2, y: 2 });
    store.dismissMeta({ x: 2, y: 2 });

    expect(entries).toHaveLength(2);
    expect(entries[0].id).not.toBe(entries[1].id);
    expect(entries[0].kind).toBe("tool");
    expect(entries[1].kind).toBe("meta");
  });
});
