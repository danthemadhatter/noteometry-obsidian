import { describe, it, expect } from "vitest";
import {
  findNode,
  getParentPath,
  getBasename,
  walkLeaves,
  firstLeafPath,
  nextSiblingPath,
  ancestorPaths,
} from "../../src/lib/treeHelpers";
import type { TreeNode } from "../../src/lib/treeTypes";

/**
 * v1.7.2 path helpers — pure functions consumed by SidebarTree and
 * usePages. The whole tree refactor pivots on these being correct, so
 * they get explicit unit coverage. No React, no obsidian, no adapter
 * mocking — just data in / data out.
 */

const fixture = (): TreeNode[] => [
  {
    name: "Calc III",
    path: "Calc III",
    kind: "folder",
    depth: 0,
    children: [
      {
        name: "Week 1",
        path: "Calc III/Week 1",
        kind: "folder",
        depth: 1,
        children: [
          { name: "Lecture", path: "Calc III/Week 1/Lecture", kind: "page", depth: 2 },
          { name: "Lab", path: "Calc III/Week 1/Lab", kind: "page", depth: 2 },
        ],
      },
      {
        name: "Week 2",
        path: "Calc III/Week 2",
        kind: "folder",
        depth: 1,
        children: [],
      },
    ],
  },
  {
    name: "EE 301",
    path: "EE 301",
    kind: "folder",
    depth: 0,
    children: [
      { name: "Syllabus", path: "EE 301/Syllabus", kind: "page", depth: 1 },
    ],
  },
];

describe("getParentPath", () => {
  it("returns '' for top-level paths", () => {
    expect(getParentPath("Calc III")).toBe("");
  });
  it("returns the parent for 2-level paths", () => {
    expect(getParentPath("Calc III/Week 1")).toBe("Calc III");
  });
  it("returns the immediate parent for 3-level paths", () => {
    expect(getParentPath("Calc III/Week 1/Lecture")).toBe("Calc III/Week 1");
  });
  it("returns '' for the empty path", () => {
    expect(getParentPath("")).toBe("");
  });
});

describe("getBasename", () => {
  it("returns the whole string for top-level paths", () => {
    expect(getBasename("Calc III")).toBe("Calc III");
  });
  it("returns the leaf for nested paths", () => {
    expect(getBasename("Calc III/Week 1")).toBe("Week 1");
    expect(getBasename("Calc III/Week 1/Lecture")).toBe("Lecture");
  });
  it("returns '' for the empty path", () => {
    expect(getBasename("")).toBe("");
  });
});

describe("ancestorPaths", () => {
  it("returns [] for top-level", () => {
    expect(ancestorPaths("Calc III")).toEqual([]);
  });
  it("walks every ancestor in order", () => {
    expect(ancestorPaths("Calc III/Week 1/Lecture")).toEqual([
      "Calc III",
      "Calc III/Week 1",
    ]);
  });
  it("returns [] for empty path", () => {
    expect(ancestorPaths("")).toEqual([]);
  });
});

describe("findNode", () => {
  it("finds a top-level folder", () => {
    const node = findNode(fixture(), "Calc III");
    expect(node?.name).toBe("Calc III");
  });
  it("finds a nested folder", () => {
    const node = findNode(fixture(), "Calc III/Week 1");
    expect(node?.kind).toBe("folder");
  });
  it("finds a nested page", () => {
    const node = findNode(fixture(), "Calc III/Week 1/Lecture");
    expect(node?.kind).toBe("page");
  });
  it("returns null for a missing path", () => {
    expect(findNode(fixture(), "Nope")).toBeNull();
    expect(findNode(fixture(), "Calc III/Week 99")).toBeNull();
  });
  it("returns null for empty path", () => {
    expect(findNode(fixture(), "")).toBeNull();
  });
});

describe("walkLeaves", () => {
  it("returns all page nodes in depth-first order", () => {
    const leaves = walkLeaves(fixture()).map((n) => n.path);
    expect(leaves).toEqual([
      "Calc III/Week 1/Lecture",
      "Calc III/Week 1/Lab",
      "EE 301/Syllabus",
    ]);
  });
  it("returns [] on empty tree", () => {
    expect(walkLeaves([])).toEqual([]);
  });
  it("ignores folders that contain no pages", () => {
    const tree: TreeNode[] = [
      { name: "Empty", path: "Empty", kind: "folder", depth: 0, children: [] },
    ];
    expect(walkLeaves(tree)).toEqual([]);
  });
});

describe("firstLeafPath", () => {
  it("returns the depth-first first page", () => {
    expect(firstLeafPath(fixture())).toBe("Calc III/Week 1/Lecture");
  });
  it("returns null on an empty tree", () => {
    expect(firstLeafPath([])).toBeNull();
  });
});

describe("nextSiblingPath", () => {
  it("returns the next sibling at the same level", () => {
    expect(nextSiblingPath(fixture(), "Calc III/Week 1/Lecture")).toBe(
      "Calc III/Week 1/Lab",
    );
  });
  it("falls back to the previous sibling when there is no next", () => {
    expect(nextSiblingPath(fixture(), "Calc III/Week 1/Lab")).toBe(
      "Calc III/Week 1/Lecture",
    );
  });
  it("works on top-level folders", () => {
    expect(nextSiblingPath(fixture(), "Calc III")).toBe("EE 301");
    expect(nextSiblingPath(fixture(), "EE 301")).toBe("Calc III");
  });
  it("returns null when only sibling", () => {
    expect(nextSiblingPath(fixture(), "EE 301/Syllabus")).toBeNull();
  });
  it("returns null for missing paths", () => {
    expect(nextSiblingPath(fixture(), "Nope")).toBeNull();
    expect(nextSiblingPath(fixture(), "")).toBeNull();
  });
});
