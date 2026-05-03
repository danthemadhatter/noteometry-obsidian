/**
 * v1.11.1 — Pages panel pure logic tests.
 */

import { describe, it, expect } from "vitest";
import {
  chipLabel,
  filterAndSort,
  folderChips,
  PagePanelEntry,
} from "../../src/components/pages/pagesPanelLogic";

const E = (
  basename: string,
  parentPath: string,
  mtime: number,
): PagePanelEntry => ({
  path: parentPath ? `${parentPath}/${basename}.nmpage` : `${basename}.nmpage`,
  basename,
  parentPath,
  mtime,
});

const FIXTURE: PagePanelEntry[] = [
  E("ECE 215 lecture 3", "school/ece215", 1000),
  E("ECE 215 lecture 4", "school/ece215", 4000),
  E("Daily journal 2026-05-02", "journal", 5000),
  E("Daily journal 2026-05-01", "journal", 3000),
  E("scratchpad", "", 2000),
  E("project notes", "projects", 6000),
];

describe("filterAndSort", () => {
  it("recency sort by default", () => {
    const out = filterAndSort(FIXTURE);
    expect(out.map((e) => e.basename)).toEqual([
      "project notes",
      "Daily journal 2026-05-02",
      "ECE 215 lecture 4",
      "Daily journal 2026-05-01",
      "scratchpad",
      "ECE 215 lecture 3",
    ]);
  });

  it("name (asc) sort is alphabetical", () => {
    const names = filterAndSort(FIXTURE, { sort: "name" }).map((e) => e.basename);
    expect(names).toEqual([
      "Daily journal 2026-05-01",
      "Daily journal 2026-05-02",
      "ECE 215 lecture 3",
      "ECE 215 lecture 4",
      "project notes",
      "scratchpad",
    ]);
  });

  it("name (desc) sort is reverse alphabetical", () => {
    const names = filterAndSort(FIXTURE, { sort: "name-desc" }).map((e) => e.basename);
    expect(names[0]).toBe("scratchpad");
    expect(names[names.length - 1]).toBe("Daily journal 2026-05-01");
  });

  it("query filters by basename (case-insensitive)", () => {
    const out = filterAndSort(FIXTURE, { query: "ECE" });
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.basename.includes("ECE"))).toBe(true);
  });

  it("query filters by parentPath too", () => {
    const out = filterAndSort(FIXTURE, { query: "journal" });
    // basename match (Daily journal x2) AND parent path match (journal)
    expect(out).toHaveLength(2);
  });

  it("folder filter is exact match (not subfolder bleed)", () => {
    const out = filterAndSort(FIXTURE, { folder: "school/ece215" });
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.parentPath === "school/ece215")).toBe(true);
  });

  it("folder='' selects vault-root entries (the / chip)", () => {
    const out = filterAndSort(FIXTURE, { folder: "" });
    expect(out).toHaveLength(1);
    expect(out[0]!.basename).toBe("scratchpad");
  });

  it("folder=null is the 'All folders' state (no filter)", () => {
    const out = filterAndSort(FIXTURE, { folder: null });
    expect(out).toHaveLength(FIXTURE.length);
  });

  it("query + folder combine (AND)", () => {
    const out = filterAndSort(FIXTURE, {
      folder: "school/ece215",
      query: "lecture 4",
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.basename).toBe("ECE 215 lecture 4");
  });

  it("empty query + null folder = full set", () => {
    expect(filterAndSort(FIXTURE).length).toBe(FIXTURE.length);
  });

  it("does not mutate the input array", () => {
    const before = FIXTURE.slice();
    filterAndSort(FIXTURE, { sort: "name" });
    expect(FIXTURE).toEqual(before);
  });
});

describe("folderChips", () => {
  it("counts each unique folder", () => {
    const chips = folderChips(FIXTURE);
    const map = new Map(chips.map((c) => [c.folder, c.count]));
    expect(map.get("school/ece215")).toBe(2);
    expect(map.get("journal")).toBe(2);
    expect(map.get("")).toBe(1);
    expect(map.get("projects")).toBe(1);
  });

  it("orders by descending count, then alpha", () => {
    const chips = folderChips(FIXTURE);
    expect(chips[0]!.count).toBe(2); // either school/ece215 or journal
    expect(chips[chips.length - 1]!.count).toBe(1);
    // ties broken alpha → "journal" before "school/ece215"
    expect(chips[0]!.folder).toBe("journal");
    expect(chips[1]!.folder).toBe("school/ece215");
  });
});

describe("chipLabel", () => {
  it("returns / for vault root", () => {
    expect(chipLabel("")).toBe("/");
  });

  it("returns the last path segment for nested folders", () => {
    expect(chipLabel("school/ece215")).toBe("ece215");
    expect(chipLabel("a/b/c/d")).toBe("d");
  });

  it("returns the folder itself for a single-segment path", () => {
    expect(chipLabel("journal")).toBe("journal");
  });
});
