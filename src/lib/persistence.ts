import { App, Notice, TFile, TFolder } from "obsidian";
import type NoteometryPlugin from "../main";
import type { CanvasObject } from "./canvasObjects";
import {
  CanvasData,
  EMPTY_PAGE,
  packToV3,
  unpackFromV3,
  isV3Page,
} from "./pageFormat";

// Re-export so existing consumers don't have to change their imports.
export type { CanvasData } from "./pageFormat";
export {
  EMPTY_PAGE,
  packToV3,
  unpackFromV3,
  isV3Page,
} from "./pageFormat";
export type {
  NoteometryPageV3,
  PageElementV3,
  StrokeElementV3,
  StampElementV3,
  TextboxElementV3,
  TableElementV3,
  ImageElementV3,
} from "./pageFormat";

/** Default root folder used by the "New page" command when no other
 *  parent folder is implied by the active file. */
export function rootDir(plugin: NoteometryPlugin): string {
  return plugin.settings.vaultFolder || "Noteometry";
}

/* ══════════════════════════════════════════════════════════════════
 * File-bound page I/O (tier 3 native explorer)
 *
 * Each open page is a FileView bound to a single .nmpage TFile.
 * Obsidian's own file explorer is the page navigator.
 * ══════════════════════════════════════════════════════════════════ */

/** Decode raw page contents (any format) to CanvasData, or null if the
 *  content isn't a recognizable Noteometry page. */
export function parsePageContent(raw: string): CanvasData | null {
  try {
    const parsed = JSON.parse(raw);
    if (isV3Page(parsed)) {
      return unpackFromV3(parsed);
    }
    if (parsed && typeof parsed === "object" && (parsed.version === 2 || Array.isArray(parsed.strokes))) {
      return {
        strokes: parsed.strokes ?? [],
        stamps: parsed.stamps ?? [],
        canvasObjects: parsed.canvasObjects ?? [],
        viewport: parsed.viewport ?? { scrollX: 0, scrollY: 0 },
        panelInput: parsed.panelInput ?? "",
        chatMessages: parsed.chatMessages ?? [],
        tableData: parsed.tableData ?? {},
        textBoxData: parsed.textBoxData ?? {},
        lastSaved: parsed.lastSaved ?? "",
      };
    }
    if (parsed && typeof parsed === "object") {
      return {
        strokes: [],
        stamps: [],
        canvasObjects: [],
        viewport: { scrollX: 0, scrollY: 0 },
        panelInput: parsed.panelInput ?? "",
        chatMessages: parsed.chatMessages ?? [],
        tableData: parsed.tableData ?? {},
        textBoxData: parsed.textBoxData ?? {},
        lastSaved: parsed.lastSaved ?? "",
      };
    }
  } catch {
    // fall through
  }
  return null;
}

/** Read the given TFile and return CanvasData. Returns EMPTY_PAGE for an
 *  empty file; returns null if the content isn't a recognizable Noteometry
 *  page so the caller can surface an error. */
export async function loadPageFromFile(app: App, file: TFile): Promise<CanvasData | null> {
  try {
    const raw = await app.vault.read(file);
    if (!raw.trim()) {
      return { ...EMPTY_PAGE };
    }
    return parsePageContent(raw);
  } catch (e) {
    console.error("[Noteometry] load failed:", e);
    new Notice(`Failed to load "${file.path}" — file may be corrupt (see console)`, 10000);
    return null;
  }
}

/** Serialize CanvasData (as v3) and write to the given TFile. */
export async function savePageToFile(app: App, file: TFile, data: CanvasData): Promise<void> {
  try {
    const v3 = packToV3(data);
    await app.vault.modify(file, JSON.stringify(v3, null, 0));
  } catch (e) {
    console.error("[Noteometry] save failed:", e);
    new Notice(`Failed to save "${file.path}" — changes may not persist (see console)`, 10000);
  }
}

