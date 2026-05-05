import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  cachePageDataSync,
  getCachedPageData,
  clearPageCache,
} from "../../src/lib/persistence";
import { packToV3, EMPTY_PAGE } from "../../src/lib/pageFormat";

/**
 * v1.14.5 emergency recovery cache.
 *
 * The cache is the load-bearing piece of the "tab X kills the save"
 * fix: handleSaveData stashes the packed v3 JSON in localStorage
 * synchronously BEFORE awaiting vault.modify, so a force-reload or
 * tab-close mid-flight still leaves a recoverable copy. These tests
 * pin the round-trip + isolation semantics so future refactors can't
 * silently break the lifeline.
 */

class MemoryStorage {
  private data: Record<string, string> = {};
  get length() { return Object.keys(this.data).length; }
  getItem(k: string) { return this.data[k] ?? null; }
  setItem(k: string, v: string) { this.data[k] = v; }
  removeItem(k: string) { delete this.data[k]; }
  clear() { this.data = {}; }
  key(i: number) { return Object.keys(this.data)[i] ?? null; }
}

describe("recovery cache round-trip", () => {
  let store: MemoryStorage;

  beforeEach(() => {
    store = new MemoryStorage();
    vi.stubGlobal("localStorage", store);
  });

  it("cache → get returns the exact JSON written", () => {
    const path = "Noteometry/APUS/ELEN201/Week 1/Lecture.nmpage";
    const json = JSON.stringify(packToV3({ ...EMPTY_PAGE, panelInput: "hi" }));
    cachePageDataSync(path, json);
    expect(getCachedPageData(path)).toBe(json);
  });

  it("clearPageCache removes the entry", () => {
    const path = "Noteometry/Untitled.nmpage";
    cachePageDataSync(path, "{}");
    expect(getCachedPageData(path)).toBe("{}");
    clearPageCache(path);
    expect(getCachedPageData(path)).toBeNull();
  });

  it("cache entries are keyed per file path — no cross-talk", () => {
    cachePageDataSync("a.nmpage", "A");
    cachePageDataSync("b.nmpage", "B");
    expect(getCachedPageData("a.nmpage")).toBe("A");
    expect(getCachedPageData("b.nmpage")).toBe("B");
    clearPageCache("a.nmpage");
    expect(getCachedPageData("a.nmpage")).toBeNull();
    expect(getCachedPageData("b.nmpage")).toBe("B");
  });

  it("getCachedPageData returns null when nothing was cached", () => {
    expect(getCachedPageData("never-written.nmpage")).toBeNull();
  });

  it("cachePageDataSync swallows quota errors (best-effort lifeline)", () => {
    const throwing = {
      getItem: () => null,
      setItem: () => { throw new Error("QuotaExceededError"); },
      removeItem: () => { /* noop */ },
    };
    vi.stubGlobal("localStorage", throwing);
    // Must not throw — recovery is best effort.
    expect(() => cachePageDataSync("foo.nmpage", "{}")).not.toThrow();
  });

  it("survives a missing localStorage (sandboxed / SSR contexts)", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => cachePageDataSync("foo.nmpage", "{}")).not.toThrow();
    expect(getCachedPageData("foo.nmpage")).toBeNull();
    expect(() => clearPageCache("foo.nmpage")).not.toThrow();
  });

  it("the cached payload decodes as v3 on the recovery side", () => {
    const path = "demo.nmpage";
    const original = { ...EMPTY_PAGE, panelInput: "$$x^2$$" };
    cachePageDataSync(path, JSON.stringify(packToV3(original)));
    const cached = getCachedPageData(path);
    expect(cached).not.toBeNull();
    const parsed = JSON.parse(cached!);
    expect(parsed.type).toBe("noteometry-page");
    expect(parsed.version).toBe(3);
    expect(parsed.pipeline.panelInput).toBe("$$x^2$$");
  });
});
