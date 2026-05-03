/**
 * v1.11.0 phase-0: AIActivityStore unit tests.
 *
 * The React provider is a thin wrapper around `createAIActivityStore`.
 * Testing the store directly avoids spinning up a React tree and gives
 * us deterministic coverage of:
 *   - aggregation across multiple in-flight calls
 *   - idempotent begin (double-begin same id = no-op)
 *   - idempotent end (end on unknown id = no-op, end after end = no-op)
 *   - listener notifications fire on every state change
 *   - auto-generated id is stable + unique per begin
 *
 * The two real failure modes this guards against:
 *   1. The activity ribbon flickers off mid-call because a stop() and
 *      a finally{} double-end the same id and double-decrement.
 *   2. A streaming call begin()s, the user freezes mid-stream, end()
 *      fires from the freeze handler, then end() fires again from the
 *      try/finally — count goes negative or throws. Idempotent end
 *      kills both.
 */

import { describe, it, expect } from "vitest";
import { createAIActivityStore } from "../../src/features/aiActivity";

describe("AIActivityStore", () => {
  it("starts at zero and inactive", () => {
    const store = createAIActivityStore();
    expect(store.getCount()).toBe(0);
    expect(store.getIsActive()).toBe(false);
  });

  it("aggregates begin/end calls", () => {
    const store = createAIActivityStore();
    const a = store.begin("call-a");
    expect(store.getCount()).toBe(1);
    expect(store.getIsActive()).toBe(true);
    const b = store.begin("call-b");
    expect(store.getCount()).toBe(2);
    store.end(a);
    expect(store.getCount()).toBe(1);
    expect(store.getIsActive()).toBe(true);
    store.end(b);
    expect(store.getCount()).toBe(0);
    expect(store.getIsActive()).toBe(false);
  });

  it("returns the same id on double-begin (idempotent)", () => {
    const store = createAIActivityStore();
    const id1 = store.begin("dup");
    const id2 = store.begin("dup");
    expect(id1).toBe("dup");
    expect(id2).toBe("dup");
    expect(store.getCount()).toBe(1); // only counted once
    store.end("dup");
    expect(store.getCount()).toBe(0);
  });

  it("treats end() on unknown id as a no-op", () => {
    const store = createAIActivityStore();
    store.begin("real");
    store.end("ghost"); // never begun
    expect(store.getCount()).toBe(1);
    store.end("real");
    expect(store.getCount()).toBe(0);
  });

  it("treats end() after end() as a no-op (no negative count)", () => {
    const store = createAIActivityStore();
    store.begin("once");
    store.end("once");
    store.end("once"); // double-end — what stop()+finally would do
    expect(store.getCount()).toBe(0);
    expect(store.getIsActive()).toBe(false);
  });

  it("ignores empty-string callId on end()", () => {
    const store = createAIActivityStore();
    store.begin("real");
    store.end(""); // defensive: never trigger on empty
    expect(store.getCount()).toBe(1);
  });

  it("auto-generates ids when none provided, and they are unique", () => {
    const store = createAIActivityStore();
    const a = store.begin();
    const b = store.begin();
    expect(a).not.toBe("");
    expect(b).not.toBe("");
    expect(a).not.toBe(b);
    expect(store.getCount()).toBe(2);
  });

  it("notifies listeners on every state change", () => {
    const store = createAIActivityStore();
    let calls = 0;
    const unsub = store.subscribe(() => { calls += 1; });
    store.begin("x");
    store.begin("y");
    store.end("x");
    store.end("y");
    expect(calls).toBe(4);
    unsub();
    store.begin("z");
    expect(calls).toBe(4); // unsubscribed
  });

  it("does not notify listeners on idempotent calls", () => {
    const store = createAIActivityStore();
    let calls = 0;
    store.subscribe(() => { calls += 1; });
    store.begin("once");
    store.begin("once");          // idempotent — no notify
    store.end("nonexistent");     // idempotent — no notify
    store.end("once");
    store.end("once");            // idempotent — no notify
    expect(calls).toBe(2);
  });

  it("__peekLiveSet returns a snapshot independent of the store", () => {
    const store = createAIActivityStore();
    store.begin("a");
    const snap = store.__peekLiveSet();
    store.begin("b");
    expect(snap.has("a")).toBe(true);
    expect(snap.has("b")).toBe(false); // snapshot was taken before b
    expect(store.__peekLiveSet().has("b")).toBe(true);
  });
});
