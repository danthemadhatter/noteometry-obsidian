import type NoteometryPlugin from "../main";
import type { ChatMessage } from "../types";
import type { Stroke, Stamp } from "./inkEngine";
import type { CanvasObject } from "./canvasObjects";

export interface CanvasData {
  version?: number;
  strokes: Stroke[];
  stamps: Stamp[];
  canvasObjects: CanvasObject[];
  viewport: { scrollX: number; scrollY: number };
  panelInput: string;
  chatMessages: ChatMessage[];
  tableData: Record<string, string[][]>;
  textBoxData: Record<string, string>;
  lastSaved: string;
  // Legacy fields (read-only, for migration)
  excalidrawElements?: unknown[];
}

const EMPTY_PAGE: CanvasData = {
  version: 2,
  strokes: [],
  stamps: [],
  canvasObjects: [],
  viewport: { scrollX: 0, scrollY: 0 },
  panelInput: "",
  chatMessages: [],
  tableData: {},
  textBoxData: {},
  lastSaved: "",
};

function rootDir(plugin: NoteometryPlugin): string {
  return plugin.settings.vaultFolder || "Noteometry";
}

function sectionPath(plugin: NoteometryPlugin, section: string): string {
  return `${rootDir(plugin)}/${section}`;
}

function pagePath(plugin: NoteometryPlugin, section: string, page: string): string {
  return `${rootDir(plugin)}/${section}/${page}.json`;
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
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const name = f.split("/").pop() ?? "";
        return name.replace(/\.json$/, "");
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
    await adapter.write(path, JSON.stringify({ ...EMPTY_PAGE, lastSaved: new Date().toISOString() }, null, 0));
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

      // v2 format (new ink engine)
      if (parsed.version === 2 || parsed.strokes) {
        return {
          version: 2,
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

      // v1 format (Excalidraw) — migrate what we can
      return {
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
    }
  } catch (e) {
    console.error("[Noteometry] load failed:", e);
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
    await adapter.write(path, JSON.stringify(data, null, 0));
  } catch (e) {
    console.error("[Noteometry] save failed:", e);
  }
}

/* ── Legacy migration ────────────────────────────────── */

export async function migrateLegacy(plugin: NoteometryPlugin): Promise<{ section: string; page: string } | null> {
  const dir = plugin.manifest.dir ?? `.obsidian/plugins/${plugin.manifest.id}`;
  const legacyPath = `${dir}/canvas.json`;
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
