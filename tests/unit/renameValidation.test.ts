import { describe, it, expect } from "vitest";
import { validateRename } from "../../src/lib/renameValidation";

/**
 * v1.6.11 regression: user reported "Rename doesn't work."
 * Pre-fix, any edge case (blank, collision, filesystem-unsafe
 * character) silently cancelled the rename with no explanation. These
 * tests pin the contract: every rejection has a message, every
 * accepted name is trimmed, collisions are detected case-insensitively.
 */

describe("validateRename", () => {
  it("rejects a blank name with a user-facing message", () => {
    const r = validateRename("   ", "Week 1", ["Week 1", "Week 2"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/blank/i);
  });

  it("rejects an unchanged name without an error message (silent cancel)", () => {
    const r = validateRename("Week 1", "Week 1", ["Week 1", "Week 2"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("unchanged");
  });

  it("rejects a name that collides case-insensitively with a sibling", () => {
    const r = validateRename("week 2", "Week 1", ["Week 1", "Week 2"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/already exists/i);
  });

  it("allows a rename that differs only in case when no sibling clashes", () => {
    const r = validateRename("week 1", "Week 1", ["Week 1", "Week 2"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.name).toBe("week 1");
  });

  it("rejects filesystem-unsafe characters", () => {
    for (const bad of ["Week/1", "Week\\1", "Week:1"]) {
      const r = validateRename(bad, "Week 1", ["Week 1"]);
      expect(r.ok, `expected ${bad} to fail`).toBe(false);
    }
  });

  it("trims surrounding whitespace", () => {
    const r = validateRename("  Renamed  ", "Week 1", ["Week 1", "Week 2"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.name).toBe("Renamed");
  });

  it("allows a fresh name that doesn't collide", () => {
    const r = validateRename("Week 3", "Week 1", ["Week 1", "Week 2"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.name).toBe("Week 3");
  });
});
