/**
 * v1.11.1 — most-recent-.nmpage resolver test.
 *
 * Backs the new auto-open-on-launch flow that replaced the Home
 * view as the default landing experience.
 */

import { describe, it, expect } from "vitest";
import { getMostRecentNmpage } from "../../src/lib/recentPages";

// Minimal TFile-shaped fake — getMostRecentNmpage only reads
// `extension`, `path`, `parent.path`, `stat.mtime`, `basename`.
function fakeFile(
  path: string,
  mtime: number,
  ext = "nmpage",
): unknown {
  const slash = path.lastIndexOf("/");
  return {
    extension: ext,
    path,
    basename: path.slice(slash + 1).replace(/\.[^.]+$/, ""),
    parent: {
      path: slash >= 0 ? path.slice(0, slash) : "",
    },
    stat: { mtime },
  };
}

function fakeApp(files: unknown[]): unknown {
  return {
    vault: {
      getFiles: () => files,
    },
  };
}

describe("getMostRecentNmpage", () => {
  it("returns null for an empty vault", () => {
    expect(
      getMostRecentNmpage(fakeApp([]) as never, "Noteometry") as unknown,
    ).toBeNull();
  });

  it("ignores non-.nmpage files", () => {
    const app = fakeApp([
      fakeFile("notes/foo.md", 9999),
      fakeFile("Noteometry/page.nmpage", 1000),
    ]);
    const out = getMostRecentNmpage(app as never, "Noteometry") as
      | { path: string }
      | null;
    expect(out?.path).toBe("Noteometry/page.nmpage");
  });

  it("returns the highest mtime", () => {
    const app = fakeApp([
      fakeFile("Noteometry/a.nmpage", 1000),
      fakeFile("Noteometry/b.nmpage", 5000),
      fakeFile("Noteometry/c.nmpage", 3000),
    ]);
    const out = getMostRecentNmpage(app as never, "Noteometry") as
      | { path: string }
      | null;
    expect(out?.path).toBe("Noteometry/b.nmpage");
  });

  it("scopes to the given root folder if any pages exist there", () => {
    const app = fakeApp([
      fakeFile("Other/very-recent.nmpage", 9999),
      fakeFile("Noteometry/older.nmpage", 1000),
    ]);
    const out = getMostRecentNmpage(app as never, "Noteometry") as
      | { path: string }
      | null;
    expect(out?.path).toBe("Noteometry/older.nmpage");
  });

  it("falls back to all pages when the root has none", () => {
    const app = fakeApp([
      fakeFile("Other/some.nmpage", 5000),
      fakeFile("Other/newer.nmpage", 9000),
    ]);
    const out = getMostRecentNmpage(app as never, "Noteometry") as
      | { path: string }
      | null;
    expect(out?.path).toBe("Other/newer.nmpage");
  });
});
