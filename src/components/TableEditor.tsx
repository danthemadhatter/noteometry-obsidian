import React, { useState, useCallback, useEffect } from "react";
import { getTableData, setTableData } from "../lib/tableStore";

interface Props {
  tableId: string;
  scope: string;
}

export default function TableEditor({ tableId, scope }: Props) {
  const [cells, setCells] = useState<string[][]>(() => getTableData(scope, tableId));

  // Sync to store on change
  useEffect(() => {
    setTableData(scope, tableId, cells);
  }, [scope, tableId, cells]);

  const updateCell = useCallback((row: number, col: number, value: string) => {
    setCells((prev) => {
      const next = prev.map((r) => [...r]);
      next[row]![col] = value;
      return next;
    });
  }, []);

  const addRow = useCallback(() => {
    setCells((prev) => [...prev, new Array(prev[0]?.length ?? 3).fill("")]);
  }, []);

  const addCol = useCallback(() => {
    setCells((prev) => prev.map((row) => [...row, ""]));
  }, []);

  const removeRow = useCallback((idx: number) => {
    setCells((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const removeCol = useCallback((idx: number) => {
    setCells((prev) => {
      if ((prev[0]?.length ?? 0) <= 1) return prev;
      return prev.map((row) => row.filter((_, i) => i !== idx));
    });
  }, []);

  return (
    <div className="noteometry-table-editor">
      <table className="noteometry-table">
        <tbody>
          {cells.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>
                  <input
                    className="noteometry-table-cell"
                    inputMode="text"
                    enterKeyHint="next"
                    value={cell}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        // Move to next cell
                        const nextCol = ci + 1;
                        const nextRow = ri + (nextCol >= row.length ? 1 : 0);
                        const target = e.currentTarget.closest("table")
                          ?.querySelector(`tr:nth-child(${(nextRow % cells.length) + 1}) td:nth-child(${(nextCol % row.length) + 1}) input`) as HTMLInputElement | null;
                        target?.focus();
                      }
                    }}
                  />
                </td>
              ))}
              <td className="noteometry-table-action">
                <button onClick={() => removeRow(ri)} title="Remove row">−</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="noteometry-table-controls">
        <button onClick={addRow} title="Add row">+ Row</button>
        <button onClick={addCol} title="Add column">+ Col</button>
        {cells[0] && cells[0].length > 1 && (
          <button onClick={() => removeCol(cells[0]!.length - 1)} title="Remove last column">− Col</button>
        )}
      </div>
    </div>
  );
}
