/** Simple module-level store for table data, keyed by table ID */

const tables = new Map<string, string[][]>();

/** Change listener — called when any table or textbox data changes */
let onChangeCallback: (() => void) | null = null;
export function setOnChangeCallback(cb: (() => void) | null): void {
  onChangeCallback = cb;
}

export function getTableData(id: string): string[][] {
  return tables.get(id) ?? [
    ["", "", ""],
    ["", "", ""],
    ["", "", ""],
  ];
}

export function setTableData(id: string, data: string[][]): void {
  tables.set(id, data);
  onChangeCallback?.();
}

export function getAllTableData(): Record<string, string[][]> {
  const result: Record<string, string[][]> = {};
  for (const [id, data] of tables) {
    result[id] = data;
  }
  return result;
}

export function loadAllTableData(data: Record<string, string[][]>): void {
  tables.clear();
  for (const [id, cells] of Object.entries(data)) {
    tables.set(id, cells);
  }
}

export function clearTableData(): void {
  tables.clear();
}

/* ── Rich text box data ──────────────────────────────── */

const textBoxes = new Map<string, string>();

export function getTextBoxData(id: string): string {
  return textBoxes.get(id) ?? "";
}

export function setTextBoxData(id: string, html: string): void {
  textBoxes.set(id, html);
  onChangeCallback?.();
}

export function getAllTextBoxData(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [id, html] of textBoxes) {
    result[id] = html;
  }
  return result;
}

export function loadAllTextBoxData(data: Record<string, string>): void {
  textBoxes.clear();
  for (const [id, html] of Object.entries(data)) {
    textBoxes.set(id, html);
  }
}
