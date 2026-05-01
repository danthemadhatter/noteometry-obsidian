import { describe, it, expect, vi } from "vitest";
import {
  COURSE_WEEKS,
  COURSE_FIRST_PAGE_NAME,
  createSixteenWeekCourseWith,
} from "../../src/lib/courseTemplate";

/**
 * v1.6.10 / v1.7.2 regression guardrails.
 *
 * Dan reported the 16-week course template as "disappeared" in v1.6.9.
 * Investigation showed the button was still there but ambiguously
 * labelled, and the seeding logic had no unit-test coverage. v1.7.2
 * reshapes the template from a flat 16-page list into a 3-level tree
 * (Course → Week N → Lecture) so the SidebarTree can render Course /
 * Week / Homework. These tests pin the new contract: 16 week folders,
 * Lecture seed in Week 1, blank-name guard.
 */

function makeDeps() {
  const createFolderAt = vi
    .fn<(plugin: unknown, parent: string, name: string) => Promise<string>>()
    .mockImplementation(async (_p, parent, name) => (parent ? `${parent}/${name}` : name));
  const createPageAt = vi
    .fn<(plugin: unknown, dir: string, name: string) => Promise<string>>()
    .mockImplementation(async (_p, dir, name) => (dir ? `${dir}/${name}` : name));
  return { createFolderAt, createPageAt };
}

describe("createSixteenWeekCourseWith", () => {
  it("exposes COURSE_WEEKS = 16 so the invariant is literally named", () => {
    expect(COURSE_WEEKS).toBe(16);
  });

  it("creates the course folder, 16 week folders, and a Lecture page in Week 1", async () => {
    const deps = makeDeps();
    const plugin = {} as never;
    const result = await createSixteenWeekCourseWith(plugin, "EE 301", deps);

    expect(result).toEqual({
      coursePath: "EE 301",
      firstPagePath: `EE 301/Week 1/${COURSE_FIRST_PAGE_NAME}`,
    });

    // 1 course folder + 16 week folders = 17 folder creations
    expect(deps.createFolderAt).toHaveBeenCalledTimes(17);
    expect(deps.createFolderAt).toHaveBeenNthCalledWith(1, plugin, "", "EE 301");
    for (let i = 1; i <= 16; i++) {
      expect(deps.createFolderAt).toHaveBeenCalledWith(plugin, "EE 301", `Week ${i}`);
    }

    // Exactly one starter page, inside Week 1
    expect(deps.createPageAt).toHaveBeenCalledTimes(1);
    expect(deps.createPageAt).toHaveBeenCalledWith(plugin, "EE 301/Week 1", COURSE_FIRST_PAGE_NAME);
  });

  it("trims whitespace around the course name", async () => {
    const deps = makeDeps();
    const result = await createSixteenWeekCourseWith({} as never, "  Thermo  ", deps);
    expect(result?.coursePath).toBe("Thermo");
    expect(deps.createFolderAt).toHaveBeenCalledWith(expect.anything(), "", "Thermo");
  });

  it("returns null for a blank name (no folders or pages created)", async () => {
    const deps = makeDeps();
    const result = await createSixteenWeekCourseWith({} as never, "   ", deps);
    expect(result).toBeNull();
    expect(deps.createFolderAt).not.toHaveBeenCalled();
    expect(deps.createPageAt).not.toHaveBeenCalled();
  });

  it("creates the course folder before any week folder (so weeks land in the right parent)", async () => {
    const order: string[] = [];
    const createFolderAt = vi.fn<(plugin: unknown, parent: string, name: string) => Promise<string>>()
      .mockImplementation(async (_p, parent, name) => {
        order.push(parent === "" ? "course" : "week");
        return parent ? `${parent}/${name}` : name;
      });
    const createPageAt = vi.fn<(plugin: unknown, dir: string, name: string) => Promise<string>>()
      .mockImplementation(async (_p, dir, name) => {
        order.push("page");
        return dir ? `${dir}/${name}` : name;
      });
    await createSixteenWeekCourseWith({} as never, "Physics", { createFolderAt, createPageAt });
    expect(order[0]).toBe("course");
    expect(order.slice(1).every(s => s === "week" || s === "page")).toBe(true);
  });
});
