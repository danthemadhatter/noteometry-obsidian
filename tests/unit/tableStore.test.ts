import { describe, it, expect } from "vitest";
import {
  getTableData, setTableData, getAllTableData, loadAllTableData,
  getTextBoxData, setTextBoxData, getAllTextBoxData, loadAllTextBoxData,
} from "../../src/lib/tableStore";

describe("tableStore", () => {
  it("stores and retrieves table data", () => {
    const data = [["a", "b"], ["c", "d"]];
    setTableData("t1", data);
    expect(getTableData("t1")).toEqual(data);
  });

  it("returns default for unknown table", () => {
    const result = getTableData("nonexistent");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("getAllTableData / loadAllTableData round-trips", () => {
    setTableData("t2", [["x"]]);
    const all = getAllTableData();
    expect(all["t2"]).toEqual([["x"]]);

    loadAllTableData({ t3: [["y", "z"]] });
    expect(getTableData("t3")).toEqual([["y", "z"]]);
  });
});

describe("textBoxStore", () => {
  it("stores and retrieves text box data", () => {
    setTextBoxData("tb1", "<b>hello</b>");
    expect(getTextBoxData("tb1")).toBe("<b>hello</b>");
  });

  it("returns empty string for unknown text box", () => {
    expect(getTextBoxData("nope")).toBe("");
  });

  it("getAllTextBoxData / loadAllTextBoxData round-trips", () => {
    setTextBoxData("tb2", "test");
    const all = getAllTextBoxData();
    expect(all["tb2"]).toBe("test");

    loadAllTextBoxData({ tb3: "loaded" });
    expect(getTextBoxData("tb3")).toBe("loaded");
  });
});
