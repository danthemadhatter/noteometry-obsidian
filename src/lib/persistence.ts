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

export function rootDir(plugin: NoteometryPlugin): string {
  return plugin.settings.vaultFolder || "Noteometry";
}

/** Natural sort comparator — "Week 2" before "Week 10". */
function naturalCompare(a: string, b: string): number {
  const ax = a.split(/(\d+)/);
  const bx = b.split(/(\d+)/);
  const len = Math.min(ax.length, bx.length);
  for (let i = 0; i < len; i++) {
    const aPart = ax[i]!;
    const bPart = bx[i]!;
    if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
      const diff = parseInt(aPart, 10) - parseInt(bPart, 10);
      if (diff !== 0) return diff;
    } else {
      const cmp = aPart.localeCompare(bPart, undefined, { sensitivity: "base" });
      if (cmp !== 0) return cmp;
    }
  }
  return ax.length - bx.length;
}

function sectionPath(plugin: NoteometryPlugin, section: string): string {
  return `${rootDir(plugin)}/${section}`;
}

function pagePath(plugin: NoteometryPlugin, section: string, page: string): string {
  return `${rootDir(plugin)}/${section}/${page}.md`;
}

/* ══════════════════════════════════════════════════════════════════
 * Legacy folder-relative API (section/page)
 *
 * Retained while Sidebar + usePages are still in the tree. The new
 * file-bound API below is the target of the tier 3 refactor and
 * replaces this layer once the Sidebar is dropped.
 * ══════════════════════════════════════════════════════════════════ */

export async function listSections(plugin: NoteometryPlugin): Promise<string[]> {
  const root = rootDir(plugin);
  const adapter = plugin.app.vault.adapter;
  try {
    if (!(await adapter.exists(root))) {
      await adapter.mkdir(root);
    }
    const listing = await adapter.list(root);
    return listing.folders
      .map((f) => f.split("/").pop() ?? "")
      .filter((n) => n.length > 0)
      .sort(naturalCompare);
  } catch {
    return [];
  }
}

export async function createSection(plugin: NoteometryPlugin, name: string): Promise<void> {
  const path = sectionPath(plugin, name);
  const adapter = plugin.app.vault.adapter;
  if (!(await adapter.exists(path))) {
    await adapter.mkdir(path);
  }
}

export async function deleteSection(plugin: NoteometryPlugin, name: string): Promise<void> {
  const path = sectionPath(plugin, name);
  const adapter = plugin.app.vault.adapter;
  if (!(await adapter.exists(path))) return;
  await adapter.rmdir(path, true);
}

export async function listPages(plugin: NoteometryPlugin, section: string): Promise<string[]> {
  const path = sectionPath(plugin, section);
  const adapter = plugin.app.vault.adapter;
  try {
    if (!(await adapter.exists(path))) return [];
    const listing = await adapter.list(path);
    return listing.files
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const name = f.split("/").pop() ?? "";
        return name.replace(/\.md$/, "");
      })
      .sort(naturalCompare);
  } catch {
    return [];
  }
}

export async function createPage(
  plugin: NoteometryPlugin,
  section: string,
  name: string
): Promise<void> {
  const path = pagePath(plugin, section, name);
  const adapter = plugin.app.vault.adapter;
  if (!(await adapter.exists(path))) {
    const empty: CanvasData = { ...EMPTY_PAGE, lastSaved: new Date().toISOString() };
    const v3 = packToV3(empty);
    await adapter.write(path, JSON.stringify(v3, null, 0));
  }
}

export async function deletePage(
  plugin: NoteometryPlugin,
  section: string,
  name: string
): Promise<void> {
  const path = pagePath(plugin, section, name);
  const adapter = plugin.app.vault.adapter;
  if (await adapter.exists(path)) {
    await adapter.remove(path);
  }
}

export async function loadPage(
  plugin: NoteometryPlugin,
  section: string,
  name: string
): Promise<CanvasData> {
  const path = pagePath(plugin, section, name);
  const adapter = plugin.app.vault.adapter;
  try {
    if (await adapter.exists(path)) {
      const raw = await adapter.read(path);
      const decoded = parsePageContent(raw);
      if (decoded) return decoded;
    }
  } catch (e) {
    console.error("[Noteometry] load failed:", e);
    new Notice(`Failed to load "${section}/${name}" — file may be corrupt (see console)`, 10000);
  }
  return { ...EMPTY_PAGE };
}