/* ══════════════════════════════════════════════════════════════════
 * v1.14.5 emergency recovery cache
 *
 * Async vault writes can be killed mid-flight when the user X's a tab,
 * force-reloads, or quits Obsidian. The Promise chain dies and bytes
 * never reach disk. To survive that, we synchronously stash the
 * about-to-be-written v3 JSON in localStorage BEFORE the async vault
 * write, and remove it after the write resolves. On the next
 * onLoadFile, we check for a stranded cache entry and recover it.
 *
 * localStorage is synchronous and persists across Electron renderer
 * reloads, so it survives the exact failure modes vault.modify can't.
 * Cache key is the file's vault path so multiple open pages don't collide.
 * Quota errors are swallowed — recovery is best-effort, not a contract.
 * ══════════════════════════════════════════════════════════════════ */

const RECOVERY_PREFIX = "nm:cache:";

function safeLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch { /* iframes / sandboxed contexts can throw on access */ }
  return null;
}

export function cachePageDataSync(filePath: string, packedJson: string): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try { ls.setItem(RECOVERY_PREFIX + filePath, packedJson); } catch { /* quota */ }
}

export function getCachedPageData(filePath: string): string | null {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try { return ls.getItem(RECOVERY_PREFIX + filePath); } catch { return null; }
}

export function clearPageCache(filePath: string): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try { ls.removeItem(RECOVERY_PREFIX + filePath); } catch { /* ignore */ }
}

/** Heuristic: does a .md file's content decode as a v3 Noteometry page?
 *  Used by the "Convert legacy .md pages" command — we only rename files
 *  whose first JSON.parse yields a v3 page, so real markdown is never
 *  touched. */
export function isLegacyNoteometryMdContent(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw);
    return isV3Page(parsed);
  } catch {
    return false;
  }
}

/**
 * Create a new empty .nmpage file under `parentFolderPath`, picking a
 * non-colliding filename. Returns the created TFile (or null on failure).
 */
export async function createNewPageFile(
  app: App,
  parentFolderPath: string,
  baseName = "Untitled",
): Promise<TFile | null> {
  try {
    // Ensure the folder exists.
    let folder = app.vault.getAbstractFileByPath(parentFolderPath);
    if (!folder) {
      folder = await app.vault.createFolder(parentFolderPath);
    }
    if (!(folder instanceof TFolder)) {
      new Notice(`Can't create Noteometry page: "${parentFolderPath}" is not a folder.`, 8000);
      return null;
    }

    const base = parentFolderPath.replace(/\/+$/, "");
    let name = `${baseName}.nmpage`;
    let n = 1;
    const candidate = () => (base ? `${base}/${name}` : name);
    while (app.vault.getAbstractFileByPath(candidate())) {
      name = `${baseName} ${n}.nmpage`;
      n += 1;
    }

    const empty: CanvasData = { ...EMPTY_PAGE, lastSaved: new Date().toISOString() };
    const v3 = packToV3(empty);
    return await app.vault.create(candidate(), JSON.stringify(v3, null, 0));
  } catch (e) {
    console.error("[Noteometry] create page failed:", e);
    new Notice("Couldn't create new Noteometry page — see console.", 8000);
    return null;
  }
}

/**
 * Scan `rootFolder` recursively and return every .md file whose content
 * decodes as a v3 Noteometry page. Non-destructive — caller decides
 * whether to rename, count for a banner, etc.
 */
export async function findLegacyMdPages(
  app: App,
  rootFolder: string,
): Promise<TFile[]> {
  const root = app.vault.getAbstractFileByPath(rootFolder);
  if (!(root instanceof TFolder)) return [];

  const candidates: TFile[] = [];
  const walk = (folder: TFolder) => {
    for (const child of folder.children) {
      if (child instanceof TFolder) walk(child);
      else if (child instanceof TFile && child.extension === "md") candidates.push(child);
    }
  };
  walk(root);

  const legacy: TFile[] = [];
  for (const file of candidates) {
    try {
      const raw = await app.vault.read(file);
      if (isLegacyNoteometryMdContent(raw)) legacy.push(file);
    } catch (e) {
      console.error(`[Noteometry] legacy-scan read failed for ${file.path}:`, e);
    }
  }
  return legacy;
}

