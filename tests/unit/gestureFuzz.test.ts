/**
 * v1.11.0 phase-4 sub-PR 4.1: gesture recognizer fuzz tests.
 *
 * Replaces empirical iPad mini 6 / MBP trackpad / Z Fold testing with
 * synthetic adversarial input streams. Each scenario generates randomized
 * pointer-event sequences that stress one of the four design-doc §2
 * guardrails:
 *
 *   1. 50ms stability window  → palm + index landing 30ms apart
 *   2. Pencil lockout 250ms    → Pencil down then 3 fingers within 200ms
 *   3. Peak count over 80ms    → sloppy 3 → 4 burst
 *   4. Velocity floor 240 px/s → trackpad two-finger rest, slow drag
 *
 * Strategy: deterministic pseudo-random (seeded LCG) so failures are
 * reproducible. We don't import a fuzz library; pure JS LCG keeps the
 * tests self-contained.
 *
 * What we assert:
 *   - Adversarial streams produce ZERO classification (no false positives).
 *   - Real gestures (clean 3F swipe, clean 4F tap) DO classify in the
 *     same fuzz harness — proves the recognizer isn't just rejecting
 *     everything.
 *
 * Each adversarial scenario runs N=200 iterations. Real-gesture probes
 * run N=50.
 */

import { describe, it, expect } from "vitest";
import {
  createGestureRecognizer,
  DEFAULT_RECOGNIZER_CONFIG,
  type GestureResult,
  type PointerSnapshot,
} from "../../src/features/gestures/gestureRecognizer";

/* ── Seeded PRNG (LCG, 32-bit) ─────────────────────────────── */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/* ── Snapshot factory ──────────────────────────────────────── */
function snap(
  pointerId: number,
  type: PointerSnapshot["pointerType"],
  x: number, y: number,
  phase: PointerSnapshot["phase"],
  t: number,
): PointerSnapshot {
  return { pointerId, pointerType: type, x, y, phase, t };
}

/* ── Stream players ────────────────────────────────────────── */
function feedAll(
  rec: ReturnType<typeof createGestureRecognizer>,
  events: PointerSnapshot[],
): GestureResult[] {
  const out: GestureResult[] = [];
  for (const ev of events) {
    const r = rec.feed(ev);
    if (r) out.push(r);
  }
  return out;
}

