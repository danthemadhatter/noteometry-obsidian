/**
 * v1.11.0 phase-3 sub-PR 3.2: Brain-dump spawn tests.
 *
 * Vitest is node-env (no React rendering); we test the data path:
 *   - createChatObject accepts and stores `seedText`
 *   - packToV3 / unpackFromV3 round-trip preserves `seedText`
 *   - buildBrainDumpSeed produces a deterministic value when given a Date
 *
 * The actual ChatDropin focus/cursor-placement logic is React-only and
 * tested implicitly by the predicate (didSeedTextRef once-only flag is
 * a single boolean ref; not worth a test harness).
 */

import { describe, it, expect } from "vitest";
import {
  createChatObject,
  type ChatObject,
} from "../../src/lib/canvasObjects";
import { packToV3, unpackFromV3 } from "../../src/lib/pageFormat";
import { buildBrainDumpSeed } from "../../src/components/freeze/FreezeOverlay";

describe("createChatObject(seedText)", () => {
  it("stores seedText on the new ChatObject", () => {
    const o = createChatObject(10, 20, { seedText: "[brain dump @ now]" });
    expect(o.seedText).toBe("[brain dump @ now]");
    expect(o.type).toBe("chat");
    expect(o.x).toBe(10);
    expect(o.y).toBe(20);
    expect(o.messages).toEqual([]);
    expect(o.attachedImage).toBeUndefined();
    expect(o.seedLatex).toBeUndefined();
  });

  it("seedText defaults to undefined when not provided", () => {
    const o = createChatObject(0, 0);
    expect(o.seedText).toBeUndefined();
  });
});

describe("seedText round-trip through v3 page format", () => {
  it("preserves seedText through pack/unpack", () => {
    const o = createChatObject(50, 60, { seedText: "[brain dump @ T]" });
    const v3 = packToV3({
      strokes: [],
      stamps: [],
      canvasObjects: [o],
      viewport: { scrollX: 0, scrollY: 0, zoom: 1 },
    } as any);

    const restored = unpackFromV3(v3);
    const chat = restored.canvasObjects.find(
      (c): c is ChatObject => c.type === "chat",
    );
    expect(chat).toBeDefined();
    expect(chat!.seedText).toBe("[brain dump @ T]");
  });

  it("absent seedText round-trips as undefined (not empty string)", () => {
    const o = createChatObject(0, 0, { seedLatex: "x^2" });
    const v3 = packToV3({
      strokes: [],
      stamps: [],
      canvasObjects: [o],
      viewport: { scrollX: 0, scrollY: 0, zoom: 1 },
    } as any);
    const restored = unpackFromV3(v3);
    const chat = restored.canvasObjects.find(
      (c): c is ChatObject => c.type === "chat",
    );
    expect(chat!.seedText).toBeUndefined();
    // sanity: seedLatex still works alongside seedText
    expect(chat!.seedLatex).toBe("x^2");
  });
});

describe("buildBrainDumpSeed integration shape", () => {
  it("produces a string that fits in a textarea (no newlines, < 100 chars)", () => {
    const seed = buildBrainDumpSeed(new Date("2026-05-03T04:14:00Z"));
    expect(seed).not.toContain("\n");
    expect(seed.length).toBeLessThan(100);
  });

  it("matches the brain-dump format documented in design doc §7 Q1", () => {
    const seed = buildBrainDumpSeed(new Date("2026-05-03T04:14:00Z"));
    // Plain text — square brackets and ISO timestamp, no LaTeX.
    expect(seed).toBe("[brain dump @ 2026-05-03T04:14:00.000Z]");
  });
});
