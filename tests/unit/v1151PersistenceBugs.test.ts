import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  savePageToFile,
  isLegacyNoteometryMdContent,
} from "../../src/lib/persistence";
import { packToV3, EMPTY_PAGE } from "../../src/lib/pageFormat";

/**
 * v1.15.1 — three correctness bugs in the file-bound persistence layer.
 *
 * Bug 1 — Cross-file overwrite race
 *   onLoadFile flipped `this.lastFile = file` before flushing the React
 *   tree's pending save. Any in-flight autosave debounced for the
 *   previous file then targeted the NEW file's TFile and wrote the
 *   previous file's CanvasData into it.
 *
 *   Fix: flush the React tree's pending save in NoteometryView.onLoadFile
 *   BEFORE reassigning lastFile. Remove the redundant flush in
 *   NoteometryApp.tsx's initial-data setter (which fired AFTER hydration
 *   was already kicked off — a second async hop that re-opened the race).
 *
 * Bug 2 — Emergency cache deletion on failed save
 *   savePageToFile swallowed any vault.modify error and resolved void.
 *   handleSaveData then always called clearPageCache, deleting the only
 *   recoverable copy of the user's work whenever the disk write failed.
 *
 *   Fix: re-throw the vault error from savePageToFile, and wrap the
 *   call site in NoteometryView in try/catch so clearPageCache only
 *   runs when the await actually succeeded.
 *
 * Bug 3 — Legacy migration only recognized v3
 *   isLegacyNoteometryMdContent strictly validated against the v3
 *   schema, so legacy v1 (raw `{strokes:[…]}`) and v2 (`{version:2, …}`)
 *   .md pages — the entire reason the convert command exists — were
 *   skipped and stayed orphaned on disk.
 *
 *   Fix: recognize v3 + v2 + v1 stroke-array shapes, while remaining
 *   conservative for arbitrary JSON like `{"foo":"bar"}`.
 *
 * These tests pin all three fixes so the next refactor can't quietly
 * regress them.
 */

