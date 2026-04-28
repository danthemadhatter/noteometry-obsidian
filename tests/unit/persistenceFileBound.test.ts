import { describe, it, expect, vi } from "vitest";
import { TFile, TFolder } from "obsidian";
import {
  isLegacyNoteometryMdContent,
  parsePageContent,
  savePageToFile,
  loadPageFromFile,
  convertLegacyMdPagesToNmpage,
} from "../../src/lib/persistence";
import { packToV3, CanvasData, EMPTY_PAGE } from "../../src/lib/pageFormat";

/**
 * Tier 3 native-explorer regression guardrails.
 *
 * These tests pin the contract for the file-bound persistence API that
 * replaces the old folder-relative savePage/loadPage path:
 *   - savePageToFile writes v3 JSON via app.vault.modify
 *   - loadPageFromFile reads app.vault.read and routes any recognizable
 *     page format back through the in-memory CanvasData shape
 *   - isLegacyNoteometryMdContent is conservative: it MUST return false
 *     for real markdown so the Convert command can't accidentally rename
 *     a user's notes.
 */

const samplePage: CanvasData = {
  ...EMPTY_PAGE,
  panelInput: "$$x^2$$",
  lastSaved: "2026-04-10T22:00:00.000Z",
  stamps: [{ id: "s1", x: 10, y: 20, text: "∫", fontSize: 28, color: "#1e1e1e" }],
};

function makeV3Json(data: CanvasData = samplePage): string {
  return JSON.stringify(packToV3(data));
}

describe("isLegacyNoteometryMdContent", () => {
  it("returns true for v3-packed page JSON", () => {
    expect(isLegacyNoteometryMdContent(makeV3Json())).toBe(true);
  });

  it("returns false for real markdown", () => {
    expect(isLegacyNoteometryMdContent("# A note\n\nSome prose.")).toBe(false);
  });

  it("returns false for plain JSON that isn't a v3 page", () => {
    expect(isLegacyNoteometryMdContent(JSON.stringify({ foo: "bar" }))).toBe(false);
  });

  it("returns false for a v2-shaped page (we only auto-convert v3)", () => {
    // v2 pages also render, but the convert command must stay conservative
    // so an ambiguous .md never gets renamed based on a guess.
    expect(isLegacyNoteometryMdContent(JSON.stringify({ version: 2, strokes: [] }))).toBe(false);
  });

  it("returns false for empty or malformed input", () => {
    expect(isLegacyNoteometryMdContent("")).toBe(false);
    expect(isLegacyNoteometryMdContent("{ not json")).toBe(false);
  });
});

describe("parsePageContent", () => {
  it("decodes v3 JSON back to CanvasData", () => {
    const decoded = parsePageContent(makeV3Json());
    expect(decoded).not.toBeNull();
    expect(decoded!.stamps).toHaveLength(1);
    expect(decoded!.stamps[0]!.text).toBe("∫");
    expect(decoded!.panelInput).toBe("$$x^2$$");
  });

  it("falls back to v2 shape when version===2", () => {
    const v2 = JSON.stringify({ version: 2, strokes: [], stamps: [], panelInput: "hi" });
    const decoded = parsePageContent(v2);
    expect(decoded).not.toBeNull();
    expect(decoded!.panelInput).toBe("hi");
  });

  it("returns null for non-JSON text", () => {
    expect(parsePageContent("this is just a note")).toBeNull();
  });
});

describe("savePageToFile / loadPageFromFile", () => {
  it("savePageToFile writes packed v3 JSON via app.vault.modify", async () => {
    const modify = vi.fn().mockResolvedValue(undefined);
    const app = { vault: { modify } } as any;
    const file = { path: "Notes/demo.nmpage" } as any;

    await savePageToFile(app, file, samplePage);

    expect(modify).toHaveBeenCalledTimes(1);
    const [calledFile, calledBody] = modify.mock.calls[0]!;
    expect(calledFile).toBe(file);
    const parsed = JSON.parse(calledBody as string);
    expect(parsed.type).toBe("noteometry-page");
    expect(parsed.version).toBe(3);
    // The pipeline panelInput round-trips.
    expect(parsed.pipeline.panelInput).toBe("$$x^2$$");
  });

  it("loadPageFromFile decodes a v3 file back to CanvasData", async () => {
    const read = vi.fn().mockResolvedValue(makeV3Json());
    const app = { vault: { read } } as any;
    const file = { path: "Notes/demo.nmpage" } as any;

    const data = await loadPageFromFile(app, file);
    expect(data).not.toBeNull();
    expect(data!.stamps).toHaveLength(1);
  });

  it("loadPageFromFile returns EMPTY_PAGE for empty files (freshly created)", async () => {
    const read = vi.fn().mockResolvedValue("");
    const app = { vault: { read } } as any;
    const file = { path: "Notes/blank.nmpage" } as any;

    const data = await loadPageFromFile(app, file);
    expect(data).not.toBeNull();
    expect(data!.strokes).toEqual([]);
    expect(data!.stamps).toEqual([]);
  });

  it("loadPageFromFile returns null when content isn't a recognizable page", async () => {
    const read = vi.fn().mockResolvedValue("# Just a markdown note");
    const app = { vault: { read } } as any;
    const file = { path: "Notes/note.md" } as any;

    const data = await loadPageFromFile(app, file);
    expect(data).toBeNull();
  });

  it("savePageToFile → loadPageFromFile is lossless across a vault write", async () => {
    // Simulate the vault: modify writes the string, read plays it back.
    let stored = "";
    const modify = vi.fn().mockImplementation(async (_f: unknown, body: string) => { stored = body; });
    const read = vi.fn().mockImplementation(async () => stored);
    const app = { vault: { modify, read } } as any;
    const file = { path: "Notes/demo.nmpage" } as any;

    await savePageToFile(app, file, samplePage);
    const back = await loadPageFromFile(app, file);
    expect(back).not.toBeNull();
    expect(back!.stamps).toEqual(samplePage.stamps);
    expect(back!.panelInput).toBe(samplePage.panelInput);
  });
});