export async function savePage(
  plugin: NoteometryPlugin,
  section: string,
  name: string,
  data: CanvasData
): Promise<void> {
  try {
    const secPath = sectionPath(plugin, section);
    const adapter = plugin.app.vault.adapter;
    if (!(await adapter.exists(secPath))) {
      await adapter.mkdir(secPath);
    }
    const path = pagePath(plugin, section, name);
    const v3 = packToV3(data);
    await adapter.write(path, JSON.stringify(v3, null, 0));
  } catch (e) {
    console.error("[Noteometry] save failed:", e);
    new Notice(`Failed to save "${section}/${name}" — changes may not persist (see console)`, 10000);
  }
}

/* ── Legacy migrations (pre-tier3) — kept for first-run bootstrap in usePages. ── */

export async function migrateJsonToMd(plugin: NoteometryPlugin): Promise<void> {
  const root = rootDir(plugin);
  const adapter = plugin.app.vault.adapter;
  try {
    if (!(await adapter.exists(root))) return;
    const sections = await listSections(plugin);
    for (const section of sections) {
      const secPath = sectionPath(plugin, section);
      const listing = await adapter.list(secPath);
      const jsonFiles = listing.files.filter((f) => f.endsWith(".json"));
      for (const jsonFile of jsonFiles) {
        const mdFile = jsonFile.replace(/\.json$/, ".md");
        if (!(await adapter.exists(mdFile))) {
          const data = await adapter.read(jsonFile);
          await adapter.write(mdFile, data);
        }
        await adapter.remove(jsonFile);
      }
    }
  } catch (e) {
    console.error("[Noteometry] json→md migration:", e);
    new Notice("Noteometry: .json → .md migration failed (see console)", 8000);
  }
}

export async function migrateDotAttachments(plugin: NoteometryPlugin): Promise<void> {
  const root = rootDir(plugin);
  const adapter = plugin.app.vault.adapter;
  try {
    if (!(await adapter.exists(root))) return;
    const sections = await listSections(plugin);
    for (const section of sections) {
      const oldDir = `${root}/${section}/.attachments`;
      const newDir = `${root}/${section}/attachments`;

      if (await adapter.exists(oldDir)) {
        if (!(await adapter.exists(newDir))) await adapter.mkdir(newDir);
        const listing = await adapter.list(oldDir);
        for (const f of listing.files) {
          const name = f.split("/").pop() ?? "";
          const target = `${newDir}/${name}`;
          if (!(await adapter.exists(target))) {
            const buf = await adapter.readBinary(f);
            await adapter.writeBinary(target, buf);
          }
          await adapter.remove(f);
        }
        try { await adapter.rmdir(oldDir, false); } catch { /* ignore */ }
      }

      const secPath = `${root}/${section}`;
      if (await adapter.exists(secPath)) {
        const listing = await adapter.list(secPath);
        for (const f of listing.files.filter((x) => x.endsWith(".md"))) {
          try {
            const raw = await adapter.read(f);
            if (raw.includes("/.attachments/")) {
              const fixed = raw.split("/.attachments/").join("/attachments/");
              await adapter.write(f, fixed);
            }
          } catch { /* ignore individual file errors */ }
        }
      }
    }
  } catch (e) {
    console.error("[Noteometry] dot-attachments migration:", e);
    new Notice("Noteometry: attachment folder migration failed (see console)", 8000);
  }
}

