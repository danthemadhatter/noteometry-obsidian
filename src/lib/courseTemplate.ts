/**
 * Pure helper for the 16-week course template.
 *
 * Lives in its own module (no direct `obsidian` imports) so unit tests
 * can exercise the full seeding loop with a stubbed plugin. The helper
 * takes `createSection` and `createPage` as injected dependencies so
 * production can pass the real persistence functions and tests can
 * pass spies.
 */

/** Number of weekly pages created by the "new 16-week course" template.
 * Named so tests pin the invariant without repeating the integer. */
export const COURSE_WEEKS = 16;

export interface CourseTemplateDeps<P> {
  createSection: (plugin: P, name: string) => Promise<void>;
  createPage: (plugin: P, section: string, name: string) => Promise<void>;
}

/**
 * Create a 16-week course: a section folder containing Week 1 … Week 16
 * pages. Pure data-layer helper so the Sidebar button, the first-run
 * seed, and any future automation paths all produce the same vault layout.
 *
 * Returns `{ section, firstPage }` on success, or `null` if the name is
 * blank after trim. Does NOT select the new course — the caller owns
 * that so UI state (active tab, pages map) stays in its component.
 */
export async function createSixteenWeekCourseWith<P>(
  plugin: P,
  rawName: string,
  deps: CourseTemplateDeps<P>,
): Promise<{ section: string; firstPage: string } | null> {
  const name = rawName.trim();
  if (!name) return null;
  await deps.createSection(plugin, name);
  for (let i = 1; i <= COURSE_WEEKS; i++) {
    await deps.createPage(plugin, name, `Week ${i}`);
  }
  return { section: name, firstPage: "Week 1" };
}
