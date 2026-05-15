import { describe, it, expect, vi } from "vitest";
import {
  attachmentDirFor,
  normalizeVaultPath,
  saveImageBytesTo,
  savePdfBytesTo,
  migratePageAssetsForPortability,
} from "../../src/lib/persistence";
import type { CanvasData } from "../../src/lib/pageFormat";
import { TFile, TFolder } from "../stubs/obsidian";

/**
 * v1.16.3 cross-device asset sync fix.
 *
 * Pre-1.16.3, pages added at the vault root produced attachment paths
 * of the form "/attachments/<id>.png" because the React-side caller
 * passed `f.parent?.path ?? rootDir(plugin)` and `f.parent.path` was the
 * empty string (not nullish) for vault-root files. Desktop's Node
 * adapter quietly normalized the leading slash; iOS's Capacitor adapter
 * did not, so the asset never appeared on iPad.
 *
 * These tests pin:
 *  - `attachmentDirFor` always returns a vault-relative path (no leading
 *    slash, no double slash).
 *  - `saveImageBytesTo` / `savePdfBytesTo` write to a portable path.
 *  - `migratePageAssetsForPortability` rewrites leading-slash refs and
 *    inline data: URLs so re-saving the page produces a portable copy.
 */
describe("attachmentDirFor", () => {
  it("returns vault-relative 'attachments' for the vault root", () => {
    expect(attachmentDirFor("")).toBe("attachments");
  });

  it("strips leading slashes", () => {
    expect(attachmentDirFor("/")).toBe("attachments");
    expect(attachmentDirFor("/Noteometry")).toBe("Noteometry/attachments");
    expect(attachmentDirFor("///Noteometry/Sub")).toBe("Noteometry/Sub/attachments");
  });

  it("strips trailing slashes so we never produce 'foo//attachments'", () => {
    expect(attachmentDirFor("Noteometry/")).toBe("Noteometry/attachments");
    expect(attachmentDirFor("Noteometry/Sub/")).toBe("Noteometry/Sub/attachments");
  });

  it("preserves a normal nested path", () => {
    expect(attachmentDirFor("Noteometry/Fall 2025/ELEN201")).toBe(
      "Noteometry/Fall 2025/ELEN201/attachments",
    );
  });
});