/**
 * Rename legacy .md pages in `rootFolder` to .nmpage. Every legacy file is
 * always renamed — if `Foo.nmpage` already exists, the legacy `Foo.md` is
 * renamed to `Foo 1.nmpage` (or the next free suffix) so the convert always
 * finishes. Otherwise a stale `.md` would survive on disk and the
 * legacy-page notice would re-fire on every plugin load. Returns counts of
 * direct renames and suffixed renames so the caller can summarize.
 * No backups — caller has confirmed test data only.
 */
export async function convertLegacyMdPagesToNmpage(
  app: App,
  rootFolder: string,
): Promise<{ converted: number; collisions: number }> {
  const legacy = await findLegacyMdPages(app, rootFolder);

  let converted = 0;
  let collisions = 0;
  for (const file of legacy) {
    try {
      const parentPath = file.parent?.path ?? "";
      const baseTarget = parentPath
        ? `${parentPath}/${file.basename}.nmpage`
        : `${file.basename}.nmpage`;
      let target = baseTarget;
      if (app.vault.getAbstractFileByPath(target)) {
        // Name collision with an existing .nmpage. Find the next free
        // numeric suffix so the rename still happens — silently skipping
        // would leave the .md on disk and the legacy notice would loop.
        const stem = parentPath
          ? `${parentPath}/${file.basename}`
          : file.basename;
        let n = 1;
        while (app.vault.getAbstractFileByPath(`${stem} ${n}.nmpage`)) n += 1;
        target = `${stem} ${n}.nmpage`;
        collisions += 1;
        console.warn(
          `[Noteometry] legacy convert: ${file.path} collides with ${baseTarget}, renaming to ${target}`,
        );
      }
      await app.vault.rename(file, target);
      converted += 1;
    } catch (e) {
      console.error(`[Noteometry] convert failed for ${file.path}:`, e);
    }
  }
  return { converted, collisions };
}

/* ══════════════════════════════════════════════════════════════════
 * Attachment I/O (images + PDFs)
 *
 * Drop-in binaries live in an "attachments/" folder next to the bound
 * page file. Callers pass the page's parent folder path explicitly.
 * ══════════════════════════════════════════════════════════════════ */

async function ensureDir(app: App, dir: string): Promise<void> {
  const adapter = app.vault.adapter;
  if (!(await adapter.exists(dir))) {
    await adapter.mkdir(dir);
  }
}

export async function saveImageBytesTo(
  app: App,
  parentFolder: string,
  imageId: string,
  base64Data: string,
): Promise<string> {
  const attachDir = `${parentFolder}/attachments`;
  await ensureDir(app, attachDir);
  const raw = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const binary = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
  const vaultPath = `${attachDir}/${imageId}.png`;
  await app.vault.adapter.writeBinary(vaultPath, binary.buffer as ArrayBuffer);
  return vaultPath;
}

export async function savePdfBytesTo(
  app: App,
  parentFolder: string,
  pdfId: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const attachDir = `${parentFolder}/attachments`;
  await ensureDir(app, attachDir);
  const vaultPath = `${attachDir}/${pdfId}.pdf`;
  await app.vault.adapter.writeBinary(vaultPath, bytes);
  return vaultPath;
}

export async function loadImageFromVault(
  plugin: NoteometryPlugin,
  vaultPath: string,
): Promise<string> {
  const adapter = plugin.app.vault.adapter;
  const buf = await adapter.readBinary(vaultPath);
  const bytes = new Uint8Array(buf);
  let binaryStr = "";
  for (let i = 0; i < bytes.length; i++) {
    binaryStr += String.fromCharCode(bytes[i]!);
  }
  const b64 = btoa(binaryStr);
  return `data:image/png;base64,${b64}`;
}

export async function loadPdfFromVault(
  plugin: NoteometryPlugin,
  vaultPath: string,
): Promise<ArrayBuffer> {
  const adapter = plugin.app.vault.adapter;
  return await adapter.readBinary(vaultPath);
}
