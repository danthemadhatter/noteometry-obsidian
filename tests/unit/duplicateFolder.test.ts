import { describe, it, expect } from "vitest";
import { duplicateFolder } from "../../src/lib/persistence";
import { packToV3 } from "../../src/lib/pageFormat";
import type { CanvasData } from "../../src/lib/pageFormat";
import { TFile, TFolder } from "../stubs/obsidian";

/**
 * v1.16.3: duplicate a section/folder so a user can clone a 16-week course
 * scaffold for the next semester without rebuilding it by hand.
 *
 * What we test:
 *  - The destination folder is created.
 *  - .nmpage files are copied; their attachment refs are rewritten to
 *    fresh IDs and the attachment bytes are duplicated into the copy.
 *  - The original is untouched (no shared attachment bytes — editing
 *    the copy never mutates the source).
 *  - A name collision throws.
 *
 * The Obsidian APIs are stubbed: vault + adapter store everything in
 * a plain Map so the test can assert end state without filesystem I/O.
 */

interface FakeStore {
  files: Map<string, ArrayBuffer | string>;
  folders: Set<string>;
}

function makeFakeVault() {
  const store: FakeStore = { files: new Map(), folders: new Set() };

  function ensureParentFolders(path: string) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      const p = parts.slice(0, i).join("/");
      if (p) store.folders.add(p);
    }
  }

  function getAbstractFileByPath(path: string): TFile | TFolder | null {
    const normalized = path.replace(/\/+$/, "");
    if (store.folders.has(normalized)) {
      const folder = buildFolder(normalized);
      return folder;
    }
    if (store.files.has(normalized)) {
      const f = new TFile();
      f.path = normalized;
      const slash = normalized.lastIndexOf("/");
      const name = slash >= 0 ? normalized.slice(slash + 1) : normalized;
      const dot = name.lastIndexOf(".");
      f.basename = dot >= 0 ? name.slice(0, dot) : name;
      f.extension = dot >= 0 ? name.slice(dot + 1) : "";
      const parentPath = slash >= 0 ? normalized.slice(0, slash) : "";
      f.parent = parentPath ? buildFolder(parentPath) : null;
      return f;
    }
    return null;
  }

  function buildFolder(folderPath: string): TFolder {
    const folder = new TFolder();
    folder.path = folderPath;
    const lastSlash = folderPath.lastIndexOf("/");
    folder.name = lastSlash >= 0 ? folderPath.slice(lastSlash + 1) : folderPath;
    const prefix = folderPath ? folderPath + "/" : "";
    const children: Array<TFile | TFolder> = [];
    // Direct child folders
    for (const fp of store.folders) {
      if (!fp.startsWith(prefix)) continue;
      const rest = fp.slice(prefix.length);
      if (rest && !rest.includes("/")) {
        const sub = new TFolder();
        sub.path = fp;
        children.push(sub);
      }
    }
    // Direct child files
    for (const fp of store.files.keys()) {
      if (!fp.startsWith(prefix)) continue;
      const rest = fp.slice(prefix.length);
      if (rest && !rest.includes("/")) {
        const sub = new TFile();
        sub.path = fp;
        const dot = rest.lastIndexOf(".");
        sub.basename = dot >= 0 ? rest.slice(0, dot) : rest;
        sub.extension = dot >= 0 ? rest.slice(dot + 1) : "";
        sub.parent = folder;
        children.push(sub);
      }
    }
    // Recurse into immediate sub-folders so the duplicate walker can see
    // grand-children (e.g. an "attachments" sub-folder under a section).
    for (const child of children) {
      if (child instanceof TFolder) {
        const grand = buildFolder(child.path);
        // Replace the placeholder with the populated version so each
        // TFolder we hand back has its own .children.
        (child as TFolder).children = grand.children;
      }
    }
    folder.children = children;
    return folder;
  }

  const app = {
    vault: {
      getAbstractFileByPath,
      async createFolder(path: string) {
        const normalized = path.replace(/\/+$/, "");
        if (!normalized) return;
        ensureParentFolders(normalized);
        store.folders.add(normalized);
      },
      async read(file: TFile) {
        const val = store.files.get(file.path);
        if (typeof val === "string") return val;
        throw new Error(`not text: ${file.path}`);
      },
      adapter: {
        async exists(p: string) {
          return store.folders.has(p) || store.files.has(p);
        },
        async mkdir(p: string) {
          ensureParentFolders(p);
          store.folders.add(p);
        },
        async readBinary(p: string) {
          const v = store.files.get(p);
          if (v === undefined) throw new Error(`missing ${p}`);
          if (typeof v === "string") {
            const enc = new TextEncoder();
            return enc.encode(v).buffer;
          }
          return v;
        },
        async writeBinary(p: string, bytes: ArrayBuffer) {
          ensureParentFolders(p);
          store.files.set(p, bytes);
        },
        async write(p: string, text: string) {
          ensureParentFolders(p);
          store.files.set(p, text);
        },
      },
    },
  };

  return { app: app as unknown as Parameters<typeof duplicateFolder>[0], store };
}

