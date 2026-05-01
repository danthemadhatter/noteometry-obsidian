import { useState, useRef, useCallback, useEffect } from "react";
import type NoteometryPlugin from "../../main";
import {
  loadPageByPath,
  listTree,
  migrateLegacy,
  migrateJsonToMd,
  migrateDotAttachments,
  migrateBase64ImagesByPath,
  CanvasData,
  TreeNode,
} from "../../lib/persistence";
import { firstLeafPath } from "../../lib/treeHelpers";
import { createSixteenWeekCourse } from "../../lib/sidebarActions";

/**
 * Pages feature hook (v1.7.2 path-based). Owns:
 *  - Current page selection as a single relative path string
 *    (e.g. "Calc III/Week 1/Lecture").
 *  - Cached tree shape from listTree() and a refresh action.
 *  - Ready flag (plugin has finished initial load).
 *  - selectPath: full load sequence with pending-save flush.
 *  - One-time initial load: migrations, tree bootstrap, first leaf.
 *
 * The legacy section/page API is retired here — SidebarTree consumes
 * paths exclusively, and the surviving 2-level vault structures still
 * render correctly because listTree treats every folder uniformly.
 */
export interface UsePagesConfig {
  plugin: NoteometryPlugin;
  /** Called after the page payload is loaded. */
  onPageLoaded: (data: CanvasData) => void | Promise<void>;
  /** Called when the selection becomes empty (e.g. last page deleted). */
  onEmptyState: () => void;
  /** Called before switching pages so pending debounced saves can flush
   *  to the OLD page. */
  flushPendingSave: () => Promise<void>;
}

export interface UsePagesReturn {
  currentPath: string;
  pathRef: React.MutableRefObject<string>;
  tree: TreeNode[];
  refreshTree: () => Promise<TreeNode[]>;
  selectPath: (path: string) => Promise<void>;
  ready: boolean;
}

export function usePages({
  plugin,
  onPageLoaded,
  onEmptyState,
  flushPendingSave,
}: UsePagesConfig): UsePagesReturn {
  const [currentPath, setCurrentPath] = useState("");
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [ready, setReady] = useState(false);
  const pathRef = useRef("");

  const onPageLoadedRef = useRef(onPageLoaded);
  const onEmptyStateRef = useRef(onEmptyState);
  const flushPendingSaveRef = useRef(flushPendingSave);
  onPageLoadedRef.current = onPageLoaded;
  onEmptyStateRef.current = onEmptyState;
  flushPendingSaveRef.current = flushPendingSave;

  const refreshTree = useCallback(async (): Promise<TreeNode[]> => {
    const t = await listTree(plugin);
    setTree(t);
    return t;
  }, [plugin]);

  const selectPath = useCallback(async (path: string) => {
    // Flush any pending debounced save so it hits the OLD page.
    await flushPendingSaveRef.current();

    pathRef.current = path;
    setCurrentPath(path);

    if (!path) {
      onEmptyStateRef.current();
      return;
    }

    const data = await loadPageByPath(plugin, path);
    const objs = data.canvasObjects ?? [];
    const imgResult = await migrateBase64ImagesByPath(plugin, path, objs);
    data.canvasObjects = imgResult.objects;
    await onPageLoadedRef.current(data);
  }, [plugin]);

  // One-time initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await migrateJsonToMd(plugin);
      await migrateDotAttachments(plugin);
      const migrated = await migrateLegacy(plugin);
      const t = await listTree(plugin);
      if (cancelled) return;
      setTree(t);

      let path = "";
      if (migrated) {
        path = migrated.path;
      } else {
        const leaf = firstLeafPath(t);
        if (leaf) {
          path = leaf;
        } else {
          // First run: seed a default 16-week course so new installs
          // have somewhere to draw. Shares the helper with the sidebar
          // bottom action so all entry points produce the same layout.
          const seeded = await createSixteenWeekCourse(plugin, "My Course");
          if (seeded) {
            path = seeded.firstPagePath;
            const t2 = await listTree(plugin);
            if (!cancelled) setTree(t2);
          }
        }
      }

      if (cancelled) return;
      pathRef.current = path;
      setCurrentPath(path);

      if (path) {
        const data = await loadPageByPath(plugin, path);
        const objs = data.canvasObjects ?? [];
        const imgResult = await migrateBase64ImagesByPath(plugin, path, objs);
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
    currentPath,
    pathRef,
    tree,
    refreshTree,
    selectPath,
    ready,
  };
}
