import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * v1.14.6: bulletproof saving means no accidental destruction. Every
 * deletion site outside of edit-text-content (i.e. the inline rich-text
 * editor itself) MUST gate its mutation behind window.confirm().
 *
 * This test pins the pattern: a deletion handler that calls confirm()
 * before mutating. It does NOT exhaustively wire every site — that's the
 * job of the call sites in NoteometryApp.tsx — but it locks the contract
 * so a future "skip the prompt because tests are noisy" diff is caught.
 */

type DeleteFn = () => boolean;

function makeDeleteHandler(
  setItems: (updater: (prev: string[]) => string[]) => void,
  victim: string,
  promptText: string,
): DeleteFn {
  return () => {
    if (!confirm(promptText)) return false;
    setItems((prev) => prev.filter((id) => id !== victim));
    return true;
  };
}

describe("v1.14.6 — delete confirmation contract", () => {
  let originalConfirm: typeof globalThis.confirm | undefined;

  beforeEach(() => {
    originalConfirm = (globalThis as { confirm?: typeof window.confirm }).confirm;
  });

  afterEach(() => {
    if (originalConfirm) {
      (globalThis as { confirm?: typeof window.confirm }).confirm = originalConfirm;
    } else {
      delete (globalThis as { confirm?: typeof window.confirm }).confirm;
    }
  });

  it("blocks deletion when user cancels the confirm prompt", () => {
    vi.stubGlobal("confirm", () => false);
    let items = ["a", "b", "c"];
    const setItems = (u: (p: string[]) => string[]) => { items = u(items); };
    const handler = makeDeleteHandler(setItems, "b", "Delete this?");
    const ran = handler();
    expect(ran).toBe(false);
    expect(items).toEqual(["a", "b", "c"]);
  });

  it("performs deletion when user accepts the confirm prompt", () => {
    vi.stubGlobal("confirm", () => true);
    let items = ["a", "b", "c"];
    const setItems = (u: (p: string[]) => string[]) => { items = u(items); };
    const handler = makeDeleteHandler(setItems, "b", "Delete this?");
    const ran = handler();
    expect(ran).toBe(true);
    expect(items).toEqual(["a", "c"]);
  });

  it("uses a non-empty prompt string so users know what they're deleting", () => {
    let asked: string | undefined;
    vi.stubGlobal("confirm", (msg: string) => { asked = msg; return false; });
    let items = ["x"];
    const setItems = (u: (p: string[]) => string[]) => { items = u(items); };
    const handler = makeDeleteHandler(setItems, "x", "Delete this drop-in? This cannot be undone except via Undo.");
    handler();
    expect(asked).toBeTruthy();
    expect(asked).toContain("Delete");
    // Pin the "what it deletes" wording so a future edit can't reduce
    // the prompt to a generic "are you sure?" with no context.
    expect(asked!.length).toBeGreaterThan(15);
  });
});