function makePageJson(refs: { type: "image" | "pdf"; fileRef: string }[]): string {
  const data: CanvasData = {
    strokes: [],
    stamps: [],
    canvasObjects: refs.map((r, i) =>
      r.type === "image"
        ? { id: `obj-${i}`, type: "image", x: 0, y: 0, w: 10, h: 10, dataURL: r.fileRef }
        : { id: `obj-${i}`, type: "pdf", x: 0, y: 0, w: 10, h: 10, fileRef: r.fileRef, page: 1 },
    ),
    viewport: { scrollX: 0, scrollY: 0 },
    panelInput: "",
    chatMessages: [],
    tableData: {},
    textBoxData: {},
    lastSaved: new Date().toISOString(),
  };
  return JSON.stringify(packToV3(data));
}

describe("duplicateFolder", () => {
  it("copies an empty folder", async () => {
    const { app, store } = makeFakeVault();
    store.folders.add("Noteometry");
    store.folders.add("Noteometry/Course A");
    const source = (app as { vault: { getAbstractFileByPath: (p: string) => unknown } })
      .vault.getAbstractFileByPath("Noteometry/Course A") as TFolder;
    const res = await duplicateFolder(app, source, "Noteometry", "Course B");
    expect(res.destinationPath).toBe("Noteometry/Course B");
    expect(res.pages).toBe(0);
    expect(store.folders.has("Noteometry/Course B")).toBe(true);
  });

  it("copies pages and rewrites attachment refs to fresh IDs", async () => {
    const { app, store } = makeFakeVault();
    store.folders.add("Noteometry");
    store.folders.add("Noteometry/Fall");
    store.folders.add("Noteometry/Fall/attachments");
    const pageJson = makePageJson([
      { type: "image", fileRef: "Noteometry/Fall/attachments/img1.png" },
      { type: "pdf", fileRef: "Noteometry/Fall/attachments/doc1.pdf" },
    ]);
    store.files.set("Noteometry/Fall/Week 1.nmpage", pageJson);
    store.files.set("Noteometry/Fall/attachments/img1.png", new TextEncoder().encode("PNGDATA").buffer);
    store.files.set("Noteometry/Fall/attachments/doc1.pdf", new TextEncoder().encode("PDFDATA").buffer);

    const source = (app as { vault: { getAbstractFileByPath: (p: string) => unknown } })
      .vault.getAbstractFileByPath("Noteometry/Fall") as TFolder;
    const res = await duplicateFolder(app, source, "Noteometry", "Spring");

    expect(res.pages).toBe(1);
    expect(res.attachments).toBe(2);

    // Destination .nmpage exists and uses fresh refs (NOT the original).
    const copyText = store.files.get("Noteometry/Spring/Week 1.nmpage");
    expect(typeof copyText).toBe("string");
    const parsed = JSON.parse(copyText as string);
    const refs: string[] = parsed.elements
      .filter((e: { type: string }) => e.type === "image" || e.type === "pdf")
      .map((e: { fileRef: string }) => e.fileRef);
    expect(refs).toHaveLength(2);
    for (const r of refs) {
      expect(r.startsWith("Noteometry/Spring/attachments/")).toBe(true);
      // Crucially, the new refs are NOT the originals — duplicate must
      // not share attachment bytes with the source.
      expect(r).not.toBe("Noteometry/Fall/attachments/img1.png");
      expect(r).not.toBe("Noteometry/Fall/attachments/doc1.pdf");
    }

    // The new attachment files exist with their own bytes copied.
    for (const r of refs) {
      expect(store.files.has(r)).toBe(true);
    }

    // The original is untouched — the source page still points at the
    // original attachments.
    const originalText = store.files.get("Noteometry/Fall/Week 1.nmpage");
    expect(originalText).toBe(pageJson);
  });

  it("throws on destination name collision", async () => {
    const { app, store } = makeFakeVault();
    store.folders.add("Noteometry");
    store.folders.add("Noteometry/Course A");
    store.folders.add("Noteometry/Course B");
    const source = (app as { vault: { getAbstractFileByPath: (p: string) => unknown } })
      .vault.getAbstractFileByPath("Noteometry/Course A") as TFolder;
    await expect(
      duplicateFolder(app, source, "Noteometry", "Course B"),
    ).rejects.toThrow(/already exists/);
  });
});
