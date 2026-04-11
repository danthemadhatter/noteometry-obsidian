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

// Re-export so existing consumers don't have to change their imports.
export type { CanvasData } from "./pageFormat";
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
      .sort();
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
  if (await adapter.exists(path)) {
    const pages = await listPages(plugin, name);
    for (const p of pages) {
      await deletePage(plugin, name, p);
    }
    await adapter.rmdir(path, false);
  }
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
      .sort();
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

/* ── Migrate .attachments → attachments (dot-folders break sync) ── */

export async function migrateDotAttachments(plugin: NoteometryPlugin): Promise<void> {
  const root = rootDir(plugin);
  const adapter = plugin.app.vault.adapter;
  try {
    if (!(await adapter.exists(root))) return;
    const sections = await listSections(plugin);
    for (const section of sections) {
      const oldDir = `${root}/${section}/.attachments`;
      const newDir = `${root}/${section}/attachments`;

      // Move PNGs if the dot-folder exists
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

      // Rewrite any page JSON that references the old path
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
