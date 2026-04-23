import { useState, useRef, useCallback, useEffect } from "react";
import type NoteometryPlugin from "../../main";
import {
  loadPage,
  listSections,
  listPages,
  migrateLegacy,
  migrateJsonToMd,
  migrateDotAttachments,
  migrateBase64Images,
  CanvasData,
} from "../../lib/persistence";
import { createSixteenWeekCourse } from "../../lib/sidebarActions";

/**
 * Pages feature hook. Owns:
 *  - Current section/page selection (state + refs)
 *  - Ready flag (plugin has finished initial load)
 *  - Page selection action (selectPage) with full load sequence
 *  - One-time initial load effect: migrations, section bootstrap, first page load
 *
 * The composition layer supplies hydration callbacks so usePages can push the
 * loaded CanvasData into the other feature hooks (ink, objects, pipeline) and
 * the tableStore without knowing about them directly.
 *
 * Saving is not owned here — the composition layer has the saveNow/auto-save
 * logic because it needs cross-feature state. selectPage calls flushPendingSave
 * before switching so the previous page's debounced save doesn't hit the new
 * page's slot.
 */
export interface UsePagesConfig {
  plugin: NoteometryPlugin;
  /** Called after loadPage + migrateBase64Images finishes for a valid (section, page). */
  onPageLoaded: (data: CanvasData) => void | Promise<void>;
  /** Called when the selection becomes empty (e.g., after deleting the last page). */
  onEmptyState: () => void;
  /** Called before switching pages so pending debounced saves can flush to the OLD page. */
  flushPendingSave: () => Promise<void>;
}

export interface UsePagesReturn {
  currentSection: string;
  currentPage: string;
  ready: boolean;
  sectionRef: React.MutableRefObject<string>;
  pageRef: React.MutableRefObject<string>;
  selectPage: (section: string, page: string) => Promise<void>;
}

export function usePages({
  plugin,
  onPageLoaded,
  onEmptyState,
  flushPendingSave,
}: UsePagesConfig): UsePagesReturn {
  const [currentSection, setCurrentSection] = useState("");
  const [currentPage, setCurrentPage] = useState("");
  const [ready, setReady] = useState(false);
  const sectionRef = useRef("");
  const pageRef = useRef("");

  // Mirror callbacks in refs so the one-shot init effect can use the latest
  // versions without re-running, and selectPage's closure stays stable.
  const onPageLoadedRef = useRef(onPageLoaded);
  const onEmptyStateRef = useRef(onEmptyState);
  const flushPendingSaveRef = useRef(flushPendingSave);
  onPageLoadedRef.current = onPageLoaded;
  onEmptyStateRef.current = onEmptyState;
  flushPendingSaveRef.current = flushPendingSave;

  const selectPage = useCallback(async (section: string, page: string) => {
    // Flush any pending debounced save so it hits the OLD page, not the new one.
    await flushPendingSaveRef.current();

    // Normalize: if only section is provided, pick its first page.
    let resolvedPage = page;
    if (section && !resolvedPage) {
      const pages = await listPages(plugin, section);
      resolvedPage = pages[0] ?? "";
    }

    sectionRef.current = section;
    pageRef.current = resolvedPage;
    setCurrentSection(section);
    setCurrentPage(resolvedPage);

    if (section && resolvedPage) {
      const data = await loadPage(plugin, section, resolvedPage);
      // Migrate base64 images in this page to vault files before handing to
      // the composition layer.
      const objs = data.canvasObjects ?? [];
      const imgResult = await migrateBase64Images(plugin, section, objs);
      data.canvasObjects = imgResult.objects;
      await onPageLoadedRef.current(data);
    } else {
      onEmptyStateRef.current();
    }
  }, [plugin]);

  // One-time initial load: run migrations, pick starting section/page, load it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await migrateJsonToMd(plugin);
      await migrateDotAttachments(plugin);
      const migrated = await migrateLegacy(plugin);
      const secs = await listSections(plugin);
      if (cancelled) return;

      let sec = "";
      let pg = "";

      if (migrated) {
        sec = migrated.section;
        pg = migrated.page;
      } else if (secs.length > 0) {
        sec = secs[0]!;
        const pages = await listPages(plugin, sec);
        pg = pages[0] ?? "";
      } else {
        // First run: seed a default 16-week course so new installs have
        // something to draw on. Shares the helper with the sidebar button
        // and the command-palette entry so all three produce the same
        // vault layout.
        const seeded = await createSixteenWeekCourse(plugin, "My Course");
        if (seeded) {
          sec = seeded.section;
          pg = seeded.firstPage;
        }
      }

      if (cancelled) return;
      sectionRef.current = sec;
      pageRef.current = pg;
      setCurrentSection(sec);
      setCurrentPage(pg);

      if (sec && pg) {
        const data = await loadPage(plugin, sec, pg);
        const objs = data.canvasObjects ?? [];
        const imgResult = await migrateBase64Images(plugin, sec, objs);
        data.canvasObjects = imgResult.objects;
        if (!cancelled) {
          await onPageLoadedRef.current(data);
        }
      }

      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    currentSection,
    currentPage,
    ready,
    sectionRef,
    pageRef,
    selectPage,
  };
}
