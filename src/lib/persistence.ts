import { Notice } from "obsidian";
import type NoteometryPlugin from "../main";
import type { CanvasObject } from "./canvasObjects";
import {
  CanvasData,
  EMPTY_PAGE,
  packToV3,
  unpackFromV3,
  isV3Page,
} from "./pageFormat";
import type { TreeNode } from "./treeTypes";

// Re-export so existing consumers don't have to change their imports.
export type { CanvasData } from "./pageFormat";
export type { TreeNode } from "./treeTypes";
export {
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

function rootDir(plugin: NoteometryPlugin): string {
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
    // If both parts are numeric, compare numerically
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

/* ── Sections (folders) ──────────────────────────────── */

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
  // Recursive: the section folder contains an `attachments/` subfolder
  // with images/PDFs. A non-recursive rmdir fails silently if any child
  // remains, leaving the folder on disk — which then reappears in the
  // sidebar on next render and looks like "delete didn't work".
  await adapter.rmdir(path, true);
}

/* ── Pages (files) ───────────────────────────────────── */

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
      const parsed = JSON.parse(raw);

      // v3 format (current) — unpack elements[] to legacy in-memory shape
      if (isV3Page(parsed)) {
        return unpackFromV3(parsed);
      }

      // v2 format (pre-v3) — separate arrays + sidecar dictionaries
      if (parsed.version === 2 || Array.isArray(parsed.strokes)) {
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

      // v1 format (legacy Excalidraw) — keep text-only content
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
    // Always write v3 format to disk. v2 files load correctly because
    // loadPage has a v2 fallback, and get rewritten to v3 on next save.
    const v3 = packToV3(data);
    await adapter.write(path, JSON.stringify(v3, null, 0));
  } catch (e) {
    console.error("[Noteometry] save failed:", e);
    new Notice(`Failed to save "${section}/${name}" — changes may not persist (see console)`, 10000);
  }
}

/* ── Migrate .json → .md (Obsidian Sync only syncs .md) ── */

export async function migrateJsonToMd(plugin: NoteometryPlugin): Promise<void> {
  const root = rootDir(plugin);
  const adapter = plugin.app.vault.adapter;
  try {
    if (!(await adapter.exists(root))) return;
    // Walk the entire tree recursively so 3-level (course/week/page)
    // structures get migrated the same as legacy 2-level vaults.
    const walk = async (absDir: string): Promise<void> => {
      let listing;
      try { listing = await adapter.list(absDir); } catch { return; }
      for (const sub of listing.folders) {
        const name = sub.split("/").pop() ?? "";
        if (!name || name === ATTACHMENTS_FOLDER) continue;
        await walk(sub);
      }
      const jsonFiles = listing.files.filter((f) => f.endsWith(".json"));
      for (const jsonFile of jsonFiles) {
        const mdFile = jsonFile.replace(/\.json$/, ".md");
        if (!(await adapter.exists(mdFile))) {
          const data = await adapter.read(jsonFile);
          await adapter.write(mdFile, data);
        }
        await adapter.remove(jsonFile);
      }
    };
    await walk(root);
  } catch (e) {
    console.error("[Noteometry] json→md migration:", e);
    new Notice("Noteometry: .json → .md migration failed (see console)", 8000);
  }
}

/* ── Migrate .attachments → attachments (dot-folders break sync) ── */