/**
 * Mini in-memory vault for convert-legacy tests. Mirrors the surface of
 * Obsidian's Vault that convertLegacyMdPagesToNmpage actually touches:
 * getAbstractFileByPath, read, rename. Files live in a flat path map; the
 * root folder's children list is rebuilt from path prefixes so the walk
 * inside findLegacyMdPages sees the right TFile instances.
 */
function buildVault(rootPath: string, files: Record<string, string>) {
  const root = new TFolder();
  root.path = rootPath;

  const fileMap: Record<string, TFile> = {};
  for (const [path, contents] of Object.entries(files)) {
    const slash = path.lastIndexOf("/");
    const name = slash >= 0 ? path.slice(slash + 1) : path;
    const dot = name.lastIndexOf(".");
    const basename = dot > 0 ? name.slice(0, dot) : name;
    const extension = dot > 0 ? name.slice(dot + 1) : "";
    const f = new TFile();
    f.path = path;
    f.basename = basename;
    f.extension = extension;
    f.parent = root;
    (f as any).contents = contents;
    fileMap[path] = f;
    root.children.push(f);
  }

  const app = {
    vault: {
      getAbstractFileByPath: (p: string) => {
        if (p === rootPath) return root;
        return fileMap[p] ?? null;
      },
      read: async (f: TFile) => (f as any).contents as string,
      rename: async (f: TFile, newPath: string) => {
        delete fileMap[f.path];
        f.path = newPath;
        const slash = newPath.lastIndexOf("/");
        const name = slash >= 0 ? newPath.slice(slash + 1) : newPath;
        const dot = name.lastIndexOf(".");
        f.basename = dot > 0 ? name.slice(0, dot) : name;
        f.extension = dot > 0 ? name.slice(dot + 1) : "";
        fileMap[newPath] = f;
      },
    },
  } as any;

  return { app, fileMap, root };
}

describe("convertLegacyMdPagesToNmpage", () => {
  it("renames a legacy .md page to .nmpage and reports converted=1", async () => {
    const v3 = JSON.stringify(packToV3(samplePage));
    const { app, fileMap } = buildVault("Noteometry", {
      "Noteometry/Foo.md": v3,
    });

    const result = await convertLegacyMdPagesToNmpage(app, "Noteometry");
    expect(result).toEqual({ converted: 1, collisions: 0 });
    expect(fileMap["Noteometry/Foo.md"]).toBeUndefined();
    expect(fileMap["Noteometry/Foo.nmpage"]).toBeDefined();
  });

  it("uses a numeric suffix when target .nmpage already exists, instead of skipping", async () => {
    // The original bug: silent skip left Foo.md on disk, so the legacy
    // notice fired again on every plugin load forever.
    const v3 = JSON.stringify(packToV3(samplePage));
    const { app, fileMap } = buildVault("Noteometry", {
      "Noteometry/Foo.md": v3,
      "Noteometry/Foo.nmpage": v3,
    });

    const result = await convertLegacyMdPagesToNmpage(app, "Noteometry");
    expect(result).toEqual({ converted: 1, collisions: 1 });
    // The .md is gone — that's the load-bearing assertion.
    expect(fileMap["Noteometry/Foo.md"]).toBeUndefined();
    // The pre-existing .nmpage is untouched.
    expect(fileMap["Noteometry/Foo.nmpage"]).toBeDefined();
    // The legacy file was renamed with the next free numeric suffix.
    expect(fileMap["Noteometry/Foo 1.nmpage"]).toBeDefined();
  });

  it("walks past existing suffixed names to the next free slot", async () => {
    const v3 = JSON.stringify(packToV3(samplePage));
    const { app, fileMap } = buildVault("Noteometry", {
      "Noteometry/Foo.md": v3,
      "Noteometry/Foo.nmpage": v3,
      "Noteometry/Foo 1.nmpage": v3,
      "Noteometry/Foo 2.nmpage": v3,
    });

    const result = await convertLegacyMdPagesToNmpage(app, "Noteometry");
    expect(result).toEqual({ converted: 1, collisions: 1 });
    expect(fileMap["Noteometry/Foo 3.nmpage"]).toBeDefined();
  });

  it("ignores .md files whose content isn't a v3 Noteometry page", async () => {
    const v3 = JSON.stringify(packToV3(samplePage));
    const { app, fileMap } = buildVault("Noteometry", {
      "Noteometry/Foo.md": v3,
      "Noteometry/Notes.md": "# Just a real markdown note",
    });

    const result = await convertLegacyMdPagesToNmpage(app, "Noteometry");
    expect(result).toEqual({ converted: 1, collisions: 0 });
    expect(fileMap["Noteometry/Notes.md"]).toBeDefined();
    expect(fileMap["Noteometry/Foo.nmpage"]).toBeDefined();
  });
});
