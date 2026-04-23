import { Notice, FileSystemAdapter } from "obsidian";
import type NoteometryPlugin from "../main";
import { createSection, createPage } from "./persistence";
import { COURSE_WEEKS, createSixteenWeekCourseWith } from "./courseTemplate";

export { COURSE_WEEKS };

/**
 * Concrete 16-week course seeder bound to the real persistence helpers.
 * The pure template logic lives in `courseTemplate.ts` so tests can exercise
 * it without pulling in the obsidian runtime; this wrapper is the production
 * entry point used by the sidebar button and the first-run seed.
 */
export function createSixteenWeekCourse(
  plugin: NoteometryPlugin,
  rawName: string,
): Promise<{ section: string; firstPage: string } | null> {
  return createSixteenWeekCourseWith(plugin, rawName, { createSection, createPage });
}

/**
 * Build the vault path (relative to the vault root) for a Noteometry section.
 * Exposed so tests can pin the contract without touching Obsidian internals.
 */
export function sectionVaultPath(plugin: NoteometryPlugin, section: string): string {
  const root = plugin.settings.vaultFolder || "Noteometry";
  return `${root}/${section}`;
}

/**
 * Reveal the section folder in the host OS file explorer (Finder on macOS,
 * Explorer on Windows, the default file manager on Linux). Falls back to a
 * Notice with the copyable vault-relative path when the host doesn't expose
 * a reveal API — for example on iPad or Android.
 *
 * Obsidian's desktop build exposes `app.showInFolder(absolutePath)` as an
 * undocumented but long-stable method. We guard with a feature-detect so
 * mobile doesn't crash.
 */
export async function revealSection(plugin: NoteometryPlugin, section: string): Promise<void> {
  const relPath = sectionVaultPath(plugin, section);
  const adapter = plugin.app.vault.adapter;
  // Only the desktop FileSystemAdapter has a base path; mobile uses an
  // in-process capacitor adapter with no on-disk folder to reveal.
  if (!(adapter instanceof FileSystemAdapter)) {
    try { await navigator.clipboard?.writeText(relPath); } catch { /* ignore */ }
    new Notice(`Vault path copied: ${relPath}`, 6000);
    return;
  }
  const basePath = adapter.getBasePath();
  const fullPath = `${basePath}/${relPath}`;
  const app = plugin.app as unknown as { showInFolder?: (p: string) => void };
  if (typeof app.showInFolder === "function") {
    try {
      app.showInFolder(fullPath);
      return;
    } catch (e) {
      console.error("[Noteometry] showInFolder failed:", e);
    }
  }
  // Fallback: copy path to clipboard, show a notice with the full path.
  try { await navigator.clipboard?.writeText(fullPath); } catch { /* ignore */ }
  new Notice(`Folder path copied: ${fullPath}`, 8000);
}
