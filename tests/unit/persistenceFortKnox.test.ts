import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  savePageToFile,
  isCanvasDataEmpty,
  appendShadowLedger,
  readShadowLedger,
  clearShadowLedger,
} from "../../src/lib/persistence";
import { packToV3, CanvasData, EMPTY_PAGE } from "../../src/lib/pageFormat";

/**
 * Fort Knox save engine (v1.16.0) regression guardrails.
 *
 * These pin the three new write-time protections:
 *   1. Serialized writes per file (no interleaved vault.modify calls
 *      for the same path).
 *   2. Anti-empty-overwrite — an in-memory EMPTY_PAGE never silently
 *      replaces real on-disk content unless the caller opts in.
 *   3. Emergency backup written via vault.adapter.write if vault.modify
 *      throws.
 *   4. Shadow Ledger ring of last successful payloads, persisted to
 *      localStorage.
 *
 * Each test exercises a failure mode that existed BEFORE the engine
 * was added — they would fail against the pre-v1.16 savePageToFile.
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

const richPage: CanvasData = {
  ...EMPTY_PAGE,
  stamps: [{ id: "s1", x: 0, y: 0, text: "∫", fontSize: 24, color: "#000" }],
  panelInput: "x^2",
};

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
});

describe("isCanvasDataEmpty", () => {
  it("treats EMPTY_PAGE as empty", () => {
    expect(isCanvasDataEmpty({ ...EMPTY_PAGE })).toBe(true);
  });

  it("treats a page with a stamp as non-empty", () => {
    expect(isCanvasDataEmpty(richPage)).toBe(false);
  });

  it("treats a page with only a viewport pan as still empty", () => {
    // Viewport is not user content; an autosave that wrote default
    // state with a non-zero scroll must still be considered empty.
    expect(isCanvasDataEmpty({ ...EMPTY_PAGE, viewport: { scrollX: 200, scrollY: 100 } })).toBe(true);
  });

  it("treats null/garbage as empty (no false negatives)", () => {
    expect(isCanvasDataEmpty(null)).toBe(true);
    expect(isCanvasDataEmpty(undefined)).toBe(true);
  });

  it("treats text-box-only pages as non-empty", () => {
    expect(isCanvasDataEmpty({ ...EMPTY_PAGE, textBoxData: { tb1: "hi" } })).toBe(false);
  });
});

describe("anti-empty-overwrite guard", () => {
  it("refuses to overwrite a non-empty on-disk page with an empty payload", async () => {
    const onDisk = JSON.stringify(packToV3(richPage));
    const read = vi.fn().mockResolvedValue(onDisk);
    const modify = vi.fn().mockResolvedValue(undefined);
    const app = { vault: { read, modify } } as any;
    const file = { path: "Notes/important.nmpage", basename: "important", parent: { path: "Notes" } } as any;

    await savePageToFile(app, file, { ...EMPTY_PAGE });

    expect(modify).not.toHaveBeenCalled();
  });

  it("allows the overwrite when allowEmptyOverwrite is set", async () => {
    const onDisk = JSON.stringify(packToV3(richPage));
    const read = vi.fn().mockResolvedValue(onDisk);
    const modify = vi.fn().mockResolvedValue(undefined);
    const app = { vault: { read, modify } } as any;
    const file = { path: "Notes/important.nmpage", basename: "important", parent: { path: "Notes" } } as any;

    await savePageToFile(app, file, { ...EMPTY_PAGE }, { allowEmptyOverwrite: true });

    expect(modify).toHaveBeenCalledTimes(1);
  });

  it("allows empty save when on-disk file is also empty (fresh file)", async () => {
    const read = vi.fn().mockResolvedValue("");
    const modify = vi.fn().mockResolvedValue(undefined);
    const app = { vault: { read, modify } } as any;
    const file = { path: "Notes/blank.nmpage", basename: "blank", parent: { path: "Notes" } } as any;

    await savePageToFile(app, file, { ...EMPTY_PAGE });

    expect(modify).toHaveBeenCalledTimes(1);
  });

  it("allows empty payload through when lastSaved carries a fresh timestamp (legitimate Clear Canvas)", async () => {
    // Clear Canvas writes an empty page BUT always stamps lastSaved
    // to the current time. The guard must not block this — only the
    // default-state autosave (lastSaved === "") should be refused.
    const onDisk = JSON.stringify(packToV3(richPage));
    const read = vi.fn().mockResolvedValue(onDisk);
    const modify = vi.fn().mockResolvedValue(undefined);
    const app = { vault: { read, modify } } as any;
    const file = { path: "Notes/cleared.nmpage", basename: "cleared", parent: { path: "Notes" } } as any;

    await savePageToFile(app, file, { ...EMPTY_PAGE, lastSaved: new Date().toISOString() });

    expect(modify).toHaveBeenCalledTimes(1);
  });

  it("refuses outright when payload is not an object", async () => {
    const modify = vi.fn().mockResolvedValue(undefined);
    const app = { vault: { read: vi.fn(), modify } } as any;
    const file = { path: "f.nmpage", basename: "f", parent: { path: "" } } as any;

    await savePageToFile(app, file, null as unknown as CanvasData);

    expect(modify).not.toHaveBeenCalled();
  });
});

describe("serialized writes (per-file mutex)", () => {
  it("two concurrent saves to the same file run one-after-the-other, not interleaved", async () => {
    const order: string[] = [];
    const modify = vi.fn().mockImplementation(async (_f: unknown, _body: string) => {
      order.push("start");
      await new Promise((r) => setTimeout(r, 10));
      order.push("end");
    });
    const app = { vault: { read: vi.fn().mockResolvedValue(""), modify } } as any;
    const file = { path: "Notes/race.nmpage", basename: "race", parent: { path: "Notes" } } as any;

    const a = savePageToFile(app, file, richPage);
    const b = savePageToFile(app, file, richPage);
    await Promise.all([a, b]);

    // Two writes happened, and each one's start..end pair is uninterrupted.
    expect(order).toEqual(["start", "end", "start", "end"]);
    expect(modify).toHaveBeenCalledTimes(2);
  });

  it("a failed write does not jam the queue for that file", async () => {
    let calls = 0;
    const modify = vi.fn().mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
    });
    const adapter = { write: vi.fn().mockResolvedValue(undefined) };
    const app = { vault: { read: vi.fn().mockResolvedValue(""), modify, adapter } } as any;
    const file = { path: "Notes/jam.nmpage", basename: "jam", parent: { path: "Notes" } } as any;

    await savePageToFile(app, file, richPage);
    await savePageToFile(app, file, richPage);
    expect(modify).toHaveBeenCalledTimes(2);
  });
});

describe("emergency backup on vault.modify failure", () => {
  it("writes a sibling .nm-emergency-*.json via vault.adapter.write", async () => {
    const modify = vi.fn().mockRejectedValue(new Error("disk full"));
    const adapterWrite = vi.fn().mockResolvedValue(undefined);
    const app = {
      vault: {
        read: vi.fn().mockResolvedValue(""),
        modify,
        adapter: { write: adapterWrite },
      },
    } as any;
    const file = { path: "Notes/Foo.nmpage", basename: "Foo", parent: { path: "Notes" } } as any;

    await savePageToFile(app, file, richPage);

    expect(adapterWrite).toHaveBeenCalledTimes(1);
    const [backupPath, body] = adapterWrite.mock.calls[0]!;
    expect(String(backupPath)).toMatch(/^Notes\/Foo\.nm-emergency-.+\.json$/);
    const parsed = JSON.parse(String(body));
    expect(parsed.type).toBe("noteometry-page");
    expect(parsed.version).toBe(3);
  });

  it("doesn't crash if the emergency backup itself also fails", async () => {
    const modify = vi.fn().mockRejectedValue(new Error("disk full"));
    const adapterWrite = vi.fn().mockRejectedValue(new Error("really full"));
    const app = {
      vault: {
        read: vi.fn().mockResolvedValue(""),
        modify,
        adapter: { write: adapterWrite },
      },
    } as any;
    const file = { path: "Notes/Foo.nmpage", basename: "Foo", parent: { path: "Notes" } } as any;

    await expect(savePageToFile(app, file, richPage)).resolves.toBeUndefined();
  });
});

describe("shadow ledger", () => {
  it("appendShadowLedger / readShadowLedger round-trip", () => {
    appendShadowLedger("a.nmpage", '{"v":1}');
    appendShadowLedger("a.nmpage", '{"v":2}');
    const entries = readShadowLedger("a.nmpage");
    expect(entries).toHaveLength(2);
    expect(entries[0]!.json).toBe('{"v":1}');
    expect(entries[1]!.json).toBe('{"v":2}');
    expect(typeof entries[0]!.ts).toBe("string");
  });

  it("ring is bounded to the depth (oldest entries roll off)", () => {
    for (let i = 0; i < 12; i++) {
      appendShadowLedger("ring.nmpage", JSON.stringify({ i }));
    }
    const entries = readShadowLedger("ring.nmpage");
    expect(entries.length).toBeLessThanOrEqual(5);
    // Newest survives; oldest rolled off.
    const last = JSON.parse(entries[entries.length - 1]!.json);
    expect(last.i).toBe(11);
    const first = JSON.parse(entries[0]!.json);
    expect(first.i).toBeGreaterThanOrEqual(7);
  });

  it("clearShadowLedger empties the ring", () => {
    appendShadowLedger("x.nmpage", "{}");
    expect(readShadowLedger("x.nmpage").length).toBeGreaterThan(0);
    clearShadowLedger("x.nmpage");
    expect(readShadowLedger("x.nmpage")).toEqual([]);
  });

  it("a successful savePageToFile appends to the ledger", async () => {
    const modify = vi.fn().mockResolvedValue(undefined);
    const app = { vault: { read: vi.fn().mockResolvedValue(""), modify } } as any;
    const file = { path: "Notes/ledger.nmpage", basename: "ledger", parent: { path: "Notes" } } as any;

    await savePageToFile(app, file, richPage);
    const entries = readShadowLedger("Notes/ledger.nmpage");
    expect(entries).toHaveLength(1);
    const parsed = JSON.parse(entries[0]!.json);
    expect(parsed.type).toBe("noteometry-page");
  });

  it("a failed savePageToFile does NOT append to the ledger", async () => {
    const modify = vi.fn().mockRejectedValue(new Error("nope"));
    const adapter = { write: vi.fn().mockResolvedValue(undefined) };
    const app = { vault: { read: vi.fn().mockResolvedValue(""), modify, adapter } } as any;
    const file = { path: "Notes/none.nmpage", basename: "none", parent: { path: "Notes" } } as any;

    await savePageToFile(app, file, richPage);
    expect(readShadowLedger("Notes/none.nmpage")).toEqual([]);
  });
});