export async function migrateDotAttachments(plugin: NoteometryPlugin): Promise<void> {
  const root = rootDir(plugin);
  const adapter = plugin.app.vault.adapter;
  try {
    if (!(await adapter.exists(root))) return;
    // Walk every folder under root, looking for `.attachments` siblings
    // of pages. Works for both 2-level (section/.attachments/) and any
    // deeper layout the tree sidebar may produce.
    const walk = async (absDir: string): Promise<void> => {
      let listing;
      try { listing = await adapter.list(absDir); } catch { return; }

      const oldDir = `${absDir}/.attachments`;
      const newDir = `${absDir}/${ATTACHMENTS_FOLDER}`;
      if (await adapter.exists(oldDir)) {
        if (!(await adapter.exists(newDir))) await adapter.mkdir(newDir);
        let oldListing;
        try { oldListing = await adapter.list(oldDir); } catch { oldListing = { files: [], folders: [] }; }
        for (const f of oldListing.files) {
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

      // Rewrite any .md sibling that references the old dot-path.
      for (const f of listing.files.filter((x) => x.endsWith(".md"))) {
        try {
          const raw = await adapter.read(f);
          if (raw.includes("/.attachments/")) {
            const fixed = raw.split("/.attachments/").join("/attachments/");
            await adapter.write(f, fixed);
          }
        } catch { /* ignore individual file errors */ }
      }

      for (const sub of listing.folders) {
        const name = sub.split("/").pop() ?? "";
        if (!name || name === ATTACHMENTS_FOLDER || name === ".attachments") continue;
        await walk(sub);
      }
    };
    await walk(root);
  } catch (e) {
    console.error("[Noteometry] dot-attachments migration:", e);
    new Notice("Noteometry: attachment folder migration failed (see console)", 8000);
  }
}

/* ── Image vault sync ───────────────────────────────── */

export async function saveImageToVault(
  plugin: NoteometryPlugin,
  sectionName: string,
  imageId: string,
  base64Data: string
): Promise<string> {
  const adapter = plugin.app.vault.adapter;
  const attachDir = `${rootDir(plugin)}/${sectionName}/attachments`;
  if (!(await adapter.exists(attachDir))) {
    await adapter.mkdir(attachDir);
  }
  // Strip data URL prefix
  const raw = base64Data.replace(/^data:image\/\w+;base64,/, "");
  // Convert base64 to ArrayBuffer
  const binary = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
  const vaultPath = `${attachDir}/${imageId}.png`;
  await adapter.writeBinary(vaultPath, binary.buffer as ArrayBuffer);
  return vaultPath;
}

export async function loadImageFromVault(
  plugin: NoteometryPlugin,
  vaultPath: string
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

/* ── PDF vault sync ─────────────────────────────────
 * PDFs live next to images in the section's attachments folder. We
 * store raw binary, not base64, because PDFs are typically too big
 * to serialize as data URLs. Loading returns an ArrayBuffer for
 * pdfjs-dist to consume directly. */

export async function savePdfToVault(
  plugin: NoteometryPlugin,
  sectionName: string,
  pdfId: string,
  bytes: ArrayBuffer
): Promise<string> {
  const adapter = plugin.app.vault.adapter;
  const attachDir = `${rootDir(plugin)}/${sectionName}/attachments`;
  if (!(await adapter.exists(attachDir))) {
    await adapter.mkdir(attachDir);
  }
  const vaultPath = `${attachDir}/${pdfId}.pdf`;
  await adapter.writeBinary(vaultPath, bytes);
  return vaultPath;
}

export async function loadPdfFromVault(
  plugin: NoteometryPlugin,
  vaultPath: string
): Promise<ArrayBuffer> {
  const adapter = plugin.app.vault.adapter;
  return await adapter.readBinary(vaultPath);
}

export async function migrateBase64Images(
  plugin: NoteometryPlugin,
  sectionName: string,
  canvasObjects: CanvasObject[]
): Promise<{ objects: CanvasObject[]; changed: boolean }> {
  let changed = false;
  const migrated: CanvasObject[] = [];
  for (const obj of canvasObjects) {
    if (obj.type === "image" && obj.dataURL.startsWith("data:")) {
      try {
        const imageId = obj.id;
        const vaultPath = await saveImageToVault(plugin, sectionName, imageId, obj.dataURL);
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

/* ── Path-based image / PDF helpers (v1.7.2) ───────────────
 * Mirror the section-keyed helpers above but resolve the attachments
 * folder from the page path (so a page nested inside a week folder
 * gets its own week-local attachments dir). */

export async function saveImageToVaultByPath(
  plugin: NoteometryPlugin,
  pagePath: string,
  imageId: string,
  base64Data: string
): Promise<string> {
  const adapter = plugin.app.vault.adapter;
  const attachDir = attachmentsDirForPage(plugin, pagePath);
  if (!(await adapter.exists(attachDir))) {
    await adapter.mkdir(attachDir);
  }
  const raw = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const binary = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
  const vaultPath = `${attachDir}/${imageId}.png`;
  await adapter.writeBinary(vaultPath, binary.buffer as ArrayBuffer);
  return vaultPath;
}

export async function savePdfToVaultByPath(
  plugin: NoteometryPlugin,
  pagePath: string,
  pdfId: string,
  bytes: ArrayBuffer
): Promise<string> {
  const adapter = plugin.app.vault.adapter;
  const attachDir = attachmentsDirForPage(plugin, pagePath);
  if (!(await adapter.exists(attachDir))) {
    await adapter.mkdir(attachDir);
  }
  const vaultPath = `${attachDir}/${pdfId}.pdf`;
  await adapter.writeBinary(vaultPath, bytes);
  return vaultPath;
}

export async function migrateBase64ImagesByPath(
  plugin: NoteometryPlugin,
  pagePath: string,
  canvasObjects: CanvasObject[]
): Promise<{ objects: CanvasObject[]; changed: boolean }> {
  let changed = false;
  const migrated: CanvasObject[] = [];
  for (const obj of canvasObjects) {
    if (obj.type === "image" && obj.dataURL.startsWith("data:")) {
      try {
        const vaultPath = await saveImageToVaultByPath(plugin, pagePath, obj.id, obj.dataURL);
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

/* ── Path-based API (v1.7.2 tree sidebar) ────────────────
 * The legacy 2-level (section, page) helpers above are kept intact for
 * back-compat during the SidebarTree migration. New code should use
 * these path-based functions, which speak in vault-folder-relative
 * paths like "Calc III/Week 1/Page 1" (no .md suffix in the API).
 *
 * Folders named "attachments" hold images/PDFs and are intentionally
 * filtered out of the navigable tree. */

const ATTACHMENTS_FOLDER = "attachments";

function vaultPathForPage(plugin: NoteometryPlugin, path: string): string {
  return `${rootDir(plugin)}/${path}.md`;
}

function vaultPathForFolder(plugin: NoteometryPlugin, path: string): string {
  return path ? `${rootDir(plugin)}/${path}` : rootDir(plugin);
}

/** Recursively list the entire Noteometry tree under the vault root.
 *  Skips `attachments/` folders. Sorts folders before pages, each group
 *  in natural order ("Week 2" before "Week 10"). Returns [] for an empty
 *  or missing root. */
export async function listTree(plugin: NoteometryPlugin): Promise<TreeNode[]> {
  const root = rootDir(plugin);
  const adapter = plugin.app.vault.adapter;
  try {
    if (!(await adapter.exists(root))) {
      await adapter.mkdir(root);
      return [];
    }
  } catch {
    return [];
  }

  const walk = async (absDir: string, relPath: string, depth: number): Promise<TreeNode[]> => {
    let listing;
    try {
      listing = await adapter.list(absDir);
    } catch {
      return [];
    }

    const folderNodes: TreeNode[] = [];
    for (const folder of listing.folders) {
      const name = folder.split("/").pop() ?? "";
      if (!name || name === ATTACHMENTS_FOLDER) continue;
      const childRel = relPath ? `${relPath}/${name}` : name;
      const children = await walk(folder, childRel, depth + 1);
      folderNodes.push({
        name,
        path: childRel,
        kind: "folder",
        depth,
        children,
      });
    }

    const pageNodes: TreeNode[] = [];
    for (const file of listing.files) {
      if (!file.endsWith(".md")) continue;
      const fileName = file.split("/").pop() ?? "";
      const baseName = fileName.replace(/\.md$/, "");
      if (!baseName) continue;
      const childRel = relPath ? `${relPath}/${baseName}` : baseName;
      pageNodes.push({
        name: baseName,
        path: childRel,
        kind: "page",
        depth,
      });
    }

    folderNodes.sort((a, b) => naturalCompare(a.name, b.name));
    pageNodes.sort((a, b) => naturalCompare(a.name, b.name));
    return [...folderNodes, ...pageNodes];
  };

  return walk(root, "", 0);
}

export async function loadPageByPath(
  plugin: NoteometryPlugin,
  path: string
): Promise<CanvasData> {
  const adapter = plugin.app.vault.adapter;
  const filePath = vaultPathForPage(plugin, path);
  try {
    if (await adapter.exists(filePath)) {
      const raw = await adapter.read(filePath);
      const parsed = JSON.parse(raw);

      if (isV3Page(parsed)) {
        return unpackFromV3(parsed);
      }

      if (parsed.version === 2 || Array.isArray(parsed.strokes)) {
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
  } catch (e) {
    console.error("[Noteometry] load failed:", e);
    new Notice(`Failed to load "${path}" — file may be corrupt (see console)`, 10000);
  }
  return { ...EMPTY_PAGE };
}

export async function savePageByPath(
  plugin: NoteometryPlugin,
  path: string,
  data: CanvasData
): Promise<void> {
  const adapter = plugin.app.vault.adapter;
  try {
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const parentAbs = vaultPathForFolder(plugin, parent);
    if (!(await adapter.exists(parentAbs))) {
      await adapter.mkdir(parentAbs);
    }
    const filePath = vaultPathForPage(plugin, path);
    const v3 = packToV3(data);
    await adapter.write(filePath, JSON.stringify(v3, null, 0));
  } catch (e) {
    console.error("[Noteometry] save failed:", e);
    new Notice(`Failed to save "${path}" — changes may not persist (see console)`, 10000);
  }
}

/** Create an empty page at `${dirPath}/${name}.md`. dirPath="" means
 *  the page sits directly under the vault folder root. */
export async function createPageAt(
  plugin: NoteometryPlugin,
  dirPath: string,
  name: string
): Promise<string> {
  const adapter = plugin.app.vault.adapter;
  const dirAbs = vaultPathForFolder(plugin, dirPath);
  if (!(await adapter.exists(dirAbs))) {
    await adapter.mkdir(dirAbs);
  }
  const path = dirPath ? `${dirPath}/${name}` : name;
  const filePath = vaultPathForPage(plugin, path);
  if (!(await adapter.exists(filePath))) {
    const empty: CanvasData = { ...EMPTY_PAGE, lastSaved: new Date().toISOString() };
    const v3 = packToV3(empty);
    await adapter.write(filePath, JSON.stringify(v3, null, 0));
  }
  return path;
}

/** Create an empty folder at `${parentPath}/${name}`. parentPath="" means
 *  a top-level folder directly under the vault root. */
export async function createFolderAt(
  plugin: NoteometryPlugin,
  parentPath: string,
  name: string
): Promise<string> {
  const adapter = plugin.app.vault.adapter;
  const path = parentPath ? `${parentPath}/${name}` : name;
  const folderAbs = vaultPathForFolder(plugin, path);
  if (!(await adapter.exists(folderAbs))) {
    await adapter.mkdir(folderAbs);
  }
  return path;
}

/** Rename a node (page or folder). For pages, oldPath/newPath are the
 *  paths WITHOUT the .md suffix. For folders, recursively rewrites
 *  child page contents that referenced the old attachments folder. */
export async function renameNode(
  plugin: NoteometryPlugin,
  oldPath: string,
  newPath: string,
  kind: "folder" | "page"
): Promise<void> {
  const adapter = plugin.app.vault.adapter;
  if (oldPath === newPath) return;

  if (kind === "page") {
    const oldAbs = vaultPathForPage(plugin, oldPath);
    const newAbs = vaultPathForPage(plugin, newPath);
    if (!(await adapter.exists(oldAbs))) return;
    const data = await adapter.read(oldAbs);
    await adapter.write(newAbs, data);
    await adapter.remove(oldAbs);
    return;
  }

  // Folder rename: copy whole subtree, then drop the old folder.
  const oldAbs = vaultPathForFolder(plugin, oldPath);
  const newAbs = vaultPathForFolder(plugin, newPath);
  if (!(await adapter.exists(oldAbs))) return;
  if (!(await adapter.exists(newAbs))) await adapter.mkdir(newAbs);

  const copyDir = async (src: string, dst: string): Promise<void> => {
    const listing = await adapter.list(src);
    for (const sub of listing.folders) {
      const subName = sub.split("/").pop() ?? "";
      if (!subName) continue;
      const dstSub = `${dst}/${subName}`;
      if (!(await adapter.exists(dstSub))) await adapter.mkdir(dstSub);
      await copyDir(sub, dstSub);
    }
    for (const file of listing.files) {
      const fileName = file.split("/").pop() ?? "";
      if (!fileName) continue;
      const target = `${dst}/${fileName}`;
      // Binary-safe copy. .md files round-trip through readBinary too.
      const buf = await adapter.readBinary(file);
      await adapter.writeBinary(target, buf);
      await adapter.remove(file);
    }
    try { await adapter.rmdir(src, false); } catch { /* best-effort */ }
  };
  await copyDir(oldAbs, newAbs);
  try { await adapter.rmdir(oldAbs, false); } catch { /* best-effort */ }
}

/** Delete a node. For folders, removes recursively (including any
 *  attachments subfolder). */
export async function deleteNode(
  plugin: NoteometryPlugin,
  path: string,
  kind: "folder" | "page"
): Promise<void> {
  const adapter = plugin.app.vault.adapter;
  if (kind === "page") {
    const filePath = vaultPathForPage(plugin, path);
    if (await adapter.exists(filePath)) {
      await adapter.remove(filePath);
    }
    return;
  }
  const folderAbs = vaultPathForFolder(plugin, path);
  if (await adapter.exists(folderAbs)) {
    await adapter.rmdir(folderAbs, true);
  }
}

/** Resolve the attachments folder for a given page path. The folder is
 *  always a sibling of the page file: `${dirname(path)}/attachments`. */
export function attachmentsDirForPage(plugin: NoteometryPlugin, pagePath: string): string {
  const parent = pagePath.includes("/") ? pagePath.slice(0, pagePath.lastIndexOf("/")) : "";
  const parentAbs = vaultPathForFolder(plugin, parent);
  return `${parentAbs}/${ATTACHMENTS_FOLDER}`;
}

/* ── Legacy migration ────────────────────────────────── */

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
