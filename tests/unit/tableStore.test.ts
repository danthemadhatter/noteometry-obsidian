import { describe, it, expect } from "vitest";
import {
  getTableData, setTableData, getAllTableData, loadAllTableData,
  getTextBoxData, setTextBoxData, getAllTextBoxData, loadAllTextBoxData,
  clearScope,
} from "../../src/lib/tableStore";

describe("tableStore (scoped)", () => {
  it("stores and retrieves table data within a scope", () => {
    const data = [["a", "b"], ["c", "d"]];
    setTableData("pageA", "t1", data);
    expect(getTableData("pageA", "t1")).toEqual(data);
    clearScope("pageA");
  });

  it("returns default for unknown table", () => {
    const result = getTableData("someScope", "nonexistent");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("getAllTableData / loadAllTableData round-trips per scope", () => {
    setTableData("pageB", "t2", [["x"]]);
    const all = getAllTableData("pageB");
    expect(all["t2"]).toEqual([["x"]]);

    loadAllTableData("pageB", { t3: [["y", "z"]] });
    expect(getTableData("pageB", "t3")).toEqual([["y", "z"]]);
    expect(getAllTableData("pageB")["t2"]).toBeUndefined();
    clearScope("pageB");
  });

  it("scopes are isolated — loading one doesn't wipe another", () => {
    setTableData("pageC", "ta", [["c"]]);
    setTableData("pageD", "tb", [["d"]]);
    loadAllTableData("pageC", { tc: [["new"]] });
    // pageD should be untouched
    expect(getTableData("pageD", "tb")).toEqual([["d"]]);
    // pageC now only has tc
    expect(getAllTableData("pageC")).toEqual({ tc: [["new"]] });
    clearScope("pageC");
    clearScope("pageD");
  });

  it("clearScope removes all data for a scope", () => {
    setTableData("pageE", "t1", [["a"]]);
    setTextBoxData("pageE", "tb1", "hi");
    clearScope("pageE");
    expect(getAllTableData("pageE")).toEqual({});
    expect(getAllTextBoxData("pageE")).toEqual({});
  });
});

describe("textBoxStore (scoped)", () => {
  it("stores and retrieves text box data within a scope", () => {
    setTextBoxData("pageF", "tb1", "<b>hello</b>");
    expect(getTextBoxData("pageF", "tb1")).toBe("<b>hello</b>");
    clearScope("pageF");
  });

  it("returns empty string for unknown text box", () => {
    expect(getTextBoxData("someScope", "nope")).toBe("");
  });

  it("getAllTextBoxData / loadAllTextBoxData round-trips per scope", () => {
    setTextBoxData("pageG", "tb2", "test");
    const all = getAllTextBoxData("pageG");
    expect(all["tb2"]).toBe("test");

    loadAllTextBoxData("pageG", { tb3: "loaded" });
    expect(getTextBoxData("pageG", "tb3")).toBe("loaded");
    expect(getAllTextBoxData("pageG")["tb2"]).toBeUndefined();
    clearScope("pageG");
  });
});
