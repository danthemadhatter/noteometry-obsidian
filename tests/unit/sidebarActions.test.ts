import { describe, it, expect, vi } from "vitest";
import {
  COURSE_WEEKS,
  createSixteenWeekCourseWith,
} from "../../src/lib/courseTemplate";

/**
 * v1.6.10 regression guardrails.
 *
 * Dan reported the 16-week course template as "disappeared" in v1.6.9.
 * Investigation showed the button was still there but ambiguously
 * labelled, and the seeding logic had no unit-test coverage — so a
 * future refactor could quietly drop the 16-page loop and no one would
 * notice until a user tried to start a new semester.
 *
 * These tests pin the contract on the pure helper: always creates a
 * section plus exactly 16 pages named Week 1 … Week 16, trims blanks,
 * refuses empty names. The production wrapper in sidebarActions.ts
 * binds this helper to the real persistence functions.
 */

function makeDeps() {
  const createSection = vi.fn().mockResolvedValue(undefined);
  const createPage = vi.fn().mockResolvedValue(undefined);
  return { createSection, createPage };
}

describe("createSixteenWeekCourseWith", () => {
  it("exposes COURSE_WEEKS = 16 so the invariant is literally named", () => {
    expect(COURSE_WEEKS).toBe(16);
  });

  it("creates the section plus exactly 16 weekly pages", async () => {
    const deps = makeDeps();
    const plugin = {} as any;
    const result = await createSixteenWeekCourseWith(plugin, "EE 301", deps);
    expect(result).toEqual({ section: "EE 301", firstPage: "Week 1" });

    expect(deps.createSection).toHaveBeenCalledTimes(1);
    expect(deps.createSection).toHaveBeenCalledWith(plugin, "EE 301");

    expect(deps.createPage).toHaveBeenCalledTimes(16);
    for (let i = 1; i <= 16; i++) {
      expect(deps.createPage).toHaveBeenCalledWith(plugin, "EE 301", `Week ${i}`);
    }
  });

  it("trims whitespace around the course name", async () => {
    const deps = makeDeps();
    const result = await createSixteenWeekCourseWith({} as any, "  Thermo  ", deps);
    expect(result?.section).toBe("Thermo");
    expect(deps.createSection).toHaveBeenCalledWith(expect.anything(), "Thermo");
  });

  it("returns null for a blank name (no section or pages created)", async () => {
    const deps = makeDeps();
    const result = await createSixteenWeekCourseWith({} as any, "   ", deps);
    expect(result).toBeNull();
    expect(deps.createSection).not.toHaveBeenCalled();
    expect(deps.createPage).not.toHaveBeenCalled();
  });

  it("creates the section before any page (so pages land in the right folder)", async () => {
    const order: string[] = [];
    const deps = {
      createSection: vi.fn().mockImplementation(async () => { order.push("section"); }),
      createPage: vi.fn().mockImplementation(async () => { order.push("page"); }),
    };
    await createSixteenWeekCourseWith({} as any, "Physics", deps);
    expect(order[0]).toBe("section");
    expect(order.slice(1).every(s => s === "page")).toBe(true);
  });
});
