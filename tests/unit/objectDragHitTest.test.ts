/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { shouldStartObjectDrag, INTERACTIVE_SELECTOR } from "../../src/lib/objectDragHitTest";

/**
 * v1.6.9 regression guardrail.
 *
 * Dan's feedback: "every normal app supports direct object dragging",
 * but only when the user is NOT actively editing something inside the
 * drop-in. The hit test decides: pointerdown lands on a non-interactive
 * part of the object body → start a drag; lands on an input / button /
 * contenteditable → let the control take the event. This test locks
 * the rule down.
 */

function mkEl(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.firstElementChild as HTMLElement;
}

describe("shouldStartObjectDrag", () => {
  it("returns false for null target (defensive default)", () => {
    expect(shouldStartObjectDrag(null)).toBe(false);
  });

  it("starts a drag on plain <div> body content (classic direct-drag case)", () => {
    const el = mkEl("<div><span>plain label</span></div>");
    const target = el.querySelector("span")!;
    expect(shouldStartObjectDrag(target)).toBe(true);
  });

  it("does NOT start a drag when target is an <input>", () => {
    const el = mkEl("<div><input /></div>");
    expect(shouldStartObjectDrag(el.querySelector("input"))).toBe(false);
  });

  it("does NOT start a drag when target is a <button> or inside one", () => {
    const el = mkEl("<div><button><span>Click me</span></button></div>");
    expect(shouldStartObjectDrag(el.querySelector("button"))).toBe(false);
    expect(shouldStartObjectDrag(el.querySelector("span"))).toBe(false);
  });

  it("does NOT start a drag inside a contenteditable region (RichTextEditor)", () => {
    const el = mkEl("<div><div contenteditable='true'><p>note</p></div></div>");
    expect(shouldStartObjectDrag(el.querySelector("p"))).toBe(false);
  });

  it("does NOT start a drag on <canvas> elements (drop-in drawings)", () => {
    const el = mkEl("<div><canvas></canvas></div>");
    expect(shouldStartObjectDrag(el.querySelector("canvas"))).toBe(false);
  });

  it("does NOT start a drag on role=button ARIA controls", () => {
    const el = mkEl("<div><div role='button'>fake button</div></div>");
    expect(shouldStartObjectDrag(el.querySelector("[role='button']"))).toBe(false);
  });

  it("does NOT start a drag on textarea/select/slider controls", () => {
    expect(shouldStartObjectDrag(mkEl("<textarea></textarea>"))).toBe(false);
    expect(shouldStartObjectDrag(mkEl("<select><option></option></select>"))).toBe(false);
    const slider = mkEl("<div role='slider'></div>");
    expect(shouldStartObjectDrag(slider)).toBe(false);
  });

  it("INTERACTIVE_SELECTOR covers the obvious form controls", () => {
    for (const tag of ["input", "textarea", "select", "button"]) {
      expect(INTERACTIVE_SELECTOR).toContain(tag);
    }
  });
});
