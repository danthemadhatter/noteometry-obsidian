import { describe, it, expect } from "vitest";

/**
 * v1.14.6 regression: ContextMenu viewport clamp must catch top-edge and
 * left-edge spawn points, not just right/bottom overflow. PageHeader pills
 * sit at the very top of the canvas band; if the breadcrumb flyout spawned
 * at y near 0 it disappeared behind Obsidian's chrome.
 *
 * The clamp lives inside ContextMenu.tsx as a useEffect that mutates
 * `el.style.top` / `el.style.left`. We replicate the math here as a pure
 * function and pin both the new top/left checks AND the original
 * right/bottom checks so a future edit can't quietly remove either.
 */

interface ClampInput {
  rectLeft: number;
  rectTop: number;
  rectRight: number;
  rectBottom: number;
  rectWidth: number;
  rectHeight: number;
  vw: number;
  vh: number;
}

interface ClampOutput {
  styleLeft?: string;
  styleTop?: string;
}

// Mirror of ContextMenu.tsx clamp logic. Update both in lockstep.
function applyClamp(input: ClampInput): ClampOutput {
  const out: ClampOutput = {};
  if (input.rectRight > input.vw) {
    out.styleLeft = `${Math.max(8, input.vw - input.rectWidth - 8)}px`;
  }
  if (input.rectBottom > input.vh) {
    out.styleTop = `${Math.max(8, input.vh - input.rectHeight - 8)}px`;
  }
  if (input.rectTop < 8) out.styleTop = "8px";
  if (input.rectLeft < 8) out.styleLeft = "8px";
  return out;
}

describe("v1.14.6 — ContextMenu viewport clamp", () => {
  it("clamps top to 8px when menu spawns at y=0 (PageHeader pill at top of canvas)", () => {
    const out = applyClamp({
      rectLeft: 100, rectTop: 0, rectRight: 250, rectBottom: 200,
      rectWidth: 150, rectHeight: 200,
      vw: 1280, vh: 800,
    });
    expect(out.styleTop).toBe("8px");
  });

  it("clamps left to 8px when menu spawns at x=0", () => {
    const out = applyClamp({
      rectLeft: 0, rectTop: 100, rectRight: 150, rectBottom: 300,
      rectWidth: 150, rectHeight: 200,
      vw: 1280, vh: 800,
    });
    expect(out.styleLeft).toBe("8px");
  });

  it("clamps both top and left when menu spawns at (0,0) — full corner case", () => {
    const out = applyClamp({
      rectLeft: 0, rectTop: 0, rectRight: 150, rectBottom: 200,
      rectWidth: 150, rectHeight: 200,
      vw: 1280, vh: 800,
    });
    expect(out.styleLeft).toBe("8px");
    expect(out.styleTop).toBe("8px");
  });

  it("does not move a normally-positioned menu (already inside the viewport)", () => {
    const out = applyClamp({
      rectLeft: 200, rectTop: 200, rectRight: 350, rectBottom: 400,
      rectWidth: 150, rectHeight: 200,
      vw: 1280, vh: 800,
    });
    expect(out.styleLeft).toBeUndefined();
    expect(out.styleTop).toBeUndefined();
  });

  it("still clamps right-overflow (regression — old behavior preserved)", () => {
    const out = applyClamp({
      rectLeft: 1200, rectTop: 200, rectRight: 1350, rectBottom: 400,
      rectWidth: 150, rectHeight: 200,
      vw: 1280, vh: 800,
    });
    // 1280 - 150 - 8 = 1122
    expect(out.styleLeft).toBe("1122px");
  });

  it("still clamps bottom-overflow (regression — old behavior preserved)", () => {
    const out = applyClamp({
      rectLeft: 200, rectTop: 700, rectRight: 350, rectBottom: 900,
      rectWidth: 150, rectHeight: 200,
      vw: 1280, vh: 800,
    });
    // 800 - 200 - 8 = 592
    expect(out.styleTop).toBe("592px");
  });
});
