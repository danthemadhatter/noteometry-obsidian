import { describe, it, expect } from "vitest";
import { buildNav, sectionPathFor } from "../../src/lib/canvasNavTree";

/**
 * v1.14.9: OneNote-style on-canvas nav. Sections = first-level
 * folders under the Noteometry root. Pages = every .nmpage that
 * lives anywhere underneath a section, collapsed into a flat list.
 *
 * These tests pin the grouping behavior using a minimal fake App
 * matching the surface area buildNav touches: app.vault.getFiles,
 * app.vault.getAbstractFileByPath. We don't depend on jsdom or on
 * Obsidian's runtime classes \u2014 we only use the structural pieces
 * (TFile-shaped objects, TFolder-shaped objects with .children).
 */

class FakeFolder {
  path: string;
  name: string;
  children: Array<FakeFolder | FakeFile> = [];
  constructor(path: string) {
    this.path = path;
    this.name = path.slice(path.lastIndexOf("/") + 1);
  }
}

class FakeFile {
  path: string;
  basename: string;
  extension: string;
  parent: FakeFolder | null;
  stat = { mtime: 0, ctime: 0, size: 0 };
  constructor(path: string, parent: FakeFolder | null) {
    this.path = path;
    const slash = path.lastIndexOf("/");
    const name = path.slice(slash + 1);
    const dot = name.lastIndexOf(".");
    this.basename = dot === -1 ? name : name.slice(0, dot);
    this.extension = dot === -1 ? "" : name.slice(dot + 1);
    this.parent = parent;
  }
}

// Override prototype identity so `instanceof TFolder` / `instanceof TFile`
// from the canvasNavTree module's import resolves \u2014 we patch it via the
// obsidian stub at tests/stubs/obsidian.ts already (TFolder/TFile classes).
// Here we just use shape-compatible objects; canvasNavTree uses instanceof
// against the imported classes, so we re-export our fakes as those.
import * as obsidian from "obsidian";
Object.setPrototypeOf(FakeFolder.prototype, (obsidian as { TFolder: { prototype: object } }).TFolder.prototype);
Object.setPrototypeOf(FakeFile.prototype, (obsidian as { TFile: { prototype: object } }).TFile.prototype);

interface FakeApp {
  vault: {
    getFiles: () => FakeFile[];
    getAbstractFileByPath: (path: string) => FakeFolder | FakeFile | null;
  };
}

function makeApp(root: FakeFolder, allFiles: FakeFile[]): FakeApp {
  const byPath = new Map<string, FakeFolder | FakeFile>();
  const indexFolder = (f: FakeFolder) => {
    byPath.set(f.path, f);
    for (const c of f.children) {
      if (c instanceof FakeFolder) indexFolder(c);
      else byPath.set(c.path, c);
    }
  };
  indexFolder(root);
  return {
    vault: {
      getFiles: () => allFiles,
      getAbstractFileByPath: (p: string) => byPath.get(p) ?? null,
    },
  };
}

function makeTree() {
  const root = new FakeFolder("Noteometry/APUS");

  const elen = new FakeFolder("Noteometry/APUS/ELEN201");
  elen.children.push(new FakeFile("Noteometry/APUS/ELEN201/Week1.nmpage", elen));
  elen.children.push(new FakeFile("Noteometry/APUS/ELEN201/Week2.nmpage", elen));

  // Sub-folder of a section \u2014 pages collapse into the section.
  const elenWeek3 = new FakeFolder("Noteometry/APUS/ELEN201/Week3");
  elenWeek3.children.push(new FakeFile("Noteometry/APUS/ELEN201/Week3/Notes.nmpage", elenWeek3));
  elen.children.push(elenWeek3);

  const math = new FakeFolder("Noteometry/APUS/MATH240");
  math.children.push(new FakeFile("Noteometry/APUS/MATH240/Week1.nmpage", math));

  // A loose .nmpage directly in the root \u2014 lands in the (root) section.
  const stray = new FakeFile("Noteometry/APUS/Stray.nmpage", root);

  root.children.push(elen, math, stray);
  const all: FakeFile[] = [
    elen.children[0] as FakeFile,
    elen.children[1] as FakeFile,
    elenWeek3.children[0] as FakeFile,
    math.children[0] as FakeFile,
    stray,
  ];
  return { root, all };
}