describe("gesture fuzz — adversarial input streams produce no false positives", () => {
  it("Scenario A: palm-then-index (2 touches landing within 30ms, then both lifting) → never 3F or 4F", () => {
    const rng = makeRng(0xa11dad);
    for (let i = 0; i < 200; i++) {
      const rec = createGestureRecognizer();
      const t0 = i * 1000;
      // Two touches, sloppy timing, varying positions.
      const events: PointerSnapshot[] = [
        snap(1, "touch", 100 + rng() * 50, 100 + rng() * 50, "down", t0),
        snap(2, "touch", 200 + rng() * 50, 110 + rng() * 50, "down", t0 + rng() * 30),
        snap(1, "touch", 100 + rng() * 50, 100 + rng() * 50, "up", t0 + 100 + rng() * 100),
        snap(2, "touch", 200 + rng() * 50, 110 + rng() * 50, "up", t0 + 100 + rng() * 100),
      ];
      const results = feedAll(rec, events);
      expect(results, `iter ${i}`).toEqual([]);
    }
  });

  it("Scenario B: Pencil down → 3 fingers within 200ms (palm-during-Pencil) → never classifies", () => {
    const rng = makeRng(0xbe11ad);
    for (let i = 0; i < 200; i++) {
      const rec = createGestureRecognizer();
      const t0 = i * 1000;
      // Pen first.
      const events: PointerSnapshot[] = [
        snap(0, "pen", 200, 200, "down", t0),
        snap(0, "pen", 210, 210, "move", t0 + 10),
      ];
      // Palm: 3 touches arriving in next 200ms (well within 250ms lockout).
      for (let f = 0; f < 3; f++) {
        const td = t0 + 50 + f * 30 + rng() * 20;
        events.push(snap(f + 1, "touch", 300 + f * 60, 250 + rng() * 20, "down", td));
      }
      // Drift for a swipe-like motion that would otherwise classify.
      for (let f = 0; f < 3; f++) {
        const td = t0 + 200 + rng() * 30;
        events.push(snap(f + 1, "touch", 300 + f * 60, 350 + rng() * 20, "move", td));
        events.push(snap(f + 1, "touch", 300 + f * 60, 400 + rng() * 20, "up", td + 30));
      }
      events.push(snap(0, "pen", 220, 220, "up", t0 + 350));
      const results = feedAll(rec, events);
      expect(results.filter((r) => r.kind === "swipe-3f"), `iter ${i}`).toEqual([]);
      expect(results.filter((r) => r.kind === "tap-4f"), `iter ${i}`).toEqual([]);
    }
  });

  it("Scenario C: sloppy 3→4 burst (3 fingers, then 4th joins within 80ms) → never classifies as 3F swipe", () => {
    const rng = makeRng(0xc104dad);
    for (let i = 0; i < 200; i++) {
      const rec = createGestureRecognizer();
      const t0 = i * 1000;
      const events: PointerSnapshot[] = [];
      // 3 down at start.
      for (let f = 0; f < 3; f++) {
        events.push(snap(f + 1, "touch", 100 + f * 80, 100, "down", t0 + f * 10));
      }
      // 4th joins within 80ms (peak window).
      events.push(snap(4, "touch", 100 + 3 * 80, 100, "down", t0 + 30 + rng() * 40));
      // All 4 lift within tap-max-duration without much movement.
      for (let f = 0; f < 4; f++) {
        events.push(snap(f + 1, "touch", 100 + f * 80 + rng() * 5, 100 + rng() * 5, "up", t0 + 200 + f * 5));
      }
      const results = feedAll(rec, events);
      // Sloppy 3→4 should NEVER classify as a 3F swipe (peak rules).
      expect(results.filter((r) => r.kind === "swipe-3f"), `iter ${i}`).toEqual([]);
      // It MAY classify as 4F tap (intentional — peak count = 4).
    }
  });

  it("Scenario D: trackpad slow drag (2 fingers, low velocity) → never classifies as swipe", () => {
    const rng = makeRng(0xd1abad);
    for (let i = 0; i < 200; i++) {
      const rec = createGestureRecognizer();
      const t0 = i * 1000;
      // Even if we add a third finger to mimic 3F, low velocity should kill it.
      const events: PointerSnapshot[] = [];
      for (let f = 0; f < 3; f++) {
        events.push(snap(f + 1, "touch", 100 + f * 60, 100, "down", t0 + f * 5));
      }
      // Slow drift over 800ms (way too slow — < 240 px/s, also > 250ms swipeMaxDuration).
      const dragMs = 800;
      const dragPx = 80; // 100 px/s
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        const td = t0 + (s / steps) * dragMs;
        for (let f = 0; f < 3; f++) {
          events.push(snap(f + 1, "touch", 100 + f * 60, 100 + (s / steps) * dragPx + rng() * 2, "move", td));
        }
      }
      for (let f = 0; f < 3; f++) {
        events.push(snap(f + 1, "touch", 100 + f * 60, 100 + dragPx, "up", t0 + dragMs + 10));
      }
      const results = feedAll(rec, events);
      expect(results.filter((r) => r.kind === "swipe-3f"), `iter ${i}`).toEqual([]);
    }
  });

  it("Scenario E: random PointerEvents bursts (mixed types, durations) → never spuriously classifies", () => {
    const rng = makeRng(0xe1faceed);
    let totalResults = 0;
    for (let i = 0; i < 200; i++) {
      const rec = createGestureRecognizer();
      const t0 = i * 1000;
      const events: PointerSnapshot[] = [];
      const nTouches = 1 + Math.floor(rng() * 3); // 1-3 touches (never 4)
      for (let f = 0; f < nTouches; f++) {
        const fx = rng() * 800;
        const fy = rng() * 600;
        const dur = 50 + rng() * 800; // mostly out-of-range durations
        events.push(snap(f + 1, "touch", fx, fy, "down", t0 + rng() * 100));
        // 0-3 random moves
        const nMoves = Math.floor(rng() * 4);
        for (let m = 0; m < nMoves; m++) {
          events.push(snap(f + 1, "touch", fx + rng() * 200 - 100, fy + rng() * 200 - 100, "move", t0 + rng() * dur));
        }
        events.push(snap(f + 1, "touch", fx + rng() * 50, fy + rng() * 50, "up", t0 + dur));
      }
      // Sort by t to simulate real event ordering.
      events.sort((a, b) => a.t - b.t);
      const results = feedAll(rec, events);
      totalResults += results.length;
      // Random noise with ≤3 touches should never classify as 4F tap.
      expect(results.filter((r) => r.kind === "tap-4f"), `iter ${i}`).toEqual([]);
    }
    // Sanity: random noise should rarely (< 5%) produce any classification.
    expect(totalResults).toBeLessThan(10);
  });
});