export async function migrateLegacy(plugin: NoteometryPlugin): Promise<{ section: string; page: string } | null> {
  const dir = plugin.manifest.dir ?? `.obsidian/plugins/${plugin.manifest.id}`;
  const legacyPath = `${dir}/canvas.md`;
  const adapter = plugin.app.vault.adapter;
  try {
    if (await adapter.exists(legacyPath)) {
      const raw = await adapter.read(legacyPath);
      const parsed = JSON.parse(raw);
      const section = "General";
      const page = "Untitled";
      await createSection(plugin, section);
      const data: CanvasData = {
        version: 2,
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
      await savePage(plugin, section, page, data);
      await adapter.remove(legacyPath);
      return { section, page };
    }
  } catch {
    // ignore
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════
 * File-bound page I/O (tier 3 native explorer)
 *
 * Each open page is a FileView bound to a single .nmpage TFile. These
 * replace loadPage / savePage once the internal Sidebar is dropped.
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

export async function savePageToFile(app: App, file: TFile, data: CanvasData): Promise<void> {
  try {
    const v3 = packToV3(data);
    await app.vault.modify(file, JSON.stringify(v3, null, 0));
  } catch (e) {
    console.error("[Noteometry] save failed:", e);
    new Notice(`Failed to save "${file.path}" — changes may not persist (see console)`, 10000);
  }
}

/** Heuristic: does a .md file's content decode as a v3 Noteometry page?
 *  Used by the "Convert legacy .md pages" command — we only rename files
 *  whose first JSON.parse yields a v3 page so we never touch real markdown. */
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
 * Scan `rootFolder` recursively for .md files whose content decodes as
 * a v3 Noteometry page and rename them to .nmpage. Returns the count.
 * No backups — caller has confirmed test data only.
 */
export async function convertLegacyMdPagesToNmpage(
  app: App,
  rootFolder: string,
): Promise<number> {
  const root = app.vault.getAbstractFileByPath(rootFolder);
  if (!(root instanceof TFolder)) return 0;

  const candidates: TFile[] = [];
  const walk = (folder: TFolder) => {
    for (const child of folder.children) {
      if (child instanceof TFolder) walk(child);
      else if (child instanceof TFile && child.extension === "md") candidates.push(child);
    }
  };
  walk(root);

  let converted = 0;
  for (const file of candidates) {
    try {
      const raw = await app.vault.read(file);
      if (!isLegacyNoteometryMdContent(raw)) continue;
      const parentPath = file.parent?.path ?? "";
      const newPath = parentPath ? `${parentPath}/${file.basename}.nmpage` : `${file.basename}.nmpage`;
      if (app.vault.getAbstractFileByPath(newPath)) continue; // collision — skip silently
      await app.vault.rename(file, newPath);
      converted += 1;
    } catch (e) {
      console.error(`[Noteometry] convert failed for ${file.path}:`, e);
    }
  }
  return converted;
}

/* ══════════════════════════════════════════════════════════════════
 * Attachment I/O (images + PDFs)
 *
 * In the tier 3 native explorer model, drop-in binaries are scoped to
 * the bound page file's parent folder so a single "attachments/" sibling
 * holds everything for every .nmpage in that folder. The legacy
 * section-string-based entry points are kept as thin wrappers while
 * Sidebar/usePages still exist.
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

/** Legacy signature (section-named). Kept while Sidebar/usePages still
 *  drive drop-in asset writes. */
export async function saveImageToVault(
  plugin: NoteometryPlugin,
  sectionName: string,
  imageId: string,
  base64Data: string,
): Promise<string> {
  const parent = `${rootDir(plugin)}/${sectionName}`;
  return saveImageBytesTo(plugin.app, parent, imageId, base64Data);
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

export async function savePdfToVault(
  plugin: NoteometryPlugin,
  sectionName: string,
  pdfId: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const parent = `${rootDir(plugin)}/${sectionName}`;
  return savePdfBytesTo(plugin.app, parent, pdfId, bytes);
}

export async function loadPdfFromVault(
  plugin: NoteometryPlugin,
  vaultPath: string,
): Promise<ArrayBuffer> {
  const adapter = plugin.app.vault.adapter;
  return await adapter.readBinary(vaultPath);
}

export async function migrateBase64Images(
  plugin: NoteometryPlugin,
  sectionName: string,
  canvasObjects: CanvasObject[],
): Promise<{ objects: CanvasObject[]; changed: boolean }> {
  let changed = false;
  const migrated: CanvasObject[] = [];
  for (const obj of canvasObjects) {
    if (obj.type === "image" && obj.dataURL.startsWith("data:")) {
      try {
        const vaultPath = await saveImageToVault(plugin, sectionName, obj.id, obj.dataURL);
        migrated.push({ ...obj, dataURL: vaultPath });
        changed = true;
      } catch (e) {
        console.error("[Noteometry] image migration failed:", e);
        migrated.push(obj);
      }
    } else {
      migrated.push(obj);
    }
  }
  return { objects: migrated, changed };
}
