import type NoteometryPlugin from "../main";

export interface CanvasData {
  elements: unknown[];
  appState: Record<string, unknown>;
  panelInput: string;
  panelOutput: string;
  panelMode: string;
  lastSaved: string;
}

const FILE_NAME = "canvas.json";

function canvasPath(plugin: NoteometryPlugin): string {
  const dir = plugin.manifest.dir ?? `.obsidian/plugins/${plugin.manifest.id}`;
  return `${dir}/${FILE_NAME}`;
}

export async function saveCanvas(
  plugin: NoteometryPlugin,
  data: CanvasData
): Promise<void> {
  try {
    const path = canvasPath(plugin);
    await plugin.app.vault.adapter.write(
      path,
      JSON.stringify(data, null, 0)
    );
  } catch (e) {
    console.error("[Noteometry] save failed:", e);
  }
}

export async function loadCanvas(
  plugin: NoteometryPlugin
): Promise<CanvasData | null> {
  try {
    const path = canvasPath(plugin);
    if (await plugin.app.vault.adapter.exists(path)) {
      const raw = await plugin.app.vault.adapter.read(path);
      return JSON.parse(raw) as CanvasData;
    }
  } catch (e) {
    console.error("[Noteometry] load failed:", e);
  }
  return null;
}
