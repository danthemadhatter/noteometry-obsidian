import { describe, it, expect } from "vitest";
import {
  shouldSuppressDelete,
  shouldSkipBringToFront,
} from "../../src/lib/dropinFocusGuards";

/**
 * v1.11.2 Bug 1 + Bug 3 regression guards.
 *
 * Build a fake DocumentLike instead of jsdom — these helpers only touch
 * activeElement / body / querySelector / contains / matches, all of
 * which are easy to stub. Pattern matches the rest of the test suite
 * (no jsdom, lightweight node env).
 */

interface FakeEl {
  matches?: (s: string) => boolean;
  contains: (other: FakeEl | null) => boolean;
}

function el(opts: {
  match?: string[];
  children?: FakeEl[];
} = {}): FakeEl {
  const self: FakeEl = {
    matches: opts.match
      ? (s: string) => (opts.match ?? []).some(m => s.includes(m))
      : undefined,
    contains(other) {
      if (!other) return false;
      if (other === self) return true;
      return (opts.children ?? []).some(c => c.contains(other));
    },
  };
  return self;
}

function makeDoc(opts: {
  active?: FakeEl | null;
  body?: FakeEl | null;
  selectors?: Record<string, FakeEl | null>;
}) {
  const body = opts.body ?? el();
  return {
    activeElement: opts.active === undefined ? body : opts.active,
    body: body as unknown as HTMLElement,
    querySelector(s: string) {
      const map = opts.selectors ?? {};
      return (map[s] ?? null) as unknown as Element | null;
    },
  };
}

describe("shouldSuppressDelete (Bug 1: chrome buttons stealing delete)", () => {
  it("returns false when active element is body (no focus)", () => {
    const body = el();
    const doc = makeDoc({ active: body, body });
    expect(shouldSuppressDelete(doc as never)).toBe(false);
  });

  it("returns false when no dropin is selected", () => {
    const focused = el({ match: ["button"] });
    const doc = makeDoc({ active: focused, selectors: { ".noteometry-object-selected": null } });
    expect(shouldSuppressDelete(doc as never)).toBe(false);
  });

  it("returns true when focus is on a chrome BUTTON inside the selected dropin", () => {
    // This is the actual bug 1 scenario: user clicks Snapshot, focus moves
    // to <button>, then presses Backspace expecting nothing — instead the
    // dropin gets nuked. Guard must catch this.
    const button = el({ match: ["button"] });
    const selected = el({ children: [button] });
    const doc = makeDoc({
      active: button,
      selectors: { ".noteometry-object-selected": selected },
    });
    expect(shouldSuppressDelete(doc as never)).toBe(true);
  });

  it("returns true for contenteditable inside selected dropin", () => {
    const editable = el({ match: ['contenteditable="true"'] });
    const selected = el({ children: [editable] });
    const doc = makeDoc({
      active: editable,
      selectors: { ".noteometry-object-selected": selected },
    });
    expect(shouldSuppressDelete(doc as never)).toBe(true);
  });

  it("returns false when focus is OUTSIDE the selected dropin", () => {
    // e.g. focus is on the toolbar — Backspace should still work to delete
    // the selected dropin. This is the original behavior we must preserve.
    const elsewhere = el();
    const selected = el({ children: [] });
    const doc = makeDoc({
      active: elsewhere,
      selectors: { ".noteometry-object-selected": selected },
    });
    expect(shouldSuppressDelete(doc as never)).toBe(false);
  });
});

describe("shouldSkipBringToFront (Bug 3: reorder remounts editor mid-edit)", () => {
  it("returns false when active element is body", () => {
    const body = el();
    const doc = makeDoc({ active: body, body });
    expect(shouldSkipBringToFront(doc as never, "obj-1")).toBe(false);
  });

  it("returns false when the dropin element is not in the DOM", () => {
    const focused = el({ match: ["input"] });
    const doc = makeDoc({
      active: focused,
      selectors: { '[data-dropin-id="obj-1"]': null },
    });
    expect(shouldSkipBringToFront(doc as never, "obj-1")).toBe(false);
  });

  it("returns true when contenteditable inside the target dropin has focus", () => {
    // This is the exact bug 3 trigger: typing in a text dropin, then any
    // pointerdown on the wrapper would reorder + remount + lose caret.
    const editable = el({ match: ['contenteditable="true"'] });
    const dropin = el({ children: [editable] });
    const doc = makeDoc({
      active: editable,
      selectors: { '[data-dropin-id="obj-1"]': dropin },
    });
    expect(shouldSkipBringToFront(doc as never, "obj-1")).toBe(true);
  });

  it("returns true when an <input> inside the dropin has focus", () => {
    const input = el({ match: ["input"] });
    const dropin = el({ children: [input] });
    const doc = makeDoc({
      active: input,
      selectors: { '[data-dropin-id="obj-2"]': dropin },
    });
    expect(shouldSkipBringToFront(doc as never, "obj-2")).toBe(true);
  });

  it("returns false when focus is on a BUTTON inside the dropin (buttons take an action, no caret to lose)", () => {
    const button = el({ match: ["button"] });
    const dropin = el({ children: [button] });
    const doc = makeDoc({
      active: button,
      selectors: { '[data-dropin-id="obj-1"]': dropin },
    });
    expect(shouldSkipBringToFront(doc as never, "obj-1")).toBe(false);
  });

  it("returns false when active element is in a DIFFERENT dropin", () => {
    // pointerdown on dropin A while caret is in dropin B → still reorder A.
    const editableInB = el({ match: ['contenteditable="true"'] });
    const dropinA = el({ children: [] });
    const doc = makeDoc({
      active: editableInB,
      selectors: { '[data-dropin-id="obj-A"]': dropinA },
    });
    expect(shouldSkipBringToFront(doc as never, "obj-A")).toBe(false);
  });
});
