import { describe, it, expect } from "vitest";

/**
 * v1.6.7 — Circuit Sniper angled-snap guardrail.
 *
 * The user reported that angled (30°/45°/60°) components still don't snap
 * together even after v1.6.6's `getPinCoords` fix. The remaining gap was
 * that pins were only locked onto via DOM hover on a 12 px hit circle; at
 * arbitrary rotations those circles sit off-grid, so the pointer keeps
 * missing them. v1.6.7 adds `findNearestPin` — a proximity-based lookup
 * that runs during wire drag/edit and snaps to any pin within a 20 px
 * world-space threshold, independent of DOM hover state.
 *
 * These tests pin the geometry used by both pieces:
 *   1. `getPinCoords` places rotated pins exactly where the visual
 *      transform renders them (no grid snap at non-axis angles).
 *   2. `findNearestPin` picks the closest eligible pin and honours the
 *      `ignoreElId` hint (so a wire's own source component can't self-snap).
 */

import { getPinCoords, findNearestPin } from "../../src/components/dropins/CircuitSniperDropin";

// Minimal shape that matches the exported helpers — the helpers only read
// `id`, `type`, `x`, `y`, `rotation` so we don't need a full CircuitElement.
function comp(overrides: { id: string; type: string; x: number; y: number; rotation: number }) {
  return {
    ...overrides,
    label: "",
    value: "",
  };
}

describe("Circuit Sniper — getPinCoords at rotation", () => {
  it("places an axis-aligned Resistor's right-hand pin on a 15 px grid multiple", () => {
    const el = comp({ id: "r1", type: "Resistor", x: 100, y: 100, rotation: 0 });
    // Resistor pin p2 is at local (60, 30); center (30, 30). World before
    // snap = (160, 130). GRID is 15, so Math.round(160/15)*15 = 165, and
    // Math.round(130/15)*15 = 135. Axis-aligned path applies the grid snap;
    // this test pins that behavior so we don't regress back to stray pixels.
    const p = getPinCoords(el, { id: "p2", x: 60, y: 30 });
    expect(p.x % 15).toBe(0);
    expect(p.y % 15).toBe(0);
    expect(p.x).toBe(165);
    expect(p.y).toBe(135);
  });

  it("rotates the pin exactly (no grid snap at 45°)", () => {
    // Put the component center on a grid point so rotation math is easy.
    const el = comp({ id: "r1", type: "Resistor", x: 100, y: 100, rotation: 45 });
    // local (60, 30) relative to center (30, 30) = (30, 0); rotate 45° →
    // (30/√2, 30/√2) ≈ (21.213, 21.213); world = center + rotated =
    // (100+30+21.213, 100+30+21.213) = (151.213, 151.213), rounded.
    const p = getPinCoords(el, { id: "p2", x: 60, y: 30 });
    expect(p.x).toBe(151);
    expect(p.y).toBe(151);
  });

  it("snaps to grid only when axis-aligned, not at 30° (regression guard)", () => {
    const el = comp({ id: "r1", type: "Resistor", x: 100, y: 100, rotation: 30 });
    const p = getPinCoords(el, { id: "p2", x: 60, y: 30 });
    // If we accidentally re-introduced grid snapping at arbitrary angles,
    // the result would be a multiple of GRID=15. The correct rotated value
    // is roughly (155.98, 145), which rounds to 156/145 — 156 is not a
    // multiple of 15.
    expect(p.x % 15).not.toBe(0);
  });
});

describe("Circuit Sniper — findNearestPin proximity snap", () => {
  it("returns null when no pin is within the threshold", () => {
    const el = comp({ id: "r1", type: "Resistor", x: 0, y: 0, rotation: 0 });
    const hit = findNearestPin(500, 500, [el], 20);
    expect(hit).toBeNull();
  });

  it("locks onto a rotated component's pin that's exactly where the user aims", () => {
    // Resistor at 45°, its p2 lands near (51, 51) when placed at (0,0).
    const el = comp({ id: "r1", type: "Resistor", x: 0, y: 0, rotation: 45 });
    const pinCoord = getPinCoords(el, { id: "p2", x: 60, y: 30 });
    const hit = findNearestPin(pinCoord.x + 3, pinCoord.y - 4, [el], 20);
    expect(hit).not.toBeNull();
    expect(hit?.pinId).toBe("p2");
    expect(hit?.elId).toBe("r1");
  });

  it("picks the CLOSER pin when two are in range", () => {
    const a = comp({ id: "a", type: "Resistor", x: 0, y: 0, rotation: 0 });
    const b = comp({ id: "b", type: "Resistor", x: 100, y: 0, rotation: 0 });
    // Aim very close to b's left pin (world x=100+30-30=100, y=30).
    const hit = findNearestPin(101, 30, [a, b], 30);
    expect(hit?.elId).toBe("b");
  });

  it("ignores pins on `ignoreElId` so a wire being drawn from comp A doesn't self-snap", () => {
    const a = comp({ id: "a", type: "Resistor", x: 0, y: 0, rotation: 0 });
    // Aim right at a's right pin, but ask it to ignore a — should return null.
    const hit = findNearestPin(160, 30, [a], 20, "a");
    expect(hit).toBeNull();
  });

  it("connects two 30°-rotated components at their touching pin (end-to-end guardrail)", () => {
    // Two resistors rotated 30°. Align them so b's left pin coincides with
    // a's right pin. This is the exact user scenario: angled components
    // pushed together should snap.
    const a = comp({ id: "a", type: "Resistor", x: 0, y: 0, rotation: 30 });
    const aRight = getPinCoords(a, { id: "p2", x: 60, y: 30 });
    // Position b so that its LEFT pin (local 0,30) in world space equals
    // aRight. For rotation 30 and pin(0,30), offset from center (30,30) is
    // (-30, 0); rotated = (-30*cos30, -30*sin30) ≈ (-25.98, -15); so
    // b's left pin world = (b.x + 30 - 25.98, b.y + 30 - 15). Set those
    // equal to aRight and solve for b.x / b.y.
    const cos30 = Math.cos((30 * Math.PI) / 180);
    const sin30 = Math.sin((30 * Math.PI) / 180);
    const bx = Math.round(aRight.x - 30 + 30 * cos30);
    const by = Math.round(aRight.y - 30 + 30 * sin30);
    const b = comp({ id: "b", type: "Resistor", x: bx, y: by, rotation: 30 });

    // Now pretend the user is dragging a wire from a and aims near the
    // shared spot. findNearestPin should pick b's p1, not a's p2 (since
    // we're drawing from a and a is ignored).
    const hit = findNearestPin(aRight.x + 1, aRight.y, [a, b], 20, "a");
    expect(hit?.elId).toBe("b");
    expect(hit?.pinId).toBe("p1");
  });
});
