import { Notice, FileSystemAdapter } from "obsidian";
import type NoteometryPlugin from "../main";
import { createFolderAt, createPageAt } from "./persistence";
import { COURSE_WEEKS, createSixteenWeekCourseWith } from "./courseTemplate";

export { COURSE_WEEKS };

/**
 * Concrete 16-week course seeder bound to the real path-based persistence
 * helpers. The pure template logic lives in `courseTemplate.ts` so tests
 * can exercise it without pulling in the obsidian runtime; this wrapper
 * is the production entry point used by the sidebar button and the
 * first-run seed.
 *
 * The 3-level shape (Course → Week N → Lecture) is what the SidebarTree
 * expects. Returns `{ coursePath, firstPagePath }` so the caller can
 * navigate straight to the seeded leaf.
 */
export function createSixteenWeekCourse(
  plugin: NoteometryPlugin,
  rawName: string,
): Promise<{ coursePath: string; firstPagePath: string } | null> {
  return createSixteenWeekCourseWith(plugin, rawName, { createFolderAt, createPageAt });
}

/**
 * Build the vault path (relative to the vault root) for a Noteometry
 * folder at the given relative path. Exposed so tests can pin the
 * contract without touching Obsidian internals.
 */
export function folderVaultPath(plugin: NoteometryPlugin, relPath: string): string {
  const root = plugin.settings.vaultFolder || "Noteometry";
  return relPath ? `${root}/${relPath}` : root;
}

/**
 * Reveal a folder in the host OS file explorer (Finder on macOS,
 * Explorer on Windows, the default file manager on Linux). Falls back
 * to a Notice with the copyable vault-relative path when the host
 * doesn't expose a reveal API — for example on iPad or Android.
 *
 * Obsidian's desktop build exposes `app.showInFolder(absolutePath)` as
 * an undocumented but long-stable method. We guard with a feature-
 * detect so mobile doesn't crash.
 */
export async function revealFolder(plugin: NoteometryPlugin, relPath: string): Promise<void> {
  const vaultRel = folderVaultPath(plugin, relPath);
  const adapter = plugin.app.vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) {
    try { await navigator.clipboard?.writeText(vaultRel); } catch { /* ignore */ }
    new Notice(`Vault path copied: ${vaultRel}`, 6000);
    return;
  }
  const basePath = adapter.getBasePath();
  const fullPath = `${basePath}/${vaultRel}`;
  const app = plugin.app as unknown as { showInFolder?: (p: string) => void };
  if (typeof app.showInFolder === "function") {
    try {
      app.showInFolder(fullPath);
      return;
    } catch (e) {
      console.error("[Noteometry] showInFolder failed:", e);
    }
  }
  try { await navigator.clipboard?.writeText(fullPath); } catch { /* ignore */ }
  new Notice(`Folder path copied: ${fullPath}`, 8000);
}