const ROOT = join(__dirname, "..", "..");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("v1.15.1 fix #1 — cross-file overwrite race", () => {
  const VIEW_SRC = stripComments(
    readFileSync(join(ROOT, "src/NoteometryView.ts"), "utf8"),
  );
  const APP_SRC = stripComments(
    readFileSync(join(ROOT, "src/components/NoteometryApp.tsx"), "utf8"),
  );

  it("onLoadFile flushes the React tree BEFORE reassigning lastFile", () => {
    // Pull just the onLoadFile body. Match the function header and
    // everything up to (but not including) the next async method
    // declaration ("async onUnloadFile" / "async handleSaveData" / etc).
    const match = VIEW_SRC.match(/async onLoadFile\([\s\S]*?\n  \}/);
    expect(match, "expected to find onLoadFile body").not.toBeNull();
    const body = match![0];

    const flushIdx = body.indexOf("this.flushMyTree(");
    const assignIdx = body.indexOf("this.lastFile = file");
    expect(flushIdx, "expected flushMyTree() call in onLoadFile").toBeGreaterThanOrEqual(0);
    expect(assignIdx, "expected this.lastFile = file assignment").toBeGreaterThanOrEqual(0);
    expect(flushIdx).toBeLessThan(assignIdx);
  });

  it("the flush is gated on lastFile !== file so the initial bind doesn't no-op-loop", () => {
    // Without the !== guard the flush would also run on the first
    // bind (when lastFile is null), which is harmless but noisy. The
    // guard is what makes the fix narrow: it only triggers when a
    // leaf that already has a bound file is being rebound to a
    // different one — the exact failure case from the bug report.
    const match = VIEW_SRC.match(/async onLoadFile\([\s\S]*?\n  \}/);
    const body = match![0];
    expect(body).toMatch(/this\.lastFile && this\.lastFile !== file/);
  });

  it("NoteometryApp's initial-data setter no longer awaits flushPendingSave", () => {
    // The redundant flush in registerInitialDataSetter was the second
    // source of the race: it hydrated AFTER an async hop, opening a
    // window for the still-pending OLD-file save to clobber the
    // freshly-bound NEW file. Removing it leaves NoteometryView as
    // the single owner of the flush-before-load contract.
    const setterMatch = APP_SRC.match(
      /registerInitialDataSetter\(\(data: CanvasData \| null, _token: number\) => \{[\s\S]*?\}\);/,
    );
    expect(setterMatch, "expected registerInitialDataSetter body").not.toBeNull();
    expect(setterMatch![0]).not.toMatch(/flushPendingSave\(/);
  });
});

describe("v1.15.1 fix #2 — emergency cache deletion only on successful save", () => {
  const VIEW_SRC = stripComments(
    readFileSync(join(ROOT, "src/NoteometryView.ts"), "utf8"),
  );

  it("savePageToFile re-throws on vault.modify failure", async () => {
    const boom = new Error("EIO: write failed");
    const modify = vi.fn().mockRejectedValue(boom);
    const app = { vault: { modify } } as any;
    const file = { path: "Notes/x.nmpage" } as any;

    await expect(savePageToFile(app, file, { ...EMPTY_PAGE })).rejects.toBe(boom);
    expect(modify).toHaveBeenCalledTimes(1);
  });

  it("handleSaveData wraps savePageToFile + clearPageCache in a single try so the clear is gated on success", () => {
    // Source-level pin: the order of statements inside handleSaveData
    // must be `await savePageToFile(...)` then `clearPageCache(...)`,
    // both inside the same try block, so an exception from
    // savePageToFile skips the clear. Pre-fix the await was naked
    // and clearPageCache always ran.
    const match = VIEW_SRC.match(/private async handleSaveData\([\s\S]*?\n  \}/);
    expect(match, "expected handleSaveData body").not.toBeNull();
    const body = match![0];

    // Look for the success-path try block that wraps both calls.
    const tryBlock = body.match(/try\s*\{[^}]*?await savePageToFile[\s\S]*?clearPageCache[\s\S]*?\}\s*catch/);
    expect(
      tryBlock,
      "expected savePageToFile + clearPageCache to share a try/catch in handleSaveData",
    ).not.toBeNull();
  });

  it("handleSaveData has a catch arm that does NOT clear the cache (so recovery survives)", () => {
    const match = VIEW_SRC.match(/private async handleSaveData\([\s\S]*?\n  \}/);
    const body = match![0];
    // The relevant catch is the one wrapping savePageToFile +
    // clearPageCache. Slice from its preceding await so we ignore the
    // earlier packing-step catch (which is unrelated and intentionally
    // empty — packing doesn't throw and isn't involved in the bug).
    const awaitIdx = body.indexOf("await savePageToFile");
    expect(awaitIdx, "expected await savePageToFile in handleSaveData").toBeGreaterThan(-1);
    const tail = body.slice(awaitIdx);
    const catchIdx = tail.indexOf("catch");
    expect(catchIdx, "expected catch arm after savePageToFile call").toBeGreaterThan(-1);
    const catchSlice = tail.slice(catchIdx);
    expect(catchSlice).not.toMatch(/clearPageCache\(/);
  });
});

describe("v1.15.1 fix #3 — legacy migration recognizes v1, v2, and v3", () => {
  it("recognizes v3-packed page JSON", () => {
    expect(isLegacyNoteometryMdContent(JSON.stringify(packToV3(EMPTY_PAGE)))).toBe(true);
  });

  it("recognizes a v2 page envelope", () => {
    expect(
      isLegacyNoteometryMdContent(
        JSON.stringify({ version: 2, strokes: [], stamps: [], panelInput: "x" }),
      ),
    ).toBe(true);
  });

  it("recognizes a pre-versioned v1 stroke array", () => {
    expect(isLegacyNoteometryMdContent(JSON.stringify({ strokes: [] }))).toBe(true);
    // v1 also commonly had `stamps`/`tableData` etc. alongside strokes
    // but the strokes array alone is the discriminating signal.
    expect(
      isLegacyNoteometryMdContent(
        JSON.stringify({ strokes: [{ points: [], color: "#000", width: 2 }] }),
      ),
    ).toBe(true);
  });

  it("still returns false for real markdown", () => {
    expect(isLegacyNoteometryMdContent("# Title\n\nProse here.")).toBe(false);
    expect(isLegacyNoteometryMdContent("Just some notes.")).toBe(false);
  });

  it("still returns false for arbitrary JSON that has no Noteometry shape", () => {
    expect(isLegacyNoteometryMdContent(JSON.stringify({ foo: "bar" }))).toBe(false);
    expect(isLegacyNoteometryMdContent(JSON.stringify([1, 2, 3]))).toBe(false);
    expect(isLegacyNoteometryMdContent(JSON.stringify({ strokes: "not-an-array" }))).toBe(false);
  });

  it("still returns false for empty / malformed input", () => {
    expect(isLegacyNoteometryMdContent("")).toBe(false);
    expect(isLegacyNoteometryMdContent("{ not json")).toBe(false);
  });
});
