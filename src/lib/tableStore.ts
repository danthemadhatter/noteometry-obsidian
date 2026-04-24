/** Scoped store for table + rich-text-box data.
 *
 *  Scope is the bound page's file path (or any stable per-page key).
 *  Tier 3 allowed multiple .nmpage tabs open at once; before this store
 *  was module-global, meaning tab A's loadAllTableData(data) would
 *  clear tab B's tables, and saves from either tab would write a union
 *  of all scopes' data into its own file. Every operation now takes a
 *  scope so tabs don't step on each other.
 */

const tableScopes = new Map<string, Map<string, string[][]>>();
const textBoxScopes = new Map<string, Map<string, string>>();

/** Per-scope change listeners — fire only when data in that scope
 *  changes, so each tab's autosave only runs for its own edits. */
const scopeCallbacks = new Map<string, () => void>();

export function setOnChangeCallback(scope: string, cb: (() => void) | null): void {
  if (cb) scopeCallbacks.set(scope, cb);
  else scopeCallbacks.delete(scope);
}

function fireCallback(scope: string): void {
  scopeCallbacks.get(scope)?.();
}

function ensureTableScope(scope: string): Map<string, string[][]> {
  let m = tableScopes.get(scope);
  if (!m) { m = new Map(); tableScopes.set(scope, m); }
  return m;
}

function ensureTextBoxScope(scope: string): Map<string, string> {
  let m = textBoxScopes.get(scope);
  if (!m) { m = new Map(); textBoxScopes.set(scope, m); }
  return m;
}

export function getTableData(scope: string, id: string): string[][] {
  return tableScopes.get(scope)?.get(id) ?? [
    ["", "", ""],
    ["", "", ""],
    ["", "", ""],
  ];
}

export function setTableData(scope: string, id: string, data: string[][]): void {
  ensureTableScope(scope).set(id, data);
  fireCallback(scope);
}

export function getAllTableData(scope: string): Record<string, string[][]> {
  const result: Record<string, string[][]> = {};
  const m = tableScopes.get(scope);
  if (!m) return result;
  for (const [id, data] of m) result[id] = data;
  return result;
}

export function loadAllTableData(scope: string, data: Record<string, string[][]>): void {
  const m = ensureTableScope(scope);
  m.clear();
  for (const [id, cells] of Object.entries(data)) m.set(id, cells);
}

/** Drop a scope entirely. Called when a NoteometryView tab closes so
 *  the Maps don't grow unbounded. */
export function clearScope(scope: string): void {
  tableScopes.delete(scope);
  textBoxScopes.delete(scope);
  scopeCallbacks.delete(scope);
}

/* ── Rich text box data ──────────────────────────────── */

export function getTextBoxData(scope: string, id: string): string {
  return textBoxScopes.get(scope)?.get(id) ?? "";
}

export function setTextBoxData(scope: string, id: string, html: string): void {
  ensureTextBoxScope(scope).set(id, html);
  fireCallback(scope);
}

export function getAllTextBoxData(scope: string): Record<string, string> {
  const result: Record<string, string> = {};
  const m = textBoxScopes.get(scope);
  if (!m) return result;
  for (const [id, html] of m) result[id] = html;
  return result;
}

export function loadAllTextBoxData(scope: string, data: Record<string, string>): void {
  const m = ensureTextBoxScope(scope);
  m.clear();
  for (const [id, html] of Object.entries(data)) m.set(id, html);
}
