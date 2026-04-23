/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { shouldYieldToNativeScroll } from "../../src/lib/wheelRouting";

/**
 * v1.6.12: unit coverage for the wheel-routing decision that fixed the
 * MacBook Pro "canvas pan dies over drop-ins" regression. The rule under
 * test: yield only if an ancestor up to the canvas boundary is genuinely
 * scrollable in the axis the wheel event moves along.
 */

function makeEl(opts: {
  overflowX?: string;
  overflowY?: string;
  scrollHeight?: number;
  scrollWidth?: number;
  clientHeight?: number;
  clientWidth?: number;
  scrollTop?: number;
  scrollLeft?: number;
}): HTMLElement {
  const el = document.createElement("div");
  if (opts.overflowX) el.style.overflowX = opts.overflowX;
  if (opts.overflowY) el.style.overflowY = opts.overflowY;
  Object.defineProperty(el, "scrollHeight", { value: opts.scrollHeight ?? 0, configurable: true });
  Object.defineProperty(el, "scrollWidth", { value: opts.scrollWidth ?? 0, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: opts.clientHeight ?? 0, configurable: true });
  Object.defineProperty(el, "clientWidth", { value: opts.clientWidth ?? 0, configurable: true });
  if (opts.scrollTop !== undefined) (el as any).scrollTop = opts.scrollTop;
  if (opts.scrollLeft !== undefined) (el as any).scrollLeft = opts.scrollLeft;
  return el;
}

describe("shouldYieldToNativeScroll", () => {
  let boundary: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    boundary = document.createElement("div");
    document.body.appendChild(boundary);
  });

  it("returns false for a null target (no element = no yield)", () => {
    expect(shouldYieldToNativeScroll(null, boundary, { deltaX: 0, deltaY: 10 })).toBe(false);
  });

  it("yields when an ancestor has overflow:auto and more content than viewport", () => {
    const scroller = makeEl({
      overflowY: "auto", scrollHeight: 500, clientHeight: 200, scrollTop: 100,
    });
    const leaf = document.createElement("span");
    scroller.appendChild(leaf);
    boundary.appendChild(scroller);
    expect(shouldYieldToNativeScroll(leaf, boundary, { deltaX: 0, deltaY: 10 })).toBe(true);
  });

  it("does NOT yield when overflow:auto but no overflowing content", () => {
    const leaf = makeEl({
      overflowY: "auto", scrollHeight: 100, clientHeight: 100,
    });
    boundary.appendChild(leaf);
    expect(shouldYieldToNativeScroll(leaf, boundary, { deltaX: 0, deltaY: 10 })).toBe(false);
  });

  it("does NOT yield when overflow:hidden even if content overflows", () => {
    const leaf = makeEl({
      overflowY: "hidden", scrollHeight: 500, clientHeight: 200,
    });
    boundary.appendChild(leaf);
    expect(shouldYieldToNativeScroll(leaf, boundary, { deltaX: 0, deltaY: 10 })).toBe(false);
  });

  it("yields for horizontal scroll on an overflow-x container", () => {
    const leaf = makeEl({
      overflowX: "scroll", scrollWidth: 800, clientWidth: 300, scrollLeft: 10,
    });
    boundary.appendChild(leaf);
    expect(shouldYieldToNativeScroll(leaf, boundary, { deltaX: 10, deltaY: 0 })).toBe(true);
  });

  it("does NOT yield at top when scrolling up (already at boundary)", () => {
    const leaf = makeEl({
      overflowY: "auto", scrollHeight: 500, clientHeight: 200, scrollTop: 0,
    });
    boundary.appendChild(leaf);
    expect(shouldYieldToNativeScroll(leaf, boundary, { deltaX: 0, deltaY: -10 })).toBe(false);
  });

  it("does NOT yield at bottom when scrolling down (already at boundary)", () => {
    const leaf = makeEl({
      overflowY: "auto", scrollHeight: 500, clientHeight: 200, scrollTop: 300,
    });
    boundary.appendChild(leaf);
    expect(shouldYieldToNativeScroll(leaf, boundary, { deltaX: 0, deltaY: 10 })).toBe(false);
  });

  it("stops walking at the boundary (doesn't recurse past canvas)", () => {
    // boundary itself is scrollable — but we must not consult it
    Object.defineProperty(boundary, "scrollHeight", { value: 500, configurable: true });
    Object.defineProperty(boundary, "clientHeight", { value: 100, configurable: true });
    boundary.style.overflowY = "auto";
    const leaf = document.createElement("div");
    boundary.appendChild(leaf);
    expect(shouldYieldToNativeScroll(leaf, boundary, { deltaX: 0, deltaY: 10 })).toBe(false);
  });
});