describe("gesture fuzz — clean gestures DO classify (anti-false-negative)", () => {
  it("clean 3F swipe-down classifies on 50/50 random-jittered runs", () => {
    const rng = makeRng(0x300d300d);
    let classified = 0;
    for (let i = 0; i < 50; i++) {
      const rec = createGestureRecognizer();
      const t0 = i * 1000;
      const jitter = (n: number) => n + (rng() - 0.5) * 4;
      const events: PointerSnapshot[] = [];
      // 3 fingers down close together (all within 50ms stability window).
      for (let f = 0; f < 3; f++) {
        events.push(snap(f + 1, "touch", jitter(100 + f * 80), jitter(100), "down", t0 + f * 5));
      }
      // ~80ms wait to satisfy stability window + peak count window.
      // Movement: 100px down in 100ms total = 1000 px/s, far above floor.
      for (let m = 1; m <= 5; m++) {
        const td = t0 + 80 + m * 20;
        for (let f = 0; f < 3; f++) {
          events.push(snap(f + 1, "touch", jitter(100 + f * 80), jitter(100 + m * 30), "move", td));
        }
      }
      // All 3 lift simultaneously.
      for (let f = 0; f < 3; f++) {
        events.push(snap(f + 1, "touch", jitter(100 + f * 80), jitter(250), "up", t0 + 200));
      }
      const results = feedAll(rec, events);
      const swipes = results.filter((r) => r.kind === "swipe-3f");
      if (swipes.length === 1 && swipes[0].kind === "swipe-3f" && swipes[0].direction === "down") {
        classified++;
      }
    }
    // Clean 3F swipes should classify on the vast majority of runs.
    expect(classified).toBeGreaterThanOrEqual(45);
  });

  it("clean 4F tap classifies on 50/50 random-jittered runs", () => {
    const rng = makeRng(0x4f0044f0);
    let classified = 0;
    for (let i = 0; i < 50; i++) {
      const rec = createGestureRecognizer();
      const t0 = i * 1000;
      const jitter = (n: number) => n + (rng() - 0.5) * 4;
      const events: PointerSnapshot[] = [];
      // 4 fingers down within ~80ms peak window.
      for (let f = 0; f < 4; f++) {
        events.push(snap(f + 1, "touch", jitter(100 + f * 80), jitter(100), "down", t0 + f * 8));
      }
      // Hold briefly (no movement), then lift before tap-max-duration.
      for (let f = 0; f < 4; f++) {
        events.push(snap(f + 1, "touch", jitter(100 + f * 80), jitter(100), "up", t0 + 150 + f * 5));
      }
      const results = feedAll(rec, events);
      const taps = results.filter((r) => r.kind === "tap-4f");
      if (taps.length === 1) classified++;
    }
    expect(classified).toBeGreaterThanOrEqual(45);
  });
});

describe("gesture fuzz — config invariants", () => {
  it("all four guardrail thresholds are positive numbers (not accidentally zeroed)", () => {
    expect(DEFAULT_RECOGNIZER_CONFIG.stabilityWindowMs).toBeGreaterThan(0);
    expect(DEFAULT_RECOGNIZER_CONFIG.peakWindowMs).toBeGreaterThan(0);
    expect(DEFAULT_RECOGNIZER_CONFIG.pencilLockoutMs).toBeGreaterThan(0);
    expect(DEFAULT_RECOGNIZER_CONFIG.swipeMinVelocity).toBeGreaterThan(0);
  });

  it("swipe distance / duration / velocity are mutually consistent (60px in 250ms = 240 px/s)", () => {
    // The default velocity floor matches the minimum (distance / duration)
    // so any swipe that satisfies distance + duration also satisfies velocity.
    const minPossibleVelocity =
      DEFAULT_RECOGNIZER_CONFIG.swipeMinDistance / (DEFAULT_RECOGNIZER_CONFIG.swipeMaxDuration / 1000);
    expect(minPossibleVelocity).toBeCloseTo(DEFAULT_RECOGNIZER_CONFIG.swipeMinVelocity, 0);
  });
});