describe("normalizeVaultPath", () => {
  it("strips leading slashes from vault paths", () => {
    expect(normalizeVaultPath("/attachments/x.png")).toBe("attachments/x.png");
    expect(normalizeVaultPath("///Noteometry/attachments/x.pdf")).toBe(
      "Noteometry/attachments/x.pdf",
    );
  });
  it("leaves data: URLs and empty strings alone", () => {
    expect(normalizeVaultPath("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
    expect(normalizeVaultPath("")).toBe("");
  });
  it("is a no-op on already-clean paths", () => {
    expect(normalizeVaultPath("Noteometry/attachments/x.png")).toBe("Noteometry/attachments/x.png");
  });
});

describe("saveImageBytesTo / savePdfBytesTo (portable paths)", () => {
  function makeFakeApp() {
    const writes: Array<{ path: string; bytes: ArrayBuffer }> = [];
    const dirs: string[] = [];
    const existing = new Set<string>();
    const app = {
      vault: {
        adapter: {
          async exists(p: string) { return existing.has(p); },
          async mkdir(p: string) { existing.add(p); dirs.push(p); },
          async writeBinary(p: string, b: ArrayBuffer) {
            writes.push({ path: p, bytes: b });
            existing.add(p);
          },
        },
      },
    };
    return { app: app as unknown as Parameters<typeof saveImageBytesTo>[0], writes, dirs };
  }

  // Minimum PNG header so the base64 decode in saveImageBytesTo accepts it.
  // 1x1 transparent PNG.
  const onePixelPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=";

  it("saves an image at a vault-relative path when the parent is the vault root", async () => {
    const { app, writes, dirs } = makeFakeApp();
    const out = await saveImageBytesTo(app, "", "abc-id", onePixelPng);
    expect(out).toBe("attachments/abc-id.png");
    expect(out.startsWith("/")).toBe(false);
    expect(dirs).toContain("attachments");
    expect(writes[0]!.path).toBe("attachments/abc-id.png");
  });

  it("nests attachments under the page's parent folder when present", async () => {
    const { app, writes } = makeFakeApp();
    const out = await saveImageBytesTo(app, "Noteometry/Fall 2025", "img42", onePixelPng);
    expect(out).toBe("Noteometry/Fall 2025/attachments/img42.png");
    expect(writes[0]!.path).toBe("Noteometry/Fall 2025/attachments/img42.png");
  });

  it("does not produce a leading slash for PDFs at the vault root", async () => {
    const { app } = makeFakeApp();
    const bytes = new ArrayBuffer(4);
    const out = await savePdfBytesTo(app, "", "pdf99", bytes);
    expect(out).toBe("attachments/pdf99.pdf");
    expect(out.startsWith("/")).toBe(false);
  });
});

describe("migratePageAssetsForPortability", () => {
  function makeFakeApp(opts: { canWrite?: boolean } = {}) {
    const canWrite = opts.canWrite ?? true;
    const writes: Array<{ path: string; bytes: ArrayBuffer }> = [];
    const existing = new Set<string>();
    const app = {
      vault: {
        adapter: {
          async exists(p: string) { return existing.has(p); },
          async mkdir(p: string) { existing.add(p); },
          async writeBinary(p: string, b: ArrayBuffer) {
            if (!canWrite) throw new Error("simulated write failure");
            writes.push({ path: p, bytes: b });
            existing.add(p);
          },
        },
      },
    };
    return { app: app as unknown as Parameters<typeof migratePageAssetsForPortability>[0], writes };
  }

  function makeFile(parentPath: string): TFile {
    const f = new TFile();
    f.path = `${parentPath}/Page.nmpage`.replace(/^\/+/, "");
    f.basename = "Page";
    f.extension = "nmpage";
    const parent = new TFolder();
    parent.path = parentPath;
    f.parent = parent;
    return f;
  }

  const onePixelPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=";

  function makeData(objects: CanvasData["canvasObjects"]): CanvasData {
    return {
      strokes: [],
      stamps: [],
      canvasObjects: objects,
      viewport: { scrollX: 0, scrollY: 0 },
      panelInput: "",
      chatMessages: [],
      tableData: {},
      textBoxData: {},
      lastSaved: "",
    };
  }

  it("rewrites leading-slash image paths to vault-relative paths", async () => {
    const { app } = makeFakeApp();
    const data = makeData([
      { id: "i1", type: "image", x: 0, y: 0, w: 10, h: 10, dataURL: "/attachments/i1.png" },
    ]);
    const res = await migratePageAssetsForPortability(app, makeFile("Noteometry"), data);
    expect(res.changed).toBe(true);
    expect(res.normalized).toBe(1);
    expect(res.inlined).toBe(0);
    expect(data.canvasObjects[0]).toMatchObject({ dataURL: "attachments/i1.png" });
  });

  it("rewrites leading-slash pdf fileRefs", async () => {
    const { app } = makeFakeApp();
    const data = makeData([
      { id: "p1", type: "pdf", x: 0, y: 0, w: 10, h: 10, fileRef: "/attachments/p1.pdf", page: 1 },
    ]);
    const res = await migratePageAssetsForPortability(app, makeFile("Noteometry"), data);
    expect(res.normalized).toBe(1);
    expect(data.canvasObjects[0]).toMatchObject({ fileRef: "attachments/p1.pdf" });
  });

  it("writes inline data: URL images into the vault and rewrites the ref", async () => {
    const { app, writes } = makeFakeApp();
    const data = makeData([
      { id: "img-1", type: "image", x: 0, y: 0, w: 10, h: 10, dataURL: onePixelPng },
    ]);
    const res = await migratePageAssetsForPortability(app, makeFile("Noteometry/Sub"), data);
    expect(res.inlined).toBe(1);
    expect(writes[0]!.path).toBe("Noteometry/Sub/attachments/img-1.png");
    expect(data.canvasObjects[0]).toMatchObject({
      dataURL: "Noteometry/Sub/attachments/img-1.png",
    });
  });

  it("keeps the inline data URL when the vault write fails (best-effort)", async () => {
    const { app } = makeFakeApp({ canWrite: false });
    const data = makeData([
      { id: "img-1", type: "image", x: 0, y: 0, w: 10, h: 10, dataURL: onePixelPng },
    ]);
    const res = await migratePageAssetsForPortability(app, makeFile("Noteometry"), data);
    expect(res.changed).toBe(false);
    expect(res.inlined).toBe(0);
    expect(data.canvasObjects[0]).toMatchObject({ dataURL: onePixelPng });
  });

  it("reports unchanged when all references are already portable", async () => {
    const { app } = makeFakeApp();
    const data = makeData([
      { id: "img-1", type: "image", x: 0, y: 0, w: 10, h: 10, dataURL: "Noteometry/attachments/img-1.png" },
      { id: "pdf-1", type: "pdf", x: 0, y: 0, w: 10, h: 10, fileRef: "Noteometry/attachments/pdf-1.pdf", page: 1 },
    ]);
    const res = await migratePageAssetsForPortability(app, makeFile("Noteometry"), data);
    expect(res.changed).toBe(false);
    expect(res.normalized).toBe(0);
    expect(res.inlined).toBe(0);
  });
});

// crypto.randomUUID needs to exist in the test environment for the inline
// migration path. Vitest provides Node's global crypto on 18+, but pin
// it here so the test fails loudly if the runtime is missing it.
describe("environment", () => {
  it("provides crypto.randomUUID", () => {
    expect(typeof globalThis.crypto?.randomUUID).toBe("function");
  });
});