describe("v1.14.9 \u2014 buildNav (canvas nav tree)", () => {
  it("groups pages by first-level section folder", () => {
    const { root, all } = makeTree();
    const app = makeApp(root, all);
    const sections = buildNav(app as unknown as Parameters<typeof buildNav>[0], "Noteometry/APUS");

    // v1.14.10: synthetic root bucket now uses the real folder name,
    // not the opaque "(root)" jargon. For Noteometry/APUS root, that's
    // "APUS". Display order: bucket first, then ELEN201, MATH240 alpha.
    const names = sections.map(s => s.name);
    expect(names[0]).toBe("APUS");
    expect(sections[0].isRootBucket).toBe(true);
    expect(names).toContain("ELEN201");
    expect(names).toContain("MATH240");
  });

  it("collapses sub-folder pages into the section's flat list", () => {
    const { root, all } = makeTree();
    const app = makeApp(root, all);
    const sections = buildNav(app as unknown as Parameters<typeof buildNav>[0], "Noteometry/APUS");
    const elen = sections.find(s => s.name === "ELEN201");
    expect(elen).toBeDefined();
    expect(elen!.pages.length).toBe(3);
    const labels = elen!.pages.map(p => p.label).sort();
    expect(labels).toEqual(["Notes", "Week1", "Week2"]);
    // The Notes page \u2014 inside Week3 sub-folder \u2014 must report subPath.
    const notes = elen!.pages.find(p => p.label === "Notes");
    expect(notes!.subPath).toBe("Week3");
  });

  it("places loose .nmpage files in a synthetic (root) section", () => {
    const { root, all } = makeTree();
    const app = makeApp(root, all);
    const sections = buildNav(app as unknown as Parameters<typeof buildNav>[0], "Noteometry/APUS");
    const rootSec = sections.find(s => s.isRootBucket);
    expect(rootSec).toBeDefined();
    expect(rootSec!.name).toBe("APUS");
    expect(rootSec!.pages.map(p => p.label)).toEqual(["Stray"]);
  });

  it("sorts pages with natural numeric ordering (Week2 before Week10)", () => {
    const root = new FakeFolder("Noteometry/APUS");
    const sec = new FakeFolder("Noteometry/APUS/ELEN201");
    const files: FakeFile[] = [];
    for (const n of [1, 2, 3, 10, 11]) {
      const f = new FakeFile(`Noteometry/APUS/ELEN201/Week${n}.nmpage`, sec);
      sec.children.push(f);
      files.push(f);
    }
    root.children.push(sec);
    const app = makeApp(root, files);
    const sections = buildNav(app as unknown as Parameters<typeof buildNav>[0], "Noteometry/APUS");
    const labels = sections.find(s => s.name === "ELEN201")!.pages.map(p => p.label);
    // localeCompare with numeric:true keeps 2 before 10.
    expect(labels).toEqual(["Week1", "Week2", "Week3", "Week10", "Week11"]);
  });

  it("sectionPathFor finds the section containing the active file", () => {
    const { root, all } = makeTree();
    const app = makeApp(root, all);
    const sections = buildNav(app as unknown as Parameters<typeof buildNav>[0], "Noteometry/APUS");
    const week2 = all.find(f => f.path.endsWith("ELEN201/Week2.nmpage"))!;
    const found = sectionPathFor(week2 as unknown as Parameters<typeof sectionPathFor>[0], sections);
    expect(found).toBe("Noteometry/APUS/ELEN201");
  });

  it("returns empty array gracefully when root folder doesn't exist and no files", () => {
    const root = new FakeFolder("Noteometry/APUS");
    const app = makeApp(root, []);
    const sections = buildNav(app as unknown as Parameters<typeof buildNav>[0], "Noteometry/APUS");
    expect(sections).toEqual([]);
  });
});
