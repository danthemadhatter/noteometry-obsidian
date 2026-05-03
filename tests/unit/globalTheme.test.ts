/**
 * v1.11.1 — Global theme apply/remove lifecycle.
 *
 * vitest is node-env with no DOM, so we shim `document` just enough
 * for the apply/remove path. This pins the contract: apply replaces
 * any prior style element, remove cleans up, isApplied reflects the
 * presence of #noteometry-global-theme.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

interface FakeNode {
  id?: string;
  textContent?: string;
  remove(): void;
}

class FakeStyle implements FakeNode {
  id?: string;
  textContent?: string;
  remove() {
    // removed from FakeDocument's element list when called
    fakeDoc._removeElement(this);
  }
}

class FakeDocument {
  head = {
    appendChild: (node: FakeStyle) => {
      this._elements.push(node);
    },
  };
  _elements: FakeStyle[] = [];

  createElement(_tag: string) {
    return new FakeStyle();
  }

  getElementById(id: string): FakeStyle | null {
    return this._elements.find((n) => n.id === id) ?? null;
  }

  _removeElement(node: FakeStyle) {
    this._elements = this._elements.filter((n) => n !== node);
  }
}

let fakeDoc: FakeDocument;

beforeEach(() => {
  fakeDoc = new FakeDocument();
  vi.stubGlobal("document", fakeDoc);
});

describe("globalTheme", () => {
  it("applyGlobalTheme injects a #noteometry-global-theme style element", async () => {
    const { applyGlobalTheme, isGlobalThemeApplied } = await import(
      "../../src/lib/globalTheme"
    );
    expect(isGlobalThemeApplied()).toBe(false);
    applyGlobalTheme();
    expect(isGlobalThemeApplied()).toBe(true);
    expect(fakeDoc._elements).toHaveLength(1);
    expect(fakeDoc._elements[0]!.id).toBe("noteometry-global-theme");
    expect(fakeDoc._elements[0]!.textContent).toMatch(/Noteometry global theme/);
  });

  it("applyGlobalTheme is idempotent (replaces, does not stack)", async () => {
    const { applyGlobalTheme } = await import("../../src/lib/globalTheme");
    applyGlobalTheme();
    applyGlobalTheme();
    applyGlobalTheme();
    expect(fakeDoc._elements).toHaveLength(1);
  });

  it("removeGlobalTheme removes the injected element", async () => {
    const { applyGlobalTheme, removeGlobalTheme, isGlobalThemeApplied } =
      await import("../../src/lib/globalTheme");
    applyGlobalTheme();
    removeGlobalTheme();
    expect(isGlobalThemeApplied()).toBe(false);
    expect(fakeDoc._elements).toHaveLength(0);
  });

  it("removeGlobalTheme is safe when nothing is applied (no-op)", async () => {
    const { removeGlobalTheme } = await import("../../src/lib/globalTheme");
    expect(() => removeGlobalTheme()).not.toThrow();
    expect(fakeDoc._elements).toHaveLength(0);
  });

  it("CSS contains both light and dark token blocks", async () => {
    const { applyGlobalTheme } = await import("../../src/lib/globalTheme");
    applyGlobalTheme();
    const css = fakeDoc._elements[0]!.textContent ?? "";
    expect(css).toMatch(/body:not\(\.theme-dark\)/);
    expect(css).toMatch(/body\.theme-dark/);
    expect(css).toMatch(/--background-primary/);
    expect(css).toMatch(/--text-normal/);
    expect(css).toMatch(/--interactive-accent/);
  });
});
