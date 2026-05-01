/**
 * Pure helper for the 16-week course template.
 *
 * Lives in its own module (no direct `obsidian` imports) so unit tests
 * can exercise the full seeding loop with a stubbed plugin. The helper
 * takes path-based persistence functions as injected dependencies so
 * production passes the real ones and tests pass spies.
 */

/** Number of weekly folders created by the "new 16-week course" template.
 * Named so tests pin the invariant without repeating the integer. */
export const COURSE_WEEKS = 16;

/** Default placeholder page seeded inside Week 1 so the freshly-created
 *  course has a navigable leaf to land on. */
export const COURSE_FIRST_PAGE_NAME = "Lecture";

export interface CourseTemplateDeps<P> {
  createFolderAt: (plugin: P, parent: string, name: string) => Promise<string>;
  createPageAt: (plugin: P, dir: string, name: string) => Promise<string>;
}

/**
 * Create a 16-week course as a 3-level tree:
 *   <course>/
 *     Week 1/  Lecture.md
 *     Week 2/
 *     ...
 *     Week 16/
 *
 * Only Week 1 gets a starter page; the rest are empty folders ready for
 * the user to drop homework / lecture / lab pages into. This matches the
 * Course → Week → Homework hierarchy the SidebarTree renders.
 *
 * Returns `{ coursePath, firstPagePath }` on success, or `null` if the
 * name is blank after trim. Does NOT select the new course — the caller
 * owns that so UI state stays in its component.
 */
export async function createSixteenWeekCourseWith<P>(
  plugin: P,
  rawName: string,
  deps: CourseTemplateDeps<P>,
): Promise<{ coursePath: string; firstPagePath: string } | null> {
  const name = rawName.trim();
  if (!name) return null;
  const coursePath = await deps.createFolderAt(plugin, "", name);
  let firstPagePath = "";
  for (let i = 1; i <= COURSE_WEEKS; i++) {
    const weekPath = await deps.createFolderAt(plugin, coursePath, `Week ${i}`);
    if (i === 1) {
      firstPagePath = await deps.createPageAt(plugin, weekPath, COURSE_FIRST_PAGE_NAME);
    }
  }
  return { coursePath, firstPagePath };
}
