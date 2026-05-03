/**
 * v1.11.2 — DOM focus guards for drop-in interaction bugs.
 *
 * These three pure helpers are extracted from NoteometryApp / CanvasObjectLayer
 * so the gnarly "is focus inside this thing?" logic can be unit-tested
 * without rendering the whole React tree. Each one takes a DocumentLike
 * (the real `document`, or a vi.stubGlobal'd fake) plus the inputs it
 * needs, and returns a boolean.
 *
 * Bugs they fix:
 *   Fix 1 — `shouldSuppressDelete`: Backspace after clicking a chrome icon
 *           (Snapshot/Download/Duplicate/Delete) was nuking the entire
 *           drop-in because focus had moved to the BUTTON, which the
 *           keydown handler's INPUT/TEXTAREA/contenteditable check
 *           missed. Now: any focus inside the selected drop-in suppresses
 *           the delete.
 *
 *   Fix 3 — `shouldSkipBringToFront`: pointerdown was reordering the
 *           objects array even mid-edit, which remounted the wrapper and
 *           blew away the contenteditable selection on every click. Now:
 *           if an editable inside the dropin currently has focus, we
 *           don't reorder.
 */

interface DocumentLike {
  readonly activeElement: Element | null;
  readonly body: HTMLElement | null;
  querySelector(selectors: string): Element | null;
}

/**
 * Returns true when a Delete/Backspace pressed at the window level should
 * be ignored because focus currently lives inside the selected drop-in
 * (the wrapper element marked with `.noteometry-object-selected`).
 *
 * Defensive: returns false (i.e. allow delete) when there is no
 * selected drop-in, no active element, or the active element is the body.
 */
export function shouldSuppressDelete(doc: DocumentLike): boolean {
  const active = doc.activeElement;
  if (!active || active === doc.body) return false;
  const selected = doc.querySelector(".noteometry-object-selected");
  if (!selected) return false;
  return selected.contains(active);
}

/**
 * Returns true when the parent layer's `bringToFront(id)` call should
 * be SKIPPED because an editable control inside that drop-in currently
 * has focus.
 *
 * Reordering would remount the React subtree and discard the caret
 * position mid-keystroke. We only skip when active element is itself
 * one of: <input>, <textarea>, contenteditable="true". A focused button
 * is fine to reorder around — buttons take an action and don't lose
 * meaningful state.
 */
export function shouldSkipBringToFront(doc: DocumentLike, dropinId: string): boolean {
  const active = doc.activeElement;
  if (!active || active === doc.body) return false;
  const dropinEl = doc.querySelector(`[data-dropin-id="${dropinId}"]`);
  if (!dropinEl) return false;
  if (!dropinEl.contains(active)) return false;
  const editableSel = 'input, textarea, [contenteditable="true"]';
  const matches = (active as Element & { matches?: (s: string) => boolean }).matches;
  return typeof matches === "function" ? matches.call(active, editableSel) : false;
}
